const {test,expect}=require('@playwright/test');
async function boot(page,platform){
 await page.setViewportSize({width:platform==='android'?393:1280,height:852});
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreative?.libraryHub);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=neuroMapApp,n=a.state.root.children[0];n.markers=[];n.objectArt=null;n.illustration=null;n.text='Concetto';a.selectNode(n.id);a.markChanged();});
}
for(const platform of ['android','desktop']){
 test(platform+' checks every applied symbol/icon and clears removed markers',async({page},info)=>{
  await boot(page,platform);await page.evaluate(()=>NeuroMapCreative.libraryHub(neuroMapApp));
  const hub=page.locator('#nm-creative-library-hub'),first=hub.locator('.nm-creative-library-glyph').first();
  await expect(first.locator('.nm-library-applied')).toBeHidden();await first.click();
  await expect(first.locator('.nm-library-applied')).toBeVisible();await expect(hub.getByRole('status')).toContainText('Aggiunto alla mappa');
  await first.click();await expect(first.locator('.nm-library-applied')).toBeHidden();await expect(hub.getByRole('status')).toContainText('Rimosso dal nodo');
  const alpha=hub.getByRole('button',{name:'α',exact:true});await alpha.click();await expect(alpha.locator('.nm-library-applied')).toBeVisible();
  expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).text)).toBe('Concettoα');
  await hub.getByRole('tab',{name:'Icone',exact:true}).click();const icons=hub.locator('.nm-creative-library-glyph');await icons.first().click();await expect(icons.first().locator('.nm-library-applied')).toBeVisible();await icons.nth(1).click();await expect(icons.first().locator('.nm-library-applied')).toBeHidden();await expect(icons.nth(1).locator('.nm-library-applied')).toBeVisible();
  await page.screenshot({path:info.outputPath(platform+'-applied-icons.png')});
 });
 test(platform+' SVG check represents applied data and refreshes after Undo while minimized',async({page})=>{
  await boot(page,platform);await page.evaluate(()=>NeuroMapCreative.libraryHub(neuroMapApp,'svg'));
  const hub=page.locator('#nm-creative-library-hub');await expect(hub.locator('.nm-library-applied:visible')).toHaveCount(0);
  await hub.locator('#nm-object-art-apply').click();expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).objectArt)).toBeNull();await page.evaluate(()=>NeuroMapCreative.libraryHub(neuroMapApp,'svg'));
  await hub.locator('[data-asset=amphora]').click();await expect(hub.locator('[data-asset=amphora] .nm-library-applied')).toBeVisible();
  const toggle=(platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Riduci',exact:true}));await expect(toggle.locator('svg path')).toHaveAttribute('d',platform==='desktop'?'m6 15 6-6 6 6':'m6 9 6 6 6-6');expect(await toggle.innerText()).toBe('');await expect(toggle).toHaveCSS('border-top-width','1px');expect((await toggle.boundingBox()).width).toBe(32);
  await toggle.click();await page.evaluate(()=>neuroMapApp.undo());
  const expand=(platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Espandi',exact:true}));await expect(expand.locator('svg path')).toHaveAttribute('d',platform==='desktop'?'m6 9 6 6 6-6':'m6 15 6-6 6 6');await expand.click();await expect(hub.locator('.nm-library-applied:visible')).toHaveCount(0);
 });
 test(platform+' personal inserts stay open with a visible check and added confirmation',async({page})=>{
  await boot(page,platform);await page.evaluate(()=>{const a=neuroMapApp,g=NeuroMapCreativeCore.graphic({kind:'shape',tool:'ellipse',text:'Prova',width:160,height:100});NeuroMapCreative.addGraphic(a,NeuroMapCreativeCore.shapeSVG(g),160,100,g);NeuroMapCreative.libraryHub(a,'personal');});
  const hub=page.locator('#nm-creative-library-hub');await hub.locator('#nm-library-name').fill('Disegno prova');await hub.locator('#nm-library-save').click();
  // Remove the selected source after saving, so the first badge starts inactive.
  await (platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Riduci',exact:true})).click();await page.evaluate(()=>{const a=neuroMapApp;a.state.images=[];a.state.selectedImageId=null;a.markChanged();});await (platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Espandi',exact:true})).click();
  const card=hub.locator('.nm-library-personal-card');await expect(card.locator('.nm-library-applied')).toBeHidden();await card.getByRole('button',{name:'Inserisci',exact:true}).click();await expect(hub).toBeVisible();await expect(card.locator('.nm-library-applied')).toBeVisible();await expect(hub.getByRole('status')).toContainText('Aggiunto alla mappa');
 });
}
test('Android interface preview is clear and accent changes update the visible chrome immediately',async({page},info)=>{
 await boot(page,'android');const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));await page.evaluate(()=>GlaukaAndroidStylePanel.openInterface());const overlay=page.locator('#gl-android-style-overlay');await expect(overlay).toHaveCSS('backdrop-filter','none');await expect(overlay).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 for(const [value,color,soft] of [['cyan','rgb(18, 110, 156)','rgb(226, 242, 250)'],['amber','rgb(148, 96, 18)','rgb(249, 237, 218)'],['violet','rgb(100, 65, 223)','rgb(238, 232, 255)']]){
  await overlay.getByRole('combobox',{name:'Accento',exact:true}).selectOption(value);await expect(page.locator('#glauka-map-fit')).toHaveCSS('color',color);await expect(page.locator('#glauka-ai-open')).toHaveCSS('color',color);await overlay.locator('.gl-android-style-close').click();await page.locator('#glauka-add-open').click();await expect(page.locator('#glauka-add-open')).toHaveCSS('background-color',soft);await page.locator('#glauka-sheet-close').click();await page.evaluate(()=>GlaukaAndroidStylePanel.openInterface());
 }
 await overlay.getByRole('combobox',{name:'Accento',exact:true}).selectOption('cyan');await page.screenshot({path:info.outputPath('android-clear-interface-preview.png')});expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
 await overlay.getByRole('button',{name:'Chiudi',exact:true}).click();await page.reload();await page.waitForFunction(()=>window.neuroMapApp);await expect(page.locator('#glauka-map-fit')).toHaveCSS('color','rgb(18, 110, 156)');
});
