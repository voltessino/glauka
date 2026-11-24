const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 7 Fast Canvas — auxiliary layers',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1400,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&
   window.NeuroMapFastOverlayCanvas&&window.neuroMapApp.renderer);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
 });
 test('opt-in culls 950 offscreen images while keeping 50 visible images',async({page})=>{
  const stats=await page.evaluate(()=>{
   const app=window.neuroMapApp,r=app.renderer,at=r.screenToWorld(700,450);
   const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5ngAAAABJRU5ErkJggg==';
   app.state.images=Array.from({length:1000},(_,i)=>({
    id:'v7fast-image-'+i,src,width:80,height:60,aspectLocked:true,
    zLayer:i%2?'front':'back',mode:'free',
    worldPos:{x:i%20===0?at.x:at.x+100000+i*30,y:at.y}
   }));
   const toggle=document.getElementById('nm-fast-canvas-toggle');toggle.checked=true;toggle.dispatchEvent(new Event('change'));
   r.render();
   return {...r.fastCanvasOverlayStats,active:r.highPerformanceCanvas};
  });
  expect(stats.active).toBe(true);
  expect(stats.imagesEligible).toBe(1000);
  expect(stats.imagesPainted).toBe(50);
 });
 test('automatic mode also culls image-heavy workspaces and respects an explicit opt-out',async({page})=>{
  const result=await page.evaluate(()=>{
   const a=neuroMapApp,r=a.renderer,p=r.screenToWorld(700,450);
   a.state.images=Array.from({length:1000},(_,i)=>({id:'auto-'+i,src:'',width:80,height:60,zLayer:'front',mode:'free',worldPos:{x:i%20===0?p.x:p.x+100000,y:p.y}}));
   r.render();const active=r.highPerformanceCanvas;
   const painted=r.fastCanvasOverlayStats.imagesPainted;
   const toggle=document.getElementById('nm-fast-canvas-toggle');toggle.checked=false;toggle.dispatchEvent(new Event('change'));r.render();
   return {active,painted,disabled:!r.highPerformanceCanvas,saved:localStorage.getItem('neuromap.fastCanvas.enabled.v1')};
  });
  expect(result).toEqual({active:true,painted:50,disabled:true,saved:'false'});
 });
 test('image selection stays visible outside the viewport',async({page})=>{
  const stats=await page.evaluate(()=>{
   const app=window.neuroMapApp,r=app.renderer,at=r.screenToWorld(700,450);
   app.state.images=[{id:'offscreen-selected',src:'',width:100,height:100,
    aspectLocked:true,zLayer:'front',mode:'free',worldPos:{x:at.x+70000,y:at.y}}];
   app.state.selectedImageId='offscreen-selected';
   const toggle=document.getElementById('nm-fast-canvas-toggle');toggle.checked=true;toggle.dispatchEvent(new Event('change'));r.render();
   return {...r.fastCanvasOverlayStats};
  });
  expect(stats.imagesEligible).toBe(1);
  expect(stats.imagesPainted).toBe(1);
 });
 test('classic and full export paint all images without auxiliary culling',async({page})=>{
  const stats=await page.evaluate(()=>{
   const app=window.neuroMapApp,r=app.renderer,at=r.screenToWorld(700,450);
   app.state.images=Array.from({length:150},(_,i)=>({
    id:'compare-'+i,src:'',width:70,height:50,zLayer:'front',
    mode:'free',worldPos:{x:at.x+60000+i*100,y:at.y}
   }));
   const toggle=document.getElementById('nm-fast-canvas-toggle');toggle.checked=true;toggle.dispatchEvent(new Event('change'));r.render();
   const baseline=r.fastCanvasOverlayStats.imagesPainted;
   const originalStats=r.fastCanvasOverlayStats;
   const exportCanvas=document.createElement('canvas');
   exportCanvas.width=900;exportCanvas.height=600;
   r.render(exportCanvas.getContext('2d'),{scale:.5,tx:0,ty:0});
   const afterExport=r.fastCanvasOverlayStats===originalStats;
   toggle.checked=false;toggle.dispatchEvent(new Event('change'));r.render();
   return {baseline,afterExport,enabled:r.highPerformanceCanvas};
  });
  expect(stats.baseline).toBe(0);
  expect(stats.afterExport).toBe(true);
  expect(stats.enabled).toBe(false);
 });
});
