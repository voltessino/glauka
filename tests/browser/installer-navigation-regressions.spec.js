const {test,expect}=require('@playwright/test');
const {chooseTheme}=require('./settings-path');
async function boot(page,width=1440,locale='it'){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapUISkin);
 await page.locator('#nm6-welcome-start').click();
 await page.evaluate(async value=>{await GlaukaI18n.setLanguage(value);},locale);
}
for(const width of [360,1440])for(const locale of ['it','en']){
 test(`${width}px ${locale}: compass contains working, labelled navigation controls`,async({page},testInfo)=>{
  await boot(page,width,locale);
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.locator('#nm614-open-navigation').click();
  const fly=page.locator('#nm614-navigation-flyout');
  const level=fly.locator('#nm69-nav-level'),order=fly.locator('#nm612-nav-order');
  await expect(level).toBeVisible();await expect(order).toBeVisible();
  expect(await level.evaluate(el=>el.parentElement.tagName)).toBe('LABEL');
  expect(await order.evaluate(el=>el.parentElement.tagName)).toBe('LABEL');
  await level.selectOption('2');await order.selectOption('source');
  await fly.locator('#nm67-next-main').click();
  const selected=await page.evaluate(()=>({
   id:neuroMapApp.state.selectedNodeId,
   eligible:neuroMapApp.nm69NodesAtLevel(2).map(n=>n.id),
   root:JSON.stringify(neuroMapApp.state.root)
  }));
  expect(selected.eligible).toContain(selected.id);expect(selected.root).toBe(before);
  const box=await fly.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(width);
  await page.mouse.move(5,650);
  await page.screenshot({path:testInfo.outputPath(`navigation-${width}-${locale}.png`)});
  await page.keyboard.press('Escape');await expect(fly).toBeHidden();
 });
}
test('brand is not duplicated and book control stays named in either language',async({page})=>{
 await boot(page);
 await expect(page.locator('.brand-product-name')).toBeHidden();
 await expect(page.locator('.brand-Mini')).toBeVisible();
 await expect(page.locator('#nm-build-revision')).toHaveCount(0);
 await page.locator('#btn-menu-help').click();await page.locator('#nm-about-open').click();
 await expect(page.locator('#nm-decision-text')).toContainText(require('../../versions.json').editor);
 await page.locator('#nm-decision-actions button').click();
 const study=page.locator('#nm-learn-open');
 await expect(study.locator('svg')).toHaveCount(1);await expect(study).toHaveText('');
 await expect(study).toHaveAttribute('aria-label','Studio e ripasso');
 await study.click();await expect(study).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(study).toHaveAttribute('aria-expanded','false');
 await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});
 await expect(study).toHaveAttribute('aria-label','Study and review');
});
test('purple is an explicit persistent alternative, while Classic remains blue',async({page},testInfo)=>{
 await boot(page);
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
 await chooseTheme(page,'purple');
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','purple');
 expect(await page.locator('.tab-bar').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(23, 20, 47)');
 await page.locator('#gl-settings-center').scrollIntoViewIfNeeded();
 await page.mouse.move(10,400);await page.screenshot({path:testInfo.outputPath('purple-interface.png')});
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
 await page.reload();await page.waitForFunction(()=>window.NeuroMapUISkin);
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','purple');
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'classic'}));
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','orbit');
 expect(await page.locator('.tab-bar').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(7, 20, 47)');
});
