const { test, expect } = require("@playwright/test");
async function boot(page, platform = "desktop") {
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    platform === "desktop"
      ? "http://127.0.0.1:5174/index.html"
      : "http://127.0.0.1:5173/app/index.html",
  );
  await page.waitForFunction(
    () => window.neuroMapApp?.renderer && window.NeuroMapRefinements,
  );
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Studio",
        children: [
          {
            text: "Anatomia",
            children: [
              {
                text: "Fegato",
                children: [
                  { text: "Epatociti", notes: "Nota originale", children: [] },
                ],
              },
            ],
          },
          { text: "Fisiologia", children: [] },
        ],
      },
      { newTab: true },
    );
    a.fitWholeMap();
  });
}
async function gallery(page) {
  await page.locator("#btn-toggle-inspector").click();
  await page.locator("#nm-map-presets").scrollIntoViewIfNeeded();
  await page.locator("#nm-map-style-trigger").click();
}
const tree = (page) =>
  page.evaluate(() =>
    neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root),
  );
test("hover/focus previews real map geometry without changing data, history, dirty flag or exported PNG", async ({
  page,
}, info) => {
  await boot(page);
  const before = await tree(page);
  await page.evaluate(async () => {
    const a = neuroMapApp;
    window.qaStyleState = {
      history: a.state.undoStack.length,
      dirty: a.state.isDirty,
      style: a.state.branchStyle,
    };
    window.qaPNG = async () => {
      let bytes;
      const save = a.io.triggerDownload;
      a.io.triggerDownload = async (b) => {
        bytes = await b.arrayBuffer();
        return true;
      };
      try {
        await a.io.exportPNG();
      } finally {
        a.io.triggerDownload = save;
      }
      return [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ].join(",");
    };
    window.qaBeforePNG = await qaPNG();
  });
  await gallery(page);
  const card = page.locator('.nm-map-card[aria-label="Organico"]');
  await page.mouse.move(700, 200);
  if(!await card.isVisible())await page.locator("#nm-map-style-trigger").click();
  await card.hover();
  await expect
    .poll(() =>
      page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).preview),
    )
    .toBe(true);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      r = a.renderer,
      draw = r.drawNode;
    let renderedStyle;
    r.drawNode = function (...args) {
      renderedStyle = this.state.branchStyle;
      return draw.apply(this, args);
    };
    try {
      r.render();
    } finally {
      r.drawNode = draw;
    }
    return {
      renderedStyle,
      canonicalStyle: a.state.branchStyle,
      restored: r.state === a.state && r.layout === a.layout,
      history: a.state.undoStack.length,
      dirty: a.state.isDirty,
      exportSame: (await qaPNG()) === qaBeforePNG,
    };
  });
  expect(result.renderedStyle).toBe("buzan");
  expect(result.restored).toBe(true);
  expect(result.exportSame).toBe(true);
  expect(result.history).toBe(await page.evaluate(() => qaStyleState.history));
  expect(result.dirty).toBe(await page.evaluate(() => qaStyleState.dirty));
  expect(await tree(page)).toEqual(before);
  await page.screenshot({ path: info.outputPath("live-style-preview.png") });
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).preview),
    )
    .toBe(false);
});
test("clicking a preview applies one real undo transaction and changing maps discards it", async ({
  page,
}) => {
  await boot(page);
  const before = await tree(page);
  await gallery(page);
  const card = page.locator('.nm-map-card[aria-label="Organico"]');
  await card.focus();
  await expect
    .poll(() =>
      page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).preview),
    )
    .toBe(true);
  const history = await page.evaluate(() => neuroMapApp.state.undoStack.length);
  await card.click();
  expect(await page.evaluate(() => neuroMapApp.state.branchStyle)).toBe(
    "buzan",
  );
  expect(await page.evaluate(() => neuroMapApp.state.undoStack.length)).toBe(
    history + 1,
  );
  expect(
    await page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).preview),
  ).toBe(false);
  await page.evaluate(() => neuroMapApp.undo());
  expect(await tree(page)).toEqual(before);
  await page.mouse.move(700, 200);
  if(!await card.isVisible())await page.locator("#nm-map-style-trigger").click();
  await card.hover();
  await expect
    .poll(() =>
      page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).preview),
    )
    .toBe(true);
  await page.evaluate(() => neuroMapApp.createNewTab("Altra mappa"));
  expect(
    await page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).preview),
  ).toBe(false);
});
for (const platform of ["desktop", "android"])
  test.describe(platform + " orientation and background", () => {
    test("search jumps directly into the available canvas without travel or arrival effects", async ({
      page,
    }) => {
      await boot(page, platform);
      const id = await page.evaluate(
        () => neuroMapApp.state.root.children[0].children[0].id,
      );
      await page.evaluate((id) => neuroMapApp.teleportToNode(id), id);
      await expect
        .poll(() => page.evaluate(() => neuroMapApp._teleportFrame))
        .toBeNull();
      const landed = await page.evaluate((id) => {
        const a = neuroMapApp,
          m = a.layout.getLayout(id),
          p = a.renderer.worldToScreen(m.x, m.y),
          v = NeuroMapGraphics.viewport();
        return { p, v, arrival: NeuroMapRefinements.inspect(a).arriving };
      }, id);
      expect(landed.p.x).toBeCloseTo((landed.v.left + landed.v.right) / 2, 0);
      expect(landed.arrival).toBe(false);
      await expect
        .poll(() =>
          page.evaluate(
            () => NeuroMapRefinements.inspect(neuroMapApp).arriving,
          ),
        )
        .toBe(false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await page.evaluate((id) => {
          neuroMapApp.teleportToNode(id);
          return neuroMapApp._teleportFrame;
        }, id),
      ).toBeNull();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate((id) => neuroMapApp.teleportToNode(id), id);
      await page.mouse.move(700, 700);
      await page.mouse.wheel(0, 40);
      await expect
        .poll(() => page.evaluate(() => neuroMapApp._teleportFrame))
        .toBeNull();
    });
    test("retired path stays absent even for saved opt-ins; textures still persist", async ({
      page,
    }, info) => {
      await boot(page, platform);
      const before = await tree(page);
      const result = await page.evaluate(async () => {
        const a = neuroMapApp,
          n = a.state.root.children[0].children[0].children[0];
        a.selectNode(n.id);
        a.renderer.render();
        const path = NeuroMapRefinements.inspect(a).path;
        let svg;
        const save = a.io.triggerDownload;
        a.io.triggerDownload = async (b) => {
          svg = await b.text();
          return true;
        };
        await a.io.exportSVG();
        const first = svg;
        NeuroMapRefinements.set({ path: false });
        if (NeuroMapRefinements.inspect(a).path.length)
          throw Error("Path cache retained after disabling");
        await a.io.exportSVG();
        a.io.triggerDownload = save;
        return {
          path,
          expected: [
            a.state.root.id,
            a.state.root.children[0].id,
            n.parentId,
            n.id,
          ],
          same: first === svg,
        };
      });
      expect(result.path).toEqual([]);
      expect(result.same).toBe(true);
      expect(await tree(page)).toEqual(before);
      await page.evaluate(() =>
        NeuroMapRefinements.set({ pattern: "grid", intensity: 22, path: true }),
      );
      await page.screenshot({
        path: info.outputPath("path-and-grid-" + platform + ".png"),
      });
      await page.reload();
      await page.waitForFunction(() => window.NeuroMapRefinements);
      expect(
        await page.evaluate(() => NeuroMapRefinements.get()),
      ).toMatchObject({ pattern: "grid", intensity: 22, path: false });
      await page.evaluate(() =>
        NeuroMapRefinements.set({ pattern: "none", intensity: 0 }),
      );
      const count = await page.evaluate(() => {
        let fills = 0;
        const r = neuroMapApp.renderer,
          original = r.ctx.fill;
        r.ctx.fill = () => fills++;
        try {
          r.drawAmbientGrid();
        } finally {
          r.ctx.fill = original;
        }
        return fills;
      });
      expect(count).toBe(0);
    });
    test("image/drawing drag leaves retired alignment guides off and preserves history semantics", async ({
      page,
    }, info) => {
      await boot(page, platform);
      const before = await tree(page);
      const ids = await page.evaluate(() => {
        const a = neuroMapApp,
          c = document.createElement("canvas");
        c.width = 100;
        c.height = 60;
        c.getContext("2d").fillRect(0, 0, 100, 60);
        const src = c.toDataURL();
        for (const [x, y] of [
          [-250, -200],
          [250, 250],
        ])
          a.state.addImageItem({
            src,
            width: 100,
            height: 60,
            mode: "free",
            worldPos: { x, y },
          });
        Object.assign(a.renderer.camera, { x: 720, y: 450, zoom: 1 });
        a.requestRender();
        return a.state.images.map((i) => i.id);
      });
      const history = await page.evaluate(
        () => neuroMapApp.state.undoStack.length,
      );
      await page.mouse.move(970, 700);
      await page.mouse.down();
      await page.mouse.move(470, 700, { steps: 8 });
      await expect
        .poll(() =>
          page.evaluate(
            () => NeuroMapRefinements.inspect(neuroMapApp).guideCount,
          ),
        )
        .toBe(0);
      await page.screenshot({
        path: info.outputPath("alignment-" + platform + ".png"),
      });
      await page.mouse.up();
      await expect
        .poll(() =>
          page.evaluate(
            () => NeuroMapRefinements.inspect(neuroMapApp).guideCount,
          ),
        )
        .toBe(0);
      expect(
        await page.evaluate(() => neuroMapApp.state.undoStack.length),
      ).toBe(history + 1);
      expect(await tree(page)).toEqual(before);
      expect(
        await page.evaluate(
          (id) => Math.round(neuroMapApp.state.findImage(id).worldPos.x),
          ids[1],
        ),
      ).toBe(-250);
    });
  });
