/* Capture real product controls. AI output uses a declared local fixture, never a live provider. */
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
(async () => {
  const out = path.resolve(
    __dirname,
    "../../apps/website/home-review/assets/features",
  );
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const proof = {
    source:
      "Real desktop editor; illustrative documents; AI text supplied by local fixture, no provider call",
    captures: {},
  };
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
      locale: "it-IT",
    });
    await page.route("**/*", (r) =>
      r.request().url().startsWith("http://127.0.0.1:5174/")
        ? r.continue()
        : r.abort(),
    );
    await page.addInitScript(() =>
      localStorage.setItem("nm6_welcome_seen", "1"),
    );
    await page.goto("http://127.0.0.1:5174/index.html");
    await page.waitForFunction(
      () => window.neuroMapApp?.aiClient && window.NeuroMapUISkin,
    );
    await page.evaluate(() => {
      const app = neuroMapApp;
      app.importHierarchy(
        {
          text: "Preparare un esame",
          children: [
            {
              text: "Ripasso attivo",
              notes:
                "Provare a ricordare un concetto prima di rileggere la risposta.",
              children: [],
            },
            {
              text: "Gli argomenti",
              children: [
                { text: "Concetti chiave", children: [] },
                { text: "Dubbi da chiarire", children: [] },
              ],
            },
            {
              text: "Il materiale",
              children: [
                { text: "Appunti", children: [] },
                { text: "Fonti", children: [] },
              ],
            },
            {
              text: "La verifica",
              children: [
                { text: "Domande", children: [] },
                { text: "Spiegare a parole mie", children: [] },
              ],
            },
            {
              text: "Il ripasso",
              children: [
                { text: "Sessioni brevi", children: [] },
                { text: "Punti da rivedere", children: [] },
              ],
            },
            {
              text: "Il traguardo",
              children: [
                { text: "Il prossimo passo", children: [] },
                { text: "Cosa so già", children: [] },
              ],
            },
          ],
        },
        { newTab: true },
      );
      NM615.setTheme("white");
      NeuroMapUISkin.set({ theme: "minimal" });
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden"));
      document.getElementById("nm-mode-balanced").click();
      app.recalculateAndRender();
      app.fitToScreen();
    });
    if (await page.locator("#nm616-map-close").isVisible())
      await page.locator("#nm616-map-close").click();
    await page.waitForTimeout(3300);
    async function save(name, locator) {
      const file = path.join(out, name + ".png");
      await (locator || page).screenshot({ path: file });
      proof.captures[name] = {
        sha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(file))
          .digest("hex"),
      };
    }
    await page.evaluate(async () => {
      const a = neuroMapApp;
      a.selectNode(a.state.root.children[0].id);
      window.nmProduct.guard = () => true;
      a.aiClient.chat = async () =>
        JSON.stringify({
          "DEFINIZIONE TECNICA":
            "Il richiamo attivo consiste nel recuperare un’informazione dalla memoria prima di consultare nuovamente il materiale.",
          "SPIEGAZIONE SEMPLICE":
            "Chiudi gli appunti e prova a spiegare il concetto a parole tue. Poi controlla cosa manca.",
          "ESEMPIO PRATICO":
            "Leggi la domanda su una flashcard, formula la risposta e soltanto dopo gira la carta.",
        });
      await a.aiExplainNode();
    });
    await page.waitForTimeout(200);
    await save("ai-explain");
    console.log(
      "explanation",
      await page.locator("#ai-explain-panel").isVisible(),
    );
    await page
      .locator("#ai-explain-panel")
      .evaluate((e) => e.classList.add("hidden"));
    await page.evaluate(() => {
      const a = neuroMapApp,
        n = a.state.root.children[0];
      a.studyCards = [
        {
          id: "website-card",
          sourceTabId: a.activeTabId,
          sourceNodeId: n.id,
          sourceSignature: a.v5Signature(n),
          question: "Che cosa significa ripasso attivo?",
          answer:
            "Provare a ricordare il concetto prima di rileggere la risposta.",
          sr: { dueAt: 0, intervalDays: 0, reviews: 0, lapses: 0 },
        },
      ];
      a.openFlashcards();
    });
    await page.waitForTimeout(200);
    console.log("flash", await page.locator("#flash-modal").isVisible());
    await save("flashcards");
    await page.evaluate(() => neuroMapApp.closeFlashcards());
    await page.locator("#nm-learn-open").click();
    await page
      .locator("#nm-learn-panel")
      .getByRole("button", { name: "Esame", exact: true })
      .click();
    await page.locator("#nm-learn-panel input[type=date]").fill("2026-12-15");
    await page.locator("#nm-learn-panel input[type=number]").fill("30");
    await page
      .locator("#nm-learn-panel")
      .getByRole("button", { name: "Aggiorna anteprima", exact: true })
      .click();
    await save("exam");
    await save("exam-panel", page.locator("#nm-learn-panel"));
    await page.locator("#nm-learn-panel").evaluate((e) => (e.hidden = true));
    for (const preset of ["classic", "organic"]) {
      await page.evaluate((id) => {
        const a = neuroMapApp,
          p = NeuroMapMapStyleCore.PRESETS.find((x) => x.id === id);
        NeuroMapMapStyleCore.apply(
          a.state,
          p,
          "map",
          window.NeuroMapEditorPalettes,
        );
        a.recalculateAndRender();
        a.fitToScreen();
        a.requestRender();
      }, preset);
      await page.waitForTimeout(250);
      await save("style-" + preset);
    }
    fs.writeFileSync(
      path.join(out, "provenance.json"),
      JSON.stringify(proof, null, 2) + "\n",
    );
    console.log("Feature captures ready.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
