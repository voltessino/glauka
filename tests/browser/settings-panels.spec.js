const { test, expect } = require("@playwright/test");
async function open(page, platform) {
  await page.setViewportSize({ width: 1440, height: 960 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    platform === "desktop"
      ? "http://127.0.0.1:5174/index.html"
      : "http://127.0.0.1:5173/app/index.html",
  );
  await page.waitForFunction(() => window.neuroMapApp?.nmSettings);
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Mappa A",
        children: [
          { text: "Primo", children: [{ text: "Dettaglio", children: [] }] },
          { text: "Secondo", children: [] },
        ],
      },
      { newTab: true },
    );
    a.selectNode(a.state.root.children[0].id);
    window.sourceID = a.activeTabId;
  });
}
async function slider(page, id, value) {
  await page.evaluate(
    ({ id, value }) => {
      const e = document.getElementById(id);
      e.value = String(value);
      e.dispatchEvent(new Event("input", { bubbles: true }));
      e.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { id, value },
  );
}
for (const platform of ["desktop", "android"])
  test.describe(platform + " central settings", () => {
    test.beforeEach(async ({ page }) => open(page, platform));
    test("scope changes do not edit any map and one parameter preserves unrelated customizations", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const a = neuroMapApp,
          one = a.state;
        one.compactness = 75;
        one.strokeScale = 0.8;
        const second = a.createNewTab("Seconda").state;
        second.compactness = 135;
        second.strokeScale = 2.2;
        second.branchGapX = 180;
        a.activateTab(sourceID);
        const history = [one.undoStack.length, second.undoStack.length],
          s = document.getElementById("nm-settings-scope-layout");
        s.value = "all";
        s.dispatchEvent(new Event("change"));
        return {
          history,
          after: [one.undoStack.length, second.undoStack.length],
          before: [one.compactness, second.compactness],
        };
      });
      expect(r.history).toEqual(r.after);
      expect(r.before).toEqual([75, 135]);
      await expect(page.locator("#nm67-compact-readout")).toHaveText(
        "Valori diversi",
      );
      await slider(page, "nm67-compact-slider", 100);
      const after = await page.evaluate(() => {
        const a = neuroMapApp,
          second = a.tabs.find((t) => t.title === "Seconda").state;
        return {
          spacing: [a.state.compactness, second.compactness],
          stroke: [a.state.strokeScale, second.strokeScale],
          gap: second.branchGapX,
        };
      });
      expect(after).toEqual({
        spacing: [100, 100],
        stroke: [0.8, 2.2],
        gap: 180,
      });
    });
    test("range gestures have one Undo per affected map and support Redo", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const a = neuroMapApp,
          first = a.state;
        first.compactness = 75;
        a.createNewTab("Seconda");
        const second = a.state;
        second.compactness = 135;
        a.activateTab(sourceID);
        const scope = document.getElementById("nm-settings-scope-layout");
        scope.value = "all";
        scope.dispatchEvent(new Event("change"));
        const history = [first.undoStack.length, second.undoStack.length],
          e = document.getElementById("nm67-compact-slider");
        e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        for (const value of [80, 95, 110]) {
          e.value = value;
          e.dispatchEvent(new Event("input", { bubbles: true }));
        }
        e.dispatchEvent(new Event("change", { bubbles: true }));
        const deltas = [
          first.undoStack.length - history[0],
          second.undoStack.length - history[1],
        ];
        first.undo();
        second.undo();
        const undo = [first.compactness, second.compactness];
        first.redo();
        second.redo();
        return { deltas, undo, redo: [first.compactness, second.compactness] };
      });
      expect(r).toEqual({ deltas: [1, 1], undo: [75, 135], redo: [110, 110] });
    });
    test("node scope is explicit and changing bold never copies italic or map parameters", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const a = neuroMapApp,
          first = a.state;
        first.root.children[0].fontItalic = true;
        first.strokeScale = 0.7;
        a.createNewTab("Seconda");
        const second = a.state;
        second.root.fontItalic = false;
        second.strokeScale = 2.4;
        a.activateTab(sourceID);
        const s = document.getElementById("nm-settings-scope-style");
        s.value = "all";
        s.dispatchEvent(new Event("change"));
        document.getElementById("btn-weight-bold").click();
        return {
          target: document.getElementById("nm-format-target").value,
          bold: [first, second].every((s) =>
            s.getAllNodes().every((n) => n.fontWeight === 700),
          ),
          italic: [first.root.children[0].fontItalic, second.root.fontItalic],
          stroke: [first.strokeScale, second.strokeScale],
        };
      });
      expect(r).toEqual({
        target: "map",
        bold: true,
        italic: [true, false],
        stroke: [0.7, 2.4],
      });
    });
    test("only selected defaults apply to future maps and survive restart", async ({
      page,
    }) => {
      await slider(page, "nm68-branch-gap", 100);
      await page.evaluate(() => {
        neuroMapApp.state.strokeScale = 2.2;
        document.getElementById("nm-settings-defaults-layout").click();
      });
      await expect(page.locator("#nm-settings-defaults")).toBeVisible();
      await page.evaluate(() => {
        for (const e of document.querySelectorAll(
          "#nm-settings-defaults input[type=checkbox]",
        ))
          e.checked = e.dataset.setting === "gap";
        document
          .querySelector("#nm-settings-defaults input[data-setting=gap]")
          .dispatchEvent(new Event("change"));
      });
      await page.locator("#nm-settings-save-defaults").click();
      const r = await page.evaluate(() => {
        const a = neuroMapApp,
          old = a.state;
        const next = a.newState("Nuova");
        return {
          future: next.branchGapX,
          old: old.branchGapX,
          oldStroke: old.strokeScale,
          futureStroke: next.strokeScale,
        };
      });
      expect(r).toEqual({
        future: 100,
        old: 100,
        oldStroke: 2.2,
        futureStroke: 1,
      });
      await page.reload();
      await page.waitForFunction(() => window.neuroMapApp?.nmSettings);
      expect(
        await page.evaluate(() => neuroMapApp.newState("Dopo").branchGapX),
      ).toBe(100);
    });
    test("mixed defaults are excluded; reset affects future items and retains other groups", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const a = neuroMapApp;
        a.state.branchGapX = 100;
        a.createNewTab("Seconda");
        a.state.branchGapX = 180;
        a.activateTab(sourceID);
        const s = document.getElementById("nm-settings-scope-layout");
        s.value = "all";
        s.dispatchEvent(new Event("change"));
        document.getElementById("nm-settings-defaults-layout").click();
      });
      await expect(page.locator("[data-setting=gap]")).toBeDisabled();
      await page.locator("#nm-settings-defaults-close").click();
      await page.evaluate(() => {
        localStorage.setItem(
          "neuromap.format.defaults.v1",
          JSON.stringify({
            gap: { branchGapX: 100 },
            stroke: { strokeScale: 2.2 },
          }),
        );
        document.getElementById("nm-settings-defaults-layout").click();
      });
      await page.locator("#nm-settings-reset-defaults").click();
      const r = await page.evaluate(() => ({
        existing: neuroMapApp.state.branchGapX,
        gap: neuroMapApp.newState().branchGapX,
        stroke: neuroMapApp.newState().strokeScale,
      }));
      expect(r).toEqual({
        existing: 100,
        gap: platform === "android" ? 150 : 30,
        stroke: 2.2,
      });
    });
    test("layout transitions remain coherent and compute continuation floors independently per map", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const a = neuroMapApp;
        a.createNewTab("Seconda");
        a.activateTab(sourceID);
        const s = document.getElementById("nm-settings-scope-layout");
        s.value = "all";
        s.dispatchEvent(new Event("change"));
        document.getElementById("nm-mode-right").click();
        document.getElementById("nm-mode-clockwise").click();
        return a.tabs.map((t) => ({
          mode: t.state.root.layoutMode,
          enabled: t.state.root.layoutDistribution.enabled,
          min: t.state.root.layoutDistribution.minimumHeight,
        }));
      });
      for (const value of r) {
        expect(value.mode).toBe("clockwise");
        expect(value.enabled).toBe(true);
        expect(value.min).toBeGreaterThanOrEqual(480);
      }
    });
    test("spacing survives autosave, map export and import without preference override", async ({
      page,
    }) => {
      await slider(page, "nm67-compact-slider", 125);
      await slider(page, "nm68-branch-gap", 95);
      await page.evaluate(() => {
        neuroMapApp.state.typographyPreset = "pyramid";
        neuroMapApp.persistWorkspace();
      });
      await page.reload();
      await page.waitForFunction(() => window.neuroMapApp?.nmSettings);
      const r = await page.evaluate(() => {
        const a = neuroMapApp;
        return {
          gap: a.state.branchGapX,
          vertical: a.state.compactness,
          profile: a.state.typographyPreset,
        };
      });
      expect(r).toEqual({ gap: 95, vertical: 125, profile: "pyramid" });
    });
    test("responsive panels, tooltips and labels work in Italian and English", async ({
      page,
    }) => {
      if(platform==='android'){
        const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
        await page.evaluate(async()=>{await GlaukaI18n.setLanguage('en')});
        await page.locator('#glauka-style-open').click();await page.locator('#inspector-sidebar .glauka-scope-options > summary').click();
        await expect(page.locator('#nm-settings-defaults-style')).toHaveText('Save as defaults');
        await expect(page.locator('#nm-settings-scope-style option[value=all]')).toHaveText('All open maps');
        await page.setViewportSize({width:390,height:844});
        const style=await page.locator('#inspector-sidebar').boundingBox();expect(style.x).toBeGreaterThanOrEqual(0);expect(style.x+style.width).toBeLessThanOrEqual(390);
        await page.locator('#btn-close-inspector').click();await page.locator('#glauka-options-open').click();await page.locator('#glauka-app-sheet').getByRole('button',{name:'Branch arrangement',exact:true}).click();
        await expect(page.locator('#nm-settings-defaults-layout')).toHaveText('Save as defaults');
        const panel=await page.locator('#glauka-app-sheet .glauka-sheet-panel').boundingBox();expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(390);expect(panel.y+panel.height).toBeLessThanOrEqual(844);
        await expect(page.locator('#nm-settings-defaults-layout')).toHaveAccessibleName('☆ Save as defaults');
        expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);return;
      }
      await page.evaluate(async () => {
        document.getElementById("v6-show-layout").click();
        document
          .getElementById("inspector-sidebar")
          .classList.remove("collapsed");
        await GlaukaI18n.setLanguage("en");
      });
      await expect(page.locator("#nm-settings-defaults-layout")).toHaveText(
        "Save as defaults",
      );
      await expect(
        page.locator("#nm-settings-scope-layout option[value=all]"),
      ).toHaveText("All open maps");
      await page.setViewportSize({ width: 390, height: 844 });
      for (const id of ["nm-settings-layout", "nm-settings-style"]) {
        await page.evaluate((id) => {
          document
            .getElementById("inspector-sidebar")
            .classList.toggle("collapsed", id === "nm-settings-layout");
          document
            .querySelector(".hud-bottom-left")
            .classList.toggle("hidden", id !== "nm-settings-layout");
        }, id);
        await expect
          .poll(() =>
            page
              .locator("#" + id)
              .evaluate((e) => e.getBoundingClientRect().right),
          )
          .toBeLessThanOrEqual(390);
        const r = await page.locator("#" + id).evaluate((e) => ({
          width: e.clientWidth,
          scroll: e.scrollWidth,
          box: e.getBoundingClientRect().toJSON(),
        }));
        expect(r.scroll).toBeLessThanOrEqual(r.width);
        expect(r.box.x).toBeGreaterThanOrEqual(0);
        expect(r.box.right).toBeLessThanOrEqual(390);
      }
      await page.evaluate(() => {
        document.getElementById("inspector-sidebar").classList.add("collapsed");
        document.querySelector(".hud-bottom-left").classList.remove("hidden");
      });
      await expect
        .poll(() =>
          page.locator(".hud-bottom-left").evaluate((e) => {
            const panel = e.getBoundingClientRect(),
              footer = document
                .querySelector(".hud-bottom-right")
                .getBoundingClientRect();
            return panel.bottom - footer.top;
          }),
        )
        .toBeLessThanOrEqual(-7);
      await page.locator("#nm-settings-defaults-layout").hover();
      await expect(page.locator("#nm-help-tooltip")).toBeVisible();
      await page.mouse.move(0, 0);
      if (platform === "desktop") {
        await page.evaluate(async () => {
          await GlaukaI18n.setLanguage("it");
        });
        await page
          .locator(".hud-bottom-left")
          .screenshot({ path: "/workspace/central-layout.png" });
      }
    });
  });
