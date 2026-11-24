const { test, expect } = require("@playwright/test");
async function open(
  page,
  platform = "desktop",
  size = { width: 1280, height: 900 },
) {
  await page.setViewportSize(size);
  await page.goto(
    platform === "desktop"
      ? "http://127.0.0.1:5174/index.html"
      : "http://127.0.0.1:5173/app/index.html",
  );
  await page.waitForFunction(
    () => window.neuroMapApp?.aiStudio && window.NeuroMapCreativeModules.help,
  );
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    nmProduct.isPro=()=>true;
    neuroMapApp.openAIStudio();
  });
}
for (const platform of ["desktop", "android"])
  for (const width of [390, 1440])
    test(`${platform} ${width}: AI reveals only the task being used, supports keys and translates`, async ({page}) => {
      await open(page,platform,{width,height:900});
      await expect(page.locator('#nm-ai-task-home')).toBeVisible();
      await expect(page.locator('#nm-ai-record')).toBeHidden();
      await page.locator('#nm-ai-task-voice').click();
      await expect(page.locator('#nm-ai-record')).toBeVisible();
      await expect(page.locator('#nm-ai-audio-file')).toBeHidden();
      await expect(page.locator('#nm-ai-transcript')).toBeHidden();
      await expect(page.locator('#nm-ai-text-settings')).toBeHidden();
      await page.locator('#nm-ai-task-back').click();
      await page.locator('#nm-ai-task-audio').click();
      await expect(page.locator('#nm-ai-audio-file')).toBeVisible();
      await expect(page.locator('#nm-ai-record')).toBeHidden();
      await expect(page.locator('#nm-ai-upload')).toBeDisabled();
      await page.locator('#nm-ai-task-back').click();
      await page.locator('#nm-ai-task-text').click();
      await page.locator('#nm-ai-transcript').fill('Un testo da organizzare');
      await expect(page.locator('#nm-ai-from-text')).toBeEnabled();
      await page.locator('#nm-ai-task-back').click();
      await page.locator('#nm-ai-task-translate').click();
      await expect(page.locator('#nm-ai-transcript')).toBeHidden();
      await expect(page.locator('#nm-ai-translate')).toBeVisible();
      await page.locator('#nm-ai-task-back').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#nm-ai-task-text')).toBeFocused();
      await expect(page.locator('#nm-ai-transcript')).toHaveValue('Un testo da organizzare');
      await page.evaluate(async()=>{await GlaukaI18n.setLanguage('en');});
      await expect(page.locator('#nm-ai-task-text')).toContainText('Create from text');
      await expect(page.locator('#nm-ai-tab-create-panel [role=tablist]')).toHaveAttribute('aria-label','How to create the map');
      const bounds=await page.locator('#nm-ai-studio').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(900);
    });
test("navigation explains movement, uses a compass and still centers the selected concept", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    neuroMapApp.aiStudio.panel.classList.add("hidden");
    neuroMapApp.importHierarchy(
      {
        text: "Centro",
        children: [
          { text: "Primo", children: [] },
          { text: "Secondo", children: [] },
        ],
      },
      { newTab: true },
    );
  });
  const toggle = page.locator("#nm614-open-navigation");
  await expect(toggle.locator("svg circle")).toHaveCount(1);
  await toggle.click();
  await expect(page.locator("#nm614-navigation-flyout")).toContainText(
    "Esplora la mappa",
  );
  await expect(page.locator("#nm67-next-main")).toContainText("Segue");
  await expect(page.locator("#nm67-prev-main")).toContainText("Precede");
  const tree = await page.evaluate(() => JSON.stringify(neuroMapApp.state.root));
  await page.locator("#nm67-prev-main").focus();await page.keyboard.press("Tab");await expect(page.locator("#nm67-next-main")).toBeFocused();
  await page.keyboard.press("Enter");expect(await page.evaluate(() => JSON.stringify(neuroMapApp.state.root))).toBe(tree);
  await page.locator("#nm67-next-main").click();
  expect(
    await page.evaluate(() => neuroMapApp.state.selectedNodeId),
  ).not.toBeNull();
  await page.mouse.move(0, 0);
  await page
    .locator("#nm614-navigation-flyout")
    .screenshot({ path: "/workspace/clarity-navigation.png" });
});
for (const width of [320, 800, 1440])
  test(`floating help at ${width}px never clips, suppresses native titles and restores them`, async ({
    page,
  }) => {
    await open(page, "desktop", { width, height: 700 });
    await page.evaluate(() =>
      neuroMapApp.aiStudio.panel.classList.add("hidden"),
    );
    // A clipped scrolling ancestor reproduces the original inspector failure.
    await page.evaluate(() => {
      const c = document.createElement("div");
      c.id = "qa-clipped";
      Object.assign(c.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "85px",
        height: "45px",
        overflow: "hidden",
        zIndex: 9999,
      });
      const b = document.createElement("button");
      b.id = "qa-help";
      b.title =
        "Copia solo questa impostazione su altre schede. Una spiegazione completa visibile anche vicino ai bordi.";
      b.textContent = "⧉";
      c.append(b);
      document.body.append(c);
    });
    const b = page.locator("#qa-help"),
      tip = page.locator("#nm-help-tooltip");
    await b.hover();
    await expect(tip).toBeVisible();
    await expect(b).not.toHaveAttribute("title");
    await expect(b).toHaveAttribute("aria-describedby", "nm-help-tooltip");
    let bounds = await tip.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(700);
    expect(
      await tip.evaluate(
        (e) =>
          e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
      ),
    ).toBe(true);
    await page.mouse.move(2, 2);
    await expect(tip).toBeHidden();
    await expect(b).toHaveAttribute("title", /Copia solo/);
    await b.focus();
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await expect(b).toHaveAttribute("title", /Copia solo/);
    await b.hover();
    await page.evaluate(() => document.getElementById("qa-clipped").remove());
    // Removing the button can expose a different titled control under the mouse.
    await expect
      .poll(() =>
        tip.evaluate(
          (e) => e.hidden || !e.textContent.startsWith("Copia solo"),
        ),
      )
      .toBe(true);
  });
