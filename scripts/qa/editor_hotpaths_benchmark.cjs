'use strict';
const fs=require('node:fs'),{chromium}=require('@playwright/test');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply new output JSON path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{
  for(const platform of ['desktop','android'])for(const count of [101,1001,3001]){
   const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
   await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
   await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
   await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
   const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
   const opening=await page.evaluate(async count=>{
    await document.fonts.ready;const a=neuroMapApp,t=performance.now();
    a.importHierarchy({text:'Hot paths',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:(count-21)/20},(_,j)=>({text:'Concept '+i+'/'+j,children:[]}))}))},{newTab:true});
    const openMs=performance.now()-t,nodes=a.state.getAllNodes(),ids=nodes.slice(-Math.min(256,nodes.length)).map(n=>n.id);
    a.state.selectedNodeIds=ids;a.state.selectedNodeId=ids[0];a.updateStatus();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{openMs,nodes:nodes.length,selected:ids.length};
   },count);
   await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Performance.getMetrics');
   const result=await page.evaluate(async()=>{
    const a=neuroMapApp,operations={selection:()=>a.v6SelectedNodes(),panel:()=>a.nmFormatRefresh(),render:()=>a.renderer.render(),tabs:()=>a.renderTabBar()},stats={};
    let lookups=0,lookupMs=0;const find=a.state.findNode;a.state.findNode=function(...args){lookups++;const t=performance.now();try{return find.apply(this,args)}finally{lookupMs+=performance.now()-t}};
    for(const [name,fn]of Object.entries(operations)){
     const times=[],startCalls=lookups,startMs=lookupMs;
     for(let i=0;i<10;i++){const t=performance.now();fn();times.push(performance.now()-t);await new Promise(r=>requestAnimationFrame(r))}
     times.sort((a,b)=>a-b);stats[name]={medianMs:(times[4]+times[5])/2,p95Ms:times[9],findCalls:lookups-startCalls,findMs:lookupMs-startMs};
    }
    a.state.findNode=find;return stats;
   });
   await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Performance.getMetrics'),metric=(m,k)=>m.metrics.find(x=>x.name===k)?.value;
   rows.push({platform,...opening,operations:result,heapBefore:metric(before,'JSHeapUsedSize'),heapAfter:metric(after,'JSHeapUsedSize'),mainThreadTaskSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration')});
   await context.close();
  }
  fs.writeFileSync(output,JSON.stringify({method:'Linux headless Chromium, real staged editor APIs/DOM/Canvas, 1280x900. Ten samples per operation, bounded 256-node selection, post-GC heap; opening is one sample. No physical/native FPS claim.',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
