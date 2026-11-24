const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 6.19 Learning Core (desktop)',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmLearning&&window.NeuroMapLearningCore);
  await page.locator('#nm6-welcome-start').click();
  await page.evaluate(()=>{
   const a=window.neuroMapApp;
   a.importHierarchy({text:'Anatomia',children:[
    {text:'Cuore',notes:'Pompa del sangue',children:[
     {text:'Atrio destro',notes:'Riceve sangue venoso',children:[]},
     {text:'Ventricolo sinistro',children:[]}]},
    {text:'Rene',notes:'Filtra il sangue',children:[]},
    {text:'Fegato',children:[]},
    {text:'Polmone',children:[]}
   ]},{newTab:true});
  });
 });
 test('Map Recall masks canvas labels but never changes node text or undo stack',async({page})=>{
  const before=await page.evaluate(()=>{
   const a=neuroMapApp;return {root:JSON.stringify(a.state.root),
    undo:a.state.undoStack.length,ids:a.state.root.children.map(c=>c.id)}
  });
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Nascondi concetti'}).click();
  const masked=await page.evaluate(()=>{
   const a=neuroMapApp;return {count:a.renderer._nmLearnRecall.hiddenIds.size,
    text:a.state.root.children[0].text,undo:a.state.undoStack.length}
  });
  expect(masked.count).toBeGreaterThan(0);
  expect(masked.text).toBe('Cuore');
  expect(masked.undo).toBe(before.undo);
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before.root);
  await page.getByRole('button',{name:'Mostra tutto'}).click();
  expect(await page.evaluate(()=>neuroMapApp.renderer._nmLearnRecall)).toBeNull();
 });
 test('clicking a masked node reveals it without editing the document',async({page})=>{
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Nascondi concetti'}).click();
  const click=await page.evaluate(()=>{
   const a=neuroMapApp,id=a.state.root.children[0].id,m=a.layout.getLayout(id);
   const xy=a.renderer.worldToScreen(m.x,m.y);
   return {id,x:xy.x,y:xy.y};
  });
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.evaluate(({x,y})=>{
   const a=neuroMapApp;a.canvas.dispatchEvent(new PointerEvent('pointerdown',{
    bubbles:true,cancelable:true,button:0,pointerId:71,clientX:x,clientY:y}));
   a.canvas.dispatchEvent(new PointerEvent('pointerup',{
    bubbles:true,cancelable:true,button:0,pointerId:71,clientX:x,clientY:y}));
  },click);
  expect(await page.evaluate(id=>neuroMapApp.renderer._nmLearnRecall.hiddenIds.has(id),click.id)).toBe(false);
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
 });
 test('recall drag pans from a hidden node without revealing or writing to map',async({page})=>{
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Nascondi concetti'}).click();
  const values=await page.evaluate(()=>{
   const a=neuroMapApp,id=a.state.root.children[0].id,m=a.layout.getLayout(id);
   return {id,pos:a.renderer.worldToScreen(m.x,m.y),camera:{...a.renderer.camera},
     root:JSON.stringify(a.state.root),undo:a.state.undoStack.length};
  });
  await page.mouse.move(values.pos.x,values.pos.y);
  await page.mouse.down();
  await page.mouse.move(values.pos.x+130,values.pos.y+45,{steps:5});
  await page.mouse.up();
  const result=await page.evaluate(v=>{
   const a=neuroMapApp;
   return {dx:a.renderer.camera.x-v.camera.x,dy:a.renderer.camera.y-v.camera.y,
    stillHidden:a.renderer._nmLearnRecall.hiddenIds.has(v.id),
    unchanged:JSON.stringify(a.state.root)===v.root,undo:a.state.undoStack.length};
  },values);
  expect(result.dx).toBeCloseTo(130,1);
  expect(result.dy).toBeCloseTo(45,1);
  expect(result.stillHidden).toBe(true);
  expect(result.unchanged).toBe(true);
  expect(result.undo).toBe(values.undo);
 });
 test('offline quiz records manual result and includes it in project serialization',async({page})=>{
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Quiz',exact:true}).click();
  await page.getByRole('button',{name:'Inizia quiz'}).click();
  const first=await page.locator('.nm-learn-question').textContent();
  expect(first.length).toBeGreaterThan(8);
  const choice=page.locator('#nm-learn-panel .nm-learn-options button');
  if(await choice.count())await choice.first().click();
  else {
   await page.getByRole('button',{name:'Mostra risposta'}).click();
   await page.getByRole('button',{name:'✓ Ricordato'}).click();
  }
  const state=await page.evaluate(()=>{
   const a=neuroMapApp,tab=a.tabs.find(t=>t.id===a.activeTabId);
   const record=a.learningAttempts.at(-1);
   return {record,project:NM614.serialize(a,tab),dirty:a.state.isDirty}
  });
  expect(state.record.nodeId.length).toBeGreaterThan(0);
  expect(state.project.learningAttempts.length).toBeGreaterThan(0);
  expect(state.project.learningAttempts.at(-1).itemId).toBe(state.record.itemId);
  expect(state.dirty).toBe(true);
 });
 test('map switch ends recall and cannot leak masked IDs into another tab',async({page})=>{
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Nascondi concetti'}).click();
  await page.evaluate(()=>neuroMapApp.createNewTab('Unrelated'));
  expect(await page.evaluate(()=>neuroMapApp.renderer._nmLearnRecall)).toBeNull();
  await expect(page.locator('#nm-learn-panel')).toBeHidden();
 });
});
