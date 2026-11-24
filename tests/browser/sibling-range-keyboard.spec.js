const { test, expect } = require('@playwright/test');

// Targeted regression: normal node editing and camera navigation must not be
// intercepted by the new Shift+arrow selection gesture.
test('desktop Shift+Up/Down extends and shrinks a visual sibling range', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nm6_welcome_seen', '1'));
  await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
  await page.waitForFunction(() => window.neuroMapApp?.selectSiblingRange);

  const ordered = await page.evaluate(() => {
    const app = window.neuroMapApp;
    app.importHierarchy({ text: 'Keyboard range', children: [
      { text: 'Section', children: [
        { text: 'A', children: [] }, { text: 'B', children: [] },
        { text: 'C', children: [] }, { text: 'D', children: [] }
      ]},
      { text: 'Other section', children: [{ text: 'Outside', children: [] }] }
    ] }, { newTab: true });
    app.recalculateAndRender();
    const section = app.state.root.children[0];
    const children = section.children.slice().sort((a, b) => {
      const A = app.layout.getLayout(a.id), B = app.layout.getLayout(b.id);
      return A.y - B.y || A.x - B.x;
    });
    app.selectNode(children[0].id);
    app.canvas.focus();
    return children.map(n => n.id);
  });
  expect(ordered).toHaveLength(4);

  const snapshot = () => page.evaluate(() => ({
    selected: window.neuroMapApp.state.selectedNodeIds.slice(),
    focus: window.neuroMapApp.state.selectedNodeId,
    anchor: window.neuroMapApp.selectionAnchorId
  }));

  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowDown');
  expect(await snapshot()).toEqual({ selected: ordered.slice(0, 2), focus: ordered[1], anchor: ordered[0] });
  await page.keyboard.press('ArrowDown');
  expect(await snapshot()).toEqual({ selected: ordered.slice(0, 3), focus: ordered[2], anchor: ordered[0] });
  await page.keyboard.press('ArrowUp');
  expect(await snapshot()).toEqual({ selected: ordered.slice(0, 2), focus: ordered[1], anchor: ordered[0] });
  await page.keyboard.press('ArrowUp');
  expect(await snapshot()).toEqual({ selected: ordered.slice(0, 1), focus: ordered[0], anchor: ordered[0] });
  await page.keyboard.up('Shift');

  // A plain click must still reset the anchor and ordinary selection.
  await page.evaluate(id => window.neuroMapApp.selectNode(id), ordered[3]);
  expect(await snapshot()).toEqual({ selected: [ordered[3]], focus: ordered[3], anchor: ordered[3] });
});

test('desktop Shift+arrow remains native text selection in the inline editor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nm6_welcome_seen', '1'));
  await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
  await page.waitForFunction(() => window.neuroMapApp?.selectSiblingRange);
  await page.evaluate(() => {
    const app = window.neuroMapApp;
    app.importHierarchy({ text: 'Editor test', children: [{ text: 'ABCDE', children: [] }] }, { newTab: true });
    app.selectNode(app.state.root.children[0].id);
    app.editSelected();
    const input = document.getElementById('inline-editor-input');
    input.value = 'ABCDE';
    input.focus();
    input.setSelectionRange(1, 1);
  });
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  const range = await page.locator('#inline-editor-input').evaluate(input => [input.selectionStart, input.selectionEnd]);
  expect(range).toEqual([1, 2]);
});
