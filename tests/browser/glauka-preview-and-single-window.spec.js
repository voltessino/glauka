const {test,expect}=require('@playwright/test');

async function ready(page){
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nm66PasteOutline&&window.neuroMapApp?.v6ImportNative);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}

test('hierarchy preview updates automatically after new text and clears when dialog closes',async({page})=>{
 await ready(page);
 await page.evaluate(()=>document.getElementById('btn-import-paste').click());
 await page.locator('#paste-modal-textarea').fill('Prima struttura\n\tVecchio ramo');
 await expect(page.locator('#nm-paste-preview')).toContainText('Vecchio ramo');
 await page.locator('#btn-cancel-paste').click();
 await expect(page.locator('#nm-paste-preview')).toBeHidden();
 await page.waitForFunction(()=>document.getElementById('paste-modal-textarea').value==='');
 await page.evaluate(()=>document.getElementById('btn-import-paste').click());
 await page.locator('#paste-modal-textarea').fill('Seconda struttura\n\tRamo nuovo');
 await expect(page.locator('#nm-paste-preview')).toContainText('Ramo nuovo');
 await expect(page.locator('#nm-paste-preview')).not.toContainText('Vecchio ramo');
});

test('large programmatic Ctrl+V regenerates preview without a manual click',async({page})=>{
 await ready(page);
 const first='Vecchia struttura\n\tVecchio nodo';
 await page.evaluate(()=>document.getElementById('btn-import-paste').click());
 await page.locator('#paste-modal-textarea').fill(first);
 await expect(page.locator('#nm-paste-preview')).toContainText('Vecchio nodo');
 await page.evaluate(()=>{
  const huge=Array.from({length:450},(_,i)=>'Nuovo ramo '+i+' '+'contenuti '.repeat(5)).join('\n');
  neuroMapApp.nm66PasteOutline(huge);
 });
 await expect(page.locator('#nm-paste-preview')).toContainText('Nuovo ramo 0');
 await expect(page.locator('#nm-paste-preview')).not.toContainText('Vecchio nodo');
});

test('a fresh app session does not resurrect a previous preview or opened dialog',async({page})=>{
 await ready(page);
 await page.evaluate(()=>document.getElementById('btn-import-paste').click());
 await page.locator('#paste-modal-textarea').fill('Mappa prima sessione\n\tRamo');
 await expect(page.locator('#nm-paste-preview')).toContainText('Mappa prima sessione');
 await page.reload();
 await page.waitForFunction(()=>window.neuroMapApp?.nm66PasteOutline);
 await expect(page.locator('#paste-modal')).toBeHidden();
 await expect(page.locator('#nm-paste-preview')).toBeHidden();
 expect(await page.locator('#paste-modal-textarea').inputValue()).toBe('');
});

test('Explorer opening an already-open .gk activates existing tab without duplicating it',async({page})=>{
 await ready(page);
 const value=await page.evaluate(async()=>{
  const app=neuroMapApp;
  app.createNewTab('Cardiologia');
  const tab=app.tabs.find(t=>t.id===app.activeTabId);
  tab.filePath='C:\\Documenti\\Glauka\\cardiologia.gk';
  tab.fileName='cardiologia.gk';
  tab.state.isDirty=true;
  const prior=app.tabs.length, original=tab.state.root, id=tab.id;
  app.createNewTab('Altro');
  await app.v6ImportNative({filename:'cardiologia.gk',path:'c:/documenti/glauka/CARDIOLOGIA.gk',bytes:new Uint8Array([123,125])},true);
  return {count:app.tabs.length,prior,active:app.activeTabId,id,identity:tab.state.root===original,dirty:tab.state.isDirty};
 });
 expect(value.count).toBe(value.prior+1);
 expect(value.active).toBe(value.id);
 expect(value.identity).toBe(true);
 expect(value.dirty).toBe(true);
});
