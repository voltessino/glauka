'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const pdf=require('../../../apps/desktop-shared/editor/pdfjs-adapter.js');

const file=()=>{
 const bytes=Buffer.from('%PDF-1.7\nMock pages');
 return {name:'histology.pdf',size:bytes.length,
  slice:(from,to)=>({arrayBuffer:async()=>Uint8Array.from(bytes.subarray(from,to)).buffer}),
  arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
};
const spin=async()=>{for(let i=0;i<25;i++)await Promise.resolve()};
function controlled(total=12){
 const started=[],cleanup=[],waiting=new Map();
 let destroyed=0;
 const doc={numPages:total,getOutline:async()=>[],getPage:async i=>({
  getTextContent:()=>new Promise((resolve,reject)=>{
   started.push(i);waiting.set(i,{resolve,reject});
  }),
  cleanup(){cleanup.push(i)}
 })};
 const worker={getDocument:()=>({promise:Promise.resolve(doc),
  destroy:async()=>{destroyed++;for(const p of waiting.values())p.reject(Error('Worker destroyed'))}})};
 return {worker,started,waiting,cleanup,removed:()=>destroyed};
}

test('PDF pages prefetch at most two concurrently and preserve page-order',async()=>{
 const mock=controlled(12),progress=[];
 const job=pdf.inspectWith(mock.worker,file(),{onProgress:p=>progress.push(p)});
 await spin();
 assert.deepEqual(mock.started,[1,2]);
 // Completing page 2 before page 1 must not reorder the output.
 mock.waiting.get(2).resolve({items:[{str:'Page 2'}]});
 await spin();
 assert.deepEqual(mock.started,[1,2],'do not overfill while page 1 is pending');
 mock.waiting.get(1).resolve({items:[{str:'Page 1'}]});
 for(let i=3;i<=12;i++){
  await spin();
  assert.ok(mock.started.includes(i),'page '+i+' was not scheduled');
  assert.ok(mock.started.length<=i+1,'unbounded work scheduled');
  mock.waiting.get(i).resolve({items:[{str:'Page '+i}]});
 }
 const result=await job;
 assert.deepEqual(result.pages.map(p=>p.page),Array.from({length:12},(_,i)=>i+1));
 assert.deepEqual(result.pages.map(p=>p.text),Array.from({length:12},(_,i)=>'Page '+(i+1)));
 assert.equal(mock.cleanup.length,12);
 assert.equal(mock.removed(),1);
 assert.deepEqual(progress,[{processed:8,total:12}]);
});

test('cancelling two in-flight pages stops the worker exactly once',async()=>{
 const mock=controlled(200),controller=new AbortController();
 const job=pdf.inspectWith(mock.worker,file(),{signal:controller.signal});
 await spin();
 assert.deepEqual(mock.started,[1,2]);
 controller.abort();
 await assert.rejects(job,/PDF read cancelled|Worker destroyed/);
 await spin();
 assert.equal(mock.removed(),1);
 assert.equal(mock.cleanup.length,2);
 assert.ok(mock.started.length<=2);
});

test('large page text limits still abort the entire import without truncation',async()=>{
 const mock=controlled(5);
 const job=pdf.inspectWith(mock.worker,file());
 await spin();
 mock.waiting.get(1).resolve({items:[{str:'A'.repeat(45001)}]});
 await assert.rejects(job,/45,000 text characters/);
 await spin();
 assert.equal(mock.removed(),1);
 assert.ok(mock.started.length<=2);
});
