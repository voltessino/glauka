const { test, expect } = require("@playwright/test");
for (const platform of ["desktop", "android"])
  test.describe(platform + " visual refinements", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(
        () => window.neuroMapApp && window.NeuroMapCreativeModules.inspector,
      );
      await page.evaluate(() => {
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        const a = neuroMapApp;
        a.importHierarchy(
          {
            text: "Cute o pelle",
            children: Array.from({ length: 8 }, (_, i) => ({
              text: "Classificazione " + i,
              children: [
                {
                  text: "Spessore",
                  children: [
                    { text: "70–120 μm", children: [] },
                    { text: "0.8 mm", children: [] },
                    { text: "1.4 mm", children: [] },
                  ],
                },
              ],
            })),
          },
          { newTab: true },
        );
        a.fitWholeMap();
      });
    });
    for (const side of ["right", "left"])
      test(
        "switches directly from " +
          side +
          " to clockwise and undo restores the direction",
        async ({ page }) => {
          const result = await page.evaluate((side) => {
            const a = neuroMapApp;
            document.getElementById("nm-mode-" + side).click();
            const direction = a.state.root.children.every(
              (n) => n.side === side,
            );
            document.getElementById("nm-mode-clockwise").click();
            const config = a.state.root.layoutDistribution;
            const sides = [
              ...new Set(a.layout.continuationPlan.pages.map((p) => p.side)),
            ];
            const order = a.state.root.children.map((n) => n.text);
            a.state.undo();
            a.recalculateAndRender();
            a.updateStatus();
            return {
              direction,
              sides,
              enabled: config.enabled,
              undo: a.state.root.layoutMode,
              restored: a.state.root.children.every((n) => n.side === side),
              order,
            };
          }, side);
          expect(result.direction).toBe(true);
          expect(result.enabled).toBe(true);
          expect(result.sides.sort()).toEqual(["left", "right"]);
          expect(result.undo).toBe(side);
          expect(result.restored).toBe(true);
        },
      );
    test("one-sided presets retain deliberate opposite-side pins without rewriting them", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp;
        a.state.root.children.forEach((n) => (n.sidePinned = "left"));
        document.getElementById("nm-mode-right").click();
        return a.state.root.children.map((n) => ({
          side: n.side,
          pin: n.sidePinned,
        }));
      });
      expect(result.every((n) => n.side === "left" && n.pin === "left")).toBe(
        true,
      );
    });
    test("manual offsets and enlarged labels cannot overlap siblings or turn a connector backwards", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp;
        document.getElementById("nm-mode-right").click();
        const parent = a.state.root.children[0],
          children = parent.children[0].children;
        children[1].manualOffset = { dx: -1200, dy: -160 };
        children[1].fontSize = 48;
        children[1].text = "epitelio pavimentoso pluristratificato";
        a.state.strokeScale = 3;
        a.state.compactness = 55;
        a.markChanged();
        const all = a.state.getAllNodes(),
          overlaps = [],
          backwards = [];
        for (let i = 0; i < all.length; i++) {
          const n = all[i],
            m = a.layout.getLayout(n.id);
          if (!m) continue;
          if (n.parentId) {
            const p = a.layout.getLayout(n.parentId);
            if (
              n.side === "right" &&
              m.x - m.width / 2 < p.x + p.width / 2 + 19
            )
              backwards.push(n.text);
          }
          for (let j = i + 1; j < all.length; j++) {
            const b = a.layout.getLayout(all[j].id);
            if (
              b &&
              Math.abs(m.x - b.x) < (m.width + b.width) / 2 - 0.1 &&
              Math.abs(m.y - b.y) < (m.height + b.height) / 2 - 0.1
            )
              overlaps.push([n.text, all[j].text]);
          }
        }
        return { overlaps, backwards };
      });
      expect(result.overlaps).toEqual([]);
      expect(result.backwards).toEqual([]);
    });
    test("bold and italic share a compact toggle group, preserving independent formatting", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp;
        a.selectNode(a.state.root.children[0].id);
        document.getElementById("btn-weight-bold").click();
        document.getElementById("nm70-italic").click();
        const n = a.state.findNode(a.state.selectedNodeId),
          first = { bold: n.fontWeight, italic: n.fontItalic };
        document.getElementById("btn-weight-bold").click();
        return {
          first,
          last: { bold: n.fontWeight, italic: n.fontItalic },
          same:
            document.getElementById("btn-weight-bold").parentElement ===
            document.getElementById("nm70-italic").parentElement,
        };
      });
      expect(result).toEqual({
        first: { bold: 700, italic: true },
        last: { bold: 400, italic: true },
        same: true,
      });
      await expect(page.locator("#btn-weight-normal")).toBeHidden();
    });
    test("boundary hover highlights the perimeter and double click edits its title inline", async ({
      page,
    }) => {
      const point = await page.evaluate(() => {
        const a = neuroMapApp,
          n = a.state.root.children[0];
        n.boundary = { enabled: true, title: "Istologia", color: "#10b981" };
        a.markChanged();
        a.fitWholeMap();
        const b = a.layout.getSubtreeBoundingBox(n, false);
        return a.renderer.worldToScreen(b.minX - 16, (b.minY + b.maxY) / 2);
      });
      await page.mouse.move(point.x, point.y);
      expect(
        await page.evaluate(() => neuroMapApp.renderer.hoveredBoundaryId),
      ).toBeTruthy();
      await page.mouse.dblclick(point.x, point.y);
      await expect(page.locator("#nm-boundary-title-input")).toBeVisible();
      await expect(page.locator(".nm-creative-shade")).toHaveCount(0);
      await page.locator("#nm-boundary-title-input").fill("Anatomia");
      await page.locator("#nm-boundary-title-input").press("Enter");
      expect(
        await page.evaluate(
          () => neuroMapApp.state.root.children[0].boundary.title,
        ),
      ).toBe("Anatomia");
      await expect(page.locator("#inspector-sidebar")).toHaveAttribute(
        "data-nm-selection",
        "boundary",
      );
      await expect(
        page.locator(
          platform === "desktop"
            ? "#glauka-font-size"
            : "#glauka-font-size",
        ),
      ).toBeHidden();
      if (platform === "android") await page.locator("#glauka-style-open").click();
      await expect(page.locator("#nm-boundary-color")).toBeVisible();
      await page.evaluate(() =>
        document.getElementById("nm-boundary-edit").click(),
      );
      await page.locator("#nm-boundary-title-input").fill("Non salvare");
      await page.locator("#nm-boundary-title-input").press("Escape");
      expect(
        await page.evaluate(
          () => neuroMapApp.state.root.children[0].boundary.title,
        ),
      ).toBe("Anatomia");
      await page.evaluate(() => {
        const a = neuroMapApp;
        a.state.undo();
        a.recalculateAndRender();
        a.updateStatus();
      });
      expect(
        await page.evaluate(
          () => neuroMapApp.state.root.children[0].boundary.title,
        ),
      ).toBe("Istologia");
    });
    test("relationship selection exposes only its own formatting and switching back restores node tools", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const a = neuroMapApp,
          [x, y] = a.state.root.children;
        const rel = a.state.addRelationship(x.id, y.id, "Relazione");
        a.v5SelectRelation(rel.id);
      });
      await expect(page.locator("#v5-rel-label")).toBeVisible();
      await expect(
        page.locator(
          platform === "desktop"
            ? "#glauka-font-size"
            : "#glauka-font-size",
        ),
      ).toBeHidden();
      await expect(page.locator("#nm-boundary-controls")).toBeHidden();
      await page.locator("#v5-rel-label").fill("Collegamento");
      await page.locator("#v5-rel-label").dispatchEvent("change");
      expect(
        await page.evaluate(() => neuroMapApp.state.relationships[0].label),
      ).toBe("Collegamento");
      await page.evaluate(() =>
        neuroMapApp.selectNode(neuroMapApp.state.root.children[0].id),
      );
      await expect(
        page.locator(
          platform === "desktop"
            ? "#glauka-font-size"
            : "#glauka-font-size",
        ),
      ).toBeVisible();
      await expect(page.locator("#v5-relation-panel")).toBeHidden();
    });
    test("drawing tools stay beside the canvas and numeric distribution diagnostics are hidden", async ({
      page,
    }) => {
      await page.evaluate(() =>
        document.getElementById("nm-drawing-open").click(),
      );
      const box = await page.locator("#nm-drawing-toolbar").boundingBox();
      expect(box.width).toBeLessThan(300);
      expect(box.x).toBeGreaterThan(1000);
      await expect(page.locator("#nm-draw-text-input")).toBeHidden();
      await page.locator("#glauka-shapes-trigger").click();
      await page.locator("#nm-draw-rect").click();
      await expect(page.locator("#nm-draw-text-input")).toBeVisible();
      await expect(page.locator("#val-hr")).toBeHidden();
      await expect(page.locator("#val-hl")).toBeHidden();
      await page.locator("#nm-draw-close").click();
      await expect(page.locator("#nm-drawing-toolbar")).toBeHidden();
    });
    test("organic canvas and SVG use the same normal-offset outline at every branch style", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const a = neuroMapApp,
          n = a.state.root.children[0],
          styles = ["neon", "buzan", "thickparents"];
        return styles.map((style) => {
          a.state.branchStyle = style;
          a.state.strokeScale = 3;
          a.markChanged();
          const g = a.renderer.computeBranchGeometry(a.state.root, n, 0, 8),
            d = NeuroMapGraphics.ribbonPath(g);
          const p = new Path2D(d);
          return {
            style,
            valid: !/[Nn]a[Nn]|Infinity/.test(d),
            cap: g.endWidth,
            horizontal: g.cp1y === g.startY && g.cp2y === g.endY,
          };
        });
      });
      expect(result.every((r) => r.valid && r.cap > 0 && r.horizontal)).toBe(
        true,
      );
    });
  });
