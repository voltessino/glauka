"use strict";
const { test, expect } = require("@playwright/test");
async function boot(page, platform) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    platform === "android"
      ? (process.env.GLAUKA_ANDROID_TEST_URL || (process.env.GLAUKA_ANDROID_TEST_URL || 'http://127.0.0.1:5173/app/index.html'))
      : (process.env.GLAUKA_DESKTOP_TEST_URL || (process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html')),
  );
  await page.waitForFunction(
    () => window.neuroMapApp && window.NeuroMapCore && window.NeuroMapCreative,
  );
  await page.evaluate(() =>
    document
      .querySelectorAll(".nm6-shade")
      .forEach((el) => el.classList.add("hidden")),
  );
}
async function seed(page) {
  return page.evaluate(() => {
    const app = window.neuroMapApp;
    app.importHierarchy(
      {
        text: "Central",
        children: Array.from({ length: 6 }, (_, i) => ({
          text: "Main " + i,
          children: i === 0 ? [{ text: "Nested branch", children: [] }] : [],
        })),
      },
      { newTab: true },
    );
    app.state.branchStyle = "xmind8";
    document.getElementById("nm-mode-fluid").click();
    app.recalculateAndRender();
    app.fitToScreen();
    return { rootId: app.state.root.id, source: app.state.root.children[0].id };
  });
}
for (const platform of ["desktop", "android"])
  test.describe(platform + " Fluid layout and natural drag", () => {
    test.beforeEach(async ({ page }) => boot(page, platform));
    test("Fluid appears as a translated, selected third preset; default remains Clockwise", async ({
      page,
    }) => {
      const before = await page.evaluate(() => {
        const a = neuroMapApp;
        return {
          mode: a.state.root.layoutMode,
          enabled: a.state.root.layoutDistribution?.enabled,
          buttons: [
            ...document.querySelectorAll("#nm-layout-modes [data-mode]"),
          ].map((el) => el.dataset.mode),
        };
      });
      expect(before.buttons.slice(0, 3)).toEqual([
        "clockwise",
        "balanced",
        "fluid",
      ]);
      expect(before.mode).toBe(
        platform === "desktop" ? "clockwise" : undefined,
      );
      expect(before.enabled).toBe(platform === "desktop" ? true : undefined);
      await seed(page);
      const result = await page.evaluate(() => {
        const a = neuroMapApp,
          children = a.state.root.children;
        return {
          mode: a.state.root.layoutMode,
          enabled: a.state.root.layoutDistribution?.enabled,
          pressed: document
            .getElementById("nm-mode-fluid")
            .getAttribute("aria-pressed"),
          right: children.filter((n) => n.side === "right").length,
          left: children.filter((n) => n.side === "left").length,
          hint: document.getElementById("nm-fluid-mode-hint").textContent,
        };
      });
      expect(result.mode).toBe("fluid");
      expect(result.enabled).toBe(false);
      expect(result.pressed).toBe("true");
      expect(result.right).toBeGreaterThan(0);
      expect(result.left).toBeGreaterThan(0);
      expect(result.hint.length).toBeGreaterThan(10);
    });
    test("Drag a root branch across center without reparenting; preserve undo and saved pin", async ({
      page,
    }) => {
      const ids = await seed(page);
      const before = await page.evaluate(() =>
        neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root),
      );
      const positions = await page.evaluate((id) => {
        const a = neuroMapApp,
          m = a.layout.getLayout(id),
          root = a.layout.getLayout(a.state.root.id);
        const start = a.renderer.worldToScreen(m.x, m.y);
        const center = a.renderer.worldToScreen(root.x, root.y);
        return { start, end: { x: center.x - 260, y: start.y + 4 } };
      }, ids.source);
      await page.mouse.move(positions.start.x, positions.start.y);
      await page.mouse.down();
      await page.mouse.move(positions.end.x, positions.end.y, { steps: 16 });
      await page.mouse.up();
      const result = await page.evaluate((id) => {
        const a = neuroMapApp,
          node = a.state.findNode(id),
          m = a.layout.getLayout(id);
        return {
          parent: node.parentId,
          pin: node.sidePinned,
          x: m?.x,
          mode: a.state.root.layoutMode,
          preserved: a.state.constructor
            .cloneTree(a.state.root)
            .children.find((n) => n.id === id).sidePinned,
        };
      }, ids.source);
      expect(result.parent).toBe(ids.rootId);
      expect(result.pin).toBe("left");
      expect(result.preserved).toBe("left");
      expect(result.x).toBeLessThan(0);
      await page.evaluate(() => neuroMapApp.undo());
      expect(
        await page.evaluate(() =>
          neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root),
        ),
      ).toEqual(before);
    });
    test("Alt held before pointerdown starts intentional child nesting without background panning", async ({
      page,
    }) => {
      await seed(page);
      const points = await page.evaluate(() => {
        const a = neuroMapApp,
          [source, target] = a.state.root.children;
        const point = (id) => {
          const m = a.layout.getLayout(id);
          return a.renderer.worldToScreen(m.x, m.y);
        };
        return {
          source: source.id,
          target: target.id,
          start: point(source.id),
          end: point(target.id),
        };
      });
      await page.mouse.move(points.start.x, points.start.y);
      await page.keyboard.down("Alt");
      await page.mouse.down();
      await page.mouse.move(points.end.x, points.end.y, { steps: 16 });
      await page.mouse.up();
      await page.keyboard.up("Alt");
      const result = await page.evaluate((id) => {
        const a = neuroMapApp;
        return {
          parent: a.state.findNode(id).parentId,
          dragging: !!a._v5Candidate,
          panning: !!a.drag && a.drag.kind === "pan",
        };
      }, points.source);
      expect(result.parent).toBe(points.target);
      expect(result.dragging).toBe(false);
      expect(result.panning).toBe(false);
    });
    test("Hovering an unrelated branch without deliberate modifier does not reparent", async ({
      page,
    }) => {
      await seed(page);
      const data = await page.evaluate(() => {
        const a = neuroMapApp,
          primary = a.state.root.children;
        const from = primary[0].children[0],
          to = primary[1];
        const m = a.layout.getLayout(to.id),
          pt = a.renderer.worldToScreen(m.x, m.y);
        const before = from.parentId;
        const intent = a.nm612ResolveDrop(from.id, pt.x, pt.y, {
          altKey: false,
          childIntent: false,
        });
        return { before, intent, intentKind: intent?.kind };
      });
      expect(data.intentKind).not.toBe("child");
    });
  });
