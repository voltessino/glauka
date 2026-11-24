const {test,expect}=require('@playwright/test');
test.describe('desktop free concept network',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1400,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapConceptNetwork&&document.getElementById('nm-view-picker'));
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
 });
 async function prepare(page){
  return page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.text='Heart';
   app.state.root.children=[];
   app.state.relationships=[];
   const one=app.state.addChildNode(app.state.root.id,app.layout,'Blood');
   const two=app.state.addChildNode(app.state.root.id,app.layout,'Pressure');
   app.markChanged();
   app.state.undoStack=[];app.state.redoStack=[];
   window.NeuroMapLinkedViews.setMode(app,'concept-network');
   return {root:app.state.root.id,one:one.id,two:two.id};
  });
 }
 test('directly connects two concepts with a user-chosen label, saves and undoes',async({page})=>{
  const ids=await prepare(page);
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('concept-network');
  await expect(page.locator('.nm-network-card')).toHaveCount(3);
  await page.locator('#nm-network-label').fill('regulates');
  await page.locator('#nm-network-link').click();
  await page.locator('.nm-network-card[data-node-id="'+ids.one+'"]').click();
  await expect(page.locator('#nm-network-status')).toContainText('arrivo');
  await page.locator('.nm-network-card[data-node-id="'+ids.two+'"]').click();
  const data=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   const saved=app.io.buildSerializedProjectPayload();
   return {relationships:app.state.relationships.map(r=>({from:r.fromId,to:r.toId,label:r.label,kind:r.kind})),
     saved:saved.relationships.map(r=>r.label),mode:saved.root.viewMode,
     count:app.state.root.children.length};
  });
  expect(data.relationships).toEqual([{from:ids.one,to:ids.two,label:'regulates',kind:undefined}]);
  expect(data.saved).toEqual(['regulates']);
  expect(data.mode).toBe('concept-network');
  expect(data.count).toBe(2);
  await expect(page.locator('.nm-network-label')).toHaveText('regulates');
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.undo();app.recalculateAndRender()});
  await expect(page.locator('.nm-network-label')).toHaveCount(0);
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.redo();app.recalculateAndRender()});
  await expect(page.locator('.nm-network-label')).toHaveText('regulates');
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-picker')).toHaveValue('mindmap');
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.children.length)).toBe(2);
 });
 test('dragging saves an independent position and Undo restores original layout',async({page})=>{
  const ids=await prepare(page);
  const card=page.locator('.nm-network-card[data-node-id="'+ids.one+'"]');
  const box=await card.boundingBox();
  expect(box).toBeTruthy();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+130,y+80,{steps:8});
  await page.mouse.up();
  const result=await page.evaluate(id=>{
    const app=window.neuroMapApp,node=app.state.findNode(id);
    const saved=app.io.buildSerializedProjectPayload().root.children.find(n=>n.id===id);
    const out={pos:{...node.networkPosition},saved:{...saved.networkPosition},other:app.state.root.children[1].networkPosition||null};
    app.state.undo();app.recalculateAndRender();
    out.undone=app.state.findNode(id).networkPosition||null;
    app.state.redo();app.recalculateAndRender();
    out.redone=app.state.findNode(id).networkPosition;
    return out;
  },ids.one);
  expect(result.pos.x).toBeGreaterThan(436);
  expect(result.pos.y).toBeGreaterThan(110);
  expect(result.saved).toEqual(result.pos);
  expect(result.other).toBeNull();
  expect(result.undone).toBeNull();
  expect(result.redone).toEqual(result.pos);
 });
 test('Kanban cards move between columns, preserve dates, and undo as one action',async({page})=>{
  const ids=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const task=app.state.addChildNode(app.state.root.id,app.layout,'Task');
   app.state.setNodeWorkMetadata(task.id,{taskStatus:'',startDate:'2026-11-10',dueDate:'2026-11-12'});
   app.state.undoStack=[];app.state.redoStack=[];
   window.NeuroMapLinkedViews.setMode(app,'kanban');
   return {task:task.id};
  });
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('kanban');
  const task=page.locator('.nm-work-card[data-node-id="'+ids.task+'"]');
  const done=page.locator('.nm-kanban-dropzone[data-status="done"]');
  await expect(task).toBeVisible();
  await task.dragTo(done);
  const result=await page.evaluate(id=>{
   const app=window.neuroMapApp,node=app.state.findNode(id);
   const saved=app.io.buildSerializedProjectPayload().root.children.find(n=>n.id===id);
   const after={status:node.taskStatus,start:node.startDate,due:node.dueDate,stored:saved.taskStatus};
   app.state.undo();app.recalculateAndRender();
   const undone=app.state.findNode(id).taskStatus||'unassigned';
   app.state.redo();app.recalculateAndRender();
   return {after,undone,redone:app.state.findNode(id).taskStatus};
  },ids.task);
  expect(result).toEqual({after:{status:'done',start:'2026-11-10',due:'2026-11-12',stored:'done'},
    undone:'unassigned',redone:'done'});
 });
 test('old projects load in mindmap, and external relations preserve original data',async({page})=>{
  const data=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    delete app.state.root.viewMode;
    const first=window.NeuroMapViewCore.mode(app.state.root.viewMode);
    const a=app.state.addChildNode(app.state.root.id,app.layout,'A');
    const b=app.state.addChildNode(app.state.root.id,app.layout,'B');
    app.state.addFlowTransition(a.id,b.id,'yes');
    const original=JSON.stringify(app.state.relationships);
    window.NeuroMapLinkedViews.setMode(app,'concept-network');
    const projected=window.NeuroMapConceptNetwork.project(app.state.root,app.state.relationships);
    return {first,original,after:JSON.stringify(app.state.relationships),labels:projected.edges.filter(e=>e.type==='relation').map(e=>e.label)};
  });
  expect(data.first).toBe('mindmap');
  expect(data.after).toBe(data.original);
  expect(data.labels).toContain('Sì');
 });
});