for (const platform of ["desktop", "android"])
  test(
    platform +
      " organic underlines keep constant physical thickness across zoom and display density",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(() => window.neuroMapApp);
      const measurements = await page.evaluate(() => {
        const a = neuroMapApp;
        a.importHierarchy(
          {
            text: "Root",
            children: [{ text: "Constant underline", children: [] }],
          },
          { newTab: true },
        );
        const child = a.state.root.children[0],
          result = [];
        for (const style of ["neon", "buzan", "thickparents"])
          for (const stroke of [1, 3]) {
            a.state.branchStyle = style;
            a.state.strokeScale = stroke;
            a.markChanged();
            const g = a.renderer.computeBranchGeometry(
              a.state.root,
              child,
              0,
              1,
            );
            for (const density of [1, 1.25, 1.5, 2])
              for (const zoom of [0.5, 1, 2]) {
                const scale = density * zoom,
                  c = document.createElement("canvas");
                c.width = 1600 * scale;
                c.height = 400 * scale;
                const ctx = c.getContext("2d");
                ctx.scale(scale, scale);
                ctx.translate(100, 100);
                const previous = a.renderer.ctx;
                a.renderer.ctx = ctx;
                try {
                  a.renderer.drawTaperingBranch(a.state.root, child, 0, 1);
                } finally {
                  a.renderer.ctx = previous;
                }
                const x = Math.floor(
                    ((g.endX + g.underlineEndX) / 2 + 100) * scale,
                  ),
                  y = Math.round((g.endY + 100) * scale);
                const data = ctx.getImageData(x, y - 100, 1, 201).data;
                let coverage = 0;
                for (let i = 3; i < data.length; i += 4)
                  coverage += data[i] / 255;
                result.push({
                  style,
                  stroke,
                  density,
                  zoom,
                  error: Math.abs(coverage - g.endWidth * scale),
                });
              }
          }
        const g = a.renderer.computeBranchGeometry(a.state.root, child, 0, 1),
          first = NeuroMapGraphics.ribbonShape(g, child),
          second = NeuroMapGraphics.ribbonShape(g, child),
          changed = NeuroMapGraphics.ribbonShape(
            { ...g, endWidth: g.endWidth + 1 },
            child,
          );
        return {
          result,
          cacheHit: first === second,
          invalidated: first !== changed,
        };
      });
      expect(measurements.result.filter((r) => r.error > 0.51)).toEqual([]);
      expect(measurements.cacheHit).toBe(true);
      expect(measurements.invalidated).toBe(true);
    },
  );
