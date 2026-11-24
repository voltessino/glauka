const {test,expect}=require('@playwright/test');
for(const platform of ['android','desktop']){
 async function boot(page){
  await page.setViewportSize({width:platform==='android'?393:1280,height:852});
  await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapCreative);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
 }
 test(platform+' composition Enter/Escape does not commit or cancel the node draft',async({page})=>{
  await boot(page);const original=await page.evaluate(()=>{const a=neuroMapApp,n=a.state.root.children[0];a.selectNode(n.id);a.editSelected();return {id:n.id,text:n.text};});
  const field=page.locator('#inline-editor-input');await field.fill('学习计划');
  for(const properties of [{key:'Enter',isComposing:true},{key:'Enter',keyCode:229},{key:'Escape',isComposing:true}]){
   await field.evaluate((el,p)=>el.dispatchEvent(new KeyboardEvent('keydown',{...p,bubbles:true,cancelable:true})),properties);
   expect(await page.evaluate(()=>neuroMapApp.editorNodeId)).toBe(original.id);
   expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,original.id)).toBe(original.text);
   await expect(field).toHaveValue('学习计划');
  }
  await field.press('Enter');expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,original.id)).toBe('学习计划');
  await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,original.id)).toBe(original.text);
 });
 test(platform+' composition events on the canvas never create or delete branches',async({page})=>{
  await boot(page);
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.locator('canvas').first().evaluate(el=>{
   for(const key of ['Enter','Tab','Backspace','Delete','a'])el.dispatchEvent(new KeyboardEvent('keydown',{key,isComposing:true,bubbles:true,cancelable:true}));
  });
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
 });
}
