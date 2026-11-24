const { test, expect } = require("@playwright/test");
const { openSettings } = require("./settings-path");
const themes = [
  "prisma",
  "classic",
  "orbit",
  "aurora",
  "glass",
  "cyber",
  "minimal",
  "graphite",
  "neon",
  "purple",
];
async function boot(page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { plan: "pro", developer: true, perpetual: true } }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.NeuroMapUISkin && window.NeuroMapMotion,
  );
  await page.waitForFunction(() => window.nmProduct);
  await page.evaluate(() => { nmProduct.isPro = () => true; });
  await page.evaluate(() => NeuroMapMotion.set({ interface: false }));
}
async function readable(page, selector) {
  const issues = await page.locator(selector).evaluate((root) => {
    const rgb = (v) => {
      const c = (v.match(/[\d.]+/g) || []).map(Number);
      return v.startsWith("color(srgb")
        ? c.map((n, i) => (i < 3 ? n * 255 : n))
        : c;
    };
    const lum = (c) =>
      c
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (e) => {
      const chain = [];
      for (; e; e = e.parentElement) chain.unshift(e);
      let base = [255, 255, 255];
      for (const n of chain) {
        const c = rgb(getComputedStyle(n).backgroundColor),
          a = c[3] ?? 1;
        base = base.map((v, i) => (c[i] ?? 0) * a + v * (1 - a));
      }
      return base;
    };
    return [root, ...root.querySelectorAll("*")]
      .filter(
        (e) =>
          !e.closest(
            'svg,[disabled],[aria-hidden="true"],.nm-theme-content,.nm-crop-stage',
          ) &&
          e.tagName !== "OPTION" &&
          e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
          [...e.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ),
      )
      .map((e) => {
        const l1 = lum(rgb(getComputedStyle(e).color)),
          l2 = lum(background(e));
        return {
          element: e.id || e.className || e.tagName,
          text: e.textContent.trim().slice(0, 60),
          ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
        };
      })
      .filter((row) => row.ratio < 4.5);
  });
  expect(issues, selector + " text contrast").toEqual([]);
}
for (const theme of themes)
  test(`${theme}: home, every menu, layout, search, context and study remain readable`, async ({
    page,
  }, info) => {
    await boot(page);
    await page.evaluate((theme) => NeuroMapUISkin.set({ theme }), theme);
    await readable(page, ".nm6-welcome");
    await page.evaluate(() =>
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden")),
    );
    const before = await page.evaluate(() =>
      JSON.stringify({
        root: neuroMapApp.state.root,
        history: neuroMapApp.state.undoStack.length,
        style: neuroMapApp.state.branchStyle,
      }),
    );
    for (const name of ["file", "edit", "insert", "view", "tools", "help"]) {
      await page.locator("#btn-menu-" + name).click();
      await expect(page.locator("#dropdown-" + name)).toBeVisible();
      await readable(page, "#dropdown-" + name);
      await page.keyboard.press("Escape");
    }
    await page.locator("#v6-show-layout").click();
    await readable(page, ".hud-bottom-left");
    await page.locator("#nm-view-picker-trigger").click();
    await readable(page, "#nm-view-picker-gallery");
    await page.keyboard.press("Escape");
    await page.locator("#nm-learn-open").click();
    for (const tab of await page
      .locator("#nm-learn-panel .nm-learn-tabs button")
      .all()) {
      await tab.click();
      await readable(page, "#nm-learn-panel");
    }
    await page.keyboard.press("Control+f");
    await page.locator("#find-query").fill("Strategia");
    await readable(page, "#find-overlay");
    await page.keyboard.press("Escape");
    await page
      .locator("#mindmap-canvas")
      .click({ button: "right", position: { x: 650, y: 500 } });
    await expect(page.locator("#context-menu")).toBeVisible();
    await readable(page, "#context-menu");
    await page.keyboard.press("Escape");
    await page.locator("#btn-toggle-inspector").click();
    await readable(page, "#inspector-sidebar");
    expect(
      await page
        .locator("#inspector-sidebar")
        .evaluate((e) => e.getAnimations().length),
    ).toBe(0);
    const minimap = await page.locator("#nm616-map").evaluate((e) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--nm-skin-top)";
      e.parentElement.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        expected,
        background: getComputedStyle(e).backgroundColor,
        image: getComputedStyle(e).backgroundImage,
      };
    });
    expect(minimap.image).toBe("none");
    expect(minimap.background).toBe(minimap.expected);
    // Actual background samples keep their own color and diagram ink.
    expect(
      await page
        .locator('[data-nm-theme="night"] .nm-theme-preview')
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgb(9, 14, 27)");
    expect(
      await page.evaluate(() =>
        JSON.stringify({
          root: neuroMapApp.state.root,
          history: neuroMapApp.state.undoStack.length,
          style: neuroMapApp.state.branchStyle,
        }),
      ),
    ).toBe(before);
    if (theme === "minimal" || theme === "purple")
      await page.screenshot({
        path: info.outputPath(theme + "-inspector.png"),
      });
    await page.evaluate(() => NeuroMapUISkin.set({ contrast: "high" }));
    await readable(page, "#inspector-sidebar");
  });

