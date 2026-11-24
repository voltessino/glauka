const { test, expect } = require("@playwright/test");
async function boot(page) {
  await page.addInitScript(() => localStorage.setItem("nm6_welcome_seen", "1"));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () => window.neuroMapApp && window.NeuroMapCaptionEditor,
  );
  await page.evaluate(async () => {
    const a = neuroMapApp;
    a.createNewTab("Endocrino");
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 160;
    c.getContext("2d").fillRect(0, 0, 240, 160);
    a.state.addImageItem({
      src: c.toDataURL(),
      width: 300,
      height: 200,
      mode: "free",
      worldPos: { x: 220, y: 120 },
    });
    a.selectImage(a.state.images.at(-1).id);
    await a.renderer.prepareExportImages();
  });
}
async function range(page, text) {
  await page.locator("#nm-img-caption").evaluate((e, text) => {
    const start = e.value.indexOf(text);
    e.focus();
    e.setSelectionRange(start, start + text.length);
    e.dispatchEvent(new Event("select"));
  }, text);
}
test("photo captions style selected words independently and preserve the image pixels", async ({
  page,
}, info) => {
  await boot(page);
  const original = await page.evaluate(() => neuroMapApp.state.images[0].src);
  const field = page.locator("#nm-img-caption");
  await field.fill("insulina e glucagone");
  await field.dispatchEvent("change");
  await range(page, "insulina");
  await page.locator("#nm-caption-bold").click();
  await page.locator("#nm-caption-color").fill("#aa00ff");
  await range(page, "glucagone");
  await page.locator("#nm-caption-italic").click();
  await page.locator("#nm-caption-underline").click();
  await page.locator("#nm-caption-color").fill("#0088ff");
  await field.blur();
  const result = await page.evaluate(() => {
    const img = neuroMapApp.state.images[0],
      C = NeuroMapCaption,
      d = C.sanitize(img.caption, img.captionStyles);
    return {
      one: C.selectedStyle(d, 0, 8),
      two: C.selectedStyle(d, 11, 20),
      src: img.src,
      height: img.height,
      snapshot: neuroMapApp.state.createSnapshot().images[0],
    };
  });
  expect(result.one).toMatchObject({ bold: true, color: "#aa00ff" });
  expect(result.two).toMatchObject({
    italic: true,
    underline: true,
    color: "#0088ff",
  });
  expect(result.src).toBe(original);
  expect(result.height).toBeGreaterThan(200);
  expect(result.snapshot.captionStyles).toBeTruthy();
  await page.screenshot({ path: info.outputPath("rich-caption.png") });
});
test("automatic lists accept a), 1) and hyphens inside captions and stop on an empty item", async ({
  page,
}) => {
  await boot(page);
  const field = page.locator("#nm-img-caption");
  await page.evaluate(()=>NeuroMapCaption.setAutomaticLists(true));
  for (const [text, next] of [
    ["a) insulina", "b) "],
    ["1) insulina", "2) "],
    ["- insulina", "- "],
  ]) {
    await field.fill(text);
    await field.press("End");
    await field.press("Enter");
    await expect(field).toHaveValue(text + "\n" + next);
    await field.press("Enter");
    await expect(field).toHaveValue(text + "\n");
  }
  await field.fill("insulina\nglucagone");
  await page.locator("#nm-caption-list").selectOption("number");
  await expect(field).toHaveValue("1. insulina\n2. glucagone");
  await page.locator("#nm-caption-list").selectOption("roman");
  await expect(field).toHaveValue("i. insulina\nii. glucagone");
});
test("node editing recognizes typed lists while prose keeps Enter to confirm", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    NeuroMapCaption.setAutomaticLists(true);
    neuroMapApp.selectNode(neuroMapApp.state.root.id);
    neuroMapApp.editSelected();
  });
  const input = page.locator("#inline-editor-input");
  await input.fill("a) Primo");
  await input.press("End");
  await input.press("Enter");
  await expect(input).toHaveValue("a) Primo\nb) ");
  await input.type("Secondo");
  await input.press("Control+Enter");
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "a) Primo\nb) Secondo",
  );
  await page.evaluate(() => neuroMapApp.editSelected());
  await input.fill("Testo normale");
  await input.press("Enter");
  await expect(input).toBeHidden();
  expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
    "Testo normale",
  );
});
test("caption drafts cancel cleanly; committed rich formatting is undoable", async ({
  page,
}) => {
  await boot(page);
  const before = await page.evaluate(() =>
    JSON.stringify(neuroMapApp.state.images[0]),
  );
  const field = page.locator("#nm-img-caption");
  await field.fill("Da annullare");
  await field.press("Escape");
  expect(
    await page.evaluate(() => JSON.stringify(neuroMapApp.state.images[0])),
  ).toBe(before);
  await field.fill("Testo");
  await field.dispatchEvent("change");
  await range(page, "Testo");
  await page.locator("#nm-caption-bold").click();
  expect(
    await page.evaluate(
      () => neuroMapApp.state.images[0].captionStyles[0].bold,
    ),
  ).toBe(true);
  await field.blur();
  await page.evaluate(() => {
    neuroMapApp.state.undo();
    neuroMapApp.recalculateAndRender();
  });
  expect(
    await page.evaluate(() => neuroMapApp.state.images[0].captionStyles || []),
  ).toEqual([]);
});
test("SVG and project roundtrips keep caption colours, styles and long text", async ({
  page,
}) => {
  await boot(page);
  const field = page.locator("#nm-img-caption");
  const text = "insulina e glucagone\n" + "Descrizione lunga ".repeat(15);
  await field.fill(text);
  await field.dispatchEvent("change");
  await range(page, "insulina");
  await page.locator("#nm-caption-color").fill("#aa00ff");
  await field.blur();
  const result = await page.evaluate(async () => {
    const a = neuroMapApp;
    let blob;
    const old = a.io.triggerDownload;
    a.io.triggerDownload = (value) => (blob = value);
    try {
      await a.io.exportSVG();
    } finally {
      a.io.triggerDownload = old;
    }
    return {
      svg: await blob.text(),
      image: a.state.constructor.cloneImages(a.state.images)[0],
    };
  });
  expect(result.svg).toContain("data:image/png;base64,");
  expect(result.image.caption).toBe(text);
  expect(result.image.caption.length).toBeGreaterThan(180);
  expect(result.image.captionStyles).toMatchObject([{ color: "#aa00ff" }]);
});

