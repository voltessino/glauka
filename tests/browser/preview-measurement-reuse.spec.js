const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])for(const mode of ['clockwise','balanced','fluid','radial'])test(`${platform} ${mode}: reused preview metrics match uncached pixels and geometry`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.NeuroMapGraphics?.copyMeasurements);
 const result=await page.evaluate(async mode=>{
  const a=neuroMapApp;await document.fonts.ready;
  a.importHierarchy({text:'Cache',children:[{text:'Move',notes:'Keep α',children:[{text:'Detailed note',fontFamily:'Georgia',fontStrike:true,markers:['priority-2'],children:[]}]},{text:'Target',collapsed:true,children:[{text:'Hidden child',children:[]}]},{text:'Other',children:[]}]},{newTab:true});
  if(mode==='radial'){a.state.branchStyle='radial';a.recalculateAndRender()}else document.getElementById('nm-mode-'+mode).click();
  await document.fonts.ready;a.recalculateAndRender();a.fitToScreen();
  // Deliberately leave the source intrinsic cache stale: the cloned cache must
  // validate typography/wrapping again, including the changed logical depth.
  const source=a.state.root.children[0],target=a.state.root.children[1];
  source.children[0].fontFamily='Courier New';source.children[0].fontSize=24;source.children[0].labelWrapChars=9;
  const before=JSON.stringify(a.state.createSnapshot()),m=a.layout.getLayout(target.id),point=a.renderer.worldToScreen(m.x,m.y),d={nodeId:source.id,dropIntent:{kind:'child',targetId:target.id}};
  const preview=()=>{NeuroMapDrag.preview(a,d,point.x,point.y);const p=a._nmDragPreview;if(!p)throw Error('Preview missing');return{pixels:p.canvas.toDataURL(),geometry:JSON.stringify([...p.layout.nodeLayoutMap]),stats:{...p.layout._nmMeasureStats}}};
  const optimized=preview();NeuroMapDrag.clear(a);
  const copy=NeuroMapGraphics.copyMeasurements;let reference;
  try{NeuroMapGraphics.copyMeasurements=()=>undefined;reference=preview()}finally{NeuroMapGraphics.copyMeasurements=copy;NeuroMapDrag.clear(a)}
  return{pixels:optimized.pixels===reference.pixels,geometry:optimized.geometry===reference.geometry,hits:optimized.stats.hits,misses:optimized.stats.misses,uncachedMisses:reference.stats.misses,unchanged:before===JSON.stringify(a.state.createSnapshot()),cleared:!a._nmDragPreview&&!document.getElementById('nm-drag-preview')};
 },mode);
 expect(result.pixels).toBe(true);expect(result.geometry).toBe(true);expect(result.hits).toBeGreaterThan(0);
 expect(result.misses).toBeLessThan(result.uncachedMisses);expect(result.unchanged).toBe(true);expect(result.cleared).toBe(true);
});
