const {test,expect}=require('@playwright/test');
for(const width of [720,1280,1920])for(const zoom of [1,1.5])test(`panel commands remain reachable at ${width}px and CSS zoom ${zoom}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nmSettings&&window.NeuroMapHome&&!document.documentElement.classList.contains('glauka-booting'));
 await page.evaluate(async zoom=>{await window.GlaukaAppReady;NeuroMapHome.close();document.documentElement.style.zoom=zoom},zoom);
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
 for(const [trigger,id] of [['v6-show-layout','.hud-bottom-left'],['btn-toggle-inspector','#inspector-sidebar'],['nm-open-insert','#nm-insert-panel'],['nm-learn-open','#nm-learn-panel'],['btn-ai-settings','#nm-ai-studio']]){
  await page.evaluate(trigger=>document.getElementById(trigger).click(),trigger);
  if(id==='#nm-ai-studio'){
   // A real Free profile must retain its license guard. Test the Pro shelf
   // geometry separately using the existing browser-only entitlement fixture.
   await expect(page.locator('#nm6-plan-modal')).toBeVisible();
   await expect(page.locator(id)).toBeHidden();
   await page.locator('#nm6-plan-close').click();
   await page.evaluate(()=>{window.nmProduct.guard=()=>true;window.nmProduct.isPro=()=>true;document.getElementById('btn-ai-settings').click()});
  }
  const panel=page.locator(id);await expect(panel).toBeVisible();
  const close=panel.locator('.nm-panel-header-actions button').last();await expect(close).toBeVisible();
  const box=await close.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(901);
  await close.click();await expect(panel).toBeHidden();
 }
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
 await page.screenshot({path:info.outputPath(`panels-${width}-${zoom}.png`)});
});
