const {test,expect}=require('@playwright/test');
test.use({deviceScaleFactor:2,reducedMotion:'reduce'});
for(const platform of ['desktop','android'])for(const mode of ['clockwise','balanced','fluid','radial'])test(`${platform} ${mode}: frame selection index preserves HiDPI Canvas and export pixels`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
 const result=await page.evaluate(async mode=>{
  const a=neuroMapApp;await document.fonts.ready;
  a.importHierarchy({text:'Frame',children:Array.from({length:12},(_,i)=>({text:'Branch '+i,fontStrike:i%2===0,children:Array.from({length:6},(_,j)=>({text:'Topic '+i+'/'+j,markers:j===0?['priority-2']:[],children:[]}))}))},{newTab:true});
  if(mode==='radial'){a.state.branchStyle='radial';a.recalculateAndRender()}else document.getElementById('nm-mode-'+mode).click();
  const ids=a.state.getAllNodesIncludingCollapsed().map(n=>n.id);a.state.selectedNodeIds=ids;a.state.selectedNodeId=null;
  const renderer=a.renderer,hadOwn=Object.hasOwn(renderer,'drawNode'),draw=renderer.drawNode,checks=[];
  for(const zoom of [.5,1.75]){
   renderer.camera.zoom=zoom;renderer.render();renderer.render();const indexed=renderer.canvas.toDataURL();
   renderer.drawNode=function(...args){const frame=this._nmSelectedFrame;this._nmSelectedFrame=null;try{return draw.apply(this,args)}finally{this._nmSelectedFrame=frame}};
   try{renderer.render();checks.push(indexed===renderer.canvas.toDataURL())}finally{if(hadOwn)renderer.drawNode=draw;else delete renderer.drawNode}
   if(renderer._nmSelectedFrame!==undefined)throw Error('Frame index retained');
  }
  // Mutating the same selection array must be observed by the very next frame.
  ids.splice(0,ids.length,...a.state.root.children.map(n=>n.id));renderer.render();const selected=renderer.canvas.toDataURL();
  ids.splice(0,ids.length);renderer.render();const unselected=renderer.canvas.toDataURL();
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
  a.state.selectedNodeIds=a.state.getAllNodesIncludingCollapsed().map(n=>n.id);const saved=a.state.selectedNodeIds;
  renderer.render(canvas.getContext('2d'),{scale:1,tx:200,ty:200});const exported=canvas.toDataURL();
  const restored=a.state.selectedNodeIds===saved;a.state.selectedNodeIds=[];
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  renderer.render(canvas.getContext('2d'),{scale:1,tx:200,ty:200});
  return{checks,changed:selected!==unselected,exportEqual:exported===canvas.toDataURL(),restored,cleared:renderer._nmSelectedFrame===undefined,dpr:renderer.dpr};
 },mode);
 expect(result.checks).toEqual([true,true]);expect(result.changed).toBe(true);expect(result.exportEqual).toBe(true);
 expect(result.restored).toBe(true);expect(result.cleared).toBe(true);expect(result.dpr).toBe(2);
});
