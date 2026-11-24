'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/pdfjs-adapter.js'),'utf8');
const file=(suffix='same')=>{
 const bytes=Buffer.from('%PDF-1.7\n'+suffix);
 return {name:'Local.pdf',size:bytes.length,
  arrayBuffer:async()=>Uint8Array.from(bytes).buffer,
  slice:(start,end)=>({arrayBuffer:async()=>Uint8Array.from(bytes.subarray(start,end)).buffer})};
};
function harness({failHash=false}={}){
 let hashes=0,created=0,destroyed=0,rejectPage;
 const subtle={async digest(_algo,bytes){
  hashes++;
  if(failHash&&hashes===1)throw Error('hash unavailable');
  assert.ok(bytes.byteLength>0);
  return Uint8Array.from({length:32},(_,i)=>i).buffer;
 }};
 const lib={GlobalWorkerOptions:{},getDocument(){
  created++;
  return {promise:Promise.resolve({numPages:1,getOutline:async()=>[],getPage:async()=>({
   getTextContent:async()=>({items:[{str:'Hello local PDF text'}]}),cleanup(){}})}),
   destroy:async()=>{destroyed++}};
 }};
 const isolated={exports:{}};
 // A local test-only injection avoids fetching /pdfjs/pdf.mjs. The actual
 // library() function and withDocument() cleanup logic are still exercised.
 const testSource=source.replace('pending=import(module).then(lib=>{',
  'pending=Promise.resolve(pdfLib).then(lib=>{');
 assert.notEqual(testSource,source);
 new Function('globalThis','module','pdfLib',testSource)({crypto:{subtle},location:{pathname:'/'}},isolated,lib);
 return {api:isolated.exports,counters:()=>({hashes,created,destroyed})};
}
test('repeat OCR rereads on one immutable PDF hash once but always destroy the worker',async()=>{
 const h=harness(),f=file('repeated');
 const results=await Promise.all(Array.from({length:4},()=>h.api.withDocument(f,
  async(_doc,src)=>src.sha256)));
 assert.ok(results.every(x=>x===results[0]&&x.length===64));
 assert.deepEqual(h.counters(),{hashes:1,created:4,destroyed:4});
});
test('text-layer analysis and subsequent OCR share only the fingerprint',async()=>{
 const h=harness(),f=file('shared');
 const first=await h.api.inspectWith({getDocument(){
  return {promise:Promise.resolve({numPages:1,getOutline:async()=>[],getPage:async()=>({
   getTextContent:async()=>({items:[{str:'hello'}]}),cleanup(){}})}),
   destroy:async()=>{}}}},f,{includeDigest:true});
 const second=await h.api.withDocument(f,async(_doc,src)=>src.sha256);
 assert.equal(first.sha256,second);
 assert.equal(h.counters().hashes,1);
});
test('a failed SHA256 computation is evicted, enabling retry',async()=>{
 const h=harness({failHash:true}),f=file('retry');
 await assert.rejects(()=>h.api.withDocument(f,async()=>{}),/hash unavailable/);
 const result=await h.api.withDocument(f,async(_doc,src)=>src.sha256);
 assert.equal(result.length,64);
 assert.equal(h.counters().hashes,2);
});
test('abort destroys the in-flight PDF.js worker, not only a later page',async()=>{
 const h=harness(),f=file('cancel'),controller=new AbortController();
 let started;const pendingPages=[];
 const ready=new Promise(resolve=>started=resolve);
 const pdf={getDocument(){return {
  promise:Promise.resolve({numPages:2,getOutline:async()=>[],getPage:async()=>{
   started();return new Promise((_,reject)=>{pendingPages.push(reject)});
  }}),
  destroy:async()=>{for(const reject of pendingPages.splice(0))reject(Error('Worker terminated'));}}}};
 const pending=h.api.inspectWith(pdf,f,{signal:controller.signal});
 await ready;controller.abort();
 await assert.rejects(pending,/Worker terminated|cancelled/);
});
