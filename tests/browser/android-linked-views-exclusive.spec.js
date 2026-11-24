const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm6_locale", "it");
  });
});

async function boot(page) {
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.NeuroMapLinkedViews &&
      window.NeuroMapWorkCore &&
      document.body.classList.contains("glauka-mobile-app") &&
      document.getElementById("glauka-app-header") &&
      document.getElementById("nm-view-picker"),
  );
}

async function assertExclusive(page, mode) {
  await expect(page.locator("#nm-view-overlay")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/nm-linked-view-open/);
  await expect(page.locator("#glauka-app-dock")).toBeHidden();
  await expect(page.locator("#glauka-app-sheet")).toBeHidden();
  await expect(page.locator("#nm-dual-pane")).toBeHidden();
  expect(await page.evaluate(() => neuroMapApp.state.root.viewMode)).toBe(mode);
}

async function seedKanban(page) {
  return page.evaluate(() => {
    const app = neuroMapApp,
      state = app.state;
    while (state.root.children.length)
      state.deleteNode(state.root.children[0].id);
    const a = state.addChildNode(state.root.id, app.layout, "Research");
    const b = state.addChildNode(state.root.id, app.layout, "Prototype");
    const c = state.addChildNode(state.root.id, app.layout, "Validate");
    state.setNodeWorkMetadata(a.id, { taskStatus: "todo" });
    state.setNodeWorkMetadata(b.id, { taskStatus: "todo" });
    state.setNodeWorkMetadata(c.id, { taskStatus: "doing" });
    app.markChanged();
    NeuroMapLinkedViews.setMode(app, "kanban");
    state.undoStack = [];
    state.redoStack = [];
    return { a: a.id, b: b.id, c: c.id };
  });
}

test("Options → Kanban is exclusive; back restores the mind map without dock collision", async ({
  page,
}, info) => {
  await boot(page);
  await expect(page.locator("#nm-view-switch")).toBeHidden();
  await expect(page.locator("#glauka-views-open")).toBeVisible();
  await expect(page.locator("#glauka-app-dock")).toBeVisible();

  await page.locator("#glauka-views-open").click();
  await expect(page.locator("#glauka-app-sheet")).toBeVisible();
  await page.getByRole("button", { name: "Bacheca Kanban", exact: true }).click();
  await assertExclusive(page, "kanban");

  await page.screenshot({
    path: info.outputPath("android-linked-kanban-exclusive.png"),
    fullPage: true,
  });

  expect(await page.evaluate(() => GlaukaMobileShell.back())).toBe(true);
  await expect(page.locator("#nm-view-overlay")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/nm-linked-view-open/);
  await expect(page.locator("#glauka-app-dock")).toBeVisible();
  expect(
    await page.evaluate(() => neuroMapApp.state.root.viewMode || "mindmap"),
  ).toBe("mindmap");
});

test("opening a linked view dismisses an open sheet underneath", async ({
  page,
}) => {
  await boot(page);
  await page.locator("#glauka-add-open").click();
  await expect(page.locator("#glauka-app-sheet")).toBeVisible();
  await page.evaluate(() =>
    NeuroMapLinkedViews.setMode(neuroMapApp, "orgchart"),
  );
  await assertExclusive(page, "orgchart");
});

test("Kanban touch drag moves a task with one Undo while dock stays closed", async ({
  page,
}) => {
  await boot(page);
  const ids = await seedKanban(page);
  await assertExclusive(page, "kanban");
  await expect(page.locator(".nm-work-card")).toHaveCount(3);

  const card = page.locator(`.nm-work-card[data-node-id="${ids.a}"]`);
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  // Drag far into the Done column (right side of the exclusive overlay).
  await card.dispatchEvent("pointerdown", {
    pointerId: 21,
    pointerType: "touch",
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    buttons: 1,
  });
  await card.dispatchEvent("pointermove", {
    pointerId: 21,
    pointerType: "touch",
    clientX: box.x + 900,
    clientY: box.y + box.height / 2,
    buttons: 1,
  });
  await card.dispatchEvent("pointerup", {
    pointerId: 21,
    pointerType: "touch",
    clientX: box.x + 900,
    clientY: box.y + box.height / 2,
    buttons: 0,
  });

  await expect
    .poll(() =>
      page.evaluate(
        (id) => neuroMapApp.state.findNode(id).taskStatus,
        ids.a,
      ),
    )
    .toBe("done");
  expect(
    await page.evaluate(() => neuroMapApp.state.undoStack.length),
  ).toBe(1);
  await expect(page.locator("#glauka-app-dock")).toBeHidden();

  await page.locator("#glauka-undo").click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => neuroMapApp.state.findNode(id).taskStatus || "todo",
        ids.a,
      ),
    )
    .toBe("todo");
  await expect(page.locator("body")).toHaveClass(/nm-linked-view-open/);
});

test("Flowchart and concept network open exclusively and leave via Android back", async ({
  page,
}, info) => {
  await boot(page);
  for (const [mode, label, shot] of [
    ["flowchart", "Flusso di lavoro", "android-linked-flow-exclusive.png"],
    ["concept-network", "Rete concettuale", "android-linked-network-exclusive.png"],
  ]) {
    await page.locator("#glauka-options-open").click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await assertExclusive(page, mode);
    await page.screenshot({ path: info.outputPath(shot), fullPage: true });
    expect(await page.evaluate(() => GlaukaMobileShell.back())).toBe(true);
    await expect(page.locator("#nm-view-overlay")).toBeHidden();
    await expect(page.locator("#glauka-app-dock")).toBeVisible();
  }
});

test("Options opens every alternate view without dock collision", async ({
  page,
}, info) => {
  await boot(page);
  const modes = [
    ["orgchart", "Organigramma"],
    ["concept-tree", "Albero concettuale"],
    ["concept-network", "Rete concettuale"],
    ["flowchart", "Flusso di lavoro"],
    ["kanban", "Bacheca Kanban"],
    ["timeline", "Linea del tempo"],
  ];
  for (const [mode, label] of modes) {
    await page.locator("#glauka-options-open").click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await assertExclusive(page, mode);
    await page.screenshot({
      path: info.outputPath(`android-linked-${mode}.png`),
      fullPage: true,
    });
    expect(await page.evaluate(() => GlaukaMobileShell.back())).toBe(true);
    await expect(page.locator("#nm-view-overlay")).toBeHidden();
  }
});
