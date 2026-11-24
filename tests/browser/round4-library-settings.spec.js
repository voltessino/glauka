const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

function saveShot(page, name) {
  const dir = process.env.GLAUKA_ROUND4_SHOTS_DIR;
  if (!dir) return Promise.resolve();
  fs.mkdirSync(dir, { recursive: true });
  return page.screenshot({ path: path.join(dir, name) });
}

test("Desktop Creative Library and enriched Settings Center render cleanly in Prisma and Slate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", "it");
    localStorage.setItem("glauka.f11.deviceName", "PC Studio");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.NeuroMapCreative?.libraryHub &&
      window.NeuroMapSettingsCenter,
  );
  await page.evaluate(() => {
    document.querySelectorAll(".nm6-shade").forEach((e) => e.classList.add("hidden"));
    NeuroMapUISkin?.set?.({ theme: "prisma" });
    NeuroMapCreative.libraryHub(neuroMapApp, "symbols");
  });

  const hub = page.locator("#nm-creative-library-hub");
  await expect(hub).toBeVisible();
  await expect(hub.locator("#gl-library-ai .gl-library-ai-pill")).toHaveText("PRO");
  await expect(hub.locator("#nm-creative-library-tabs button svg")).toHaveCount(5);
  await expect(hub.locator(".nm-creative-library-glyph").first()).toBeVisible();
  await saveShot(page, "01-desktop-library-prisma.png");

  await page.evaluate(() => NeuroMapUISkin?.set?.({ theme: "slate" }));
  await hub.getByRole("tab", { name: "Forme", exact: true }).click();
  await expect(hub.locator(".nm-creative-shape-tile").first()).toBeVisible();
  await saveShot(page, "02-desktop-library-shapes-slate.png");
  await page.locator("#nm-creative-library-hub-close").click();
  await expect(hub).toHaveCount(0);

  await page.evaluate(() => NeuroMapUISkin?.set?.({ theme: "prisma" }));
  await page.locator("#gl-settings-quick").click();
  const center = page.locator("#gl-settings-center");
  await expect(center).toBeVisible();
  await expect(center.locator('#gl-settings-nav button[data-category="study"]')).toBeVisible();

  await center.locator('#gl-settings-nav button[data-category="cloud"]').click();
  await expect(center.locator("#gl-settings-open-share")).toBeVisible();
  await expect(center.locator("#gl-settings-open-compare")).toBeVisible();
  await expect(center.locator("#gl-settings-cloud-device-name")).toHaveValue("PC Studio");
  await saveShot(page, "03-desktop-settings-cloud-prisma.png");

  await center.locator('#gl-settings-nav button[data-category="study"]').click();
  await expect(center.locator("#gl-settings-open-flashcards")).toBeVisible();
  await expect(center.locator("#gl-settings-open-ocr")).toBeVisible();
  await expect(center.locator("#gl-settings-open-dashboard")).toBeVisible();
  await saveShot(page, "04-desktop-settings-study-prisma.png");

  await center.locator('#gl-settings-nav button[data-category="ai"]').click();
  await expect(center.locator("#gl-settings-open-ai-studio")).toBeVisible();
  await expect(center.locator("#gl-settings-open-ai-illustrate")).toBeVisible();
  await saveShot(page, "05-desktop-settings-ai-prisma.png");

  await page.evaluate(() => NeuroMapUISkin?.set?.({ theme: "slate" }));
  await center.locator('#gl-settings-nav button[data-category="cloud"]').click();
  await saveShot(page, "06-desktop-settings-cloud-slate.png");

  await page.evaluate(() => NeuroMapUISkin?.set?.({ theme: "prisma" }));
  await page.locator("#gl-settings-close").click();
});

test("Android Creative Library and full Settings Center work on 393x852 in Light and Dark themes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", "it");
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("http://127.0.0.1:5173/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.GlaukaMobileShell &&
      window.NeuroMapCreative?.libraryHub &&
      window.NeuroMapSettingsCenter,
  );
  await page.evaluate(() => {
    document.querySelectorAll(".nm6-shade").forEach((e) => e.classList.add("hidden"));
    NeuroMapCreative.libraryHub(neuroMapApp, "symbols");
  });

  const hub = page.locator("#nm-creative-library-hub");
  await expect(hub).toBeVisible();
  await expect(hub.locator("#nm-creative-library-tabs button svg")).toHaveCount(5);
  const libBounds = await hub.locator(".nm-creative-dialog").evaluate((el) => ({
    right: el.getBoundingClientRect().right,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(libBounds.right).toBeLessThanOrEqual(394);
  expect(libBounds.scrollWidth).toBeLessThanOrEqual(libBounds.clientWidth + 1);
  await page.mouse.move(10, 400);
  await saveShot(page, "07-android-library-light.png");
  await page.locator("#nm-creative-library-hub-close").click();

  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Impostazioni complete…", exact: true })
    .click();
  const center = page.locator("#gl-settings-center");
  await expect(center).toBeVisible();

  await center.locator('#gl-settings-nav button[data-category="cloud"]').click();
  await expect(center.locator("#gl-settings-open-share")).toBeVisible();
  await expect(center.locator("#gl-settings-open-compare")).toBeVisible();
  await saveShot(page, "08-android-settings-cloud-light.png");

  await center.locator('#gl-settings-nav button[data-category="appearance"]').click();
  await center.locator("#gl-settings-theme-slate").click();
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.glAndroidTheme))
    .toBe("dark");
  await center.locator('#gl-settings-nav button[data-category="cloud"]').click();
  await saveShot(page, "09-android-settings-dark.png");

  const closedByBack = await page.evaluate(() => NeuroMapLifecycle.handleBack());
  expect(closedByBack).toBe("closed");
  await expect(center).toHaveCount(0);
});
