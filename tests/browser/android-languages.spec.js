const {chooseTool}=require('./android-tools-helper');
const { test, expect } = require("@playwright/test");
const languages =
  require("../../packages/editor-ui/locales/source.json").languages;
async function boot(page) {
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.GlaukaI18n &&
      document.documentElement.hasAttribute("data-glauka-ready") &&
      document.getElementById("glauka-welcome-language"),
  );
  await expect(page.locator("#glauka-mobile-loading")).toHaveCount(0);
}
for (const language of languages) {
  test(
    "Android " +
      language.code +
      " translates welcome and tools, persists on reload and preserves authored text",
    async ({ page }, info) => {
      await page.setViewportSize({ width: 393, height: 852 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await boot(page);
      await expect(page.locator("#nm6-welcome")).toBeVisible();
      await expect(page.locator("#glauka-welcome-language option")).toHaveCount(
        8,
      );
      await expect(page.locator("#nm6-locale-button")).toHaveCount(0);
      await page
        .locator("#glauka-welcome-language")
        .selectOption(language.code);
      await expect(page.locator("html")).toHaveAttribute("lang", language.code);
      await expect(page.locator("html")).toHaveAttribute("dir", language.dir);
      expect(
        await page.locator("#glauka-welcome-language option").allTextContents(),
      ).toEqual(languages.map((l) => l.name));
      const heading = await page.locator("#nm6-welcome-title").innerText();
      expect(heading.trim()).not.toBe("");
      const bounds = await page.locator("#nm6-welcome section").boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        page.viewportSize().width + 1,
      );
      if (!["it", "en"].includes(language.code))
        expect(heading).not.toMatch(/Dai forma|Give shape/);
      await page.screenshot({
        path: info.outputPath("welcome-" + language.code + ".png"),
      });
      await page.locator("#nm6-welcome-start").click();
      await expect(page.locator("#nm74-launch")).toBeVisible();
      await expect(page.locator("#glauka-options-open")).toBeVisible();
      await page.evaluate(() => {
        const a = neuroMapApp;
        a.state.root.text = "Save";
        a.state.root.notes = "Close — مشروع 中文";
        a.saveActiveTabSnapshot();
        if (!a.persistWorkspace()) throw Error("Recovery write failed");
      });
      await page.locator("#nm74-launch").click();
      await expect(page.locator("#glauka-android-language")).toBeVisible();
      await expect(page.locator("#glauka-android-language")).toHaveValue(
        language.code,
      );
      await page.reload();
      await page.waitForFunction(
        () =>
          window.neuroMapApp &&
          document.documentElement.hasAttribute("data-glauka-ready"),
      );
      await expect(page.locator("html")).toHaveAttribute("lang", language.code);
      expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
        "Save",
      );
      expect(await page.evaluate(() => neuroMapApp.state.root.notes)).toBe(
        "Close — مشروع 中文",
      );
      expect(errors).toEqual([]);
    },
  );
}
test("Android first launch follows device language before creating default map and loads only offline catalogs", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 393, height: 852 },
  });
  try {
    const page = await context.newPage();
    const external = [];
    page.on("request", (r) => {
      if (
        !r.url().startsWith("http://127.0.0.1:5178") &&
        !r.url().startsWith("data:")
      )
        external.push(r.url());
    });
    await boot(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
      "中心主题",
    );
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});
test("Android native language preference takes precedence and failed saves keep the previous language", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.NMAndroid = {
      getInterfaceLocale: () => "de",
      setInterfaceLocale: () => false,
    };
    localStorage.setItem("nm6_locale", "es");
  });
  await boot(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.locator("#glauka-welcome-language").selectOption("ar");
  await expect(page.locator("#glauka-welcome-language")).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("#glauka-welcome-language")).toHaveValue("de");
});

test("Android tool sections translate through every language without changing the project", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await boot(page);
  await page.evaluate(() => {
    neuroMapApp.state.root.text = "Save";
    neuroMapApp.state.root.notes = "Close";
  });
  await page.locator("#nm74-launch").click();
  const sections = await page
    .locator(".nm74-tab")
    .evaluateAll((items) => items.map((x) => x.dataset.section));
  expect(sections.length).toBeGreaterThan(10);
  for (const language of languages) {
    await page.evaluate((code) => GlaukaI18n.setLanguage(code), language.code);
    for (const section of sections) {
      await chooseTool(page,'.nm74-tab[data-section="' + section + '"]');
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const issues = await page.locator("#nm74-overlay").evaluate((root) => {
        const issues = [],
          walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
          const n = walk.currentNode,
            p = n.parentElement;
          if (
            !p ||
            p.closest(
              "script,style,textarea,svg,input,select,[contenteditable],[data-glauka-user-content],.nm-kn-text,.nm-kn-name,.nm-kn-authored,.nm75-preview,.nm-di-preview,code,pre",
            ) ||
            !p.getClientRects().length
          )
            continue;
          const expected = GlaukaI18n.translate(n.nodeValue);
          if (expected !== n.nodeValue)
            issues.push([n.nodeValue.trim(), expected.trim()]);
        }
        return issues;
      });
      expect(issues, language.code + " / " + section).toEqual([]);
    }
  }
  expect(
    await page.evaluate(() => [
      neuroMapApp.state.root.text,
      neuroMapApp.state.root.notes,
    ]),
  ).toEqual(["Save", "Close"]);
});
