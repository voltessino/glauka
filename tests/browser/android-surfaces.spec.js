const {chooseTool}=require("./android-tools-helper");
const { test, expect } = require("@playwright/test");
async function boot(page, theme = "white") {
  await page.addInitScript((theme) => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", "it");
    localStorage.setItem("nm615.canvas.theme", theme);
  }, theme);
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      document.body.classList.contains("glauka-mobile-app"),
  );
}
// Audit actual rendered colours, including late-injected tool styles and inline colours.
async function audit(page, selector) {
  return page.locator(selector).evaluate((root) => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (e) => {
      const c = rgb(getComputedStyle(e).backgroundColor),
        a = c.length === 4 ? c[3] : 1;
      const under = e.parentElement
        ? background(e.parentElement)
        : [255, 255, 255];
      return under.map((v, i) => (c[i] || 0) * a + v * (1 - a));
    };
    const issues = [];
    const bounds = root.getBoundingClientRect();
    for (const el of root.querySelectorAll(
      "button,input,select,textarea,label,small,strong,p,summary,output,span,section,header",
    )) {
      if (
        el.closest(
          "[data-glauka-user-content],.nm-theme-preview,svg,.nm74-image",
        )
      )
        continue;
      const b = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      if (
        !b.width ||
        !b.height ||
        b.bottom < bounds.top ||
        b.top > bounds.bottom ||
        s.visibility === "hidden" ||
        s.display === "none" ||
        el.matches(":disabled")
      )
        continue;
      const bg = background(el),
        fg = rgb(s.color),
        text = (el.textContent || el.value || "").trim();
      if (
        lum(bg) < 0.72 &&
        !el.closest(
          "button.nm74-primary,button.v4-primary,button.nm6-primary,button.primary,.nm-decision-confirm",
        )
      )
        issues.push({
          reason: "dark surface",
          tag: el.tagName,
          id: el.id,
          cls: el.className,
          bg,
        });
      if (
        text &&
        fg.length >= 3 &&
        !el.matches(
          "input[type=range],input[type=checkbox],input[type=color],input[type=radio]",
        )
      ) {
        const contrast =
          (Math.max(lum(bg), lum(fg)) + 0.05) /
          (Math.min(lum(bg), lum(fg)) + 0.05);
        // Purple primary buttons are intentionally filled. Audit their text contrast too.
        if (contrast < 4.4)
          issues.push({
            reason: "contrast",
            id: el.id,
            cls: el.className,
            text: text.slice(0, 65),
            contrast,
          });
      }
    }
    return issues;
  });
}
for (const width of [320, 393, 577])
  for (const theme of ["white", "night"]) {
    test(`branch arrangement is a readable vertical form at ${width}px on ${theme} map`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 852 });
      await boot(page, theme);
      await page.locator("#glauka-options-open").click();
      await page
        .getByRole("button", { name: "Disposizione dei rami", exact: true })
        .click();
      const hud = page.locator("#glauka-sheet-content .hud-bottom-left");
      await expect(hud).toBeVisible();
      const geometry = await hud.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          width: box.width,
          scroll: el.scrollWidth,
          sections: [
            ...el.querySelectorAll(":scope > .nm-settings-section"),
          ].map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          }),
        };
      });
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
      expect(geometry.sections).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(geometry.sections[i].w).toBeGreaterThan(geometry.width * 0.85);
        if (i)
          expect(geometry.sections[i].y).toBeGreaterThanOrEqual(
            geometry.sections[i - 1].y + geometry.sections[i - 1].h,
          );
      }
      expect(await audit(page, "#glauka-sheet-content")).toEqual([]);
      const mode = page.locator("#nm-layout-modes button").nth(1);
      await mode.click();
      await expect(mode).toHaveAttribute("aria-pressed", "true");
      await expect(mode).toHaveCSS("background-color", "rgb(238, 232, 255)");
      const gap = page.locator("#nm68-branch-gap");
      await gap.scrollIntoViewIfNeeded();
      await gap.focus();
      await gap.press("Home");
      for (let i = 0; i < 30; i++) await gap.press("ArrowRight");
      await expect(page.locator("#nm68-gap-value")).toContainText("180");
      await hud.evaluate((el) => {
        document.getElementById("glauka-sheet-content").scrollTop = 0;
      });
      await page.screenshot({ path: info.outputPath("arrangement.png") });
    });
  }
