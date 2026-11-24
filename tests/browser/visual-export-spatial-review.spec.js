const { test, expect } = require("@playwright/test");
async function boot(page, platform = "desktop") {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    platform === "desktop"
      ? "http://127.0.0.1:5174/index.html"
      : "http://127.0.0.1:5173/app/index.html",
  );
  await page.waitForFunction(() => window.neuroMapApp?._nmExportHub);
  await page.evaluate(() =>
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden")),
  );
}
async function seed(page, mode = "fluid") {
  return page.evaluate((mode) => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Studio",
        children: ["Destra", "Sinistra"].map((text) => ({
          text,
          children: [
            {
              text: text + " livello 2",
              children: [{ text: text + " livello 3", children: [] }],
            },
            { text: text + " altro", children: [] },
          ],
        })),
      },
      { newTab: true },
    );
    const [right, left] = a.state.root.children;
    right.sidePinned = "right";
    left.sidePinned = "left";
    a.state.branchStyle = "xmind8";
    document.getElementById("nm-mode-" + mode).click();
    a.recalculateAndRender();
    a.fitWholeMap();
    return {
      root: a.state.root.id,
      right: right.id,
      left: left.id,
      r2: right.children[0].id,
      r3: right.children[0].children[0].id,
      l2: left.children[0].id,
      l3: left.children[0].children[0].id,
      source: right.children[1].id,
    };
  }, mode);
}
async function dragTo(page, id, target, outward = false) {
  const { start, end } = await page.evaluate(
    ({ id, target, outward }) => {
      const a = neuroMapApp,
        sm = a.layout.getLayout(id),
        tm = a.layout.getLayout(target),
        z = a.renderer.camera.zoom;
      const start = a.renderer.worldToScreen(sm.x, sm.y),
        end = a.renderer.worldToScreen(tm.x, tm.y);
      if (outward)
        end.x +=
          (tm.side === "left" || a.state.findNode(target).side === "left"
            ? -1
            : 1) *
          (tm.width / 2 + 90) *
          z;
      else end.y += (tm.height / 2 + 8) * z;
      return { start, end };
    },
    { id, target, outward },
  );
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await expect(page.locator("#nm-drag-preview")).toBeVisible();
  const intent = await page.evaluate(
    () => neuroMapApp.v5DragVisual?.intent || null,
  );
  await page.mouse.up();
  return intent;
}
for (const platform of ["desktop", "android"])
  for (const mode of [
    "clockwise",
    "balanced",
    "fluid",
    "columns",
    "right",
    "left",
  ])
    test(`${platform} ${mode}: geometric cross-side drops choose levels and preserve the entire subtree`, async ({
      page,
    }) => {
      await boot(page, platform);
      const ids = await seed(page, mode);
      await page.evaluate((id) => {
        const n = neuroMapApp.state.findNode(id);
        n.notes = "Nota da conservare";
        neuroMapApp.state.addChildNode(
          n.id,
          neuroMapApp.layout,
          "Dettaglio da conservare",
        );
        neuroMapApp.recalculateAndRender();
        neuroMapApp.fitWholeMap();
      }, ids.source);
      const before = await page.evaluate(() =>
        neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root),
      );
      await dragTo(page, ids.source, ids.l3);
      expect(
        await page.evaluate(
          (id) => neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(ids.l2);
      await dragTo(page, ids.source, ids.right);
      expect(
        await page.evaluate(
          (id) => neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(ids.root);
      await dragTo(page, ids.source, ids.l3, true);
      expect(
        await page.evaluate(
          (id) => neuroMapApp.state.findNode(id).parentId,
          ids.source,
        ),
      ).toBe(ids.l3);
      expect(
        await page.evaluate(
          (id) => neuroMapApp.state.findNode(id).notes,
          ids.source,
        ),
      ).toBe("Nota da conservare");
      expect(
        await page.evaluate(
          (id) => neuroMapApp.state.findNode(id).children[0].text,
          ids.source,
        ),
      ).toBe("Dettaglio da conservare");
      await page.evaluate(() => {
        neuroMapApp.undo();
        neuroMapApp.undo();
        neuroMapApp.undo();
      });
      expect(
        await page.evaluate(() =>
          neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root),
        ),
      ).toEqual(before);
    });
for (const mode of [
  "clockwise",
  "balanced",
  "fluid",
  "columns",
  "right",
  "left",
])
  test(`${mode}: Ctrl+arrows move a left-hand branch in screen direction`, async ({
    page,
  }) => {
    await boot(page);
    await seed(page, mode);
    const result = await page.evaluate(() => {
      const a = neuroMapApp;
      for (const n of a.state.root.children) n.sidePinned = "left";
      a.recalculateAndRender();
      const list = a.state.root.children
        .slice()
        .sort(
          (a1, b) => a.layout.getLayout(a1.id).y - a.layout.getLayout(b.id).y,
        );
      a.selectNode(list[1].id);
      return { id: list[1].id, other: list[0].id };
    });
    await page
      .locator("#mindmap-canvas")
      .evaluate((e) => e.blur())
      .catch(() => {});
    await page.keyboard.press("Control+ArrowUp");
    expect(
      await page.evaluate(
        ({ id, other }) =>
          neuroMapApp.layout.getLayout(id).y <
          neuroMapApp.layout.getLayout(other).y,
        result,
      ),
    ).toBe(true);
    await page.keyboard.press("Control+ArrowDown");
    expect(
      await page.evaluate(
        ({ id, other }) =>
          neuroMapApp.layout.getLayout(id).y >
          neuroMapApp.layout.getLayout(other).y,
        result,
      ),
    ).toBe(true);
  });
test("PDF previews and saves the whole large map on one page; tiles require an explicit choice", async ({
  page,
}, info) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    const a = neuroMapApp;
    for (let i = 0; i < 35; i++)
      a.state.addChildNode(
        a.state.root.id,
        a.layout,
        "Argomento " + i + " · contenuto di studio",
      );
    a.recalculateAndRender();
    window.savedExports = [];
    a.io.triggerDownload = async (blob, name) => {
      window.savedExports.push({ name, text: await blob.text() });
      return true;
    };
    a._nmExportHub.open();
  });
  await page.locator("#nm-export-format").selectOption("pdf-graphic");
  await expect(page.locator("#nm-export-preview")).toHaveAttribute(
    "data-pages",
    "1",
  );
  await expect(page.locator(".nm-export-preview-info")).toContainText(
    /mappa intera|whole map/,
  );
  await page.screenshot({ path: info.outputPath("pdf-whole-map-preview.png") });
  await page.locator(".nm-export-run").click();
  await expect(page.locator(".nm-export-dialog")).toBeHidden();
  expect(
    await page.evaluate(
      () => savedExports[0].text.match(/\/Type \/Page\b/g).length,
    ),
  ).toBe(1);
  await page.evaluate(() => neuroMapApp._nmExportHub.open());
  await page.locator("#nm-export-format").selectOption("pdf-graphic");
  await page.locator("#nm-export-pagination").selectOption("tiles");
  await expect
    .poll(() => page.locator("#nm-export-preview").getAttribute("data-pages"))
    .not.toBe("1");
  const pages = Number(
    await page.locator("#nm-export-preview").getAttribute("data-pages"),
  );
  await page.locator(".nm-export-run").click();
  await expect(page.locator(".nm-export-dialog")).toBeHidden();
  expect(
    await page.evaluate(
      () => savedExports[1].text.match(/\/Type \/Page\b/g).length,
    ),
  ).toBe(pages);
});
test("PNG preview dimensions equal the actual downloaded image at the selected quality", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    window.pngSize = null;
    neuroMapApp.io.triggerDownload = async (blob) => {
      const bitmap = await createImageBitmap(blob);
      window.pngSize = [bitmap.width, bitmap.height];
      bitmap.close();
      return true;
    };
    neuroMapApp._nmExportHub.open();
  });
  await page.locator("#nm-export-format").selectOption("png");
  await page.locator("#nm-export-resolution").selectOption("3");
  await expect(page.locator(".nm-export-preview-info")).toContainText("px");
  const expected = (await page.locator(".nm-export-preview-info").textContent())
    .match(/(\d+) × (\d+)/)
    .slice(1)
    .map(Number);
  await page.locator(".nm-export-run").click();
  await expect(page.locator(".nm-export-dialog")).toBeHidden();
  expect(await page.evaluate(() => pngSize)).toEqual(expected);
});
test("layout disclosure spans the panel, redundant toggle is gone, cards explain their actions, every dock panel lights its trigger", async ({
  page,
}, info) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    nmProduct.isPro = () => true;
    nmProduct.guard = () => true;
  });
  await page.locator("#v6-show-layout").click();
  const widths = await page
    .locator("#nm-project-view-options")
    .evaluate((e) => [
      e.getBoundingClientRect().width,
      e.parentElement.getBoundingClientRect().width,
      e.querySelector("summary").getBoundingClientRect().height,
    ]);
  expect(widths[0] / widths[1]).toBeGreaterThan(0.8);
  expect(widths[2]).toBeLessThan(60);
  await expect(page.locator("#nm-continuation-enabled")).toBeHidden();
  await page.screenshot({ path: info.outputPath("layout-disclosure.png") });
  for (const [button, panel] of [
    ["#nm614-open-navigation", "#nm614-navigation-flyout"],
    ["#btn-toggle-inspector", "#inspector-sidebar"],
    ["#nm-learn-open", "#nm-learn-panel"],
    ["#nm-open-insert", "#nm-insert-panel"],
    ["#btn-ai-settings", "#nm-ai-studio"],
    ["#btn-spotlight", "#find-overlay"],
  ]) {
    await page.locator(button).click();
    await expect(page.locator(panel)).toBeVisible();
    await expect(page.locator(button)).toHaveAttribute("aria-expanded", "true");
    if (panel === "#nm-ai-studio")
      await page
        .locator(panel)
        .getByRole("button", { name: /^(Chiudi|Close)$/ })
        .click();
    else if (panel === "#find-overlay") await page.keyboard.press("Escape");
    else await page.locator(button).click();
    await expect(page.locator(button)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }
  await page.locator("#nm-open-insert").click();
  await expect(page.locator("#nm-insert-image")).toHaveAttribute(
    "title",
    /immagine da file|image from a file/,
  );
  await expect(page.locator("#nm-insert-gallery")).toHaveAttribute(
    "title",
    /Simboli, icone|Symbols, icons/,
  );
  await page.screenshot({ path: info.outputPath("insert-explained.png") });
  await page.locator("#btn-ai-settings").click();
  await page.locator(".nm-ai-advanced").evaluate((el) => {
    if (!el.open) el.querySelector("summary").click();
  });
  await expect(page.locator(".nm-ai-more-grid button small")).toHaveCount(3);
  await page.screenshot({ path: info.outputPath("ai-more-tasks.png") });
});
