const {test,expect}=require('@playwright/test');

async function ready(page){
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nmSettings&&window.NM615?.pasteWizard);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}
async function dialog(page,content){
 await page.evaluate(()=>document.getElementById('paste-modal').classList.remove('hidden'));
 await page.locator('#paste-modal-textarea').fill(content);
 await page.locator('#btn-confirm-paste-newtab').click();
 await expect(page.locator('#gl-paste-studio')).toBeVisible();
}
test('Glauka clipboard choices explain their effects and the optional AI provider',async({page})=>{
 await ready(page);
 await expect(page.locator('#btn-confirm-paste-current')).toContainText('Incolla nella mappa attuale');
 await expect(page.locator('#btn-confirm-paste-newtab')).toContainText('Crea mappe dagli appunti');
 await expect(page.locator('#gl-paste-ai-explain')).toContainText('provider');
});
test('single map naming and common clockwise layout do not overwrite original',async({page})=>{
 await ready(page);
 const old=await page.evaluate(()=>({count:neuroMapApp.tabs.length,tree:JSON.stringify(neuroMapApp.state.root)}));
 await dialog(page,'# Test schema\n- Organo\n  - Istologia\n- Sistema');
 await page.locator('#gl-import-mode').selectOption('one');
 await page.locator('#gl-import-layout').selectOption('clockwise');
 await page.locator('#gl-import-map-name').fill('Istologia personalizzata');
 await page.locator('#gl-paste-studio .nm615-primary').click();
 const output=await page.evaluate(()=>({
  count:neuroMapApp.tabs.length,last:neuroMapApp.state.root.text,
  mode:neuroMapApp.state.root.layoutMode,enabled:neuroMapApp.state.root.layoutDistribution?.enabled,
  first:JSON.stringify(neuroMapApp.tabs[0].state.root)}));
 expect(output.count).toBe(old.count+1);
 expect(output.last).toBe('Istologia personalizzata');
 expect(output.mode).toBe('clockwise');
 expect(output.enabled).toBe(true);
 expect(output.first).toBe(old.tree);
});
test('multiple maps: compact rename selector and shared balanced layout for every new tab',async({page})=>{
 await ready(page);
 const originalCount=await page.evaluate(()=>neuroMapApp.tabs.length);
 const text=Array.from({length:360},(_,i)=>'Capitolo '+(i+1)).join('\n');
 await dialog(page,text);
 await page.locator('#gl-import-mode').selectOption('split');
 await page.locator('#gl-import-capacity').selectOption('80');
 await page.locator('#gl-import-layout').selectOption('balanced');
 const count=await page.locator('#gl-import-map-select option').count();
 expect(count).toBeGreaterThan(1);
 await page.locator('#gl-import-map-select').selectOption('0');
 await page.locator('#gl-import-map-name').fill('Capitolo personalizzato');
 await page.locator('#gl-import-map-select').selectOption('1');
 await page.locator('#gl-paste-studio .nm615-primary').click();
 const tabs=await page.evaluate(start=>neuroMapApp.tabs.slice(start).map(t=>({
  name:t.title,mode:t.state.root.layoutMode,enabled:t.state.root.layoutDistribution?.enabled
 })),originalCount);
 expect(tabs).toHaveLength(count);
 expect(tabs[0].name).toBe('Capitolo personalizzato');
 expect(tabs.every(t=>t.mode==='balanced'&&t.enabled===false)).toBe(true);
});
test('canceling the import studio never modifies any map',async({page})=>{
 await ready(page);
 const old=await page.evaluate(()=>JSON.stringify(neuroMapApp.tabs.map(t=>t.state.root)));
 await dialog(page,'# A\n- B');
 await page.locator('#gl-paste-studio button').filter({hasText:'Annulla'}).click();
 await expect(page.locator('#gl-paste-studio')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.tabs.map(t=>t.state.root)))).toEqual(old);
});

test('apply clockwise to ALL tabs survives workspace reload and .gk reimport',async({page})=>{
 await ready(page);
 const snapshot=await page.evaluate(async()=>{
  const a=neuroMapApp;
  a.createNewTab('Glauka prima');
  a.createNewTab('Glauka seconda');
  const scope=document.getElementById('nm-settings-scope-layout');
  scope.value='all';scope.dispatchEvent(new Event('change',{bubbles:true}));
  document.getElementById('nm-mode-right').click();
  document.getElementById('nm-mode-clockwise').click();
  a.persistWorkspace();
  const all=a.tabs.every(t=>t.state.root.layoutMode==='clockwise'&&t.state.root.layoutDistribution?.enabled);
  const payload=a.io.buildSerializedProjectPayload();
  await a.importFile(new File([JSON.stringify(payload)],'glauka-test.gk'),{newTab:true});
  a.persistWorkspace();
  return {all,imported:a.state.root.layoutMode,enabled:a.state.root.layoutDistribution?.enabled,
          count:a.tabs.length};
 });
 expect(snapshot.all).toBe(true);
 expect(snapshot.imported).toBe('clockwise');
 expect(snapshot.enabled).toBe(true);
 await page.reload();
 await page.waitForFunction(()=>window.neuroMapApp?.nmSettings);
 const persisted=await page.evaluate(()=>neuroMapApp.tabs.map(t=>({
  title:t.title,clockwise:t.state.root.layoutMode==='clockwise'&&!!t.state.root.layoutDistribution?.enabled
 })));
 expect(persisted).toHaveLength(snapshot.count);
 expect(persisted.every(t=>t.clockwise)).toBe(true);
});
