const { test, expect } = require("@playwright/test");
async function boot(page, locale = "it", width = 1440) {
  await page.addInitScript((locale) => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", locale);
  }, locale);
  await page.setViewportSize({ width, height: 960 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.neuroMapApp && document.getElementById("nm-fit-map"),
  );
}
for (const locale of ["it", "en"])
  test(
    "clear dock, study names, left layout and compact navigation " + locale,
    async ({ page }, info) => {
      await boot(page, locale);
      await expect(
        page.locator("#nm614-right-dock #btn-ai-settings"),
      ).toBeVisible();
      expect(
        await page
          .locator("#btn-ai-settings")
          .evaluate((e) => e.previousElementSibling.id),
      ).toBe("nm-open-insert");
      await page.evaluate(() => (nmProduct.isPro = () => true));
      await page.locator("#btn-ai-settings").click();
      await expect(page.locator("#nm-ai-studio")).toBeVisible();
      await page.locator("#nm-learn-open").click();
      await expect(page.locator(".nm-learn-tabs")).toContainText(
        locale === "it" ? "Ripeti a memoria" : "Recall concepts",
      );
      await expect(page.locator(".nm-learn-tabs")).toContainText(
        locale === "it" ? "Da ripassare" : "Review mistakes",
      );
      await expect(page.locator(".nm-learn-tabs")).not.toContainText("Radar");
      await page.locator("#v6-show-layout").click();
      const layout = page.locator(".hud-bottom-left");
      await expect(layout).toBeVisible();
      const box = await layout.boundingBox();
      expect(box.x).toBeLessThan(30);
      await layout.evaluate((e) => (e.scrollTop = 300));
      expect(
        await layout.evaluate((e) => {
          const p = e.getBoundingClientRect(),
            h = e
              .querySelector(".nm-settings-sticky-header")
              .getBoundingClientRect();
          return Math.abs(h.top - p.top);
        }),
      ).toBeLessThan(3);
      await page.screenshot({
        path: info.outputPath("layout-" + locale + ".png"),
      });
      await page.locator("#nm614-open-navigation").click();
      await expect(page.locator("#nm616-nav-options")).toBeHidden();
      await expect(page.locator("#nm616-nav-branches")).toBeHidden();
      await expect(page.locator("#nm616-nav-map-toggle")).toContainText(
        locale === "it" ? "minimappa" : "minimap",
      );
      await page.locator("#nm614-open-navigation").click();
      await page.locator("#nm-fit-map").click();
      const fit = await page.locator("#nm-fit-map").boundingBox(),
        zoom = await page.locator("#zoom-percentage").boundingBox();
      expect(fit.x).toBeLessThan(zoom.x);
      expect(zoom.x + zoom.width).toBeGreaterThan(1000);
    },
  );
