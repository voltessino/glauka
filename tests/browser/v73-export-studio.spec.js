const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 7.3 offline exports',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmShare73&&window.NeuroMapShareHTML&&window.NeuroMapTaskCalendar);
  await page.evaluate(()=>{
   window.__exported=[];
   neuroMapApp.io.triggerDownload=async(blob,filename)=>window.__exported.push({filename,text:await blob.text()});
  });
 });
 test('HTML read-only export omits notes and links until user opts in',async({page})=>{
  await page.evaluate(()=>{
   const n=neuroMapApp.state.root;n.notes='PRIVATE TEST NOTES';n.linkUrl='https://example.net/document';
   neuroMapApp._nmShare73.open();
  });
  const modal=page.locator('#nm-v73-share');
  await modal.getByRole('button',{name:'Esporta HTML navigabile'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__exported.length)).toBe(1);
  const first=await page.evaluate(()=>window.__exported[0]);
  expect(first.filename).toMatch(/\.html$/);
  expect(first.text).not.toContain('PRIVATE TEST NOTES');
  expect(first.text).not.toContain('https://example.net/document');
  await modal.locator('.nm-v73-group input[type=checkbox]').nth(0).check();
  await modal.locator('.nm-v73-group input[type=checkbox]').nth(1).check();
  await modal.getByRole('button',{name:'Esporta HTML navigabile'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__exported.length)).toBe(2);
  const second=await page.evaluate(()=>window.__exported[1]);
  expect(second.text).toContain('PRIVATE TEST NOTES');
  expect(second.text).toContain('https://example.net/document');
 });
 test('calendar export respects task dates and does not edit the map',async({page})=>{
  await page.evaluate(()=>{
   const app=neuroMapApp,node=app.state.root.children[0];
   node.startDate='2026-10-23';node.dueDate='2026-10-25';node.taskStatus='doing';
   window.__beforeExport=JSON.stringify(app.state.root);
   app._nmShare73.open();
  });
  const modal=page.locator('#nm-v73-share');
  await expect(modal).toContainText('Attività con data: 1');
  await modal.getByRole('button',{name:'Esporta calendario .ics'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__exported.length)).toBe(1);
  const out=await page.evaluate(()=>window.__exported[0]);
  expect(out.filename).toMatch(/\.ics$/);
  expect(out.text).toContain('DTSTART;VALUE=DATE:20261023');
  expect(out.text).toContain('DTEND;VALUE=DATE:20261026');
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(await page.evaluate(()=>window.__beforeExport));
 });
 test('generated HTML can navigate locally without downloading scripts',async({page})=>{
  const portable=await page.evaluate(()=>{
   return NeuroMapShareHTML.render({
    id:'root',text:'Anatomy',children:[
     {id:'heart',text:'Heart',children:[{id:'aorta',text:'Aorta',children:[]}]},
     {id:'kidney',text:'Kidney',children:[]}
    ]
   });
  });
  await page.setContent(portable);
  await expect(page.locator('#heading')).toHaveText('Anatomy');
  await expect(page.locator('#tree li.item')).toHaveCount(4);
  await page.locator('#query').fill('Aorta');
  await expect(page.locator('#notice')).toContainText('1 matching');
  await expect(page.locator('li.item:not([hidden])')).toHaveCount(3);
 });

});
