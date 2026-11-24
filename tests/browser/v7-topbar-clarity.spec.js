const {test,expect}=require('@playwright/test');
async function boot(page,width=1440){
 await page.setViewportSize({width,height:850});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&
  document.body.classList.contains('nm7-clear-topbar'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}
test.describe('v7 compact navigation — live browser screenshots and functional tests',()=>{
 for(const width of [360,768,1024,1440]){
  test(`topbars at ${width}px preserve accessible, non-duplicated commands`,async({page},testInfo)=>{
   await boot(page,width);
   await expect(page.locator('#nm-orbit-quick-toggle')).toHaveCount(0);
   await expect(page.locator('#nm-orbit-desktop-toggle')).toHaveCount(0);
   const selectors=['#btn-duplicate-tab','#btn-shortcuts','#nm7-guide-open',
     '#nm616-zen-switch','#btn-fullscreen','#btn-flashcards','#nm62-toolbar-assets',
     '#btn-illustrate','#btn-ai-settings'];
   for(const selector of selectors)await expect(page.locator(selector)).toHaveCount(1);
   await expect(page.locator('.tab-bar #btn-duplicate-tab')).toHaveCount(0);
   await expect(page.locator('.tab-bar #nm616-zen-switch')).toHaveCount(0);
   await expect(page.locator('#dropdown-view #nm616-zen-switch')).toHaveCount(1);
   await expect(page.locator('#dropdown-view #btn-fullscreen')).toHaveCount(1);
   await expect(page.locator('#dropdown-file #btn-duplicate-tab')).toHaveCount(1);
   await expect(page.locator('#dropdown-help #btn-shortcuts')).toHaveCount(1);
   await expect(page.locator('#dropdown-tools #btn-flashcards')).toHaveCount(1);
   await expect(page.locator('#nm7-advanced-navigation #nm69-nav-level')).toHaveCount(1);
   for(const name of ['File','Modifica','Inserisci','Visualizza','Strumenti','Aiuto'])
    await expect(page.locator('.toolbar-group .btn-ui').filter({hasText:name})).toHaveCount(1);
   await page.screenshot({path:testInfo.outputPath('topbar-'+width+'.png')});
   for(const [menu,entry] of [['btn-menu-tools','btn-flashcards'],
      ['btn-menu-help','nm7-guide-open'],['btn-menu-view','nm616-zen-switch']]){
    await page.locator('#'+menu).click();
    if(entry==='btn-flashcards')await page.locator('#nm-tools-study>summary').click();
    await expect(page.locator('#'+entry)).toBeVisible();
    const box=await page.locator('#'+entry).boundingBox();
    expect(box).not.toBeNull();
    expect(box.x,entry+' overflows left').toBeGreaterThanOrEqual(-1);
    expect(box.x+box.width,entry+' overflows right').toBeLessThanOrEqual(width+1);
    // The status bar wraps under the menu on narrow displays. A bounding
    // rectangle alone cannot detect occlusion; verify the actual hit target.
    const first=page.locator('#'+menu.replace('btn-menu-','dropdown-')+' .dropdown-item').first();
    const unobstructed=await first.evaluate(node=>{
     const rect=node.getBoundingClientRect();
     const target=document.elementFromPoint(rect.left+Math.min(rect.width*.5,70),rect.top+rect.height*.5);
     return target===node||node.contains(target);
    });
    expect(unobstructed,menu+' first item obscured by another toolbar').toBe(true);
    await page.keyboard.press('Escape');
   }
  });
 }
 test('360px recovery status is accessible without adding a debug header row',async({page})=>{
  await boot(page,360);
  await expect(page.locator('.top-chrome .status-pill')).toHaveCount(0);
  await expect(page.locator('#nm-internal-status')).toBeHidden();
  await expect(page.locator('#glauka-save-indicator')).toBeVisible();
  await expect(page.locator('#glauka-save-indicator')).toHaveAccessibleName(/.+/);
  await page.locator('#btn-menu-tools').click();
  const first=page.locator('#dropdown-tools .dropdown-item:visible').first();
  await expect(first).toBeVisible();
  const target=await first.evaluate(el=>{
   const r=el.getBoundingClientRect();
   const upper=document.elementFromPoint(r.left+35,r.top+r.height*.5);
   return upper===el||el.contains(upper);
  });
  expect(target).toBe(true);
 });
 test('Zen toggles from View and offers obvious exit without losing map data',async({page})=>{
  await boot(page);
  const before=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  await page.locator('#btn-menu-view').click();
  await page.locator('#nm616-zen-switch').click();
  await expect(page.locator('body')).toHaveClass(/nm616-zen/);
  await expect(page.locator('#nm616-zen-exit')).toBeVisible();
  await page.locator('#nm616-zen-exit').click();
  await expect(page.locator('body')).not.toHaveClass(/nm616-zen/);
  const after=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  expect(after).toBe(before);
 });
 test('Orbit appearance is selected from Style, not an extra header switch',async({page})=>{
  await boot(page);
  await page.evaluate(()=>window.NeuroMapUISkin.set({theme:'orbit'}));
  await expect(page.locator('body')).toHaveClass(/nm-orbit-workspace/);
  await expect(page.locator('#nm-orbit-quick-toggle')).toHaveCount(0);
  await expect(page.locator('#nm-orbit-desktop-toggle')).toHaveCount(0);
  await page.locator('#gl-settings-quick').click();
  await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
  const themes=await page.locator('#gl-settings-center .gl-settings-themes').boundingBox();
  const accent=await page.locator('#gl-settings-accent').boundingBox();
  expect(themes.y).toBeLessThan(accent.y);
  expect(await page.locator('#nm-orbit-desktop-settings').evaluate(el=>el.closest('#gl-appearance-park')?.hidden)).toBe(true);
  await page.evaluate(()=>window.NeuroMapUISkin.set({theme:'classic'}));
  await expect(page.locator('body')).toHaveClass(/nm-orbit-workspace/);
  await expect(page.locator('body')).toHaveAttribute('data-nm-skin','orbit');
 });
 test('Italian and English labels keep the same controls and menu grouping',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{document.documentElement.lang='en';window.NeuroMapTopbarCuration.curate()});
  await expect(page.locator('#btn-menu-help')).toHaveText('Help');
  await expect(page.locator('#btn-menu-tools')).toHaveText('Tools');
  await expect(page.locator('#btn-fullscreen')).toHaveText('Full screen');
  await expect(page.locator('#nm616-zen-switch')).toContainText('Zen mode');
 });
});