test("stationary dwell updates the nesting preview before release and remains undoable", async ({
  page,
}) => {
  await boot(page, "desktop");
  const ids = await seed(page);
  const points = await page.evaluate((source) => {
    const a = neuroMapApp,
      target = a.state.root.children[1],
      s = a.layout.getLayout(source),
      d = a.layout.getLayout(target.id);
    return {
      from: a.renderer.worldToScreen(s.x, s.y),
      to: a.renderer.worldToScreen(d.x, d.y),
      target: target.id,
      history: a.state.undoStack.length,
    };
  }, ids.source);
  await page.mouse.move(points.from.x, points.from.y);
  await page.mouse.down();
  await page.mouse.move(points.to.x, points.to.y, { steps: 8 });
  await expect
    .poll(
      () => page.evaluate(() => neuroMapApp._v5Candidate?.dropIntent?.kind),
      { timeout: 1800 },
    )
    .toBe("child");
  expect(
    await page.evaluate(
      (id) => neuroMapApp._nmDragPreview?.state.findNode(id).parentId,
      ids.source,
    ),
  ).toBe(points.target);
  await page.mouse.up();
  expect(
    await page.evaluate(
      (id) => neuroMapApp.state.findNode(id).parentId,
      ids.source,
    ),
  ).toBe(points.target);
  expect(await page.evaluate(() => neuroMapApp.state.undoStack.length)).toBe(
    points.history + 1,
  );
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(
      (id) => neuroMapApp.state.findNode(id).parentId,
      ids.source,
    ),
  ).toBe(ids.rootId);
});
