const {test,expect}=require('@playwright/test');
for(const target of ['desktop','android'])test.describe(`${target} platform colors and safe exit`,()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto(target==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.io&&window.NeuroMapLifecycle);
  await page.evaluate(()=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=window.neuroMapApp;a.importHierarchy({text:'Exit QA',children:[{text:'Original',children:[]}]},{newTab:true});a.tabs.forEach(t=>t.state.isDirty=false);});
 });
 test('all five swatches, canvas and PNG exports keep exact sRGB colors in either system appearance',async({page})=>{
  const expected={night:'#090e1b',slate:'#172438',ocean:'#0a2536',paper:'#f4f2ea',pearl:'#e9edf4'};
  for(const mode of ['light','dark']){
   await page.emulateMedia({colorScheme:mode});
   const values=await page.evaluate(async target=>{
    const result={};const set=target==='desktop'?v=>NM615.setTheme(v):v=>NeuroMapAndroidEditor.setTheme(v);
    for(const key of ['night','slate','ocean','paper','pearl']){
     set(key);let blob;const a=window.neuroMapApp,download=a.io.triggerDownload;a.io.triggerDownload=b=>{blob=b;};
     try{await a.io.exportPNG();}finally{a.io.triggerDownload=download;}
     const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
     const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const rgba=[...ctx.getImageData(0,0,1,1).data];bitmap.close();
     a.showToast('Salvataggio completato','SALVATO');
     result[key]={canvas:NeuroMapGraphics.background(),swatch:NeuroMapThemePicker.themes[key].color,rgba,toastColor:getComputedStyle(document.getElementById('toast-text')).color,toastBackground:getComputedStyle(document.getElementById('toast-notification')).backgroundColor};
    }return result;
   },target);
   for(const [key,color] of Object.entries(expected)){
    expect(values[key].canvas).toBe(color);expect(values[key].swatch).toBe(color);
    const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const a=lum(rgb(values[key].toastColor)),b=lum(rgb(values[key].toastBackground));
    expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
    expect(values[key].rgba).toEqual([...color.slice(1).match(/../g).map(n=>parseInt(n,16)),255]);
   }
  }
 });
 if(target==='desktop')test('closing during startup waits for recovered maps before asking or writing',async({page})=>{
  const backup=await page.evaluate(()=>{const a=neuroMapApp;a.persistWorkspace();const d=JSON.parse(localStorage.getItem('neuromap.workspace.v2'));d.tabs.forEach(t=>t.isDirty=true);d.tabs.find(t=>t.id===d.activeTabId).root.text='Recovered map';return JSON.stringify(d);});
  await page.addInitScript(()=>{localStorage.removeItem('neuromap.workspace.v2');window.qaWrites=[];window.neuromapDesktop={readWorkspace:()=>new Promise(r=>window.qaReadRelease=r),writeWorkspace:async json=>{window.qaWrites.push(JSON.parse(json));},onExternalFile:()=>{}};});
  await page.reload();await page.waitForFunction(()=>window.neuroMapApp&&window.qaReadRelease);
  const waiting=await page.evaluate(async()=>{window.qaClose=NeuroMapLifecycle.requestClose();neuroMapApp.persistWorkspace();await new Promise(r=>setTimeout(r,30));return {writes:window.qaWrites.length,dialog:!document.getElementById('nm-decision-overlay').classList.contains('hidden')};});
  expect(waiting).toEqual({writes:0,dialog:false});
  await page.evaluate(backup=>window.qaReadRelease(backup),backup);
  await expect(page.locator('#nm-decision-title')).toHaveText('Salvare le modifiche prima di uscire?');
  expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Recovered map');
  await page.locator('#nm-decision-actions button').filter({hasText:'Annulla'}).click();
  expect(await page.evaluate(()=>window.qaClose)).toBe(false);
  expect(await page.evaluate(()=>window.qaWrites.every(d=>d.tabs.find(t=>t.id===d.activeTabId).root.text==='Recovered map'))).toBe(true);
 });
 test('normal browser close warns for any dirty tab, even if the active tab is clean',async({page})=>{
  await page.evaluate(()=>{const a=window.neuroMapApp;a.tabs[0].state.isDirty=true;});
  // Real activation is required by Chromium before it may display beforeunload.
  await page.locator('#mindmap-canvas').click({position:{x:700,y:500}});
  const dialog=page.waitForEvent('dialog');const reload=page.reload();
  const d=await dialog;expect(d.type()).toBe('beforeunload');await d.accept();await reload;
  await page.waitForFunction(()=>window.neuroMapApp?.io);
  expect(await page.evaluate(()=>NeuroMapLifecycle.dirty())).toBe(true);
 });
 test('native exit can be cancelled, and Dont Save does not restore discarded edits',async({page})=>{
  await page.evaluate(()=>{const a=window.neuroMapApp;a.state.updateNodeText(a.state.root.children[0].id,'Changed');a.markChanged();window.qaClose=NeuroMapLifecycle.requestClose();});
  await page.locator('#nm-decision-actions button').filter({hasText:'Annulla'}).click();
  expect(await page.evaluate(()=>window.qaClose)).toBe(false);
  await page.evaluate(()=>{window.qaClose=NeuroMapLifecycle.requestClose();});
  await page.locator('#nm-decision-actions button').filter({hasText:'Non salvare'}).click();
  expect(await page.evaluate(()=>window.qaClose)).toBe(true);
  await page.reload();await page.waitForFunction(()=>window.neuroMapApp?.io);
  expect(await page.evaluate(()=>NeuroMapLifecycle.dirty())).toBe(false);
  expect(await page.evaluate(()=>neuroMapApp.state.root.children.some(n=>n.text==='Changed'))).toBe(false);
 });
 test('the exit warning follows the selected app language',async({page})=>{
  await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');neuroMapApp.state.isDirty=true;window.qaClose=NeuroMapLifecycle.requestClose();});
  await expect(page.locator('#nm-decision-title')).toHaveText('Save changes before quitting?');
  await page.locator('#nm-decision-actions button').filter({hasText:'Cancel'}).click();
  expect(await page.evaluate(()=>window.qaClose)).toBe(false);
 });
 test('native exit waits until the pending recovery write finishes',async({page})=>{
  const result=await page.evaluate(async()=>{
   const a=window.neuroMapApp;a.tabs.forEach(t=>t.state.isDirty=false);let release,done=false;
   window.neuromapDesktop={writeWorkspace:()=>new Promise(r=>release=r)};
   const close=NeuroMapLifecycle.requestClose().then(r=>{done=true;return r;});
   await new Promise(r=>setTimeout(r,30));const waited=!done;release({});return {waited,closed:await close};
  });expect(result).toEqual({waited:true,closed:true});
 });
 test('edits made during the final recovery write prevent an unnoticed exit',async({page})=>{
  const result=await page.evaluate(async()=>{
   let release,started;const writing=new Promise(resolve=>started=resolve);
   window.neuromapDesktop={writeWorkspace:()=>new Promise(resolve=>{release=resolve;started()})};
   const flushing=NeuroMapLifecycle.flush();await writing;
   neuroMapApp.state.updateNodeText(neuroMapApp.state.root.id,'Edited during write');
   neuroMapApp.markChanged();release({});return flushing;
  });expect(result).toBe(false);
 });
 test('failed recovery blocks native exit until the user explicitly chooses otherwise',async({page})=>{
  await page.evaluate(()=>{window.neuromapDesktop={writeWorkspace:async()=>{throw Error('disk full')}};window.qaClose=NeuroMapLifecycle.requestClose();});
  await expect(page.locator('#nm-decision-title')).toHaveText('Copia di recupero non riuscita');
  await page.locator('#nm-decision-actions button').filter({hasText:'Annulla'}).click();
  expect(await page.evaluate(()=>window.qaClose)).toBe(false);
 });
 test('unfinished text editing is recovered after the automatic checkpoint without closing the editor',async({page})=>{
  await page.evaluate(()=>{const a=window.neuroMapApp;a.selectNode(a.state.root.children[0].id);a.editSelected();});
  await page.locator('#inline-editor-input').fill('Text still being typed');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('neuromap.workspace.v2')||'{}').editorDraft?.text)).toBe('Text still being typed');
  expect(await page.evaluate(()=>!!neuroMapApp.editorNodeId)).toBe(true);
  // Restore the checkpoint directly: reloading would commit the editor on beforeunload.
  const result=await page.evaluate(()=>{const a=neuroMapApp,json=localStorage.getItem('neuromap.workspace.v2');a.closeEditor(false);a.loadAutosave(json);return {text:a.state.root.children[0].text,dirty:a.state.isDirty};});
  expect(result).toEqual({text:'Text still being typed',dirty:true});
 });
 test('exporting a backup does not mark the original project as saved',async({page})=>{
  const dirty=await page.evaluate(()=>{const a=neuroMapApp;a.state.isDirty=true;a.io.triggerDownload=()=>{};a.io.exportJSON();return a.state.isDirty;});expect(dirty).toBe(true);
 });
 test('backgrounding immediately commits and checkpoints an active text edit',async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp;a.selectNode(a.state.root.children[0].id);a.editSelected();document.getElementById('inline-editor-input').value='Before background';Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('neuromap.workspace.v2')));
  expect(data.tabs.find(t=>t.id===data.activeTabId).root.children[0].text).toBe('Before background');
 });
 if(target==='android'){
  for(const ok of [false,true])test(`Android project save awaits the native result: ${ok?'success':'cancel or write failure'}`,async({page})=>{
   const result=await page.evaluate(async ok=>{
    const a=neuroMapApp;a.state.isDirty=true;
    let id,sent;const whenSent=new Promise(resolve=>sent=resolve);window.NMAndroid={saveProject:(name,data,requestId)=>{id=requestId;sent();}};
    let done=false;const saving=a.saveProjectFile().then(result=>{done=true;return result;});
    await whenSent;const before={dirty:a.state.isDirty,waiting:!done};
    NeuroMapLifecycle.androidSaved(id,{ok});return {before,saved:await saving,dirty:a.state.isDirty};
   },ok);expect(result).toEqual({before:{dirty:true,waiting:true},saved:ok,dirty:!ok});
  });
  test('Android save does not clear edits made while the file picker was open',async({page})=>{
   const result=await page.evaluate(async()=>{
    const a=neuroMapApp;a.state.isDirty=true;let id,sent;const whenSent=new Promise(resolve=>sent=resolve);window.NMAndroid={saveProject:(n,d,r)=>{id=r;sent();}};
    const saving=a.saveProjectFile();await whenSent;a.state.updateNodeText(a.state.root.id,'New edit after save started');
    NeuroMapLifecycle.androidSaved(id,{ok:true});return {saved:await saving,dirty:a.state.isDirty};
   });expect(result).toEqual({saved:true,dirty:true});
  });
 }
});
