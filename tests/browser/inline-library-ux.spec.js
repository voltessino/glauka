const {test,expect}=require('@playwright/test');
async function boot(page,platform){
 await page.setViewportSize({width:platform==='android'?393:1280,height:852});
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreative?.libraryHub);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));});
}
for(const platform of ['android','desktop']){
 test(platform+' edits the selected label in place, cancels and commits with Undo',async({page},info)=>{
  await boot(page,platform);
  const original=await page.evaluate(()=>{const a=neuroMapApp,n=a.state.root.children[0];a.selectNode(n.id);a.editSelected();return {id:n.id,text:n.text};});
  const input=page.locator('#inline-editor-input');await expect(input).toBeVisible();
  const result=await input.evaluate(e=>{const a=neuroMapApp,m=a.layout.getLayout(a.editorNodeId),p=a.renderer.worldToScreen(m.x,m.y),r=e.getBoundingClientRect();return {dy:Math.abs(r.y+r.height/2-p.y),background:getComputedStyle(e).backgroundColor,editing:a.renderer.inlineEditingNodeId};});
  expect(result.dy).toBeLessThan(5);expect(result.background).toBe('rgba(0, 0, 0, 0)');expect(result.editing).toBe(original.id);
  await page.screenshot({path:info.outputPath(platform+'-inline-edit.png')});
  await input.fill('Testo nuovo');await input.press('Escape');
  expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,original.id)).toBe(original.text);
  await page.evaluate(()=>neuroMapApp.editSelected());await input.fill('Testo nuovo');await input.press('Enter');
  expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,original.id)).toBe('Testo nuovo');
  await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,original.id)).toBe(original.text);
  const dy=await page.evaluate(()=>{const a=neuroMapApp,n=a.state.findNode(a.state.selectedNodeId);n.objectArt={id:'amphora',size:100};a.markChanged();a.editSelected();const m=a.layout.getLayout(n.id),g=NeuroMapCreativeCore.objectGeometry(n,m),p=a.renderer.worldToScreen(m.x,g.labelY+g.labelHeight/2),r=document.getElementById('inline-editor-input').getBoundingClientRect();return Math.abs(r.y+r.height/2-p.y);});
  expect(dy).toBeLessThan(5);await input.press('Escape');
 });
 test(platform+' applies SVG on one tap, keeps the gallery on minimize and reaches the complete current object catalogue',async({page})=>{
  await boot(page,platform);
  await page.evaluate(()=>{const a=neuroMapApp;a.selectNode(a.state.root.children[0].id);NeuroMapCreative.libraryHub(a,'svg');});
  const hub=page.locator('#nm-creative-library-hub'),cards=hub.locator('.nm-object-art-card');
  const catalog=await page.evaluate(()=>NeuroMapCreativeCore.OBJECTS.map(item=>item.id));
  expect(catalog.length).toBeGreaterThanOrEqual(221);
  await hub.locator('[data-asset="amphora"]').click();
  expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).objectArt.id)).toBe('amphora');
  const history=await page.evaluate(()=>neuroMapApp.state.undoStack.length);
  await hub.locator('[data-asset="amphora"]').click();expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(history);

  if(platform==='desktop'){
    await expect(hub).toHaveClass(/nm-creative-sidecar/);
    await expect(hub.locator('[role=dialog]')).toHaveAttribute('aria-modal','false');
    await hub.locator('#nm-creative-library-hub-expand').click();
    await expect(hub).toHaveClass(/nm-creative-expanded/);
    await hub.locator('#nm-creative-library-hub-expand').click();
    await expect(hub).not.toHaveClass(/nm-creative-expanded/);
    await expect(hub.locator('[data-asset="amphora"]')).toHaveAttribute('aria-pressed','true');
  }else{
    await hub.locator('.nm-panel-preview-toggle').click();
    await expect(hub).toHaveClass(/nm-panel-minimized/);
    await expect(hub.locator('[role=dialog]')).toHaveAttribute('aria-modal','false');
    await hub.getByRole('button',{name:'Espandi',exact:true}).click();
  }
  for(let i=0;i<Math.ceil(catalog.length/24)&&await hub.locator('#nm-object-art-more').isVisible();i++){
   await hub.locator('#nm-object-art-more').scrollIntoViewIfNeeded();await hub.locator('#nm-object-art-more').click();
  }
  expect((await cards.evaluateAll(els=>els.map(el=>el.dataset.asset))).sort()).toEqual([...catalog].sort());
  await expect(cards).toHaveCount(catalog.length);const last=cards.last();await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();const id=await last.getAttribute('data-asset');await last.click();
  expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).objectArt.id)).toBe(id);
  const scroll=await hub.locator('.nm-creative-dialog').evaluate(e=>e.scrollTop);

  if(platform==='desktop'){
    await hub.locator('#nm-creative-library-hub-expand').click();
    await hub.locator('#nm-creative-library-hub-expand').click();
    await expect(cards).toHaveCount(catalog.length);
    await expect.poll(()=>hub.locator('.nm-creative-dialog').evaluate(e=>e.scrollTop)).toBeGreaterThan(scroll-2);
    await hub.locator('#nm-creative-library-hub-expand').click();
    await hub.locator('.nm-creative-dialog').evaluate(async e=>{await new Promise(requestAnimationFrame);e.scrollTop=200;});
    await hub.locator('#nm-creative-library-hub-expand').click();
    await expect.poll(()=>hub.locator('.nm-creative-dialog').evaluate(e=>e.scrollTop)).toBeCloseTo(200,0);
  }else{
    await hub.getByRole('button',{name:'Riduci',exact:true}).click();
    await hub.getByRole('button',{name:'Espandi',exact:true}).click();
    await expect(cards).toHaveCount(catalog.length);
  }
  await hub.locator('#nm-creative-library-hub-close').click();await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).objectArt)).toBeNull();
 });
}
test('Android add actions have distinct descriptive icons and a sheet that closes and reopens',async({page})=>{
 await boot(page,'android');await page.locator('#glauka-add-open').click();
 const names=['Immagine da file','Disegni e simboli','Lettere e simboli','Formula matematica','Disegna a mano libera','Disegni salvati','Crea una mappa dal testo'];const paths=[];
 for(const name of names)paths.push(await page.getByRole('button',{name,exact:true}).locator('svg path').getAttribute('d'));
 expect(new Set(paths).size).toBe(names.length);
 const sheet=page.locator('#glauka-app-sheet');await page.locator('#glauka-sheet-close').click();await expect(sheet).toBeHidden();await page.locator('#glauka-add-open').click();await expect(sheet.getByRole('button',{name:'Disegni e simboli',exact:true})).toBeVisible();
});
