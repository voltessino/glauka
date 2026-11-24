const { test, expect } = require("@playwright/test");
async function open(page, target) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    target === "desktop"
      ? (process.env.GLAUKA_DESKTOP_TEST_URL || (process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'))
      : (process.env.GLAUKA_ANDROID_TEST_URL || (process.env.GLAUKA_ANDROID_TEST_URL || 'http://127.0.0.1:5173/app/index.html')),
  );
  await page.waitForFunction(() => window.neuroMapApp?.io);
  await page.evaluate(() =>
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden")),
  );
}
async function seed(
  page,
  { side = "left", zoom = 1, collapsed = false, style = "neon" } = {},
) {
  return page.evaluate(
    ({ side, zoom, collapsed, style }) => {
      const a = window.neuroMapApp;
      a.importHierarchy(
        {
          text: "Epitelio",
          children: [
            {
              text: "Classificazione",
              children: [
                {
                  text: "Forma delle cellule",
                  children: [{ text: "Cubiche", children: [] }],
                },
                { text: "Altro criterio", children: [] },
                {
                  text: "N° strati cellulari",
                  children: [
                    { text: "Semplice", notes: "Nota α", children: [] },
                  ],
                },
              ],
            },
            {
              text: "Altra sezione",
              children: [{ text: "Altra destinazione", children: [] }],
            },
          ],
        },
        { newTab: true },
      );
      const p = a.state.root.children[0],
        [t, other, s] = p.children;
      p.sidePinned = side;
      t.collapsed = collapsed;
      a.state.branchStyle = style;
      a.recalculateAndRender();
      const sm = a.layout.getLayout(s.id),
        tm = a.layout.getLayout(t.id);
      Object.assign(a.renderer.camera, {
        zoom,
        x: 640 - ((sm.x + tm.x) / 2) * zoom,
        y: 450 - ((sm.y + tm.y) / 2) * zoom,
      });
      a.selectNode(s.id);
      // Drag/zoom hit targets must still work after a paint-only settings edit.
      const color=document.getElementById('inspector-color-picker');
      color.value='#12ab34';color.dispatchEvent(new Event('change',{bubbles:true}));
      a.requestRender();
      return {
        source: s.id,
        target: t.id,
        parent: p.id,
        other: other.id,
        descendant: s.children[0].id,
        foreign: a.state.root.children[1].children[0].id,
        root: a.state.root.id,
      };
    },
    { side, zoom, collapsed, style },
  );
}
async function point(page, id, zone = "center") {
  return page.evaluate(
    ({ id, zone }) => {
      const a = window.neuroMapApp,
        m = a.layout.getLayout(id),
        p = a.renderer.worldToScreen(m.x, m.y),
        z = a.renderer.camera.zoom;
      if (zone === "above") p.y -= (m.height * z) / 2 + Math.min(8, 6 * z);
      if (zone === "below") p.y += (m.height * z) / 2 + Math.min(8, 6 * z);
      if (zone === "inside-top") p.y -= m.height * z * 0.45;
      if (zone === "inside-bottom") p.y += m.height * z * 0.45;
      return p;
    },
    { id, zone },
  );
}
async function move(page, ids, zone) {
  const start = await point(page, ids.source),
    end = await point(page, ids.target, zone);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  return end;
}
for (const target of ["desktop", "android"])
  test.describe(`${target} prospective branch drag`, () => {
    test.beforeEach(async ({ page }) => open(page, target));
    for (const side of ["left", "right"])
      for (const zone of [
        "center",
        "inside-top",
        "inside-bottom",
        "above",
        "below",
      ])
        test(`${side} sibling drop ${zone} shows the insertion ghost and commits its prospective layout`, async ({
          page,
        }, info) => {
          const ids = await seed(page, { side }),
            before = await page.evaluate(() =>
              window.neuroMapApp.state.createSnapshot(),
            ),
            history = await page.evaluate(
              () => window.neuroMapApp.state.undoStack.length,
            );
          await move(page, ids, zone);
          const kind = zone === "center" ? "child" : "place";
          await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
            "data-intent",
            kind,
          );
          const preview = await page.evaluate(() => {
            const a = window.neuroMapApp,
              p = a._nmDragPreview,
              m = p.layout.getLayout(p.nodeId),
              ctx = p.canvas.getContext("2d"),
              d = ctx.getImageData(0, 0, p.canvas.width, p.canvas.height).data;
            let alpha = 0;
            for (let i = 3; i < d.length; i += 4) alpha += d[i];
            return {
              x: m.x,
              y: m.y,
              parent: p.state.findNode(p.nodeId).parentId,
              alpha,
            };
          });
          expect(preview.alpha).toBeGreaterThan(0);
          expect(
            await page.evaluate(() =>
              window.neuroMapApp.state.createSnapshot(),
            ),
          ).toEqual(before);
          expect(
            await page.evaluate(
              () => window.neuroMapApp.state.undoStack.length,
            ),
          ).toBe(history);
          if (kind === "place") {
            const display = await page.evaluate(({ source, target }) => {
              const a = window.neuroMapApp,
                m = a._nmDragPreview.displayLayout.getLayout(source),
                t = a.layout.getLayout(target);
              return {
                top: m.y - m.height / 2,
                bottom: m.y + m.height / 2,
                targetTop: t.y - t.height / 2,
                targetBottom: t.y + t.height / 2,
              };
            }, ids);
            if (zone === "above" || zone === "inside-top")
              expect(display.bottom).toBeLessThan(display.targetTop);
            else expect(display.top).toBeGreaterThan(display.targetBottom);
          }
          if (zone === "above" && side === "left")
            await page.screenshot({
              path: info.outputPath(`${target}-ghost-reorder.png`),
            });
          await page.mouse.up();
          await expect(page.locator("#nm-drag-preview")).toHaveCount(0);
          const after = await page.evaluate((id) => {
            const a = window.neuroMapApp,
              m = a.layout.getLayout(id),
              n = a.state.findNode(id);
            return {
              x: m.x,
              y: m.y,
              parent: n.parentId,
              order: a.state.findNode(n.parentId).children.map((n) => n.id),
            };
          }, ids.source);
          expect(after.x).toBeCloseTo(preview.x, 6);
          expect(after.y).toBeCloseTo(preview.y, 6);
          expect(after.parent).toBe(preview.parent);
          if (kind === "child") expect(after.parent).toBe(ids.target);
          else {
            expect(after.parent).toBe(ids.parent);
            expect(after.order).toEqual(
              zone === "above" || zone === "inside-top"
                ? [ids.source, ids.target, ids.other]
                : [ids.target, ids.source, ids.other],
            );
          }
          expect(
            await page.evaluate(
              () => window.neuroMapApp.state.undoStack.length,
            ),
          ).toBe(history + 1);
          await page.evaluate(() => window.neuroMapApp.undo());
          expect(
            await page.evaluate(() =>
              window.neuroMapApp.state.createSnapshot(),
            ),
          ).toEqual(before);
        });
    for (const zoom of [0.5, 2])
      test(`preview and child adoption at zoom ${zoom}`, async ({ page }) => {
        const ids = await seed(page, { zoom });
        await move(page, ids, "center");
        await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
          "data-intent",
          "child",
        );
        await page.mouse.up();
        expect(
          await page.evaluate(
            (id) => window.neuroMapApp.state.findNode(id).parentId,
            ids.source,
          ),
        ).toBe(ids.target);
      });
    test("dropping above a node under a different parent moves to that level in that position", async ({
      page,
    }) => {
      const ids = await seed(page, { zoom: 0.7 });
      ids.target = ids.foreign;
      await page.keyboard.down("Alt");
      await move(page, ids, "inside-top");
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "reorder",
      );
      const parent = await page.evaluate(
        () =>
          window.neuroMapApp._nmDragPreview.state.findNode(
            window.neuroMapApp._nmDragPreview.nodeId,
          ).parentId,
      );
      await page.mouse.up();
      await page.keyboard.up("Alt");
      expect(
        await page.evaluate(
          (id) => window.neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(parent);
    });
    test("a collapsed destination opens in the preview and after the drop", async ({
      page,
    }) => {
      const ids = await seed(page, { collapsed: true });
      await move(page, ids, "center");
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "child",
      );
      expect(
        await page.evaluate(
          (id) =>
            window.neuroMapApp._nmDragPreview.state.findNode(id).collapsed,
          ids.target,
        ),
      ).toBe(false);
      expect(
        await page.evaluate(
          (id) => window.neuroMapApp.state.findNode(id).collapsed,
          ids.target,
        ),
      ).toBe(true);
      await page.mouse.up();
      expect(
        await page.evaluate(
          (id) => window.neuroMapApp.state.findNode(id).collapsed,
          ids.target,
        ),
      ).toBe(false);
    });
    for (const cancel of ["Escape", "pointercancel"])
      test(`${cancel} clears preview and preserves tree, history and capture`, async ({
        page,
      }) => {
        const ids = await seed(page),
          before = await page.evaluate(() =>
            window.neuroMapApp.state.createSnapshot(),
          );
        await move(page, ids, "center");
        await expect(page.locator("#nm-drag-preview")).toBeVisible();
        if (cancel === "Escape") await page.keyboard.press("Escape");
        else
          await page.evaluate(() => {
            const a = window.neuroMapApp;
            a.canvas.dispatchEvent(
              new PointerEvent("pointercancel", {
                pointerId: a._v5Candidate.pointerId,
                bubbles: true,
              }),
            );
          });
        await expect(page.locator("#nm-drag-preview")).toHaveCount(0);
        await page.mouse.up();
        expect(
          await page.evaluate(() => window.neuroMapApp.state.createSnapshot()),
        ).toEqual(before);
        expect(
          await page.evaluate(() => window.neuroMapApp._v5Candidate),
        ).toBeFalsy();
      });
    test("self and descendant cannot produce a preview or a cycle", async ({
      page,
    }) => {
      const ids = await seed(page),
        before = await page.evaluate(() =>
          window.neuroMapApp.state.createSnapshot(),
        );
      ids.target = ids.descendant;
      await move(page, ids, "center");
      await expect(page.locator("#nm-drag-preview")).toHaveCount(0);
      await page.mouse.up();
      expect(
        await page.evaluate(() => window.neuroMapApp.state.createSnapshot()),
      ).toEqual(before);
    });
  });
