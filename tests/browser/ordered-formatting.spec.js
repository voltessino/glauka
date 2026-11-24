const { test, expect } = require("@playwright/test");
async function boot(page, locale = "it", width = 1440) {
  await page.addInitScript((locale) => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", locale);
  }, locale);
  await page.setViewportSize({ width, height: 960 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.neuroMapApp && document.getElementById("nm-insert-panel"),
  );
  await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Centro",
        children: [
          { text: "Primo\nSecondo\nTerzo", children: [] },
          {
            text: "Altro ramo dal nome molto lungo per verificare il contenimento dei comandi",
            children: [],
          },
        ],
      },
      { newTab: true },
    );
    a.selectNode(a.state.root.children[0].id);
  });
}
for (const locale of ["it", "en"])
  for (const width of [390, 1440])
    test(
      "ordered panels, labels and no compass overflow " + locale + " " + width,
      async ({ page }, info) => {
        await boot(page, locale, width);
        expect(
          await page
            .locator("#nm-open-insert")
            .evaluate((e) => e.previousElementSibling.id),
        ).toBe("nm-learn-open");
        expect(
          await page
            .locator("#btn-ai-settings")
            .evaluate((e) => e.previousElementSibling.id),
        ).toBe("nm-open-insert");
        await page.locator("#nm-open-insert").click();
        await expect(page.locator("#nm-insert-panel")).toBeVisible();
        await expect(
          page.locator("#inspector-sidebar #nm-creative-launcher"),
        ).toHaveCount(0);
        await expect(
          page.locator("#nm-insert-shapes .nm-insert-shape-tile"),
        ).toHaveCount(18);
        expect(await page.locator("#nm-insert-pictures .nm-insert-tool-grid > button").evaluateAll(es=>es.filter(e=>e.checkVisibility()).map(e=>e.id))).toEqual(["nm-insert-image","nm-insert-gallery","btn-illustrate","nm-insert-wordart","nm-insert-chart","nm-insert-formula"]);
        await expect(page.locator("#nm-drawing-open")).toBeVisible();
        await page.screenshot({ path: info.outputPath("insert.png") });
        await page.locator("#nm614-open-navigation").click();
        await expect(page.locator("#nm-insert-panel")).toBeHidden();
        const nav = page.locator("#nm614-navigation-flyout");
        await expect(nav).toBeVisible();
        expect(
          await nav.evaluate((e) => e.scrollWidth - e.clientWidth),
        ).toBeLessThanOrEqual(1);
        await expect(page.locator("#nm616-context-actions")).toBeHidden();
        await page.locator("#btn-toggle-inspector").click();
        await expect(nav).toBeHidden();
        await expect(page.locator("#inspector-sidebar")).not.toHaveClass(
          /collapsed/,
        );
        await page.locator("#nm-text-emphasis").scrollIntoViewIfNeeded();
        await expect(page.locator("#btn-weight-bold")).toHaveAttribute(
          "aria-label",
          locale === "it" ? "Grassetto" : "Bold",
        );
        await page.locator("#btn-weight-bold").click();
        expect(
          await page.evaluate(
            () =>
              neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId)
                .fontWeight,
          ),
        ).toBe(700);
        await expect(page.locator("#btn-weight-bold")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await page.screenshot({ path: info.outputPath("formatting.png") });
        await page.locator("#v6-show-layout").click();
        await expect(page.locator(".hud-title")).toHaveText(
          locale === "it" ? "Disposizione della mappa" : "Map layout",
        );
        const zoom = await page.locator(".hud-bottom-right").boundingBox();
        expect(zoom.x + zoom.width).toBeGreaterThan(width - 30);
        await expect(page.locator("#nm-fit-map")).toBeVisible();
        await page.evaluate(() => neuroMapApp.openAISettings());
        await expect(page.locator("#ai-settings-modal")).toBeVisible();
        await expect(page.locator("#ai-expand-from-settings")).toHaveCount(0);
        await expect(page.locator("#ai-explain-from-settings")).toHaveCount(0);
        await expect(page.locator("#ai-settings-save")).toBeVisible();
      },
    );
