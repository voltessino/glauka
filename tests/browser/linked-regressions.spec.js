const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    process.env.NEUROMAP_TEST_DESKTOP_URL || "http://127.0.0.1:5174/index.html",
  );
  await page.waitForFunction(
    () => window.neuroMapApp && window.NeuroMapLinkedViews,
  );
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    neuroMapApp.importHierarchy(
      {
        text: "Progetto",
        children: [
          { text: "Salva", children: [] },
          { text: "Annulla", children: [] },
        ],
      },
      { newTab: true },
    );
  });
});
for (const mode of [
  "orgchart",
  "concept-tree",
  "flowchart",
  "kanban",
  "timeline",
])
  test(`${mode}: reopening a project retains view, statuses, dates and typed links`, async ({
    page,
  }) => {
    const result = await page.evaluate(async (mode) => {
      const a = neuroMapApp,
        [one, two] = a.state.root.children;
      a.state.setNodeWorkMetadata(one.id, {
        taskStatus: "doing",
        startDate: "2026-11-03",
        dueDate: "2026-11-08",
      });
      a.state.addFlowTransition(one.id, two.id, "yes");
      NeuroMapLinkedViews.setMode(a, mode);
      const payload = a.io.buildSerializedProjectPayload();
      await a.importFile(
        new File([JSON.stringify(payload)], "latest.neuromap"),
        { newTab: true },
      );
      const s = a.state,
        [child, other] = s.root.children;
      return {
        mode: s.root.viewMode,
        status: child.taskStatus,
        start: child.startDate,
        due: child.dueDate,
        kind: s.relationships[0].kind,
        remapped:
          s.relationships[0].fromId === child.id &&
          s.relationships[0].toId === other.id,
      };
    }, mode);
    expect(result).toEqual({
      mode,
      status: "doing",
      start: "2026-11-03",
      due: "2026-11-08",
      kind: "yes",
      remapped: true,
    });
  });
