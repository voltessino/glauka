'use strict';
// Finite observations of real editor APIs, not a physical FPS or general leak proof.
const fs=require('node:fs'),{chromium}=require('@playwright/test');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply new output JSON path');
const stats=values=>{values.sort((a,b)=>a-b);return{medianMs:(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2,p95Ms:values[Math.ceil(values.length*.95)-1]}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{for(const platform of ['desktop','android']){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
  await page.evaluate(async()=>{await document.fonts.ready;const a=neuroMapApp;a.importHierarchy({text:'Large probe',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:149},(_,j)=>({text:'Leaf '+j,children:[]}))}))},{newTab:true});a.fitToScreen();a.state.selectedNodeIds=a.state.getAllNodes().slice(-256).map(n=>n.id);a.state.selectedNodeId=a.state.selectedNodeIds[0]});
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const heap=async()=>{await cdp.send('HeapProfiler.collectGarbage');return(await cdp.send('Performance.getMetrics')).metrics.find(x=>x.name==='JSHeapUsedSize').value};
  const row={platform,nodes:3001,heapBefore:await heap(),repeated:[]};
  for(let batch=0;batch<4;batch++){
   const samples=await page.evaluate(async()=>{const a=neuroMapApp,times=[];for(let i=0;i<20;i++){const t=performance.now();a.v6SelectedNodes();a.nmFormatRefresh();times.push(performance.now()-t);await new Promise(r=>requestAnimationFrame(r))}return times});
   row.repeated.push({operations:(batch+1)*20,...stats(samples),heapBytes:await heap()});
  }
  row.drag=await page.evaluate(()=>{
   const a=neuroMapApp,source=a.state.root.children[0].children[0],target=a.state.root.children[1],m=a.layout.getLayout(target.id),point=a.renderer.worldToScreen(m.x,m.y),d={nodeId:source.id,dropIntent:{kind:'child',targetId:target.id}};
   const before=JSON.stringify(a.state.createSnapshot()),proto=a.layout.constructor.prototype,compute=proto.computeLayout;let layouts=0;
   proto.computeLayout=function(...args){layouts++;return compute.apply(this,args)};
   try{
    const cold=[],warm=[];for(let i=0;i<10;i++){NeuroMapDrag.clear(a);const t=performance.now();NeuroMapDrag.preview(a,d,point.x,point.y);cold.push(performance.now()-t)}
    const coldLayouts=layouts,canvas=a._nmDragPreview?.canvas;
    for(let i=0;i<20;i++){const t=performance.now();NeuroMapDrag.preview(a,d,point.x+i%2,point.y);warm.push(performance.now()-t)}
    const stableCanvas=canvas===a._nmDragPreview?.canvas,warmLayouts=layouts-coldLayouts;
    if(!stableCanvas||warmLayouts!==0||before!==JSON.stringify(a.state.createSnapshot()))throw Error('Drag cache or document invariant failed');
    return{cold,warm,coldLayouts,warmLayouts,stableCanvas};
   }finally{proto.computeLayout=compute;NeuroMapDrag.clear(a)}
  });
  row.drag.cold=stats(row.drag.cold);row.drag.warm=stats(row.drag.warm);
  await page.evaluate(()=>{window.__probeTab=neuroMapApp.activeTabId;window.__probeClose=neuroMapApp.closeTab(window.__probeTab)});await page.locator('#nm-decision-overlay .nm-decision-danger').click();
  await page.evaluate(async()=>{await window.__probeClose;window.__probeClose=null;if(neuroMapApp.tabs.some(t=>t.id===window.__probeTab))throw Error('Probe tab not closed');await neuroMapApp.persistWorkspace();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  row.heapAfterClose=await heap();
  row.tabs=await page.evaluate(async()=>{const a=neuroMapApp,ids=[],opening=[],switching=[],refresh=[];for(let i=0;i<20;i++){const t=performance.now();a.importHierarchy({text:'Tab '+i,children:Array.from({length:99},(_,j)=>({text:'Leaf '+j,children:[]}))},{newTab:true});opening.push(performance.now()-t);ids.push(a.activeTabId)}for(let i=0;i<40;i++){let t=performance.now();a.activateTab(ids[i%ids.length]);switching.push(performance.now()-t);t=performance.now();a.renderTabBar();refresh.push(performance.now()-t);await new Promise(r=>requestAnimationFrame(r))}return{count:ids.length,opening,switching,refresh}});
  for(const key of ['opening','switching','refresh'])row.tabs[key]=stats(row.tabs[key]);row.heapWithTwentyMaps=await heap();rows.push(row);await context.close();
 }
 fs.writeFileSync(output,JSON.stringify({method:'Linux Chromium, real APIs; four batches of 20 selection+panel refreshes on 3001 nodes; real prospective drag cold/warm cache; 20 additional maps of 100 nodes; post-GC JS heap. No committed drag or user data.',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
