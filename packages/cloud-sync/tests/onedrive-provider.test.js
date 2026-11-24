'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Providers=require('../providers');
const {webcrypto}=require('node:crypto');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const ID='glw_0123456789abcdef0123456789abcdef';
function makeTransport(){
 const files=[],calls=[];let seq=0,broken=false;
 return {files,calls,setBroken:x=>broken=x,
  send:async q=>{
   calls.push(q);
   if(q.provider!=='onedrive')throw Error('Unexpected cross-provider request');
   if(q.method==='GET'&&q.url.endsWith('/special/approot'))
    return {status:200,json:{id:'01APPROOT'}};
   if(q.method==='GET'&&q.url.includes('/special/approot/children?'))
    return {status:200,json:{value:broken?[{name:ID+'__'+'a'.repeat(32)+'.glk',
     id:'01UNSAFE',createdDateTime:'2026-10-30T10:00:00Z'}]:
     files.map(f=>({id:f.id,name:f.name,eTag:f.eTag,createdDateTime:f.createdDateTime,file:{}}))}};
   const upload=/\/items\/01APPROOT:\/(glw_[a-f0-9]{32}__[a-f0-9]{32}\.glk):\/content$/.exec(q.url);
   if(q.method==='PUT'&&upload){
    assert.equal(q.headers['Content-Type'],'application/octet-stream');
    const f={id:'01ITEM'+(++seq),name:upload[1],eTag:'etag'+seq,
     createdDateTime:'2026-10-30T10:00:'+String(seq).padStart(2,'0')+'Z',bytes:q.body};
    files.push(f);
    return {status:201,json:f};
   }
   const dl=/\/items\/([A-Za-z0-9]+)\/content$/.exec(q.url);
   if(q.method==='GET'&&dl){
    const f=files.find(x=>x.id===dl[1]);
    return f?{status:200,bytes:f.bytes}:{status:404,json:{}};
   }
   throw Error('Unmocked native Graph request: '+q.method+' '+q.url);
  }
 };
}
test('OneDrive: app folder, discover, download and immutable update roundtrip',async()=>{
 const t=makeTransport(),p=Providers.onedrive({transport:t});
 const first=await p.create({id:ID,bytes:'{"root":{"text":"A","children":[]}}'});
 assert.ok(first.id);assert.equal(t.files.length,1);
 assert.equal((await p.listRemote())[0].id,ID);
 const previous=await p.getMeta({id:ID});
 assert.equal(previous.version,first.version);
 assert.match((await p.download({id:ID})).bytes,/"A"/);
 const second=await p.update({id:ID,expectedVersion:first.version,
  bytes:'{"root":{"text":"B","children":[]}}'});
 assert.notEqual(first.version,second.version);
 assert.equal(t.files.length,2,'old revision must be preserved');
 assert.match((await p.download({id:ID})).bytes,/"B"/);
 assert.equal((await p.listRemote()).length,1,'show one latest copy per logical workspace');
});
test('OneDrive: remote revision conflict cannot be overwritten',async()=>{
 const t=makeTransport(),p=Providers.onedrive({transport:t});
 const first=await p.create({id:ID,bytes:'{"root":{"text":"A","children":[]}}'});
 await p.update({id:ID,bytes:'{"root":{"text":"B","children":[]}}',expectedVersion:first.version});
 await assert.rejects(p.update({id:ID,bytes:'{"root":{"text":"C","children":[]}}',
  expectedVersion:first.version}),e=>e.conflict===true&&e.status===412);
 assert.equal(t.files.length,2);
});
test('OneDrive: rejects malformed IDs, ambiguous remote data and unsafe provider paths',async()=>{
 const t=makeTransport(),p=Providers.onedrive({transport:t});
 await assert.rejects(p.create({id:'../root',bytes:'{}'}),/Invalid/);
 await assert.rejects(p.getMeta({id:'glw_not_a_hex_id'}),/Invalid/);
 t.setBroken(true);
 await assert.rejects(p.listRemote(),/Unverifiable/);
});
