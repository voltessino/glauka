const {test,expect}=require('@playwright/test');

async function ready(page,locale='it',size={width:1280,height:800}){
 await page.setViewportSize(size);
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapUISkin&&
  document.getElementById('nm7-guide-open')&&document.getElementById('nm-ui-skin-readability'));
 await page.evaluate(async language=>{await GlaukaI18n.setLanguage(language);
  document.querySelectorAll('.nm6-shade').forEach(node=>node.classList.add('hidden'));
 },locale);
}
test.describe('NeuroMap 7 usability matrix — automated tasks, not human user research',()=>{
 for(const locale of ['it','en'])for(const width of [360,768,1440]){
  test(`${locale} · ${width}px · discoverable first steps and accessible dialog`,async({page})=>{
   await ready(page,locale,{width,height:800});
   const open=page.locator('#nm7-guide-open');
   await expect(open).toHaveAttribute('aria-label',locale==='en'?/First steps/i:/Primi passi/i);
   await page.locator('#btn-menu-help').click();
   await open.click();
   const dialog=page.locator('#nm7-guide-dialog');
   await expect(dialog).toBeVisible();
   await expect(dialog).toHaveAttribute('aria-modal','true');
   await expect(page.locator('#nm7-guide-steps li')).toHaveCount(3);
   await expect(page.locator('#nm7-guide-title')).toContainText(locale==='en'?'Start in three steps':'Comincia in tre gesti');
   const box=await dialog.boundingBox();
   expect(box).not.toBeNull();
   expect(box.x).toBeGreaterThanOrEqual(-1);
   expect(box.x+box.width).toBeLessThanOrEqual(width+1);
   await page.keyboard.press('Escape');
   await expect(dialog).not.toBeVisible();
   await expect(page.locator('#btn-menu-help')).toBeFocused();
  });
 }
 for(const locale of ['it','en']){
  test(`${locale} · readable settings increase target sizes and preserve map`,async({page})=>{
   await ready(page,locale);
   const previous=await page.evaluate(()=>({
    root:JSON.stringify(window.neuroMapApp.state.root),
    history:window.neuroMapApp.state.undoStack.length
   }));
   await page.evaluate(()=>window.NeuroMapUISkin.set({readability:'comfortable',contrast:'high'}));
   const result=await page.evaluate(()=>{
    const ids=['nm7-guide-open','btn-shortcuts','btn-zoom-in'];
    return {targets:ids.map(id=>{
      const b=document.getElementById(id),rect=b.getBoundingClientRect();
      return {id,minHeight:parseFloat(getComputedStyle(b).minHeight),
        rectHeight:rect.height};
     }),dataset:document.body.dataset.nmSkinReadability,
      root:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length};
   });
   expect(result.dataset).toBe('comfortable');
   for(const target of result.targets)expect(target.minHeight,target.id).toBeGreaterThanOrEqual(44);
   expect(result.root).toBe(previous.root);
   expect(result.history).toBe(previous.history);
   await page.evaluate(()=>window.NeuroMapUISkin.set({readability:'standard'}));
   await expect(page.locator('body')).toHaveAttribute('data-nm-skin-readability','standard');
  });
 }
 test('screen zoom approximation · 360px viewport with comfortable reading and native scroll',async({page})=>{
  await ready(page,'it',{width:360,height:640});
  await page.evaluate(()=>window.NeuroMapUISkin.set({readability:'comfortable'}));
  await page.locator('#btn-menu-help').click();
  await page.locator('#nm7-guide-open').click();
  await expect(page.locator('#nm7-guide-dialog')).toBeVisible();
  const dimensions=await page.locator('#nm7-guide-dialog').evaluate(el=>({
    clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,width:el.getBoundingClientRect().width
  }));
  expect(dimensions.clientHeight).toBeLessThanOrEqual(616);
  expect(dimensions.width).toBeLessThanOrEqual(344);
  await page.locator('#nm7-guide-close').click();
 });
 test('reduced motion user preference keeps guide usable',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await ready(page,'en');
  await page.locator('#btn-menu-help').click();
  await page.locator('#nm7-guide-open').click();
  await expect(page.locator('#nm7-guide-dialog')).toBeVisible();
  const motion=await page.locator('#nm7-guide-dialog').evaluate(el=>getComputedStyle(el).animationDuration);
  expect(['0s','0.00001s']).toContain(motion);
  await page.locator('#nm7-guide-close').click();
 });
 test('right-to-left and East Asian user content survives IT/EN and readable toggles',async({page})=>{
  await ready(page,'en');
  const before=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.text='خريطة العقل · 思维导图 · 🧠 · हिन्दी';
   if(!app.state.root.children.length)
    app.state.root.children.push({id:'rtl-test',text:'',side:'right',children:[]});
   app.state.root.children[0].text='מפה · 日本語 · e\u0301';
   return JSON.stringify(app.state.root);
  });
  await page.evaluate(()=>{
   window.NeuroMapUISkin.set({readability:'comfortable'});
   document.documentElement.lang='it';
  });
  await page.locator('#btn-menu-help').click();
  await page.locator('#nm7-guide-open').click();
  await expect(page.locator('#nm7-guide-title')).toHaveText(/Comincia in tre gesti/);
  const after=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  expect(after).toBe(before);
 });
});