test("PR132 selection: balanced geometry stays single-centred and closing another tab restores the camera", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    const a = neuroMapApp;
    a.importHierarchy(
      {
        text: "Centro",
        children: Array.from({ length: 6 }, (_, i) => ({
          text: "Ramo " + i,
          children: [],
        })),
      },
      { newTab: true },
    );
  });
  await page.locator("#v6-show-layout").click();
  await page.locator("#nm-layout-modes [data-mode=balanced]").click();
  const layout = await page.evaluate(() => ({
    mode: neuroMapApp.state.root.layoutBalanceMode,
    sides: neuroMapApp.state.root.children.map((n) => n.side),
  }));
  expect(layout.mode).toBe("geometry");
  expect(new Set(layout.sides).size).toBe(2);
  const camera = await page.evaluate(async () => {
    const a = neuroMapApp;
    a.renderer.camera = { x: 321, y: 456, zoom: 0.42 };
    a.saveActiveTabSnapshot();
    a.createNewTab("Altra");
    a.tabs.forEach((t) => (t.state.isDirty = false));
    await a.closeTab(a.activeTabId);
    return a.renderer.camera;
  });
  expect(camera).toEqual({ x: 321, y: 456, zoom: 0.42 });
});

test("caption colours are actually painted and Ctrl+S preserves the rich document on reopen", async ({
  page,
}) => {
  await boot(page);
  const field = page.locator("#nm-img-caption");
  await field.fill("insulina e glucagone");
  await field.dispatchEvent("change");
  await range(page, "insulina");
  await field.press("Control+b");
  await page.locator("#nm-caption-color").fill("#aa00ff");
  await range(page, "glucagone");
  await field.press("Control+i");
  await field.press("Control+u");
  await page.locator("#nm-caption-color").fill("#0088ff");
  await field.focus();
  await page.evaluate(() => {
    window.savedCaptionProject = null;
    window.neuromapDesktop = {
      saveProject: async (request) => {
        savedCaptionProject = request.json;
        return { path: "C:/QA/caption.neuromap", name: "caption.neuromap" };
      },
      writeWorkspace: async () => ({}),
    };
  });
  await field.press("Control+s");
  await expect
    .poll(() => page.evaluate(() => !!savedCaptionProject))
    .toBe(true);
  const payload = await page.evaluate(() => savedCaptionProject);
  expect(payload).toContain("captionStyles");
  const painted = await page.evaluate(() => {
    const a = neuroMapApp,
      c = document.createElement("canvas");
    c.width = 800;
    c.height = 800;
    const ctx = c.getContext("2d"),
      original = a.renderer.ctx;
    a.renderer.ctx = ctx;
    try {
      a.renderer.drawImagesLayer("front");
    } finally {
      a.renderer.ctx = original;
    }
    const data = ctx.getImageData(0, 0, 800, 800).data;
    let purple = 0,
      blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 170 && data[i + 1] === 0 && data[i + 2] === 255) purple++;
      if (data[i] === 0 && data[i + 1] === 136 && data[i + 2] === 255) blue++;
    }
    return { purple, blue };
  });
  expect(painted.purple).toBeGreaterThan(0);
  expect(painted.blue).toBeGreaterThan(0);
  await page.evaluate(() => {
    delete window.neuromapDesktop;
  });
  const choosing = page.waitForEvent("filechooser");
  await page.keyboard.press("Control+o");
  const chooser = await choosing;
  await chooser.setFiles({
    name: "caption.neuromap",
    mimeType: "application/json",
    buffer: Buffer.from(payload),
  });
  await expect
    .poll(() => page.evaluate(() => neuroMapApp.state.images[0]?.caption))
    .toBe("insulina e glucagone");
  expect(
    await page.evaluate(() =>
      NeuroMapCaption.selectedStyle(
        NeuroMapCaption.sanitize(
          neuroMapApp.state.images[0].caption,
          neuroMapApp.state.images[0].captionStyles,
        ),
        11,
        20,
      ),
    ),
  ).toMatchObject({ italic: true, underline: true, color: "#0088ff" });
});
for (const locale of ["it", "en"])
  test(
    "caption controls fit a narrow window and translate " + locale,
    async ({ page }, info) => {
      await page.addInitScript(
        (locale) => localStorage.setItem("nm6_locale", locale),
        locale,
      );
      await boot(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator("#nm-caption-bold")).toHaveAttribute(
        "aria-label",
        locale === "en" ? "Bold" : "Grassetto",
      );
      // Wait for the responsive sidebar to settle after resizing. Bounding
      // rectangles can differ from CSS pixels by a fractional pixel.
      await expect
        .poll(async () =>
          page.locator(".nm-caption-toolbar").evaluate((el) => {
            const rects = [...el.children].map((child) =>
              child.getBoundingClientRect(),
            );
            return {
              overflow: el.scrollWidth > el.clientWidth + 1,
              targets: rects
                .slice(0, 3)
                .every((r) => Math.round(r.width) >= 36),
              inside: rects.every((r) => r.x >= -1 && r.right <= 391),
            };
          }),
        )
        .toEqual({ overflow: false, targets: true, inside: true });
      await page.screenshot({
        path: info.outputPath("caption-" + locale + "-narrow.png"),
      });
    },
  );


