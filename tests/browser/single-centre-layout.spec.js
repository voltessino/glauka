const {test,expect}=require('@playwright/test');
async function boot(page){
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapContinuation);
 await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Un solo centro',children:Array.from({length:4},(_,g)=>({text:'Ramo '+g,children:[{text:'Livello intermedio '+g,children:Array.from({length:12},(_,i)=>({text:'Concetto '+g+' '+i+' con una spiegazione lunga da mandare a capo',children:[]}))}]}))},{newTab:true});a.state.root.layoutDistribution={enabled:true,height:180};a.markChanged();});
}
test('legacy maps stay connected through 108 combinations of real size and spacing settings',async({page})=>{
 await boot(page);const results=await page.evaluate(()=>{
  const a=neuroMapApp,failures=[],ids=a.state.getAllNodes().map(n=>n.id),original=JSON.stringify(a.state.root);let frames=0;
  for(const style of ['xmind8','neon','buzan','simple'])for(const compact of [55,100,145])for(const horizontal of [30,125,220])for(const wrap of [12,28,60]){
   Object.assign(a.state,{branchStyle:style,compactness:compact,branchGapX:horizontal,defaultLabelWrapChars:wrap});a.recalculateAndRender();frames++;
   const roots=[...a.layout.viewNodes.values()].filter(n=>n.logicalId===a.state.root.id),plan=a.layout.continuationPlan;
   if(roots.length!==1||a.layout.continuationGroups.length!==1||plan.pages.length>2||new Set(plan.pages.map(p=>p.side)).size!==plan.pages.length)failures.push({style,compact,horizontal,wrap,roots:roots.length});
   if(JSON.stringify(a.state.root)!==original||JSON.stringify(a.state.getAllNodes().map(n=>n.id))!==JSON.stringify(ids))failures.push('logical tree changed');
  }
  return {failures,frames};
 });expect(results.frames).toBe(108);expect(results.failures).toEqual([]);
});
test('every layout slider changes its actual property and never adds a central view; undo restores spacing',async({page})=>{
 await boot(page);const result=await page.evaluate(()=>{
  const a=neuroMapApp,errors=[],ids=a.state.getAllNodes().map(n=>n.id);
  a.state.root.layoutDistribution.height=480;a.state.root.layoutDistribution.minimumHeight=480;a.markChanged();
  for(const[id,field,values]of [['nm67-compact-slider','compactness',[55,145,55]],['nm68-branch-gap','branchGapX',[30,220,30]],['threshold-slider','balanceBias',[0,100,50]],['nm54-map-wrap-slider','defaultLabelWrapChars',[12,60,28]],['nm-distribution-exact',null,[480,8000,480]]]){
   const input=document.getElementById(id);
   for(const value of values){input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    const actual=field?a.state[field]:a.state.root.layoutDistribution.height;if(Number(actual)!==value)errors.push(id+' did not apply');
    if([...a.layout.viewNodes.values()].filter(n=>n.logicalId===a.state.root.id).length!==1)errors.push(id+' duplicated the root');
   }
  }
  return {errors,idsSame:JSON.stringify(a.state.getAllNodes().map(n=>n.id))===JSON.stringify(ids),history:a.state.undoStack.length};
 });expect(result.errors).toEqual([]);expect(result.idsSame).toBe(true);expect(result.history).toBeGreaterThan(0);
 await page.evaluate(()=>{const input=document.getElementById('nm67-compact-slider');input.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));input.value='145';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(await page.evaluate(()=>neuroMapApp.state.compactness)).toBe(145);await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.compactness)).toBe(55);
});
test('forecast predicts the real next child using saved node font defaults without inserting it',async({page})=>{
 await boot(page);const result=await page.evaluate(()=>{
  const a=neuroMapApp,f=NeuroMapCreativeModules.formatting,key=f.KEY,prior=localStorage.getItem(key),checks=[];
  try{for(const size of [14,32,48]){
   localStorage.setItem(key,JSON.stringify({'font-size':{fontSize:size}}));const parent=a.state.root.children[0].children[0],before=JSON.stringify(a.state.root),history=a.state.undoStack.length;
   const prediction=a.layout.predictContinuation(parent.id);if(JSON.stringify(a.state.root)!==before||a.state.undoStack.length!==history)throw Error('Prediction changed the map');
   const node=a.state.addChildNode(parent.id,a.layout);a.markChanged();const actual=a.layout.continuationPlan.pages.find(p=>p.units.includes(node.id));checks.push({predicted:prediction.side,actual:actual.side,size:node.fontSize});
  }}finally{if(prior===null)localStorage.removeItem(key);else localStorage.setItem(key,prior)}return checks;
 });for(const c of result){expect(c.predicted).toBe(c.actual);expect(c.size).toBeGreaterThan(0)}
});
test('layout explanations are actionable in both languages and buttons use the real layout',async({page},info)=>{
 await boot(page);await page.locator('#v6-show-layout').click();
 await expect(page.locator('#nm-continuation-enabled')).toHaveCount(0);await expect(page.locator('#nm-distribution-controls')).toBeVisible();await expect(page.locator('#nm620-layout-forecast')).not.toContainText(/settori|unità|px/);
 await expect(page.locator('.nm67-compact-row')).toContainText('Distanza tra i rami');
 const before=await page.evaluate(()=>({tree:JSON.stringify(neuroMapApp.state.root),history:neuroMapApp.state.undoStack.length}));
 await page.locator('#nm620-preview-next').click();await expect(page.locator('#nm620-forecast-next')).toContainText('Sottoramo di');await page.locator('#nm620-show-guides').click();expect(await page.evaluate(()=>neuroMapApp.renderer._distributionGuidesUntil-performance.now())).toBeGreaterThan(2000);
 expect(await page.evaluate(()=>({tree:JSON.stringify(neuroMapApp.state.root),history:neuroMapApp.state.undoStack.length}))).toEqual(before);
 await page.mouse.move(5,500);await page.screenshot({path:info.outputPath('single-centre-layout-it.png')});
 await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});await expect(page.locator('#nm620-preview-next')).toHaveText('Predict side');await expect(page.locator('.nm67-compact-row')).toContainText('Distance between branches');await expect(page.locator('#nm-distribution-explanation')).toContainText('map stays connected');
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.renderer._distributionGuidesUntil||0)).toBe(0);
});
