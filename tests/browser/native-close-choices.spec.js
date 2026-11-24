const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapLifecycle);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(n=>n.classList.add('hidden')));
});

test('closing an unsaved map tab shows app buttons: Save, Dont Save, Cancel',async({page})=>{
 const tabId=await page.evaluate(()=>{
  const app=neuroMapApp,tab=app.createNewTab('Test');
  app.state.root.text='Unsaved tab';
  app.state.isDirty=true;app.renderTabBar();
  return tab.id;
 });
 await page.evaluate(id=>{window.qaTabClose=neuroMapApp.closeTab(id);},tabId);
 const dialog=page.locator('#nm-decision-overlay');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('button')).toHaveText(['Salva','Non salvare','Annulla']);
 await dialog.getByRole('button',{name:'Annulla'}).click();
 expect(await page.evaluate(id=>neuroMapApp.tabs.some(t=>t.id===id),tabId)).toBe(true);
 await page.evaluate(id=>{window.qaTabClose=neuroMapApp.closeTab(id);},tabId);
 await dialog.getByRole('button',{name:'Non salvare'}).click();
 expect(await page.evaluate(id=>neuroMapApp.tabs.some(t=>t.id===id),tabId)).toBe(false);
});

test('closing app: saving failure/cancel preserves state and prevents exit',async({page})=>{
 await page.evaluate(()=>{
  const a=neuroMapApp;
  a.state.isDirty=true;
  a.saveAllTabs=async()=>false;
  window.qaClose=NeuroMapLifecycle.requestClose();
 });
 await expect(page.locator('#nm-decision-title')).toHaveText('Salvare le modifiche prima di uscire?');
 await page.locator('#nm-decision-actions').getByRole('button',{name:'Salva',exact:true}).click();
 expect(await page.evaluate(()=>window.qaClose)).toBe(false);
 expect(await page.evaluate(()=>neuroMapApp.state.isDirty)).toBe(true);
});

test('closing app: explicit Dont Save clears local fallback and does not flush it again',async({page})=>{
 const result=await page.evaluate(async()=>{
  const a=neuroMapApp;a.state.isDirty=true;
  // Browser fixture tests the same choice without a native service.
  localStorage.setItem('neuromap.workspace.v2','old recovery');
  window.qaClose=NeuroMapLifecycle.requestClose();
  await Promise.resolve();
  return {pending:!!window.qaClose};
 });
 expect(result.pending).toBe(true);
 await page.locator('#nm-decision-actions').getByRole('button',{name:'Non salvare'}).click();
 expect(await page.evaluate(()=>window.qaClose)).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('neuromap.workspace.v2'))).toBeNull();
});
