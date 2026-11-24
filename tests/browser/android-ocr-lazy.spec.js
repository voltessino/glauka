const OCR_DESKTOP=process.env.GLAUKA_OCR_DESKTOP_URL||'http://127.0.0.1:5174',OCR_ANDROID=process.env.GLAUKA_OCR_ANDROID_URL||'http://127.0.0.1:5173';
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", "it");
  });
});

test("Studio OCR loads ocr-tools on demand and opens the scan dialog", async ({
  page,
}, info) => {
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.NeuroMapOCREnsure &&
      !window.NeuroMapOCR &&
      document.body.classList.contains("glauka-mobile-app"),
  );

  await page.locator("#nm74-launch").click();
  await expect(page.locator("#nm74-overlay")).toBeVisible();
  // Documents section exposes the scan reader entry.
  const docs = page.locator(".nm74-tab[data-section=documents]");
  if (await docs.count()) await docs.click();
  await page
    .getByRole("button", { name: /Leggi testo dalle scansioni|Read text from scans/ })
    .click();

  await expect
    .poll(() => page.evaluate(() => !!window.NeuroMapOCR && !!window.neuroMapApp._nmOCR))
    .toBe(true);
  await expect(page.locator("#nm-ocr")).toBeVisible();
  await expect(
    page.locator('script[data-neuromap-ocr-tools]'),
  ).toHaveAttribute("src", "/assets/ocr-tools.js");

  await page.screenshot({
    path: info.outputPath("android-ocr-lazy-open.png"),
    fullPage: true,
  });
});
