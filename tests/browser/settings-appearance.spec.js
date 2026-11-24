const { test, expect } = require("@playwright/test");

async function boot(page) {
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(() => window.neuroMapApp && window.NeuroMapSettingsCenter && window.NeuroMapUISkin);
  await page.evaluate(() => document.querySelectorAll(".nm6-shade").forEach((e) => e.classList.add("hidden")));
}

test("desktop appearance keeps one control per preference and still reaches the moved tools", async ({ page }, info) => {
  await boot(page);
  await page.evaluate(() => NeuroMapUISkin.set({ theme: "prisma", contrast: "normal", readability: "standard" }));
  await page.locator("#gl-settings-quick").click();
  await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
  const body = page.locator("#gl-settings-body");
  await expect(body.locator("select#gl-settings-contrast")).toHaveCount(1);
  await expect(body.locator("#nm-ui-skin-contrast,#nm-ui-skin-choice,#nm-ui-skin-readability")).toHaveCount(0);
  await expect(body.locator("select#gl-settings-control-size")).toHaveCount(1);
  await expect(body.locator("#nm-map-presets,#nm-motion-settings")).toHaveCount(0);
  await body.locator("#gl-format-map-canvas").scrollIntoViewIfNeeded();
  await expect(body.locator("#gl-format-map-canvas .nm-theme-picker")).toBeVisible();
  await expect(body.locator("#gl-format-map-canvas #nm-map-refinements")).toBeVisible();
  await expect(body.locator("#gl-settings-theme-prisma")).toHaveAttribute("aria-pressed", "true");
  await expect(body.locator("#gl-settings-theme-prisma .gl-settings-preview")).toHaveCSS("background-color", "rgb(246, 243, 255)");
  await expect(body.locator("#gl-settings-theme-slate")).toHaveAttribute("aria-pressed", "false");
  await expect(body.locator("#gl-settings-accent")).toHaveCount(1);
  await expect(body.locator("#gl-settings-panel-spacing")).toHaveCount(1);
  await expect(body.locator("#gl-settings-motion-interface")).toHaveCount(1);
  await page.locator("#gl-settings-center").screenshot({ path: info.outputPath("appearance-white.png") });
  await page.locator("#gl-settings-theme-slate").click();
  await expect(page.locator("body")).toHaveAttribute("data-nm-skin", "slate");
  await expect(body.locator("#gl-settings-theme-slate")).toHaveAttribute("aria-pressed", "true");
  await expect(body.locator("#gl-settings-theme-prisma")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#gl-settings-center").screenshot({ path: info.outputPath("appearance-dark.png") });
  await page.reload();
  await page.waitForFunction(() => window.neuroMapApp && document.body.dataset.nmSkin === "slate");
  await page.evaluate(() => document.querySelectorAll(".nm6-shade").forEach((e) => e.classList.add("hidden")));
  await page.locator("#btn-toggle-inspector").click();
  await expect(page.locator("#inspector-sidebar .nm-theme-picker")).toHaveCount(0);
  await expect(page.locator("#inspector-sidebar #nm-map-refinements")).toHaveCount(0);
  await expect(page.locator("#inspector-sidebar #nm-map-presets")).toBeVisible();
  await page.locator("#inspector-sidebar").screenshot({ path: info.outputPath("format-map.png") });
  await page.locator("#gl-settings-quick").click();
  await page.locator('#gl-settings-nav button[data-category="editor"]').click();
  await expect(page.locator("#gl-settings-branch-motion")).toBeVisible();
  await expect(page.locator("#gl-settings-branch-duration")).toBeVisible();
  await page.locator("#gl-settings-center").screenshot({ path: info.outputPath("editor-motion.png") });
  await page.locator('#gl-settings-nav button[data-category="navigation"]').click();
  await expect(page.locator("#gl-settings-edit-zoom")).toBeVisible();
  await page.locator("#gl-settings-center").screenshot({ path: info.outputPath("navigation-zoom.png") });
  await page.locator("#gl-settings-search").fill("contrasto");
  await expect(page.locator('#gl-settings-nav button[data-category="appearance"]')).toBeVisible();
  await expect(page.locator('#gl-settings-nav button[data-category="cloud"]')).toBeHidden();
  await page.evaluate(async () => {
    await GlaukaI18n.setLanguage("en");
  });
  await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
  await expect(page.locator("#gl-settings-section-title")).toHaveText("Appearance");
  await expect(page.locator("#gl-settings-theme-prisma")).toContainText("White — Prisma Vivo");
  await page.evaluate(() => NeuroMapUISkin.set({ theme: "prisma" }));
});
