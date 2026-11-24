const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
for(const [platform,url] of [['android','http://127.0.0.1:5173/app/index.html'],['desktop','http://127.0.0.1:5174/index.html']]){
 test(platform+' records a bounded large-map rendering and memory baseline',async({page},info)=>{
  test.setTimeout(90000);await page.setViewportSize({width:1280,height:900});
  await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it');});
  await page.goto(url);await page.waitForFunction(()=>window.neuroMapApp);await page.evaluate(()=>document.fonts.ready);
  const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
  const before=await session.send('Performance.getMetrics');
  const result=await page.evaluate(async()=>{
   const a=neuroMapApp;document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
   const root={text:'Progetto',children:Array.from({length:20},(_,i)=>({text:'Area '+i,children:Array.from({length:50},(_,j)=>({text:'Attività '+i+' / '+j,children:[]}))}))};
   const start=performance.now();a.importHierarchy(root,{newTab:true});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const importMs=performance.now()-start;
   a.renderer.camera={x:640,y:450,zoom:0.8};a.requestRender();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const canvases=document.querySelectorAll('canvas').length,times=[];
   for(let i=0;i<24;i++){const start=performance.now();a.zoomAt(i%2?1.03:1/1.03,640,450);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));times.push(performance.now()-start);}
   times.sort((a,b)=>a-b);
   return {nodes:a.state.getAllNodes().length,importMs,zoomTwoFramesP50Ms:times[12],zoomTwoFramesP95Ms:times[22],canvasCount:canvases,canvasCountAfter:document.querySelectorAll('canvas').length,paintStats:a.renderer.fastCanvasStats||null};
  });
  const after=await session.send('Performance.getMetrics');
  const metric=(x,name)=>x.metrics.find(m=>m.name===name)?.value||0;
  Object.assign(result,{platform,jsHeapBefore:metric(before,'JSHeapUsedSize'),jsHeapAfter:metric(after,'JSHeapUsedSize'),environment:'Linux headless Chromium, 1280×900; not physical phone or native desktop'});
  fs.writeFileSync(info.outputPath('performance.json'),JSON.stringify(result,null,2));
  expect(result.nodes).toBe(1021);expect(result.canvasCountAfter).toBe(result.canvasCount);
 });
}
