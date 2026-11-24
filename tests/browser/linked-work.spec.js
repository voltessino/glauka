const {test,expect}=require('@playwright/test');
test.describe('desktop Kanban and timeline linked to original nodes',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1380,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapWorkCore&&window.NeuroMapLinkedViews);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
 });
 test('Kanban keeps unassigned work visible and persists user-selected status',async({page})=>{
  const ids=await page.evaluate(()=>{
   const app=window.neuroMapApp;app.state.root.children=[];
   const a=app.state.addChildNode(app.state.root.id,app.layout,'Prepare');
   const b=app.state.addChildNode(app.state.root.id,app.layout,'Deliver');
   app.markChanged();window.NeuroMapLinkedViews.setMode(app,'kanban');
   return {a:a.id,b:b.id};
  });
  await expect(page.locator('#nm-view-picker')).toHaveValue('kanban');
  await expect(page.locator('.nm-work-column')).toHaveCount(4);
  await expect(page.locator('.nm-work-card')).toHaveCount(2);
  await page.locator('#nm-work-node').selectOption(ids.a);
  await page.locator('#nm-work-status').selectOption('doing');
  await page.locator('#nm-work-apply').click();
  const data=await page.evaluate(({a,b})=>{
   const app=window.neuroMapApp,s=app.state;
   return {status:s.findNode(a).taskStatus,other:s.findNode(b).taskStatus||null,
    serialized:app.io.buildSerializedProjectPayload().root.children.find(n=>n.id===a).taskStatus};
  },ids);
  expect(data).toEqual({status:'doing',other:null,serialized:'doing'});
  const undone=await page.evaluate(id=>{
   const app=window.neuroMapApp;app.state.undo();app.recalculateAndRender();
   return app.state.findNode(id).taskStatus||null;
  },ids.a);
  expect(undone).toBeNull();
 });
 test('timeline shows only dated nodes and clears dates reversibly',async({page})=>{
  const ids=await page.evaluate(()=>{
   const app=window.neuroMapApp;app.state.root.children=[];
   const a=app.state.addChildNode(app.state.root.id,app.layout,'Scheduled');
   const b=app.state.addChildNode(app.state.root.id,app.layout,'Unscheduled');
   app.markChanged();window.NeuroMapLinkedViews.setMode(app,'timeline');
   return {a:a.id,b:b.id};
  });
  await expect(page.locator('.nm-work-blank')).toBeVisible();
  await page.locator('#nm-work-node').selectOption(ids.a);
  await page.locator('#nm-work-start').fill('2026-11-03');
  await page.locator('#nm-work-end').fill('2026-11-08');
  await page.locator('#nm-work-apply').click();
  await expect(page.locator('.nm-timeline-card')).toHaveCount(1);
  const value=await page.evaluate(({a,b})=>{
   const s=window.neuroMapApp.state;
   return {start:s.findNode(a).startDate,due:s.findNode(a).dueDate,notInferred:s.findNode(b).startDate||null};
  },ids);
  expect(value).toEqual({start:'2026-11-03',due:'2026-11-08',notInferred:null});
  await page.locator('#nm-work-start').fill('');
  await page.locator('#nm-work-end').fill('');
  await page.locator('#nm-work-apply').click();
  await expect(page.locator('.nm-work-blank')).toBeVisible();
  expect(await page.evaluate(id=>window.neuroMapApp.state.findNode(id).startDate,ids.a)).toBeUndefined();
 });
});
