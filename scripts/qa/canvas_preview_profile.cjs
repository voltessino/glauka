'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{chromium}=require('@playwright/test');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply a new output JSON path');
const stats=values=>{values.sort((a,b)=>a-b);return{medianMs:(values[9]+values[10])/2,p95Ms:values[18]}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{for(const platform of ['desktop','android'])for(const count of [101,1001,3001]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
  await page.evaluate(async count=>{const a=neuroMapApp;await document.fonts.ready;a.importHierarchy({text:'Phase 3',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:(count-21)/20},(_,j)=>({text:'Topic '+i+'/'+j,children:[]}))}))},{newTab:true});a.fitToScreen();await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},count);
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('HeapProfiler.collectGarbage');
  const before=await cdp.send('Performance.getMetrics');
  const result=await page.evaluate(()=>{
   const a=neuroMapApp,State=a.state.constructor,proto=a.layout.constructor.prototype,clone=State.cloneTree,compute=proto.computeLayout,measure=proto.measureNode;
   const stages={clone:{calls:0,ms:0},layout:{calls:0,ms:0},measure:{calls:0,ms:0}},cold=[],render={},heapRoot=JSON.stringify(a.state.root);
   const wrap=(fn,name)=>function(...args){const t=performance.now();try{return fn.apply(this,args)}finally{stages[name].calls++;stages[name].ms+=performance.now()-t}};
   State.cloneTree=wrap(clone,'clone');proto.computeLayout=wrap(compute,'layout');proto.measureNode=wrap(measure,'measure');
   try{
    for(const selected of [false,true]){
     a.state.selectedNodeIds=selected?a.state.getAllNodes().map(n=>n.id):[];a.state.selectedNodeId=null;
     const times=[];for(let i=0;i<20;i++){const t=performance.now();a.renderer.render();times.push(performance.now()-t)}render[selected?'allSelected':'unselected']=times;
    }
    a.state.selectedNodeIds=[a.state.root.id];a.state.selectedNodeId=a.state.root.id;
    const source=a.state.root.children[0].children[0],target=a.state.root.children[1],m=a.layout.getLayout(target.id),point=a.renderer.worldToScreen(m.x,m.y),d={nodeId:source.id,dropIntent:{kind:'child',targetId:target.id}};
    let misses=0,hits=0;
    for(let i=0;i<20;i++){
     NeuroMapDrag.clear(a);const t=performance.now();NeuroMapDrag.preview(a,d,point.x,point.y);cold.push(performance.now()-t);
     const s=a._nmDragPreview?.layout._nmMeasureStats;misses+=s?.misses||0;hits+=s?.hits||0;
    }
    const preview=a._nmDragPreview,ghost=preview.canvas.toDataURL(),geometry=[...preview.layout.nodeLayoutMap.values()].map(m=>[m.x,m.y,m.width,m.height,m.textWidth,m.fontSize,m.lines]);
    NeuroMapDrag.clear(a);if(heapRoot!==JSON.stringify(a.state.root))throw Error('Preview changed the document');
    return{cold,render,stages,hits,misses,ghost,geometry,canvas:{width:a.renderer.canvas.width,height:a.renderer.canvas.height,dpr:a.renderer.dpr}};
   }finally{State.cloneTree=clone;proto.computeLayout=compute;proto.measureNode=measure;NeuroMapDrag.clear(a)}
  });
  await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Performance.getMetrics'),metric=(r,name)=>r.metrics.find(x=>x.name===name)?.value;
  result.ghostSHA256=crypto.createHash('sha256').update(result.ghost).digest('hex');delete result.ghost;
  result.geometrySHA256=crypto.createHash('sha256').update(JSON.stringify(result.geometry)).digest('hex');delete result.geometry;
  result.cold=stats(result.cold);for(const key in result.render)result.render[key]=stats(result.render[key]);
  rows.push({platform,nodes:count,...result,heapBefore:metric(before,'JSHeapUsedSize'),heapAfter:metric(after,'JSHeapUsedSize'),taskSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration')});await context.close();
 }
 fs.writeFileSync(output,JSON.stringify({method:'Linux Chromium real editor; twenty samples per render/cold preview; inclusive prototype stage timings (measurement is inside layout); post-GC JS heap; pixel/geometry hashes. All UI limits unchanged.',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
