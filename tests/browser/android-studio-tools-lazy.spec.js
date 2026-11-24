const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", "it");
  });
});

test("Studio dashboard loads studio-tools on demand", async ({ page }) => {
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.NeuroMapStudioToolsEnsure &&
      !window.NeuroMapDashboardUI82 &&
      document.body.classList.contains("glauka-mobile-app"),
  );

  await page.locator("#nm74-launch").click();
  await expect(page.locator("#nm74-overlay")).toBeVisible();
  await page.locator('.nm74-tab[data-section="dashboard"]').click();

  await expect
    .poll(() => page.evaluate(() => !!window.NeuroMapDashboardUI82 && !!window.NeuroMapWikiUI))
    .toBe(true);
  await expect(
    page.locator('script[data-neuromap-studio-tools]'),
  ).toHaveAttribute("src", "/assets/studio-tools.js");
});
