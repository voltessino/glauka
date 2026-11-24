const { test, expect } = require("@playwright/test");
async function boot(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      !document.documentElement.classList.contains("glauka-booting"),
  );
}
test("the base chrome stays hidden before JavaScript initializes", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5174/index.html");
  await expect(page.locator("#glauka-startup")).toBeVisible();
  await expect(page.locator(".top-chrome")).toBeHidden();
  await context.close();
});
test("fresh startup is Glauka Prisma Vivo, white, with seven available structures", async ({
  page,
}, info) => {
  await boot(page);
  await expect(page).toHaveTitle("Glauka");
  await expect(page.locator("body")).toHaveAttribute("data-nm-skin", "prisma");
  await expect(page.locator("#glauka-startup")).toBeHidden();
  await expect(page.locator(".nm-home-choice")).toHaveCount(7);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  await expect(page.locator(".nm6-hero svg")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("glauka-home.png") });
});
test("font controls persist through history, native serialization and SVG without changing branch color", async ({
  page,
}, info) => {
  await boot(page);
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    neuroMapApp.createNewTab("Progetto");
    neuroMapApp.addChild();
    neuroMapApp.closeEditor(true);
  });
  await page.locator("#btn-toggle-inspector").click();
  const before = await page.evaluate(() => {
    const a = neuroMapApp,
      n = a.state.findNode(a.state.selectedNodeId);
    return { id: n.id, color: n.color, history: a.state.undoStack.length };
  });
  await page.locator("#glauka-font-family").selectOption("Georgia");
  await page.locator("#glauka-font-size").fill("24");
  await page.locator("#glauka-font-size").dispatchEvent("change");
  await page.locator("#glauka-font-color").fill("#8b2355");
  await page.locator("#glauka-font-color").dispatchEvent("change");
  await page.locator("#nm-text-underline").click();
  await page.locator(".glauka-text-more>summary").click();
  await page.locator("#glauka-font-strike").click();
  const result = await page.evaluate(async () => {
    const a = neuroMapApp,
      n = a.state.findNode(a.state.selectedNodeId);
    let svg;
    const save = a.io.triggerDownload;
    try {
      a.io.triggerDownload = async (b) => {
        svg = await b.text();
        return true;
      };
      await a.io.exportSVG();
    } finally {
      a.io.triggerDownload = save;
    }
    return {
      node: n,
      snapshot: a.state.createSnapshot().root,
      svg,
      payload: JSON.stringify(a.io.buildSerializedProjectPayload()),
    };
  });
  expect(result.node).toMatchObject({
    fontFamily: "Georgia",
    fontSize: 24,
    fontColor: "#8b2355",
    fontUnderline: true,
    fontStrike: true,
    color: before.color,
  });
  expect(result.svg).toContain("Georgia, serif");
  expect(result.svg).toContain('fill="#8b2355"');
  expect(result.svg).toContain("underline line-through");
  expect(result.payload).toContain('"fontColor":"#8b2355"');
  expect(
    await page.evaluate(
      (svg) =>
        new DOMParser()
          .parseFromString(svg, "image/svg+xml")
          .querySelector("parsererror") === null,
      result.svg,
    ),
  ).toBe(true);
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(
      () =>
        neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId)
          .fontStrike || false,
    ),
  ).toBe(false);
  await page.evaluate(() => neuroMapApp.redo());
  expect(
    await page.evaluate(
      () =>
        neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).fontStrike,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("classic-text-toolbar.png") });
  await page.locator(".glauka-text-more>summary").click();
  await page
    .getByRole("button", {
      name: "Cancella formattazione del testo",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(
      () =>
        neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId)
          .fontColor ?? null,
    ),
  ).toBeNull();
  await page.evaluate(() => neuroMapApp.undo());
  expect(
    await page.evaluate(
      () =>
        neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).fontColor,
    ),
  ).toBe("#8b2355");
});
test("one Shapes menu selects the actual drawing tool and closes on Escape", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    document
      .querySelectorAll(".nm6-shade")
      .forEach((e) => e.classList.add("hidden"));
    document.getElementById("nm-menu-drawing").click();
  });
  await expect(page.locator("#nm-draw-ellipse")).toBeHidden();
  await page.locator("#glauka-shapes-trigger").click();
  await expect(page.locator("#glauka-shapes-menu")).toBeVisible();
  await expect(page.locator("#glauka-shapes-menu button")).toHaveCount(4);
  await page.locator("#nm-draw-ellipse").click();
  await expect(page.locator("#glauka-shapes-menu")).toBeHidden();
  expect(await page.evaluate(() => neuroMapApp._nmDraw.tool)).toBe("ellipse");
  await page.locator("#glauka-shapes-trigger").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#glauka-shapes-menu")).toBeHidden();
});
