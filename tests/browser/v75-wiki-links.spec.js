const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 7.5 Markdown Knowledge Links desktop',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmWiki75&&window.NeuroMapWikiLinks);
 });
 test('edits node Markdown without duplicating data, Undo reverts one step',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp;window.__wikiBefore=app.state.root.notes||'';
   app.selectNode(app.state.root.id);app._nmWiki75.open();
  });
  const dialog=page.locator('#nm75-overlay');
  await expect(dialog).toBeVisible();
  const field=dialog.locator('.nm75-panel textarea').first();
  await field.fill('# Hello\n**Strong** <img src=x onerror=alert(1)>');
  await expect(dialog.locator('.nm75-preview strong')).toHaveText('Strong');
  await expect(dialog.locator('.nm75-preview img')).toHaveCount(0);
  await dialog.getByRole('button',{name:/Salva nota/}).click();
  expect(await page.evaluate(()=>neuroMapApp.state.root.notes)).toContain('Strong');
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.notes||'')).toBe(await page.evaluate(()=>window.__wikiBefore));
 });
 test('canonical references survive target rename and surface backlinks',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp,root=app.state.root;
   const child=root.children[0]||app.state.addChildNode(root.id,app.layout);
   child.text='Target test node';
   root.notes=NeuroMapWikiLinks.format({rootId:root.id,nodeId:child.id,title:child.text});
   child.text='Renamed target';
   app.selectNode(child.id);app._nmWiki75.open();
  });
  const dialog=page.locator('#nm75-overlay');
  await expect(dialog).toContainText('Backlink');
  await expect(dialog.locator('.nm75-col').nth(1)).toContainText('→');
 });
});
