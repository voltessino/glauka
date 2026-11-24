const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(`${platform}: live editing invalidates label measurements without changing the saved node`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmFormatRefresh);
 const before=await page.evaluate(async()=>{
  await document.fonts.ready;const a=neuroMapApp;a.importHierarchy({text:'Draft',children:[{text:'Saved',children:[]}]},{newTab:true});
  a.selectNode(a.state.root.children[0].id);a.editSelected();
  return{height:a.layout.getLayout(a.editorNodeId).height,history:a.state.undoStack.length};
 });
 const input=page.locator('#inline-editor-input');await input.fill('Long draft\nSecond line\nThird line\nFourth line');
 expect(await page.evaluate(()=>neuroMapApp.layout.getLayout(neuroMapApp.editorNodeId).height)).toBeGreaterThan(before.height);
 expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('Saved');
 expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(before.history);
 await input.press('Escape');
 expect(await page.evaluate(()=>neuroMapApp.layout.getLayout(neuroMapApp.state.root.children[0].id).height)).toBe(before.height);
 expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('Saved');
 await page.evaluate(()=>neuroMapApp.editSelected());await input.fill('Committed\nSecond line');await input.press('Enter');
 expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('Committed\nSecond line');
 await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('Saved');
 await page.evaluate(()=>neuroMapApp.redo());expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].text)).toBe('Committed\nSecond line');
});