for (const target of ["desktop", "android"])
  test.describe(`${target} drag preview edge cases`, () => {
    test.beforeEach(async ({ page }) => open(page, target));
    test("root-level left branches reorder by screen position, preserving clockwise storage order", async ({
      page,
    }) => {
      const ids = await seed(page, { side: "left", zoom: 0.7 });
      await page.evaluate(() => {
        const a = window.neuroMapApp;
        a.state.root.children.forEach((n) => (n.sidePinned = "left"));
        a.recalculateAndRender();
        a.fitWholeMap();
      });
      ids.source = await page.evaluate(
        () => window.neuroMapApp.state.root.children[0].id,
      );
      ids.target = await page.evaluate(
        () => window.neuroMapApp.state.root.children[1].id,
      );
      await move(page, ids, "above");
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "place",
      );
      await page.mouse.up();
      const order = await page.evaluate(() => {
        const a = window.neuroMapApp;
        return [...a.state.root.children]
          .sort(
            (x, y) => a.layout.getLayout(x.id).y - a.layout.getLayout(y.id).y,
          )
          .map((n) => n.id);
      });
      expect(order).toEqual([ids.source, ids.target]);
    });
    test("a radial sibling can become a child with a prospective preview", async ({
      page,
    }) => {
      const ids = await seed(page, { style: "radial", zoom: 0.5 });
      await move(page, ids, "center");
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "child",
      );
      await page.mouse.up();
      expect(
        await page.evaluate(
          (id) => window.neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(ids.target);
    });
    test("detaching into empty canvas shows an independent branch and commits that position", async ({
      page,
    }) => {
      const ids = await seed(page, { zoom: 0.55 });
      await page.keyboard.down("Alt");
      const start = await point(page, ids.source);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(90, 780, { steps: 10 });
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "detach",
      );
      const pos = await page.evaluate(() => {
        const p = window.neuroMapApp._nmDragPreview;
        return p.state.findNode(p.nodeId).floatingPosition;
      });
      await page.mouse.up();
      await page.keyboard.up("Alt");
      expect(
        await page.evaluate((id) => {
          const n = window.neuroMapApp.state.findNode(id);
          return { floating: n.isFloating, pos: n.floatingPosition };
        }, ids.source),
      ).toEqual({ floating: true, pos });
    });
    test("attached images, notes and descendant IDs survive adopting a sibling", async ({
      page,
    }) => {
      const ids = await seed(page);
      await page.evaluate((id) => {
        const a = window.neuroMapApp;
        a.state.images = [
          {
            id: "attached",
            mode: "attached",
            attachedNodeId: id,
            width: 70,
            height: 40,
            offset: { dx: 0, dy: -70 },
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
          },
        ];
        a.recalculateAndRender();
      }, ids.source);
      await move(page, ids, "center");
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "child",
      );
      expect(
        await page.evaluate(
          () =>
            window.neuroMapApp._nmDragPreview.state.images[0].attachedNodeId,
        ),
      ).toBe(ids.source);
      await page.mouse.up();
      const result = await page.evaluate((id) => {
        const a = window.neuroMapApp,
          n = a.state.findNode(id);
        return {
          child: n.children[0].id,
          notes: n.children[0].notes,
          image: a.state.images[0].attachedNodeId,
        };
      }, ids.source);
      expect(result).toEqual({
        child: ids.descendant,
        notes: "Nota α",
        image: ids.source,
      });
      await page.evaluate(() => window.neuroMapApp.persistWorkspace());
      await page.reload();
      await page.waitForFunction(
        () => window.neuroMapApp?.state?.root?.text === "Epitelio",
      );
      expect(
        await page.evaluate(
          (id) => window.neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(ids.target);
    });
    test("hovering keeps one preview layout, writes no backup, and blur cancels the gesture", async ({
      page,
    }) => {
      const ids = await seed(page);
      await page.evaluate(async () => {
        // Complete the seed import's checkpoint before measuring hover writes.
        const a = window.neuroMapApp;
        clearTimeout(a.saveTimer);
        await a.persistWorkspace();
        window.qaWrites = 0;
        const persist = a.persistWorkspace;
        a.persistWorkspace = function (...args) {
          window.qaWrites++;
          return persist.apply(this, args);
        };
      });
      const end = await move(page, ids, "center");
      await page.evaluate(
        () =>
          (window.qaPreviewLayout = window.neuroMapApp._nmDragPreview.layout),
      );
      await page.mouse.move(end.x + 1, end.y + 1);
      expect(
        await page.evaluate(
          () =>
            window.qaPreviewLayout === window.neuroMapApp._nmDragPreview.layout,
        ),
      ).toBe(true);
      expect(await page.evaluate(() => window.qaWrites)).toBe(0);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(page.locator("#nm-drag-preview")).toHaveCount(0);
      await page.mouse.up();
      expect(
        await page.evaluate(
          (id) => window.neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(ids.parent);
    });
    test("drag feedback switches to English without translating the node title", async ({
      page,
    }) => {
      const ids = await seed(page);
      await page.evaluate(() => {
        document.documentElement.lang = "en";
      });
      await move(page, ids, "center");
      await expect(page.locator("#nm-drag-preview")).toHaveAttribute(
        "data-intent",
        "child",
      );
      await expect(page.locator("#nm-drag-status")).toHaveText(
        "Child of Forma delle cellule",
      );
      await page.mouse.up();
    });
    if (target === "android")
      test("a second finger cancels the node drag before pinch zoom", async ({
        page,
      }) => {
        const ids = await seed(page, { zoom: 0.8 }),
          before = await page.evaluate(() =>
            window.neuroMapApp.state.createSnapshot(),
          ),
          session = await page.context().newCDPSession(page),
          s = await point(page, ids.source),
          t = await point(page, ids.target);
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: s.x, y: s.y, id: 1 }],
        });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: t.x, y: t.y, id: 1 }],
        });
        await expect(page.locator("#nm-drag-preview")).toBeVisible();
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: t.x, y: t.y, id: 1 },
            { x: t.x + 100, y: t.y + 100, id: 2 },
          ],
        });
        await expect(page.locator("#nm-drag-preview")).toHaveCount(0);
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        expect(
          await page.evaluate(() => window.neuroMapApp.state.createSnapshot()),
        ).toEqual(before);
      });
  });

for (const target of ["desktop", "android"])
  test(`${target} changing maps during a drag cancels the old preview`, async ({
    page,
  }) => {
    await open(page, target);
    const ids = await seed(page);
    await move(page, ids, "center");
    await expect(page.locator("#nm-drag-preview")).toBeVisible();
    await page.evaluate(() =>
      window.neuroMapApp.importHierarchy(
        {
          text: "Other map",
          children: [{ text: "Keep this child", children: [] }],
        },
        { newTab: true },
      ),
    );
    await expect(page.locator("#nm-drag-preview")).toHaveCount(0);
    await page.mouse.up();
    expect(
      await page.evaluate(() =>
        window.neuroMapApp.state.root.children.map((n) => n.text),
      ),
    ).toEqual(["Keep this child"]);
  });
