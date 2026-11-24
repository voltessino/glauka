const { test, expect } = require("@playwright/test");
for (const target of ["desktop", "android"])
  test.describe(target + " export studio", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(
        target === "android"
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
      );
      await page.goto(
        target === "android"
          ? "http://127.0.0.1:5173/app/index.html"
          : "http://127.0.0.1:5174/index.html",
      );
      await page.waitForFunction(() => !!window.neuroMapApp?._nmExportHub);
      await page.evaluate(() =>
        document
          .querySelectorAll(".nm6-shade")
          .forEach((n) => n.classList.add("hidden")),
      );
    });
    async function seed(page) {
      await page.evaluate(() => {
        const app = window.neuroMapApp;
        for (const title of ["Ghiandole α", "Capillari β", "Midollo γ"])
          app.importHierarchy(
            {
              text: title,
              children: [
                { text: "Sotto-ramo", notes: "Nota importante", children: [] },
              ],
            },
            { newTab: true },
          );
        app.saveActiveTabSnapshot();
      });
    }
    test("one compact export command, three scopes and responsive modal", async ({
      page,
    }) => {
      await seed(page);
      const entry = page.locator("#nm-export-launch");
      await expect(entry).toHaveCount(1);
      await page.evaluate(() => neuroMapApp._nmExportHub.open());
      const dialog = page.locator(".nm-export-dialog");
      await expect(dialog).toBeVisible();
      const scopes = dialog.locator("button[aria-pressed]");
      await expect(scopes).toHaveCount(5);
      await expect(dialog.locator(".nm-export-tabs")).toBeHidden();
      await dialog
        .locator("button")
        .filter({ hasText: /Selezionate|Selected/ })
        .click();
      await expect(dialog.locator(".nm-export-tabs")).toBeVisible();
      await expect(dialog.locator(".nm-export-tab")).toHaveCount(
        await page.evaluate(() => neuroMapApp.tabs.length),
      );
      await dialog
        .locator("button")
        .filter({ hasText: /Tutte|All/ })
        .click();
      await expect(dialog.locator(".nm-export-tabs")).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    });
    test("selected maps export in source order, without editing the workspace", async ({
      page,
    }) => {
      await seed(page);
      await page.evaluate(() => {
        window.qaHubDownloads = [];
        const a = neuroMapApp;
        a.io.triggerDownload = (blob, name) => {
          window.qaHubDownloads.push({ blob, name });
          return true;
        };
        a._nmExportHub.open();
      });
      await page
        .locator(".nm-export-segments [aria-pressed]")
        .filter({ hasText: /Selezionate|Selected/ })
        .first()
        .click();
      const boxes = page.locator(".nm-export-tab input");
      for (let i = 0; i < (await boxes.count()); i++)
        await boxes.nth(i).uncheck();
      await boxes.nth(0).check();
      await boxes.nth(2).check();
      await page.locator("#nm-export-format").selectOption("md");
      const before = await page.evaluate(() =>
        JSON.stringify(neuroMapApp.tabs.map((t) => t.state.root)),
      );
      await page.locator(".nm-export-run").click();
      await expect(page.locator(".nm-export-shade")).toBeHidden();
      const result = await page.evaluate(async () => ({
        name: qaHubDownloads[0]?.name,
        text: await qaHubDownloads[0]?.blob.text(),
        workspace: JSON.stringify(neuroMapApp.tabs.map((t) => t.state.root)),
      }));
      expect(result.name).toMatch(/\.md$/);
      const count = (
        result.text.match(/<!-- NeuroMap-Markdown-v[12] -->/g) || []
      ).length;
      expect(count).toBe(2);
      expect(result.workspace).toBe(before);
    });
    test("all tabs as ZIP and form factor contrast", async ({ page }) => {
      await seed(page);
      await page.evaluate(() => {
        window.qaHubDownloads = [];
        neuroMapApp.io.triggerDownload = (blob, name) => {
          qaHubDownloads.push({ blob, name });
          return true;
        };
        neuroMapApp._nmExportHub.open();
      });
      await page
        .locator(".nm-export-dialog .nm-export-segments button")
        .filter({ hasText: /Tutte|All/ })
        .first()
        .click();
      await page.locator("#nm-export-format").selectOption("docx");
      await page.locator(".nm-export-two button").nth(1).click();
      await page.locator(".nm-export-run").click();
      await page.waitForFunction(() => qaHubDownloads.length === 1);
      const header = await page.evaluate(async () => {
        const d = qaHubDownloads[0],
          u = new Uint8Array(await d.blob.arrayBuffer());
        return {
          name: d.name,
          signature: Array.from(u.slice(0, 4)),
          count: neuroMapApp.tabs.length,
        };
      });
      expect(header.name).toMatch(/\.zip$/);
      expect(header.signature).toEqual([80, 75, 3, 4]);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.evaluate(() => neuroMapApp._nmExportHub.open());
      const rect = await page.locator(".nm-export-dialog").boundingBox();
      expect(rect.width).toBeLessThanOrEqual(360);
      expect(rect.x).toBeGreaterThanOrEqual(0);
    });
    test("OPML and batch TXT reopen as independent tabs in original order", async ({
      page,
    }) => {
      await seed(page);
      const result = await page.evaluate(async () => {
        const a = neuroMapApp,
          X = window.NeuroMapExportCore,
          chosen = a.tabs.slice(-2),
          start = a.tabs.length;
        const names = chosen.map((t) => t.state.root.text);
        const xml = X.render(chosen, "opml");
        await a.importFile(
          new File([xml.data], "qa-multiple.opml", { type: "text/x-opml" }),
          { newTab: true },
        );
        const opml = a.tabs.slice(start).map((t) => t.state.root.text);
        const intermediate = a.tabs.length,
          plain = X.render(chosen, "txt");
        await a.importFile(
          new File([plain.data], "qa-multiple.txt", { type: "text/plain" }),
          { newTab: true },
        );
        return {
          names,
          opml,
          txt: a.tabs.slice(intermediate).map((t) => t.state.root.text),
        };
      });
      expect(result.opml).toEqual(result.names);
      expect(result.txt).toEqual(result.names);
    });
    test("FreeMind map imports after export without losing node order", async ({
      page,
    }) => {
      await seed(page);
      const result = await page.evaluate(async () => {
        const a = neuroMapApp,
          X = window.NeuroMapExportCore,
          chosen = a.tabs.at(-1),
          start = a.tabs.length;
        const output = X.render([chosen], "mm");
        await a.importFile(
          new File([output.data], "qa-freemind.mm", {
            type: "application/xml",
          }),
          { newTab: true },
        );
        return {
          expected: chosen.state.root.children.map((n) => n.text),
          actual: a.tabs.at(-1).state.root.children.map((n) => n.text),
          delta: a.tabs.length - start,
        };
      });
      expect(result.delta).toBe(1);
      expect(result.actual).toEqual(result.expected);
    });
  });
