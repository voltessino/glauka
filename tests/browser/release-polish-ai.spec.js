const {test,expect}=require('@playwright/test');
async function boot(page,platform='desktop'){
 await page.setViewportSize({width:platform==='android'?393:1180,height:740});
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaIllustrations);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));});
}
for(const platform of ['android','desktop'])for(const mode of ['review','all']){
 test(platform+' AI illustration '+mode+' uses bounded catalogue suggestions and supports Undo',async({page})=>{
  await boot(page,platform);const before=await page.evaluate(()=>{const a=neuroMapApp;a.state.root.children=a.state.root.children.slice(0,2);for(const n of a.state.getAllNodes()){n.objectArt=null;n.illustration=null;}a.markChanged();window.nmProduct.guard=()=>true;a.aiClient.chat=async(_system,input)=>{const q=JSON.parse(input);return JSON.stringify([...q.topics.map(n=>({node:n.id,asset:'flat-idea'})),{node:q.topics[0].id,asset:'not-allowed'},{node:'fake',asset:'brain'}]);};GlaukaIllustrations.open(a);return {json:JSON.stringify(a.state.getAllNodes().map(n=>[n.id,n.text,n.objectArt||null,n.illustration||null,n.notes||'',n.parentId])),undo:a.state.undoStack.length,count:a.state.getAllNodes().length};});
  const modal=page.locator('#gl-ai-illustrations');await modal.getByRole('combobox',{name:'Come applicarle'}).selectOption(mode);await modal.locator('#gl-ai-illustration-start').click();
  if(mode==='review'){
   await expect(modal.locator('#gl-ai-illustration-use')).toBeVisible();expect(await page.evaluate(()=>neuroMapApp.state.root.objectArt)).toBeNull();await modal.locator('#gl-ai-illustration-use').click();await modal.locator('#gl-ai-illustration-skip').click();expect(await page.evaluate(()=>neuroMapApp.state.root.objectArt.id)).toBe('flat-idea');
  }else{
   await expect(modal.getByRole('status')).toContainText('Immagini aggiunte: '+before.count);expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(before.undo+1);expect(await page.evaluate(()=>neuroMapApp.state.getAllNodes().every(n=>n.objectArt?.id==='flat-idea'))).toBe(true);
  }
  await modal.getByRole('button',{name:'Chiudi',exact:true}).click();await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.getAllNodes().map(n=>[n.id,n.text,n.objectArt||null,n.illustration||null,n.notes||'',n.parentId])))).toBe(before.json);
 });
}
test('AI gating, cancellation and stale proposals never mutate the map',async({page})=>{
 await boot(page);const initial=await page.evaluate(()=>{const a=neuroMapApp;window.nmProduct.guard=()=>false;window.calls=0;a.aiClient.chat=async()=>{calls++;return '[]'};GlaukaIllustrations.open(a);return JSON.stringify(a.state.root)});await page.locator('#gl-ai-illustration-start').click();expect(await page.evaluate(()=>calls)).toBe(0);expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(initial);
 await page.evaluate(()=>{nmProduct.guard=()=>true;neuroMapApp.aiClient.chat=()=>new Promise(resolve=>window.resolveIllustration=resolve)});await page.locator('#gl-ai-illustration-start').click();await expect.poll(()=>page.evaluate(()=>typeof window.resolveIllustration)).toBe('function');await page.locator('#gl-ai-illustrations-close').click();await page.evaluate(()=>resolveIllustration(JSON.stringify([{node:neuroMapApp.state.root.id,asset:'brain'}])));expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(initial);
});
test('context menu fits a short window and remains scrollable as sections expand',async({page})=>{
 await boot(page);await page.setViewportSize({width:900,height:430});await page.evaluate(()=>{const a=neuroMapApp,n=a.state.root.children[0];a.showContextMenu(890,420,{type:'node',item:n});});const menu=page.locator('#context-menu');
 for(const summary of await menu.locator('summary').all()){await summary.evaluate(e=>{e.parentElement.open=true;});}
 await expect.poll(async()=>{const r=await menu.boundingBox();return r.y+r.height}).toBeLessThanOrEqual(430-6);await expect(menu).toHaveCSS('overflow-y','auto');const before=await menu.evaluate(e=>e.scrollTop);await menu.hover();await page.mouse.wheel(0,600);await expect.poll(()=>menu.evaluate(e=>e.scrollTop)).toBeGreaterThan(before);await menu.getByRole('button',{name:/Elimina/}).last().scrollIntoViewIfNeeded();
});
test('image copy uses the native PNG bridge when browser clipboard is unavailable',async({page})=>{
 await boot(page);const result=await page.evaluate(async()=>{const calls=[];window.neuromapDesktop={writeClipboardPNG:async data=>calls.push(data)};const blob=new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'});await NeuroMapDesktopWorkflow.clipboard.writePNG(Promise.resolve(blob));return calls});expect(result).toEqual(['iVBORw==']);
});
test('icon completion respects the selected branch and existing artwork',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>{const a=neuroMapApp,b=a.state.root.children[0];for(const n of a.state.getAllNodes()){n.objectArt=null;n.illustration=null;}b.children[0].objectArt={id:'brain',size:100};a.selectNode(b.id);a.markChanged();nmProduct.guard=()=>true;a.aiClient.chat=async(_s,input)=>JSON.stringify(JSON.parse(input).topics.map(n=>({node:n.id,asset:'flat-idea'})));GlaukaIllustrations.open(a);return {branch:b.id,existing:b.children[0].id,other:a.state.root.children[1].id};});
 const modal=page.locator('#gl-ai-illustrations');await modal.getByRole('combobox',{name:'Dove aggiungere le immagini'}).selectOption('branch');await modal.getByRole('combobox',{name:'Come mostrarle'}).selectOption('icon');await modal.getByRole('combobox',{name:'Come applicarle'}).selectOption('all');await modal.locator('#gl-ai-illustration-start').click();await expect(modal.getByRole('status')).toContainText('Immagini aggiunte');
 const result=await page.evaluate(ids=>{const a=neuroMapApp;return {icon:a.state.findNode(ids.branch).illustration?.name,existing:a.state.findNode(ids.existing).objectArt,other:a.state.findNode(ids.other).illustration}},before);expect(result.icon).toBe('flat-idea');expect(result.existing).toEqual({id:'brain',size:100});expect(result.other).toBeNull();
});
test('a real SVG image is converted to PNG and sent to native clipboard',async({page})=>{
 await boot(page);await page.evaluate(()=>{const a=neuroMapApp;window.copiedPNG=null;window.neuromapDesktop={writeClipboardPNG:async data=>{window.copiedPNG=data}};const g=NeuroMapCreativeCore.graphic({kind:'shape',tool:'ellipse',width:64,height:64,color:'#6441df',fill:'#ccbbff'});NeuroMapCreative.addGraphic(a,NeuroMapCreativeCore.shapeSVG(g),64,64,g);a.copySelection();});await expect.poll(()=>page.evaluate(()=>window.copiedPNG?.slice(0,12))).toBe('iVBORw0KGgoA');
});
