const {test,expect}=require('@playwright/test');
async function boot(page){await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nm69SwapSibling&&document.getElementById('nm-open-insert'));await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));}
test('WordArt recent action uses its label without the decorative glyph',async({page})=>{
 await boot(page); await page.locator('#nm-open-insert').click();await page.locator('#nm-insert-wordart').click();await page.locator('#nm-wordart-dialog-close').click();
 await expect(page.locator('#nm-insert-shortcuts')).toBeHidden();
 await expect(page.locator('#nm-insert-wordart')).toHaveAttribute('aria-label','WordArt');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nm.insert.recent.v1')))).toContain('nm-insert-wordart');
});
test('drawing section keeps only the Draw action',async({page})=>{
 await boot(page);await page.locator('#nm-open-insert').click();
 await expect(page.locator('#nm-insert-create .nm-insert-drawing > #nm-drawing-open')).toBeVisible();
 await expect(page.locator('#nm-insert-create .nm-insert-drawing > button')).toHaveCount(1);
 await expect(page.locator('#nm-insert-panel #nm-insert-ink-tools')).toHaveCount(0);
});
for(const modifier of ['Control','Meta'])test(modifier+' clockwise arrows cross the left/right cut and preserve the subtree with Undo/Redo',async({page})=>{
 await boot(page);await page.evaluate(()=>{const a=neuroMapApp;const node=(id,k=0)=>({id,text:id,notes:'Keep '+id,children:Array.from({length:k},(_,i)=>({id:id+'_'+i,text:'Leaf '+i,children:[]}))});a.importHierarchy({id:'root_keys',text:'Root',children:[node('branch_A',20),node('branch_B',1),node('branch_C',10),node('branch_D',2),node('branch_E',4),node('branch_F',1)]},{newTab:true,preserveIds:true});a.state.root.layoutMode='clockwise';a.state.root.layoutDistribution=NeuroMapCore.continuationSettings({enabled:false});a.recalculateAndRender();a.selectNode('branch_B');window.__keysOriginal=JSON.parse(JSON.stringify(a.state.root));window.__keysBranch=JSON.stringify(a.state.findNode('branch_B'));});
 await page.locator('#mindmap-canvas').focus();await page.keyboard.press(modifier+'+ArrowUp');
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.map(n=>n.id))).toEqual(['branch_B','branch_A','branch_C','branch_D','branch_E','branch_F']);
 const changed=await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.root)));
 expect(await page.evaluate(()=>neuroMapApp.layout.getLayout('branch_B').x)).toBeGreaterThan(0);
 await page.keyboard.press(modifier+'+z');expect(await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.root)))).toEqual(await page.evaluate(()=>__keysOriginal));
 await page.keyboard.press(modifier+'+Shift+z');expect(await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.root)))).toEqual(changed);
 await page.keyboard.press(modifier+'+ArrowDown');await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.map(n=>n.id))).toEqual(['branch_A','branch_B','branch_C','branch_D','branch_E','branch_F']);
 expect(await page.evaluate(()=>{const a=neuroMapApp,n=a.state.findNode('branch_B');return {id:n.id,text:n.text,notes:n.notes,descendants:n.children.map(c=>c.id)};})).toEqual({id:'branch_B',text:'branch_B',notes:'Keep branch_B',descendants:['branch_B_0']});
});

