const { test, expect } = require("@playwright/test");
for (const platform of ["desktop", "android"]) {
  test(
    platform +
      ": explanation JSON becomes readable sections and saves formatted notes with Undo",
    async ({ page }, info) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(() => window.neuroMapApp?.aiClient);
      await page.evaluate(async () => {
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        const a = neuroMapApp;
        a.importHierarchy(
          { text: "Ghiandole sebacee", children: [] },
          { newTab: true },
        );
        a.state.root.notes = "Appunti originali";
        window.nmProduct.guard = () => true;
        a.aiClient.chat = async () =>
          "```json\n" +
          JSON.stringify({
            ETIMOLOGIA: "Dal latino sebum.",
            "DEFINIZIONE TECNICA": "Ghiandole esocrine.",
            "SPIEGAZIONE SEMPLICE": "Producono sebo.",
            "ESEMPIO PRATICO": "Il cuoio capelluto.",
          }) +
          "\n```";
        await a.aiExplainNode();
      });
      await expect(page.locator("#ai-explain-text h3")).toHaveCount(4);
      await expect(page.locator("#ai-explain-text")).toContainText(
        "Producono sebo.",
      );
      expect(await page.locator("#ai-explain-text").innerText()).not.toContain(
        "{",
      );
      if (platform === "desktop") {
        const geometry = await page.evaluate(() => ({
          top: document
            .getElementById("ai-explain-panel")
            .getBoundingClientRect().top,
          chrome: document.querySelector(".top-chrome").getBoundingClientRect()
            .bottom,
        }));
        expect(geometry.top).toBeGreaterThanOrEqual(geometry.chrome);
      }
      await page.screenshot({ path: info.outputPath("explanation.png") });
      await page.locator("#ai-explain-save").dispatchEvent("click");
      if (platform === "desktop") await page.locator("#nm-ai-apply").click();
      expect(await page.evaluate(() => neuroMapApp.state.root.notes)).toContain(
        "## Spiegazione semplice",
      );
      expect(await page.evaluate(() => neuroMapApp.state.root.notes)).toContain(
        "Appunti originali",
      );
      await page.evaluate(() => neuroMapApp.undo());
      expect(await page.evaluate(() => neuroMapApp.state.root.notes)).toBe(
        "Appunti originali",
      );
    },
  );
  test(
    platform +
      ": malformed explanation asks for retry without offering broken JSON as notes",
    async ({ page }) => {
      await page.goto(
        platform === "desktop"
          ? "http://127.0.0.1:5174/index.html"
          : "http://127.0.0.1:5173/app/index.html",
      );
      await page.waitForFunction(() => window.neuroMapApp?.aiClient);
      await page.evaluate(async () => {
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        const a = neuroMapApp;
        window.nmProduct.guard = () => true;
        a.aiClient.chat = async () => '```json\n{"ETIMOLOGIA":"tagliata';
        await a.aiExplainNode();
      });
      await expect(page.locator("#ai-explain-text")).toContainText("Riprova");
      expect(await page.evaluate(() => neuroMapApp._aiExplanation)).toBe("");
    },
  );
}