for (const platform of ["desktop", "android"])
  test(`${platform}: node defaults affect future nodes, reset leaves existing nodes and layout defaults intact`, async ({
    page,
  }) => {
    await open(page, platform);
    await page.evaluate(() => {
      const a = neuroMapApp,
        n = a.state.findNode(a.state.selectedNodeId);
      n.fontSize = 26;
      n.fontItalic = true;
      localStorage.setItem(
        "neuromap.format.defaults.v1",
        JSON.stringify({ gap: { branchGapX: 95 } }),
      );
      document.getElementById("nm-settings-defaults-style").click();
    });
    await page.evaluate(() => {
      for (const c of document.querySelectorAll("#nm-settings-defaults input"))
        c.checked = ["font-size", "font-style"].includes(c.dataset.setting);
      document
        .querySelector("[data-setting=font-size]")
        .dispatchEvent(new Event("change"));
    });
    await page.locator("#nm-settings-save-defaults").click();
    const first = await page.evaluate(() => {
      const a = neuroMapApp,
        n = a.state.addChildNode(a.state.selectedNodeId);
      window.testNewNode = n.id;
      return { size: n.fontSize, italic: n.fontItalic };
    });
    expect(first).toEqual({ size: 26, italic: true });
    await page.evaluate(() =>
      document.getElementById("nm-settings-defaults-style").click(),
    );
    await page.locator("#nm-settings-reset-defaults").click();
    const next = await page.evaluate(() => {
      const a = neuroMapApp,
        prior = a.state.findNode(testNewNode),
        n = a.state.addChildNode(a.state.selectedNodeId);
      return {
        old: prior.fontSize,
        size: n.fontSize ?? null,
        italic: n.fontItalic ?? false,
        gap: a.newState().branchGapX,
      };
    });
    expect(next).toEqual({ old: 26, size: null, italic: false, gap: 95 });
  });
