const {test,expect}=require('@playwright/test');
const {pdfFixture}=require('./pdfjs-fixture');
test.describe('NeuroMap preview-first document import',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmDocumentImport&&window.NeuroMapDocumentImport);
 });
 test('TXT proposal does not change map until confirmation; Undo is atomic',async({page})=>{
  const before=await page.evaluate(()=>neuroMapApp.state.root.children.length);
  await page.evaluate(()=>neuroMapApp._nmDocumentImport.open());
  const dialog=page.locator('#nm-doc-import');
  await dialog.locator('input[type=file]').setInputFiles({
   name:'Anatomy.txt',mimeType:'text/plain',buffer:Buffer.from('Heart\n\nKidney')
  });
  await expect(dialog.locator('.nm-di-preview')).toContainText('Heart');
  expect(await page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before);
  await dialog.getByRole('button',{name:'Aggiungi alla mappa'}).click();
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before+1);
  expect(await page.evaluate(()=>neuroMapApp.state.root.children.at(-1).children.map(x=>x.text))).toEqual(['Heart','Kidney']);
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before);
 });
 test('PDF preview requires explicit verification before adding source-backed nodes',async({page})=>{
  const pdf=pdfFixture(1,{bookmarks:false,texts:['Verified passage']});
  const before=await page.evaluate(()=>neuroMapApp.state.root.children.length);
  await page.evaluate(()=>neuroMapApp._nmDocumentImport.open());
  const dialog=page.locator('#nm-doc-import');
  await dialog.locator('input[type=file]').setInputFiles({name:'Paper.pdf',mimeType:'application/pdf',buffer:pdf});
  const apply=dialog.getByRole('button',{name:'Aggiungi alla mappa'});
  await expect(dialog.locator('.nm-di-preview')).toContainText('Pagina 1');
  await expect(apply).toBeDisabled();
  await dialog.locator('input[type=checkbox]').check();
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before+1);
  const citations=await page.evaluate(()=>neuroMapApp.state.root.children.at(-1).children[0].sourceRefs||[]);
  expect(citations[0]).toMatchObject({page:1,fileName:'Paper.pdf',quote:'Verified passage'});
  expect(citations[0].sha256).toMatch(/^[a-f0-9]{64}$/);
 });
});
