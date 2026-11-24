const {test,expect}=require('@playwright/test');
for(const platform of ['android','windows','macos'])for(const width of [390,platform==='android'?768:1280]){
 test(`${platform} style panel keeps title first and scope inset at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.addInitScript(platform=>{localStorage.setItem('nm6_locale','it');Object.defineProperty(navigator,'platform',{get:()=>platform==='windows'?'Win32':platform==='macos'?'MacIntel':'Linux armv8l'});},platform);
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaI18n);
  await page.evaluate(async()=>{await window.GlaukaAppReady;document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));await GlaukaI18n.setLanguage('it');});
  if(platform==='android')await page.locator('#glauka-style-open').click();
  else await page.evaluate(()=>{if(document.getElementById('inspector-sidebar').classList.contains('collapsed'))document.getElementById('btn-toggle-inspector').click();});
  const panel=page.locator('#inspector-sidebar');await expect(panel).toBeVisible();
  await expect.poll(()=>panel.evaluate(e=>e.getAnimations().length)).toBe(0);
  const bounds=await panel.boundingBox(),header=await panel.locator('.inspector-header').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
  if(platform==='android'){
   const scope=panel.locator('.glauka-scope-options'),bar=await scope.boundingBox(),gallery=panel.locator('#gl-android-open-style');
   expect(bar.x-bounds.x).toBeGreaterThanOrEqual(20);expect(bounds.x+bounds.width-bar.x-bar.width).toBeGreaterThanOrEqual(20);
   const sticky=await panel.locator('.nm-settings-sticky-header').boundingBox();expect((await gallery.boundingBox()).y).toBeGreaterThanOrEqual(sticky.y+sticky.height-1);
   expect(header.y).toBeLessThan(bar.y);await scope.locator('summary').click();
  }else{
   const first=await panel.locator('#nm-settings-style label').first().boundingBox();expect(first.x-bounds.x).toBeGreaterThanOrEqual(20);
  }
  const before=await page.evaluate(()=>JSON.stringify({root:neuroMapApp.state.root,undo:neuroMapApp.state.undoStack.length}));
  await page.locator('#nm-format-target').selectOption('subtree');
  if(platform==='android')await expect(panel.locator('.glauka-scope-options > summary')).toContainText('Ramo e discendenti');
  else expect(await page.locator('#nm70-style-scope').inputValue()).toBe('subtree');
  await page.evaluate(async()=>{await GlaukaI18n.setLanguage('en');});
  if(platform==='android'){
   await expect(panel.locator('#gl-android-open-style')).toHaveText('Map styles');
   await panel.locator('#gl-android-open-style').click();await expect(page.locator('#gl-android-style-overlay')).toBeVisible();await page.locator('.gl-android-style-close').click();
  }
  expect(await page.evaluate(()=>JSON.stringify({root:neuroMapApp.state.root,undo:neuroMapApp.state.undoStack.length}))).toBe(before);
 });
}
