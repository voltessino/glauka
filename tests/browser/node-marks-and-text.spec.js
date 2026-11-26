const { test, expect } = require("@playwright/test");

async function openEditor(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(() => window.neuroMapApp && window.GlaukaNodeLinks && window.NM614);
  await page.evaluate(() => {
    document.querySelectorAll(".nm6-shade").forEach((node) => node.classList.add("hidden"));
    const app = window.neuroMapApp;
    app.importHierarchy({
      text: "Mappa",
      children: [{ text: "Ramo lungo", children: [] }, { text: "Seconda", children: [] }],
    }, { newTab: true });
    app.recalculateAndRender();
  });
}

test("note and link icons are clickable and a plain root keeps its box", async ({ page }) => {
  await openEditor(page);
  const result = await page.evaluate(() => {
    const app = window.neuroMapApp;
    const root = app.state.root;
    const before = { ...app.layout.getLayout(root.id) };
    const child = root.children[0];
    child.notes = "Promemoria del ramo";
    child.linkUrl = "https://example.com/glauka";
    app.recalculateAndRender();
    const after = app.layout.getLayout(root.id);
    const box = app.layout.getLayout(child.id);
    const marks = window.GlaukaNodeLinks.marks(child, box);
    const screen = app.renderer.worldToScreen(marks[0].x + 7, marks[0].y + 7);
    const link = app.renderer.worldToScreen(marks[1].x + 7, marks[1].y + 7);
    return {
      rootSame: before.width === after.width && before.height === after.height && before.x === after.x && before.y === after.y,
      note: app.findHit(screen.x, screen.y)?.type,
      link: app.findHit(link.x, link.y)?.type,
      lines: box.lines.join(""),
    };
  });
  expect(result.rootSame).toBe(true);
  expect(result.note).toBe("note");
  expect(result.link).toBe("link");
  expect(result.lines).toContain("Ramo lungo");
});

test("a long label stays wrapped in the writing box and on the map", async ({ page }) => {
  await openEditor(page);
  const result = await page.evaluate(() => {
    const app = window.neuroMapApp;
    const child = app.state.root.children[0];
    app.selectNode(child.id);
    app.editSelected("");
    const field = document.getElementById("inline-editor-input");
    const sentence = "Le radici assorbono acqua e tengono la pianta ferma nel terreno del giardino. ";
    field.value = sentence.repeat(12);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const style = getComputedStyle(field);
    const box = field.getBoundingClientRect();
    app.closeEditor(true);
    const layout = app.layout.getLayout(child.id);
    return {
      whiteSpace: style.whiteSpace,
      overflowY: style.overflowY,
      wraps: style.whiteSpace.includes("pre-wrap"),
      fits: field.scrollHeight <= box.height + 2 || box.height >= Math.min(window.innerHeight * 0.72, window.innerHeight - 110) - 2,
      full: layout.lines.join(" ").includes("giardino") && layout.lines.join("").length >= sentence.repeat(12).replace(/\s+/g, "").length * 0.9,
      height: layout.height,
    };
  });
  expect(result.wraps).toBe(true);
  expect(result.overflowY).toBe("auto");
  expect(result.fits).toBe(true);
  expect(result.full).toBe(true);
  expect(result.height).toBeGreaterThan(40);
});

test("one .gk file keeps every open tab, notes and links", async ({ page }) => {
  await openEditor(page);
  const result = await page.evaluate(async () => {
    const app = window.neuroMapApp;
    app.state.root.children[0].notes = "Nota uno";
    app.state.root.children[0].linkUrl = "https://example.com/uno";
    app.addTab(app.newState("Seconda mappa"), "Seconda mappa");
    const before = new Set(app.tabs.map((tab) => tab.id));
    const payload = window.NM614.workspaceDocument(app, app.tabs);
    const file = new File([JSON.stringify(payload)], "mappe.gk", { type: "application/json" });
    await app.importFile(file, { newTab: true });
    const opened = app.tabs.filter((tab) => !before.has(tab.id));
    app.v6SetOrigin({ path: "C:/mappe/mappe.gk", filename: "mappe.gk" }, before);
    app.persistWorkspace();
    const rawSaved = localStorage.getItem("neuromap.workspace.v2");
    app.loadAutosave(rawSaved);
    const restoredBatch = app.tabs.filter((tab) => tab.filePath === "C:/mappe/mappe.gk").every((tab) => tab.batchFile === true);
    const node = app.tabs.flatMap((tab) => tab.state.getAllNodes()).find((item) => item.linkUrl);
    return {
      schema: payload.schema,
      active: payload.activeTabId,
      opened: opened.length,
      batch: opened.every((tab) => tab.batchFile && tab.filePath === "C:/mappe/mappe.gk") && restoredBatch,
      note: node?.notes || "",
      link: node?.linkUrl || "",
    };
  });
  expect(result.schema).toBe("NeuroMapArchitect-WorkspaceBatch-v6");
  expect(result.opened).toBeGreaterThan(1);
  expect(result.batch).toBe(true);
  expect(result.note).toBe("Nota uno");
  expect(result.link).toBe("https://example.com/uno");
  expect(result.active).toBeTruthy();
});
