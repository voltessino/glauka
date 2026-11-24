'use strict';
const fs=require('node:fs'),{chromium}=require('@playwright/test');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply new output JSON path');
const stats=values=>{values.sort((a,b)=>a-b);return{medianMs:(values[9]+values[10])/2,p95Ms:values[18]}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{for(const platform of ['desktop','android'])for(const count of [101,1001,3001]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.NeuroMapGraphics?.copyMeasurements);
  const result=await page.evaluate(async count=>{
   const a=neuroMapApp;await document.fonts.ready;a.importHierarchy({text:'Paired preview',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:(count-21)/20},(_,j)=>({text:'Topic '+i+'/'+j,children:[]}))}))},{newTab:true});await document.fonts.ready;a.recalculateAndRender();a.fitToScreen();
   const source=a.state.root.children[0].children[0],target=a.state.root.children[1],m=a.layout.getLayout(target.id),point=a.renderer.worldToScreen(m.x,m.y),d={nodeId:source.id,dropIntent:{kind:'child',targetId:target.id}},copy=NeuroMapGraphics.copyMeasurements;
   const samples={cached:[],uncached:[]},before=JSON.stringify(a.state.createSnapshot());let equal=true;
   const take=reuse=>{
    NeuroMapDrag.clear(a);NeuroMapGraphics.copyMeasurements=reuse?copy:()=>undefined;
    const t=performance.now();NeuroMapDrag.preview(a,d,point.x,point.y);const elapsed=performance.now()-t,p=a._nmDragPreview;
    samples[reuse?'cached':'uncached'].push(elapsed);
    // Readback is outside the measured UI operation and flushes the raster queue.
    return{pixels:p.canvas.toDataURL(),geometry:JSON.stringify([...p.layout.nodeLayoutMap])};
   };
   try{for(let i=0;i<20;i++){
    const one=take(i%2===0),two=take(i%2!==0);equal&&=one.pixels===two.pixels&&one.geometry===two.geometry;
    await new Promise(r=>requestAnimationFrame(r));
   }}finally{NeuroMapGraphics.copyMeasurements=copy;NeuroMapDrag.clear(a)}
   if(!equal||before!==JSON.stringify(a.state.createSnapshot()))throw Error('Pixels, geometry or live state changed');
   return{samples,equal};
  },count);
  rows.push({platform,nodes:count,cached:stats(result.samples.cached),uncached:stats(result.samples.uncached),pixelsGeometryAndStateEqual:result.equal});await context.close();
 }
 fs.writeFileSync(output,JSON.stringify({method:'Paired A/B in the same real editor; alternate order; twenty cold previews per variant; only metric seeding disabled for the reference. Raster readback outside timed interval. Linux Chromium, 1280x900.',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
