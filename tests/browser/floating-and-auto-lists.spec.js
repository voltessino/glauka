const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android']){
 async function boot(page){await page.setViewportSize({width:platform==='android'?393:1280,height:852});await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it');});await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.renderer&&window.NeuroMapCaption?.automaticListsEnabled);await page.evaluate(()=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));neuroMapApp.importHierarchy({text:'Mappa',children:[{text:'Ramo centrale',children:[]}]},{newTab:true});});}
 test(platform+' independent branches do not inherit central continuation limits',async({page})=>{
  await boot(page);const result=await page.evaluate(async()=>{
   const a=neuroMapApp,s=a.state,r=s.root;r.layoutMode='clockwise';r.layoutDistribution={enabled:true,height:480,overflowMode:'expand'};
   const external=s.addChildNode(r.id,a.layout,'Argomento libero');external.isFloating=true;external.floatingPosition={x:900,y:300};a.markChanged();
   // Unknown-parent projections have no continuation page for independent topics.
   const natural=a.layout.predictContinuation?.(external.id);
   a.layout.predictContinuation=()=>({blocked:true});a.nmAsk=async()=> 'cancel';
   const child=s.addChildNode(external.id,a.layout,'Figlio libero');const grandchild=child&&s.addChildNode(child.id,a.layout,'Nipote libero');
   const rejected=s.addChildNode(r.children[0].id,a.layout,'Da bloccare');await Promise.resolve();
   return {child:child?.text,grandchild:grandchild?.text,rejected:rejected===null,floating:external.isFloating,mode:r.layoutMode,naturalBlocked:natural?.blocked};
  });expect(result.child).toBe('Figlio libero');expect(result.grandchild).toBe('Nipote libero');expect(result.rejected).toBe(true);expect(result.floating).toBe(true);expect(result.mode).toBe('clockwise');
 });
 test(platform+' typed numbering is literal until automatic lists are explicitly enabled',async({page})=>{
  await boot(page);expect(await page.evaluate(()=>NeuroMapCaption.automaticListsEnabled())).toBe(false);
  await page.evaluate(()=>{neuroMapApp.selectNode(neuroMapApp.state.root.children[0].id);neuroMapApp.editSelected();});
  const input=page.locator('#inline-editor-input');await input.fill('1) Primo');await input.press('Enter');await expect(input).toBeHidden();expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('1) Primo');
  await page.locator(platform==='android'?'#glauka-style-open':'#btn-toggle-inspector').click();
  const more=page.locator('#inspector-sidebar .glauka-text-more > summary');
  await more.scrollIntoViewIfNeeded();
  await more.click();
  const setting=page.locator('#glauka-automatic-lists');await setting.check();await expect(setting).toBeChecked();
  await page.evaluate(()=>neuroMapApp.editSelected());await input.fill('1) Primo');await input.press('End');await input.press('Enter');await expect(input).toHaveValue('1) Primo\n2) ');await input.press('Escape');
  await page.reload();await page.waitForFunction(()=>window.NeuroMapCaption?.automaticListsEnabled);expect(await page.evaluate(()=>NeuroMapCaption.automaticListsEnabled())).toBe(true);
 });
}
