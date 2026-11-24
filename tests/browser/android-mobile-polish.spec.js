const {chooseTool}=require('./android-tools-helper');
'use strict';
const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it');});
 await page.goto('http://127.0.0.1:5178/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapAndroid74&&
   document.getElementById('gl-mobile-node-actions'));
});
test('Orbit is removed and Android tools have readable controls on a light surface',async({page})=>{
 expect(await page.locator('#nm-orbit-settings,#nm-orbit-toggle,#nm-orbit-stylesheet').count()).toBe(0);
 await page.locator('#nm74-launch').click();
 await expect(page.locator('#nm74-title')).toHaveText('Studio e strumenti');
 const colors=await page.locator('#nm74-overlay .nm74-sheet').evaluate(el=>{
  const style=getComputedStyle(el);return {bg:style.backgroundColor,ink:style.color}
 });
 expect(colors.ink).not.toBe(colors.bg);
 await chooseTool(page,'.nm74-tab[data-section=documents]');
 const field=page.locator('#nm74-overlay .nm74-file-field');
 await expect(field).toBeVisible();
 await expect(field.locator('.nm74-file-pick')).toContainText('Scegli file');
 await expect(field.locator('.nm74-file-name')).toHaveText('Nessun file selezionato');
 await field.locator('input[type=file]').setInputFiles({
  name:'appunti.txt',mimeType:'text/plain',buffer:Buffer.from('Capitolo primo\n\nCapitolo secondo')
 });
 await expect(field.locator('.nm74-file-name')).toContainText('appunti.txt');
});
test('the same language preference translates navigation, tool content and Android dock',async({page})=>{
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=documents]');
 await expect(page.locator('.nm74-tab[data-section=documents]')).toContainText('Importa documenti');
 await page.locator('#glauka-android-language').selectOption('en');
 await expect(page.locator('.nm74-tab[data-section=documents]')).toContainText('Import documents');
 await expect(page.locator('.nm74-file-pick')).toContainText('Choose file');
 await expect(page.locator('#nm74-title')).toHaveText('Import documents');
 await expect(page.locator('#glauka-edit span')).toHaveText('Edit');
 await page.locator('#glauka-android-language').selectOption('it');
 await expect(page.locator('.nm74-tab[data-section=documents]')).toContainText('Importa documenti');
 await expect(page.locator('.nm74-file-pick')).toContainText('Scegli file');
 await expect(page.locator('#glauka-edit span')).toHaveText('Modifica');
});
test('changing interface language never discards unsaved Quick Capture notes',async({page})=>{
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=capture]');
 const title=page.locator('#nm74-overlay .nm74-content input').first();
 await title.fill('Important anatomy note');
 await page.locator('#glauka-android-language').selectOption('en');
 await expect(page.locator('#glauka-android-language')).toHaveValue('it');
 await expect(title).toHaveValue('Important anatomy note');
 await expect(page.locator('#toast-text')).toContainText('Completa');
});
test('selected branch exposes Add/Edit/Delete, delete needs confirmation and supports Undo',async({page})=>{
 const node=await page.evaluate(()=>{
  const a=neuroMapApp;
  a.importHierarchy({text:'Anatomia',children:[{text:'Cuore',children:[{text:'Atrio',children:[]}]}]},{newTab:true});
  const first=a.state.root.children[0];
  a.selectNode(first.id);
  return first.id;
 });
 const bar=page.locator('#gl-mobile-node-actions');
 await expect(bar).toBeVisible();
 await expect(bar.locator('.gl-node-name')).toContainText('Cuore');
 await expect(bar.locator('.gl-node-edit')).toBeVisible();
 await expect(bar.locator('.gl-node-delete')).toBeVisible();
 await page.evaluate(()=>{neuroMapApp.nmAsk=async()=> 'cancel';});
 await bar.locator('.gl-node-delete').click();
 expect(await page.evaluate(id=>!!neuroMapApp.state.findNode(id),node)).toBe(true);
 await page.evaluate(()=>{neuroMapApp.nmAsk=async()=> 'delete';});
 await bar.locator('.gl-node-delete').click();
 await expect.poll(()=>page.evaluate(id=>!!neuroMapApp.state.findNode(id),node)).toBe(false);
 await page.evaluate(()=>neuroMapApp.undo());
 expect(await page.evaluate(id=>!!neuroMapApp.state.findNode(id),node)).toBe(true);
});
test('root selection and tab changes never show a destructive root action',async({page})=>{
 const bar=page.locator('#gl-mobile-node-actions');
 await page.evaluate(()=>neuroMapApp.selectNode(neuroMapApp.state.root.id));
 await expect(bar).toBeHidden();
 await page.evaluate(()=>{
  const a=neuroMapApp;
  a.importHierarchy({text:'Mappa A',children:[{text:'Figlio',children:[]}]},{newTab:true});
  a.selectNode(a.state.root.children[0].id);
 });
 await expect(bar).toBeVisible();
 await page.evaluate(()=>neuroMapApp.createNewTab('Mappa B'));
 await expect(bar).toBeHidden();
});