test("branch duration applies to actual new branches and respects reduced motion", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.querySelectorAll(".nm6-shade").forEach(e=>e.classList.add("hidden")));
  await openSettings(page, "editor");
  await page.locator("#gl-settings-branch-duration").fill("1000");
  await page.keyboard.press("Escape");
  await expect(page.locator("#nm-motion-preview")).toHaveCount(0);
  const before = await page.evaluate(()=>({history:neuroMapApp.state.undoStack.length,canvases:document.querySelectorAll("canvas").length}));
  await page.evaluate(()=>neuroMapApp.addChild());
  expect(await page.evaluate(()=>NeuroMapMotion.inspect(neuroMapApp).active)).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>NeuroMapMotion.inspect(neuroMapApp).active)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>NeuroMapMotion.inspect(neuroMapApp).active)).toBe(0);
  expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(before.history+1);
  expect(await page.locator("canvas").count()).toBe(before.canvases);
  await page.evaluate(()=>neuroMapApp.closeEditor(true));
  await page.reload();
  await page.waitForFunction(()=>window.NeuroMapMotion&&window.neuroMapApp);
  expect(await page.evaluate(()=>NeuroMapMotion.get().duration)).toBe(1000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(()=>neuroMapApp.addChild());
  expect(await page.evaluate(()=>NeuroMapMotion.inspect(neuroMapApp).active)).toBe(0);
});

test("new-branch text editor participates in the entrance and stays immediately editable", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    NeuroMapMotion.set({ duration: 1000 });
    neuroMapApp.addChild();
  });
  await expect(page.locator("#inline-editor-input")).toBeFocused();
  expect(
    await page
      .locator("#inline-editor-container")
      .evaluate((e) => e.getAnimations().length),
  ).toBe(1);
  await page.locator("#inline-editor-input").fill("Nuovo concetto");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        () => neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).text,
      ),
    )
    .toBe("Nuovo concetto");
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(() => NeuroMapMotion.inspect(neuroMapApp).active),
  ).toBe(0);
  expect(
    await page
      .locator("#inline-editor-container")
      .evaluate((e) => e.getAnimations().length),
  ).toBe(0);
});

const dialogs = [
  ["automatic saving", "#nm611-autosave-open", "#nm611-autosave-overlay"],
  ["paste import", "#btn-import-paste", "#paste-modal"],
  ["smart import", "#nm-doc-import-open", "#nm-doc-import"],
  ["quick capture", "#nm-capture-open", "#nm-capture"],
  ["sharing", "#nm-share-export-open", "#nm-v73-share"],
  ["exchange", "#nm-exchange-open", "#nm-exchange"],
  ["export", "#nm-export-launch", ".nm-export-dialog"],
  ["notes", "#nm-tool-document", "#nm-knowledge-panel"],
  ["outline", "#nm-tool-outline", "#nm-knowledge-panel"],
  ["sources", "#nm-tool-sources", "#nm-knowledge-panel"],
  ["OCR", "#nm-ocr-launch", "#nm-ocr"],
  ["flashcards", "#btn-flashcards", "#flash-modal"],
  ["reading", "#nm-tool-journey", "#nm-knowledge-panel"],
  ["review dates", "#nm-tool-memory", "#nm-knowledge-panel"],
  ["visual study", "#nm-tool-visual-study", "#nm-visual-study"],
  ["Anki", "#nm-tool-anki", "#nm-anki"],
  ["compare", "#nm616-compare-open", "#nm616-compare"],
  ["atlas", "#nm-tool-atlas", "#nm-knowledge-panel"],
  ["wiki links", "#nm-tool-links", "#nm75-overlay"],
  ["tags and fields", "#nm-tool-database", "#nm76-overlay"],
  ["dashboard", "#nm-tool-dashboard", "#nm82-overlay"],
  ["quality", "#nm-tool-quality", "#nm-quality74"],
  ["markers", "#nm62-toolbar-assets", "#nm-creative-library-hub"],
  ["drawing", "#nm-menu-drawing", "#nm-drawing-toolbar"],
  ["illustrations", "#menu-iconify-single", "#nm54-illustration-modal"],
  ["symbols", "#nm-menu-symbols", ".nm-creative-dialog"],
  ["formula", "#nm-menu-formula", ".nm-creative-dialog"],
  ["library", "#nm-menu-library", ".nm-creative-dialog"],
  ["shortcuts", "#btn-shortcuts", "#shortcuts-panel"],
  ["first steps", "#nm7-guide-open", "#nm7-guide-dialog"],
  ["about", "#nm-about-open", "#nm-decision-overlay"],
  ["license", "#nm-license-menu", "#nm6-plan-modal"],
  ["AI assistant", "#btn-ai-settings", "#nm-ai-studio"],
];
for (const [name, trigger, root] of dialogs)
  test(`${name}: open function follows every interface palette`, async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() =>
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden")),
    );
    if(name === "AI assistant")await page.evaluate(()=>{nmProduct.isPro=()=>true;});
    await page.locator(trigger).evaluate((e) => e.click());
    await expect(page.locator(root)).toBeVisible();
    for (const theme of themes) {
      await page.evaluate((theme) => NeuroMapUISkin.set({ theme }), theme);
      await readable(page, root);
    }
  });

