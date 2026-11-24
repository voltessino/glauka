const {test,expect}=require('@playwright/test');
async function open(page,platform='desktop'){
 await page.setViewportSize({width:1440,height:960});await page.goto(platform==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapMarkers);
 if(platform==='desktop')await page.waitForSelector('#nm-format-target',{state:'attached'});
 await page.evaluate(()=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=neuroMapApp;a.importHierarchy({text:'Mappa',children:[{text:'Primo ramo',children:[{text:'Dettaglio',children:[]}]},{text:'Secondo ramo',children:[]}]},{newTab:true});a.selectNode(a.state.root.children[0].id);});
}
for(const platform of ['desktop','android'])test.describe(platform+' marker shelf and steep branches',()=>{
 test.beforeEach(async({page})=>open(page,platform));
 test('marker shelf leaves the canvas usable and has searchable categorized symbols',async({page})=>{
  await page.evaluate(()=>neuroMapApp.nm62OpenAssets());await page.locator('#nm-creative-library-hub [data-placement="badge"]').click();await expect(page.locator('#nm-creative-library-hub')).toBeVisible();
  const box=await page.locator('#nm-creative-library-hub .nm-creative-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,modal:e.getAttribute('aria-modal')==='true'};});
  expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(1440);
  if(!box.modal)expect(box.width).toBeLessThanOrEqual(560);
  expect(await page.locator('#nm-creative-library-hub [data-marker]').count()).toBeGreaterThanOrEqual(75);await page.locator('#nm-creative-library-content input[type=search]').fill('triangolo');await expect(page.locator('#nm-creative-library-hub [data-marker=triangle]')).toBeVisible();await expect(page.locator('#nm-creative-library-hub [data-marker=heart]')).toBeHidden();await page.locator('#nm-creative-library-hub [data-marker=triangle]').click();await expect(page.locator('#nm-creative-library-hub [data-marker=triangle]')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>neuroMapApp.selectNode(neuroMapApp.state.root.children[1].id));await page.locator('#nm-creative-library-content input[type=search]').fill('heart');await page.locator('#nm-creative-library-hub [data-marker=heart]').click();expect(await page.evaluate(()=>neuroMapApp.state.root.children.map(n=>n.markers))).toEqual([['triangle'],['heart']]);
  await page.evaluate(()=>GlaukaI18n.setLanguage('en'));await expect(page.locator('#nm-creative-library-hub-title')).toHaveText('Creative library');await expect(page.locator('#nm-creative-library-content input[type=search]')).toHaveAttribute('aria-label','Search the library');
 });
 test('marker limit, individual removal, Undo and vector export use the same symbols',async({page})=>{
  await page.evaluate(()=>neuroMapApp.nm62OpenAssets());await page.locator('#nm-creative-library-hub [data-placement="badge"]').click();for(const id of ['triangle','infinity','repeat','hexagon'])await page.locator('#nm-creative-library-hub [data-marker='+id+']').click();
  const before=await page.evaluate(()=>({markers:neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).markers,svg:NeuroMapGraphics.svgLayers(neuroMapApp.renderer).markers}));expect(before.markers).toEqual(['triangle','infinity','repeat']);expect(before.svg).toContain('△');expect(before.svg).toContain('∞');expect(before.svg).toContain('↻');
  await page.locator('#nm-creative-library-hub [data-marker=triangle]').click();expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).markers)).toEqual(['infinity','repeat']);await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).markers)).toEqual(before.markers);
 });
 test('removing markers preserves illustrations and switching tabs closes the shelf',async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp,n=a.state.findNode(a.state.selectedNodeId);n.markers=['star'];n.illustration={svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',name:'keep'};a.nm62OpenAssets();});await page.locator('#nm-creative-library-hub [data-placement=badge]').click();await page.locator('#nm-creative-library-hub [data-marker=star]').click();expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).markers)).toEqual([]);expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).illustration.name)).toBe('keep');await page.evaluate(()=>neuroMapApp.createNewTab('Cambio'));await expect(page.locator('#nm-creative-library-hub')).toHaveCount(0);
 });
 test('embedded marker font loads offline and SVG includes it without XML errors; fit reserves shelf space',async({page})=>{
  const result=await page.evaluate(async()=>{const a=neuroMapApp,baseline=NeuroMapGraphics.viewport();a.nm62OpenAssets();a.state.root.children[0].markers=['priority-1','triangle','infinity'];await document.fonts.load('15px NeuroMapSymbols');let blob;a.io.triggerDownload=value=>blob=value;a.io.exportSVG();const svg=await blob.text(),xml=new DOMParser().parseFromString(svg,'image/svg+xml'),viewport=NeuroMapGraphics.viewport(),panel=document.querySelector('#nm-creative-library-hub .nm-creative-dialog'),shelf=panel.getBoundingClientRect();return {loaded:document.fonts.check('15px NeuroMapSymbols'),embedded:svg.includes('font/ttf;base64,'),valid:!xml.querySelector('parsererror'),space:panel.getAttribute('aria-modal')==='true'?viewport.right===baseline.right:viewport.right<shelf.left};});expect(result).toEqual({loaded:true,embedded:true,valid:true,space:true});
 });
 test('steep organic branches have continuous rounded coverage without needle-like pinches',async({page})=>{
  const r=await page.evaluate(()=>{
   const g={startX:20,startY:20,cp1x:32,cp1y:20,cp2x:38,cp2y:620,endX:50,endY:620,startWidth:16,endWidth:6},c=document.createElement('canvas');c.width=100;c.height=660;const ctx=c.getContext('2d');ctx.fill(new Path2D(NeuroMapGraphics.ribbonPath(g)));
   const coverage=[];for(let i=0;i<=100;i++){const t=i/100,u=1-t,x=u*u*u*g.startX+3*u*u*t*g.cp1x+3*u*t*t*g.cp2x+t*t*t*g.endX,y=u*u*u*g.startY+3*u*u*t*g.cp1y+3*u*t*t*g.cp2y+t*t*t*g.endY;coverage.push(ctx.getImageData(Math.round(x),Math.round(y),1,1).data[3]);}
   const a=neuroMapApp,p=a.state.root.children[0],child=p.children[0];a.state.branchStyle='buzan';a.state.strokeScale=3;a.markChanged();const incoming=a.renderer.computeBranchGeometry(a.state.root,p,0,2),outgoing=a.renderer.computeBranchGeometry(p,child,0,1);return {min:Math.min(...coverage),continuous:Math.abs(incoming.endWidth-outgoing.startWidth)<.001,path:NeuroMapGraphics.ribbonPath(g).includes(' A ')};
  });expect(r.min).toBeGreaterThan(200);expect(r.continuous).toBe(true);expect(r.path).toBe(true);
 });
});