test("image inspector keeps only image tools and saves caption alignment and size", async ({page})=>{
 await boot(page);
 await expect(page.locator("#image-controls")).toBeVisible();
 await expect(page.locator("#inspector-sidebar")).toHaveAttribute("data-nm-selection","image");
 await expect(page.locator("#inspector-sidebar .inspector-header")).toBeHidden();
 const field=page.locator("#nm-img-caption");
 await field.fill("Una spiegazione importante");
 await field.dispatchEvent("change");
 // Visible alignment controls are icon buttons; the select stays as the hidden value holder.
 await page.locator('.nm-caption-align-buttons button[data-align="right"]').click();
 await page.locator("#nm-caption-font-size").evaluate(el=>{
  el.value="26";
  el.dispatchEvent(new Event("input",{bubbles:true}));
  el.dispatchEvent(new Event("change",{bubbles:true}));
 });
 const result=await page.evaluate(()=>{
  const a=neuroMapApp,img=a.state.images.at(-1),copy=a.state.createSnapshot().images.at(-1);
  return {align:img.captionAlign,fontSize:img.captionFontSize,
    copyAlign:copy.captionAlign,copySize:copy.captionFontSize,
    text:img.caption,src:img.src};
 });
 expect(result).toMatchObject({align:"right",fontSize:26,copyAlign:"right",copySize:26,
  text:"Una spiegazione importante"});
 expect(result.src).toMatch(/^data:image\/png/);
});
test("copying a selected image publishes PNG to system clipboard, not placeholder text",async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
  window.__clipboardWrites=[];
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
   write:async items=>{window.__clipboardWrites.push(items);}
  }});
  neuroMapApp.copySelection();
 });
 await expect.poll(()=>page.evaluate(()=>window.__clipboardWrites.length)).toBe(1);
 const result=await page.evaluate(async()=>{
  const item=window.__clipboardWrites[0][0];
  const blob=await item.getType("image/png");
  return {type:blob.type,size:blob.size,internal:neuroMapApp.internalClipboard?.kind};
 });
 expect(result.type).toBe("image/png");
 expect(result.size).toBeGreaterThan(20);
 expect(result.internal).toBe("image");
});
