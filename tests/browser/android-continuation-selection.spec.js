const {test,expect}=require('@playwright/test');
test('Android continuation copies show the canonical selected node without mutating the map',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('neuromap.motion.v1',JSON.stringify({branches:false,interface:false}))});
 await page.goto((process.env.GLAUKA_ANDROID_TEST_URL || 'http://127.0.0.1:5173/app/index.html'));await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
 const result=await page.evaluate(async()=>{
  const a=neuroMapApp;await document.fonts.ready;a.importHierarchy({text:'Select',children:[{text:'First',children:[]},{text:'Second',children:[]}]},{newTab:true});document.getElementById('nm-mode-clockwise').click();a.fitToScreen();
  if(!a.layout.presentationRoot)throw Error('Continuation not exercised');
  a.state.selectedNodeId=null;a.state.selectedNodeIds=[];a.renderer.render();const before=a.renderer.canvas.toDataURL(),tree=JSON.stringify(a.state.root),camera=JSON.stringify(a.renderer.camera);
  const id=a.state.root.children[0].id;a.selectNode(id);a.renderer.render();
  return{selected:a.state.selectedNodeId===id,changed:before!==a.renderer.canvas.toDataURL(),tree:tree===JSON.stringify(a.state.root),camera:camera===JSON.stringify(a.renderer.camera)};
 });
 expect(result).toEqual({selected:true,changed:true,tree:true,camera:true});
});
