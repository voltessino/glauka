const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const urls={desktop:process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html',android:process.env.GLAUKA_ANDROID_TEST_URL||'http://127.0.0.1:5173/app/index.html'};
async function open(page,platform){
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(urls[platform]);await page.waitForFunction(()=>window.neuroMapApp?.nmDragCommit);
 await page.evaluate(()=>{window.NeuroMapHome?.close();document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'))});
}
async function seed(page,{count=3,mode='balanced',side='right',nested=false}={}){
 return page.evaluate(({count,mode,side,nested})=>{
  const a=neuroMapApp;a.importHierarchy({text:'Multi drag',children:[
   {text:'Source parent',children:Array.from({length:count},(_,i)=>({text:'Branch '+i,children:[{text:'Hidden child '+i,children:[]}]}))},
   {text:'Destination parent',children:[{text:'Target',children:[{text:'Original child',children:[]}]}]}
  ]},{newTab:true});
  a.state.root.layoutMode=mode;a.state.root.layoutDistribution={enabled:false};
  const [p,q]=a.state.root.children;p.sidePinned=side;q.sidePinned=side==='left'?'right':'left';
  const roots=p.children,target=q.children[0];roots[0].collapsed=true;target.collapsed=true;
  roots.forEach((n,i)=>n.notes='Preserve notes '+i);
  a.state.relationships=[{id:'kept-edge',fromId:roots[0].children[0].id,toId:target.id,label:'Preserve link'}];
  a.state.images=[{id:'kept-image',src:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="purple"/></svg>'),mode:'attached',attachedNodeId:roots[0].children[0].id,width:32,height:32}];
  a.state.images=a.state.constructor.cloneImages(a.state.images);
  a.recalculateAndRender();a.fitToScreen();a.renderer.camera.zoom=Math.min(a.renderer.camera.zoom,.8);a.requestRender();
  a.state.selectedNodeIds=roots.map(n=>n.id);if(nested)a.state.selectedNodeIds.push(roots[0].children[0].id);
  a.state.selectedNodeId=roots[1].id;a.selectionAnchorId=roots[0].id;a.canvas.focus();a.requestRender();
  return {roots:roots.map(n=>n.id),source:roots[1].id,target:target.id,parent:p.id,destParent:q.id,root:a.state.root.id,child:roots[0].children[0].id};
 },{count,mode,side,nested});
}
async function point(page,id){return page.evaluate(id=>{const a=neuroMapApp;let m=a.layout.getLayout(id);if(!m){const view=[...a.layout.viewNodes.values()].find(n=>(n.logicalId||n.id)===id);m=view&&a.layout.getLayout(view.id)}return a.renderer.worldToScreen(m.x,m.y)},id)}
const snapshot=page=>page.evaluate(()=>JSON.parse(JSON.stringify(neuroMapApp.state.createSnapshot())));
async function start(page,ids,{alt=true}={}){
 const from=await point(page,ids.source),to=await point(page,ids.target);
 if(alt)await page.keyboard.down('Alt');await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});return to;
}
for(const platform of ['desktop','android']){
 for(const [mode,count,side]of [['balanced',2,'left'],['balanced',10,'right'],['clockwise',3,'left'],['fluid',3,'right']]){
  test(`${platform} ${mode} ${count} roots ${side}: real grouped drag, undo/redo and saved project`,async({page},info)=>{
   await open(page,platform);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const ids=await seed(page,{count,mode,side,nested:true}),before=await snapshot(page),history=await page.evaluate(()=>neuroMapApp.state.undoStack.length);
   await start(page,ids);
   await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-count',String(count));
   const language=await page.locator('html').getAttribute('lang');
   await expect(page.locator('#nm-drag-status')).toContainText(String(count)+(language==='en'?' branches':' rami'));
   const preview=await page.evaluate(()=>{const a=neuroMapApp,p=a._nmDragPreview;return {ids:p.nodeIds,parents:p.nodeIds.map(id=>p.state.findNode(id).parentId),live:a.state.selectedNodeIds,images:p.state.images.map(i=>i.id)}});
   expect(preview.ids).toEqual(ids.roots);expect(preview.parents).toEqual(ids.roots.map(()=>ids.target));
   expect(preview.images).toContain('kept-image');expect(await snapshot(page)).toEqual(before);
   if(platform==='desktop'&&mode==='balanced'&&count===2)await page.screenshot({path:info.outputPath('group-preview.png')});
   await page.mouse.up();await page.keyboard.up('Alt');await expect(page.locator('#nm-drag-preview')).toHaveCount(0);
   expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(history+1);
   const moved=await page.evaluate(({target,parent})=>{const a=neuroMapApp;return {children:a.state.findNode(target).children.map(n=>n.id),old:a.state.findNode(parent).children.length,collapsed:a.state.findNode(target).collapsed,selected:a.state.selectedNodeIds}},ids);
   expect(moved.children.slice(1)).toEqual(ids.roots);expect(moved.old).toBe(0);expect(moved.collapsed).toBe(false);expect(moved.selected).toEqual(ids.roots);
   const after=await snapshot(page);expect(after.images).toEqual(before.images);expect(after.relationships).toEqual(before.relationships);
   await page.evaluate(()=>neuroMapApp.undo());expect(await snapshot(page)).toEqual(before);
   await page.evaluate(()=>neuroMapApp.redo());expect(await snapshot(page)).toEqual(after);
   let savedBytes=null;
   if(platform==='desktop'&&count===2){
    const pending=page.waitForEvent('download');await page.evaluate(()=>neuroMapApp.io.exportJSON());const download=await pending;
    await download.saveAs(info.outputPath('multi-drag.json'));savedBytes=fs.readFileSync(await download.path(),'utf8');
    expect(JSON.parse(savedBytes).root).toEqual(after.root);
   }
   const roundtrip=await page.evaluate(async savedBytes=>{const a=neuroMapApp,bytes=savedBytes||JSON.stringify(a.io.buildSerializedProjectPayload());await a.importFiles([new File([bytes],'multi-drag.gk',{type:'application/json'})],true);return JSON.parse(JSON.stringify(a.state.createSnapshot()))},savedBytes);
   expect(roundtrip.root).toEqual(after.root);expect(roundtrip.images).toEqual(after.images);expect(roundtrip.relationships).toEqual(after.relationships);expect(errors).toEqual([]);
  });
 }
 for(const mode of ['balanced','clockwise','fluid'])test(`${platform} ${mode}: unmodified drag reorders across sides and promotes a group`,async({page})=>{
  await open(page,platform);const ids=await seed(page,{mode,side:'left'});
  let from=await point(page,ids.source),to=await point(page,ids.target);
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeIds)).toEqual(ids.roots);
  await page.mouse.move(to.x,to.y+15,{steps:10});
  await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-intent','place');
  await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-parent-id',ids.destParent);
  await page.mouse.up();
  expect(await page.evaluate(ids=>ids.map(id=>neuroMapApp.state.findNode(id).parentId),ids.roots)).toEqual(ids.roots.map(()=>ids.destParent));
  from=await point(page,ids.source);to=await point(page,ids.destParent);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});
  await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-parent-id',ids.root);
  await page.mouse.up();
  expect(await page.evaluate(ids=>ids.map(id=>neuroMapApp.state.findNode(id).parentId),ids.roots)).toEqual(ids.roots.map(()=>ids.root));
  expect(await page.evaluate(ids=>neuroMapApp.state.root.children.filter(n=>ids.includes(n.id)).map(n=>n.id),ids.roots)).toEqual(ids.roots);
 });
 test(`${platform}: root landing preview follows the latest pointer and matches commit`,async({page})=>{
  await open(page,platform);const ids=await seed(page,{mode:'balanced',side:'left'}),from=await point(page,ids.source),to=await point(page,ids.destParent);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});
  await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-parent-id',ids.root);
  const first=await page.evaluate(()=>{const a=neuroMapApp;return a._nmDragPreview.layout.getLayout(a._v5Candidate.nodeId).y});
  await page.mouse.move(to.x,to.y+12,{steps:4});
  await expect.poll(()=>page.evaluate(()=>{const a=neuroMapApp;return a._nmDragPreview.layout.getLayout(a._v5Candidate.nodeId).y})).not.toBe(first);
  const projected=await page.evaluate(ids=>ids.map(id=>{const m=neuroMapApp._nmDragPreview.layout.getLayout(id);return {x:m.x,y:m.y}}),ids.roots);
  await page.mouse.up();
  const actual=await page.evaluate(ids=>ids.map(id=>{const a=neuroMapApp,m=a.layout.getLayout(id);return {x:m.x,y:m.y}}),ids.roots);
  actual.forEach((m,i)=>{expect(m.x).toBeCloseTo(projected[i].x,2);expect(m.y).toBeCloseTo(projected[i].y,2)});
 });
 test(`${platform}: grouped drag through clockwise visual continuations keeps canonical IDs`,async({page})=>{
  await open(page,platform);const ids=await seed(page,{mode:'clockwise',count:10});
  await page.evaluate(()=>{const a=neuroMapApp;a.state.root.layoutDistribution={enabled:true,height:180};a.recalculateAndRender();a.fitToScreen()});
  expect(await page.evaluate(()=>!!neuroMapApp.layout.presentationRoot)).toBe(true);
  expect(await page.evaluate(()=>neuroMapApp.layout.continuationPlan.pages.length)).toBeGreaterThan(1);
  const before=await snapshot(page);await start(page,ids);await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-count','10');
  expect(await snapshot(page)).toEqual(before);await page.mouse.up();await page.keyboard.up('Alt');
  expect(await page.evaluate(ids=>ids.map(id=>neuroMapApp.state.findNode(id).parentId),ids.roots)).toEqual(ids.roots.map(()=>ids.target));
  const saved=await page.evaluate(()=>JSON.stringify(neuroMapApp.io.buildSerializedProjectPayload()));expect(saved).not.toMatch(/nm-view:|nm-root:/);
  await page.evaluate(()=>neuroMapApp.undo());expect(await snapshot(page)).toEqual(before);
 });
 test(`${platform}: native import retains safe IDs and rejects duplicate or unsafe IDs`,async({page})=>{
  await open(page,platform);
  const result=await page.evaluate(async()=>{
   const a=neuroMapApp,payload={schema:'NeuroMapArchitect-SingleTab-v6',root:{id:'safe_root',text:'Native ID validation',children:[{id:'safe_child',text:'Keep',colorIndex:3,children:[]},{id:'safe_child',text:'Duplicate',children:[]},{id:'<unsafe>',text:'Unsafe',children:[]}]}};
   await a.importFiles([new File([JSON.stringify(payload)],'native.gk')],true);
   const nodes=a.state.getAllNodesIncludingCollapsed();return {root:a.state.root.id,first:a.state.root.children[0].id,colorIndex:a.state.root.children[0].colorIndex,ids:nodes.map(n=>n.id),parents:a.state.root.children.map(n=>n.parentId)};
  });
  expect(result.root).toBe('safe_root');expect(result.first).toBe('safe_child');expect(result.colorIndex).toBe(3);expect(new Set(result.ids).size).toBe(4);expect(result.ids).not.toContain('<unsafe>');expect(result.parents).toEqual(['safe_root','safe_root','safe_root']);
 });
 for(const cancel of ['Escape','pointercancel','invalid-descendant','tab-switch'])test(`${platform}: ${cancel} preserves the multi-selection and tree`,async({page})=>{
  await open(page,platform);const ids=await seed(page),before=await snapshot(page),history=await page.evaluate(()=>neuroMapApp.state.undoStack.length);
  await start(page,ids);
  await expect(page.locator('#nm-drag-preview')).toHaveAttribute('data-count','3');
  if(cancel==='Escape')await page.keyboard.press('Escape');
  if(cancel==='pointercancel')await page.evaluate(()=>{const a=neuroMapApp;a.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:a._v5Candidate.pointerId,bubbles:true}))});
  if(cancel==='invalid-descendant'){const p=await point(page,ids.roots[0]);await page.mouse.move(p.x,p.y,{steps:4});}
  if(cancel==='tab-switch')await page.evaluate(()=>{const a=neuroMapApp;window.__dragOldState=a.state;a.importHierarchy({text:'Other tab',children:[]},{newTab:true})});
  await page.mouse.up();await page.keyboard.up('Alt');await expect(page.locator('#nm-drag-preview')).toHaveCount(0);
  if(cancel==='tab-switch'){
   expect(await page.evaluate(()=>JSON.parse(JSON.stringify(__dragOldState.createSnapshot())))).toEqual(before);
   expect(await page.evaluate(()=>__dragOldState.undoStack.length)).toBe(history);
  }else{expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(history);}
 });
 for(const mode of ['balanced','clockwise','fluid'])test(`${platform}: Shift+arrows on left ${mode} preserve camera and text selection`,async({page})=>{
  await open(page,platform);await seed(page,{mode,side:'left'});
  const before=await page.evaluate(()=>{const a=neuroMapApp,p=a.state.root.children[0],ids=p.children.slice().sort((x,y)=>a.layout.getLayout(x.id).y-a.layout.getLayout(y.id).y).map(n=>n.id);a.selectNode(ids[0]);a.canvas.focus();return {ids,camera:{...a.renderer.camera}}});
  await page.keyboard.down('Shift');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeIds)).toEqual(before.ids);
  await page.keyboard.press('ArrowUp');await page.keyboard.up('Shift');expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeIds)).toEqual(before.ids.slice(0,2));
  expect(await page.evaluate(()=>({...neuroMapApp.renderer.camera}))).toEqual(before.camera);
 });
}
