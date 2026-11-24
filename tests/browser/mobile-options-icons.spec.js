const {test,expect}=require('@playwright/test');
test('Android options have distinct semantic icons, grouped commands and a reachable final action',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});await page.goto('http://127.0.0.1:5173/app/index.html');await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaMobileShell);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));});
 await page.locator('#glauka-options-open').click();
 const menu=page.locator('#glauka-sheet-content');await expect(menu).toHaveClass(/glauka-options-menu/);
 await expect(menu.locator('.glauka-app-section-title')).toHaveText(['Mappa','Viste','Progetto','Strumenti','Impostazioni']);
 const paths=await menu.locator('.glauka-app-action svg path').evaluateAll(els=>els.map(e=>e.getAttribute('d')));expect(paths.length).toBeGreaterThan(10);expect(new Set(paths).size).toBe(paths.length);
 const last=menu.getByRole('button',{name:'Free / Pro',exact:true});await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();
 await menu.evaluate(e=>e.scrollTop=0);await page.screenshot({path:info.outputPath('options-semantic-icons.png')});
});