test("compact list menu applies seven choices, respects scope, roundtrips and undoes", async ({
  page,
}, info) => {
  await boot(page);
  await page.locator("#btn-toggle-inspector").click();
  await page.evaluate(
    () =>
      (document.getElementById("nm-list-picker").closest("details").open =
        true),
  );
  const original = await page.evaluate(
    () => neuroMapApp.state.root.children[0].text,
  );
  await expect(page.locator("#nm-list-menu button")).toHaveCount(7);
  for (const [style, first] of [
    ["disc", "• Primo"],
    ["circle", "○ Primo"],
    ["square", "▪ Primo"],
    ["dash", "– Primo"],
    ["number", "1. Primo"],
    ["letter", "a. Primo"],
    ["none", "Primo"],
  ]) {
    await page.locator("#nm-list-trigger").click();
    await page.locator("[data-list-style=" + style + "]").click();
    expect(
      await page.evaluate(
        () => neuroMapApp.state.root.children[0].text.split("\n")[0],
      ),
    ).toBe(first);
    expect(
      await page.evaluate(() => neuroMapApp.state.root.children[1].text),
    ).toContain("Altro ramo");
  }
  expect(
    await page.evaluate(() => neuroMapApp.state.root.children[0].text),
  ).toBe(original);
  await page.locator("#nm-list-trigger").click();
  await page.locator("[data-list-style=number]").click();
  await page.screenshot({ path: info.outputPath("lists.png") });
  const out = await page.evaluate(() => {
    const a = neuroMapApp,
      saved = a.state.createSnapshot().root.children[0].text;
    a.state.undo();
    a.recalculateAndRender();
    return { saved, restored: a.state.root.children[0].text };
  });
  expect(out.saved).toBe("1. Primo\n2. Secondo\n3. Terzo");
  expect(out.restored).toBe(original);
});
test("insertion actions still launch their original tools and compare remains available in study tools", async ({
  page,
}) => {
  await boot(page);
  await page.locator("#nm-open-insert").click();
  await page.locator("#nm-insert-gallery").click();
  await expect(page.locator("#nm-creative-library-hub")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#btn-menu-tools").click();
  const compare = page.locator("#nm616-compare-open");
  await compare.evaluate((e) => {
    const d = e.closest("details");
    if (d) d.open = true;
  });
  await compare.click();
  await expect(page.locator("#nm616-compare")).toBeVisible();
});

test("lists follow the shared scope across sheets without overwriting layout or colours", async ({
  page,
}) => {
  await boot(page);
  const ids = await page.evaluate(() => {
    const a = neuroMapApp,
      first = a.activeTabId;
    a.state.root.children[0].color = "#ff0000";
    a.createNewTab("Altra scheda");
    a.state.root.text = "Altra\nVoce";
    a.state.branchGapX = 195;
    const second = a.activeTabId;
    a.activateTab(first);
    return { first, second };
  });
  await page.locator("#btn-toggle-inspector").click();
  await page.locator("#nm-settings-scope-style").selectOption("all");
  await page.locator("#nm-list-trigger").click();
  await page.locator("[data-list-style=square]").click();
  const result = await page.evaluate(({ first, second }) => {
    const a = neuroMapApp,
      x = a.tabs.find((t) => t.id === first).state,
      y = a.tabs.find((t) => t.id === second).state;
    return {
      one: x.root.children[0].text,
      two: y.root.text,
      gap: y.branchGapX,
      colour: x.root.children[0].color,
    };
  }, ids);
  expect(result).toEqual({
    one: "▪ Primo\n▪ Secondo\n▪ Terzo",
    two: "▪ Altra\n▪ Voce",
    gap: 195,
    colour: "#ff0000",
  });
});
