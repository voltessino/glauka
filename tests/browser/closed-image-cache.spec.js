const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])for(const scenario of ['cancel','undo-reference','unreferenced'])test(`${platform}: raster cache closure ${scenario} preserves image data`,async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
 await page.evaluate(async scenario=>{
  const a=neuroMapApp,src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  a.importHierarchy({text:'Raster owner',children:[]},{newTab:true});window.__owner=a.activeTabId;
  const image={id:'raster',src,width:80,height:60,mode:'free',worldPos:{x:30,y:30},zLayer:'front',aspectLocked:true};a.state.images=[image];a.recalculateAndRender();
  await a.renderer.prepareExportImages();window.__cached=a.renderer.getOrLoadImage(src);window.__payload=JSON.parse(JSON.stringify(a.io.buildSerializedProjectPayload()));
  if(scenario==='undo-reference'){
   a.importHierarchy({text:'Other map',children:[]},{newTab:true});a.state.images=[{...image}];a.state.deleteImage(image.id);a.markChanged();
   if(!a.state.undoStack.some(s=>s.images?.some(i=>i.src===src)))throw Error('Undo reference missing');
  }
  window.__close=a.closeTab(window.__owner);
 },scenario);
 const overlay=page.locator('#nm-decision-overlay');
 if(scenario==='cancel')await overlay.getByRole('button',{name:'Annulla',exact:true}).click();else await overlay.locator('.nm-decision-danger').click();
 const result=await page.evaluate(async scenario=>{
  const a=neuroMapApp;await window.__close;window.__close=null;const src=window.__payload.images[0].src,present=a.tabs.some(t=>t.id===window.__owner),same=a.renderer.getOrLoadImage(src)===window.__cached;
  if(scenario==='cancel')return{present,same};
  if(scenario==='undo-reference'){a.undo();return{present,same,restored:a.state.images.some(i=>i.src===src)}}
  const opened=await a.importFiles([new File([JSON.stringify(window.__payload)],'raster.gk')],true);await a.renderer.prepareExportImages();return{present,same,opened,bytes:a.state.images[0].src===src};
 },scenario);
 expect(result.present).toBe(scenario==='cancel');
 if(scenario==='unreferenced')expect(result).toEqual({present:false,same:false,opened:1,bytes:true});
 else if(scenario==='undo-reference')expect(result).toEqual({present:false,same:true,restored:true});
 else expect(result).toEqual({present:true,same:true});
});
