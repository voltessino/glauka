/* Capture the real desktop editor in its light appearance for website prototypes.
 * Start first: XDG_CACHE_HOME=/workspace/.neuromap-cache python3 scripts/dev/serve.py macos --port 5174
 */
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
const createProject = require("./website-demo-project.cjs");
(async () => {
  const dest = path.resolve(
    __dirname,
    "../../apps/website/prototypes-light/assets",
  );
  fs.mkdirSync(dest, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
    });
    await page.addInitScript(() =>
      localStorage.setItem("nm6_welcome_seen", "1"),
    );
    await page.goto("http://127.0.0.1:5174/index.html");
    await page.waitForFunction(
      () =>
        window.neuroMapApp?.renderer && window.NeuroMapUISkin && window.NM615,
    );
    const proof = await page.evaluate((project) => {
      neuroMapApp.importHierarchy(project, { newTab: true });
      NM615.setTheme("paper");
      NeuroMapUISkin.set({ theme: "minimal" });
      // White canvas requested for the website shot; geometry and node styling stay with the real renderer.
      document.documentElement.style.setProperty("--bg-canvas", "#ffffff");
      document.body.style.backgroundColor = "#ffffff";
      document
        .querySelectorAll(".nm6-shade")
        .forEach((x) => x.classList.add("hidden"));
      document.getElementById("nm-mode-balanced").click();
      neuroMapApp.recalculateAndRender();
      neuroMapApp.fitToScreen();
      neuroMapApp.requestRender();
      return {
        source:
          "Real desktop editor with illustrative project; no personal document",
        nodes: neuroMapApp.state.getAllNodesIncludingCollapsed().length,
        root: neuroMapApp.state.root.text,
        background: "#ffffff",
        interfaceSkin: "minimal",
        layoutMode: neuroMapApp.state.root.layoutMode,
        sides: neuroMapApp.state.root.children.map((n) => ({
          side: n.side,
          x: neuroMapApp.layout.getLayout(n.id).x,
        })),
        map: neuroMapApp.state.root,
      };
    }, createProject());
    const close = page.locator("#nm616-map-close");
    if (await close.isVisible()) await close.click();
    await page.waitForTimeout(3400);
    const target = path.join(dest, "app-white.png");
    await page.screenshot({ path: target });
    proof.sha256 = crypto
      .createHash("sha256")
      .update(fs.readFileSync(target))
      .digest("hex");
    fs.writeFileSync(
      path.join(dest, "capture-provenance.json"),
      JSON.stringify(proof, null, 2) + "\n",
    );
    process.stdout.write(
      JSON.stringify({
        root: proof.root,
        nodes: proof.nodes,
        interface: proof.interfaceSkin,
        background: proof.background,
      }) + "\n",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  process.stderr.write(e.stack + "\n");
  process.exitCode = 1;
});
