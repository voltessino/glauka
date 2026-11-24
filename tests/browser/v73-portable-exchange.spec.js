const {test,expect}=require('@playwright/test');
test.describe('7.3 portable exchange',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmExchange&&window.NeuroMapPortableExchange);
 });
 test('exports verifiable copy and verifies identical content without editing original',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp;
   window.__exports=[];
   app.io.triggerDownload=async(blob,name)=>window.__exports.push({name,text:await blob.text()});
   window.__original=JSON.stringify(app.state.root);
   app._nmExchange.open();
  });
  const modal=page.locator('#nm-exchange');
  await modal.getByRole('button',{name:'Esporta copia verificabile'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__exports.length)).toBe(1);
  const packet=await page.evaluate(()=>window.__exports[0]);
  expect(packet.name).toMatch(/-exchange\.json$/);
  expect(JSON.parse(packet.text).format).toBe('NeuroMapPortableExchange-v1');
  await modal.locator('input[type=file]').setInputFiles({
   name:'copy.json',mimeType:'application/json',buffer:Buffer.from(packet.text)
  });
  await expect(modal.locator('.nm-exchange-report')).toContainText('Contenuti identici');
  await expect(modal.getByRole('button',{name:'Apri come nuova scheda'})).toBeDisabled();
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(await page.evaluate(()=>window.__original));
 });
 test('refuses checksum-tampered copies before opening any tab',async({page})=>{
  const packet=await page.evaluate(()=>NeuroMapPortableExchange.create(neuroMapApp.io.buildSerializedProjectPayload()));
  packet.project.root.text='Other';
  await page.evaluate(()=>neuroMapApp._nmExchange.open());
  await page.locator('#nm-exchange input[type=file]').setInputFiles({
   name:'tampered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))
  });
  await expect(page.locator('#nm-exchange [role=status]')).toContainText('checksum');
  await expect(page.locator('#nm-exchange').getByRole('button',{name:'Apri come nuova scheda'})).toBeDisabled();
 });
});
