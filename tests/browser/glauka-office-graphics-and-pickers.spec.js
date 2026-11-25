const {test,expect}=require('@playwright/test');

async function boot(page){
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreativeModules?.drawing?.chartDialog);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}
test('Home has reachable X, and branch menu provides real compact choices',async({page})=>{
 await boot(page);
 await page.evaluate(()=>window.NeuroMapHome.open());
 await expect(page.locator('#nm-home-close')).toBeVisible();
 await page.locator('#nm-home-close').click();
 await expect(page.locator('#nm6-welcome')).toHaveClass(/hidden/);
 await page.locator('#gl-settings-quick').click();
 await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
 const picker=page.locator('#nm54-branch-picker');
 await expect(picker).toHaveAttribute('open','');
 await expect(picker.locator('button[data-style]')).toHaveCount(11);
 await picker.locator('button[data-style="dashed"]').click();
 expect(await page.evaluate(()=>neuroMapApp.state.branchStyle)).toBe('dashed');
 await expect(picker).toHaveAttribute('open','');
});
test('Insert picker shows 18 compact shapes and WordArt/Chart launchers',async({page})=>{
 await boot(page);
 await page.locator('#nm-open-insert').click();
 await expect(page.locator('#nm-shapes-picker')).not.toHaveAttribute('open','');
 await page.locator('#nm-shapes-picker summary').click();
 await expect(page.locator('#nm-insert-shapes .nm-insert-shape-tile')).toHaveCount(18);
 await expect(page.locator('#nm-insert-chart')).toBeVisible();
 await expect(page.locator('#nm-insert-wordart')).toBeVisible();
});
test('chart is editable, saved to graphics and can anchor to a node',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
  const app=neuroMapApp;app.selectNode(app.state.root.children[0].id);
 });
 await page.locator('#nm-open-insert').click();
 await page.locator('#nm-insert-chart').click();
 await expect(page.locator('#nm-chart-dialog')).toBeVisible();
 await expect(page.locator('.nm-chart-tile')).toHaveCount(12);
 await page.locator('#nm-chart-type-line').click();
 await page.locator('#nm-chart-title').fill('Vendite Q4');
 await page.locator('#nm-chart-add-row').click();
 await page.locator('#nm-chart-attach').check();
 await page.locator('#nm-chart-save').click();
 const created=await page.evaluate(()=>{
  const item=neuroMapApp.state.images.at(-1);
  return {kind:item.graphic?.kind,type:item.graphic?.type,title:item.graphic?.title,
   categories:item.graphic?.categories?.length,mode:item.mode,anchor:item.attachedNodeId,
   src:item.src.slice(0,30)};
 });
 expect(created).toMatchObject({kind:'chart',type:'line',title:'Vendite Q4',categories:5,mode:'attached'});
 expect(created.anchor).toBeTruthy();
 await page.evaluate(()=>NeuroMapCreativeModules.drawing.editGraphic(neuroMapApp));
 await expect(page.locator('#nm-chart-title')).toHaveValue('Vendite Q4');
 await page.locator('#nm-chart-title').fill('Vendite aggiornate');
 await page.locator('#nm-chart-save').click();
 expect(await page.evaluate(()=>neuroMapApp.state.images.at(-1).graphic.title)).toBe('Vendite aggiornate');
});
test('WordArt can be inserted free, updated and saved as vector',async({page})=>{
 await boot(page);
 await page.locator('#nm-open-insert').click();
 await page.locator('#nm-insert-wordart').click();
 await expect(page.locator('.nm-wordart-tile')).toHaveCount(8);
 await page.locator('#nm-wordart-text').fill('Glauka WordArt');
 await page.locator('#nm-wordart-neon').click();
 await page.locator('#nm-wordart-save').click();
 const created=await page.evaluate(()=>{
  const item=neuroMapApp.state.images.at(-1);
  const clone=neuroMapApp.state.constructor.cloneImages([item])[0];
  return {kind:clone.graphic?.kind,style:clone.graphic?.style,text:clone.graphic?.text,mode:clone.mode};
 });
 expect(created).toEqual({kind:'wordart',style:'neon',text:'Glauka WordArt',mode:'free'});
});
test('selected node highlighting is saved in snapshot and survives undo',async({page})=>{
 await boot(page);
 const out=await page.evaluate(()=>{
  const app=neuroMapApp;app.selectNode(app.state.root.children[0].id);
  document.querySelector('.nm-text-highlight-swatch[data-color="#facc15"]').click();
  const val=app.state.findNode(app.state.selectedNodeId).fontHighlight;
  const saved=app.state.createSnapshot().root.children[0].fontHighlight;
  app.state.undo();
  return {val,saved,after:app.state.root.children[0].fontHighlight||null};
 });
 expect(out).toEqual({val:'#facc15',saved:'#facc15',after:null});
});
