const {test,expect}=require('@playwright/test');
test('windowed overview keeps backing resolution, full text opacity and map coordinates through resize',async({browser})=>{
 const context=await browser.newContext({deviceScaleFactor:1.25,viewport:{width:1440,height:900}});const page=await context.newPage();
 await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.renderer&&!document.documentElement.classList.contains('glauka-booting'));await page.locator('#nm-home-close').click();
 const original=await page.evaluate(()=>{const a=neuroMapApp;a.renderer.camera.zoom=.43;a.renderer.visualFocusIds=null;return {root:JSON.stringify(a.state.root),camera:{...a.renderer.camera}};});
 for(const [width,height] of [[930,600],[1280,800],[900,620]]){
  await page.setViewportSize({width,height});const out=await page.evaluate(()=>{const a=neuroMapApp,r=a.renderer,c=r.canvas;let samples=[];const fill=r.ctx.fillText;r.ctx.fillText=function(...args){samples.push({alpha:this.globalAlpha,font:this.font});return fill.apply(this,args)};r.ctx.globalAlpha=.2;r.ctx.filter='blur(1px)';r.render();r.ctx.fillText=fill;return {css:c.clientWidth,backing:c.width,alpha:samples.map(s=>s.alpha),camera:{...r.camera},root:JSON.stringify(a.state.root)};});
  expect(out.backing).toBe(Math.floor(out.css*2));expect(out.alpha.length).toBeGreaterThan(0);expect(out.alpha.every(a=>a===1)).toBe(true);expect(out.camera).toEqual(original.camera);expect(out.root).toBe(original.root);
 }
 await context.close();
});
