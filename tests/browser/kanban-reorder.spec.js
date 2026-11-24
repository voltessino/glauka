const {test,expect}=require('@playwright/test');
// Real desktop browser UI, never a mock of Kanban's event handlers.
// Local: npx playwright test tests/browser/kanban-reorder.spec.js --workers=1
test.describe('Kanban: canonical task order across mouse/keyboard/split and file snapshots',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1380,height:920});
  await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapLinkedViews&&window.NeuroMapWorkCore);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
 });
 async function fixture(page){
  return page.evaluate(()=>{
   const app=window.neuroMapApp,state=app.state;
   state.root.children=[];
   const a=state.addChildNode(state.root.id,app.layout,'Research');
   const b=state.addChildNode(state.root.id,app.layout,'Prototype');
   const c=state.addChildNode(state.root.id,app.layout,'Validate');
   state.setNodeWorkMetadata(a.id,{taskStatus:'todo',startDate:'2026-11-03'});
   state.setNodeWorkMetadata(b.id,{taskStatus:'todo',dueDate:'2026-11-10'});
   state.setNodeWorkMetadata(c.id,{taskStatus:'doing'});
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'kanban');
   state.undoStack=[];state.redoStack=[];
   return {a:a.id,b:b.id,c:c.id};
  });
 }
 async function current(page){
  return page.evaluate(()=>{
   const app=window.neuroMapApp,state=app.state;
   const ordered=window.NeuroMapWorkCore.project(state.root,'kanban').nodes.map(n=>n.id);
   return {ordered,branches:state.root.children.map(n=>n.id),
    undo:state.undoStack.length,redo:state.redoStack.length};
  });
 }
 test('Alt-arrow reorders inside column with one Undo and survives project serialization',async({page})=>{
  const ids=await fixture(page);
  const second=page.locator('.nm-work-card[data-node-id="'+ids.b+'"]');
  await second.focus();
  await second.press('Alt+ArrowUp');
  await expect.poll(async()=> (await current(page)).ordered).toEqual([ids.b,ids.a,ids.c]);
  const actual=await current(page);
  expect(actual.branches).toEqual([ids.a,ids.b,ids.c]);
  expect(actual.undo).toBe(1);
  const persistence=await page.evaluate(id=>{
   const app=window.neuroMapApp,payload=app.io.buildSerializedProjectPayload();
   const saved=payload.root.children.find(n=>n.id===id);
   return {taskOrder:saved.taskOrder,taskStatus:saved.taskStatus,dueDate:saved.dueDate};
  },ids.b);
  expect(persistence).toEqual({taskOrder:0,taskStatus:'todo',dueDate:'2026-11-10'});
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.undo();app.recalculateAndRender()});
  await expect.poll(async()=> (await current(page)).ordered).toEqual([ids.a,ids.b,ids.c]);
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.redo();app.recalculateAndRender()});
  await expect.poll(async()=> (await current(page)).ordered).toEqual([ids.b,ids.a,ids.c]);
 });
 test('mouse drag drops before a card rather than only changing column',async({page})=>{
  const ids=await fixture(page);
  const from=page.locator('.nm-work-card[data-node-id="'+ids.b+'"]');
  const before=page.locator('.nm-work-card[data-node-id="'+ids.a+'"]');
  await from.dragTo(before,{targetPosition:{x:55,y:12}});
  await expect.poll(async()=> (await current(page)).ordered).toEqual([ids.b,ids.a,ids.c]);
  expect((await current(page)).undo).toBe(1);
  const projected=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   return {state:app.state.findNode(app.state.root.children[1].id).taskStatus,
    date:app.state.root.children[1].dueDate};
  });
  expect(projected).toEqual({state:'todo',date:'2026-11-10'});
 });
 test('split Kanban keyboard move changes column without changing mind-map hierarchy',async({page})=>{
  const ids=await fixture(page);
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await expect(page.locator('#nm-dual-stage .nm-work-card')).toHaveCount(3);
  // Enter the split pane before using its independent camera and card actions.
  const task=page.locator('#nm-dual-stage .nm-work-card[data-node-id="'+ids.a+'"]');
  await task.focus();await task.press('Alt+ArrowRight');
  await expect.poll(async()=> (await current(page)).ordered).toEqual([ids.b,ids.c,ids.a]);
  const result=await page.evaluate(id=>{
   const app=window.neuroMapApp,save=app.io.buildSerializedProjectPayload();
   const node=save.root.children.find(n=>n.id===id);
   return {status:node.taskStatus,startDate:node.startDate,order:node.taskOrder};
  },ids.a);
  expect(result).toEqual({status:'doing',startDate:'2026-11-03',order:1});
  expect((await current(page)).branches).toEqual([ids.a,ids.b,ids.c]);
 });
});
