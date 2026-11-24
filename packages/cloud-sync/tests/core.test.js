'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Cloud=require('../core');
const json=n=>JSON.stringify({root:{id:'root',text:'Study '+n,children:[]}});
const sha=async s=>'sha256:'+[...new TextEncoder().encode(s)].reduce((a,n)=>((a*33+n)>>>0),5381).toString(16);
function local(){
 const docs=new Map();let index=null,writeFail=false;
 return {
  docs,
  async readIndex(){return index},
  async writeIndex(text){if(writeFail){writeFail=false;throw Error('Simulated local fsync failed')}index=text},
  async listDocuments(){return [...docs.keys()]},
  async readDocument(id){return docs.get(id)||null},
  async writeDocument(id,bytes){docs.set(id,bytes)},
  failIndexOnce(){writeFail=true}
 };
}
function fakeRemote(){
 const docs=new Map(),calls=[];
 return {
  docs,calls,
  async getMeta({id}){calls.push('getMeta');const d=docs.get(id);return d?{id:d.id,version:String(d.ver),hash:d.hash}:null},
  async create({id,name,bytes,hash,conflictCopy}){
   calls.push('create');
   const key=conflictCopy?id+'-conflict':id;
   docs.set(key,{id:'remote-'+key,ver:1,bytes,hash,name});
   return {id:'remote-'+key,version:'1',hash};
  },
  async update({id,expectedVersion,bytes,hash}){
   calls.push('update');const d=docs.get(id);
   if(!d||String(d.ver)!==expectedVersion){const e=Error('conflict');e.status=409;throw e}
   d.ver++;d.bytes=bytes;d.hash=hash;
   return {id:d.id,version:String(d.ver),hash};
  }
 };
}
async function manager(store=local(),remote=fakeRemote(),options={}){
 const m=Cloud.createManager({storage:store,remote,hash:sha,idFactory:()=> 'fork_1234567890',...options});
 await m.initialize();return m;
}
test('save acknowledges durable local document without waiting for cloud',async()=>{
 const s=local(),r=fakeRemote(),m=await manager(s,r,{online:()=>false});
 const v=await m.save('doc_12345678',json(1),'Exam');
 assert.equal(s.docs.get('doc_12345678'),json(1));
 assert.equal(v.dirty,true);
 assert.equal(r.calls.length,0);
 assert.equal((await m.flush('doc_12345678')).status,'offline');
});
test('overlapping local saves remain in call order even if the first digest is slower',async()=>{
 const s=local(),id='doc_12345678';
 let unblock;
 const delayed=new Promise(resolve=>{unblock=resolve});
 const controlledHash=async bytes=>{
  if(bytes===json(1))await delayed;
  return sha(bytes);
 };
 const m=await manager(s,fakeRemote(),{hash:controlledHash});
 const first=m.save(id,json(1));
 const second=m.save(id,json(2));
 // Let the second hash finish before releasing the first. In the old
 // implementation it could enter the queue first and then be overwritten.
 await new Promise(resolve=>setImmediate(resolve));
 unblock();
 await Promise.all([first,second]);
 assert.equal(s.docs.get(id),json(2),'the latest user save must win');
 assert.equal(m.snapshot()[id].localVersion,2);
 const reopened=await manager(s,fakeRemote());
 assert.equal(s.docs.get(id),json(2));
 assert.equal(reopened.snapshot()[id].hash,await sha(json(2)));
});
test('queued sync survives reload and eventually acknowledges exact hash',async()=>{
 const s=local(),r=fakeRemote(),a=await manager(s,r,{online:()=>false});
 await a.save('doc_12345678',json(1));
 const b=await manager(s,r);
 assert.equal(b.snapshot().doc_12345678.status,'pending');
 const result=await b.flush('doc_12345678');
 assert.equal(result.status,'synced');
 assert.equal(result.dirty,false);
 assert.equal(r.docs.get('doc_12345678').bytes,json(1));
});
test('repeat local save uploads updated content after remote metadata check',async()=>{
 const r=fakeRemote(),m=await manager(local(),r);
 await m.save('doc_12345678',json(1));
 await m.flush('doc_12345678');
 await m.save('doc_12345678',json(2));
 const result=await m.flush('doc_12345678');
 assert.equal(result.status,'synced');
 assert.equal(r.docs.get('doc_12345678').bytes,json(2));
 assert.equal(r.calls.includes('update'),true);
});
test('remote divergence is a conflict rather than destructive last-writer-wins',async()=>{
 const r=fakeRemote(),m=await manager(local(),r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 const remote=r.docs.get('doc_12345678');remote.ver=77;remote.bytes=json(99);remote.hash=await sha(json(99));
 await m.save('doc_12345678',json(2));
 const state=await m.flush('doc_12345678');
 assert.equal(state.status,'conflict');
 assert.equal(remote.bytes,json(99));
 assert.equal(r.calls.filter(x=>x==='update').length,0);
});
test('second device cannot replace a remote document without baseline',async()=>{
 const r=fakeRemote();r.docs.set('doc_12345678',{id:'remote',ver:7,bytes:json(8),hash:await sha(json(8))});
 const m=await manager(local(),r);
 await m.save('doc_12345678',json(9));
 assert.equal((await m.flush('doc_12345678')).status,'conflict');
 assert.equal(r.calls.includes('update'),false);
});
test('retry is persistent, bounded and never exposes provider errors/tokens',async()=>{
 let time=10000;
 const r=fakeRemote();r.create=async()=>{throw Error('Authorization: Bearer secret-abc123')};
 const s=local(),m=await manager(s,r,{now:()=>time,random:()=>0.5});
 await m.save('doc_12345678',json(1));
 const state=await m.flush('doc_12345678');
 assert.equal(state.status,'error');
 assert.equal(state.dirty,true);
 assert.equal(state.attempts,1);
 assert.equal(state.nextRetry,time+4000);
 assert.equal(JSON.stringify(state).includes('secret-abc123'),false);
 const restart=await manager(s,r,{now:()=>time});
 assert.equal((await restart.flush('doc_12345678')).attempts,1);
});
test('recover modified on-disk document when process died before index flush',async()=>{
 const s=local(),r=fakeRemote(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 s.docs.set('doc_12345678',json(2));
 const recovery=await manager(s,r);
 assert.equal(recovery.snapshot().doc_12345678.dirty,true);
 assert.equal((await recovery.flush('doc_12345678')).status,'synced');
 assert.equal(r.docs.get('doc_12345678').bytes,json(2));
});
test('create reply lost and local crash does not duplicate remote unchanged content',async()=>{
 const s=local(),r=fakeRemote(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));
 const created=await r.create({id:'doc_12345678',name:'Exam.glk',bytes:json(1),hash:await sha(json(1))});
 const result=await m.flush('doc_12345678');
 assert.equal(result.status,'synced');
 assert.equal(r.calls.filter(x=>x==='create').length,1);
 assert.equal(result.remoteId,created.id);
});
test('conflict can be saved as separate remote copy while retaining other revision',async()=>{
 const r=fakeRemote(),m=await manager(local(),r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 r.docs.get('doc_12345678').ver=3;
 r.docs.get('doc_12345678').hash=await sha(json(3));
 await m.save('doc_12345678',json(2));await m.flush('doc_12345678');
 const result=await m.resolveKeepBoth('doc_12345678','Exam (Conflict)');
 assert.equal(result.status,'synced');
 assert.equal(result.id,'fork_1234567890');
 assert.equal(m.snapshot().doc_12345678.status,'conflict');
 assert.equal(r.docs.get('fork_1234567890').bytes,json(2));
 assert.equal(r.docs.get('doc_12345678').bytes,json(1));
});
test('invalid map and unsafe document ID cannot reach disk',async()=>{
 const s=local(),m=await manager(s);
 await assert.rejects(m.save('../path',json(1)),/Unsafe/);
 await assert.rejects(m.save('doc_12345678','{}'),/content invalid/i);
 await assert.rejects(m.save('doc_12345678','{broken'),/JSON invalid/i);
 assert.equal(s.docs.size,0);
});
test('local fsync/index failure cannot be declared a successful save',async()=>{
 const s=local(),m=await manager(s);
 s.failIndexOnce();
 await assert.rejects(m.save('doc_12345678',json(1)),/fsync/);
 assert.equal(s.docs.has('doc_12345678'),true);
 const restarted=await manager(s);
 assert.equal(restarted.snapshot().doc_12345678.dirty,true);
});

test('clean device downloads newer remote revision, without changing local authoring metadata unexpectedly',async()=>{
 const r=fakeRemote(),s=local(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 const old=r.docs.get('doc_12345678');old.ver=2;old.bytes=json(42);old.hash=await sha(json(42));
 r.download=async()=>({bytes:old.bytes,metadata:{id:old.id,version:String(old.ver),hash:old.hash,hashAlgorithm:'sha256'}});
 const result=await m.pull('doc_12345678');
 assert.equal(result.status,'synced');
 assert.equal(s.docs.get('doc_12345678'),json(42));
});
test('dirty local map never overwritten by concurrent download from another device',async()=>{
 const r=fakeRemote(),s=local(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 const d=r.docs.get('doc_12345678');d.ver=2;d.bytes=json(20);d.hash=await sha(json(20));
 await m.save('doc_12345678',json(30));
 const result=await m.pull('doc_12345678');
 assert.equal(result.status,'conflict');
 assert.equal(s.docs.get('doc_12345678'),json(30));
});

test('remote metadata changed during download is rejected, not mislabeled synchronized',async()=>{
 const r=fakeRemote(),s=local(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 const d=r.docs.get('doc_12345678');d.ver=2;d.bytes=json(22);d.hash=await sha(json(22));
 r.download=async()=>({bytes:json(23),metadata:{id:d.id,version:'3',hash:await sha(json(23)),hashAlgorithm:'sha256'}});
 await assert.rejects(m.pull('doc_12345678'),/revision changed/);
 assert.equal(s.docs.get('doc_12345678'),json(1));
 assert.equal(m.snapshot().doc_12345678.status,'error');
});
test('tampered remote SHA-256 metadata cannot corrupt the local document',async()=>{
 const r=fakeRemote(),s=local(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 const d=r.docs.get('doc_12345678');d.ver=2;d.bytes=json(2);d.hash=await sha(json(2));
 r.getMeta=async()=>({id:d.id,version:'2',hash:'forged',hashAlgorithm:'sha256'});
 r.download=async()=>({bytes:d.bytes,metadata:{id:d.id,version:'2',hash:'forged',hashAlgorithm:'sha256'}});
 await assert.rejects(m.pull('doc_12345678'),/revision changed/);
 assert.equal(s.docs.get('doc_12345678'),json(1));
});
test('crash/network error while forking leaves both original and new copy on local disk',async()=>{
 const r=fakeRemote(),s=local(),m=await manager(s,r);
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 const remote=r.docs.get('doc_12345678');remote.ver=3;remote.hash=await sha(json(99));
 await m.save('doc_12345678',json(2));await m.flush('doc_12345678');
 r.create=async()=>{throw Error('Simulated provider crash')};
 await assert.rejects(m.resolveKeepBoth('doc_12345678'),/provider crash/);
 assert.equal(s.docs.get('fork_1234567890'),json(2));
 assert.equal(s.docs.get('doc_12345678'),json(2));
 assert.equal(m.snapshot().fork_1234567890.dirty,true);
 assert.equal(m.snapshot().doc_12345678.status,'conflict');
});
test('insecure or colliding fork IDs are refused without creating new documents',async()=>{
 const s=local(),r=fakeRemote(),m=await manager(s,r,{idFactory:()=> '../hijack'});
 await m.save('doc_12345678',json(1));await m.flush('doc_12345678');
 r.docs.get('doc_12345678').ver=5;r.docs.get('doc_12345678').hash='changed';
 await m.save('doc_12345678',json(2));await m.flush('doc_12345678');
 await assert.rejects(m.resolveKeepBoth('doc_12345678'),/Invalid or repeated/);
 assert.equal(s.docs.size,1);
});

test('prototype-special identifiers cannot poison the persisted cloud index',async()=>{
 const s=local(),m=await manager(s);
 for(const id of ['__proto__','constructor','prototype'])
  await assert.rejects(m.save(id,json(1)),/Unsafe document ID/);
 assert.equal(s.docs.size,0);
 await s.writeIndex(JSON.stringify({version:1,documents:{'__proto__':{dirty:false}}})
   .replace('"documents":{}','"documents":{"__proto__":{"dirty":false}}'));
 await assert.rejects(Cloud.createManager({storage:s,remote:fakeRemote(),hash:sha})
   .initialize(),/unsafe sync index/);
});
test('100 diverse documents can be stored offline and uploaded without ID collisions',async()=>{
 const s=local(),r=fakeRemote(),m=await manager(s,r,{online:()=>false});
 for(let i=0;i<100;i++)await m.save('doc_'+String(i).padStart(8,'0'),json(i));
 assert.equal(Object.keys(m.snapshot()).length,100);
 const reload=await manager(s,r,{online:()=>true});
 const results=await reload.flushAll();
 assert.equal(results.length,100);
 assert.equal(results.filter(x=>x.status==='synced').length,100);
 assert.equal(r.docs.size,100);
 assert.equal(s.docs.size,100);
});

test('new device discovers remote document without writing until user explicitly imports',async()=>{
 const store=local(),remote=fakeRemote(),id='doc_12345678',content=json(44);
 const digest=await sha(content);
 remote.docs.set(id,{id:'remote-new',ver:7,bytes:content,hash:digest});
 remote.listRemote=async()=>[{id,name:'Anatomia.glk',remoteId:'remote-new',
  version:'7',hash:digest,hashAlgorithm:'sha256'}];
 remote.download=async()=>({bytes:content,
  metadata:{id:'remote-new',version:'7',hash:digest,hashAlgorithm:'sha256'}});
 const m=await manager(store,remote);
 const offerings=await m.discoverRemote();
 assert.equal(offerings.length,1);
 assert.equal(offerings[0].status,'new');
 assert.equal(store.docs.size,0);
 const imported=await m.importRemote(id);
 assert.equal(imported.status,'synced');
 assert.equal(imported.dirty,false);
 assert.equal(store.docs.get(id),content);
 assert.equal(imported.remoteVersion,'7');
 const restarted=await manager(store,remote);
 assert.equal(restarted.snapshot()[id].status,'synced');
});
test('explicit remote import never overwrites an existing unsynced local map',async()=>{
 const store=local(),remote=fakeRemote(),id='doc_12345678';
 remote.listRemote=async()=>[{id,name:'Remote.glk',remoteId:'remote',version:'5'}];
 const m=await manager(store,remote,{online:()=>false});
 await m.save(id,json(7));
 await assert.rejects(m.importRemote(id),/already exists/);
 assert.equal(store.docs.get(id),json(7));
});
test('remote discovery rejects duplicate IDs and never creates files',async()=>{
 const store=local(),remote=fakeRemote(),m=await manager(store,remote);
 remote.listRemote=async()=>[
  {id:'doc_12345678',remoteId:'r1',version:'1'},
  {id:'doc_12345678',remoteId:'r2',version:'2'}];
 await assert.rejects(m.discoverRemote(),/ambiguous/);
 assert.equal(store.docs.size,0);
});
test('remote download revision race is rejected before first local write',async()=>{
 const store=local(),remote=fakeRemote(),id='doc_12345678',m=await manager(store,remote);
 remote.listRemote=async()=>[{id,name:'New.glk',remoteId:'remote-1',version:'1'}];
 remote.download=async()=>({bytes:json(2),metadata:{id:'remote-2',version:'2'}});
 await assert.rejects(m.importRemote(id),/changed while importing/);
 assert.equal(store.docs.size,0);
});
test('remote document SHA-256 mismatch cannot import tampered content',async()=>{
 const store=local(),remote=fakeRemote(),id='doc_12345678',m=await manager(store,remote);
 remote.listRemote=async()=>[{id,name:'Remote.glk',remoteId:'remote',version:'1'}];
 remote.download=async()=>({bytes:json(100),metadata:{id:'remote',version:'1',
  hash:'wrong-hash',hashAlgorithm:'sha256'}});
 await assert.rejects(m.importRemote(id),/integrity check failed/);
 assert.equal(store.docs.size,0);
});
test('import interrupted after durable bytes but before index write is recovered',async()=>{
 const store=local(),remote=fakeRemote(),id='doc_12345678',m=await manager(store,remote);
 remote.listRemote=async()=>[{id,name:'Remote.glk',remoteId:'remote',version:'1'}];
 remote.download=async()=>({bytes:json(77),metadata:{id:'remote',version:'1'}});
 store.failIndexOnce();
 await assert.rejects(m.importRemote(id),/fsync/);
 assert.equal(store.docs.get(id),json(77));
 const resumed=await manager(store,remote,{online:()=>false});
 assert.equal(resumed.snapshot()[id].dirty,true);
 assert.equal(resumed.snapshot()[id].status,'pending');
});

test('remote file name cannot inject a path or control characters into the local cache',async()=>{
 const storage=local(),remote=fakeRemote(),m=await manager(storage,remote);
 remote.listRemote=async()=>[{id:'doc_12345678',name:'../../anatomia\nmalicious.glk',remoteId:'remote',version:'v1'}];
 const [offer]=await m.discoverRemote();
 assert.equal(offer.name.includes('/'),false);
 assert.equal(offer.name.includes('\n'),false);
 assert.equal(storage.docs.size,0);
});