for (const platform of ["desktop", "android"])
  test(`${platform}: a stale preferences review cannot save values after changing maps`, async ({
    page,
  }) => {
    await open(page, platform);
    await page.evaluate(() =>
      document.getElementById("nm-settings-defaults-layout").click(),
    );
    await page.evaluate(() => neuroMapApp.createNewTab("Altra"));
    await page.locator("#nm-settings-save-defaults").click();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("neuromap.format.defaults.v1"),
      ),
    ).toBeNull();
    await expect(
      page.locator("#nm-settings-defaults [role=status]"),
    ).toContainText("cambiate");
  });
for (const platform of ["desktop", "android"])
  test(`${platform}: property-specific scope covers scale, wrapping, palette and profile, keeping manual node styles`, async ({
    page,
  }) => {
    await open(page, platform);
    await page.evaluate(() => {
      const a = neuroMapApp;
      a.createNewTab("Altra");
      a.state.strokeScale = 2.6;
      a.state.root.fontSize = 35;
      a.state.root.color = "#123456";
      a.activateTab(sourceID);
      for (const id of ["layout", "style"]) {
        const el = document.getElementById("nm-settings-scope-" + id);
        el.value = "all";
        el.dispatchEvent(new Event("change"));
      }
    });
    await slider(page, "v5-font-scale", 125);
    await slider(page, "nm54-map-wrap-slider", 35);
    await page.evaluate(() => {
      document.querySelector("[data-v6-preset=pyramid]").click();
    });
    const r = await page.evaluate(() => {
      const a = neuroMapApp;
      return a.tabs.map((t) => ({
        scale: t.state.typographyScale,
        wrap: t.state.defaultLabelWrapChars,
        preset: t.state.typographyPreset,
        stroke: t.state.strokeScale,
        size: t.state.root.fontSize ?? null,
        color: t.state.root.color,
      }));
    });
    for (const row of r) {
      expect(row.scale).toBe(1.25);
      expect(row.wrap).toBe(35);
      expect(row.preset).toBe("pyramid");
    }
    const second = r.at(-1);
    expect(second.stroke).toBe(2.6);
    expect(second.size).toBe(35);
    expect(second.color).toBe("#123456");
    await page.evaluate(() =>
      document.querySelector("[data-theme-id=forest]").click(),
    );
    expect(
      await page.evaluate(() =>
        neuroMapApp.tabs.every((t) => t.state.activeThemeId === "forest"),
      ),
    ).toBe(true);
  });
