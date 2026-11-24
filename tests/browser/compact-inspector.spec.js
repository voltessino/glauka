const { test, expect } = require("@playwright/test");
async function open(page, platform = "desktop") {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    platform === "desktop"
      ? "http://127.0.0.1:5174/index.html"
      : "http://127.0.0.1:5173/app/index.html",
  );
  await page.waitForFunction(
    () => window.neuroMapApp && window.NeuroMapCreative,
  );
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    neuroMapApp.importHierarchy(
      {
        text: "Mappa",
        children: [
          {
            text: "stereo",
            children: [
              {
                text: "deriva da",
                children: [
                  {
                    text: "greco stereós: solido, rigido, tridimensionale",
                    children: [],
                  },
                ],
              },
              {
                text: "2 def",
                children: [
                  {
                    text: "a) tridimensionalità del suono / spazio",
                    children: [],
                  },
                  {
                    text: "b) rigidità della struttura (es. stereociglia)",
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      { newTab: true },
    );
  });
}
test("compact tool tiles and defaults preserve accessible labels and translations", async ({
  page,
}, testInfo) => {
  await open(page);
  await page.waitForSelector("#nm-format-target", { state: "attached" });
  await page.evaluate(() => {
    document.getElementById("inspector-sidebar")?.classList.remove("collapsed");
    const cl = document.getElementById("nm-creative-launcher");
    if (cl) cl.open = true;
  });
  await page.locator("#nm-open-insert").click();
  const launcher = page.locator("#nm-insert-pictures .nm-insert-tool-grid");
  await expect(
    launcher.getByRole("button", { name: "Formule", exact: true }),
  ).toBeVisible();
  const tiles = await launcher.locator(":scope > button").evaluateAll((els) =>
    els.filter(e=>e.checkVisibility()).map((e) => ({
      width: e.getBoundingClientRect().width,
      height: e.getBoundingClientRect().height,
      x: e.offsetLeft,
      y: e.offsetTop,
    })),
  );
  expect(tiles).toHaveLength(6);
  for (const t of tiles) {
    expect(t.height).toBeGreaterThanOrEqual(42);
    expect(t.width).toBeGreaterThan(80);
  }
  await page.locator("#btn-toggle-inspector").click();
  const save = page.locator("#nm-settings-defaults-style");
  await expect(save).toHaveText("Salva come predefiniti");
  expect(
    await save.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    neuroMapApp.state.strokeScale = 1.7;
    document.getElementById("nm-settings-defaults-style").click();
  });
  await page.evaluate(() => {
    for (const c of document.querySelectorAll("#nm-settings-defaults input"))
      c.checked = c.dataset.setting === "stroke";
    document
      .querySelector("[data-setting=stroke]")
      .dispatchEvent(new Event("change"));
  });
  await page.locator("#nm-settings-save-defaults").click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).toHaveAttribute("title", /corrispondono/);
  await page.evaluate(() => {
    neuroMapApp.state.strokeScale = 2;
    neuroMapApp.nmFormatRefresh();
  });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(async () => {
    await GlaukaI18n.setLanguage("en");
  });
  await expect(save).toHaveText("Save as defaults");
  await page.locator("#nm-open-insert").click();
  await expect(
    launcher.getByRole("button", { name: "Formulas", exact: true }),
  ).toBeVisible();
  await page.locator('#nm-insert-panel').screenshot({ path: testInfo.outputPath("compact-tools.png") });
});
test("clockwise preview has a marked start at one o’clock and clockwise curvature", async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(() => {
    const p = document.querySelector(".nm-clockwise-arrow"),
      start = p.getPointAtLength(0),
      next = p.getPointAtLength(1);
    return {
      x: start.x,
      y: start.y,
      dx: next.x - start.x,
      dy: next.y - start.y,
      d: p.getAttribute("d"),
    };
  });
  expect(r.x).toBeGreaterThan(40);
  expect(r.y).toBeLessThan(15);
  expect(r.dx).toBeGreaterThan(0);
  expect(r.dy).toBeGreaterThan(0);
  expect(r.d).toContain("0 1 1");
  await page.locator("#v6-show-layout").click();
  await page
    .locator("#nm-layout-modes")
    .screenshot({ path: "/workspace/compact-layout-icons.png" });
});
for (const platform of ["desktop", "android"])
  for (const side of ["left", "right"])
    for (const style of ["neon", "buzan", "thickparents"])
      test(`${platform} ${side} ${style}: rendered branches and SVG stay within rounded curve corridors`, async ({
        page,
      }) => {
        await open(page, platform);
        const r = await page.evaluate(
          async ({ side, style }) => {
            const a = neuroMapApp;
            a.state.root.layoutMode = side;
            a.state.branchStyle = style;
            a.state.strokeScale = 3;
            a.state.root.children[0].boundary = { enabled: true, title: "" };
            a.recalculateAndRender();
            const failures = [];
            let tested = 0;
            for (const n of a.state.getAllNodes()) {
              if (!n.parentId) continue;
              const p = a.state.findNode(n.parentId),
                g = a.renderer.computeBranchGeometry(p, n);
              if (!g) continue;
              const loX = Math.min(g.startX, g.endX, g.underlineEndX) - 30,
                loY = Math.min(g.startY, g.endY) - 30,
                w = Math.ceil(Math.abs(g.startX - g.underlineEndX) + 60),
                h = Math.ceil(Math.abs(g.startY - g.endY) + 60);
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.translate(-loX, -loY);
              const prev = a.renderer.ctx,
                collapsed = n.collapsed;
              try {
                a.renderer.ctx = ctx;
                n.collapsed = true;
                a.renderer.drawTaperingBranch(p, n);
              } finally {
                a.renderer.ctx = prev;
                n.collapsed = collapsed;
              }
              const mask = document.createElement("canvas");
              mask.width = w;
              mask.height = h;
              const m = mask.getContext("2d");
              m.translate(-loX, -loY);
              m.lineCap = "round";
              m.lineJoin = "round";
              m.lineWidth = Math.max(g.startWidth, g.endWidth) + 4;
              m.beginPath();
              m.moveTo(g.startX, g.startY);
              m.bezierCurveTo(g.cp1x, g.cp1y, g.cp2x, g.cp2y, g.endX, g.endY);
              m.lineTo(g.underlineEndX, g.underlineEndY);
              m.stroke();
              const pixels = ctx.getImageData(0, 0, w, h).data,
                allowed = m.getImageData(0, 0, w, h).data;
              let stray = 0;
              for (let i = 3; i < pixels.length; i += 4)
                if (pixels[i] > 20 && allowed[i] === 0) stray++;
              if (stray) failures.push({ text: n.text, stray });
              tested++;
            }
            let blob;
            const old = a.io.triggerDownload;
            a.io.triggerDownload = (b) => (blob = b);
            try {
              a.io.exportSVG();
            } finally {
              a.io.triggerDownload = old;
            }
            const svg = await blob.text();
            const valid = !new DOMParser()
              .parseFromString(svg, "image/svg+xml")
              .querySelector("parsererror");
            // SVG and canvas share the exact rounded outline, preventing divergent exports.
            const child = a.state.root.children[0],
              g = a.renderer.computeBranchGeometry(a.state.root, child, 0, 1),
              same = svg.includes(NeuroMapGraphics.ribbonPath(g, child));
            a.fitWholeMap();
            return { tested, failures, valid, same };
          },
          { side, style },
        );
        expect(r.failures).toEqual([]);
        expect(r.tested).toBe(6);
        expect(r.valid).toBe(true);
        expect(r.same).toBe(true);
        if (platform === "desktop" && side === "left" && style === "neon")
          await page.screenshot({
            path: "/workspace/compact-left-branches.png",
          });
      });