for (const target of ["desktop", "android"])
  test(
    target +
      " native export preserves the normal save payload and cancelled downloads remain visible",
    async ({ page }) => {
      await page.goto(
        target === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(() => neuroMapApp?._nmExportHub);
      const expected = await page.evaluate(() => {
        const a = neuroMapApp;
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        a.importHierarchy(
          {
            text: "Persistenza",
            notes: "Note centrali",
            fontUnderline: true,
            children: [],
          },
          { newTab: true },
        );
        if (window.NeuroMapAdaptiveCore)
          a.learningPlans = NeuroMapAdaptiveCore.setPlan(
            [],
            { tabId: a.activeTabId, examDate: "2027-03-12", minutesPerDay: 40 },
            1700000000000,
          );
        window.qaJSON = null;
        a.io.triggerDownload = async (blob) => {
          qaJSON = await blob.text();
          return false;
        };
        a._nmExportHub.open();
        return a.io.buildSerializedProjectPayload();
      });
      await page.locator("#nm-export-format").selectOption("neuromap");
      await page.locator(".nm-export-run").click();
      await expect(page.locator(".nm-export-status")).toContainText(
        /annullato|cancelled/,
      );
      await expect(page.locator(".nm-export-shade")).toBeVisible();
      const actual = await page.evaluate(() => JSON.parse(qaJSON));
      delete actual.savedAt;
      delete expected.savedAt;
      expect(actual).toEqual(expected);
      await page.evaluate(() => {
        neuroMapApp.io.triggerDownload = async () => true;
      });
      await page.locator(".nm-export-run").click();
      await expect(page.locator(".nm-export-shade")).toBeHidden();
    },
  );
test("export labels follow language changes and SVG follows the displayed linked view", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(() => neuroMapApp?._nmExportHub);
  await page.evaluate(async () => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    const a = neuroMapApp;
    a.importHierarchy(
      { text: "Progetto", children: [{ text: "Attività", children: [] }] },
      { newTab: true },
    );
    NeuroMapLinkedViews.setMode(a, "orgchart");
    await GlaukaI18n.setLanguage("en");
    window.qaSVG = null;
    a.io.triggerDownload = async (blob, name) => {
      qaSVG = { text: await blob.text(), name };
      return true;
    };
    a._nmExportHub.open();
  });
  await expect(page.locator("#nm-export-title")).toHaveText(
    "Export your project",
  );
  await expect(page.locator(".nm-export-dialog")).toContainText("Which maps?");
  await page.locator("#nm-export-format").selectOption("svg");
  await page.locator(".nm-export-run").click();
  await expect
    .poll(() => page.evaluate(() => qaSVG?.name))
    .toMatch(/orgchart\.svg$/);
});
