const { test, expect } = require("@playwright/test");
const { openSettings } = require("./settings-path");
async function boot(page, platform = "desktop") {
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    platform === "desktop"
      ? "http://127.0.0.1:5174/index.html"
      : "http://127.0.0.1:5173/app/index.html",
  );
  await page.waitForFunction(
    () => window.neuroMapApp?.renderer && window.NeuroMapMotion,
  );
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    neuroMapApp.importHierarchy(
      { text: "Studio", children: [{ text: "Concetto", children: [] }] },
      { newTab: true },
    );
    neuroMapApp.selectNode(neuroMapApp.state.root.children[0].id);
  });
}
for (const platform of ["desktop", "android"])
  test.describe(platform + " gentle motion and backgrounds", () => {
    test("a new branch animates briefly, adds no surfaces or history steps and stops rendering at rest", async ({
      page,
    }, info) => {
      await boot(page, platform);
      await page.evaluate(() => {
        const ctx = neuroMapApp.renderer.ctx,
          original = ctx.fillText;
        window.qaMotionAlphas = [];
        window.qaRestoreMotionProbe = () => {
          ctx.fillText = original;
        };
        ctx.fillText = function (...args) {
          qaMotionAlphas.push(this.globalAlpha);
          return original.apply(this, args);
        };
      });
      const before = await page.evaluate(() => ({
        history: neuroMapApp.state.undoStack.length,
        canvases: document.querySelectorAll("canvas").length,
      }));
      const immediate = await page.evaluate(() => {
        const a = neuroMapApp;
        a.addChild();
        a.closeEditor(true);
        return {
          motion: NeuroMapMotion.inspect(a),
          id: a.state.selectedNodeId,
          history: a.state.undoStack.length,
          tree: JSON.stringify(a.state.root),
        };
      });
      expect(immediate.motion.active).toBe(1);
      expect(immediate.history - before.history).toBe(1);
      await expect
        .poll(() =>
          page.evaluate(() => NeuroMapMotion.inspect(neuroMapApp).active),
        )
        .toBe(0);
      const settled = await page.evaluate(() => ({
        frames: NeuroMapMotion.inspect(neuroMapApp).frames,
        tree: JSON.stringify(neuroMapApp.state.root),
        canvases: document.querySelectorAll("canvas").length,
      }));
      expect(settled.tree).toBe(immediate.tree);
      expect(settled.canvases).toBe(before.canvases);
      expect(settled.frames).toBeLessThan(45);
      const alphas = await page.evaluate(() => {
        qaRestoreMotionProbe();
        return qaMotionAlphas;
      });
      expect(alphas.some((value) => value > 0 && value < 0.999)).toBe(true);
      require("node:fs").writeFileSync(
        info.outputPath("motion-idle.json"),
        JSON.stringify(
          {
            platform,
            activeAfter: 0,
            animationFrames: settled.frames,
            canvasBefore: before.canvases,
            canvasAfter: settled.canvases,
            maxActive: immediate.motion.maxActive,
          },
          null,
          2,
        ),
      );
      await page.waitForTimeout(250);
      expect(
        await page.evaluate(() => NeuroMapMotion.inspect(neuroMapApp).frames),
      ).toBe(settled.frames);
      await page.evaluate(() => neuroMapApp.undo());
      expect(
        await page.evaluate(
          (id) => neuroMapApp.state.findNode(id),
          immediate.id,
        ),
      ).toBeNull();
    });
    test("reduced motion disables effects and manual preferences persist without entering the project", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await boot(page, platform);
      expect(
        await page.evaluate(() => {
          neuroMapApp.addChild();
          return NeuroMapMotion.inspect(neuroMapApp).active;
        }),
      ).toBe(0);
      await expect(page.locator("body")).toHaveAttribute(
        "data-nm-motion",
        "off",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(() =>
        NeuroMapMotion.set({ branches: false, interface: false }),
      );
      await page.reload();
      await page.waitForFunction(() => window.NeuroMapMotion);
      expect(await page.evaluate(() => NeuroMapMotion.get())).toMatchObject({
        branches: false,
        interface: false,
      });
      expect(
        await page.evaluate(() =>
          JSON.stringify(neuroMapApp.io.buildSerializedProjectPayload()),
        ),
      ).not.toContain("nmMotion");
    });
    test("all 25 backgrounds are usable, maintain light/dark contrast mode and export the chosen color", async ({
      page,
    }) => {
      await boot(page, platform);
      const results = await page.evaluate(async (platform) => {
        const themes = NeuroMapThemePicker.themes,
          a = neuroMapApp,
          out = [];
        for (const [id, t] of Object.entries(themes)) {
          (platform === "desktop" ? NM615 : NeuroMapAndroidEditor).setTheme(id);
          let blob;
          const old = a.io.triggerDownload;
          a.io.triggerDownload = (b) => {
            blob = b;
            return true;
          };
          try {
            await a.io.exportSVG();
          } finally {
            a.io.triggerDownload = old;
          }
          const svg = await blob.text();
          const c = document.createElement("canvas");
          c.width = 1;
          c.height = 1;
          const ctx = c.getContext("2d"),
            fills = [],
            texts = [],
            previous = a.renderer.ctx;
          ctx.fill = () => fills.push(ctx.fillStyle);
          ctx.fillText = () => texts.push(ctx.fillStyle);
          a.renderer.ctx = ctx;
          try {
            a.renderer.drawNode(a.state.root.children[0]);
          } finally {
            a.renderer.ctx = previous;
          }
          const rgba = (style) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = style;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data];
          };
          const pill = fills.length ? rgba(fills[0]) : [0,0,0,0],
            text = rgba(texts[0]),
            bg = t.color
              .slice(1)
              .match(/../g)
              .map((v) => parseInt(v, 16));
          const lum = (rgb) =>
            rgb
              .map((v) => v / 255)
              .map((v) =>
                v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
              )
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const pl = lum(
              pill
                .slice(0, 3)
                .map(
                  (v, i) => (v * pill[3]) / 255 + bg[i] * (1 - pill[3] / 255),
                ),
            ),
            tl = lum(text.slice(0, 3));
          const contrast =
            (Math.max(pl, tl) + 0.05) / (Math.min(pl, tl) + 0.05);
          out.push({
            id,
            contrast,
            color: getComputedStyle(document.documentElement)
              .getPropertyValue("--bg-canvas")
              .trim(),
            expected: t.color,
            light: document.body.classList.contains(
              platform === "desktop" ? "nm615-light" : "nm-android-light",
            ),
            expectedLight: t.light,
            svg: svg.includes('fill="' + t.color + '"'),
          });
        }
        return out;
      }, platform);
      expect(results).toHaveLength(25);
      for (const r of results) {
        expect(r.color, r.id).toBe(r.expected);
        expect(r.light, r.id).toBe(r.expectedLight);
        expect(r.svg, r.id).toBe(true);
        expect(r.contrast, r.id).toBeGreaterThanOrEqual(4.5);
      }
      await page.reload();
      await page.waitForFunction(() => window.neuroMapApp);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg-canvas")
            .trim(),
        ),
      ).toBe("#faf0d9");
    });
    test("PNG export is complete during a live appearance animation", async ({
      page,
    }) => {
      await boot(page, platform);
      const result = await page.evaluate(async () => {
        const a = neuroMapApp;
        a.addChild();
        a.closeEditor(true);
        const count = NeuroMapMotion.inspect(a).active,
          ctx = document.createElement("canvas").getContext("2d"),
          alpha = [];
        const old = ctx.fillText.bind(ctx);
        ctx.fillText = function (...args) {
          alpha.push(this.globalAlpha);
          return old(...args);
        };
        a.renderer.render(ctx, { scale: 1, tx: 300, ty: 200 });
        let blob;
        const save = a.io.triggerDownload;
        a.io.triggerDownload = (b) => {
          blob = b;
          return true;
        };
        try {
          await a.io.exportPNG();
        } finally {
          a.io.triggerDownload = save;
        }
        return { count, alpha, bytes: blob.size };
      });
      expect(result.count).toBeGreaterThan(0);
      expect(result.alpha.every((v) => v === 1)).toBe(true);
      expect(result.bytes).toBeGreaterThan(500);
    });
  });
test("appearance settings and grouped background swatches fit a narrow inspector and translate", async ({
  page,
}, info) => {
  await boot(page);
  await page.locator("#btn-toggle-inspector").click();
  await openSettings(page, "editor");
  await expect(page.locator("#gl-settings-branch-motion")).toBeVisible();
  await expect(page.locator(".nm-theme-option")).toHaveCount(25);
  await page.locator("label.gl-settings-switch:has(#gl-settings-branch-motion)").click();
  expect(await page.evaluate(() => NeuroMapMotion.get().branches)).toBe(false);
  await page.keyboard.press("Escape");
  await page.locator("#nm-map-background-trigger").click();
  await page.locator("[data-nm-theme=lavender]").click();
  await page.screenshot({
    path: info.outputPath("backgrounds-and-motion.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator(".nm-theme-options")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.evaluate(async () => {
    await GlaukaI18n.setLanguage("en");
  });
  await expect(page.locator("#nm-motion-settings h3")).toHaveText("Animations");
  await expect(page.locator(".nm-theme-group").first()).toHaveText(
    "Dark backgrounds",
  );
});
