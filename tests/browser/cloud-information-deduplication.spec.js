const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('Cloud has one setup action per provider; technical details only appear on request',async({page})=>{
 await page.goto('http://127.0.0.1:5174/');
 // Use the real cloud UI with a native-status fixture, without real accounts or tokens.
 await page.goto('about:blank');await page.setContent('<div id="dropdown-file"></div><div class="tab-bar"></div>');
 await page.evaluate(()=>{window.GlaukaI18n={pair:(it,en)=>it};window.neuromapDesktop={cloudAuth:{status:async()=>({supported:true,google:{configured:false},dropbox:{configured:false},onedrive:{configured:false}}),getPublicConfig:async()=>({callback:'http://127.0.0.1/callback'})}};});
 await page.addScriptTag({path:path.resolve('apps/desktop-shared/src/cloud_panel.js')});
 await page.locator('#gl-cloud-open').click();
 const dialog=page.locator('#gl-cloud-dialog');const actions=dialog.getByRole('button',{name:'Dettagli',exact:true});await expect(actions).toHaveCount(3);
 await expect(dialog.locator('.gl-cloud-admin>summary')).toHaveCount(3);
 await expect(dialog.locator('.gl-cloud-brand small:visible')).toHaveCount(3);
 await expect(dialog.locator('svg.gl-cloud-provider-logo[aria-hidden=true]')).toHaveCount(3);
 for(let i=0;i<3;i++){
  const button=actions.nth(i);await expect(button).toHaveAttribute('aria-expanded','false');await button.click();
  const id=await button.getAttribute('aria-controls');const region=page.locator('#'+id);await expect(region).toBeVisible();await expect(region).toBeFocused();await expect(region).toContainText('non devi creare un’app OAuth');await expect(region.locator('input')).toBeHidden();await region.locator('.gl-cloud-admin>summary').click();await expect(region.locator('input')).toBeVisible();await expect(region.locator('a[target=_blank][rel="noopener noreferrer"]')).toHaveCount(2);
  await button.click();await expect(region).toBeHidden();await expect(button).toHaveAttribute('aria-expanded','false');
 }
});
test('Android panels keep a single close action instead of two identical controls',async({page})=>{
 await page.setViewportSize({width:393,height:852});await page.goto('http://127.0.0.1:5173/app/index.html');await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaAndroidStylePanel);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));});
 await page.locator('#glauka-options-open').click();const sheet=page.locator('#glauka-app-sheet');await expect(sheet.getByRole('button',{name:'Chiudi',exact:true})).toHaveCount(1);await page.locator('#glauka-sheet-close').click();await expect(sheet).toBeHidden();
 await page.evaluate(()=>GlaukaAndroidStylePanel.openNode());const format=page.locator('#gl-android-style-overlay');await expect(format.getByRole('button',{name:'Chiudi',exact:true})).toHaveCount(1);await format.getByRole('button',{name:'Chiudi',exact:true}).click();await expect(format).toHaveCount(0);
});
