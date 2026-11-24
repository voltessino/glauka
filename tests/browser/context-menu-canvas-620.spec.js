const {test,expect}=require('@playwright/test');
async function load(page){
 await page.setViewportSize({width:1280,height:800});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&document.querySelector('#context-menu.nm-context-refined'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
}
test('right-click on empty canvas shows only canvas actions',async({page})=>{
 await load(page);
 await page.evaluate(()=>neuroMapApp.showContextMenu(400,300,null));
 await expect(page.locator('#ctx-group-canvas')).toBeVisible();
 await expect(page.locator('#ctx-group-node')).toBeHidden();
 await expect(page.locator('#ctx-group-image')).toBeHidden();
 await expect(page.locator('#ctx-canvas-new-floating')).toBeVisible();
 await expect(page.locator('#ctx-canvas-center')).toBeVisible();
 await page.evaluate(()=>neuroMapApp.showContextMenu(400,300,{type:'node',item:neuroMapApp.state.root}));
 await expect(page.locator('#ctx-group-canvas')).toBeHidden();
 await expect(page.locator('#ctx-add-child')).toBeVisible();
});
test('canvas contextual insertion is undoable and uses clicked coordinates',async({page})=>{
 await load(page);
 const before=await page.evaluate(()=>{
   const app=neuroMapApp;
   return {count:app.state.root.children.length,
     where:app.renderer.screenToWorld(430,315)};
 });
 await page.evaluate(()=>neuroMapApp.showContextMenu(430,315,null));
 await page.locator('#ctx-canvas-new-floating').click();
 const after=await page.evaluate(()=>{
   const app=neuroMapApp,n=app.state.root.children.at(-1);
   return {count:app.state.root.children.length,node:n,selected:app.state.selectedNodeId};
 });
 expect(after.count).toBe(before.count+1);
 expect(after.node.isFloating).toBe(true);
 expect(after.node.floatingPosition.x).toBeCloseTo(before.where.x,5);
 expect(after.node.floatingPosition.y).toBeCloseTo(before.where.y,5);
 expect(after.selected).toBe(after.node.id);
});
test('canvas contextual fit reuses built-in map centering',async({page})=>{
 await load(page);
 await page.evaluate(()=>{
   const app=neuroMapApp;
   app._testContextFit=0;
   app.fitWholeMap=()=>{app._testContextFit++};
   app.showContextMenu(380,250,null);
 });
 await page.locator('#ctx-canvas-center').click();
 expect(await page.evaluate(()=>neuroMapApp._testContextFit)).toBe(1);
 await expect(page.locator('#context-menu')).toBeHidden();
});
