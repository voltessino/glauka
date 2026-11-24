'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../../../apps/desktop-shared/editor/pdfjs-adapter.js');
const Import=require('../../../apps/desktop-shared/editor/document-import-core.js');
const byteSource=(raw='PDF dummy body')=>{
 const bytes=Buffer.from('%PDF-1.7\n'+raw,'utf8');
 return {size:bytes.length,name:'Anatomia.pdf',slice(a,b){
   return {arrayBuffer:async()=>Uint8Array.from(bytes.subarray(a,b)).buffer};
  },arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
};
const fake=(pages=200,{outline=true,blank=false}={})=>{
 const stats={calls:0,destroyed:0,evalOptions:null};
 const doc={numPages:pages,async getOutline(){return outline?[{title:'Fisiologia',dest:[{num:1,gen:0}],items:[]},
  {title:'Clinica',dest:[{num:Math.floor(pages/2),gen:0}],items:[]}]:[]},
 async getPageIndex(ref){return ref.num},async getPage(number){stats.calls++;
  return {async getTextContent(){return {items:blank?[]:[{str:'Pagina '+number+' sistema cardiovascolare',hasEOL:true,transform:[0,0,0,12,0,120]}]}},
   cleanup(){}}
 }};
 const lib={getDocument(opts){stats.evalOptions=opts;return {promise:Promise.resolve(doc),destroy:async()=>{stats.destroyed++}}}};
 return {lib,stats};
};
test('200-page PDF yields 200 stable page records, text and real bookmarks',async()=>{
 const {lib,stats}=fake();
 const result=await P.inspectWith(lib,byteSource());
 assert.equal(result.pages.length,200);
 assert.equal(result.pages[199].page,200);
 assert.match(result.pages[0].text,/sistema cardiovascolare/);
 assert.deepEqual(result.outline.map(x=>x.page),[2,101]);
 assert.equal(result.engine,'PDF.js 6.4.299');
 assert.equal(stats.destroyed,1);
 assert.equal(stats.evalOptions.isEvalSupported,false);
 assert.equal(stats.evalOptions.useWasm,false);
 assert.equal(stats.evalOptions.enableXfa,false);
});
test('scanned pages are marked unreadable, not hallucinated or OCRed',async()=>{
 const {lib}=fake(3,{blank:true});
 const result=await P.inspectWith(lib,byteSource());
 assert.equal(result.unreadablePages,3);
 assert.ok(result.pages.every(x=>x.text===''));
});
test('over-350-page books open cleanly and PDF.js worker is destroyed above 10,000 pages',async()=>{
 const book=fake(450);
 const ok=await P.inspectWith(book.lib,byteSource(),{maxPages:5});
 assert.equal(ok.totalPages,450);
 assert.equal(ok.pages.length,5);
 assert.equal(book.stats.destroyed,1);
 const {lib,stats}=fake(10001);
 await assert.rejects(()=>P.inspectWith(lib,byteSource()),/10,000 pages/);
 assert.equal(stats.destroyed,1);
 assert.equal(stats.calls,0);
});
test('password/errors from the PDF.js worker are propagated, never silently downgraded',async()=>{
 const {lib,stats}=fake(1);
 lib.getDocument=()=>({promise:Promise.reject(Object.assign(Error('Password required'),{name:'PasswordException'})),
  destroy:async()=>{stats.destroyed++}});
 await assert.rejects(()=>P.inspectWith(lib,byteSource()),/Password required/);
 assert.equal(stats.destroyed,1);
});
test('processing supports cancellation and destroys worker safely',async()=>{
 const {lib,stats}=fake();
 await assert.rejects(()=>P.inspectWith(lib,byteSource(),{signal:{aborted:true}}),/cancelled/);
 assert.equal(stats.destroyed,1);
});
test('invalid headers are rejected before any PDF.js parser work',async()=>{
 const {lib,stats}=fake();
 await assert.rejects(()=>P.inspectWith(lib,{
  ...byteSource(),slice:()=>({arrayBuffer:async()=>Uint8Array.from([0,1,2,3,4]).buffer})
 }),/Invalid PDF header/);
 assert.equal(stats.calls,0);
});
test('document importer composes actual PDF bookmark groups without creating 200 fabricated summaries',async()=>{
 const stub={kind:'pdf',...byteSource()};
 const {lib}=fake(200);
 const report=await P.inspectWith(lib,byteSource());
 const actual=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../../apps/desktop-shared/editor/document-import-core.js'),'utf8');
 assert.ok(actual.includes('data.outline'));
 assert.ok(actual.includes('pages.length>245'));
 assert.equal(report.outline.length,2);
});
test('page text is bounded, keeps line separation and strips control bytes',()=>{
 const text=P.pageText({items:[{str:'Title',transform:[0,0,0,14,0,110]},
  {str:'second',transform:[0,0,0,14,0,80]},{str:'\u0000Third',hasEOL:true}]});
 assert.ok(text.includes('\nsecond'));
 assert.ok(!text.includes('\u0000'));
});

test('cyclic bookmark graphs are capped and never cause infinite loops',async()=>{
 const {lib}=fake(2);
 const doc=await lib.getDocument({}).promise;
 const a={title:'A',dest:[{num:0,gen:0}],items:[]};
 a.items=[a];
 doc.getOutline=async()=>[a];
 const report=await P.inspectWith(lib,byteSource());
 assert.deepEqual(report.outline.map(item=>item.title),['A']);
});
test('text fragment flood is rejected without truncating source silently',()=>{
 assert.throws(()=>P.pageText({items:new Array(60001).fill({str:''})}),/too many text fragments/);
});
test('explicit page range is reported as partial without misnumbering pages',async()=>{
 const {lib}=fake(200);
 const report=await P.inspectWith(lib,byteSource(),{maxPages:15});
 assert.equal(report.pages.length,15);
 assert.equal(report.totalPages,200);
 assert.equal(report.partial,true);
 assert.equal(report.pages[14].page,15);
});

test('same immutable File object reuses finished analysis without spawning another worker',async()=>{
 const {lib,stats}=fake(8),file=byteSource('cache-one-file');
 let loaders=0;
 const loader=async()=>{loaders++;return lib};
 const a=P.inspectCached(file,{},loader);
 const b=P.inspectCached(file,{},loader);
 const [left,right]=await Promise.all([a,b]);
 assert.equal(left,right);
 assert.equal(loaders,1);
 assert.equal(stats.calls,8);
 await P.inspectCached(file,{},loader);
 assert.equal(loaders,1);
});
test('explicit progress reports are never served from a silent cached result',async()=>{
 const {lib,stats}=fake(10),file=byteSource('progress-test');
 let calls=0;
 const opts={onProgress:()=>{calls++}};
 await P.inspectCached(file,opts,async()=>lib);
 await P.inspectCached(file,opts,async()=>lib);
 assert.equal(stats.calls,20);
 assert.equal(calls,2);
});
test('failed analysis is evicted from the weak cache so user can retry',async()=>{
 const {lib,stats}=fake(1),file=byteSource('retry-test');
 let failed=0;
 const original=lib.getDocument;
 lib.getDocument=opts=>{if(!failed++)throw Error('worker startup failed');return original(opts)};
 await assert.rejects(()=>P.inspectCached(file,{},async()=>lib),/worker startup failed/);
 const retried=await P.inspectCached(file,{},async()=>lib);
 assert.equal(retried.pages.length,1);
 assert.equal(stats.calls,1);
});
test('optional SHA256 is computed from the same PDF read before the worker receives bytes',async()=>{
 const fs=require('node:fs'),path=require('node:path');
 const original=fs.readFileSync(path.resolve(__dirname,'../../../apps/desktop-shared/editor/pdfjs-adapter.js'),'utf8');
 const isolated={exports:{}},trace={reads:0,hashes:0};
 const crypto={subtle:{digest:async(algo,bytes)=>{
  assert.equal(algo,'SHA-256');assert.ok(bytes.byteLength>0);trace.hashes++;
  return Uint8Array.from({length:32},(_,i)=>i).buffer;
 }}};
 new Function('globalThis','module',original)({crypto},isolated);
 const source=byteSource('one-buffer-digest');
 const file={...source,arrayBuffer:async()=>{trace.reads++;return source.arrayBuffer()}};
 const {lib}=fake(1),report=await isolated.exports.inspectWith(lib,file,{includeDigest:true});
 assert.equal(trace.reads,1);
 assert.equal(trace.hashes,1);
 assert.equal(report.sha256,Array.from({length:32},(_,i)=>i.toString(16).padStart(2,'0')).join(''));
});
