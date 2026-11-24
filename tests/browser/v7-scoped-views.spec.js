const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 7: non-destructive branch-scoped views',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1480,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapLinkedViews&&
   document.getElementById('nm-view-focus'));
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
  await page.locator('#v6-show-layout').click();
 });
 async function bigFixture(page){
  return page.evaluate(()=>{
   const app=window.neuroMapApp,state=app.state;
   const branch={id:state.generateId(),text:'Project subset',side:'right',children:[
    {id:state.generateId(),text:'Task A',taskStatus:'doing',startDate:'2026-10-25',dueDate:'2026-10-27',children:[]},
    {id:state.generateId(),text:'Task B',taskStatus:'done',startDate:'2026-10-29',dueDate:'2026-11-01',children:[]}
   ]};
   state.root.children=[branch,
    ...Array.from({length:2050},(_,i)=>({id:state.generateId(),text:'Unrelated '+i,side:'right',children:[]}))];
   state.selectedNodeId=branch.id;
   state.selectedNodeIds=[branch.id];
   state.undoStack=[];state.redoStack=[];
   app.recalculateAndRender();
   return {branchId:branch.id,baseCount:state.root.children.length,
    childIds:branch.children.map(x=>x.id),original:JSON.stringify(state.root)};
  });
 }
 test('can open organization chart of one small branch inside a huge project',async({page})=>{
  const baseline=await bigFixture(page);
  await page.locator('#nm-view-focus').click();
  await expect(page.locator('#nm-view-focus')).toHaveAttribute('aria-pressed','true');
  await page.locator('#nm-view-picker-trigger').click();
  await page.locator('#nm-view-picker-gallery [data-view="orgchart"]').click();
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(3);
  await expect(page.locator('#nm-view-overlay-focus')).toHaveAttribute('aria-pressed','true');
  const result=await page.evaluate(()=>{
   const s=window.neuroMapApp.state;
   return {baseCount:s.root.children.length,ids:s.root.children[0].children.map(x=>x.id),
    undo:s.undoStack.length,root:JSON.stringify({...s.root,viewMode:undefined})};
  });
  expect(result.baseCount).toBe(baseline.baseCount);
  expect(result.ids).toEqual(baseline.childIds);
  expect(result.undo).toBe(1);
  expect(result.root).toBe(JSON.stringify({...JSON.parse(baseline.original),viewMode:undefined}));
 });
 test('refuses unsafe return to a full concept network without erasing its scope',async({page})=>{
  await bigFixture(page);
  await page.locator('#nm-view-focus').click();
  await page.locator('#nm-view-picker-trigger').click();
  await page.locator('#nm-view-picker-gallery [data-view="concept-network"]').click();
  await expect(page.locator('#nm-view-stage .nm-network-card')).toHaveCount(3);
  await page.locator('#nm-view-overlay-focus').click();
  await expect(page.locator('#nm-view-overlay-focus')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#nm-view-stage .nm-network-card')).toHaveCount(3);
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
 });
 test('scoped SVG exports identify branch-only content in their filename',async({page})=>{
  await bigFixture(page);
  await page.locator('#nm-view-focus').click();
  await page.locator('#nm-view-picker-trigger').click();
  await page.locator('#nm-view-picker-gallery [data-view="orgchart"]').click();
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(3);
  await page.evaluate(()=>{
   window._nmScopedExport=null;
   window.neuroMapApp.io.triggerDownload=(blob,name)=>{window._nmScopedExport=name;};
  });
  await page.locator('#nm-view-export-menu > summary').click();
  await page.locator('#nm-view-export-svg').click();
  expect(await page.evaluate(()=>window._nmScopedExport)).toMatch(/-branch-orgchart\.svg$/);
 });
});
