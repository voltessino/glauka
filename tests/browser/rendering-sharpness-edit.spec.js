const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(platform+' uses native screen density and renders a single editable label',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:platform==='android'?393:1280,height:852},deviceScaleFactor:3,locale:'it-IT'});
 const page=await context.newPage();await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it');});
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.renderer&&window.NeuroMapCreativeCore);
 await page.evaluate(()=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=neuroMapApp;a.importHierarchy({text:'Progetto',children:[{text:'TESTO_PRECEDENTE_UNICO',children:[]}]},{newTab:true});a.selectNode(a.state.root.children[0].id);a.editSelected();});
 const field=page.locator('#inline-editor-input');await field.fill('Testo nuovo\nsul ramo');
 const result=await page.evaluate(()=>{
  const a=neuroMapApp,r=a.renderer,ctx=r.ctx,n=a.state.findNode(a.editorNodeId),m=a.layout.getLayout(n.id),calls=[],original=ctx.fillText;
  ctx.fillText=function(text,...args){calls.push(String(text));return original.call(this,text,...args);};
  try{r.render();r.inlineEditingContext={};r.drawIllustratedLabel(ctx,{...n,id:'virtual-copy',logicalId:n.id},m);r.drawIllustratedLabel(ctx,n,m);
   n.objectArt={id:'amphora',size:100};NeuroMapCreativeCore.paintObject(r,n,m,false);
  }finally{ctx.fillText=original;n.objectArt=null;}
  const exportCanvas=document.createElement('canvas'),exportCtx=exportCanvas.getContext('2d');let exported=[];exportCtx.fillText=t=>exported.push(String(t));r.drawIllustratedLabel(exportCtx,n,{...m,lines:['TESTO_PRECEDENTE_UNICO']});
  return {drawn:calls,exported,dpr:r.dpr,physical:devicePixelRatio,width:r.canvas.width,css:innerWidth,stored:n.text};
 });
 expect(result.dpr).toBe(3);expect(result.width).toBe(Math.floor(result.css*3));expect(result.drawn.join(' ')).not.toContain('TESTO_PRECEDENTE_UNICO');expect(result.drawn.join(' ')).not.toContain('Testo nuovo');expect(result.exported).toContain('TESTO_PRECEDENTE_UNICO');expect(result.stored).toBe('TESTO_PRECEDENTE_UNICO');
 await page.evaluate(()=>{neuroMapApp.requestRender();return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 await page.screenshot({path:info.outputPath(platform+'-sharp-inline.png')});await field.press('Escape');expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('TESTO_PRECEDENTE_UNICO');
 await page.evaluate(()=>neuroMapApp.editSelected());await field.fill('Confermato');await field.press('Enter');expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('Confermato');await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('TESTO_PRECEDENTE_UNICO');await context.close();
});
