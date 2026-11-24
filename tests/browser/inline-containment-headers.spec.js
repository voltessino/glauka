const {test,expect}=require('@playwright/test');
async function boot(page,platform){
 await page.setViewportSize({width:platform==='android'?393:1280,height:852});
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreative?.libraryHub);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));});
}
for(const platform of ['android','desktop']){
 test(platform+' draft stays inside its live node geometry and cancel restores the original size',async({page},info)=>{
  await boot(page,platform);
  const initial=await page.evaluate(()=>{const a=neuroMapApp,n=a.state.root.children[0].children[0];n.text='Tavolozza Armonica';n.labelWrapChars=10;a.markChanged();a.selectNode(n.id);const m=a.layout.getLayout(n.id),result={text:n.text,width:m.width,height:m.height,undo:a.state.undoStack.length};a.editSelected();return result;});
  const field=page.locator('#inline-editor-input');
  async function contained(){
   const r=await field.evaluate(e=>{const a=neuroMapApp,m=a.layout.getLayout(a.editorNodeId),n=a.state.findNode(a.editorNodeId),g=NeuroMapCreativeCore.objectGeometry(n,m),z=a.renderer.camera.zoom,p=a.renderer.worldToScreen(m.x,g?g.labelY+g.labelHeight/2:m.y),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,left:p.x-(g?.labelWidth||m.width)*z/2,right:p.x+(g?.labelWidth||m.width)*z/2,top:p.y-(g?.labelHeight||m.height)*z/2,bottom:p.y+(g?.labelHeight||m.height)*z/2};});
   expect(r.x).toBeGreaterThanOrEqual(r.left-1);expect(r.x+r.w).toBeLessThanOrEqual(r.right+1);expect(r.y).toBeGreaterThanOrEqual(r.top-3);expect(r.y+r.h).toBeLessThanOrEqual(r.bottom+1);
  }
  await contained();await page.screenshot({path:info.outputPath(platform+'-contained-edit.png')});
  for(const text of ['Un testo più lungo che si adatta al ramo','Unaparolalunghissimasenzaspazichedeverimaneredentro','Prima riga\nSeconda riga\nTerza riga']){await field.fill(text);await contained();expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.editorNodeId).text)).toBe(initial.text);}
  await field.press('Escape');const restored=await page.evaluate(()=>{const a=neuroMapApp,m=a.layout.getLayout(a.state.selectedNodeId);return {width:m.width,height:m.height,undo:a.state.undoStack.length,draft:a.layout.editingLabel};});expect(restored).toEqual({width:initial.width,height:initial.height,undo:initial.undo,draft:null});
  await page.evaluate(()=>{const a=neuroMapApp,n=a.state.findNode(a.state.selectedNodeId);n.objectArt={id:'amphora',size:100};a.markChanged();a.editSelected();});await field.fill('Etichetta del vaso\nSeconda riga');await contained();await field.press('Enter');expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).text)).toBe('Etichetta del vaso\nSeconda riga');await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).text)).toBe(initial.text);
 });
 test(platform+' scrolled title seals the top inset and SVG summary only describes an applied object',async({page},info)=>{
  await boot(page,platform);await page.evaluate(()=>{const a=neuroMapApp;a.selectNode(a.state.root.children[0].id);NeuroMapCreative.libraryHub(a,'svg');});
  const hub=page.locator('#nm-creative-library-hub'),summary=hub.locator('#nm-object-art-preview');await expect(summary).toBeHidden();await expect(hub.locator('#nm-object-art-size')).toBeHidden();await expect(summary.locator('img')).toHaveCount(0);
  await hub.locator('[data-asset=amphora]').click();await expect(summary).toContainText('Aggiunto alla mappa');await expect(summary).toContainText('Vaso classico');await summary.scrollIntoViewIfNeeded();const bg=await summary.evaluate(e=>getComputedStyle(e).backgroundColor);expect(['rgba(0, 0, 0, 0)','rgb(255, 255, 255)']).toContain(bg);if(platform==='android')await expect(summary.locator('strong')).toHaveCSS('color',await hub.locator('h2').evaluate(e=>getComputedStyle(e).color));expect((await summary.boundingBox()).height).toBeLessThan(110);
  const seal=await hub.locator('.nm-creative-dialog').evaluate(panel=>{const h=panel.querySelector('header'),p=panel.getBoundingClientRect(),r=h.getBoundingClientRect(),s=getComputedStyle(h,'::before');return {top:r.y+parseFloat(s.top),edge:p.y,bg:s.backgroundColor,header:getComputedStyle(h).backgroundColor};});expect(seal.top).toBeLessThanOrEqual(seal.edge+1);expect(seal.bg).toBe(seal.header);expect(seal.bg).not.toBe('rgba(0, 0, 0, 0)');await page.screenshot({path:info.outputPath(platform+'-sealed-header-and-object-summary.png')});
  await (platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Riduci',exact:true})).click();await page.evaluate(()=>neuroMapApp.undo());await (platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Espandi',exact:true})).click();await expect(summary).toBeHidden();
 });
}

for(const platform of ['android','desktop']){
 test(platform+' library cannot drift sideways during scroll, focus or reopening',async({page})=>{
  await boot(page,platform);
  for(const width of platform==='android'?[320,393,480]:[900,1280]){
   await page.setViewportSize({width,height:852});
   await page.evaluate(()=>NeuroMapCreative.libraryHub(neuroMapApp,'svg'));
   const hub=page.locator('#nm-creative-library-hub'),panel=hub.locator('.nm-creative-dialog');
   await expect(panel).toHaveCSS('overflow-x','hidden');
   const dimensions=await panel.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
   await panel.evaluate(e=>{e.scrollLeft=100;});expect(await panel.evaluate(e=>e.scrollLeft)).toBe(0);
   await hub.locator('#nm-object-art-more').scrollIntoViewIfNeeded();await hub.locator('#nm-object-art-more').click();
   await (platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Riduci',exact:true})).click();await (platform==='desktop'?hub.locator('#nm-creative-library-hub-expand'):hub.getByRole('button',{name:'Espandi',exact:true})).click();
   const search=hub.locator('#nm-object-art-search');await search.focus();await search.fill('cuore');expect(await panel.evaluate(e=>e.scrollLeft)).toBe(0);
   const title=await hub.locator('h2').boundingBox(),bounds=await panel.boundingBox();expect(title.x).toBeGreaterThan(bounds.x);
   await hub.locator('#nm-creative-library-hub-close').click();
  }
 });
}
