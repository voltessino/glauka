const {test,expect}=require('@playwright/test');
const {chooseTheme}=require('./settings-path');
test.describe('NeuroMap adaptive clockwise layout and independent futuristic themes',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapUISkin&&window.NeuroMapMapStyleCore);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
 });
 test('new map uses adaptive clockwise; imported legacy layout remains unchanged',async({page})=>{
  const values=await page.evaluate(()=>{
   const a=window.neuroMapApp;a.createNewTab('Adaptive');
   const fresh={mode:a.state.root.layoutMode,config:{...a.state.root.layoutDistribution}};
   a.importHierarchy({text:'Legacy',layoutMode:'balanced',layoutDistribution:{enabled:false,height:480},
    children:[{text:'Prior node',children:[]}]},{newTab:true});
   return {fresh,legacy:{mode:a.state.root.layoutMode,config:a.state.root.layoutDistribution}};
  });
  expect(values.fresh.mode).toBe('clockwise');
  expect(values.fresh.config).toMatchObject({enabled:true,overflowMode:'expand'});
  expect(values.legacy).toMatchObject({mode:'balanced',config:{enabled:false}});
 });
 test('smaller/greater/repeated limit reflows from source, max two sectors',async({page})=>{
  const result=await page.evaluate(()=>{
   const app=neuroMapApp;app.createNewTab('Clockwise QA');
   const root=app.state.root;
   const branch={id:'qa-main',parentId:root.id,text:'Main',side:'right',collapsed:false,
     children:Array.from({length:30},(_,i)=>({id:'qa-'+i,parentId:'qa-main',text:'Subject '+i,
       side:'right',collapsed:false,children:[]}))};
   root.children.push(branch);app.state.balanceBias=50;root.layoutDistribution.height=480;
   const sample=h=>{root.layoutDistribution.height=h;app.recalculateAndRender();
    const p=app.layout.continuationPlan;
    return {right:p.pages[0]?.units.length,
     pages:p.pages.map(x=>({side:x.side,units:x.units})),
     effective:root.layoutDistribution.height}};
   const low=sample(480),high=sample(1000),lowAgain=sample(480),highAgain=sample(1000);
   return {low,high,lowAgain,highAgain,logicalCount:branch.children.length};
  });
  expect(result.low.pages.length).toBeLessThanOrEqual(2);
  expect(result.high.pages.length).toBeLessThanOrEqual(2);
  expect(result.lowAgain.pages).toEqual(result.low.pages);
  expect(result.highAgain.pages).toEqual(result.high.pages);
  expect(result.high.right).toBeGreaterThanOrEqual(result.low.right);
  expect(result.logicalCount).toBe(30);
 });
 test('UI skins switch immediately without changing any map or branch style',async({page})=>{
  const before=await page.evaluate(()=>{
   const a=neuroMapApp;return {root:JSON.stringify(a.state.root),style:a.state.branchStyle,
    undo:a.state.undoStack.length}});
  for(const theme of ['aurora','glass','cyber','minimal','graphite','neon','orbit']){
   await chooseTheme(page,theme);
   await expect(page.locator('body')).toHaveAttribute('data-nm-skin',theme);
  }
  await expect(page.locator('#gl-settings-theme-extra option[value=classic]')).toHaveCount(0);
  await page.evaluate(()=>NeuroMapUISkin.set({theme:'classic'}));
  await expect(page.locator('body')).toHaveAttribute('data-nm-skin','orbit');
  await chooseTheme(page,'aurora');
  await page.locator('#gl-settings-contrast').selectOption('high');
  await expect(page.locator('body')).toHaveAttribute('data-nm-skin-contrast','high');
  expect(await page.evaluate(()=>({root:JSON.stringify(neuroMapApp.state.root),
   style:neuroMapApp.state.branchStyle,undo:neuroMapApp.state.undoStack.length}))).toEqual(before);
 });
 test('node silhouettes apply globally and Undo restores the previous data',async({page})=>{
  await page.locator('#btn-toggle-inspector').click();
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
  await page.locator('#nm-map-style-trigger').click();
  await page.locator('#nm-map-presets .nm-map-card[aria-label="Circuitale"]').click();
  const values=await page.evaluate(()=>{
   const a=neuroMapApp;return {style:a.state.branchStyle,shape:a.state.root.children[0]?.nodeShape,
    id:a.state.root.children[0]?.id}});
  expect(values).toMatchObject({style:'thickparents',shape:'circuit'});
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
 });
 test('SVG includes node silhouette without changing project IDs',async({page})=>{
  const result=await page.evaluate(async()=>{
   const a=neuroMapApp;a.state.pushHistory();
   for(const node of a.state.root.children)node.nodeShape='hex';
   a.recalculateAndRender();
   a.markChanged();
   const ids=a.state.root.children.map(n=>n.id),before=JSON.stringify(a.state.root);
   let svg='',original=a.io.triggerDownload;
   try{await new Promise(resolve=>{
    a.io.triggerDownload=async b=>{svg=await b.text();resolve()};a.io.exportSVG();
   })}finally{a.io.triggerDownload=original}
   return {ids,after:a.state.root.children.map(n=>n.id),same:before===JSON.stringify(a.state.root),
    polygon:svg.includes('<polygon')};
  });
  expect(result.after).toEqual(result.ids);
  expect(result.same).toBe(true);
  expect(result.polygon).toBe(true);
 });
});
