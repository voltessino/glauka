const {test,expect}=require('@playwright/test');
const {pdfFixture}=require('./pdfjs-fixture');

test.describe('Offline PDF.js document analysis on desktop',()=>{
 test('real PDF.js handles a 200-page local PDF, preserves citations, groups true bookmarks, without HTTP uploads',async({page})=>{
  test.setTimeout(120000);
  const fetched=[];
  page.on('request',req=>fetched.push(req.url()));
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.NeuroMapPdfJs&&window.NeuroMapDocumentImport);
  const doc=pdfFixture(200);
  const result=await page.evaluate(async raw=>{
   const file=new File([new Uint8Array(raw)],'anatomy.pdf',{type:'application/pdf'});
   const inspected=await NeuroMapPdfJs.inspect(file);
   const proposed=await NeuroMapDocumentImport.preview(file);
   const first=proposed.root.children[0];
   return {engine:inspected.engine,pages:inspected.pages.length,last:inspected.pages[199].text,
    bookmarks:inspected.outline.map(x=>x.page),nodes:proposed.count,
    firstTitle:first.text,hasCitation:!!(first.sourceRefs?.length||
      first.children?.some(x=>x.sourceRefs?.length))};
  },Array.from(doc));
  expect(result.engine).toBe('PDF.js 6.4.299');
  expect(result.pages).toBe(200);
  expect(result.last).toContain('Page 200');
  expect(result.bookmarks).toEqual([1,101]);
  expect(result.nodes).toBeGreaterThanOrEqual(201);
  expect(result.nodes).toBeLessThanOrEqual(250);
  expect(result.hasCitation).toBe(true);
  expect(fetched.filter(x=>!x.startsWith('http://127.0.0.1:5174/'))).toEqual([]);
 });
 test('a PDF without text does not claim that OCR happened',async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.NeuroMapPdfJs);
  const report=await page.evaluate(async()=>{
   const file=new File([new Uint8Array([37,80,68,70,45,10,0,0])],'invalid.pdf',{type:'application/pdf'});
   try{await NeuroMapPdfJs.inspect(file);return {accepted:true}}
   catch(error){return {accepted:false,message:String(error?.message||error)}}
  });
  expect(report.accepted).toBe(false);
 });
});
