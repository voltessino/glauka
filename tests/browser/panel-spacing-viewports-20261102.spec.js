const {test,expect}=require('@playwright/test');
for(const width of [320,360,1280])for(const [theme,contrast]of [['orbit','normal'],['prisma','normal'],['neon','high']])test('tool spacing '+theme+' '+contrast+' '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.aiStudio&&window.NeuroMapUISkin);await page.evaluate(({theme,contrast})=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));NeuroMapUISkin.set({theme,contrast,readability:'comfortable'});},{theme,contrast});
 await page.locator('#btn-toggle-inspector').click();const side=page.locator('#inspector-sidebar');await expect(side).toBeVisible();
 expect(await side.locator('.nm-settings-toolbar').evaluate(e=>parseFloat(getComputedStyle(e).borderBottomWidth))).toBe(0);
 const r=await side.boundingBox();expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.x+r.width).toBeLessThanOrEqual(width+1);
 await page.evaluate(()=>neuroMapApp.aiStudio.open());const ai=page.locator('#nm-ai-studio');await expect(ai).toBeVisible();
 await page.evaluate(()=>neuroMapApp.aiStudio.serviceSummary.textContent='openai/gpt-oss-120b · configurato');
 const geometry=await ai.evaluate(e=>{const box=e.getBoundingClientRect(),head=e.querySelector(':scope>header').getBoundingClientRect(),body=e.querySelector('.nm-ai-body').getBoundingClientRect(),intro=e.querySelector('.nm-ai-body>p').getBoundingClientRect();return {left:box.left,right:box.right,headBottom:head.bottom,bodyTop:body.top,introTop:intro.top,children:[...e.querySelector(':scope>header').children].map(c=>({right:c.getBoundingClientRect().right,bottom:c.getBoundingClientRect().bottom}))};});
 expect(geometry.left).toBeGreaterThanOrEqual(-1);expect(geometry.right).toBeLessThanOrEqual(width+1);expect(geometry.bodyTop).toBeGreaterThanOrEqual(geometry.headBottom-1);expect(geometry.introTop).toBeGreaterThanOrEqual(geometry.headBottom+4);for(const c of geometry.children){expect(c.right).toBeLessThanOrEqual(geometry.right+1);expect(c.bottom).toBeLessThanOrEqual(geometry.headBottom+1);}
 await page.mouse.move(2,500);await page.screenshot({path:test.info().outputPath('panels.png')});
});