test("refinement preferences fit the appearance panel and translate", async ({
  page,
}, info) => {
  await boot(page);
  await page.locator("#gl-settings-quick").click();
  await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
  await page.locator("#nm-map-refinements").scrollIntoViewIfNeeded();
  await page.locator("#nm-background-pattern").selectOption("grid");
  await page.locator("#nm-pattern-intensity").evaluate((e) => {
    e.value = "23";
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.screenshot({ path: info.outputPath("refinement-settings.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator("#nm-map-refinements")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.evaluate(async () => {
    await GlaukaI18n.setLanguage("en");
  });
  await expect(page.locator("#nm-map-refinements h3")).toHaveText(
    "Texture",
  );
});
test("large-map preview remains bounded and never clones the map", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      root = a.state.root;
    while (root.children.length < 1501)
      root.children.push({
        id: "cap-" + root.children.length,
        text: "Concetto",
        parentId: root.id,
        side: "right",
        children: [],
      });
    const button = document.createElement("button");
    let clones = 0,
      original = a.state.constructor.cloneTree;
    a.state.constructor.cloneTree = function (...args) {
      clones++;
      return original.apply(this, args);
    };
    try {
      NeuroMapRefinements.preview(
        a,
        NeuroMapMapStyleCore.PRESETS.find(p=>p.id==="organic"),
        "map",
        button,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      return {
        clones,
        preview: NeuroMapRefinements.inspect(a).preview,
        hint: button.title,
      };
    } finally {
      a.state.constructor.cloneTree = original;
      NeuroMapRefinements.cancelPreview(a);
    }
  });
  expect(result.clones).toBe(0);
  expect(result.preview).toBe(false);
  expect(result.hint).toMatch(/Mappa estesa|Large map/);
});
test("every stock style has a finite, temporary preview and returns its renderer to canonical state", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      before = JSON.stringify(a.state.root),
      history = a.state.undoStack.length,
      rows = [];
    for (const p of NeuroMapMapStyleCore.PRESETS) {
      NeuroMapRefinements.preview(a, p);
      await new Promise((resolve) => setTimeout(resolve, 155));
      let finite = true,
        style;
      const original = a.renderer.drawNode;
      a.renderer.drawNode = function (n) {
        const m = this.layout.getLayout(n.id);
        if (m)
          finite =
            finite && [m.x, m.y, m.width, m.height].every(Number.isFinite);
        style = this.state.branchStyle;
        return original.call(this, n);
      };
      try {
        a.renderer.render();
      } finally {
        a.renderer.drawNode = original;
      }
      rows.push({
        id: p.id,
        preview: NeuroMapRefinements.inspect(a).preview,
        finite,
        style,
        expected: p.branchStyle,
        restored:
          a.renderer.state === a.state && a.renderer.layout === a.layout,
      });
      NeuroMapRefinements.cancelPreview(a);
    }
    return {
      rows,
      same: before === JSON.stringify(a.state.root),
      historySame: history === a.state.undoStack.length,
    };
  });
  expect(result.same).toBe(true);
  expect(result.historySame).toBe(true);
  for (const row of result.rows) {
    expect(row.preview, row.id).toBe(true);
    expect(row.finite, row.id).toBe(true);
    expect(row.restored, row.id).toBe(true);
    expect(row.style, row.id).toBe(row.expected);
  }
});
test("node drag has no alignment guides and cancels without changing the tree", async ({
  page,
}) => {
  await boot(page);
  const before = await tree(page);
  const points = await page.evaluate(() => {
    const a = neuroMapApp,
      source = a.state.root.children[1],
      target = a.state.root.children[0],
      s = a.layout.getLayout(source.id),
      t = a.layout.getLayout(target.id);
    return {
      start: a.renderer.worldToScreen(s.x, s.y),
      end: a.renderer.worldToScreen(t.x, t.y + 110),
      history: a.state.undoStack.length,
    };
  });
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 8 });
  await expect
    .poll(() =>
      page.evaluate(() => NeuroMapRefinements.inspect(neuroMapApp).guideCount),
    )
    .toBe(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(
    await page.evaluate(
      () => NeuroMapRefinements.inspect(neuroMapApp).guideCount,
    ),
  ).toBe(0);
  expect(await page.evaluate(() => neuroMapApp.state.undoStack.length)).toBe(
    points.history,
  );
  expect(await tree(page)).toEqual(before);
});
test("search keeps a long concept clear of the left layout panel", async ({
  page,
}) => {
  await boot(page);
  await page.locator("#v6-show-layout").click();
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      n = a.state.root.children[0];
    n.text = "Concetto da studiare ".repeat(20);
    n.labelWrapChars = 100;
    n.fontSize = 28;
    a.recalculateAndRender();
    NeuroMapRefinements.set({ travel: false });
    a.teleportToNode(n.id);
    const m = a.layout.getLayout(n.id),
      p = a.renderer.worldToScreen(m.x, m.y),
      box = document.querySelector(".hud-bottom-left").getBoundingClientRect();
    return {
      left: p.x - (m.width * a.renderer.camera.zoom) / 2,
      panelRight: box.right,
    };
  });
  expect(result.left).toBeGreaterThan(result.panelRight);
});
test("preview painters cannot overwrite canonical relationship hit curves", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      [from, to] = a.state.root.children;
    a.state.relationships = [
      {
        id: "preview-link",
        fromId: from.id,
        toId: to.id,
        label: "Relazione originale",
        color: "#34d399",
      },
    ];
    a.renderer.render();
    NeuroMapRefinements.preview(
      a,
      NeuroMapMapStyleCore.PRESETS.find((p) => p.id === "geometric"),
    );
    await new Promise((resolve) => setTimeout(resolve, 165));
    const before = a.state.relationships[0]._runtimeCurve,
      serialized = JSON.stringify(a.state.relationships);
    a.renderer.render();
    const result = {
      sameCurve: before === a.state.relationships[0]._runtimeCurve,
      sameData: serialized === JSON.stringify(a.state.relationships),
      preview: NeuroMapRefinements.inspect(a).preview,
    };
    NeuroMapRefinements.cancelPreview(a);
    return result;
  });
  expect(result).toEqual({ sameCurve: true, sameData: true, preview: true });
});
test("style previews reuse cached media without decoding additional image bitmaps", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      r = a.renderer;
    NeuroMapRefinements.preview(a, NeuroMapMapStyleCore.PRESETS.find(p=>p.id==="organic"));
    await new Promise((resolve) => setTimeout(resolve, 160));
    const RealImage = window.Image,
      draw = r.drawImagesLayer;
    let decodes = 0;
    window.Image = class extends RealImage {
      constructor(...args) {
        super(...args);
        decodes++;
      }
    };
    r.drawImagesLayer = function (layer) {
      if (this.state !== a.state)
        this.state.images = [
          {
            id: "preview-only-photo",
            src:
              "data:image/svg+xml," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="41" height="31"><rect width="41" height="31" fill="pink"/></svg>',
              ),
            mode: "free",
            width: 120,
            height: 90,
            worldPos: { x: 0, y: 0 },
          },
        ];
      return draw.call(this, layer);
    };
    try {
      r.render();
      return {
        decodes,
        originalMedia: a.state.images.length,
        restored: !r._nmPreviewNoDecode,
      };
    } finally {
      window.Image = RealImage;
      r.drawImagesLayer = draw;
      NeuroMapRefinements.cancelPreview(a);
    }
  });
  expect(result).toEqual({ decodes: 0, originalMedia: 0, restored: true });
});
test("retired path remains absent when an ancestor has two visual copies", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Centro",
        children: [
          {
            text: "Ramo condiviso",
            children: Array.from({ length: 32 }, (_, i) => ({
              text: "Concetto " + i,
              children: [],
            })),
          },
        ],
      },
      { newTab: true },
    );
    a.state.root.layoutMode = "clockwise";
    a.state.root.layoutDistribution = {
      enabled: true,
      height: 480,
      minimumHeight: 480,
      overflowMode: "expand",
    };
    a.recalculateAndRender();
    Object.assign(a.renderer.camera, { x: 720, y: 450, zoom: 0.4 });
    const id = a.state.root.children[0].id;
    const views = [...a.layout.viewNodes].filter(([, v]) => v.logicalId === id),
      right = views.find(([, v]) => v.side === "right"),
      left = views.find(([, v]) => v.side === "left");
    if (!right || !left) throw Error("Expected two visible ancestor copies");
    const ctx = a.renderer.ctx,
      original = ctx.bezierCurveTo;
    let endpoints = [];
    ctx.bezierCurveTo = function (...args) {
      const t = this.getTransform();
      if (
        Math.abs(this.lineWidth - 2.2) < 0.001 &&
        Math.abs(t.a - a.renderer.dpr) < 0.001 &&
        Math.abs(t.e) < 0.001
      )
        endpoints.push(args[4]);
      return original.apply(this, args);
    };
    try {
      a.layout._preferredViews.set(id, right[0]);
      a.selectNode(id);
      a.renderer.render();
      const first = endpoints.at(-1);
      endpoints = [];
      a.layout._preferredViews.set(id, left[0]);
      a.selectNode(id);
      a.renderer.render();
      return {
        right: first,
        left: endpoints.at(-1),
        center: a.renderer.worldToScreen(0, 0).x,
      };
    } finally {
      ctx.bezierCurveTo = original;
    }
  });
  expect(result.right).toBeUndefined();
  expect(result.left).toBeUndefined();
});
