/* Real editor handlers in Chromium; timings exclude the native window/OS. */
'use strict';
const fs=require('node:fs');
const {chromium}=require('@playwright/test');
const output=process.argv[2],action=process.argv[3]||'color';
if(!['color','fontColor'].includes(action))throw Error('Action must be color or fontColor');
if(!output||fs.existsSync(output))throw Error('Supply a new output JSON path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--enable-precise-memory-info']});
 const rows=[];
 try{
  for(const platform of ['desktop','android'])for(const children of [100,1020,3000]){
   const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
   await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
   await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
   await page.waitForFunction(()=>window.neuroMapApp?.nm54SyncSettings);
   const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
   await page.evaluate(async count=>{
    await document.fonts.ready;
    const a=neuroMapApp;
    a.importHierarchy({text:'Benchmark',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:count/20-1},(_,j)=>({text:'Concept '+i+' / '+j,children:[]}))}))},{newTab:true});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   },children);
   await cdp.send('HeapProfiler.collectGarbage');
   const metrics=()=>cdp.send('Performance.getMetrics').then(r=>r.metrics.find(m=>m.name==='JSHeapUsedSize').value);
   const heapBefore=await metrics();
   const result=await page.evaluate(async action=>{
    const a=neuroMapApp,original=a.layout.computeLayout;let layouts=0,layoutMs=0;
    a.layout.computeLayout=function(...args){const t=performance.now();try{return original.apply(this,args)}finally{layouts++;layoutMs+=performance.now()-t}};
    const samples=[];let sampledPeakHeap=performance.memory?.usedJSHeapSize||0;
    for(let i=0;i<10;i++){
     const input=document.getElementById(action==='fontColor'?'glauka-font-color':'inspector-color-picker');input.value=i%2?'#6366f1':'#12ab34';
     const start=performance.now();input.dispatchEvent(new Event('change',{bubbles:true}));const handlerMs=performance.now()-start;
     await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     sampledPeakHeap=Math.max(sampledPeakHeap,performance.memory?.usedJSHeapSize||0);
     samples.push({handlerMs,twoFramesMs:performance.now()-start});
    }
    a.layout.computeLayout=original;
    return {nodes:a.state.getAllNodes().length,layouts,layoutMs,samples,sampledPeakHeap,history:a.state.undoStack.length};
   },action);
   await cdp.send('HeapProfiler.collectGarbage');
   rows.push({platform,...result,heapBefore,heapAfter:await metrics()});await context.close();
  }
  fs.writeFileSync(output,JSON.stringify({action,environment:'Linux headless Chromium; real color-change handlers; ten edits; sampled heap is not an exact peak',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
