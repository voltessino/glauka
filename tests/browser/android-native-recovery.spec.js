const { test, expect } = require("@playwright/test");
async function boot(
  page,
  {
    snapshot = null,
    failRead = false,
    previous = false,
    delay = 0,
    failWrite = false,
  } = {},
) {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(
    ({ snapshot, failRead, previous, delay, failWrite }) => {
      localStorage.setItem("nm6_welcome_seen", "1");
      localStorage.setItem("nm6_locale", "it");
      window.__writes = [];
      window.__discards = 0;
      window.GlaukaRecovery = {
        read(id) {
          setTimeout(
            () =>
              NeuroMapRecovery.nativeResult(
                id,
                !failRead,
                snapshot ? { json: JSON.stringify(snapshot), previous } : null,
              ),
            delay,
          );
        },
        write(json, id) {
          window.__writes.push(json);
          setTimeout(
            () => NeuroMapRecovery.nativeResult(id, !failWrite, true),
            5,
          );
        },
        discard(id) {
          window.__discards++;
          NeuroMapRecovery.nativeResult(id, true, true);
        },
      };
    },
    { snapshot, failRead, previous, delay, failWrite },
  );
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp && document.getElementById("glauka-save-indicator"),
  );
  await page.evaluate(() => neuroMapApp._desktopRecoveryReady);
}
const snapshot = () => ({
  version: 3,
  activeTabId: "saved",
  tabs: [
    {
      id: "saved",
      title: "Recovered",
      root: {
        id: "r",
        text: "Recovered",
        side: "root",
        color: "#6441df",
        children: [],
      },
      images: [],
      relationships: [],
      isDirty: false,
    },
  ],
  studyCards: [],
  learningAttempts: [],
  learningPlans: [],
});
test("native recovery survives the browser quota and waits for a real acknowledgement", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp;
    a.state.root.notes = "x".repeat(3_000_000);
    a.markChanged();
    const saved = await a.persistWorkspace();
    return {
      saved,
      bytes: __writes.at(-1).length,
      stored: JSON.parse(__writes.at(-1)).tabs.find(
        (t) => t.id === a.activeTabId,
      ).root.notes.length,
    };
  });
  expect(result).toMatchObject({ saved: true, stored: 3_000_000 });
  expect(result.bytes).toBeGreaterThan(2_600_000);
  await expect(page.locator("#glauka-save-indicator")).toHaveAttribute(
    "data-recovery",
    "ready",
  );
});
test("previous generation restores with a clear message and preserved cards", async ({
  page,
}) => {
  const doc = snapshot();
  doc.studyCards = [
    {
      id: "saved-card",
      sourceTabId: "saved",
      sourceNodeId: "r",
      question: "Q",
      answer: "A",
    },
  ];
  await boot(page, { snapshot: doc, previous: true });
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "Recovered",
  );
  expect(await page.evaluate(() => neuroMapApp.studyCards[0].id)).toBe(
    "saved-card",
  );
  await expect(page.locator("#toast-text")).toContainText("copia precedente");
});
test("corrupt recovery never overwrites opened projects or silently replaces the journal", async ({
  page,
}) => {
  await boot(page, { failRead: true });
  const before = await page.evaluate(() =>
    JSON.stringify(neuroMapApp.state.root),
  );
  expect(await page.evaluate(() => neuroMapApp.persistWorkspace())).toBe(false);
  expect(await page.evaluate(() => __writes.length)).toBe(0);
  expect(
    await page.evaluate(() => JSON.stringify(neuroMapApp.state.root)),
  ).toBe(before);
  await expect(page.locator("#glauka-save-indicator")).toHaveAttribute(
    "data-recovery",
    "error",
  );
});
test("malformed later tab cannot partially replace current cards or maps", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const a = neuroMapApp;
    a.studyCards = [{ id: "keep" }];
    const before = JSON.stringify([a.state.root, a.studyCards]);
    const applied = a.loadAutosave(
      JSON.stringify({
        tabs: [
          { root: { id: "valid", text: "Wrong", children: [] } },
          { root: null },
        ],
        studyCards: [],
      }),
    );
    return {
      applied: applied === true,
      unchanged: JSON.stringify([a.state.root, a.studyCards]) === before,
    };
  });
  expect(result).toEqual({ applied: false, unchanged: true });
});
test("write errors are visible and never mark a project file as saved", async ({
  page,
}) => {
  await boot(page, { failWrite: true });
  const result = await page.evaluate(async () => {
    const a = neuroMapApp;
    a.markChanged();
    return { saved: await a.persistWorkspace(), dirty: a.state.isDirty };
  });
  expect(result).toEqual({ saved: false, dirty: true });
  await expect(page.locator("#glauka-save-indicator")).toHaveAttribute(
    "data-recovery",
    "error",
  );
});
test("cancelled export does not claim that the complete backup was saved", async ({
  page,
}) => {
  await boot(page);
  const value = await page.evaluate(async () => {
    const a = neuroMapApp;
    let notice = false;
    a.io.triggerDownload = async () => false;
    a.showToast = () => (notice = true);
    return {
      ok: await a.io.exportBatchWorkspaceJSON(),
      notice,
      confirmed: !!a._nmLastBackupSucceeded,
    };
  });
  expect(value).toEqual({ ok: false, notice: false, confirmed: false });
});
test("rapid checkpoints coalesce and the final acknowledged snapshot is the newest one", async ({
  page,
}) => {
  await boot(page);
  const value = await page.evaluate(async () => {
    const a = neuroMapApp,
      writes = [];
    for (let i = 0; i < 12; i++) {
      a.state.root.text = "Revision " + i;
      a.markChanged();
      writes.push(a.persistWorkspace());
    }
    await Promise.all(writes);
    const last = JSON.parse(__writes.at(-1));
    return {
      text: last.tabs.find((t) => t.id === a.activeTabId).root.text,
      calls: __writes.length,
    };
  });
  expect(value.text).toBe("Revision 11");
  expect(value.calls).toBeLessThan(12);
});
test("real native export callback distinguishes cancellation from a written backup", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp;
    let ok = false,
      notices = [];
    a.markChanged();
    a.showToast = (...args) => notices.push(args);
    window.NMAndroid = {
      saveProject(name, data, id) {
        queueMicrotask(() => NeuroMapLifecycle.androidSaved(id, { ok }));
      },
    };
    const cancel = await a.io.exportBatchWorkspaceJSON();
    const cancelNotice = notices.length;
    ok = true;
    const saved = await a.io.exportBatchWorkspaceJSON();
    return {
      cancel,
      cancelNotice,
      saved,
      confirmed: !!a._nmLastBackupSucceeded,
      dirty: a.state.isDirty,
    };
  });
  expect(result).toEqual({
    cancel: false,
    cancelNotice: 0,
    saved: true,
    confirmed: true,
    dirty: true,
  });
});
test("editing during native Save keeps the newer project dirty after the old file is written", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    const a = neuroMapApp;
    a.markChanged();
    window.NMAndroid = {
      saveProject(name, data, id) {
        window.__saveId = id;
      },
    };
    window.__projectSave = a.io.saveProjectFile();
  });
  await page.waitForFunction(() => window.__saveId);
  await page.evaluate(() => {
    neuroMapApp.state.root.text = "Changed while saving";
    neuroMapApp.markChanged();
    NeuroMapLifecycle.androidSaved(__saveId, { ok: true });
  });
  expect(
    await page.evaluate(async () => ({
      ok: await __projectSave,
      dirty: neuroMapApp.state.isDirty,
    })),
  ).toEqual({ ok: true, dirty: true });
});
test("notes offer a clear offline path and an AI path without sending data on opening", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    window.__aiCalls = 0;
    neuroMapApp.aiClient.chat = async () => {
      window.__aiCalls++;
      throw Error("No request expected");
    };
  });
  await page.locator("#glauka-add-open").click();
  await expect(
    page.getByText("Il testo conserva righe e titoli.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Crea e riassumi con AI", exact: true })
    .click();
  await expect(page.locator("#nm-ai-studio")).toBeVisible();
  expect(await page.evaluate(() => __aiCalls)).toBe(0);
  expect(await page.evaluate(() => neuroMapApp.aiStudio.activeTask)).toBe(
    "text",
  );
});
test("native recovery takes precedence over a stale dirty browser fallback on every launch", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "neuromap.workspace.v2",
      JSON.stringify({
        tabs: [
          {
            id: "old",
            root: { id: "old-root", text: "Stale browser copy", children: [] },
            isDirty: true,
          },
        ],
      }),
    ),
  );
  await boot(page, { snapshot: snapshot() });
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "Recovered",
  );
  await page.reload();
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-glauka-ready"),
  );
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "Recovered",
  );
});
test("legacy browser recovery migrates only when the native journal is empty", async ({
  page,
}) => {
  const legacy = snapshot();
  legacy.tabs[0].root.text = "Legacy draft";
  legacy.tabs[0].isDirty = true;
  await page.addInitScript(
    (doc) => localStorage.setItem("neuromap.workspace.v2", JSON.stringify(doc)),
    legacy,
  );
  await boot(page);
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "Legacy draft",
  );
  expect(await page.evaluate(() => neuroMapApp.persistWorkspace())).toBe(true);
  expect(
    await page.evaluate(() => JSON.parse(__writes.at(-1)).tabs[0].root.text),
  ).toBe("Legacy draft");
});
for (const style of ["neon", "radial"])
  test(
    "large-map " +
      style +
      " viewport optimization keeps visible pixels and full exports identical",
    async ({ page }) => {
      await boot(page);
      const result = await page.evaluate(async (style) => {
        const a = neuroMapApp;
        a.importHierarchy(
          {
            text: "Project",
            children: Array.from({ length: 12 }, (_, i) => ({
              text: "Area " + i,
              children: Array.from({ length: 30 }, (_, j) => ({
                text: "Task " + i + " / " + j,
                children: [],
              })),
            })),
          },
          { newTab: true },
        );
        a.state.branchStyle = style;
        a.recalculateAndRender();
        a.renderer.camera = { x: 196, y: 426, zoom: 0.6 };
        const before = JSON.stringify(a.state.root),
          r = a.renderer,
          canvasCount = document.querySelectorAll("canvas").length;
        async function hash() {
          const bytes = r.ctx.getImageData(
            0,
            0,
            r.canvas.width,
            r.canvas.height,
          ).data;
          return Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ).join(",");
        }
        r.highPerformanceCanvas = false;
        r.render();
        const original = await hash();
        r.highPerformanceCanvas = true;
        r.render();
        const optimized = await hash(),
          stats = r.fastCanvasStats;
        const off = document.createElement("canvas");
        off.width = 800;
        off.height = 600;
        let nodes = 0;
        const draw = r.drawNode;
        r.drawNode = function (...args) {
          nodes++;
          return draw.apply(this, args);
        };
        try {
          r.render(off.getContext("2d"), { scale: 0.12, tx: 0, ty: 0 });
        } finally {
          r.drawNode = draw;
        }
        return {
          same: original === optimized,
          unchanged: before === JSON.stringify(a.state.root),
          painted: stats.painted,
          visited: stats.visited,
          exportNodes: nodes,
          canvases: document.querySelectorAll("canvas").length === canvasCount,
        };
      }, style);
      expect(result.same).toBe(true);
      expect(result.unchanged).toBe(true);
      expect(result.painted).toBeLessThan(result.visited);
      expect(result.exportNodes).toBe(373);
      expect(result.canvases).toBe(true);
    },
  );
