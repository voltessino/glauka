const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 7.2 study features',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmVisualStudy&&window.neuroMapApp?._nmAnki);
 });
 test('hotspot is linked to node and survives image clone with Undo',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp;
   app.state.addImageItem({src:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="180"%3E%3Crect width="300" height="180" fill="blue"/%3E%3C/svg%3E',width:300,height:180},false);
   app._nmVisualStudy.open();
  });
  const dialog=page.locator('#nm-visual-study'),image=dialog.locator('img');
  await expect(image).toBeVisible();
  await image.click({position:{x:130,y:70}});
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images[0].studyHotspots?.length||0)).toBe(1);
  expect(await page.evaluate(()=>MindMapStateMachine.cloneImages(neuroMapApp.state.images)[0].studyHotspots.length)).toBe(1);
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.images[0].studyHotspots||[])).toEqual([]);
 });
 test('Anki import creates source-linked flashcards without altering map tree',async({page})=>{
  const before=await page.evaluate(()=>({children:neuroMapApp.state.root.children.length,cards:(neuroMapApp.studyCards||[]).length}));
  await page.evaluate(()=>neuroMapApp._nmAnki.open());
  const dialog=page.locator('#nm-anki');
  await dialog.locator('input[type=file]').setInputFiles({
   name:'cards.tsv',mimeType:'text/tab-separated-values',
   buffer:Buffer.from('#separator:tab\n#html:false\nFront\tBack\nQuestion A\tAnswer A\nQuestion B\tAnswer B\n')
  });
  await expect(dialog.getByRole('button',{name:'Importa sul nodo selezionato'})).toBeEnabled();
  await dialog.getByRole('button',{name:'Importa sul nodo selezionato'}).click();
  const after=await page.evaluate(()=>({children:neuroMapApp.state.root.children.length,cards:(neuroMapApp.studyCards||[]).length,
   last:neuroMapApp.studyCards.at(-1)}));
  expect(after.children).toBe(before.children);
  expect(after.cards).toBe(before.cards+2);
  expect(after.last.sourceTabId).toBeTruthy();
  expect(after.last.sourceNodeId).toBeTruthy();
 });
});
