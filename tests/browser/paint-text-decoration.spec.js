const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])for(const mode of ['classic','clockwise'])test(`${platform} ${mode}: text paint edits update pixels without moving nodes or altering history semantics`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nmSettingsApplyNode);
 const result=await page.evaluate(async mode=>{
  await document.fonts.ready;
  const a=neuroMapApp;a.importHierarchy({text:'Text paint',children:[{text:'Untouched child',children:[]}]},{newTab:true});
  if(mode==='clockwise')document.getElementById('nm-mode-clockwise').click();
  a.fitToScreen();
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await frame();
  const geometry=JSON.stringify([...a.layout.nodeLayoutMap]),camera=JSON.stringify(a.renderer.camera),selected=a.state.selectedNodeId;
  const compute=a.layout.computeLayout;let layouts=0;a.layout.computeLayout=function(...args){layouts++;return compute.apply(this,args)};
  const history=a.state.undoStack.length,states=[],pixels=[],projected=!!a.layout.presentationRoot;
  if(mode==='clockwise'&&!projected)throw Error('Continuation projection was not exercised');
  let previous=a.renderer.canvas.toDataURL();
  for(const [field,value]of [['fontColor','#12ab34'],['fontStrike',true],['fontUnderline',true]]){
   if(field==='fontColor'){
    const input=document.getElementById('glauka-font-color');input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));
   }else if(field==='fontStrike')document.getElementById('glauka-font-strike').click();
   else a.nmSettingsApplyNode(field,value); // Existing field/API; no new control.
   await frame();const next=a.renderer.canvas.toDataURL();pixels.push(next!==previous);previous=next;
   states.push({field,value:a.state.root[field],geometry:JSON.stringify([...a.layout.nodeLayoutMap])===geometry,views:!projected||[...a.layout.viewNodes.values()].filter(n=>n.logicalId===a.state.root.id).every(n=>n[field]===a.state.root[field])});
  }
  const beforeUndo=layouts,afterHistory=a.state.undoStack.length-history,saved=JSON.parse(JSON.stringify(a.io.buildSerializedProjectPayload()));
  a.undo();const undone=a.state.root.fontUnderline;a.redo();const redone=a.state.root.fontUnderline;
  const unchanged={camera:JSON.stringify(a.renderer.camera)===camera,selection:a.state.selectedNodeId===selected,child:saved.root.children[0].text==='Untouched child'};
  const beforeMetric=layouts;a.nmSettingsApplyNode('fontSize',32);
  return{states,pixels,beforeUndo,afterHistory,undone,redone,unchanged,saved:{fontColor:saved.root.fontColor,fontStrike:saved.root.fontStrike,fontUnderline:saved.root.fontUnderline},metricLayouts:layouts-beforeMetric};
 },mode);
 expect(result.states).toEqual([{field:'fontColor',value:'#12ab34',geometry:true,views:true},{field:'fontStrike',value:true,geometry:true,views:true},{field:'fontUnderline',value:true,geometry:true,views:true}]);
 expect(result.pixels).toEqual([true,true,true]);expect(result.beforeUndo).toBe(mode==='clockwise'?3:0);expect(result.afterHistory).toBe(3);
 // Undo restores the original absent field rather than adding a default.
 expect(result.undone).toBeUndefined();expect(result.redone).toBe(true);
 expect(result.unchanged).toEqual({camera:true,selection:true,child:true});
 expect(result.saved).toEqual({fontColor:'#12ab34',fontStrike:true,fontUnderline:true});expect(result.metricLayouts).toBeGreaterThan(0);
});
