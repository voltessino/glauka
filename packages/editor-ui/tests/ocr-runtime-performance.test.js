'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/ocr-runtime.js'),'utf8');

function runtime({optimized=false,count=1,previewLength=25,images=false,text='Testo perfettamente leggibile con più di venti caratteri e numeri 123'}={}){
 const counter={renders:0,png:0,enhance:0,workers:0,recognized:0};
 const mockPage={
  view:[0,0,400,300],
  getTextContent:async()=>({items:[{str:text,transform:[12,0,0,12,20,250],width:300,height:12}]}),
  getOperatorList:async()=>({fnArray:images?[4]:[]}),
  getViewport:({scale})=>({width:400*scale,height:300*scale,transform:[scale,0,0,-scale,0,300*scale]}),
  render:()=>{counter.renders++;return {promise:Promise.resolve(),cancel(){}};},
  cleanup(){}
 };
 const lib={OPS:{paintImageXObject:4},getDocument:()=>null};
 const fakeDoc={numPages:count,getPage:async()=>mockPage};
 const canvas=()=>({
  width:0,height:0,getContext:()=>({drawImage(){}}),
  toDataURL:()=> 'data:image/jpeg;base64,'+'x'.repeat(previewLength),
  toBlob:cb=>{counter.png++;cb({size:1500});}
 });
 class Worker {
  constructor(){counter.workers++;}
  postMessage(data){
   if(data.type==='recognize')counter.recognized++;
   queueMicrotask(()=>this.onmessage?.({data:{id:data.id,ok:true,tsv:'recognized'}}));
  }
  terminate(){}
 }
 const context={Worker,DOMException,location:{pathname:'/'},
  document:{createElement:()=>canvas()},
  NeuroMapOCRStructure:require('../../../apps/desktop-shared/editor/ocr-structure'),
  NeuroMapOCRCore:{
   pages:()=>Array.from({length:count},(_,i)=>i+1),region:()=>{},imageCoverage:()=>images?1:0,
   tsv:()=>({text:'recognized',lines:[]})
  },
  NeuroMapOCRQuality:{region:()=>{},readingOrder:()=>({text:'recognized',mode:'engine',lines:[]})},
  NeuroMapOCRImage:{improve:async()=>{counter.enhance++;return optimized?{png:{size:1500},width:400,height:300,processing:{angle:1,contrast:true}}:null;}},
  NeuroMapPdfJs:{
   withDocument:async(_file,run)=>run(fakeDoc,{sha256:'fixture',totalPages:1},lib),
   pageText:()=>text
  }
 };
 context.globalThis=context;
 vm.runInNewContext(source,context,{filename:'ocr-runtime.js'});
 return {counter,ocr:context.NeuroMapOCR};
}

test('selectable text keeps source preview but skips both PNG and Tesseract',async()=>{
 const r=runtime();
 const progress=[];
 const output=await r.ocr.analyze({},'1',{enhance:true,onProgress:e=>progress.push(e)});
 assert.equal(output.results.length,1);
 const page=output.results[0];
 assert.equal(page.method,'native');
 assert.equal(page.nativeText,page.text);
 assert.match(page.preview,/^data:image\/jpeg/);
 assert.deepEqual({...r.counter},{renders:1,png:0,enhance:0,workers:0,recognized:0});
 assert.equal(progress[0].page,1);
});

test('scanned pages still encode a PNG, run Italian OCR and preserve preview',async()=>{
 const r=runtime({images:true,text:''});
 const output=await r.ocr.analyze({},'1');
 assert.equal(output.results[0].method,'ocr');
 assert.equal(output.results[0].text,'recognized');
 assert.match(output.results[0].preview,/^data:image\/jpeg/);
 assert.deepEqual({...r.counter},{renders:1,png:1,enhance:0,workers:1,recognized:1});
});

test('forced OCR encodes a PNG even with selectable source text',async()=>{
 const r=runtime();
 const output=await r.ocr.analyze({},'1',{force:true});
 assert.equal(output.results[0].method,'ocr');
 assert.equal(r.counter.png,1);
 assert.equal(r.counter.recognized,1);
});

test('25-page large batches succeed without hitting old 12 MB / 20-page caps, while extreme preview runaways stay bounded',async()=>{
 const r25=runtime({count:25,previewLength:800000}),cache=new Map();
 const ok=await r25.ocr.analyze({},'1-25',{cache});
 assert.equal(ok.results.length,25);
 assert.equal(cache.size,25);
 let cachedSeen=0;
 await r25.ocr.analyze({},'1-25',{cache,onPage:()=>cachedSeen++});
 assert.equal(cachedSeen,25);
 assert.equal(r25.counter.workers,0);

 const huge=runtime({count:270,previewLength:1000000}),hugeCache=new Map();
 await assert.rejects(huge.ocr.analyze({},'1-270',{cache:hugeCache}),/previews exceed session limit/);
 assert.ok(hugeCache.size>0&&hugeCache.size<=100);
});

test('enhanced raster skips PNG encoding of the discarded original',async()=>{const r=runtime({optimized:true,images:true,text:''});const out=await r.ocr.analyze({},'1',{enhance:true});assert.equal(r.counter.png,0);assert.equal(r.counter.enhance,1);assert.equal(out.results[0].text,'recognized');assert.equal(r.counter.recognized,1)});
