const {test,expect}=require('@playwright/test');
test.describe('7.4 Quality Center',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmQuality74&&window.NeuroMapQualityCore);
 });
 test('reports broken source links without mutating map or flashcards',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp;
   app.state.root.children[0].taskDependsOn=['not_a_real_node'];
   app.state.root.children[0].dueDate='2026-01-01';
   window.__qcBefore=JSON.stringify(app.state.root);
   app._nmQuality74.open();
  });
  const dialog=page.locator('#nm-quality74');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.nm-quality-list')).toContainText('broken dependency');
  await dialog.locator('select').selectOption('error');
  await expect(dialog.locator('.nm-quality-list')).toContainText('broken dependency');
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(await page.evaluate(()=>window.__qcBefore));
 });
 test('report JSON download occurs only after user action',async({page})=>{
  await page.evaluate(()=>{
   window.__downloads=[];
   neuroMapApp.io.triggerDownload=async(blob,name)=>window.__downloads.push({name,text:await blob.text()});
   neuroMapApp._nmQuality74.open();
  });
  expect(await page.evaluate(()=>window.__downloads.length)).toBe(0);
  await page.locator('#nm-quality74').getByRole('button',{name:'Esporta report JSON'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__downloads.length)).toBe(1);
  const exported=await page.evaluate(()=>window.__downloads[0]);
  expect(exported.name).toMatch(/\.json$/);
  expect(JSON.parse(exported.text).format).toBe('neuromap-quality-report-v1');
 });
 test('explicit repair keeps nodes and records one Undo',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp;
   app.state.root.children[0].taskDependsOn=['missing-task'];
   window.__fixBefore={id:app.state.root.id,children:app.state.root.children.length};
   app.nmAsk=async()=> 'yes';
   app._nmQuality74.open();
  });
  const dialog=page.locator('#nm-quality74');
  await dialog.getByRole('button',{name:/Ripara prerequisiti mancanti/}).click();
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children[0].taskDependsOn.length)).toBe(0);
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].taskDependsOn)).toEqual(['missing-task']);
  expect(await page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(await page.evaluate(()=>window.__fixBefore.children));
 });
});