const { test, expect } = require("@playwright/test");
for (const platform of ["desktop", "android"])
  test.describe(platform + " creative tools", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(
        () => window.neuroMapApp && window.NeuroMapCreative,
      );
      await page.evaluate(async () => { await GlaukaI18n.setLanguage("it"); });
      await page.evaluate(() =>
        document
          .querySelectorAll(".nm6-shade")
          .forEach((el) => el.classList.add("hidden")),
      );
    });
    test("URL recognition preserves full query, opens via the node and keeps unsafe text inert", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp,
          url =
            "https://www.google.com/search?client=opera&q=google&sourceid=opera&ie=UTF-8&oe=UTF-8";
        a.state.root.text = url;
        a.markChanged();
        a.fitToScreen();
        const seen = [];
        window.open = (...args) => seen.push(args);
        const m = a.layout.getLayout(a.state.root.id),
          p = a.renderer.worldToScreen(m.x, m.y);
        a.canvas.dispatchEvent(
          new MouseEvent("click", {
            clientX: p.x,
            clientY: p.y,
            ctrlKey: true,
            bubbles: true,
          }),
        );
        const good = NeuroMapCreative.nodeURL(a.state.root);
        a.state.root.text = "javascript:alert(1)";
        a.markChanged();
        return {
          seen,
          good,
          url,
          bad: NeuroMapCreative.nodeURL(a.state.root),
          box: !!document.getElementById("nm-node-link-controls"),
        };
      });
      expect(result.good).toBe(result.url);
      expect(result.seen[0]).toEqual([
        result.url,
        "_blank",
        "noopener,noreferrer",
      ]);
      expect(result.bad).toBe("");
      expect(result.box).toBe(false);
    });
    test("offline formula preview, insertion, editing, undo and project round trip retain LaTeX", async ({
      page,
    }) => {
      await page.evaluate(() =>
        document.getElementById("nm-insert-formula").click(),
      );
      await page
        .locator("#nm-formula-source")
        .fill(String.raw`\int_0^1 x^2\,dx=\frac{1}{3}`);
      await expect(page.locator("#nm-formula-insert")).toBeEnabled();
      await expect(page.locator("#nm-formula-preview svg")).toHaveCount(1);
      await page.locator("#nm-formula-insert").click();
      expect(
        await page.evaluate(() => neuroMapApp.state.images.at(-1).graphic.tex),
      ).toBe(String.raw`\int_0^1 x^2\,dx=\frac{1}{3}`);
      await page.evaluate(() => {
        const a = neuroMapApp;
        NeuroMapCreative.formulaDialog(a, a.state.images.at(-1));
      });
      await page
        .locator("#nm-formula-source")
        .fill(String.raw`\alpha+\beta=\gamma`);
      await expect(page.locator("#nm-formula-insert")).toBeEnabled();
      await page.locator("#nm-formula-insert").click();
      const result = await page.evaluate(async () => {
        const a = neuroMapApp,
          current = a.state.createSnapshot().images[0].graphic.tex;
        a.state.undo();
        const undone = a.state.images[0].graphic.tex;
        a.state.redo();
        const payload = {
          root: a.state.constructor.cloneTree(a.state.root),
          images: a.state.constructor.cloneImages(a.state.images),
        };
        await a.importFile(
          new File([JSON.stringify(payload)], "formula.neuromap"),
          { newTab: true },
        );
        return {
          current,
          undone,
          restored: a.state.images[0].graphic.tex,
          source: a.state.images[0].src,
        };
      });
      expect(result.current).toBe(String.raw`\alpha+\beta=\gamma`);
      expect(result.undone).toContain("\int");
      expect(result.restored).toBe(result.current);
      expect(result.source).toContain("data:image/svg+xml");
    });
    test("formula syntax errors do not silently insert a broken object or fetch remote scripts", async ({
      page,
    }) => {
      const external = [];
      page.on("request", (r) => {
        if (
          r.resourceType() === "script" &&
          !r.url().startsWith("http://127.0.0.1")
        )
          external.push(r.url());
      });
      await page.evaluate(() =>
        document.getElementById("nm-insert-formula").click(),
      );
      await page.locator("#nm-formula-source").fill(String.raw`\frac{`);
      await expect(page.locator("#nm-formula-insert")).toBeDisabled();
      await page
        .locator("#nm-formula-source")
        .fill(String.raw`\href{https://example.org}{x}`);
      await expect(
        page.locator("#nm-formula-dialog [role=status]"),
      ).not.toBeEmpty();
      await expect(page.locator("#nm-formula-insert")).toBeDisabled();
      expect(external).toEqual([]);
      expect(await page.evaluate(() => neuroMapApp.state.images.length)).toBe(
        0,
      );
    });
    test("Greek symbols are text and participate in undo", async ({ page }) => {
      await page.evaluate(() => {
        neuroMapApp.state.root.text = "Formula ";
        document.getElementById("nm-insert-symbols").click();
      });
      await page
        .locator("#nm-creative-library-hub")
        .getByRole("button", { name: "α", exact: true })
        .click();
      expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
        "Formula α",
      );
      await page.evaluate(() => neuroMapApp.state.undo());
      expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
        "Formula ",
      );
    });
    test("drawing a shape directly on the map creates an editable object; cancellation creates nothing", async ({
      page,
    }) => {
      await page.evaluate(() =>
        document.getElementById("nm-drawing-open").click(),
      );
      await page.locator("#glauka-shapes-trigger").click();
      await page.locator("#nm-draw-ellipse").click();
      await page.locator("#nm-draw-text-input").fill("Cellula");
      await page.mouse.move(360, 580);
      await page.mouse.down();
      await page.mouse.move(590, 710, { steps: 6 });
      await page.mouse.up();
      expect(
        await page.evaluate(() => neuroMapApp.state.images.at(-1)?.graphic),
      ).toMatchObject({ kind: "shape", tool: "ellipse", text: "Cellula" });
      const before = await page.evaluate(() => neuroMapApp.state.images.length);
      await page.mouse.move(620, 620);
      await page.mouse.down();
      await page.mouse.move(700, 690);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      expect(await page.evaluate(() => neuroMapApp.state.images.length)).toBe(
        before,
      );
      await page.evaluate(() => {
        const a = neuroMapApp;
        NeuroMapCreative.formulaDialog(a);
      });
      await page.locator("#nm-formula-dialog-close").click();
    });
    test("drawings group, resize, ungroup, undo and persist without duplicating logical nodes", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp,
          core = NeuroMapCreativeCore;
        document.getElementById("nm-drawing-open").click();
        const nodes = a.state.getAllNodes().length;
        for (let i = 0; i < 2; i++) {
          const g = core.graphic({
            kind: "shape",
            tool: i ? "ellipse" : "rect",
            width: 140,
            height: 90,
            text: "Test " + i,
            color: "#38bdf8",
          });
          const im = NeuroMapCreative.addGraphic(
            a,
            core.shapeSVG(g),
            140,
            90,
            g,
            { x: 200 + i * 160, y: 200 },
          );
          a._nmDraw.selected.add(im.id);
        }
        NeuroMapCreative.group(a);
        const grouped = a.state.images[0],
          meta = grouped.graphic,
          memberCount = meta.members.length;
        grouped.width *= 2;
        grouped.height *= 2;
        const root = JSON.stringify(
          a.state.constructor.cloneTree(a.state.root),
        );
        NeuroMapCreative.ungroup(a);
        const sizes = a.state.images.map((im) => [im.width, im.height]);
        a.state.undo();
        return {
          memberCount,
          sizes,
          undo: a.state.images.length,
          saved: a.state.createSnapshot().images[0].graphic.kind,
          same:
            root ===
            JSON.stringify(a.state.constructor.cloneTree(a.state.root)),
          nodes: a.state.getAllNodes().length,
          originalNodes: nodes,
        };
      });
      expect(result).toMatchObject({
        memberCount: 2,
        sizes: [
          [280, 180],
          [280, 180],
        ],
        undo: 1,
        saved: "group",
        same: true,
      });
      expect(result.nodes).toBe(result.originalNodes);
    });
    test("personal library survives reload and inserts a separate editable copy", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const a = neuroMapApp,
          g = NeuroMapCreativeCore.graphic({
            kind: "shape",
            tool: "ellipse",
            text: "Saved cell",
            width: 160,
            height: 100,
          });
        NeuroMapCreative.addGraphic(
          a,
          NeuroMapCreativeCore.shapeSVG(g),
          160,
          100,
          g,
        );
        NeuroMapCreative.library(a);
      });
      await page.locator("#nm-library-name").fill("Cellula salvata");
      await page.locator("#nm-library-save").click();
      await page.locator("#nm-library-dialog-close").click();
      await page.reload();
      await page.waitForFunction(
        () => window.neuroMapApp && window.NeuroMapCreative,
      );
      await page.evaluate(() => {
        document
          .querySelectorAll(".nm6-shade")
          .forEach((el) => el.classList.add("hidden"));
        neuroMapApp.createNewTab("Empty");
        NeuroMapCreative.library(neuroMapApp);
      });
      await expect(page.locator(".nm-library-grid")).toContainText(
        "Cellula salvata",
      );
      await page
        .locator(".nm-library-grid")
        .getByRole("button", { name: "Inserisci", exact: true })
        .click();
      expect(
        await page.evaluate(() => neuroMapApp.state.images[0].graphic.text),
      ).toBe("Saved cell");
    });
    test("boundary title controls appear only on a boundary and the wide border is selectable", async ({
      page,
    }) => {
      const point = await page.evaluate(() => {
        const a = neuroMapApp;
        a.importHierarchy(
          {
            text: "Root",
            children: [
              {
                text: "Boundary",
                children: [{ text: "Inside", children: [] }],
              },
            ],
          },
          { newTab: true },
        );
        const node = a.state.root.children[0];
        node.boundary = { enabled: true, title: "Anatomia" };
        a.selectNode(a.state.root.id);
        a.markChanged();
        a.fitToScreen();
        const b = a.layout.getSubtreeBoundingBox(node, false);
        return a.renderer.worldToScreen(b.minX - 20, b.minY - 14);
      });
      await expect(page.locator("#nm-boundary-controls")).toBeHidden();
      await page.mouse.click(point.x, point.y);
      await expect(page.locator("#inspector-sidebar")).toHaveAttribute("data-nm-selection", "boundary");
      if (platform === "android") await page.locator("#glauka-style-open").click();
      await expect(page.locator("#nm-boundary-controls")).toBeVisible();
      await page.locator("#nm-boundary-edit").click();
      await page.locator("#nm-boundary-title-input").fill("Istologia");
      await page.locator("#nm-boundary-title-input").press("Enter");
      expect(
        await page.evaluate(
          () => neuroMapApp.state.root.children[0].boundary.title,
        ),
      ).toBe("Istologia");
      if (platform === "desktop") await expect(page.locator("#nm615-style-tools")).toBeVisible();
      else await expect(page.locator("#nm615-style-tools")).toHaveCount(0);
    });
    test("layout modes are undoable, one-sided and column reading order survives reload", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp;
        a.importHierarchy(
          {
            text: "Root",
            children: Array.from({ length: 8 }, (_, i) => ({
              text: "Branch " + i,
              children: [],
            })),
          },
          { newTab: true },
        );
        document.getElementById("nm-mode-right").click();
        const right = a.state.root.children.every((n) => n.side === "right");
        a.state.undo();
        a.recalculateAndRender();
        const undo = a.state.root.layoutMode;
        document.getElementById("nm-mode-columns").click();
        const left = a.state.root.children
          .filter((n) => n.side === "left")
          .map((n) => a.layout.getLayout(n.id).y);
        a.persistWorkspace();
        return {
          right,
          undo,
          left,
          mode: a.state.createSnapshot().root.layoutMode,
        };
      });
      expect(result.right).toBe(true);
      expect(result.undo).not.toBe("right");
      expect(result.mode).toBe("columns");
      expect(result.left).toEqual([...result.left].sort((a, b) => a - b));
      await page.reload();
      await page.waitForFunction(() => window.neuroMapApp);
      expect(await page.evaluate(() => neuroMapApp.state.root.layoutMode)).toBe(
        "columns",
      );
    });
    test("new controls translate both ways without modifying user labels", async ({
      page,
    }) => {
      await page.evaluate(async () => {
        neuroMapApp.state.root.text = "Testo utente";
        await GlaukaI18n.setLanguage("en");
      });
      await expect(page.locator("#nm-insert-symbols")).toHaveText("Creative library");
      await expect(page.locator("#nm-mode-columns")).toContainText("Columns");
      await page.evaluate(async () => {
        await GlaukaI18n.setLanguage("it");
      });
      await expect(page.locator("#nm-mode-columns")).toContainText("A colonne");
      expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
        "Testo utente",
      );
    });
  });
