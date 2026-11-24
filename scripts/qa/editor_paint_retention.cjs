/* Bounded repeated edits in real editors; sampled post-GC JS heap, not native/GPU RAM. */
'use strict';
const fs=require('node:fs');
const {chromium}=require('@playwright/test');
const output=process.argv[2];
if(!output||fs.existsSync(output))throw Error('Supply a new output JSON path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{
  for(const platform of ['desktop','android']){
   const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
   await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
   await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
   await page.waitForFunction(()=>window.neuroMapApp?.nmSettingsApplyNode);
   await page.evaluate(async()=>{await document.fonts.ready;neuroMapApp.importHierarchy({text:'Retention',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:149},(_,j)=>({text:'Concept '+j,children:[]}))}))},{newTab:true})});
   const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
   const heap=async()=>{await cdp.send('HeapProfiler.collectGarbage');return(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='JSHeapUsedSize').value};
   const row={platform,nodes:3001,beforeHeapBytes:await heap(),batches:[]};
   for(let batch=0;batch<4;batch++){
    const sample=await page.evaluate(async()=>{
     const times=[];for(let i=0;i<40;i++){
      const input=document.getElementById('glauka-font-color');input.value=i%2?'#12ab34':'#6366f1';
      const t=performance.now();input.dispatchEvent(new Event('change',{bubbles:true}));times.push(performance.now()-t);
      if(i%10===9)await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     }
     await neuroMapApp.persistWorkspace();times.sort((a,b)=>a-b);
     return{handlerMedianMs:(times[19]+times[20])/2,history:neuroMapApp.state.getHistoryMemoryStats()};
    });
    row.batches.push({edits:(batch+1)*40,...sample,heapBytes:await heap()});
   }
   await page.evaluate(()=>{window.__retentionTab=neuroMapApp.activeTabId;window.__retentionClose=neuroMapApp.closeTab(window.__retentionTab)});
   // Explicitly discard only this isolated synthetic fixture through the real UI.
   await page.locator('#nm-decision-overlay .nm-decision-danger').click();
   await page.evaluate(async()=>{await window.__retentionClose;if(neuroMapApp.tabs.some(t=>t.id===window.__retentionTab))throw Error('Fixture tab did not close');window.__retentionClose=null;await neuroMapApp.persistWorkspace();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
   row.afterCloseHeapBytes=await heap();rows.push(row);await context.close();
  }
  fs.writeFileSync(output,JSON.stringify({method:'Linux Chromium; 160 real font-color edits per platform; history budgets unchanged; four post-GC samples plus closing the map. Finite observation, not a general leak proof.',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
