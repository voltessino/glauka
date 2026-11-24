const {test,expect}=require('@playwright/test');
const {openSettings}=require('./settings-path');
async function boot(page,width=1440,language='it'){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapUISkin);
 const welcome=page.locator('#nm6-welcome-start');
 if(await welcome.isVisible())await welcome.click();
 await page.evaluate(async locale=>{await GlaukaI18n.setLanguage(locale);},language);
}
test('fresh install uses calm surfaces and borderless menu commands',async({page})=>{
 await boot(page);await expect(page.locator('body')).toHaveClass(/nm-workspace-v2/);
 await expect(page.locator('#nm-workspace-layout-style')).toHaveCount(1);
 const style=await page.locator('#btn-menu-file').evaluate(el=>{const s=getComputedStyle(el);return {shadow:s.boxShadow,background:s.backgroundImage,border:s.borderTopColor}});
 expect(style.shadow).toBe('none');expect(style.background).toBe('none');expect(style.border).toBe('rgba(0, 0, 0, 0)');
 await expect(page.locator('#gl-settings-center')).toHaveCount(0);
});

for(const width of [360,768,1440])for(const language of ['it','en']){
 test(`${width}px ${language}: reference cards fit, controls work and map remains unchanged`,async({page},testInfo)=>{
  await boot(page,width,language);
  const before=await page.evaluate(()=>({snapshot:JSON.stringify(neuroMapApp.state.createSnapshot()),undo:neuroMapApp.state.undoStack.length}));
  await openSettings(page,'appearance');
  const card=page.locator('#gl-settings-body');
  await expect(card).toBeVisible();
  await page.locator('#gl-settings-more-themes>summary').click();
  await expect(page.locator('#gl-settings-more-themes>summary')).toHaveText(language==='it'?'Altri temi':'Other themes');
  await expect(page.locator('#gl-settings-contrast')).toHaveAttribute('aria-label',language==='it'?'Contrasto':'Contrast');
  for(const selector of ['#gl-settings-theme-extra','#gl-settings-contrast','#gl-settings-control-size']){
   const geometry=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect(),p=el.closest('section').getBoundingClientRect();
    return {inside:r.x>=p.x-1&&r.right<=p.right+1,arrow:getComputedStyle(el).appearance,client:el.clientWidth};
   });
   expect(geometry.inside).toBe(true);expect(geometry.client).toBeGreaterThan(65);
   expect(geometry.arrow).toBe('auto');
  }
  expect(await card.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await page.locator('#gl-settings-contrast').selectOption('high');
  await expect(page.locator('body')).toHaveAttribute('data-nm-skin-contrast','high');
  await page.locator('#gl-settings-control-size').selectOption('comfortable');
  await expect(page.locator('#gl-settings-control-size')).toHaveCSS('min-height','44px');
  await page.locator('#gl-settings-control-size').selectOption('standard');
  await page.locator('#gl-settings-contrast').selectOption('normal');
  await page.mouse.move(1,400);
  await page.screenshot({path:testInfo.outputPath(`interface-${width}-${language}.png`)});
  await card.screenshot({path:testInfo.outputPath(`themes-${width}-${language}.png`)});
  await page.locator('#gl-settings-close').click();
  await expect(page.locator('#gl-settings-shade')).toHaveCount(0);
  await page.locator('#btn-toggle-inspector').click();
  await page.locator('#v6-show-layout').click();
  const views=page.locator('#nm-view-switch');await views.scrollIntoViewIfNeeded();
  await expect(views.locator(':scope > label')).toHaveText(language==='it'?'Visualizza come':'View as');
  await page.locator('#nm-view-picker-trigger').click();
  await expect(page.locator('#nm-view-picker-gallery .nm-view-choice')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await page.locator('#nm-view-split').click();
  await expect(page.locator('#nm-view-split')).toHaveAttribute('aria-pressed','true');
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-split')).toHaveAttribute('aria-pressed','false');
  await views.screenshot({path:testInfo.outputPath(`views-${width}-${language}.png`)});
  expect(await page.evaluate(()=>({snapshot:JSON.stringify(neuroMapApp.state.createSnapshot()),undo:neuroMapApp.state.undoStack.length}))).toEqual(before);
 });
}
test('existing preferences survive restart, including contrast and readability',async({page})=>{
 await boot(page);
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'graphite',contrast:'high',readability:'comfortable'}));
 await page.reload();await page.waitForFunction(()=>window.NeuroMapUISkin);
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','graphite');
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin-contrast','high');
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin-readability','comfortable');
});
test('valid PDF signature is accepted and tampered headers are refused in browser',async({page})=>{
 await boot(page);
 const result=await page.evaluate(async()=>{
  const source=NeuroMapSourceCore;
  const valid=await source.fingerprint(new File(['%PDF-1.7\n%%EOF'],'evidence.pdf',{type:'application/pdf'}));
  let rejected=false;
  try{await source.fingerprint(new File(['not a PDF'],'evidence.pdf',{type:'application/pdf'}))}catch(e){rejected=/PDF header/.test(e.message)}
  return {valid,rejected};
 });
 expect(result.valid).toMatch(/^[a-f0-9]{64}$/);expect(result.rejected).toBe(true);
});
test('Android default bars use the same finish and retain touch targets',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:5173/app/index.html');
 await page.waitForSelector('#glauka-app-header button');
 const surfaces=await page.locator('#glauka-app-header,#glauka-app-dock').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));
 expect(surfaces).toHaveLength(2);expect(surfaces[0]).toBe(surfaces[1]);
 const first=page.locator('#glauka-app-header button').first();
 expect((await first.boundingBox()).height).toBeGreaterThanOrEqual(40);
 await page.screenshot({path:test.info().outputPath('android-default.png')});
});