test("visual crop drags handles, cancels safely, applies once and undoes without changing source", async ({
  page,
}, info) => {
  await boot(page);
  await page.evaluate(() => {
    const a = neuroMapApp,
      c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#17a";
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = "#faa";
    ctx.fillRect(300, 0, 300, 400);
    a.state.addImageItem({
      src: c.toDataURL(),
      width: 300,
      height: 200,
      mode: "free",
      worldPos: { x: 0, y: 0 },
    });
    a.selectImage(a.state.images.at(-1).id);
  });
  await page.evaluate(() => neuroMapApp.renderer.prepareExportImages());
  const before = await page.evaluate(() => ({
    image: JSON.stringify(neuroMapApp.state.images.at(-1)),
    history: neuroMapApp.state.undoStack.length,
  }));
  await page.locator("#nm-img-crop").click();
  await expect(page.locator("#nm-image-crop-dialog")).toBeVisible();
  await expect(page.locator("#nm-img-crop-left")).toHaveCount(0);
  const handle = await page
    .locator(".nm-crop-handle[data-edge=se]")
    .boundingBox();
  await page.mouse.move(handle.x + 3, handle.y + 3);
  await page.mouse.down();
  await page.mouse.move(handle.x - 118, handle.y - 78, { steps: 8 });
  await page.mouse.up();
  expect(
    await page
      .locator(".nm-crop-selection")
      .evaluate((e) => parseFloat(e.style.width)),
  ).toBeLessThan(90);
  await page.screenshot({ path: info.outputPath("visual-crop.png") });
  await page.locator("#nm-image-crop-dialog [data-action=cancel]").click();
  expect(
    await page.evaluate(() => ({
      image: JSON.stringify(neuroMapApp.state.images.at(-1)),
      history: neuroMapApp.state.undoStack.length,
    })),
  ).toEqual(before);
  await page.locator("#nm-img-crop").click();
  await page.locator(".nm-crop-selection").press("Shift+ArrowLeft");
  await page.locator("#nm-image-crop-dialog [data-action=apply]").click();
  const after = await page.evaluate(() => ({
    image: neuroMapApp.state.images.at(-1),
    history: neuroMapApp.state.undoStack.length,
  }));
  expect(after.image.crop.right).toBe(1);
  expect(after.image.src).toBe(JSON.parse(before.image).src);
  expect(after.image.width).toBeCloseTo(297);
  expect(after.history).toBe(before.history + 1);
  await page.evaluate(() => {
    neuroMapApp.state.undo();
    neuroMapApp.recalculateAndRender();
  });
  expect(
    await page.evaluate(() => neuroMapApp.state.images.at(-1).crop?.right || 0),
  ).toBe(0);
});
test("inner style gallery hands wheel to outer inspector at both edges; header seals the top", async ({
  page,
}, info) => {
  await boot(page);
  await page.locator("#btn-toggle-inspector").click();
  await page.locator("#nm-map-style-trigger").click();
  const grid = page.locator("#nm-map-presets .nm-map-grid"),
    panel = page.locator("#inspector-sidebar");
  await grid.scrollIntoViewIfNeeded();
  const probe = await grid.evaluate((e) => ({
    max: e.scrollHeight - e.clientHeight,
    height: e.clientHeight,
  }));
  expect(probe.max).toBeGreaterThan(1);
  await grid.evaluate((e) => (e.scrollTop = e.scrollHeight));
  await grid.hover();
  const start = await panel.evaluate((e) => e.scrollTop);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(() => panel.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(start);
  await grid.scrollIntoViewIfNeeded();
  await grid.evaluate((e) => (e.scrollTop = 0));
  await grid.hover();
  const end = await panel.evaluate((e) => e.scrollTop);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => panel.evaluate((e) => e.scrollTop)).toBeLessThan(end);
  expect(
    await panel.evaluate((e) =>
      Math.abs(
        e.querySelector(".nm-settings-sticky-header").getBoundingClientRect()
          .top - e.getBoundingClientRect().top,
      ),
    ),
  ).toBeLessThan(3);
  await page.screenshot({ path: info.outputPath("inspector-scroll.png") });
});

test("closing with the crop dialog open exposes the Save modal and Cancel keeps the map", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    const a = neuroMapApp,
      c = document.createElement("canvas");
    c.width = 200;
    c.height = 100;
    a.state.addImageItem({
      src: c.toDataURL(),
      width: 200,
      height: 100,
      mode: "free",
      worldPos: { x: 0, y: 0 },
    });
    a.selectImage(a.state.images.at(-1).id);
    a.markChanged();
  });
  await page.locator("#nm-img-crop").click();
  await page.evaluate(() => {
    window.closeDecision = NeuroMapLifecycle.requestClose();
  });
  await expect(page.locator("#nm-image-crop-dialog")).toHaveCount(0);
  await expect(page.locator("#nm-decision-panel")).toBeVisible();
  await expect(page.locator("#nm-decision-actions")).toContainText("Salva");
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  expect(await page.evaluate(() => window.closeDecision)).toBe(false);
  expect(await page.evaluate(() => neuroMapApp.state.images.length)).toBe(1);
});