for (const platform of ["desktop", "android"])
  test(
    platform +
      " summary braces follow collision adjustments after manual movement",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(() => window.neuroMapApp);
      const result = await page.evaluate(() => {
        const a = neuroMapApp;
        a.importHierarchy(
          {
            text: "Root",
            children: [
              {
                text: "Parent",
                children: [
                  { text: "First", children: [] },
                  { text: "Second", children: [] },
                  { text: "Third", children: [] },
                ],
              },
            ],
          },
          { newTab: true },
        );
        const parent = a.state.root.children[0],
          targets = parent.children.slice(0, 2),
          summary = a.state.addSummaryForNodes(targets.map((n) => n.id));
        targets[1].manualOffset = { dx: 0, dy: -200 };
        a.markChanged();
        const b = a.layout.getTargetNodesSubtreeBounds(
            parent,
            targets.map((n) => n.id),
          ),
          g = a.layout.getLayout(summary.id).bracketGeom;
        return {
          min: g.minY,
          max: g.maxY,
          expectedMin: b.minY + 4,
          expectedMax: b.maxY - 4,
        };
      });
      expect(result.min).toBeCloseTo(result.expectedMin, 6);
      expect(result.max).toBeCloseTo(result.expectedMax, 6);
    },
  );
for (const platform of ["desktop", "android"])
  test(
    platform +
      " images and drawings expose their own controls inside the format sidebar",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(() => window.neuroMapApp);
      await page.evaluate(() => {
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        const a = neuroMapApp,
          src =
            "data:image/svg+xml;charset=utf-8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="red"/></svg>',
            );
        const image = a.state.addImageItem({
          src,
          mode: "free",
          width: 120,
          height: 90,
          worldPos: { x: 400, y: 200 },
        });
        a.selectImage(image.id);
        a.markChanged();
      });
      await expect(page.locator("#inspector-sidebar")).toHaveAttribute(
        "data-nm-selection",
        "image",
      );
      await expect(
        page.locator("#image-controls #img-width-slider"),
      ).toBeVisible();
      await expect(
        page.locator(
          platform === "desktop"
            ? "#glauka-font-size"
            : "#glauka-font-size",
        ),
      ).toBeHidden();
      await page.evaluate(() => {
        const a = neuroMapApp,
          g = NeuroMapCreativeCore.graphic({
            kind: "shape",
            tool: "rect",
            width: 120,
            height: 90,
          });
        NeuroMapCreative.addGraphic(
          a,
          NeuroMapCreativeCore.shapeSVG(g),
          120,
          90,
          g,
          { x: 400, y: 200 },
        );
      });
      await expect(page.locator("#inspector-sidebar")).toHaveAttribute(
        "data-nm-selection",
        "graphic",
      );
      await expect(page.locator("#nm-object-edit")).toBeVisible();
      await expect(page.locator("#img-width-slider")).toBeVisible();
      await expect(
        page.locator(
          platform === "desktop"
            ? "#glauka-font-size"
            : "#glauka-font-size",
        ),
      ).toBeHidden();
    },
  );
