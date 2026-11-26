/* Capture real editor screens for the guide. Demo map only. No personal data and no AI provider. */
"use strict";
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const root = path.resolve(__dirname, "../..");
const out = path.join(root, "apps/website/home-review/assets/wiki");
const only = new Set(process.argv.slice(2).filter((name) => name.endsWith(".png")));
function wanted(name) {
  return !only.size || only.has(name);
}
const demo = {
  text: "Una pianta in classe",
  children: [
    { text: "Radici", notes: "Assorbono acqua e tengono la pianta ferma.", children: [
      { text: "Acqua", children: [] },
      { text: "Sali minerali", children: [] }
    ]},
    { text: "Fusto", children: [
      { text: "Sostegno", children: [] },
      { text: "Trasporto", children: [] }
    ]},
    { text: "Foglie", children: [
      { text: "Luce", children: [] },
      { text: "Aria", children: [] }
    ]},
    { text: "Fiore", children: [
      { text: "Semi", children: [] }
    ]}
  ]
};

function waitFor(url, child) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (child.exitCode != null) {
        reject(new Error("server exited " + child.exitCode));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - started > 180000) reject(new Error("timeout " + url));
      else setTimeout(tick, 500);
    };
    tick();
  });
}

function startServer(platform, port) {
  const child = spawn("py", ["-3", "scripts/dev/serve.py", platform, "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function shot(page, name, options = {}) {
  if (!wanted(name)) return;
  const file = path.join(out, name);
  if (options.locator) await options.locator.screenshot({ path: file, animations: "disabled" });
  else await page.screenshot({ path: file, animations: "disabled", clip: options.clip });
  const size = fs.statSync(file).size;
  if (size < 8000) throw new Error(name + " looks empty (" + size + " bytes)");
  console.log("saved", name, size);
}

async function show(page, mode) {
  await page.evaluate((next) => {
    const app = window.neuroMapApp;
    window.NeuroMapLinkedViews.setMode(app, next);
    app.fitToScreen?.();
  }, mode);
  await page.waitForTimeout(450);
}

async function closeFloaters(page) {
  await page.evaluate(() => {
    document.getElementById("nm67-notes-close")?.click();
    document.getElementById("nm67-notes-overlay")?.classList.add("hidden");
    document.getElementById("nm-learn-close")?.click();
    const learn = document.getElementById("nm-learn-panel");
    if (learn) learn.hidden = true;
    const ai = document.getElementById("nm-ai-studio");
    if (ai) { ai.hidden = true; ai.classList.add("hidden"); ai.style.display = "none"; }
    document.getElementById("flash-modal")?.classList.add("hidden");
    document.querySelector("#nm-map-share")?.setAttribute("hidden", "");
    document.querySelectorAll(".nm-export-shade, #nm-decision-overlay").forEach((el) => el.classList.add("hidden"));
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

async function clickId(page, id) {
  return page.evaluate((target) => {
    const el = document.getElementById(target);
    if (!el) return false;
    el.click();
    return true;
  }, id);
}

async function prepareDesktop(page) {
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm_ui_skin_v1", JSON.stringify({ theme: "prisma", contrast: "normal", readability: "standard" }));
  });
  await page.goto("http://127.0.0.1:5174/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.neuroMapApp && window.NeuroMapLinkedViews && window.NeuroMapUISkin);
  await page.evaluate((tree) => {
    const app = window.neuroMapApp;
    document.getElementById("glauka-startup")?.remove();
    window.NeuroMapUISkin?.apply?.({ theme: "prisma", contrast: "normal", readability: "standard" });
    app.importHierarchy(tree);
    const first = app.state.root.children[0];
    const second = app.state.root.children[1];
    if (first && second) app.state.addRelationship(first.id, second.id, "nutre");
    app.fitToScreen?.();
  }, demo);
  await page.waitForTimeout(400);
}

async function captureFocusShots(page) {
  await closeFloaters(page);
  const openedAi = await page.evaluate(() => {
    document.getElementById("nm67-notes-overlay")?.classList.add("hidden");
    const learn = document.getElementById("nm-learn-panel");
    if (learn) learn.hidden = true;
    const panel = document.getElementById("nm-ai-studio");
    if (!panel) return false;
    panel.hidden = false;
    panel.classList.remove("hidden");
    panel.style.display = "flex";
    return true;
  });
  if (!openedAi) throw new Error("AI Studio panel was not found");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("nm-ai-task-listen")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(150);
  await shot(page, "ai-studio.png", { locator: page.locator("#nm-ai-studio") });
  if (wanted("listen.png")) {
    if (!(await clickId(page, "nm-ai-task-listen"))) throw new Error("Listen task was not found");
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const field = document.getElementById("nm-ai-listen-script");
      if (field) {
        field.value = "Le radici assorbono acqua e tengono la pianta ferma.";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const online = [...document.querySelectorAll(".nm-ai-listen-mode")].find((el) => (el.innerText || "").includes("Online"));
      online?.click();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const button = document.getElementById("nm-ai-listen-elaborate");
      let scroller = button?.parentElement;
      while (scroller && scroller.scrollHeight <= scroller.clientHeight + 4) scroller = scroller.parentElement;
      if (button && scroller) {
        const top = button.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTop = Math.max(0, top - 80);
      }
    });
    await page.waitForTimeout(200);
    const box = await page.locator("#nm-ai-studio").boundingBox();
    if (!box) throw new Error("Listen panel was not visible");
    await shot(page, "listen.png", {
      clip: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      }
    });
  }
  if (!wanted("suggest.png")) return;
  await closeFloaters(page);
  await page.evaluate(() => {
    const app = window.neuroMapApp;
    const node = app.state.root;
    app.selectNode?.(node.id, "single");
    app.fitToScreen?.();
    app.editSelected?.("");
  });
  const input = page.locator("#inline-editor-input");
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill("cuore");
  await input.dispatchEvent("input");
  await page.waitForSelector("#nm-inline-smart-suggest:not([hidden])", { timeout: 8000 });
  await page.waitForTimeout(250);
  await shot(page, "suggest.png");
}

async function captureDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 }, deviceScaleFactor: 1, locale: "it-IT" });
  await page.route("**/*", (route) => route.request().url().startsWith("http://127.0.0.1:5174/") ? route.continue() : route.abort());
  await prepareDesktop(page);
  const focusOnly = only.size > 0 && [...only].every((name) => ["ai-studio.png", "listen.png", "suggest.png"].includes(name));
  if (focusOnly) {
    await captureFocusShots(page);
    await page.close();
    return;
  }
  await shot(page, "workspace.png");
  const views = [
    ["orgchart", "view-org.png"],
    ["concept-tree", "view-tree.png"],
    ["concept-network", "view-network.png"],
    ["flowchart", "view-flow.png"],
    ["kanban", "view-kanban.png"],
    ["timeline", "view-timeline.png"]
  ];
  for (const [mode, name] of views) {
    await closeFloaters(page);
    await show(page, mode);
    await shot(page, name);
  }
  await closeFloaters(page);
  await show(page, "mindmap");
  if (!(await clickId(page, "v6-show-layout"))) throw new Error("Arrangement panel was not found");
  await page.evaluate(() => {
    const hud = document.querySelector(".hud-bottom-left");
    hud?.classList.remove("hidden", "collapsed");
  });
  await page.waitForTimeout(500);
  await shot(page, "layout.png");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const app = window.neuroMapApp;
    app.clearSelection?.();
    if (app.state?.root?.id) app.selectNode?.(app.state.root.id, "single");
    const sb = document.getElementById("inspector-sidebar");
    sb?.classList.remove("collapsed");
    sb?.querySelector('.hud-collapse-toggle[aria-expanded="false"]')?.click();
  });
  await page.waitForTimeout(350);
  await shot(page, "appearance.png");
  await closeFloaters(page);
  await page.evaluate(() => {
    const app = window.neuroMapApp;
    const node = app.state.root.children[0];
    app.selectNode?.(node.id, "single");
    document.getElementById("nm67-notes-context")?.click();
  });
  await page.waitForTimeout(250);
  await shot(page, "notes.png");
  await closeFloaters(page);
  if (!(await clickId(page, "nm-tool-studio-panel"))) {
    await page.evaluate(() => {
      const panel = document.getElementById("nm-learn-panel");
      if (panel) panel.hidden = false;
    });
  }
  await page.waitForTimeout(300);
  await shot(page, "study.png");
  await closeFloaters(page);
  if (!(await clickId(page, "btn-flashcards"))) throw new Error("Flashcards button was not found");
  await page.waitForTimeout(400);
  await shot(page, "flashcards.png");
  await page.evaluate(() => {
    const modal = document.getElementById("flash-modal");
    const tools = modal?.querySelector("details") || document.getElementById("glauka-study-tools");
    if (tools) tools.open = true;
    document.getElementById("glauka-flash-google-ai")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(200);
  await shot(page, "google-ai.png");
  await captureFocusShots(page);
  await closeFloaters(page);
  if (!(await clickId(page, "nm-ocr-launch"))) throw new Error("OCR command was not found");
  await page.waitForTimeout(400);
  await shot(page, "ocr.png");
  await closeFloaters(page);
  if (!(await clickId(page, "nm-map-share-open"))) throw new Error("Share window was not found");
  await page.waitForTimeout(400);
  await shot(page, "share.png");
  await page.evaluate(() => {
    document.querySelector("#nm-map-share .nm-share-close")?.click();
    document.getElementById("nm-map-share")?.setAttribute("hidden", "");
  });
  await closeFloaters(page);
  await page.evaluate(() => {
    const app = window.neuroMapApp;
    app.createNewTab?.();
    app.importHierarchy?.({ text: "Biologia cellulare", children: [{ text: "Membrana", children: [] }, { text: "Nucleo", children: [] }] });
    app.fitToScreen?.();
  });
  await page.waitForTimeout(350);
  await shot(page, "tabs.png");
  await page.close();
}

async function captureAndroid(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "it-IT", isMobile: true, hasTouch: true });
  await page.route("**/*", (route) => route.request().url().startsWith("http://127.0.0.1:5173/") ? route.continue() : route.abort());
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await page.goto("http://127.0.0.1:5173/app/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.neuroMapApp);
  await page.evaluate((tree) => {
    document.getElementById("glauka-startup")?.remove();
    const app = window.neuroMapApp;
    app.importHierarchy(tree);
    app.fitToScreen?.();
  }, demo);
  await page.waitForTimeout(500);
  await shot(page, "android.png");
  await page.close();
}

