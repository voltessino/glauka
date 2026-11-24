const { test, expect } = require("@playwright/test");
async function boot(page, locale = "it", width = 1440) {
  await page.addInitScript((locale) => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", locale);
  }, locale);
  await page.setViewportSize({ width, height: 960 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.neuroMapApp && window.NeuroMapWorkspaceLayout,
  );
  await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Studio",
        children: [
          { text: "Prima riga\nSeconda riga", children: [] },
          { text: "Non modificare", children: [] },
        ],
      },
      { newTab: true },
    );
    a.selectNode(a.state.root.children[0].id);
    a.state.root.children[0].labelWrapChars = 60;
    a.recalculateAndRender();
  });
}
test("compact emphasis and a single list button replace the list gallery", async ({
  page,
}, info) => {
  await boot(page);
  await page.locator("#btn-toggle-inspector").click();
  await expect(page.locator("#nm-text-emphasis")).toBeVisible();
  await expect(page.locator("#nm-list-menu")).toBeHidden();
  const dimensions = await page
    .locator("#nm-text-multiline")
    .evaluate((el) => ({
      height: el.offsetHeight,
      padding: getComputedStyle(el).padding,
      margin: getComputedStyle(el).margin,
    }));
  expect(dimensions.height, JSON.stringify(dimensions)).toBeLessThan(70);
  expect(await page.locator("#nm68-typesetting").isVisible()).toBe(false);
  await page.locator("#btn-weight-bold").click();
  await page.locator("#nm70-italic").click();
  await page.locator("#nm-text-underline").click();
  expect(
    await page.evaluate(() => {
      const n = neuroMapApp.state.root.children[0];
      return [n.fontWeight, n.fontItalic, n.fontUnderline];
    }),
  ).toEqual([700, true, true]);
  await page.locator("#nm-list-trigger").click();
  await expect(page.locator("#nm-list-menu")).toBeVisible();
  await expect(page.locator("#nm-list-menu button")).toHaveCount(7);
  const box = await page.locator("#nm-list-menu").boundingBox();
  expect(box.height).toBeLessThan(230);
  expect(box.width).toBeLessThanOrEqual(240);
  await page.locator("#nm-list-menu [data-list-style=number]").click();
  await expect(page.locator("#nm-list-menu")).toBeHidden();
  expect(
    await page.evaluate(() => neuroMapApp.state.root.children[0].text),
  ).toBe("1. Prima riga\n2. Seconda riga");
  expect(
    await page.evaluate(() => neuroMapApp.state.root.children[1].text),
  ).toBe("Non modificare");
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(() => neuroMapApp.state.root.children[0].text),
  ).toBe("Prima riga\nSeconda riga");
  await page.screenshot({ path: info.outputPath("text-controls.png") });
});
test("indent changes subsequent text lines, not branch spacing, and underline survives SVG and snapshot", async ({
  page,
}) => {
  await boot(page);
  await page.locator("#btn-toggle-inspector").click();
  await page.locator("#nm-text-multiline summary").click();
  await page.locator("[data-nm68-align=left]").click();
  await page.locator("#nm-text-underline").click();
  const before = await page.evaluate(() => ({
    gap: neuroMapApp.state.branchGapX,
    other: JSON.stringify(neuroMapApp.state.root.children[1]),
  }));
  await page.locator("#nm68-text-indent").evaluate((el) => {
    el.value = "24";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      n = a.state.root.children[0],
      m = a.layout.getLayout(n.id),
      calls = [];
    let strokes = 0;
    const ctx = {
      fillText(text, x, y) {
        calls.push({ text, x, y });
      },
      measureText(text) {
        return { width: text.length * 7 };
      },
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {
        strokes++;
      },
    };
    a.renderer.drawIllustratedLabel(ctx, n, m);
    let svg;
    const old = a.io.triggerDownload;
    a.io.triggerDownload = (blob) => (svg = blob);
    try {
      await a.io.exportSVG();
    } finally {
      a.io.triggerDownload = old;
    }
    return {
      calls,
      strokes,
      svg: await svg.text(),
      node: a.state.createSnapshot().root.children[0],
      gap: a.state.branchGapX,
      other: JSON.stringify(a.state.root.children[1]),
    };
  });
  expect(result.calls).toHaveLength(2);
  expect(result.calls[1].x - result.calls[0].x).toBe(24);
  expect(result.strokes).toBe(2);
  expect(result.node.fontUnderline).toBe(true);
  expect(result.svg).toContain('text-decoration="underline"');
  expect(result.gap).toBe(before.gap);
  expect(result.other).toBe(before.other);
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(
      () => neuroMapApp.state.root.children[0].labelIndent || 0,
    ),
  ).toBe(0);
});
test("menus share icons and typography; Help has no node debug state or oversized license badge", async ({
  page,
}, info) => {
  await boot(page);
  for (const name of ["file", "edit", "insert", "view", "tools", "help"]) {
    await page.locator("#btn-menu-" + name).click();
    const menu = page.locator("#dropdown-" + name);
    await expect(menu).toHaveClass(/nm-command-menu/);
    const rows = await menu
      .locator("button.dropdown-item")
      .evaluateAll((items) =>
        items
          .filter((el) => el.getClientRects().length)
          .map((el) => ({
            id: el.id,
            icons: el.querySelectorAll(":scope>svg").length,
            font: getComputedStyle(el).fontSize,
          })),
      );
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => r.icons === 1 && r.font === "13px"),
      name + JSON.stringify(rows),
    ).toBe(true);
    if (name === "help") {
      await expect(menu.locator(".status-pill")).toHaveCount(0);
      await expect(menu).not.toContainText("DEVELOPER PRO");
      await expect(menu.locator("#nm-license-menu")).toBeVisible();
      await expect(menu.locator("button:visible")).toHaveCount(4);
      await page.screenshot({ path: info.outputPath("help-menu.png") });
    }
    await page.locator("#btn-menu-" + name).click();
  }
  await page.locator("#btn-menu-file").click();
  await expect(page.locator("#nm-save-status")).toHaveText("Copia aggiornata");
  await page.locator("#nm-save-status").click();
  await expect(page.locator("#nm-decision-overlay")).toContainText(
    "Salvataggio e backup",
  );
});
test("insert panel gathers real image, gallery, marker, drawing and reusable shape actions", async ({
  page,
}, info) => {
  await boot(page);
  await page.locator("#nm-open-insert").click();
  await expect(page.locator("#nm-insert-panel")).toBeVisible();
  await expect(page.locator("#nm-insert-shapes button")).toHaveCount(18);
  await page.locator("#nm-shapes-picker summary").click();
  await expect(page.locator("#nm-insert-gallery")).toBeVisible();
  for (const id of ["nm-drawing-open", "nm-insert-formula"])
    await expect(page.locator("#" + id)).toBeVisible();
  // Symbols, emoji and saved drawings now share the single Creative library.
  await expect(page.locator("#nm-insert-symbols")).toBeHidden();
  await expect(page.locator("#nm-creative-library")).toBeHidden();
  await page.screenshot({ path: info.outputPath("insert-panel.png") });
  await page.locator("#nm-insert-shape-rect").click();
  expect(
    await page.evaluate(() => neuroMapApp.state.images.at(-1).graphic.tool),
  ).toBe("rect");
  await page.evaluate(() => neuroMapApp.undo());
  expect(await page.evaluate(() => neuroMapApp.state.images.length)).toBe(0);
  await page.evaluate(() =>
    neuroMapApp.selectNode(neuroMapApp.state.root.children[0].id),
  );
  if (await page.locator("#nm-insert-panel").isHidden())
    await page.locator("#nm-open-insert").click();
  await page.locator("#nm-insert-gallery").click();
  await expect(page.locator("#nm-creative-library-hub")).toBeVisible();
  await page.locator("#nm-creative-tab-icons").click();
  await page.locator("#nm-creative-library-content .nm-creative-library-glyph").first().click();
  expect(
    await page.evaluate(
      () => !!neuroMapApp.state.root.children[0].illustration?.svg,
    ),
  ).toBe(true);
  await page.locator("#nm-creative-library-hub-close").click();
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(
      () => !!neuroMapApp.state.root.children[0].illustration,
    ),
  ).toBe(false);
});
for (const locale of ["it", "en"])
  test(
    "compact panels remain legible without a permanent view bar " + locale,
    async ({ page }, info) => {
      await boot(page, locale, 390);
      await expect(page.locator("#nm-project-views")).toHaveCount(0);
      await page.locator("#btn-toggle-inspector").click();
      await page.locator("#nm-text-emphasis").scrollIntoViewIfNeeded();
      const toolbar = await page.locator("#nm-text-emphasis").boundingBox();
      expect(toolbar.height).toBeLessThan(90);
      await page.locator("#nm-list-trigger").click();
      const menu = await page.locator("#nm-list-menu").boundingBox();
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(390);
      await page.screenshot({
        path: info.outputPath("text-" + locale + "-narrow.png"),
      });
      await page.keyboard.press("Escape");
      await page.locator("#nm-open-insert").click();
      const panel = await page
        .locator("#nm-insert-panel")
        .evaluate((el) => ({ overflow: el.scrollWidth > el.clientWidth + 1 }));
      expect(panel.overflow).toBe(false);
    },
  );
