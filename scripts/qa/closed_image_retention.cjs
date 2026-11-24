'use strict';
const fs=require('node:fs'),{chromium}=require('@playwright/test');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply new output JSON path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),rows=[];
 try{for(const platform of ['desktop','android']){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
  await page.evaluate(async()=>{
   const a=neuroMapApp;a.importHierarchy({text:'Raster fixture',children:[]},{newTab:true});window.__rasterTab=a.activeTabId;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');
   a.state.images=Array.from({length:12},(_,i)=>{ctx.fillStyle=`rgb(${i*19},${255-i*13},${i*7})`;ctx.fillRect(0,0,1024,1024);return{id:'image-'+i,src:canvas.toDataURL(),width:40,height:40,worldPos:{x:i*45,y:0},mode:'free',zLayer:'front',aspectLocked:true}});
   a.recalculateAndRender();await a.renderer.prepareExportImages();a.renderer.render();
   window.__rasterRefs=a.state.images.map(item=>{const image=a.renderer.getOrLoadImage(item.src);if(!image?.complete)throw Error('Image did not load');return new WeakRef(image)});
   window.__rasterPayload=JSON.parse(JSON.stringify(a.io.buildSerializedProjectPayload()));
   const shared={...a.state.images[0]};a.importHierarchy({text:'Shared fixture',children:[]},{newTab:true});a.state.images=[shared];a.recalculateAndRender();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('HeapProfiler.collectGarbage');
  const before=await cdp.send('Performance.getMetrics');
  const beforeCount=await page.evaluate(()=>__rasterRefs.filter(r=>r.deref()).length);
  await page.evaluate(()=>{window.__rasterClose=neuroMapApp.closeTab(window.__rasterTab)});await page.locator('#nm-decision-overlay .nm-decision-danger').click();
  await page.evaluate(async()=>{await window.__rasterClose;window.__rasterClose=null;if(neuroMapApp.tabs.some(t=>t.id===window.__rasterTab))throw Error('Fixture did not close');await neuroMapApp.persistWorkspace();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Performance.getMetrics');
  const remaining=await page.evaluate(()=>({alive:__rasterRefs.filter(r=>r.deref()).length,sharedAlive:!!__rasterRefs[0].deref(),sharedBytesUnchanged:neuroMapApp.state.images[0].src===__rasterPayload.images[0].src}));
  const reopened=await page.evaluate(async()=>{const a=neuroMapApp,ok=await a.importFiles([new File([JSON.stringify(__rasterPayload)],'raster.gk')],true);await a.renderer.prepareExportImages();return{opened:ok,images:a.state.images.length,bytesEqual:a.state.images.every((img,i)=>img.src===__rasterPayload.images[i].src)}});
  const metric=(r,k)=>r.metrics.find(x=>x.name===k)?.value;
  rows.push({platform,beforeCount,...remaining,reopened,heapBefore:metric(before,'JSHeapUsedSize'),heapAfter:metric(after,'JSHeapUsedSize')});await context.close();
 }
 fs.writeFileSync(output,JSON.stringify({method:'Twelve unique 1024x1024 PNGs in real editors; one shared with another open map. WeakRefs plus explicit CDP GC after closing the raster map through its real confirmation. Image source bytes and reopening verified. JS heap is not decoded/GPU RAM.',rows},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
