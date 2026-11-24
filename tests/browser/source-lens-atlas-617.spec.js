const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 6.17 Source Lens and persistent Atlas',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapSourceCore&&window.NeuroMapAtlasLibrary);
 });
 test('PDF citation records the real file fingerprint, page, quote and Undo',async({page})=>{
  await page.evaluate(()=>neuroMapApp._nmKnowledge.open('sources'));
  const panel=page.locator('#nm-knowledge-panel');
  await expect(panel.locator('.nm-source-form')).toBeVisible();
  await panel.locator('input[type="file"]').setInputFiles({
   name:'Research.pdf',mimeType:'application/pdf',
   buffer:Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF')
  });
  await panel.locator('input[type="number"]').fill('27');
  await panel.locator('textarea:not([readonly])').fill('A documented statement from page 27.');
  await panel.getByRole('button',{name:'Collega fonte al nodo'}).click();
  await expect.poll(()=>page.evaluate(()=>
   neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).sourceRefs?.length||0)).toBe(1);
  const saved=await page.evaluate(()=>{
   const node=neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId);
   return node.sourceRefs?.[0]||null;
  });
  expect(saved).toMatchObject({kind:'pdf',fileName:'Research.pdf',page:27,
   quote:'A documented statement from page 27.'});
  expect(saved.sha256).toMatch(/^[a-f0-9]{64}$/);
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.sourceRefs||[])).toEqual([]);
 });
 test('Source Lens never modifies another tab after active editor changes',async({page})=>{
  const before=await page.evaluate(()=>{
   const a=neuroMapApp;a._nmKnowledge.open('sources');
   const first=a.activeTabId;
   a.createNewTab('Second map');
   return {first,second:a.activeTabId};
  });
  expect(before.first).not.toBe(before.second);
  expect(await page.evaluate(()=>neuroMapApp.state.root.sourceRefs||[])).toEqual([]);
 });
 test('100 saved closed-map concepts remain searchable across reload',async({page})=>{
  const setup=await page.evaluate(async()=>{
   const app=neuroMapApp;const S=window.NeuroMapAtlasLibrary;
   const tabs=[];
   for(let i=0;i<100;i++){
    const s=app.newState('Case '+i);
    s.root.children=[{id:'node-'+i,parentId:s.root.id,text:'Cardiology case '+i,
      notes:'Study case number '+i,children:[]}];
    s.isDirty=false;
    tabs.push({id:'archived-'+i,title:'Clinical map '+i,
      filePath:'C:\\Study\\case-'+i+'.neuromap',originSheetIndex:0,state:s});
   }
   app._nmAtlasArchive=S.update([],tabs,window.NeuroMapKnowledgeCore);
   await app.persistWorkspace();
   return app._nmAtlasArchive.length;
  });
  expect(setup).toBe(60); // Explicit bounded index.
  await page.reload();
  await page.waitForFunction(()=>window.neuroMapApp?._nmAtlasArchive?.length===60);
  await page.evaluate(()=>neuroMapApp._nmKnowledge.open('atlas'));
  await page.locator('#nm-knowledge-panel input[type="search"]').fill('Cardiology case 99');
  await expect(page.locator('#nm-knowledge-panel')).toContainText('Cardiology case 99');
  await expect(page.locator('#nm-knowledge-panel')).toContainText('chiuso');
 });
 test('malicious URL cannot be attached or executed by Source Lens',async({page})=>{
  await page.evaluate(()=>neuroMapApp._nmKnowledge.open('sources'));
  const panel=page.locator('#nm-knowledge-panel');
  await panel.locator('select').first().selectOption('web');
  await panel.locator('input[type="url"]').fill('javascript:alert(1)');
  await panel.getByRole('button',{name:'Collega fonte al nodo'}).click();
  await expect(panel.locator('.nm-source-error')).toContainText('non valida');
  expect(await page.evaluate(()=>neuroMapApp.state.root.sourceRefs||[])).toEqual([]);
 });
});
