const {test,expect}=require('@playwright/test');
test.describe('NeuroMap knowledge workspace (Windows/macOS shared editor)',()=>{
 test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.setViewportSize({width:1366,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmKnowledge?.open);
 });
 test('Outline opens from task tools and does not alter map data',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  await page.locator('#btn-menu-tools').click();
  await page.locator('#dropdown-tools').getByRole('button',{name:/Organizza i rami|Organize branches/}).click();
  await expect(page.locator('#nm-knowledge-panel')).toBeVisible();
  await expect(page.locator('.nm-kn-row')).not.toHaveCount(0);
  expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root))).toBe(before);
 });
 test('Outline rename changes original node and supports undo/redo',async({page})=>{
  const original=await page.evaluate(()=>window.neuroMapApp.state.root.text);
  const id=await page.evaluate(()=>window.neuroMapApp.state.root.id);
  await page.evaluate(()=>window.neuroMapApp._nmKnowledge.open('outline'));
  const first=page.locator('.nm-kn-row').first().locator('.nm-kn-text');
  await first.dblclick();
  await page.locator('.nm-kn-edit').fill('QA Outline Rename');
  await page.locator('.nm-kn-edit').press('Enter');
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.text)).toBe('QA Outline Rename');
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.id)).toBe(id);
  await page.evaluate(()=>window.neuroMapApp.undo());
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.text)).toBe(original);
  await page.evaluate(()=>window.neuroMapApp.redo());
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.text)).toBe('QA Outline Rename');
 });
 test('Search expands results visually without mutating a collapsed branch',async({page})=>{
  await page.evaluate(()=>{
   const app=window.neuroMapApp,root=app.state.root;
   root.children=[{id:'qa-parent',parentId:root.id,text:'Parent',side:'right',collapsed:true,
     children:[{id:'qa-hidden',parentId:'qa-parent',text:'Rare sentinel',side:'right',collapsed:false,children:[]}]}];
   app._nmKnowledge.open('outline');
  });
  await page.locator('#nm-knowledge-panel .nm-kn-query').fill('Rare sentinel');
  await expect(page.locator('.nm-kn-row .nm-kn-text')).toContainText(['', 'Parent','Rare sentinel']);
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.children[0].collapsed)).toBe(true);
 });
 test('Atlas finds cross-tab concepts, no cloning or file schema changes',async({page})=>{
  const before=await page.evaluate(()=>{
   const app=window.neuroMapApp;app.createNewTab('Second map');
   app.state.root.text='Atlas expected exact text';app.renderTabBar();
   return {tabs:app.tabs.length,id:app.state.root.id,docs:app.tabs.map(t=>JSON.stringify(t.state.root))};
  });
  await page.evaluate(()=>window.neuroMapApp._nmKnowledge.open('atlas'));
  await page.locator('#nm-knowledge-panel .nm-kn-query').fill('Atlas expected exact text');
  await expect(page.locator('.nm-kn-hit')).toHaveCount(1);
  const after=await page.evaluate(()=>({
   tabs:window.neuroMapApp.tabs.length,id:window.neuroMapApp.state.root.id,
   docs:window.neuroMapApp.tabs.map(t=>JSON.stringify(t.state.root))
  }));
  expect(after).toEqual(before);
 });
 test('Journey and Radar remain read-only until explicit user actions',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  await page.evaluate(()=>window.neuroMapApp._nmKnowledge.open('journey'));
  await expect(page.locator('#nm-knowledge-panel')).toContainText('Leggi passo passo');
  await page.evaluate(()=>window.neuroMapApp._nmKnowledge.open('radar'));
  await expect(page.locator('#nm-knowledge-panel')).toContainText('Scadenze dei ripassi');
  expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root))).toBe(before);
 });
});
test('inline Outline editing survives queued refresh and Escape cancels safely',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?._nmKnowledge);
 await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));const row=page.locator('.nm-kn-row').nth(1),name=row.locator('.nm-kn-text');const original=await name.textContent();await name.dblclick();const input=page.locator('.nm-kn-edit');await input.fill('Pending rename');
 await page.evaluate(()=>neuroMapApp._nmKnowledge.request());await page.evaluate(()=>new Promise(requestAnimationFrame));await expect(input).toHaveValue('Pending rename');await input.press('Escape');await expect(page.locator('.nm-kn-edit')).toHaveCount(0);await expect(page.locator('.nm-kn-row').nth(1).locator('.nm-kn-text')).toHaveText(original);
});
