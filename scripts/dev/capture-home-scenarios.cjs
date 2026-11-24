/* Real app screenshots for the website’s study/work/ideas selector. Editor preview required on :5174. */
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
const scenarios = {
  study: {
    text: "Preparare un esame",
    groups: [
      ["Gli argomenti", "Concetti chiave", "Dubbi da chiarire"],
      ["Il materiale", "Appunti", "Fonti"],
      ["I collegamenti", "Cause ed effetti", "Confronti"],
      ["La verifica", "Domande", "Spiegare a parole mie"],
      ["Il ripasso", "Punti da rivedere", "Sessioni brevi"],
      ["Il traguardo", "Cosa so già", "Il prossimo passo"],
    ],
  },
  work: {
    text: "Dall’idea al progetto",
    groups: [
      ["L’obiettivo", "Il risultato", "A chi serve"],
      ["Le persone", "I riferimenti", "Con chi confrontarmi"],
      ["Le risorse", "Appunti", "Materiali utili"],
      ["Le attività", "Le priorità", "Il primo passo"],
      ["La verifica", "Cosa funziona", "Cosa migliorare"],
      ["La consegna", "Cosa preparare", "Condividere il risultato"],
    ],
  },
  ideas: {
    text: "Un’idea da sviluppare",
    groups: [
      ["Gli spunti", "Un’intuizione", "Una domanda"],
      ["I riferimenti", "Esempi", "Ispirazioni"],
      ["I collegamenti", "Un tema comune", "Le relazioni"],
      ["Le possibilità", "Un’alternativa", "Un altro punto di vista"],
      ["La prova", "Cosa verificare", "Un piccolo esperimento"],
      ["Il prossimo passo", "Scegliere una direzione", "Fare una prima bozza"],
    ],
  },
};
(async () => {
  const dest = path.resolve(__dirname, "../../apps/website/home-review/assets");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    fs.mkdirSync(dest, { recursive: true });
    const results = {};
    for (const [key, s] of Object.entries(scenarios)) {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: 2,
      });
      await page.addInitScript(() =>
        localStorage.setItem("nm6_welcome_seen", "1"),
      );
      await page.goto("http://127.0.0.1:5174/index.html");
      await page.waitForFunction(
        () => window.neuroMapApp?.renderer && window.NeuroMapUISkin,
      );
      const proof = await page.evaluate((data) => {
        const app = neuroMapApp;
        app.importHierarchy(
          {
            text: data.text,
            children: data.groups.map(([text, ...items]) => ({
              text,
              children: items.map((text) => ({ text, children: [] })),
            })),
          },
          { newTab: true },
        );
        NM615.setTheme("paper");
        NeuroMapUISkin.set({ theme: "minimal" });
        document.documentElement.style.setProperty("--bg-canvas", "#fff");
        document.body.style.backgroundColor = "#fff";
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        document.getElementById("nm-mode-balanced").click();
        app.recalculateAndRender();
        app.fitToScreen();
        return {
          root: app.state.root.text,
          nodes: app.state.getAllNodesIncludingCollapsed().length,
          layout: app.state.root.layoutMode,
          sides: app.state.root.children.map((n) => n.side),
          skin: "minimal",
          background: "#ffffff",
        };
      }, s);
      const close = page.locator("#nm616-map-close");
      if (await close.isVisible()) await close.click();
      await page.waitForTimeout(3300);
      const file = path.join(dest, key + ".png");
      await page.screenshot({ path: file });
      proof.sha256 = crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
      results[key] = proof;
      await page.close();
    }
    fs.writeFileSync(
      path.join(dest, "provenance.json"),
      JSON.stringify(
        {
          source: "Real desktop editor, illustrative documents; no user files",
          scenarios: results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Captured study/work/ideas from actual light editor.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
