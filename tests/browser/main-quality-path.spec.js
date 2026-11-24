const {test,expect}=require('@playwright/test');
for(const target of ['desktop','android'])test.describe(target+' main quality path',()=>{
 test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));await page.setViewportSize(target==='desktop'?{width:1440,height:960}:{width:393,height:852});
  await page.goto(target==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');await page.waitForFunction(()=>window.neuroMapApp?._nmSaveStatus);
 });
 test('save feedback distinguishes project dirtiness, pending recovery, failure and success',async({page},info)=>{
  await page.evaluate(()=>{const a=neuroMapApp;window.qaWriteMode='pending';window.neuromapDesktop={writeWorkspace:()=>window.qaWriteMode==='pending'?new Promise(r=>window.qaRelease=r):window.qaWriteMode==='fail'?Promise.reject(Error('disk full')):Promise.resolve(true)};a.state.isDirty=true;a.scheduleSave();clearTimeout(a.saveTimer);window.qaWriting=a.persistWorkspace();});
  await expect(page.locator('#nm-save-status')).toHaveAttribute('data-recovery','saving');
  await page.evaluate(async()=>{const a=neuroMapApp;a.state.root.text='Changed during write';a.scheduleSave();clearTimeout(a.saveTimer);qaRelease(true);await qaWriting;});
  await expect(page.locator('#nm-save-status')).toHaveAttribute('data-recovery','pending');
  await page.evaluate(async()=>{qaWriteMode='fail';await neuroMapApp.persistWorkspace()});await expect(page.locator('#nm-save-status')).toHaveAttribute('data-recovery','error');
  await page.evaluate(async()=>{qaWriteMode='ok';await neuroMapApp.persistWorkspace()});await expect(page.locator('#nm-save-status')).toHaveAttribute('data-recovery','ready');expect(await page.evaluate(()=>neuroMapApp.state.isDirty)).toBe(true);
  await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});await expect(page.locator('#nm-save-status')).toHaveAttribute('aria-label',/Unsaved changes/);
  if(target==='desktop')await page.locator('#btn-menu-file').click();
  const status=page.locator(target==='android'?'#glauka-save-indicator':'#nm-save-status');
  await expect(status).toBeVisible();await page.screenshot({path:info.outputPath(target+'-save-indicator.png')});
  await status.click();await expect(page.locator('#nm-decision-text')).toContainText('Recovery copy');
  await page.screenshot({path:info.outputPath(target+'-save-status.png')});await page.locator('#nm-decision-actions button').getByText('Close',{exact:true}).click();
 });
 test('the file-saving indicator waits for native completion',async({page})=>{
  await page.evaluate(target=>{const a=neuroMapApp;a.state.isDirty=true;
   if(target==='desktop'){window.neuromapDesktop={saveProject:()=>new Promise(resolve=>window.qaFinishFile=resolve),writeWorkspace:async()=>true};window.qaFileSave=a.saveActiveTabSafe();}
   else{window.NMAndroid={saveProject:(n,d,id)=>window.qaFinishFile=()=>NeuroMapLifecycle.androidSaved(id,{ok:true})};window.qaFileSave=a.saveProjectFile();}
  },target);
  await expect(page.locator('#nm-save-status')).toHaveAttribute('aria-label',/Salvataggio in corso/);await page.waitForFunction(()=>window.qaFinishFile);
  await page.evaluate(async target=>{if(target==='desktop')qaFinishFile({path:'/tmp/qa.neuromap',name:'qa.neuromap'});else qaFinishFile();await qaFileSave;},target);
  await expect(page.locator('#nm-save-status')).toHaveAttribute('aria-label',/Nessuna modifica da salvare/);expect(await page.evaluate(()=>neuroMapApp.state.isDirty)).toBe(false);
 });
 test('italic, alignment and indentation agree between canvas, measurements and SVG',async({page})=>{
  const out=await page.evaluate(async()=>{const a=neuroMapApp,n=a.state.root.children[0];n.text='First unique line then another unique line';n.fontItalic=true;n.fontWeight=400;n.fontSize=24;n.labelWrapChars=12;n.labelAlign='right';n.labelIndent=20;a.recalculateAndRender();
   const m=a.layout.getLayout(n.id),ctx=a.renderer.ctx,calls=[],fill=ctx.fillText;ctx.fillText=function(text,x,y,...rest){if(m.lines.includes(text))calls.push({font:this.font,align:this.textAlign,x,y});return fill.call(this,text,x,y,...rest)};
   try{a.renderer.drawNode(n)}finally{ctx.fillText=fill}
   let blob;const download=a.io.triggerDownload;a.io.triggerDownload=value=>blob=value;try{await a.io.exportSVG()}finally{a.io.triggerDownload=download}
   return {calls,svg:await blob.text(),lines:m.lines.length};
  });expect(out.lines).toBeGreaterThan(1);expect(out.calls[0].font).toContain('italic');expect(out.calls[0].align).toBe('right');expect(out.calls[1].x-out.calls[0].x).toBeCloseTo(-20);expect(out.svg).toContain('font-style="italic"');expect(out.svg).toContain('text-anchor="end"');
 });
 test('real relayout reuses measurements and keeps identical positions',async({page},info)=>{
  const measured=await page.evaluate(async()=>{await document.fonts.ready;const a=neuroMapApp;a.importHierarchy({text:'Map',children:Array.from({length:1000},(_,i)=>({text:'Concept '+i,children:[]}))},{newTab:true});
   const before={...a.layout._nmMeasureStats},geometry=JSON.stringify([...a.layout.nodeLayoutMap]),start=performance.now();a.recalculateAndRender();a.recalculateAndRender();
   const out={before,after:{...a.layout._nmMeasureStats},same:geometry===JSON.stringify([...a.layout.nodeLayoutMap]),elapsedMs:performance.now()-start};a.state.root.children[0].fontSize=37;a.recalculateAndRender();out.afterEdit={...a.layout._nmMeasureStats};return out;
  });expect(measured.same).toBe(true);expect(measured.after.misses).toBe(measured.before.misses);expect(measured.after.hits-measured.before.hits).toBeGreaterThanOrEqual(2000);expect(measured.afterEdit.misses).toBeGreaterThan(measured.after.misses);
  require('node:fs').writeFileSync(info.outputPath(target+'-measurement-cache.json'),JSON.stringify(measured,null,2));
 });
 if(target==='android')for(const change of ['layout','cards'])test('a successful native save (extra '+change+') does not acknowledge layout or card edits made in the picker',async({page})=>{
  const result=await page.evaluate(async change=>{const a=neuroMapApp;a.state.isDirty=true;let request,sent;const whenSent=new Promise(resolve=>sent=resolve);window.NMAndroid={saveProject:(n,d,id)=>{request=id;sent();}};const pending=a.saveProjectFile();await whenSent;if(change==='layout')a.state.compactness=(a.state.compactness||100)+1;else a.studyCards=[...(a.studyCards||[]),{id:'qa',sourceTabId:a.activeTabId,sourceNodeId:a.state.root.id,question:'Q',answer:'A'}];NeuroMapLifecycle.androidSaved(request,{ok:true});return {ok:await pending,dirty:a.state.isDirty}},change);expect(result).toEqual({ok:true,dirty:true});
 });
 if(target==='desktop')test('fast canvas preserves the visible end of a long thick branch',async({page},info)=>{
  const result=await page.evaluate(async()=>{const a=neuroMapApp;a.importHierarchy({text:'Map',children:[{text:'A very long branch with wide characters WWWWWWWWWWWWWWWWWWWWWWWW',children:[]}]},{newTab:true});const child=a.state.root.children[0];child.fontSize=48;child.labelWrapChars=60;a.state.balanceBias=100;a.state.branchStyle='neon';a.recalculateAndRender();a.renderer.pulse=null;const m=a.layout.getLayout(child.id);a.renderer.camera={x:150-m.attachOutX,y:300-m.attachOutY,zoom:1};
   const toggle=document.getElementById('nm-fast-canvas-toggle');toggle.checked=false;toggle.dispatchEvent(new Event('change'));a.renderer.render();const classic=a.renderer.canvas.toDataURL();toggle.checked=true;toggle.dispatchEvent(new Event('change'));a.renderer.render();return {equal:classic===a.renderer.canvas.toDataURL(),edges:a.renderer.fastCanvasStats.paintedEdges,width:m.width};});
  expect(result.width).toBeGreaterThan(1000);expect(result.edges).toBeGreaterThan(0);expect(result.equal).toBe(true);await page.screenshot({path:info.outputPath('long-branch-fast-canvas.png')});
 });
});