test("native recovery also works on WebViews without crypto.randomUUID", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await boot(page, { snapshot: snapshot() });
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "Recovered",
  );
  expect(await page.evaluate(() => neuroMapApp.persistWorkspace())).toBe(true);
});
test('unreadable recovery offers an actual backup picker and keeps the current workspace until import',async({page})=>{
 await boot(page,{failRead:true});await page.setViewportSize({width:320,height:568});
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Apri un backup',exact:true}).click();
 await (await picker).setFiles({name:'backup.neuromap',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'NeuroMapArchitect-SingleTab-v6',root:{text:'Backup opened',children:[]}}))});
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Backup opened');
 expect(await page.evaluate(()=>__writes.length)).toBe(0);
});
test('recovery never silently truncates a larger existing flashcard collection',async({page})=>{
 const doc=snapshot();doc.studyCards=Array.from({length:3001},(_,i)=>({id:'card-'+i,sourceTabId:'saved',sourceNodeId:'r',question:'Question '+i,answer:'Answer '+i}));
 await boot(page,{snapshot:doc});expect(await page.evaluate(()=>neuroMapApp.studyCards.length)).toBe(3001);
 expect(await page.evaluate(()=>neuroMapApp.persistWorkspace())).toBe(true);
 expect(await page.evaluate(()=>JSON.parse(__writes.at(-1)).studyCards.at(-1).id)).toBe('card-3000');
});
