const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test('desktop retry ignores transient errors and normal slow startup but remains available after a prolonged stall',async({page})=>{
 const source=fs.readFileSync('apps/desktop-shared/src/resources/index.html','utf8');
 const style=[...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).find(s=>s.includes('#glauka-startup{'));
 const guard=source.match(/<script id="glauka-startup-guard">([\s\S]*?)<\/script>/)[1];
 const startup=source.match(/<div id="glauka-startup"[\s\S]*?<\/div>/)[0];
 await page.clock.install();await page.setContent('<html class="glauka-booting"><head><style>'+style+'</style><style>button{display:inline-flex!important}</style></head><body>'+startup+'</body></html>');
 await page.addScriptTag({content:guard});const retry=page.locator('#glauka-startup-retry');
 await expect(retry).toBeHidden();await page.clock.runFor(19000);await expect(retry).toBeHidden();
 await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'non-fatal resource error'})));
 await expect(retry).toBeHidden();await page.clock.runFor(1001);await expect(retry).toBeHidden();
 await page.clock.runFor(100000);await expect(retry).toBeVisible();
 await page.evaluate(()=>GlaukaStartup.ready());
 await expect(page.locator('#glauka-startup')).toHaveCSS('opacity','0');
 await page.clock.runFor(300);
 await expect(page.locator('#glauka-startup')).toBeHidden();
});
test('phone options remain reachable with their original menu icon',async({page})=>{
 await page.setViewportSize({width:393,height:852});await page.goto('http://127.0.0.1:5173/app/index.html');await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaMobileShell);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));});
 const settings=page.locator('#glauka-options-open');await expect(settings).toBeVisible();expect(await settings.locator('path').getAttribute('d')).toContain('h.01');
 await settings.click();await expect(page.locator('#glauka-sheet-title')).toHaveText('Opzioni');await expect(page.locator('#glauka-sheet-content').getByRole('button',{name:'Lingua e impostazioni',exact:true})).toBeAttached();
});