test("unapplied task fields survive an unrelated redraw and invalid-date feedback", async ({
  page,
}) => {
  await page.evaluate(() => NeuroMapLinkedViews.setMode(neuroMapApp, "kanban"));
  await expect(page.locator("#nm-work-toolbar")).toBeVisible();
  await page.locator("#nm-work-status").selectOption("doing");
  await page.locator("#nm-work-start").fill("2026-11-08");
  await page.locator("#nm-work-end").fill("2026-11-03");
  await page.evaluate(() => neuroMapApp.recalculateAndRender());
  await expect(page.locator("#nm-work-status")).toHaveValue("doing");
  await expect(page.locator("#nm-work-start")).toHaveValue("2026-11-08");
  await page.locator("#nm-work-apply").click();
  await expect(page.locator("#nm-work-start")).toHaveValue("2026-11-08");
  await page.locator("#nm-work-end").fill("2026-11-10");
  await page.locator("#nm-work-apply").click();
  expect(
    await page.evaluate(() => neuroMapApp.state.root.children[0].dueDate),
  ).toBe("2026-11-10");
});
test("toolbar Tab and timeline activation never add or edit a canvas node", async ({
  page,
}) => {
  const id = await page.evaluate(() => {
    const a = neuroMapApp,
      n = a.state.root.children[0];
    a.state.setNodeWorkMetadata(n.id, { startDate: "2026-11-03" });
    NeuroMapLinkedViews.setMode(a, "timeline");
    return n.id;
  });
  await page.locator("#nm-work-apply").focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => neuroMapApp.state.getAllNodes().length),
  ).toBe(3);
  expect(await page.evaluate(() => neuroMapApp.editorNodeId)).toBeFalsy();
  await page.locator(".nm-timeline-card").focus();
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => neuroMapApp.editorNodeId)).toBeFalsy();
  expect(await page.evaluate(() => neuroMapApp.state.selectedNodeId)).toBe(id);
  await expect(page.locator(".nm-timeline-card")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
test("switching language preserves user text and updates linked accessibility labels", async ({
  page,
}) => {
  await page.evaluate(() =>
    NeuroMapLinkedViews.setMode(neuroMapApp, "orgchart"),
  );
  await expect(
    page.locator(".nm-view-title").filter({ hasText: /^Salva$/ }),
  ).toHaveCount(1);
  await page.evaluate(async()=>{await GlaukaI18n.setLanguage("en");});
  await expect(page.locator("#nm-view-heading")).toHaveText(
    "Organization chart",
  );
  await expect(page.locator("#nm-view-overlay")).toHaveAttribute(
    "aria-label",
    "Linked view",
  );
  await expect(
    page.locator(".nm-view-title").filter({ hasText: /^Salva$/ }),
  ).toHaveCount(1);
  await expect(
    page.locator(".nm-view-title").filter({ hasText: /^Annulla$/ }),
  ).toHaveCount(1);
});
test("linked SVG uses the native export bridge and translates decision labels", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const a = neuroMapApp,
      [one, two] = a.state.root.children;
    a.state.addFlowTransition(one.id, two.id, "yes");
    NeuroMapLinkedViews.setMode(a, "flowchart");
    await GlaukaI18n.setLanguage("en");
    window.neuromapDesktop = {
      ...window.neuromapDesktop,
      saveExport: async ({ filename, bytes }) => {
        window.savedLinkedSVG = {
          filename,
          text: new TextDecoder().decode(bytes),
        };
        return { name: filename };
      },
    };
  });
  await page.locator('#nm-view-export-menu > summary').click();
  await page.locator("#nm-view-export-svg").click();
  await expect
    .poll(() => page.evaluate(() => window.savedLinkedSVG?.filename))
    .toBe("Progetto-flowchart.svg");
  expect(
    await page.evaluate(
      () =>
        new DOMParser()
          .parseFromString(savedLinkedSVG.text, "image/svg+xml")
          .querySelector("parsererror") === null,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      [
        ...new DOMParser()
          .parseFromString(savedLinkedSVG.text, "image/svg+xml")
          .querySelectorAll("text"),
      ].map((e) => e.textContent),
    ),
  ).toContain("Yes");
});
test("timeline and exported SVG show an explicit calendar axis", async ({
  page,
}) => {
  await page.evaluate(() => {
    const a = neuroMapApp,
      n = a.state.root.children[0];
    a.state.setNodeWorkMetadata(n.id, {
      startDate: "2026-11-03",
      dueDate: "2026-11-08",
    });
    NeuroMapLinkedViews.setMode(a, "timeline");
  });
  await expect(page.locator("#nm-view-lines")).toContainText("2026-11-03");
  await expect(page.locator("#nm-view-lines")).toContainText("2026-11-08");
  const svg = await page.evaluate(async () => {
    let data;
    const io = neuroMapApp.io,
      save = io.triggerDownload;
    io.triggerDownload = (b) => {
      data = b;
    };
    try {
      document.getElementById("nm-view-export-svg").click();
      return await data.text();
    } finally {
      io.triggerDownload = save;
    }
  });
  expect(svg).toContain("2026-11-03");
  expect(svg).toContain("2026-11-08");
});
for (const size of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`linked controls leave the view reachable at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.evaluate(() => {
      const a = neuroMapApp,
        [one, two] = a.state.root.children;
      a.state.addFlowTransition(one.id, two.id, "yes");
      for (let i = 0; i < 12; i++) {
        const n = a.state.addChildNode(
          one.id,
          a.layout,
          "Passaggio dettagliato numero " + i,
        );
        a.state.addFlowTransition(one.id, n.id, "sequence");
      }
      a.state.setNodeWorkMetadata(one.id, { dueDate: "2026-11-03" });
    });
    for (const mode of ["flowchart", "kanban", "timeline"]) {
      await page.evaluate(
        (mode) => NeuroMapLinkedViews.setMode(neuroMapApp, mode),
        mode,
      );
      await expect(page.locator("#nm-view-overlay-picker")).toHaveValue(mode);
      const bounds = await page.locator("#nm-view-scroller").boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(100);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
    }
  });
test("Kanban keyboard selection applies status to the focused task, never the previous one", async ({
  page,
}) => {
  const id = await page.evaluate(() => {
    NeuroMapLinkedViews.setMode(neuroMapApp, "kanban");
    return neuroMapApp.state.root.children[1].id;
  });
  await page.locator(`.nm-view-card[data-node-id="${id}"]`).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#nm-work-node")).toHaveValue(id);
  await page.locator("#nm-work-status").selectOption("done");
  await page.locator("#nm-work-apply").click();
  expect(
    await page.evaluate(() =>
      neuroMapApp.state.root.children.map((n) => n.taskStatus || null),
    ),
  ).toEqual([null, "done"]);
  for (const modifier of ["Control", "Meta"]) {
    await page.locator(`.nm-view-card[data-node-id="${id}"]`).focus();
    await page.keyboard.press(modifier + "+z");
    expect(
      await page.evaluate(() => neuroMapApp.state.root.children[1].taskStatus),
    ).toBeUndefined();
    await page.keyboard.press(modifier + "+Shift+z");
    expect(
      await page.evaluate(() => neuroMapApp.state.root.children[1].taskStatus),
    ).toBe("done");
  }
});
