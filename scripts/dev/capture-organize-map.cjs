/* Real app screenshots for the website’s study/work/ideas selector. Editor preview required on :5174. */
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
const scenarios = { organize: {text:"Un’idea che prende forma",groups:[
["L’idea", "Un progetto di energia pulita", "A chi può essere utile"],
["Le ricerche", "Sole, materiali e risorse", "Appunti e riferimenti"],
["Le persone", "Condividere una proposta", "Raccogliere suggerimenti"],
["I numeri", "Energia = potenza × tempo", "Confrontare le alternative"],
["Il progetto", "Disegnare un prototipo", "Provare e migliorare"],
["Il prossimo passo", "Fissare una scadenza", "Presentare il risultato"]]}};
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
      const proof = await page.evaluate(async (data) => {
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
        NM615.setTheme("white");
        const core=NeuroMapCreativeCore;
        app.state.root.objectArt=core.objectArt({id:'flat-idea',size:128});
        const icons=['flat-idea','flat-binoculars','flat-graduation-cap','flat-calculator','flat-folder','flat-calendar'];
        app.state.root.children.forEach((n,i)=>n.illustration={name:icons[i],svg:core.objectSVG(icons[i])});
        const formula=await NeuroMapCreativeModules.formulas.formulaSVG('E = P \\times t','#6542b7');
        // An attached formula is actual document content, not an overlay painted on the capture.
        const n=app.state.root.children[3].children[0];
        app.state.addImageItem({src:NeuroMapCreativeModules.ui.data(formula.svg),width:120,height:42,naturalWidth:formula.w,naturalHeight:formula.h,mode:'attached',attachedNodeId:n.id,graphic:{kind:'formula',tex:'E = P \\times t',color:'#6542b7'},frame:'none',borderRadius:0});
        NeuroMapUISkin.set({ theme: "minimal" });
        document.documentElement.style.setProperty("--bg-canvas", "#fff");
        document.body.style.backgroundColor = "#fff";
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden"));
        document.getElementById("nm-mode-balanced").click();
        app.state.selectedImageId=null;
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
      path.join(dest, "organize-provenance.json"),
      JSON.stringify(
        {
          source: "Real desktop editor, illustrative documents; no user files",
          scenarios: results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Captured illustrated map from actual light editor.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