test("AI connection settings keep every field readable in all palettes", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    document.getElementById("btn-ai-settings").click();
  });
  await page.locator("#nm-ai-connections-open").click();
  await page.locator("#nm-ai-text-settings").click();
  await expect(page.locator("#ai-settings-modal")).toBeVisible();
  for (const theme of themes) {
    await page.evaluate((theme) => NeuroMapUISkin.set({ theme }), theme);
    await readable(page, "#ai-settings-modal");
  }
});

test("image editing and crop controls follow the palette while the photograph stays untouched", async ({
  page,
}) => {
  await boot(page);
  const src = await page.evaluate(async () => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 120;
    c.getContext("2d").fillRect(0, 0, 200, 120);
    const a = neuroMapApp,
      image = a.state.addImageItem({
        src: c.toDataURL(),
        width: 200,
        height: 120,
        mode: "free",
        worldPos: { x: 150, y: 100 },
      });
    a.selectImage(image.id);
    await a.renderer.prepareExportImages();
    return image.src;
  });
  await expect(page.locator("#nm-img-caption")).toBeVisible();
  for (const theme of themes) {
    await page.evaluate((theme) => NeuroMapUISkin.set({ theme }), theme);
    await readable(page, "#inspector-sidebar");
  }
  await page.locator("#nm-img-crop").click();
  await expect(page.locator("#nm-image-crop-dialog")).toBeVisible();
  for (const theme of themes) {
    await page.evaluate((theme) => NeuroMapUISkin.set({ theme }), theme);
    await readable(page, "#nm-image-crop-dialog");
  }
  expect(await page.evaluate(() => neuroMapApp.state.images[0].src)).toBe(src);
});

test("interface palettes leave the map export and logical geometry unchanged", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async (themes) => {
    const a = neuroMapApp;
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    const before = JSON.stringify(a.state.createSnapshot());
    const exported = [];
    const original = a.io.triggerDownload;
    try {
      a.io.triggerDownload = async (blob) => {
        exported.push(await blob.text());
        return true;
      };
      for (const theme of themes) {
        NeuroMapUISkin.set({ theme });
        await a.io.exportSVG();
      }
    } finally {
      a.io.triggerDownload = original;
    }
    return {
      sameExport: exported.every((s) => s === exported[0]),
      sameState: JSON.stringify(a.state.createSnapshot()) === before,
    };
  }, themes);
  expect(result).toEqual({ sameExport: true, sameState: true });
});

test("all six AI task screens keep their controls readable", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    neuroMapApp.openAIStudio();
  });
  const ids = await page
    .locator(".nm-ai-task-grid button")
    .evaluateAll((elements) => elements.map((e) => e.id));
  expect(ids).toHaveLength(6);
  for (const id of ids) {
    await page.evaluate((id) => document.getElementById(id).click(), id);
    for (const theme of themes) {
      await page.evaluate((theme) => NeuroMapUISkin.set({ theme }), theme);
      await readable(page, "#nm-ai-studio");
    }
  }
});