test("circular mode starts with the current map, enforces its floor and does not fragment it", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.NeuroMapCreative && window.neuroMapApp,
  );
  const result = await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Root",
        children: Array.from({ length: 10 }, (_, i) => ({
          text: "Branch " + i,
          children: Array.from({ length: 5 }, (_, j) => ({
            text: "Child " + j,
            children: [],
          })),
        })),
      },
      { newTab: true },
    );
    const before = a.state.root.children.map((n) => [
      n.id,
      n.side,
      a.layout.getLayout(n.id).y,
    ]);
    document.getElementById("nm-mode-clockwise").click();
    const after = a.state.root.children.map((n) => [
      n.id,
      n.side,
      a.layout.getLayout(n.id).y,
    ]);
    const slider = document.getElementById("nm-distribution-height");
    slider.value = "0";
    slider.dispatchEvent(new Event("input"));
    return {
      before,
      after,
      pages: a.layout.continuationPlan.pages.length,
      config: a.state.root.layoutDistribution,
      min: Number(slider.min),
    };
  });
  expect(result.after).toEqual(result.before);
  expect(result.pages).toBeLessThanOrEqual(2);
  expect(result.config.height).toBeGreaterThanOrEqual(result.min);
  expect(result.min).toBeGreaterThanOrEqual(480);
});
for (const platform of ["desktop", "android"])
  test(
    platform + " exports transparent formulas and groups with visible pixels",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(
        () => window.NeuroMapCreative && window.neuroMapApp,
      );
      const result = await page.evaluate(async () => {
        const a = neuroMapApp,
          c = NeuroMapCreativeCore;
        a.state.images = [];
        document.getElementById("nm-drawing-open").click();
        for (let i = 0; i < 2; i++) {
          const meta = c.graphic({
            kind: "shape",
            tool: "rect",
            color: "#38bdf8",
            width: 140,
            height: 90,
            text: "C" + i,
          });
          const image = NeuroMapCreative.addGraphic(
            a,
            c.shapeSVG(meta),
            140,
            90,
            meta,
            { x: 180 + i * 160, y: 180 },
          );
          a._nmDraw.selected.add(image.id);
        }
        NeuroMapCreative.group(a);
        await a.renderer.prepareExportImages();
        a.state.selectedImageId = null;
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 400;
        const old = a.renderer.ctx;
        a.renderer.ctx = canvas.getContext("2d");
        try {
          a.renderer.drawImagesLayer("front");
        } finally {
          a.renderer.ctx = old;
        }
        const pixels = canvas
          .getContext("2d")
          .getImageData(0, 0, 600, 400).data;
        let colored = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) colored++;
        const corner = canvas.getContext("2d").getImageData(111, 136, 1, 1)
          .data[3];
        let blob;
        const download = a.io.triggerDownload;
        a.io.triggerDownload = (b) => (blob = b);
        try {
          await a.io.exportSVG();
        } finally {
          a.io.triggerDownload = download;
        }
        return {
          colored,
          corner,
          svg: await blob.text(),
          kind: a.state.images[0].graphic.kind,
        };
      });
      expect(result.colored).toBeGreaterThan(500);
      expect(result.corner).toBe(0);
      expect(result.kind).toBe("group");
      expect(result.svg).toContain("data:image/svg+xml");
    },
  );

