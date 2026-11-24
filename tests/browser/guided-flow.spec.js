const {test,expect}=require('@playwright/test');
test.describe('guided sibling-to-flow conversion (desktop)',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1350,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapGuidedFlow&&document.getElementById('nm-view-picker'));
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
 });
 async function setup(page){
  return page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];app.state.relationships=[];
   const a=app.state.addChildNode(app.state.root.id,app.layout,'Collect');
   const b=app.state.addChildNode(app.state.root.id,app.layout,'Review');
   const c=app.state.addChildNode(app.state.root.id,app.layout,'Publish');
   app.markChanged();app.state.undoStack=[];app.state.redoStack=[];
   window.NeuroMapLinkedViews.setMode(app,'flowchart');
   return {ids:[a.id,b.id,c.id],root:app.state.root.id};
  });
 }
 test('preview never mutates map and confirmation saves selected explicit steps with one Undo',async({page})=>{
  const init=await setup(page);
  await page.locator('#nm-flow-suggest').click();
  const rows=page.locator('#nm-flow-guide .nm-flow-guide-item');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('#nm-flow-guide-confirm')).toBeDisabled();
  const before=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   return {relationships:app.state.relationships.length,nodeIds:app.state.root.children.map(n=>n.id)};
  });
  expect(before.relationships).toBe(0);
  expect(before.nodeIds).toEqual(init.ids);
  await rows.nth(0).locator('input').check();
  await rows.nth(1).locator('input').check();
  await page.locator('#nm-flow-guide-confirm').click();
  await expect(page.locator('#nm-flow-guide')).toBeHidden();
  const result=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   const saved=app.io.buildSerializedProjectPayload();
   const edges=app.state.relationships.map(r=>({from:r.fromId,to:r.toId,kind:r.kind}));
   const undoLength=app.state.undoStack.length;
   app.state.undo();app.recalculateAndRender();
   const undone=app.state.relationships.length;
   app.state.redo();app.recalculateAndRender();
   return {edges,undoLength,undone,restored:app.state.relationships.length,
     saved:saved.relationships.map(r=>r.kind),view:saved.root.viewMode};
  });
  expect(result.edges).toEqual([
   {from:init.ids[0],to:init.ids[1],kind:'sequence'},
   {from:init.ids[1],to:init.ids[2],kind:'sequence'}
  ]);
  expect(result.undoLength).toBe(2);
  expect(result.undone).toBe(0);
  expect(result.restored).toBe(2);
  expect(result.saved).toEqual(['sequence','sequence']);
  expect(result.view).toBe('flowchart');
 });
 test('cancel and duplicate-protected proposals do not fabricate process data',async({page})=>{
  const init=await setup(page);
  await page.locator('#nm-flow-suggest').click();
  await page.locator('#nm-flow-guide-cancel').click();
  expect(await page.evaluate(()=>window.neuroMapApp.state.relationships.length)).toBe(0);
  await page.evaluate(({ids})=>{
   const app=window.neuroMapApp;
   app.state.addFlowTransition(ids[0],ids[1],'sequence');
   app.state.addFlowTransition(ids[2],ids[1],'yes');
   app.markChanged();
  },init);
  await page.locator('#nm-flow-suggest').click();
  await expect(page.locator('#nm-flow-guide .nm-flow-guide-item')).toHaveCount(0);
  await expect(page.locator('#nm-flow-guide-confirm')).toBeDisabled();
  await page.locator('#nm-flow-guide-cancel').click();
  expect(await page.evaluate(()=>window.neuroMapApp.state.relationships.length)).toBe(2);
 });
 test('switching away cancels an unconfirmed proposal',async({page})=>{
  await setup(page);
  await page.locator('#nm-flow-suggest').click();
  await page.locator('#nm-view-overlay-picker-trigger').click();
  await page.locator('#nm-view-overlay-picker-gallery [data-view="concept-network"]').click();
  await page.locator('#nm-view-overlay-picker-trigger').click();
  await page.locator('#nm-view-overlay-picker-gallery [data-view="flowchart"]').click();
  await expect(page.locator('#nm-flow-guide')).toBeHidden();
  await expect(page.locator('#nm-flow-suggest')).toContainText('Crea flusso');
  expect(await page.evaluate(()=>window.neuroMapApp.state.relationships.length)).toBe(0);
 });
});
