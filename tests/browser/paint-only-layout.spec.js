const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])for(const style of ['clockwise','balanced','fluid','radial']){
 test(`${platform} ${style}: paint edits retain geometry, history and serialized data`,async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.nm54SyncSettings);
  await page.evaluate(style=>{
   const a=neuroMapApp;a.importHierarchy({text:'Preserve',notes:'Root note',markers:['priority-2'],children:[{text:'Child',notes:'Child note',children:[]}]},{newTab:true});
   a.state.branchStyle=style==='radial'?'radial':'neon';
   if(style!=='radial')document.getElementById('nm-mode-'+style).click();
   a.recalculateAndRender();a.nm54SyncSettings();
   window.paintCheck={layouts:0,renders:0,saves:0};
   const compute=a.layout.computeLayout,render=a.renderer.render,save=a.scheduleSave;
   a.layout.computeLayout=function(...args){paintCheck.layouts++;return compute.apply(this,args)};
   a.renderer.render=function(...args){paintCheck.renders++;return render.apply(this,args)};
   a.scheduleSave=function(...args){paintCheck.saves++;return save.apply(this,args)};
  },style);
  const geometry=()=>page.evaluate(()=>JSON.stringify([...neuroMapApp.layout.nodeLayoutMap]));
  const before=await geometry(),paintLayouts=style==='clockwise'?1:0;
  const original=await page.evaluate(()=>({color:neuroMapApp.state.root.color,undo:neuroMapApp.state.undoStack.length}));
  await page.locator('#inspector-color-picker').evaluate(input=>{input.value='#12ab34';input.dispatchEvent(new Event('change',{bubbles:true}))});
  await expect.poll(()=>page.evaluate(()=>paintCheck.renders)).toBeGreaterThan(0);
  expect(await geometry()).toBe(before);
  expect(await page.evaluate(()=>paintCheck.layouts)).toBe(paintLayouts);
  expect(await page.evaluate(()=>neuroMapApp.state.root.color)).toBe('#12ab34');
  expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(original.undo+1);
  expect(await page.evaluate(()=>({dirty:neuroMapApp.state.isDirty,saves:paintCheck.saves>0}))).toEqual({dirty:true,saves:true});
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.color)).toBe(original.color);
  await page.evaluate(()=>neuroMapApp.redo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.color)).toBe('#12ab34');
  expect(await page.evaluate(()=>paintCheck.layouts)).toBe(paintLayouts+2);
  const beforeStroke=await geometry();
  await page.locator('#nm63-stroke-range').evaluate(input=>{input.value='1.5';input.dispatchEvent(new Event('change',{bubbles:true}))});
  expect(await page.evaluate(()=>neuroMapApp.state.strokeScale)).toBe(1.5);
  expect(await geometry()).toBe(beforeStroke);
  expect(await page.evaluate(()=>paintCheck.layouts)).toBe(paintLayouts*2+2);
  const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.io.buildSerializedProjectPayload())));
  expect(saved.root.color).toBe('#12ab34');expect(saved.strokeScale).toBe(1.5);
  expect(saved.root.notes).toBe('Root note');expect(saved.root.markers).toEqual(['priority-2']);
  expect(saved.root.children[0].notes).toBe('Child note');
  expect(await page.evaluate(async payload=>await neuroMapApp.importFiles([new File([JSON.stringify(payload)],'paint.neuromap')],true),saved)).toBe(1);
  const restored=await page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.io.buildSerializedProjectPayload().root)));
  // A saved map keeps its own identifiers on both computers and phones.
  expect(restored.id).toBe(saved.root.id);
  expect(restored.children[0].id).toBe(saved.root.children[0].id);
  expect(restored.children[0].parentId).toBe(saved.root.id);
  expect(restored).toEqual(saved.root);
  const count=await page.evaluate(()=>paintCheck.layouts);
  await page.evaluate(()=>{const a=neuroMapApp;a.state.updateNodeText(a.state.root.id,'Longer changed label');a.markChanged()});
  expect(await page.evaluate(()=>paintCheck.layouts)).toBe(count+1);
 });
}