test("changing distribution preserves manual-offset data and Undo restores the previous geometry", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.NeuroMapCreative && window.neuroMapApp,
  );
  const result = await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Root",
        children: Array.from({ length: 4 }, (_, i) => ({
          text: "Branch " + i,
          children: [{ text: "Child", children: [] }],
        })),
      },
      { newTab: true },
    );
    a.state.root.children[0].manualOffset = { dx: 60, dy: -22 };
    a.state.root.children[2].children[0].manualOffset = { dx: -35, dy: 20 };
    a.recalculateAndRender();
    const points = () =>
      a.state.getAllNodes().map((n) => {
        const m = a.layout.getLayout(n.id);
        return [n.id, n.side, m.x, m.y];
      });
    const before = points();
    const offsets = () =>
      a.state.getAllNodes().map((n) => [n.id, n.manualOffset || null]);
    const originalOffsets = offsets();
    document.getElementById("nm-mode-clockwise").click();
    const after = points(),
      retainedOffsets = offsets(),
      sectors = a.layout.continuationPlan.pages.length;
    a.undo();
    return {
      before,
      after,
      originalOffsets,
      retainedOffsets,
      sectors,
      restored: points(),
    };
  });
  expect(result.retainedOffsets).toEqual(result.originalOffsets);
  expect(
    result.after.every((p) => Number.isFinite(p[2]) && Number.isFinite(p[3])),
  ).toBe(true);
  expect(result.sectors).toBeLessThanOrEqual(2);
  expect(result.restored).toEqual(result.before);
});
for (const platform of ["desktop", "android"])
  test(
    platform + " dialogs isolate keyboard shortcuts from the map",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(
        () => window.NeuroMapCreative && window.neuroMapApp,
      );
      await page.evaluate(() => {
        document
          .querySelectorAll(".nm6-shade")
          .forEach((el) => el.classList.add("hidden"));
        NeuroMapCreative.symbolsDialog(neuroMapApp);
      });
      const before = await page.evaluate(() =>
        neuroMapApp.state.getAllNodes().map((n) => n.id),
      );
      await page.locator("#nm-symbols-dialog [role=dialog]").focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Delete");
      await page.keyboard.press("Enter");
      expect(
        await page.evaluate(() =>
          neuroMapApp.state.getAllNodes().map((n) => n.id),
        ),
      ).toEqual(before);
    },
  );

