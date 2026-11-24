const {test,expect}=require('@playwright/test');
test.describe('desktop synchronized split mode',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1440,height:940});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&document.getElementById('nm-view-split'));
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(n=>n.classList.add('hidden')));
  await page.locator('#v6-show-layout').click();
 });
 test('mind map remains active and editing its adjacent chart updates the same underlying node',async({page})=>{
  const id=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const node=app.state.addChildNode(app.state.root.id,app.layout,'Biology');
   app.markChanged();app.state.undoStack=[];app.state.redoStack=[];
   return node.id;
  });
  await page.locator('#nm-view-split').click();
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(page.locator('#nm-view-overlay')).toHaveClass(/nm-side-panel/);
  await expect(page.locator('#nm-view-picker')).toHaveValue('mindmap');
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('orgchart');
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.viewMode||'mindmap')).toBe('mindmap');
  const card=page.locator('.nm-view-card[data-node-id="'+id+'"]');
  await card.dblclick();
  await page.locator('.nm-view-edit').fill('Cell biology');
  await page.locator('.nm-view-edit').press('Enter');
  expect(await page.evaluate(id=>window.neuroMapApp.state.findNode(id).text,id)).toBe('Cell biology');
  await expect(card).toContainText('Cell biology');
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  expect(await page.evaluate(id=>window.neuroMapApp.state.findNode(id).text,id)).toBe('Cell biology');
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.viewMode||'mindmap')).toBe('mindmap');
 });
 test('adjacent view can change without changing original layout or source node IDs',async({page})=>{
  const ids=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const a=app.state.addChildNode(app.state.root.id,app.layout,'One');
   const b=app.state.addChildNode(app.state.root.id,app.layout,'Two');
   app.state.root.layoutMode='columns';app.markChanged();app.state.undoStack=[];
   return [a.id,b.id];
  });
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-view-overlay-picker-trigger').click();
  await page.locator('#nm-view-overlay-picker-gallery [data-view="concept-network"]').click();
  await expect(page.locator('.nm-network-card')).toHaveCount(3);
  await page.locator('#nm-view-overlay-picker-trigger').click();
  await page.locator('#nm-view-overlay-picker-gallery [data-view="flowchart"]').click();
  await expect(page.locator('#nm-flow-toolbar')).toBeVisible();
  const result=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   return {ids:app.state.root.children.map(n=>n.id),layout:app.state.root.layoutMode,
    view:app.state.root.viewMode||'mindmap',undo:app.state.undoStack.length};
  });
  expect(result).toEqual({ids,layout:'columns',view:'mindmap',undo:0});
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
 });
 test('opening the panel re-centers the canvas on the visible half and closing restores camera',async({page})=>{
  const before=await page.evaluate(()=>window.neuroMapApp.renderer.camera.x);
  await page.locator('#nm-view-split').click();
  const shifted=await page.evaluate(()=>window.neuroMapApp.renderer.camera.x);
  expect(Math.round(before-shifted)).toBe(Math.round(1440*.24));
  await page.locator('#nm-view-back').click();
  const restored=await page.evaluate(()=>window.neuroMapApp.renderer.camera.x);
  expect(restored).toBeCloseTo(before,5);
 });
 test('split view can be dismissed with Escape without altering project contents',async({page})=>{
  await page.locator('#nm-view-split').click();
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await page.locator('#nm-view-back').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.viewMode||'mindmap')).toBe('mindmap');
 });
});
