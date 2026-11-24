const {test,expect}=require('@playwright/test');

async function boot(page,width=1280){
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreative?.libraryHub&&document.getElementById('nm616-map'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}

test('desktop editing never changes the map camera unless the preference is enabled',async({page})=>{
 await boot(page);
 await page.evaluate(()=>localStorage.removeItem('glauka.edit.autofocus.v1'));
 const original=await page.evaluate(()=>{
  const app=neuroMapApp;
  app.selectNode(app.state.root.children[0].id);
  app.renderer.camera.zoom=.25;
  app.renderer.camera.x=80;app.renderer.camera.y=90;
  const snapshot={...app.renderer.camera};
  app.editSelected();
  return snapshot;
 });
 expect(await page.evaluate(()=>({...neuroMapApp.renderer.camera}))).toEqual(original);
 await expect(page.locator('#inline-editor-input')).toBeVisible();
 await page.locator('#inline-editor-input').press('Escape');
 await page.evaluate(()=>{
  const box=document.getElementById('gl-edit-auto-zoom');
  box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));
 });
 expect(await page.evaluate(()=>localStorage.getItem('glauka.edit.autofocus.v1'))).toBe('1');
 await page.evaluate(()=>{
  const app=neuroMapApp;app.renderer.camera.zoom=.25;
  app.editSelected();
 });
 expect(await page.evaluate(()=>neuroMapApp.renderer.camera.zoom)).toBeGreaterThan(.25);
 await page.locator('#inline-editor-input').press('Escape');
});

test('compact shapes are real serializable Glauka SVGs and Creative Library is docked',async({page})=>{
 await boot(page);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.locator('#nm-open-insert').click();
 const shapes=page.locator('#nm-insert-shapes .nm-insert-shape-tile');
 await expect(shapes).toHaveCount(18);
 const ids=await shapes.evaluateAll(els=>els.map(x=>x.id));
 expect(new Set(ids).size).toBe(18);
 const before=await page.evaluate(()=>neuroMapApp.state.images.length);
 await page.locator('#nm-shapes-picker summary').click();
 await page.locator('#nm-insert-shape-diamond').click();
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images.length)).toBe(before+1);
 expect(await page.evaluate(()=>neuroMapApp.state.images.at(-1).graphic?.tool)).toBe('diamond');

 const dragged=await page.evaluate(()=>{
   const app=neuroMapApp,initial=app.state.images.length;
   const transfer=new DataTransfer();
   document.getElementById('nm-insert-shape-hexagon').dispatchEvent(
     new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
   const location={x:620,y:390};
   app.canvas.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,
     dataTransfer:transfer,clientX:location.x,clientY:location.y}));
   const placed=app.state.images.at(-1),world=app.renderer.screenToWorld(location.x,location.y);
   return {created:app.state.images.length===initial+1,tool:placed.graphic?.tool,
     delta:Math.hypot(placed.worldPos.x-world.x,placed.worldPos.y-world.y)};
 });
 expect(dragged).toMatchObject({created:true,tool:'hexagon'});
 expect(dragged.delta).toBeLessThan(.1);
 await expect(page.locator('#nm-insert-panel')).toBeHidden();
 await page.locator('#nm-open-insert').click();
 await expect(page.locator('#image-controls')).toBeHidden();
 await page.locator('#nm-insert-gallery').click();
 await expect(page.locator('#nm-insert-panel')).toBeHidden();
 const hub=page.locator('#nm-creative-library-hub');
 await expect(hub).toHaveClass(/nm-creative-sidecar/);
 await expect(hub.locator('[role=dialog]')).toHaveAttribute('aria-modal','false');
 await hub.locator('#nm-creative-tab-shapes').click();
 await expect(hub.locator('.nm-creative-shape-tile')).toHaveCount(18);
 await hub.locator('#nm-creative-library-hub-expand').click();
 await expect(hub).toHaveClass(/nm-creative-expanded/);
 await hub.locator('#nm-creative-library-hub-expand').click();
 await expect(hub).not.toHaveClass(/nm-creative-expanded/);
 await hub.locator('#nm-creative-library-hub-close').click();
 await expect(hub).toHaveCount(0);
 await expect(page.locator('#nm-insert-panel')).toBeVisible();
 expect(errors).toEqual([]);
});

test('radar mirrors map positions and offers overview/detail/expanded navigation without document changes',async({page})=>{
 await boot(page);
 const original=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 const map=page.locator('#nm616-map');
 await expect(map).toBeVisible();
 const compact=await map.evaluate(el=>el._nmProjection);
 expect(compact.nodes.length).toBeGreaterThan(0);
 expect(compact.nodes[0]).toHaveProperty('w');
 expect(compact.edges[0]).toHaveProperty('depth');
 await page.locator('#nm616-map-expand').click();
 await expect(page.locator('#nm616-minimap-shell')).toHaveClass(/nm616-map-expanded/);
 await expect.poll(()=>map.evaluate(el=>el._nmProjection.width)).toBe(310);
 await page.locator('#nm616-map-mode').click();
 await expect(page.locator('#nm616-map-mode')).toHaveAttribute('aria-pressed','true');
 const rect=await map.boundingBox();
 await page.mouse.click(rect.x+rect.width*.65,rect.y+rect.height*.45);
 const now=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 expect(now).toBe(original);
 await page.locator('#nm616-map-expand').click();
 await expect.poll(()=>map.evaluate(el=>el._nmProjection.width)).toBe(190);
});
