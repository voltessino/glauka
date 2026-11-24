const {test,expect}=require('@playwright/test');
async function open(page,size={width:1280,height:800}){
 await page.setViewportSize(size);
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&document.querySelector('#context-menu.nm-context-refined'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
}
test('node context keeps quick actions, original IDs, and well-organized sections',async({page})=>{
 await open(page);
 await page.evaluate(()=>neuroMapApp.showContextMenu(220,240,{type:'node',item:neuroMapApp.state.root}));
 const menu=page.locator('#context-menu');
 await expect(menu).toBeVisible();
 await expect(menu.locator('#nm-context-primary-node > button')).toHaveCount(6);
 for(const id of ['ctx-add-child','ctx-add-sibling','ctx-edit-text','btn-ai-audit',
    'ctx-cut','ctx-copy','ctx-paste','ctx-toggle-boundary','ctx-delete-node','nm70-invert-all'])
  await expect(page.locator('#'+id)).toHaveCount(1);
 await expect(menu.locator('#nm-context-more-node')).not.toHaveAttribute('open','');
 await expect(page.locator('#ctx-add-child')).toBeVisible();
 const before=await page.evaluate(()=>neuroMapApp.state.root.children.length);
 await page.locator('#ctx-add-child').click();
 const after=await page.evaluate(()=>neuroMapApp.state.root.children.length);
 expect(after).toBeGreaterThan(before);
});
for(const width of [390,1280]){
 test('context stays inside viewport at '+width+'px and closes with Escape',async({page})=>{
  await open(page,{width,height:740});
  await page.evaluate(()=>neuroMapApp.showContextMenu(innerWidth-3,innerHeight-3,
   {type:'node',item:neuroMapApp.state.root}));
  const menu=page.locator('#context-menu');
  const box=await menu.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(box.y+box.height).toBeLessThanOrEqual(740);
  await menu.focus();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
 });
}
test('image actions retain their original unique selectors and order',async({page})=>{
 await open(page);
 const ids=await page.locator('#ctx-group-image button').evaluateAll(buttons=>buttons.map(b=>b.id));
 for(const id of ['ctx-img-toggle-mode','ctx-img-reset-aspect','ctx-img-toggle-zlayer','ctx-img-cut','ctx-img-copy','ctx-img-paste'])expect(ids.filter(value=>value===id)).toHaveLength(1);
 expect(await page.locator('#nm-context-primary-image > button').evaluateAll(bs=>bs.map(b=>b.id))).toEqual(['nm616-context-preview-image','ctx-img-copy','ctx-img-toggle-mode','ctx-img-delete']);
 await expect(page.locator('#ctx-img-delete')).toHaveCount(1);
});
