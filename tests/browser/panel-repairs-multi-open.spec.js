const {test,expect}=require('@playwright/test');
async function boot(page,width=1280){await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.tabs&&!document.documentElement.classList.contains('glauka-booting'));await page.locator('#nm-home-close').click();}
test('multiple documents all import even while native dialog/background suspends animation frames',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const a=neuroMapApp,raf=window.requestAnimationFrame;window.requestAnimationFrame=()=>0;try{const count=await a.importFiles(['First','Second','Third'].map(n=>new File(['# '+n+'\n- Child'],n+'.md',{type:'text/markdown'})),true);return {count,titles:a.tabs.map(t=>t.state.root.text)};}finally{window.requestAnimationFrame=raf;}});expect(result.count).toBe(3);for(const t of ['First','Second','Third'])expect(result.titles).toContain(t);
});
for(const width of [800,1440])test('drawing has one home, shape picker stays wide and AI has a reachable close at '+width,async({page},info)=>{
 await boot(page,width);await page.locator('#nm-open-insert').click();
 await expect(page.locator('#nm-insert-create .nm-insert-drawing > #nm-drawing-open')).toBeVisible();
 await expect(page.locator('#nm-insert-panel #nm-insert-ink-tools')).toHaveCount(0);
 const picker=page.locator('#nm-shapes-picker>summary');await expect(picker).toBeVisible();expect((await picker.boundingBox()).width).toBeGreaterThan(180);
 await page.evaluate(()=>neuroMapApp.openAIStudio());
 const panel=page.locator('#nm-ai-studio');await expect(panel).toBeVisible();await expect(panel).toHaveCSS('opacity','1');await expect(page.locator('#nm-ai-close')).toBeVisible();
 const r=await page.locator('.nm-ai-header-actions').evaluate(e=>({w:e.scrollWidth,c:e.clientWidth}));expect(r.w).toBeLessThanOrEqual(r.c);
 await page.screenshot({path:info.outputPath('ai-header-'+width+'.png')});await page.locator('#nm-ai-close').click();await expect(panel).toBeHidden();
});
