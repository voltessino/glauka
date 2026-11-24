const {test,expect}=require('@playwright/test');
const {pdfFixture}=require('./pdfjs-fixture');
const pdf=pdfFixture(2,{bookmarks:false,texts:['Classe I ferita pulita','Classe II pulito contaminata']});
test.describe('Source Lens 2.0 offline PDF text',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapPdfText&&window.NeuroMapSourceUI);
  await page.evaluate(()=>neuroMapApp._nmKnowledge.open('sources'));
 });
 test('reads local pages, searches, selects and records original provenance',async({page})=>{
  const panel=page.locator('#nm-knowledge-panel');
  await panel.locator('.nm-source-form input[type="file"]').setInputFiles({
   name:'local-evidence.pdf',mimeType:'application/pdf',buffer:pdf
  });
  await panel.getByRole('button',{name:'Leggi testo del PDF sul dispositivo'}).click();
  await expect(panel.locator('.nm-sl2 textarea')).toHaveValue(/Classe I ferita pulita/);
  await panel.locator('.nm-sl2 input[type="search"]').fill('contaminata');
  await panel.getByRole('button',{name:'Pag. 2'}).click();
  await expect(panel.locator('.nm-sl2 textarea')).toHaveValue(/Classe II pulito contaminata/);
  await panel.locator('.nm-sl2 textarea').evaluate(x=>{x.focus();x.setSelectionRange(0,28)});
  await panel.getByRole('button',{name:'Usa selezione come citazione'}).click();
  await expect(panel.locator('.nm-source-form input[type="number"]')).toHaveValue('2');
  await expect(panel.locator('.nm-source-form label textarea')).toHaveValue(/Classe II pulito contaminata/);
  await panel.getByRole('button',{name:'Collega fonte al nodo'}).click();
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.sourceRefs?.length||0)).toBe(1);
  expect(await page.evaluate(()=>neuroMapApp.state.root.sourceRefs[0])).toMatchObject({
   kind:'pdf',fileName:'local-evidence.pdf',page:2,quote:'Classe II pulito contaminata'
  });
  await page.evaluate(()=>neuroMapApp.undo());
  expect(await page.evaluate(()=>neuroMapApp.state.root.sourceRefs||[])).toEqual([]);
 });
 test('preserves manual citation when extraction is unavailable',async({page})=>{
  const panel=page.locator('#nm-knowledge-panel');
  await panel.locator('.nm-source-form input[type="file"]').setInputFiles({
   name:'short.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n%%EOF')
  });
  await panel.getByRole('button',{name:'Leggi testo del PDF sul dispositivo'}).click();
  await expect(panel.locator('.nm-sl2 [role="status"]')).toContainText('Testo non disponibile');
  await panel.locator('.nm-source-form input[type="number"]').fill('1');
  await panel.locator('.nm-source-form label textarea').fill('Manual page-confirmed excerpt.');
  await panel.getByRole('button',{name:'Collega fonte al nodo'}).click();
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.sourceRefs?.length||0)).toBe(1);
 });
});