function compress() {
  const script = path.join(root, "scripts/dev/_wiki_compress.py");
  fs.writeFileSync(script, [
    "from pathlib import Path",
    "from PIL import Image",
    "folder = Path(" + JSON.stringify(out) + ")",
    "total = 0",
    "names = " + JSON.stringify(only.size ? [...only] : []) ,
    "paths = [folder / name for name in names] if names else list(folder.glob('*.png'))",
    "for path in paths:",
    "    image = Image.open(path).convert('RGB')",
    "    limit = 720 if path.name == 'android.png' else 1200",
    "    if image.width > limit:",
    "        height = round(image.height * limit / image.width)",
    "        image = image.resize((limit, height), Image.Resampling.LANCZOS)",
    "    image = image.quantize(colors=64, method=Image.Quantize.FASTOCTREE)",
    "    image.save(path, optimize=True)",
    "    total += path.stat().st_size",
    "print('WIKI_BYTES', total)",
    ""
  ].join("\n"));
  return new Promise((resolve, reject) => {
    const child = spawn("py", ["-3", script], { cwd: root, stdio: "inherit", windowsHide: true });
    child.on("exit", (code) => {
      fs.rmSync(script, { force: true });
      code === 0 ? resolve() : reject(new Error("compress " + code));
    });
  });
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const needPhone = wanted("android.png");
  const desktop = startServer("macos", 5174);
  const phone = needPhone ? startServer("android", 5173) : null;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"]
  });
  try {
    await waitFor("http://127.0.0.1:5174/index.html", desktop);
    await captureDesktop(browser);
    if (needPhone) {
      await waitFor("http://127.0.0.1:5173/app/index.html", phone);
      await captureAndroid(browser);
    }
    await compress();
  } finally {
    await browser.close();
    desktop.kill();
    if (phone) phone.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