for (const platform of ["desktop", "android"])
  test(`${platform}: project round trip retains spacing and typography despite different creation defaults`, async ({
    page,
  }) => {
    await open(page, platform);
    const r = await page.evaluate(async () => {
      const a = neuroMapApp;
      a.state.branchGapX = 90;
      a.state.compactness = 130;
      a.state.typographyPreset = "pyramid";
      a.state.root.text = "Progetto salvato";
      let blob;
      const old = a.io.triggerDownload;
      a.io.triggerDownload = (b) => (blob = b);
      try {
        a.io.exportJSON();
      } finally {
        a.io.triggerDownload = old;
      }
      const text = await blob.text();
      localStorage.setItem(
        "neuromap.format.defaults.v1",
        JSON.stringify({
          gap: { branchGapX: 200 },
          vertical: { compactness: 55 },
          profile: { typographyPreset: "uniform" },
        }),
      );
      await a.importFile(new File([text], "progetto.neuromap"), {
        newTab: true,
      });
      return {
        text: a.state.root.text,
        gap: a.state.branchGapX,
        vertical: a.state.compactness,
        profile: a.state.typographyPreset,
      };
    });
    expect(r).toEqual({
      text: "Progetto salvato",
      gap: 90,
      vertical: 130,
      profile: "pyramid",
    });
  });
