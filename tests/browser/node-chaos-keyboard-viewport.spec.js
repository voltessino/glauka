'use strict';
// Chromium UI acceptance scenarios: runs locally with npm run test:browser.
// These require Playwright + the served desktop/Android UIs, not GitHub Actions.
const {test,expect}=require('@playwright/test');
async function boot(page,platform){
 await page.setViewportSize({width:1280,height:900});
 await page.goto(platform==='android'
  ?'http://127.0.0.1:5173/app/index.html'
  :'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.io&&window.neuroMapApp?.state);
 await page.evaluate(()=>{
  document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden'));
 });
}
for(const platform of ['desktop','android'])test.describe(platform+' keyboard/viewport chaos',()=>{
 test.beforeEach(async({page})=>boot(page,platform));
 test('Ctrl-multiselect then Delete preserves attachments inside unrelated collapsed branches',async({page})=>{
  const before=await page.evaluate(()=>{
   const a=window.neuroMapApp;
   a.importHierarchy({text:'Chaos test',children:[
    {text:'Hidden branch',children:[{text:'Hidden picture target',children:[]}]},
    {text:'Delete A',children:[{text:'A child',children:[]}]},
    {text:'Delete B',children:[]}
   ]},{newTab:true});
   const [closed,first,second]=a.state.root.children;
   const hidden=closed.children[0];
   a.state.addImageItem({id:'chaos-photo',src:'data:image/png;base64,AAAA',
    mode:'attached',attachedNodeId:hidden.id});
   a.state.addRelationship(a.state.root.id,hidden.id,'Keep hidden connection');
   closed.collapsed=true;
   a.recalculateAndRender();
   a.selectNode(first.id);
   a.selectNode(second.id,'toggle');
   window.__chaosIDs={hidden:hidden.id,first:first.id,second:second.id};
   return a.state.createSnapshot();
  });
  await page.locator('#mindmap-canvas').focus();
  await page.keyboard.press('Delete');
  const after=await page.evaluate(()=>{
   const a=window.neuroMapApp,{hidden,first,second}=window.__chaosIDs;
   return {hidden:!!a.state.findNode(hidden),first:!!a.state.findNode(first),
    second:!!a.state.findNode(second),
    image:a.state.images.some(i=>i.id==='chaos-photo'&&i.attachedNodeId===hidden),
    link:a.state.relationships.some(r=>r.toId===hidden)};
  });
  expect(after).toEqual({hidden:true,first:false,second:false,image:true,link:true});
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(before);
  await page.keyboard.press('Control+y');
  expect(await page.evaluate(()=>window.neuroMapApp.state.findNode(window.__chaosIDs.hidden)!=null)).toBe(true);
 });
 test('repeated Tab/Enter, Undo/Redo, mode changes, keyboard zoom and resize keep nodes intact',async({page})=>{
  const starting=await page.evaluate(()=>{
   const a=window.neuroMapApp;
   a.importHierarchy({text:'Stress',children:[
    {text:'Start',children:[]},{text:'Right',children:[]}
   ]},{newTab:true});
   a.selectNode(a.state.root.children[0].id);
   return a.state.getAllNodesIncludingCollapsed().length;
  });
  for(let i=0;i<12;i++){
   await page.locator('#mindmap-canvas').focus();
   await page.keyboard.press('Tab');
   const editing=page.locator('#inline-editor-input');
   await expect(editing).toBeVisible();
   await editing.fill('Quick edit '+i);
   await editing.press('Enter');
  }
  await page.locator('#mindmap-canvas').focus();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  for(let n=0;n<12;n++)await page.keyboard.press('=');
  for(let n=0;n<12;n++)await page.keyboard.press('-');
  for(const mode of ['clockwise','balanced','fluid','columns','right','left']){
   await page.evaluate(mode=>{
    const a=window.neuroMapApp;
    a.state.root.layoutMode=mode;
    if(mode==='balanced')a.state.root.layoutBalanceMode='geometry';
    a.recalculateAndRender();
   },mode);
   for(const viewport of [{width:1280,height:900},{width:650,height:650}]){
    await page.setViewportSize(viewport);
    const state=await page.evaluate(()=>{
     const a=window.neuroMapApp,ids=a.state.getAllNodesIncludingCollapsed().map(n=>n.id);
     const camera=a.renderer.camera;
     return {count:ids.length,unique:new Set(ids).size,
      camera:[camera.x,camera.y,camera.zoom].every(Number.isFinite),
      layout:[...a.layout.nodeLayoutMap.values()].every(m=>Number.isFinite(m.x)&&Number.isFinite(m.y))};
    });
    expect(state.count).toBeGreaterThanOrEqual(starting+11);
    expect(state.unique).toBe(state.count);
    expect(state.camera).toBe(true);
    expect(state.layout).toBe(true);
   }
  }
 });
});