test("every formatting action uses the floating help layer and automatic arrowhead follows the curve", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    neuroMapApp.aiStudio.panel.classList.add("hidden");
    document.getElementById("inspector-sidebar").classList.remove("collapsed");
  });
  // Inspect the common layer, then check every action description in a clipped host.
  const result = await page.evaluate(() => {
    const bar = document.querySelector(".nm-settings-toolbar");
    return {
      count: document.querySelectorAll(".nm-settings-toolbar").length,
      pseudo: getComputedStyle(bar.querySelector("button"), "::after").content,
      head: document.querySelector("#nm-clockwise-head").getAttribute("orient"),
      end: document
        .querySelector(".nm-clockwise-arrow")
        .getAttribute("marker-end"),
    };
  });
  expect(result.count).toBe(2);
  expect(result.pseudo).toBe("none");
  expect(result.head).toBe("auto");
  expect(result.end).toBe("url(#nm-clockwise-head)");
  const descriptions = await page.evaluate(() =>
    [...document.querySelectorAll(".nm-settings-toolbar [title]")].map((el) =>
      el.getAttribute("title"),
    ),
  );
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "qa-all-help";
    Object.assign(host.style, {
      position: "fixed",
      left: "16px",
      top: "100px",
      width: "60px",
      height: "40px",
      overflow: "hidden",
      zIndex: "99999",
    });
    document.body.append(host);
  });
  for (const description of descriptions) {
    await page.evaluate((text) => {
      const b = document.createElement("button");
      b.title = text;
      b.textContent = "☆";
      b.id = "qa-every-description";
      document.getElementById("qa-all-help").replaceChildren(b);
    }, description);
    await page.locator("#qa-every-description").hover();
    await expect(page.locator("#nm-help-tooltip")).toHaveText(description);
    const b = await page.locator("#nm-help-tooltip").boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(1280);
    expect(b.y + b.height).toBeLessThanOrEqual(900);
  }
  await page.evaluate(() => document.getElementById("qa-all-help").remove());
  await page.mouse.move(0, 0);
  await page.locator("#v6-show-layout").click();
  await page
    .locator("#nm-layout-modes")
    .screenshot({ path: "/workspace/clarity-clockwise.png" });
});
for (const platform of ["desktop", "android"])
  test(`${platform}: Tab, Enter and Space in AI controls never create or edit map nodes`, async ({
    page,
  }) => {
    await open(page, platform);
    const before = await page.evaluate(() =>
      JSON.stringify(neuroMapApp.state.root),
    );
    await page.locator('#nm-ai-task-text').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#nm-ai-task-voice')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#nm-ai-record')).toBeVisible();
    await page.locator('#nm-ai-task-back').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#nm-ai-task-home')).toBeVisible();
    expect(
      await page.evaluate(() => JSON.stringify(neuroMapApp.state.root)),
    ).toBe(before);
  });
test("floating help accepts SVG controls and updates text while open", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    neuroMapApp.aiStudio.panel.classList.add("hidden");
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.id = "qa-svg-help";
    s.setAttribute("title", "Spiegazione iniziale");
    s.setAttribute("viewBox", "0 0 40 40");
    Object.assign(s.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "40px",
      height: "40px",
      background: "#fff",
      zIndex: "9999",
    });
    document.body.append(s);
  });
  await page.locator("#qa-svg-help").hover();
  await expect(page.locator("#nm-help-tooltip")).toHaveText(
    "Spiegazione iniziale",
  );
  await page.evaluate(() =>
    document
      .getElementById("qa-svg-help")
      .setAttribute("title", "Spiegazione aggiornata"),
  );
  await expect(page.locator("#nm-help-tooltip")).toHaveText(
    "Spiegazione aggiornata",
  );
  await expect(page.locator("#qa-svg-help")).not.toHaveAttribute("title");
});
