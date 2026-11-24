/* Record Glauka Studio Reel (Option 2 · 30fps Studio 3D Stage Showcase).
 * Consistent bright White / Prisma light theme throughout across 5 real features:
 *   1. Bussola (`Segue` direct without dimming) & Spotlight fast search
 *   2. AI · Spiega & etimologia on zoomed node + save to node notes
 *   3. AI · Espandi / Completa ramo with editable AI Preview (1 Undo)
 *   4. Studio attivo · Flashcard & Spaced Repetition grading
 *   5. Libreria creativa SVG & Linked Views (Mind map, Org chart, Concept tree, Kanban)
 *
 * Usage: start `python scripts/dev/serve.py macos --port 5174` then run:
 *   node scripts/dev/record-studio-reel.cjs
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../..");
const MEDIA = path.join(ROOT, "apps/website/media");
const ORIGIN = new URL(process.env.GLAUKA_EDITOR_URL || "http://127.0.0.1:5174/index.html").origin;
const DRY_RUN = process.env.DRY_RUN === "1";
const FPS = 30;
const STAGE_W = 1600;
const STAGE_H = 1000;
const APP_W = 1440;
const APP_H = 854;

const CHAPTERS = [
  {
    id: "compass",
    start: 0,
    seconds: 10,
    tag: "01 / 05 · BUSSOLA & SPOTLIGHT",
    it: "Bussola e ricerca rapida",
    en: "Compass & Spotlight search",
    subIt: "Scorri i rami con Segue senza oscurare la mappa e salta su qualsiasi concetto",
    subEn: "Step across branches with Next keeping every branch bright, and jump anywhere with Spotlight"
  },
  {
    id: "explain",
    start: 10,
    seconds: 10,
    tag: "02 / 05 · AI · SPIEGA & ETIMOLOGIA",
    it: "Spiega ed etimologia AI sul nodo",
    en: "AI Explain & etymology",
    subIt: "Zooma sul concetto, chiedi etimologia ed esempio pratico e salva nelle note",
    subEn: "Zoom onto a node, ask for etymology and a practical example, and save to notes"
  },
  {
    id: "expand",
    start: 20,
    seconds: 10,
    tag: "03 / 05 · AI · COMPLETA IL RAMO",
    it: "Espandi il ramo con anteprima",
    en: "Expand branch with preview",
    subIt: "L’AI propone i nuovi sotto-rami in anteprima modificabile · 1 solo Undo",
    subEn: "AI suggests child branches in an editable preview before applying with 1 Undo"
  },
  {
    id: "flashcards",
    start: 30,
    seconds: 9,
    tag: "04 / 05 · STUDIO ATTIVO",
    it: "Flashcard e ripasso spaziato",
    en: "Flashcards & active recall",
    subIt: "Genera sessioni di studio dai rami della mappa e valuta ciò che consolidi",
    subEn: "Turn map branches into active-recall flashcards and rate spaced repetition offline"
  },
  {
    id: "views",
    start: 39,
    seconds: 11,
    tag: "05 / 05 · GRAFICA & 7 VISTE",
    it: "Libreria SVG e sette viste collegate",
    en: "SVG Library & seven linked views",
    subIt: "Illustra con la libreria vettoriale e passa da Mappa a Organigramma, Albero e Kanban",
    subEn: "Enrich branches with the SVG library and switch from Mind map to Org chart, Tree and Kanban"
  }
];

const TOTAL_SECONDS = CHAPTERS.reduce((acc, c) => acc + c.seconds, 0);
const TOTAL_FRAMES_TARGET = TOTAL_SECONDS * FPS;

function vttTime(s) {
  const t = Math.round(s * 1000);
  return [Math.floor(t / 3600000), Math.floor(t / 60000) % 60, Math.floor(t / 1000) % 60]
    .map((x) => String(x).padStart(2, "0")).join(":") + "." + String(t % 1000).padStart(3, "0");
}

function makeVtt(lang) {
  return "WEBVTT\n\n" + CHAPTERS.map((c, idx) => {
    const end = idx < CHAPTERS.length - 1 ? c.start + c.seconds - 0.1 : c.start + c.seconds;
    return `${vttTime(c.start)} --> ${vttTime(end)}\n${lang === "en" ? c.subEn : c.subIt}\n\n`;
  }).join("");
}

function studioHostHtml() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Glauka Studio Reel Host</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${STAGE_W}px;
    height: ${STAGE_H}px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
    background: #f5f7fe;
  }
  .studio-bg {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 20px 36px 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background:
      radial-gradient(ellipse 900px 520px at 16% 10%, rgba(129, 140, 248, 0.16), transparent 65%),
      radial-gradient(ellipse 840px 500px at 86% 88%, rgba(167, 139, 250, 0.15), transparent 65%),
      linear-gradient(155deg, #fafbff 0%, #eff2fc 52%, #f5f3ff 100%);
  }
  .studio-header {
    width: ${APP_W}px;
    height: 68px;
    padding: 0 22px;
    border-radius: 18px;
    border: 1px solid rgba(99, 102, 241, 0.16);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(14px);
    box-shadow: 0 12px 30px -18px rgba(30, 27, 75, 0.25);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    z-index: 20;
  }
  .studio-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .studio-tag {
    flex: 0 0 auto;
    padding: 6px 12px;
    border-radius: 999px;
    background: linear-gradient(135deg, #4338ca, #6d28d9);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    box-shadow: 0 6px 16px -6px rgba(79, 70, 229, 0.65);
  }
  .studio-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .studio-title {
    font-size: 20px;
    font-weight: 800;
    color: #14182a;
    letter-spacing: -0.025em;
    line-height: 1.15;
  }
  .studio-sub {
    font-size: 13.5px;
    font-weight: 500;
    color: #475569;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .studio-header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 7px;
    flex: 0 0 auto;
  }
  .studio-brand {
    font-size: 14px;
    font-weight: 800;
    color: #4f46e5;
    letter-spacing: -0.02em;
  }
  .studio-progress-track {
    width: 190px;
    height: 6px;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }
  .studio-progress-fill {
    height: 100%;
    width: 0%;
    border-radius: 999px;
    background: linear-gradient(90deg, #4f46e5, #8b5cf6);
  }
  .studio-viewport {
    position: relative;
    width: ${APP_W}px;
    height: ${APP_H}px;
    perspective: 2200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #stage-card {
    position: relative;
    width: ${APP_W}px;
    height: ${APP_H}px;
    border-radius: 20px;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid rgba(99, 102, 241, 0.22);
    box-shadow:
      0 32px 72px -20px rgba(30, 27, 75, 0.26),
      0 8px 20px -8px rgba(79, 70, 229, 0.14);
    transform-origin: center center;
    will-change: transform, opacity, filter;
  }
  iframe#glauka {
    display: block;
    width: ${APP_W}px;
    height: ${APP_H}px;
    border: 0;
    background: #ffffff;
  }
  #studio-cursor {
    position: absolute;
    left: 0;
    top: 0;
    width: 28px;
    height: 28px;
    z-index: 999999;
    pointer-events: none;
    transform: translate(-100px, -100px);
    filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.28));
  }
  #studio-ripple {
    position: absolute;
    left: 0;
    top: 0;
    width: 44px;
    height: 44px;
    margin-left: -22px;
    margin-top: -22px;
    border-radius: 999px;
    border: 2.5px solid #4f46e5;
    background: rgba(79, 70, 229, 0.16);
    pointer-events: none;
    opacity: 0;
    z-index: 999998;
    transform: translate(-100px, -100px) scale(0.35);
  }
  #studio-ripple.right {
    border-color: #7c3aed;
    background: rgba(124, 58, 237, 0.16);
  }
</style>
</head>
<body>
  <div class="studio-bg">
    <header class="studio-header">
      <div class="studio-header-left">
        <span class="studio-tag" id="h-tag">01 / 05 · BUSSOLA &amp; SPOTLIGHT</span>
        <div class="studio-title-wrap">
          <strong class="studio-title" id="h-title">Bussola e ricerca rapida</strong>
          <span class="studio-sub" id="h-sub">Scorri i rami con Segue senza oscurare la mappa</span>
        </div>
      </div>
      <div class="studio-header-right">
        <span class="studio-brand">glauka studio</span>
        <div class="studio-progress-track"><div class="studio-progress-fill" id="h-progress"></div></div>
      </div>
    </header>
    <div class="studio-viewport">
      <div id="stage-card">
        <iframe id="glauka" src="${ORIGIN}/index.html"></iframe>
        <div id="studio-ripple"></div>
        <svg id="studio-cursor" viewBox="0 0 28 28" fill="none">
          <path d="M5 3.5L22.5 13.8L14.2 15.8L11.2 23.8L5 3.5Z" fill="#1e1b4b" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

async function main() {
  fs.mkdirSync(MEDIA, { recursive: true });
  const tmpMp4 = path.join(MEDIA, "glauka-studio-reel.recording.mp4");
  const finalMp4 = path.join(MEDIA, "glauka-studio-reel.mp4");
  const posterPng = path.join(MEDIA, "glauka-studio-reel.png");

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"]
  });

  let encoder, encoderErr = "", frames = 0;
  try {
    const page = await browser.newPage({
      viewport: { width: STAGE_W, height: STAGE_H },
      deviceScaleFactor: 1,
      locale: "it-IT"
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url === `${ORIGIN}/__studio_reel__.html`) {
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: studioHostHtml() });
      }
      if (url.startsWith(`${ORIGIN}/`)) return route.continue();
      return route.abort();
    });

    await page.addInitScript(() => {
      try { localStorage.setItem("nm6_welcome_seen", "1"); } catch {}
    });

    await page.goto(`${ORIGIN}/__studio_reel__.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const win = document.getElementById("glauka")?.contentWindow;
      return win?.neuroMapApp?.renderer && win?.NeuroMapLinkedViews && win?.NeuroMapUISkin && win?.GlaukaI18n?.ready;
    }, null, { timeout: 45000 });

    await page.evaluate(async () => {
      const win = document.getElementById("glauka").contentWindow;
      await win.GlaukaI18n.setLanguage("it");
    });

    if (!DRY_RUN) {
      encoder = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
        "-an", "-c:v", "libx264", "-threads", "4", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmpMp4
      ], { stdio: ["pipe", "ignore", "pipe"] });
      encoder.stderr.on("data", (d) => { encoderErr += d.toString(); });
    }
    const done = encoder ? once(encoder, "close") : Promise.resolve([0]);

    let curX = 720, curY = 440;

    async function setHeader(ch) {
      await page.evaluate((c) => {
        document.getElementById("h-tag").textContent = c.tag;
        document.getElementById("h-title").textContent = c.it;
        document.getElementById("h-sub").textContent = c.subIt;
      }, ch);
    }

    async function setStageTransform({ scale = 1, rx = 0, ry = 0, opacity = 1, blur = 0 } = {}) {
      await page.evaluate(({ scale, rx, ry, opacity, blur }) => {
        const card = document.getElementById("stage-card");
        card.style.transform = `scale(${scale.toFixed(4)}) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
        card.style.opacity = String(opacity);
        card.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
      }, { scale, rx, ry, opacity, blur });
    }

    async function setCursor(x, y) {
      curX = x; curY = y;
      await page.evaluate(([cx, cy]) => {
        const el = document.getElementById("studio-cursor");
        el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
      }, [x, y]);
    }

    async function setRipple(x, y, progress, right = false) {
      await page.evaluate(([rx, ry, p, r]) => {
        const el = document.getElementById("studio-ripple");
        el.classList.toggle("right", !!r);
        if (p <= 0 || p >= 1) {
          el.style.opacity = "0";
          el.style.transform = "translate(-100px, -100px) scale(0.35)";
          return;
        }
        el.style.opacity = String((1 - p) * 0.9);
        el.style.transform = `translate(${Math.round(rx)}px, ${Math.round(ry)}px) scale(${0.4 + p * 1.15})`;
      }, [x, y, progress, right]);
    }

    async function snapFrame() {
      if (errors.length) throw Error("Editor error: " + errors.join("; "));
      const pct = Math.min(100, (frames / TOTAL_FRAMES_TARGET) * 100);
      await page.evaluate((p) => {
        document.getElementById("h-progress").style.width = `${p.toFixed(2)}%`;
      }, pct);
      if (!DRY_RUN) {
        const data = await page.screenshot({ type: "jpeg", quality: 96, animations: "disabled" });
        if (!encoder.stdin.write(data)) await once(encoder.stdin, "drain");
      }
      frames++;
    }

    async function holdFrames(count, perFrameFn = null) {
      const n = DRY_RUN ? Math.min(2, count) : count;
      for (let i = 0; i < n; i++) {
        if (perFrameFn) await perFrameFn(i, n);
        await snapFrame();
      }
    }

    async function glideTo(tx, ty, count = 10, withTilt = true) {
      const n = DRY_RUN ? 2 : count;
      const sx = curX, sy = curY;
      for (let i = 1; i <= n; i++) {
        const e = easeInOutCubic(i / n);
        const nx = sx + (tx - sx) * e;
        const ny = sy + (ty - sy) * e;
        await setCursor(nx, ny);
        if (withTilt) {
          const rx = ((ny / APP_H) - 0.5) * -1.4;
          const ry = ((nx / APP_W) - 0.5) * 1.8;
          await setStageTransform({ scale: 1, rx, ry });
        }
        await snapFrame();
      }
      if (withTilt) await setStageTransform({ scale: 1, rx: 0, ry: 0 });
    }

    async function elementCenter(selector) {
      return await page.evaluate((sel) => {
        const doc = document.getElementById("glauka").contentDocument;
        const el = doc.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }, selector);
    }

    async function clickSmooth(selector, { moveFrames = 10, right = false } = {}) {
      const pt = await elementCenter(selector);
      if (pt) await glideTo(pt.x, pt.y, moveFrames);
      const frame = page.frameLocator("#glauka");
      await frame.locator(selector).click(right ? { button: "right" } : {});
      await setStageTransform({ scale: 1, rx: 0, ry: 0 });
      for (let i = 1; i <= 7; i++) {
        await setRipple(curX, curY, i / 7, right);
        await snapFrame();
      }
      await setRipple(0, 0, 0);
    }

    async function sceneTransition(loadFn, nextChapter) {
      // Smooth 3D pull-back + blur dissolve out (8 frames)
      for (let i = 1; i <= 8; i++) {
        const e = easeInOutCubic(i / 8);
        await setStageTransform({ scale: 1 - 0.045 * e, rx: 2.2 * e, ry: 0, opacity: 1 - 0.85 * e, blur: 5 * e });
        await snapFrame();
      }
      nextChapter.start = Number((frames / FPS).toFixed(1));
      await setHeader(nextChapter);
      await loadFn();
      // Smooth 3D settle back in (10 frames)
      for (let i = 1; i <= 10; i++) {
        const e = easeOutCubic(i / 10);
        await setStageTransform({ scale: 0.955 + 0.045 * e, rx: -1.8 * (1 - e), ry: 0, opacity: 0.15 + 0.85 * e, blur: 4 * (1 - e) });
        await snapFrame();
      }
      await setStageTransform({ scale: 1, rx: 0, ry: 0, opacity: 1, blur: 0 });
    }

    async function loadProjectInApp(jsonPath, filename) {
      const proj = JSON.parse(fs.readFileSync(path.join(ROOT, jsonPath), "utf8"));
      await page.evaluate(async ([project, name]) => {
        const win = document.getElementById("glauka").contentWindow;
        const app = win.neuroMapApp;
        await app.importFile(new win.File([JSON.stringify(project)], name), { newTab: true });
        win.NM615.setTheme("white");
        win.NeuroMapUISkin.set({ theme: "prisma" });
        win.document.querySelectorAll(".nm6-shade").forEach((el) => el.classList.add("hidden"));
        app.recalculateAndRender();
        app.fitToScreen();
        await win.document.fonts.ready;
      }, [proj, filename]);
      await page.waitForTimeout(180);
    }

    // =========================================================================
    // SCENE 1 (0..10s, ~300f): BUSSOLA SEGUE + SPOTLIGHT SEARCH
    // =========================================================================
    await setHeader(CHAPTERS[0]);
    await loadProjectInApp("docs/examples/website/nervous-it.glauka.json", "sistema-nervoso.glauka.json");
    await setCursor(720, 460);

    // 3D hero reveal push-in (18f) + hold (22f)
    for (let i = 0; i <= 18; i++) {
      const e = easeOutCubic(i / 18);
      await setStageTransform({ scale: 0.93 + 0.07 * e, rx: 3.4 * (1 - e), ry: -2.6 * (1 - e), opacity: 0.35 + 0.65 * e });
      await snapFrame();
    }
    await holdFrames(18);

    // Open Bussola and highlight branch 1 -> Segue directly (zero Isola ramo!)
    await clickSmooth("#nm614-open-navigation", { moveFrames: 12 });
    await page.frameLocator("#glauka").locator("#nm614-navigation-flyout").waitFor({ state: "visible" });
    await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      win.neuroMapApp.selectNode("nervous-01");
      win.neuroMapApp.requestRender();
    });
    await holdFrames(18);

    // Segue -> Neuroni e sinapsi (capture crisp studio poster frame!)
    await clickSmooth("#nm67-next-main", { moveFrames: 10 });
    await glideTo(curX + 60, curY - 40, 8);
    await holdFrames(6);
    if (!DRY_RUN) await page.screenshot({ path: posterPng, animations: "disabled" });
    await holdFrames(28);

    // Segue -> Sistema autonomo
    await clickSmooth("#nm67-next-main", { moveFrames: 8 });
    await holdFrames(24);

    // Close Bussola and open Spotlight to jump directly to "Assone e mielina"
    await clickSmooth("#nm614-open-navigation", { moveFrames: 8 });
    await clickSmooth("#btn-spotlight", { moveFrames: 10 });
    const searchInput = page.frameLocator("#glauka").locator("#find-query");
    await searchInput.waitFor({ state: "visible" });
    const term = "mielina";
    for (let i = 1; i <= term.length; i++) {
      await searchInput.fill(term.slice(0, i));
      await holdFrames(3);
    }
    await holdFrames(10);
    await searchInput.press("Enter");
    // Capture smooth Spotlight teleport animation (18f) + radar pulse hold (30f)
    await holdFrames(45);

    // =========================================================================
    // SCENE 2 (10..20s, ~300f): AI · SPIEGA & ETIMOLOGIA ON ZOOMED NODE
    // =========================================================================
    await sceneTransition(async () => {
      await loadProjectInApp("docs/examples/website/anatomia.glauka.json", "anatomia.glauka.json");
    }, CHAPTERS[1]);
    await holdFrames(18);

    // 30fps smooth zoom to "Nodo atrioventricolare"
    const camTarget = await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      const app = win.neuroMapApp;
      const all = app.state.getAllNodesIncludingCollapsed();
      const target = all.find((n) => /atrioventricolare/i.test(n.text)) || all[2];
      app.selectNode(target.id);
      const lay = app.layout.getLayout(target.id);
      const startZoom = app.renderer.camera.zoom;
      const endZoom = Math.min(1.52, Math.max(1.24, startZoom * 1.9));
      return {
        id: target.id,
        wx: lay.x,
        wy: lay.y,
        sz: startZoom,
        sx: app.renderer.camera.x,
        sy: app.renderer.camera.y,
        ez: endZoom,
        ex: 1440 * 0.40 - lay.x * endZoom,
        ey: 854 * 0.46 - lay.y * endZoom
      };
    });
    for (let i = 1; i <= 26; i++) {
      const e = easeInOutCubic(i / 26);
      await page.evaluate(({ d, e }) => {
        const win = document.getElementById("glauka").contentWindow;
        const c = win.neuroMapApp.renderer.camera;
        c.zoom = d.sz + (d.ez - d.sz) * e;
        c.x = d.sx + (d.ex - d.sx) * e;
        c.y = d.sy + (d.ey - d.sy) * e;
        win.neuroMapApp.requestRender();
      }, { d: camTarget, e });
      await setStageTransform({ scale: 1, rx: 0.6 * Math.sin(e * Math.PI), ry: -0.9 * Math.sin(e * Math.PI) });
      await snapFrame();
    }
    await setStageTransform({ scale: 1, rx: 0, ry: 0 });

    const nodeScreenPt = await page.evaluate(({ wx, wy }) => {
      const win = document.getElementById("glauka").contentWindow;
      const c = win.neuroMapApp.renderer.camera;
      const r = win.document.getElementById("mindmap-canvas").getBoundingClientRect();
      return { x: Math.round(r.left + wx * c.zoom + c.x), y: Math.round(r.top + wy * c.zoom + c.y) };
    }, camTarget);

    await glideTo(nodeScreenPt.x, nodeScreenPt.y, 12);
    await page.evaluate(({ id, pt }) => {
      const win = document.getElementById("glauka").contentWindow;
      const node = win.neuroMapApp.state.findNode(id);
      win.neuroMapApp.showContextMenu(pt.x, pt.y, { type: "node", item: node });
      for (const det of win.document.querySelectorAll("#context-menu details")) det.open = true;
    }, { id: camTarget.id, pt: nodeScreenPt });
    for (let i = 1; i <= 7; i++) { await setRipple(curX, curY, i / 7, true); await snapFrame(); }
    await setRipple(0, 0, 0);
    await holdFrames(16);

    await page.frameLocator("#glauka").locator("#btn-ai-explain").scrollIntoViewIfNeeded();
    const explainBtn = await elementCenter("#btn-ai-explain");
    if (explainBtn) await glideTo(explainBtn.x, explainBtn.y, 12);
    await page.frameLocator("#glauka").locator("#btn-ai-explain").evaluate((el) => { el.style.outline = "2px solid #4f46e5"; });
    await holdFrames(12);

    await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      win.nmProduct.guard = () => true;
      win.neuroMapApp.hideMenus();
      win.neuroMapApp.aiClient.chat = async () =>
        "## Etimologia\n\nDal latino *atrium* (atrio) e *ventriculus* (ventricolo): sede di raccordo tra camere superiori e inferiori.\n\n" +
        "## Definizione tecnica\n\nIl nodo atrioventricolare rallenta l’impulso elettrico dagli atri ai ventricoli.\n\n" +
        "## Spiegazione semplice\n\nConsente agli atri di completare lo svuotamento prima della sistole ventricolare.\n\n" +
        "## Esempio pratico\n\nNell’ECG questo ritardo fisiologico corrisponde al tratto dell’intervallo PR.";
      win.neuroMapApp.aiExplainNode();
    });
    await page.frameLocator("#glauka").locator("#ai-explain-panel").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const doc = document.getElementById("glauka").contentDocument;
      return /Etimologia/i.test(doc.getElementById("ai-explain-text")?.innerText || "");
    }, { timeout: 5000 });
    await holdFrames(88);

    // Click "Salva nelle note del nodo" -> opens AI Studio review -> close cleanly
    await clickSmooth("#ai-explain-save", { moveFrames: 12 });
    await page.frameLocator("#glauka").locator("#nm-ai-apply").waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    await holdFrames(18);
    if (await page.frameLocator("#glauka").locator("#nm-ai-apply").isVisible().catch(() => false)) {
      await clickSmooth("#nm-ai-apply", { moveFrames: 10 });
    }
    await holdFrames(12);
    await page.evaluate(() => {
      const doc = document.getElementById("glauka").contentDocument;
      doc.getElementById("ai-explain-panel")?.classList.add("hidden");
      doc.getElementById("nm-ai-studio")?.classList.add("hidden");
    });

    // =========================================================================
    // SCENE 3 (20..30s, ~300f): AI · COMPLETA / ESPANDI RAMO CON ANTEPRIMA
    // =========================================================================
    await sceneTransition(async () => {
      await loadProjectInApp("docs/examples/website/nervous-it.glauka.json", "sistema-nervoso.glauka.json");
      await page.evaluate(() => {
        const win = document.getElementById("glauka").contentWindow;
        const app = win.neuroMapApp;
        const target = app.state.getAllNodesIncludingCollapsed().find((n) => /Impulso elettrico/i.test(n.text)) || app.state.root.children[1];
        app.selectNode(target.id);
        const lay = app.layout.getLayout(target.id);
        const z = 1.25;
        app.renderer.camera.zoom = z;
        app.renderer.camera.x = 1440 * 0.42 - lay.x * z;
        app.renderer.camera.y = 854 * 0.48 - lay.y * z;
        app.requestRender();
      });
    }, CHAPTERS[2]);
    await holdFrames(18);

    const expandPt = await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      const app = win.neuroMapApp;
      const id = app.state.selectedNodeId;
      const lay = app.layout.getLayout(id);
      const c = app.renderer.camera;
      const r = win.document.getElementById("mindmap-canvas").getBoundingClientRect();
      return { id, x: Math.round(r.left + lay.x * c.zoom + c.x), y: Math.round(r.top + lay.y * c.zoom + c.y) };
    });
    await glideTo(expandPt.x, expandPt.y, 12);
    await page.evaluate(({ id, x, y }) => {
      const win = document.getElementById("glauka").contentWindow;
      const node = win.neuroMapApp.state.findNode(id);
      win.neuroMapApp.showContextMenu(x, y, { type: "node", item: node });
      for (const det of win.document.querySelectorAll("#context-menu details")) det.open = true;
    }, expandPt);
    for (let i = 1; i <= 7; i++) { await setRipple(curX, curY, i / 7, true); await snapFrame(); }
    await setRipple(0, 0, 0);
    await holdFrames(12);

    await page.frameLocator("#glauka").locator("#btn-ai-expand").scrollIntoViewIfNeeded();
    const expandBtn = await elementCenter("#btn-ai-expand");
    if (expandBtn) await glideTo(expandBtn.x, expandBtn.y, 12);
    await page.frameLocator("#glauka").locator("#btn-ai-expand").evaluate((el) => { el.style.outline = "2px solid #4f46e5"; });
    await holdFrames(12);

    await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      win.nmProduct.guard = () => true;
      win.neuroMapApp.hideMenus();
      win.neuroMapApp.aiClient.chat = async () =>
        "- Soglia (-55 mV)\n- Depolarizzazione\n  - Ingresso rapido di Na+\n- Ripolarizzazione\n  - Uscita di K+\n- Periodo refrattario";
      win.neuroMapApp.aiExpandBranch();
    });
    await page.frameLocator("#glauka").locator("#nm-ai-proposal").waitFor({ state: "visible", timeout: 8000 });
    await holdFrames(75);

    // Click "Applica alla mappa" in AI Studio review -> adds branches with 1 Undo!
    await clickSmooth("#nm-ai-apply", { moveFrames: 12 });
    await holdFrames(16);
    await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      win.document.getElementById("nm-ai-studio")?.classList.add("hidden");
      const app = win.neuroMapApp;
      app.renderer.camera.zoom = Math.max(0.92, app.renderer.camera.zoom * 0.84);
      app.requestRender();
    });
    await holdFrames(68);

    // =========================================================================
    // SCENE 4 (30..39s, ~270f): STUDIO ATTIVO · FLASHCARD E RIPASSO SPAZIATO
    // =========================================================================
    await sceneTransition(async () => {
      await page.evaluate(() => {
        const win = document.getElementById("glauka").contentWindow;
        const app = win.neuroMapApp;
        app.fitToScreen();
        const nodes = app.state.getAllNodesIncludingCollapsed();
        const n1 = nodes.find((n) => /Impulso elettrico/i.test(n.text)) || nodes[1];
        const n2 = nodes.find((n) => /Sistema autonomo/i.test(n.text)) || nodes[2];
        const n3 = nodes.find((n) => /Midollo spinale/i.test(n.text)) || nodes[3];
        app.studyCards = [
          {
            id: "studio-card-1",
            sourceTabId: app.activeTabId,
            sourceNodeId: n1.id,
            breadcrumb: "Neuroni e sinapsi › " + n1.text,
            question: "Quali fasi compongono la propagazione dell’impulso elettrico lungo l’assone?",
            answer: "Soglia (-55 mV), depolarizzazione (ingresso rapido di Na+), ripolarizzazione (uscita di K+) e periodo refrattario.",
            sourceSignature: app.v5Signature ? app.v5Signature(n1, app.state) : "",
            srStatus: 0,
            sr: { dueAt: 0, lastReviewedAt: 0, intervalDays: 0, reviews: 0, lapses: 0 }
          },
          {
            id: "studio-card-2",
            sourceTabId: app.activeTabId,
            sourceNodeId: n2.id,
            breadcrumb: n2.text,
            question: "Qual è la differenza funzionale tra Sistema simpatico e Parasimpatico?",
            answer: "Il simpatico attiva la risposta di allerta (aumenta battito e respiro); il parasimpatico favorisce recupero e riposo.",
            sourceSignature: app.v5Signature ? app.v5Signature(n2, app.state) : "",
            srStatus: 0,
            sr: { dueAt: 0, lastReviewedAt: 0, intervalDays: 0, reviews: 0, lapses: 0 }
          },
          {
            id: "studio-card-3",
            sourceTabId: app.activeTabId,
            sourceNodeId: n3.id,
            breadcrumb: "Sistema centrale (SNC) › " + n3.text,
            question: "Quali funzioni svolge il midollo spinale nel SNC?",
            answer: "Conduce le vie ascendenti e discendenti tra encefalo e periferia e coordina i riflessi spinali.",
            sourceSignature: app.v5Signature ? app.v5Signature(n3, app.state) : "",
            srStatus: 0,
            sr: { dueAt: 0, lastReviewedAt: 0, intervalDays: 0, reviews: 0, lapses: 0 }
          }
        ];
      });
    }, CHAPTERS[3]);
    await holdFrames(10);

    await clickSmooth("#btn-menu-tools", { moveFrames: 10 });
    await page.frameLocator("#glauka").locator("#nm-tools-study > summary").waitFor({ state: "visible", timeout: 5000 });
    await clickSmooth("#nm-tools-study > summary", { moveFrames: 8 });
    await page.frameLocator("#glauka").locator("#btn-flashcards").waitFor({ state: "visible", timeout: 5000 });
    await page.frameLocator("#glauka").locator("#btn-flashcards").scrollIntoViewIfNeeded();
    await clickSmooth("#btn-flashcards", { moveFrames: 10 });
    await page.frameLocator("#glauka").locator("#flash-modal").waitFor({ state: "visible" });
    await holdFrames(42);

    await clickSmooth("#flash-reveal", { moveFrames: 12 });
    await holdFrames(54);

    await clickSmooth("#flash-rate-3", { moveFrames: 12 });
    await holdFrames(36);

    await clickSmooth("#flash-reveal", { moveFrames: 10 });
    await holdFrames(28);

    await clickSmooth("#flash-close", { moveFrames: 10 });
    await holdFrames(8);

    // =========================================================================
    // SCENE 5 (39..50s, ~330f): LIBRERIA SVG CREATIVA & SETTE VISTE COLLEGATE
    // =========================================================================
    await sceneTransition(async () => {
      await loadProjectInApp("docs/examples/website/nervous-it.glauka.json", "sistema-nervoso.glauka.json");
    }, CHAPTERS[4]);

    // Open offline Creative Library (SVG / Symbols / Shapes)
    await page.evaluate(() => {
      const win = document.getElementById("glauka").contentWindow;
      win.NeuroMapCreative?.libraryHub?.(win.neuroMapApp, "symbols");
    });
    await page.frameLocator("#glauka").locator("#nm-creative-library-hub").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await holdFrames(48);

    // Switch tab inside Creative Library to "Illustrazioni" SVG tab
    const iconTab = await elementCenter("#nm-creative-library-tabs [role='tab']:nth-child(4)");
    if (iconTab) {
      await clickSmooth("#nm-creative-library-tabs [role='tab']:nth-child(4)", { moveFrames: 10 });
      await holdFrames(42);
    }
    await page.evaluate(() => {
      const doc = document.getElementById("glauka").contentDocument;
      doc.querySelector("#nm-creative-library-hub button[aria-label='Chiudi'], #nm-creative-library-hub .nm-close")?.click();
      doc.getElementById("nm-creative-library-hub")?.remove();
    });
    await holdFrames(12);

    // Smoothly cycle real Linked Views
    for (const [mode, hold] of [
      ["mindmap", 36],
      ["orgchart", 48],
      ["concept-tree", 48],
      ["kanban", 58]
    ]) {
      await page.evaluate((m) => {
        const win = document.getElementById("glauka").contentWindow;
        win.NeuroMapLinkedViews.setMode(win.neuroMapApp, m);
      }, mode);
      await page.waitForTimeout(140);
      // Slight gentle 3D settle on view change
      for (let i = 1; i <= 8; i++) {
        const e = easeOutCubic(i / 8);
        await setStageTransform({ scale: 0.97 + 0.03 * e, rx: 1.5 * (1 - e), ry: 0, opacity: 0.65 + 0.35 * e });
        await snapFrame();
      }
      await holdFrames(hold);
    }

    // Recompute exact chapter durations from actual recorded frame counts
    for (let i = 0; i < CHAPTERS.length; i++) {
      const nextStart = i < CHAPTERS.length - 1 ? CHAPTERS[i + 1].start : Number((frames / FPS).toFixed(1));
      CHAPTERS[i].seconds = Number(Math.max(1, nextStart - CHAPTERS[i].start).toFixed(1));
    }

    if (DRY_RUN) {
      console.log("DRY_RUN PASSED ALL 5 SCENES! Frames simulated:", frames, CHAPTERS.map(c => `${c.id}@${c.start}s`));
      return;
    }
    encoder.stdin.end();
    const [code] = await done;
    if (code !== 0) throw Error("ffmpeg exited " + code + ": " + encoderErr);
    if (fs.existsSync(finalMp4)) fs.unlinkSync(finalMp4);
    fs.renameSync(tmpMp4, finalMp4);
    fs.writeFileSync(path.join(MEDIA, "glauka-studio-reel.it.vtt"), makeVtt("it"));
    fs.writeFileSync(path.join(MEDIA, "glauka-studio-reel.en.vtt"), makeVtt("en"));

    const proof = {
      source: "Real Glauka desktop editor hosted inside Studio 3D stage on loopback",
      theme: "Consistent bright White / Prisma light UI throughout",
      ai: "Declared deterministic offline sample fixtures (Spiega & Espandi ramo), NOT a live provider call",
      fps: FPS,
      width: STAGE_W,
      height: STAGE_H,
      frames,
      durationSeconds: Number((frames / FPS).toFixed(1)),
      chapters: CHAPTERS,
      videoSha256: crypto.createHash("sha256").update(fs.readFileSync(finalMp4)).digest("hex"),
      bytes: fs.statSync(finalMp4).size
    };
    fs.writeFileSync(path.join(MEDIA, "glauka-studio-reel.provenance.json"), JSON.stringify(proof, null, 2) + "\n");
    console.log("STUDIO 3D REEL RECORDED:", proof);
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
