const {test,expect}=require('@playwright/test');
for(const [platform,url] of [['android','http://127.0.0.1:5173/app/index.html'],['desktop','http://127.0.0.1:5174/index.html']])for(const style of ['neon','radial'])test(`${platform} adaptive ${style} rendering keeps visible pixels, data and full exports`,async({page})=>{
 await page.setViewportSize({width:393,height:852});await page.addInitScript(()=>{localStorage.setItem('nm6_locale','it');localStorage.setItem('nm6_welcome_seen','1');});await page.goto(url);await page.waitForFunction(()=>window.neuroMapApp);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(async style=>{
  const a=neuroMapApp;a.importHierarchy({text:'Project',children:Array.from({length:12},(_,i)=>({text:'Area '+i,children:Array.from({length:30},(_,j)=>({text:'Task '+i+'/'+j,children:[]}))}))},{newTab:true});a.state.branchStyle=style;a.recalculateAndRender();
  const r=a.renderer;r.camera={x:196,y:426,zoom:.6};r.render();const auto=r.highPerformanceCanvas;r._nmAutoFastCanvas=false;
  const before=JSON.stringify(a.state.root),count=document.querySelectorAll('canvas').length;
  const digest=async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.ctx.getImageData(0,0,r.canvas.width,r.canvas.height).data))).join(',');
  r.highPerformanceCanvas=false;r.render();const full=await digest();r.highPerformanceCanvas=true;r.render();const cropped=await digest();
  const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=2000;let nodes=0;const old=r.drawNode;r.drawNode=function(...args){nodes++;return old.apply(this,args)};
  try{r.render(canvas.getContext('2d'),{x:1000,y:1000,zoom:.1});}finally{r.drawNode=old;}
  return {auto,same:full===cropped,unchanged:before===JSON.stringify(a.state.root),nodes,canvases:document.querySelectorAll('canvas').length===count};
 },style);
 expect(result).toEqual({auto:true,same:true,unchanged:true,nodes:373,canvases:true});
});