test("activating circular mode retains interleaved manual side pins in one map", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.NeuroMapCreative && window.neuroMapApp,
  );
  const result = await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Root",
        children: Array.from({ length: 6 }, (_, i) => ({
          text: "Branch " + i,
          sidePinned: i % 2 ? "right" : "left",
          children: [],
        })),
      },
      { newTab: true },
    );
    const points = () =>
      a.state.root.children.map((n) => {
        const m = a.layout.getLayout(n.id);
        return [n.id, n.side, m.x, m.y];
      });
    const before = points();
    document.getElementById("nm-mode-clockwise").click();
    return {
      before,
      after: points(),
      pages: a.layout.continuationPlan.pages.length,
      groups: a.layout.continuationGroups.length,
    };
  });
  expect(result.after).toEqual(result.before);
  expect(result.pages).toBe(2);
  expect(result.groups).toBe(1);
});

for (const platform of ["desktop", "android"])
  test(
    platform +
      " avoids repeated creative control writes and invalidates changed labels",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(
        () => window.neuroMapApp && window.NeuroMapCreative,
      );
      const result = await page.evaluate(() => {
        const a = neuroMapApp;
        a.updateStatus();
        let writes = 0;
        for (const button of document.querySelectorAll(
          "#nm-layout-modes button",
        )) {
          const original = button.setAttribute;
          button.setAttribute = function (...args) {
            writes++;
            return original.apply(this, args);
          };
        }
        for (let i = 0; i < 30; i++) a.updateStatus();
        const unchangedWrites = writes;
        a.state.root.text = "https://example.org/new";
        a.markChanged();
        const shown = !document.getElementById("nm-ctx-link-open").hidden;
        a.state.root.text = "A normal label";
        a.markChanged();
        const hidden = document.getElementById("nm-ctx-link-open").hidden;
        return { unchangedWrites, changedWrites: writes, shown, hidden };
      });
      expect(result.unchangedWrites).toBe(0);
      expect(result.changedWrites).toBeGreaterThan(0);
      expect(result.shown).toBe(true);
      expect(result.hidden).toBe(true);
    },
  );
