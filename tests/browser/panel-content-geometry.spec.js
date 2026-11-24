const {test,expect}=require('@playwright/test');
for(const theme of ['prisma','graphite'])for(const width of [900,1377])for(const language of ['it','en']){
 test(`panel content geometry ${theme} ${width} ${language}`,async({page},info)=>{
  await page.setViewportSize({width,height:800});
  await page.addInitScript(({theme,language})=>{
   localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale',language);
   localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme,contrast:'normal',readability:'compact'}));
   window.neuromapDesktop={productStatus:async()=>({plan:'pro'}),readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{}};
  },{theme,language});
  await page.goto(process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.nmSettings&&window.GlaukaI18n);
  await page.evaluate(async language=>{await window.GlaukaAppReady;await GlaukaI18n.setLanguage(language);document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));},language);
  if(width===900)await page.evaluate(()=>document.body.style.setProperty('--nm-right-panel-width','360px'));
  await page.addStyleTag({content:'*{transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
  await page.locator('#nm-open-insert').click();
  const insert=page.locator('#nm-insert-panel');
  const gaps=await insert.locator('.nm-insert-section').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();let previous=e.previousElementSibling;while(previous&&!previous.checkVisibility())previous=previous.previousElementSibling;return previous?r.top-previous.getBoundingClientRect().bottom:0}));
  for(const gap of gaps)expect(gap).toBeLessThanOrEqual(24);
  const shapes=insert.locator('#nm-insert-shapes');
  expect(await shapes.locator('h3').evaluate(e=>e.getBoundingClientRect().width/e.parentElement.getBoundingClientRect().width)).toBeGreaterThan(.95);
  await shapes.locator('summary').click();await expect(shapes.locator('.nm-insert-shape-tile').first()).toBeVisible();
  await shapes.locator('summary').click();
  await page.locator('#btn-toggle-inspector').click();
  const inspector=page.locator('#inspector-sidebar');
  const inset=await inspector.locator('.nm70-inspector-body > .inspector-section').first().evaluate(e=>e.getBoundingClientRect().left-e.parentElement.getBoundingClientRect().left);
  expect(inset).toBeLessThanOrEqual(12);
  const firstGap=await inspector.evaluate(e=>{const toolbar=e.querySelector('#nm-settings-style');let next=toolbar.nextElementSibling;while(next&&!next.checkVisibility())next=next.nextElementSibling;if(!next)return 0;return next.getBoundingClientRect().top-toolbar.getBoundingClientRect().bottom});
  expect(firstGap).toBeLessThanOrEqual(24);
  const headerHeight=await inspector.locator('.inspector-header').evaluate(e=>e.getBoundingClientRect().height);
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
  await page.evaluate(()=>{const a=neuroMapApp;const image=a.state.addImageItem({src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',width:100,height:100});a.selectImage(image.id)});
  await expect(page.locator('#img-width-value')).toHaveText('100 px');
  const withImage=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
  const image=page.locator('#image-controls');await expect(image).toBeVisible();
  const geometry=await image.evaluate(e=>{const r=e.getBoundingClientRect(),h=e.querySelector('.image-controls-header').getBoundingClientRect();return{left:h.left-r.left,right:r.right-h.right,height:h.height}});
  expect(geometry.left).toBeCloseTo(1,0);expect(geometry.right).toBeCloseTo(1,0);expect(Math.abs(geometry.height-headerHeight)).toBeLessThanOrEqual(1);
  const toggle=image.locator('.nm-panel-preview-toggle');
  await toggle.click();
  await expect(image).toHaveClass(/nm-panel-compact/);
  // Regression: the expanded image header is intentionally 24px wider to cover
  // inset padding, but the compact heading must stay within the compact panel.
  const compactHeader=await image.evaluate(panel=>{
   const outer=panel.getBoundingClientRect();
   const heading=panel.querySelector('.image-controls-header').getBoundingClientRect();
   return {left:heading.left-outer.left,right:outer.right-heading.right};
  });
  expect(compactHeader.left).toBeGreaterThanOrEqual(-1);
  expect(compactHeader.right).toBeGreaterThanOrEqual(-1);
  await toggle.click();
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(withImage);
  if(width===900&&language==='it')await page.screenshot({path:info.outputPath('image-panel.png')});
 });
}