for (const platform of ["desktop", "android"])
  test(
    platform +
      " touch boundary title editing keeps the canvas available on small screens",
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await page.goto(
          platform === "desktop"
            ? "http://127.0.0.1:5174/index.html"
            : "http://127.0.0.1:5173/app/index.html",
        );
        await page.waitForFunction(() => window.neuroMapApp);
        const point = await page.evaluate(() => {
          document
            .querySelectorAll(".nm6-shade")
            .forEach((e) => e.classList.add("hidden"));
          document
            .getElementById("inspector-sidebar")
            .classList.add("collapsed");
          const a = neuroMapApp;
          a.importHierarchy(
            { text: "Root", children: [{ text: "Recinto", children: [] }] },
            { newTab: true },
          );
          const n = a.state.root.children[0];
          n.boundary = { enabled: true, title: "Prima" };
          a.markChanged();
          a.fitWholeMap();
          const b = a.layout.getSubtreeBoundingBox(n, false);
          return a.renderer.worldToScreen(b.minX - 16, (b.minY + b.maxY) / 2);
        });
        await page.touchscreen.tap(point.x, point.y);
        await page.touchscreen.tap(point.x, point.y);
        await expect(page.locator("#nm-boundary-title-input")).toBeVisible();
        await expect(page.locator("#inspector-sidebar")).toHaveClass(
          /collapsed/,
        );
        await page.locator("#nm-boundary-title-input").fill("Dopo");
        await page.locator("#nm-boundary-title-input").press("Enter");
        expect(
          await page.evaluate(
            () => neuroMapApp.state.root.children[0].boundary.title,
          ),
        ).toBe("Dopo");
      } finally {
        await context.close();
      }
    },
  );
