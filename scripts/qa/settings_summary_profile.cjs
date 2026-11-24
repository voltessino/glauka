'use strict';
// Timings cover the real mounted settings panel, not a reimplementation.
const fs=require('node:fs'),{chromium}=require('@playwright/test');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply a new output JSON path');
const stats=values=>{const v=[...values].sort((a,b)=>a-b);return{medianMs:(v[9]+v[10])/2,p95Ms:v[18]}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{for(const platform of ['desktop','android'])for(const count of [101,1001,3001])for(const mixed of [false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmSettings);
  await page.evaluate(({count,mixed})=>{
   const a=neuroMapApp;a.importHierarchy({text:'Settings profile',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:(count-21)/20},(_,j)=>({text:'Topic '+i+'/'+j,children:[]}))}))},{newTab:true});
   for(const n of a.state.getAllNodesIncludingCollapsed()){n.fontSize=20;n.fontColor='#123456';n.labelIndent=0;n.fontWeight=400}
   if(mixed){const n=a.state.root.children[0];n.fontSize=26;n.fontColor='#abcdef';n.labelIndent=10;n.fontWeight=700}
   document.getElementById('nm-format-target').value='map';document.getElementById('nm-settings-scope-style').value='tab';
   a.nmFormatRefresh();
  },{count,mixed});
  await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Runtime.getHeapUsage');
  const result=await page.evaluate(()=>{
   const a=neuroMapApp,before=JSON.stringify(a.state.createSnapshot()),specs=NeuroMapCreativeModules.formatting.specs.filter(s=>s.kind==='node'),samples=[];
   const expected=specs.map(s=>a.nmSettings.summary(s));
   for(let i=0;i<20;i++){const start=performance.now();a.nmFormatRefresh();samples.push(performance.now()-start)}
   const same=before===JSON.stringify(a.state.createSnapshot())&&JSON.stringify(expected)===JSON.stringify(specs.map(s=>a.nmSettings.summary(s)));
   if(!same)throw Error('Settings refresh mutated the document or summary');
   return{samples,summaries:expected};
  });
  const allocated=await cdp.send('Runtime.getHeapUsage');await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage');
  rows.push({platform,nodes:count,mixed,...stats(result.samples),samplesMs:result.samples,summaries:result.summaries,heapBefore:before.usedSize,heapBeforeGC:allocated.usedSize,heapAfterGC:after.usedSize});await context.close();
 }
 fs.writeFileSync(output,JSON.stringify({method:'Chromium Linux, real mounted nmFormatRefresh; map scope, twenty synchronous samples; alternating values in the first child for mixed cases. CDP heap observations, not bitmap/native memory. No rendering timed.',rows},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
