const {test,expect}=require('@playwright/test');
test.describe('desktop semantic workflow',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1380,height:920});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapFlowCore&&window.NeuroMapLinkedViews);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
 });
 test('a workflow starts blank and cannot infer processes from hierarchy or plain references',async({page})=>{
  await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const one=app.state.addChildNode(app.state.root.id,app.layout,'Exam');
   const two=app.state.addChildNode(app.state.root.id,app.layout,'Review');
   app.state.addRelationship(one.id,two.id,'generic reference');
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'flowchart');
  });
  await expect(page.locator('#nm-view-picker')).toHaveValue('flowchart');
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(page.locator('.nm-flow-empty')).toBeVisible();
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(0);
  expect(await page.evaluate(()=>window.neuroMapApp.state.relationships.every(r=>!r.kind))).toBeTruthy();
 });
 test('users explicitly connect steps and decisions without altering their other links',async({page})=>{
  const nodes=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const start=app.state.addChildNode(app.state.root.id,app.layout,'Start');
   const decision=app.state.addChildNode(app.state.root.id,app.layout,'Approved?');
   const ok=app.state.addChildNode(app.state.root.id,app.layout,'Publish');
   const no=app.state.addChildNode(app.state.root.id,app.layout,'Review');
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'flowchart');
   return {start:start.id,decision:decision.id,ok:ok.id,no:no.id};
  });
  const connect=async(from,to,kind)=>{
   await page.locator('#nm-flow-from').selectOption(from);
   await page.locator('#nm-flow-to').selectOption(to);
   await page.locator('#nm-flow-type').selectOption(kind);
   await page.locator('#nm-flow-connect').click();
  };
  await connect(nodes.start,nodes.decision,'sequence');
  await connect(nodes.decision,nodes.ok,'yes');
  await connect(nodes.decision,nodes.no,'no');
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(4);
  await expect(page.locator('#nm-view-lines path[marker-end]')).toHaveCount(3);
  await expect(page.locator('.nm-view-card.is-decision')).toHaveCount(1);
  const result=await page.evaluate(()=>{
   const s=window.neuroMapApp.state;
   const saved=window.neuroMapApp.io.buildSerializedProjectPayload();
   return {edges:s.relationships.map(e=>e.kind),serialized:saved.relationships.map(e=>e.kind),
    rootMode:saved.root.viewMode,ids:s.root.children.map(x=>x.id)};
  });
  expect(result).toEqual({edges:['sequence','yes','no'],serialized:['sequence','yes','no'],rootMode:'flowchart',
   ids:[nodes.start,nodes.decision,nodes.ok,nodes.no]});
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  expect(await page.evaluate(()=>window.neuroMapApp.state.relationships.map(r=>r.kind))).toEqual(['sequence','yes','no']);
 });
 test('a semantic transition is removable from the flow panel and Undo restores it',async({page})=>{
  await page.evaluate(()=>{
    const app=window.neuroMapApp;
    app.state.root.children=[];
    const a=app.state.addChildNode(app.state.root.id,app.layout,'Begin');
    const b=app.state.addChildNode(app.state.root.id,app.layout,'End');
    app.state.addFlowTransition(a.id,b.id,'sequence');
    app.markChanged();window.NeuroMapLinkedViews.setMode(app,'flowchart');
  });
  await expect(page.locator('#nm-flow-list .nm-flow-pill')).toHaveCount(1);
  await page.locator('#nm-flow-list .nm-flow-remove').click();
  await expect(page.locator('#nm-flow-list .nm-flow-pill')).toHaveCount(0);
  await expect(page.locator('.nm-flow-empty')).toBeVisible();
  const restored=await page.evaluate(()=>{
    const app=window.neuroMapApp;app.state.undo();app.recalculateAndRender();
    return app.state.relationships.map(r=>r.kind);
  });
  expect(restored).toEqual(['sequence']);
  await expect(page.locator('#nm-flow-list .nm-flow-pill')).toHaveCount(1);
 });
 test('linked workflow exports a standalone SVG without changing the original nodes',async({page})=>{
  await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const a=app.state.addChildNode(app.state.root.id,app.layout,'<Start>');
   const b=app.state.addChildNode(app.state.root.id,app.layout,'Finish & publish');
   app.state.addFlowTransition(a.id,b.id,'yes');
   app.markChanged();window.NeuroMapLinkedViews.setMode(app,'flowchart');
  });
  const result=await page.evaluate(async()=>{
   const app=window.neuroMapApp,before=JSON.stringify(app.state.root);
   const seen=[];
   const original=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
   URL.createObjectURL=(blob)=>{seen.push(blob);return 'blob:neuromap-test'};
   HTMLAnchorElement.prototype.click=function(){};
   try{
    document.getElementById('nm-view-export-svg').click();
    const svg=await seen[0].text();
    return {svg,unchanged:before===JSON.stringify(app.state.root)};
   }finally{URL.createObjectURL=original;HTMLAnchorElement.prototype.click=oldClick}
  });
  expect(result.unchanged).toBeTruthy();
  expect(result.svg).toContain('<svg');
  expect(result.svg).toContain('&lt;Start&gt;');
  expect(result.svg).toContain('Finish &amp; publish');
  expect(result.svg).toContain('marker-end');
 });
 test('workflow add-step records one Undo action for both node and arrow',async({page})=>{
  const ids=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const start=app.state.addChildNode(app.state.root.id,app.layout,'Start');
   const end=app.state.addChildNode(app.state.root.id,app.layout,'Finish');
   app.state.addFlowTransition(start.id,end.id,'sequence');
   app.markChanged();window.NeuroMapLinkedViews.setMode(app,'flowchart');
   app.state.undoStack=[];
   return {start:start.id,end:end.id};
  });
  await page.locator('.nm-view-card[data-node-id="'+ids.start+'"] .nm-view-add').click();
  await expect(page.locator('.nm-view-edit')).toBeVisible();
  await page.locator('.nm-view-edit').fill('Extra task');
  await page.locator('.nm-view-edit').press('Enter');
  const result=await page.evaluate(({start})=>{
   const s=window.neuroMapApp.state;
   s.undo(); // undo rename
   const renamedGone=s.getAllNodes().some(n=>n.text==='Extra task');
   s.undo(); // undo linked node+edge
   return {renamedGone,children:s.findNode(start).children.length,links:s.relationships.length};
  },ids);
  expect(result).toEqual({renamedGone:false,children:0,links:1});
 });
});