test('side tools all have sizing and minimize controls, while Search stays unchanged',async({page})=>{
 await boot(page);
 for(const selector of ['#inspector-sidebar','#nm-knowledge-panel','#nm-ai-studio','#nm-learn-panel','#image-controls','#nm-insert-panel']){
  await expect(page.locator(selector+' .nm-panel-resize-handle')).toHaveCount(1);
  await expect(page.locator(selector+' .nm-panel-preview-toggle,'+selector+' #nm-ai-minimize')).toHaveCount(1);
 }
 await expect(page.locator('.nm-panel-resize-handle[data-nm-size-scope="layout"]')).toHaveCount(1);
 await expect(page.locator('.hud-bottom-left .nm-panel-preview-toggle')).toHaveCount(1);
 await expect(page.locator('#find-panel .nm-panel-resize-handle,#find-panel .nm-panel-preview-toggle')).toHaveCount(0);
 await page.locator('#btn-toggle-inspector').click();const panel=page.locator('#inspector-sidebar');await expect(panel).toBeVisible();
 const before=await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())));
 const grip=panel.locator('.nm-panel-resize-handle'),width=(await panel.boundingBox()).width;
 await grip.focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await panel.boundingBox()).width).toBeCloseTo(width+20,0);
 const toggle=panel.locator('.nm-panel-preview-toggle');await toggle.click();await expect(panel).toHaveClass(/nm-panel-compact/);await expect(toggle).toBeVisible();
 expect(await toggle.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('#inspector-sidebar').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;})).toBe(true);
 await toggle.click();await expect(panel).not.toHaveClass(/nm-panel-compact/);expect(await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())))).toEqual(before);
});
for(const kind of ['wordart','chart'])test(kind+' dialog resizes, minimizes and restores without changing the map',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())));await page.locator('#nm-open-insert').click();await page.locator('#nm-insert-'+kind).click();
 const shade=page.locator('#nm-'+kind+'-dialog'),panel=shade.locator('.nm-creative-dialog'),grip=panel.locator(':scope>.nm-panel-resize-handle');await expect(grip).toHaveCount(1);await expect(grip).toBeVisible();
 const width=(await panel.boundingBox()).width;await grip.focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await panel.boundingBox()).width).toBeCloseTo(width+20,0);
 const toggle=panel.locator('.nm-panel-preview-toggle');await toggle.click();await expect(panel).toHaveClass(/nm-panel-compact/);await expect(toggle).toBeVisible();await toggle.click();await expect(panel).not.toHaveClass(/nm-panel-compact/);await expect.poll(async()=>(await panel.boundingBox()).width).toBeCloseTo(width+20,0);
 await page.locator('#nm-'+kind+'-dialog-close').click();expect(await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())))).toEqual(before);
});
test('Symbols distinguish node markers and characters inside the label',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>neuroMapApp.state.root.text);await page.locator('#nm-open-insert').click();await page.locator('#nm-insert-gallery').click();
 const hub=page.locator('#nm-creative-library-hub');await expect(hub.locator('.nm-creative-symbols-heading')).toHaveText(['Marcatori','Testo']);
 await hub.locator('[data-placement=badge]').click();
 await hub.locator('[data-marker]').first().click();expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe(before);expect(await page.evaluate(()=>neuroMapApp.state.root.markers.length)).toBe(1);
 await hub.getByRole('button',{name:'α',exact:true}).click();expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe(before+'α');expect(await page.evaluate(()=>neuroMapApp.state.root.markers.length)).toBe(1);
 await page.evaluate(()=>GlaukaI18n.setLanguage('en'));await expect(hub.locator('.nm-creative-symbols-heading')).toHaveText(['Markers','Text']);
 await page.locator('#nm-creative-library-hub-close').click();await page.locator('#mindmap-canvas').focus();await page.keyboard.press('Control+z');expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe(before);expect(await page.evaluate(()=>neuroMapApp.state.root.markers.length)).toBe(1);
});
test('image tool sizing and minimize keep the image and map unchanged',async({page})=>{
 await boot(page);await page.evaluate(()=>{const a=neuroMapApp;const image=a.state.addImageItem({src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',width:160,height:100,mode:'free',worldPos:{x:90,y:40}});a.state.selectedImageId=image.id;a.updateImageControls();a.requestRender();});
 const panel=page.locator('#image-controls');await expect(panel).toBeVisible();const before=await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())));
 const width=(await panel.boundingBox()).width;await panel.locator('.nm-panel-resize-handle').focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await panel.boundingBox()).width).toBeCloseTo(width+20,0);
 const toggle=panel.locator('.nm-panel-preview-toggle');await toggle.click();await expect(toggle).toBeVisible();await expect(panel).toHaveClass(/nm-panel-compact/);await toggle.click();await expect(panel).not.toHaveClass(/nm-panel-compact/);
 expect(await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())))).toEqual(before);
});
test('transient dialog size controls keep correct labels in all eight languages',async({page})=>{
 await boot(page);await page.locator('#nm-open-insert').click();await page.locator('#nm-insert-wordart').click();const dialog=page.locator('#nm-wordart-dialog');
 for(const code of ['it','en','de','es','fr','pt','ar','zh-CN']){
  await page.evaluate(code=>GlaukaI18n.setLanguage(code),code);
  const labels=await page.evaluate(()=>({minimize:GlaukaI18n.pair('Riduci','Minimize'),resize:GlaukaI18n.pair('Ridimensiona pannello laterale','Resize side panel')}));
  await expect(dialog.locator('.nm-panel-preview-toggle')).toHaveAttribute('aria-label',labels.minimize);await expect(dialog.locator('.nm-panel-preview-toggle')).toHaveAttribute('title',labels.minimize);
  await expect(dialog.locator('.nm-panel-resize-handle')).toHaveAttribute('aria-label',labels.resize);
 }
});