test("all fourteen tools use explicit names and consistent surfaces after their styles load", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#nm74-launch").click();
  const names = [
    "Appunti rapidi",
    "Importa documenti",
    "Scrivi dalla mappa",
    "Citazioni PDF",
    "Cerca nelle mappe",
    "Note e collegamenti",
    "Tag e proprietà",
    "Riepilogo mappe",
    "Quiz con immagini",
    "Flashcard",
    "Attività e scadenze",
    "Controlla la mappa",
    "Condividi la mappa",
    "Confronta copie",
  ];
  const tabs = page.locator(".nm74-nav .nm74-tab");
  await expect(tabs).toHaveCount(14);
  const ids = [
    "capture",
    "documents",
    "writing",
    "sources",
    "atlas",
    "wiki",
    "database",
    "dashboard",
    "image",
    "cards",
    "work",
    "quality",
    "share",
    "exchange",
  ];
  for (let i = 0; i < 14; i++) {
    const currentTab = page.locator('.nm74-tab[data-section="' + ids[i] + '"]');
    await expect(currentTab).toContainText(names[i]);
    if (await page.locator("#nm74-tools-back").isVisible())
      await page.locator("#nm74-tools-back").click();
    await chooseTool(page,'.nm74-tab[data-section="' + ids[i] + '"]');
    await expect(currentTab).toHaveAttribute("aria-selected", "true");
    await expect(currentTab).toHaveCSS(
      "background-color",
      "rgb(238, 232, 255)",
    );
    const text = await page.locator("#nm74-overlay").innerText();
    expect(text).not.toMatch(/\bAtlas\b|Knowledge Database|\bDashboard\b/);
    expect(await audit(page, "#nm74-overlay .nm74-sheet"), names[i]).toEqual(
      [],
    );
    for (const fraction of [0.5, 1]) {
      await page
        .locator("#nm74-overlay .nm74-content")
        .evaluate((el, fraction) => {
          el.scrollTop = el.scrollHeight * fraction;
        }, fraction);
      expect(
        await audit(page, "#nm74-overlay .nm74-sheet"),
        names[i] + " while scrolling",
      ).toEqual([]);
    }
    await page.locator("#nm74-overlay .nm74-content").evaluate((el) => {
      el.scrollTop = 0;
    });
    if ([4, 6, 7].includes(i))
      await page.screenshot({ path: info.outputPath("tool-" + i + ".png") });
  }
});
test("style, command search and graphic library share the same light palette", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page, "night");
  await page.locator("#glauka-style-open").click();
  expect(await audit(page, "#inspector-sidebar")).toEqual([]);
  await page.screenshot({ path: info.outputPath("style.png") });
  await page.keyboard.press("Escape");
  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Tutti i comandi", exact: true })
    .click();
  expect(await audit(page, ".nm-android-commands-panel")).toEqual([]);
  await page.keyboard.press("Escape");
  await page.locator("#glauka-add-open").click();
  await page
    .getByRole("button", { name: "Disegni e simboli", exact: true })
    .click();
  await expect(page.locator("#nm-creative-library-hub")).toBeVisible();
  expect(await audit(page, "#nm-creative-library-hub .nm-creative-dialog")).toEqual([]);
});
test("AI, flashcards, symbols and confirmation dialogs remain readable inside the phone", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page, "night");
  await page.evaluate(() => neuroMapApp.aiStudio.open());
  await expect(page.locator("#nm-ai-studio")).toBeVisible();
  const box = await page.locator("#nm-ai-studio").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(393);
  expect(await audit(page, "#nm-ai-studio")).toEqual([]);
  await page.screenshot({ path: info.outputPath("ai.png") });
  await page.evaluate(() => neuroMapApp.aiStudio.panel.classList.add("hidden"));
  await page.evaluate(() => document.getElementById("btn-flashcards").click());
  await expect(page.locator("#flash-modal")).toBeVisible();
  expect(await audit(page, "#flash-modal .v4-modal")).toEqual([]);
  await page.evaluate(() => neuroMapApp.closeFlashcards());
  await page.evaluate(() => NeuroMapCreative.symbolsDialog(neuroMapApp));
  await expect(page.locator("#nm-symbols-dialog")).toBeVisible();
  expect(await audit(page, "#nm-symbols-dialog .nm-creative-dialog")).toEqual(
    [],
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    window._surfaceConfirm = neuroMapApp.nmAsk({
      title: "Elimina ramo",
      message: "Vuoi eliminare questo ramo?",
      choices: [
        { value: "cancel", text: "Annulla" },
        { value: "delete", text: "Elimina", danger: true },
      ],
    });
  });
  await expect(page.locator("#nm-decision-panel")).toBeVisible();
  expect(await audit(page, "#nm-decision-panel")).toEqual([]);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window._surfaceConfirm)).toBe("cancel");
});
test("symbols stay inside a resized viewport and opening them never focuses the search", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#glauka-add-open").click();
  await page
    .getByRole("button", { name: "Disegni e simboli", exact: true })
    .click();
  await expect(page.locator("#nm-creative-library-hub-title")).toContainText("Libreria creativa");
  await expect(page.locator("#nm-creative-library-content input[type=search]")).not.toBeFocused();
  await page.locator("#nm-creative-library-content input[type=search]").click();
  await page.setViewportSize({ width: 393, height: 420 });
  await expect(page.locator("body")).toHaveClass(/glauka-keyboard-open/);
  const modal = page.locator("#nm-creative-library-hub .nm-creative-dialog");
  const rect = await modal.boundingBox();
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(420);
  await expect(page.locator("#nm-creative-library-hub-close")).toBeInViewport();
  await page.locator("#nm-creative-library-content input[type=search]").fill("priorità");
  await expect(page.locator("#nm-creative-library-content input[type=search]")).toHaveValue("priorità");
  await page.screenshot({ path: info.outputPath("symbols-keyboard.png") });
  await page.locator("#nm-creative-library-hub-close").click();
  await expect(page.locator("#nm-creative-library-hub")).toHaveCount(0);
});
test("style scope is compact, editable on demand and its node badge has contrast", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#glauka-style-open").click();
  const fold = page.locator(".glauka-scope-options");
  await expect(fold).not.toHaveAttribute("open");
  await expect(page.locator("#nm-format-target")).toBeHidden();
  expect((await fold.boundingBox()).height).toBeLessThan(70);
  await expect(page.locator("#inspector-node-badge")).toHaveCSS(
    "color",
    "rgb(76, 41, 159)",
  );
  await fold.locator("summary").click();
  await page.locator("#nm-format-target").selectOption("subtree");
  await fold.locator("summary").click();
  await expect(fold.locator("summary")).toContainText("Ramo e discendenti");
  await expect(page.locator("#nm-format-target")).toHaveValue("subtree");
  await page.screenshot({ animations:"disabled",path: info.outputPath("style-compact.png") });
});
test("tools catalogue has four activity groups and retains a draft when returning to it", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#nm74-launch").click();
  await expect(page.locator(".nm74-tool-group h3")).toHaveText([
    "Crea e raccogli",
    "Studia e ripassa",
    "Organizza e ritrova",
    "Controlla e condividi",
  ]);
  await expect(page.locator(".nm74-tab small")).toHaveCount(14);
  await page.screenshot({ path: info.outputPath("tools-catalogue.png") });
  await page.locator(".nm74-tab[data-section=capture]").click();
  await expect(page.locator(".nm74-nav")).toBeHidden();
  const field = page.locator(".nm74-content input").first();
  await field.fill("Appunto da conservare");
  await page.locator("#nm74-tools-back").click();
  await page.locator(".nm74-tab[data-section=capture]").click();
  await expect(field).toHaveValue("Appunto da conservare");
});
test('tools catalogue scrolls vertically with a real touch gesture',async({page})=>{
 await page.setViewportSize({width:393,height:852});await boot(page);await page.locator('#nm74-launch').click();
 await page.locator('.nm74-experimental>summary').click();
 const nav=page.locator('.nm74-nav');await expect(nav).toHaveCSS('touch-action','pan-y');
 const client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:650,id:1}]});
 for(let i=1;i<=14;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:120,y:650-i*25,id:1}]});await page.waitForTimeout(18);}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>nav.evaluate(el=>el.scrollTop)).toBeGreaterThan(80);
});

for (const theme of ["white", "night"]) {
  test(`branch colour samples keep their authored colours on ${theme} map`, async ({page}, info) => {
    await page.setViewportSize({width:393,height:852});
    await boot(page,theme);
    await page.locator("#glauka-style-open").click();
    const grid=page.locator("#inspector-swatch-grid");
    await grid.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
    const swatches=grid.locator("button.color-swatch");
    expect(await swatches.count()).toBeGreaterThan(5);
    const matches=()=>swatches.evaluateAll(nodes=>nodes.every(el=>{
      const probe=document.createElement('span');probe.style.backgroundColor=el.dataset.color;document.body.append(probe);
      const expected=getComputedStyle(probe).backgroundColor;probe.remove();return getComputedStyle(el).backgroundColor===expected;
    }));
    expect(await matches()).toBe(true);
    const chosen=swatches.nth(2),color=await chosen.getAttribute('data-color');
    await chosen.click();
    expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).color)).toBe(color);
    await chosen.evaluate(el=>{el.classList.add('active');el.setAttribute('aria-pressed','true');});
    expect(await matches()).toBe(true);
    await grid.screenshot({path:info.outputPath('branch-colours.png')});
  });
}