for (const platform of ["desktop", "android"])
  test(`${platform}: legacy defaults migrate without applying them to existing maps`, async ({
    page,
  }) => {
    await open(page, platform);
    await page.evaluate(() => {
      const a = neuroMapApp;
      a.state.branchGapX = 180;
      a.state.typographyPreset = "compact";
      a.persistWorkspace();
      localStorage.removeItem("neuromap.format.defaults.v1");
      localStorage.setItem("neuromap.default.branchGapX.v6.11", "75");
      localStorage.setItem("neuromap.typography.default.v6", "pyramid");
    });
    await page.reload();
    await page.waitForFunction(() => window.neuroMapApp?.nmSettings);
    const r = await page.evaluate(() => {
      const a = neuroMapApp,
        next = a.newState("Nuova");
      return {
        oldGap: a.state.branchGapX,
        oldProfile: a.state.typographyPreset,
        newGap: next.branchGapX,
        newProfile: next.typographyPreset,
      };
    });
    expect(r).toEqual({
      oldGap: 180,
      oldProfile: "compact",
      newGap: 75,
      newProfile: "pyramid",
    });
  });
test("Android legacy projects without spacing retain their original layout rather than new-map defaults", async ({
  page,
}) => {
  await open(page, "android");
  const r = await page.evaluate(async () => {
    const a = neuroMapApp;
    localStorage.setItem(
      "neuromap.format.defaults.v1",
      JSON.stringify({
        gap: { branchGapX: 50 },
        vertical: { compactness: 55 },
      }),
    );
    const payload = {
      root: a.state.constructor.cloneTree(a.state.root),
      typographyPreset: "uniform",
      thresholdY: 50,
    };
    await a.importFile(new File([JSON.stringify(payload)], "legacy.neuromap"), {
      newTab: true,
    });
    return { gap: a.state.branchGapX, vertical: a.state.compactness };
  });
  expect(r).toEqual({ gap: 150, vertical: 100 });
});
for (const platform of ["desktop", "android"]) {
  test(`${platform}: panel keyboard preserves Undo/Redo and Tab never inserts a node`, async ({
    page,
  }) => {
    await open(page, platform);
    await page.evaluate(() =>
      document
        .getElementById("inspector-sidebar")
        .classList.remove("collapsed"),
    );
    await page
      .locator("#inspector-sidebar details")
      .evaluateAll((es) => es.forEach((e) => (e.open = true)));
    const range = page.locator("#glauka-font-size");
    await range.focus();
    const before = await page.evaluate(() => ({
      count: neuroMapApp.state.getAllNodes().length,
      font: neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId)
        .fontSize,
    }));
    await range.fill("47.5");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () =>
          neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).fontSize,
      ),
    ).toBe(48);
    await page.keyboard.press("Control+z");
    expect(
      await page.evaluate(
        () =>
          neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).fontSize,
      ),
    ).toBe(before.font);
    await page.keyboard.press("Control+Shift+z");
    expect(
      await page.evaluate(
        () =>
          neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).fontSize,
      ),
    ).toBe(48);
    await page.locator("#btn-weight-bold").focus();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => neuroMapApp.state.getAllNodes().length),
    ).toBe(before.count);
    expect(await page.evaluate(() => neuroMapApp.editorNodeId)).toBeFalsy();
  });
  test(`${platform}: sticky scope remains below the header and saved values are reviewable`, async ({
    page,
  }) => {
    await open(page, platform);
    if(platform==='android'){
      await page.locator('#glauka-options-open').click();await page.locator('#glauka-app-sheet').getByRole('button',{name:'Disposizione dei rami',exact:true}).click();
      const head=page.locator('#glauka-app-sheet header'),bounds=await head.boundingBox();
      await page.locator('#glauka-sheet-content').evaluate(e=>e.scrollTop=e.scrollHeight);expect(await head.boundingBox()).toEqual(bounds);await expect(page.locator('#glauka-sheet-close')).toBeVisible();
      await page.locator('#nm-settings-defaults-layout').click();
      await expect(page.locator('#nm-settings-defaults input[data-setting=gap]').locator('..').locator('.nm-default-value')).not.toBeEmpty();
      await page.locator('#nm-settings-defaults-close').click();await page.locator('#glauka-sheet-close').click();
      await page.locator('#glauka-style-open').click();await page.locator('#inspector-sidebar .glauka-scope-options > summary').click();await expect(page.locator('#nm-settings-style')).toBeVisible();
      await expect.poll(()=>page.locator('#inspector-sidebar').evaluate(e=>e.getAnimations().length)).toBe(0);
      expect(await page.locator('#inspector-sidebar #nm-settings-style').count()).toBe(1);return;
    }
    await page.evaluate(() => {
      document.getElementById("v6-show-layout").click();
      const host = document.querySelector(".hud-bottom-left");
      host.scrollTop = host.scrollHeight;
    });
    await expect
      .poll(() =>
        page
          .locator("#nm-settings-layout")
          .evaluate((e) =>
            Math.round(
              e.getBoundingClientRect().top -
                e.parentElement
                  .querySelector(".hud-header")
                  .getBoundingClientRect().bottom,
            ),
          ),
      )
      .toBeGreaterThanOrEqual(0);
    await page.locator("#nm-settings-defaults-layout").click();
    await expect(
      page
        .locator("#nm-settings-defaults input[data-setting=gap]")
        .locator("..")
        .locator(".nm-default-value"),
    ).not.toBeEmpty();
    await page.locator("#nm-settings-defaults-close").click();
    await page.screenshot({
      path: `/workspace/central-${platform}-layout-final.png`,
    });
    await page.evaluate(() => {
      document.querySelector(".hud-bottom-left").classList.add("hidden");
      document
        .getElementById("inspector-sidebar")
        .classList.remove("collapsed");
    });
    await expect
      .poll(() =>
        page
          .locator("#inspector-sidebar")
          .evaluate((e) => e.getAnimations().length),
      )
      .toBe(0);
    await expect(
      page.locator(
        "#inspector-sidebar .inspector-header + #nm-settings-style",
      ),
    ).toHaveCount(1);
    await page.screenshot({
      path: `/workspace/central-${platform}-style-final.png`,
    });
  });
}
