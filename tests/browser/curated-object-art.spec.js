const {test,expect}=require('@playwright/test');
async function boot(page){
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.setViewportSize({width:1366,height:900});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreative?.objectDialog);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
}
test('gallery ships curated offline vectors with clear target and live preview',async({page})=>{
 await boot(page);
 await page.evaluate(()=>NeuroMapCreative.objectDialog(neuroMapApp));
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(24);
 await expect(page.locator('#nm-object-art-count')).toContainText('24 / 636');
 await expect(page.locator('#nm-object-art-preview')).toBeHidden();
 await expect(page.locator('#nm-object-art-target')).toHaveValue('root');
 await page.locator('[data-asset="amphora"]').click();
 await expect(page.locator('[data-asset="amphora"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#nm-object-art-size').evaluate(el=>{
   el.value='196';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('#nm-object-art-apply').click();
 const item=await page.evaluate(()=>({
   root:neuroMapApp.state.root.objectArt,
   size:neuroMapApp.layout.getLayout(neuroMapApp.state.root.id).objectArtSize,
   undo:neuroMapApp.state.undoStack.length
 }));
 expect(item.root).toMatchObject({id:'amphora',size:196});
 expect(item.size).toBe(196);
 expect(item.undo).toBeGreaterThan(0);
 await page.evaluate(()=>{neuroMapApp.undo();});
 expect(await page.evaluate(()=>neuroMapApp.state.root.objectArt)).toBeNull();
 await page.evaluate(()=>{neuroMapApp.redo();});
 expect(await page.evaluate(()=>neuroMapApp.state.root.objectArt.id)).toBe('amphora');
});
test('apply to branch without replacing text and restore original node shape',async({page})=>{
 await boot(page);
 const id=await page.evaluate(()=>{
  const a=neuroMapApp;const child=a.state.root.children[0]||a.state.addChildNode(a.state.root.id,a.layout,'Anatomia');
  a.selectNode(child.id);return child.id;
 });
 await page.evaluate(()=>NeuroMapCreative.objectDialog(neuroMapApp));
 await expect(page.locator('#nm-object-art-target')).toHaveValue('node');
 await page.locator('[data-asset="frame"]').click();
 await page.locator('#nm-object-art-size').evaluate(el=>{
  el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('#nm-object-art-apply').click();
 const before=await page.evaluate(id=>{
  const a=neuroMapApp,n=a.state.findNode(id);
  return {art:n.objectArt,text:n.text,size:a.layout.getLayout(id).objectArtSize};
 },id);
 expect(before.art).toMatchObject({id:'frame',size:100});
 expect(before.size).toBe(100);
 await page.evaluate(()=>NeuroMapCreative.objectDialog(neuroMapApp));
 await page.locator('#nm-object-art-remove').click();
 const after=await page.evaluate(id=>{
  const a=neuroMapApp,n=a.state.findNode(id);
  return {art:n.objectArt,text:n.text,size:a.layout.getLayout(id).objectArtSize};
 },id);
 expect(after.art).toBeNull();
 expect(after.text).toBe(before.text);
 expect(after.size).toBe(0);
});
test('open library follows branch selection without reopening the tab',async({page})=>{
 await boot(page);
 const ids=await page.evaluate(()=>{
  const a=neuroMapApp,root=a.state.root;
  const first=root.children[0]||a.state.addChildNode(root.id,a.layout,'Primo ramo');
  const second=root.children[1]||a.state.addChildNode(root.id,a.layout,'Secondo ramo');
  a.selectNode(first.id);return [first.id,second.id,first.text,second.text];
 });
 await page.evaluate(()=>NeuroMapCreative.libraryHub(neuroMapApp,'svg'));
 await expect(page.locator('#nm-object-art-target')).toHaveValue('node');
 await expect(page.locator('#nm-object-art-target option:checked')).toContainText(ids[2]);
 await page.evaluate(id=>neuroMapApp.selectNode(id),ids[1]);
 await expect(page.locator('#nm-object-art-target option:checked')).toContainText(ids[3]);
});
test('actual SVG export contains embedded vector and text without original root pill',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
  const a=neuroMapApp;a.state.pushHistory();
  a.state.root.objectArt={id:'scroll',size:180};a.markChanged();
 });
 const exported=await page.evaluate(async()=>{
  const a=neuroMapApp;
  let output;
  const orig=a.io.triggerDownload;
  a.io.triggerDownload=b=>{output=b;return true};
  try{await a.renderer.prepareExportImages();await a.io.exportSVG()}
  finally{a.io.triggerDownload=orig}
  return {svg:await output?.text(),name:a.state.root.text};
 });
 expect(exported.svg).toContain('data:image/svg+xml');
 expect(exported.svg).toContain(exported.name);
 expect(exported.svg).not.toContain('onload=');
});

test('anatomy group filters and applies five schematic CC0 vector organs',async({page})=>{
 await boot(page);
 await page.evaluate(()=>NeuroMapCreative.objectDialog(neuroMapApp));
 await page.locator('#nm-object-art-filters button[data-category="anatomy"]').click();
 await expect(page.locator('#nm-object-art-filters button[data-category="anatomy"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(24);
 await expect(page.locator('#nm-object-art-count')).toContainText('24 / 42');
 await page.locator('[data-asset="heart"]').click();
 await expect(page.locator('#nm-object-art-preview .nm-object-art-source')).toContainText('CC0');
 await page.locator('#nm-object-art-apply').click();
 expect(await page.evaluate(()=>neuroMapApp.state.root.objectArt.id)).toBe('heart');
 await page.evaluate(()=>NeuroMapCreative.objectDialog(neuroMapApp));
 await page.locator('#nm-object-art-filters button[data-category="all"]').click();
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(24);
 await expect(page.locator('#nm-object-art-count')).toContainText('24 / 636');
});

test('gallery search, diacritics and progressive loading remain responsive',async({page})=>{
 await boot(page);
 await page.evaluate(()=>NeuroMapCreative.objectDialog(neuroMapApp));
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(24);
 await page.locator('#nm-object-art-more').click();
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(48);
 await page.locator('#nm-object-art-search').fill('microscopio');
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(3);
 await expect(page.locator('[data-asset="microscope"]')).toBeVisible();
 await expect(page.locator('#nm-object-art-count')).toContainText('3 / 3');
 await page.locator('#nm-object-art-search').fill('intelligenza');
 await expect(page.locator('[data-asset="artificial-intelligence"]')).toBeVisible();
 await page.locator('#nm-object-art-search').fill('oggetto senza corrispondenze 987');
 await expect(page.locator('#nm-object-art-grid .nm-object-art-empty')).toBeVisible();
 await expect(page.locator('#nm-object-art-more')).toBeHidden();
 await page.locator('#nm-object-art-search').fill('');
 await expect(page.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(24);
});
