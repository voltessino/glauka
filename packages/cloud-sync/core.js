/* Glauka offline-first sync engine. No tokens, OAuth redirects, or cloud credentials
 * enter this module. An authenticated native transport implements remote I/O.
 * Native storage MUST fsync/commit before resolving writeDocument/writeIndex.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LIMIT=80*1024*1024;
 const STATES=Object.freeze({
  LOCAL:'local',OFFLINE:'offline',PENDING:'pending',
  SYNCING:'syncing',SYNCED:'synced',CONFLICT:'conflict',ERROR:'error'
 });
 const safeId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,110}$/.test(id)&&
  !['__proto__','constructor','prototype'].includes(id);
 const clone=x=>JSON.parse(JSON.stringify(x));
 function assertDocument(bytes){
  if(typeof bytes!=='string'||!bytes.length||new TextEncoder().encode(bytes).length>LIMIT)
   throw Error('Invalid map data or size over 80 MiB');
  let data;
  try{data=JSON.parse(bytes)}catch(_){throw Error('Map JSON invalid')}
  if(!data||typeof data!=='object'||Array.isArray(data)||!
   (data.root&&typeof data.root==='object'||Array.isArray(data.tabs)))
   throw Error('Map content invalid');
  return bytes;
 }
 function validateStore(storage){
  for(const fn of ['readIndex','writeIndex','listDocuments','readDocument','writeDocument']){
   if(typeof storage?.[fn]!=='function')throw Error('Durable local storage adapter missing '+fn);
  }
 }
 function createManager({storage,remote,hash,now=()=>Date.now(),online=()=>true,onChange=()=>{},
   schedule=()=>{},random=()=>Math.random(),idFactory=()=>{
    if(typeof globalThis.crypto?.getRandomValues!=='function')
     throw Error('Secure random ID generator unavailable');
    const data=new Uint8Array(16);globalThis.crypto.getRandomValues(data);
    return 'fork_'+Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');
   }}={}){
  validateStore(storage);
  if(typeof hash!=='function')throw Error('SHA-256 implementation required');
  let index={version:1,documents:{}},ready=false,workers=new Map(),sequence=Promise.resolve();
  function atomic(action){
   const run=sequence.then(action,action);
   sequence=run.catch(()=>{});
   return run;
  }
  const records=()=>Object.values(index.documents);
  function notify(doc){onChange(Object.freeze({id:doc.id,name:doc.name,status:doc.status,
   dirty:doc.dirty,attempts:doc.attempts,lastSuccess:doc.lastSuccess||null,error:doc.error||null}));}
  async function persist(){await storage.writeIndex(JSON.stringify(index));}
  async function initialize(){
   if(ready)return snapshot();
   const s=await storage.readIndex();
   if(s){
    const parsed=JSON.parse(s);
    if(parsed.version!==1||!parsed.documents||typeof parsed.documents!=='object'||
       Array.isArray(parsed.documents)||Object.keys(parsed.documents).some(id=>!safeId(id)))
      throw Error('Invalid or unsafe sync index');
    index=parsed;
   }
   // An interrupted save may have committed its document and crashed before
   // updating the queue: hash on-disk files and mark them pending on restart.
   for(const id of await storage.listDocuments()){
    if(!safeId(id))continue;
    const bytes=await storage.readDocument(id);
    if(bytes==null)continue;
    assertDocument(bytes);
    const digest=await hash(bytes);
    const existing=index.documents[id];
    if(!existing){
     index.documents[id]={id,name:id+'.glk',hash:digest,baseHash:null,
      remoteId:null,remoteVersion:null,dirty:true,status:STATES.PENDING,
      attempts:0,nextRetry:0,localVersion:1};
    }else if(existing.hash!==digest){
     existing.hash=digest;existing.dirty=true;
     existing.localVersion=(existing.localVersion||0)+1;
     existing.status=STATES.PENDING;existing.nextRetry=0;
    }else if(existing.status===STATES.SYNCING){
     existing.status=STATES.PENDING;existing.dirty=true;
    }
   }
   await persist();ready=true;
   records().forEach(notify);return snapshot();
  }
  function snapshot(){return clone(index.documents)}
  async function save(id,bytes,name){
   if(!ready)throw Error('Initialize cloud manager before saving');
   if(!safeId(id))throw Error('Unsafe document ID');
   assertDocument(bytes);
   const result=await atomic(async()=>{
    // Serialize hashing as well as writes: call order must determine commit order.
    // An earlier, slow SHA-256 must not overwrite a later save.
    const digest=await hash(bytes);
    // Durable file first; local success is never conditional on cloud reachability.
    await storage.writeDocument(id,bytes);
    const old=index.documents[id];
    if(old&&old.hash===digest)return old;
    const d=old||{id,name:'Map '+id+'.glk',remoteId:null,remoteVersion:null,
     baseHash:null,attempts:0,lastSuccess:null,localVersion:0};
    d.hash=digest;
    d.localVersion++;
    d.dirty=true;d.status=STATES.PENDING;d.nextRetry=0;d.error=null;
    if(name)d.name=String(name).replace(/[\\/:*?"<>|\u0000-\u001F]/g,'_').slice(0,120)+'.glk';
    index.documents[id]=d;
    await persist();notify(d);return clone(d);
   });
   // Enqueue without awaiting the network. A failed remote sync never invalidates
   // a successfully persisted local map.
   schedule(()=>{void flush(id).catch(()=>{});});
   return clone(result);
  }
  async function flush(id){
   if(!ready)throw Error('Initialize cloud manager first');
   if(workers.has(id))return workers.get(id);
   const process=async()=>{
    let d=index.documents[id];if(!d)return null;
    if(!d.dirty||d.status===STATES.CONFLICT)return clone(d);
    if(now()<Number(d.nextRetry||0))return clone(d);
    if(!online()||!remote){d.status=STATES.OFFLINE;await atomic(persist);notify(d);return clone(d)}
    d.status=STATES.SYNCING;d.error=null;await atomic(persist);notify(d);
    try{
     // Read a stable revision before network I/O. A concurrent user save can
     // enqueue another version, which MUST stay dirty after this upload.
     const bytes=await storage.readDocument(id);
     assertDocument(bytes);
     const sentHash=await hash(bytes);
     const sentVersion=d.localVersion;
     if(d.hash!==sentHash){d.hash=sentHash;d.dirty=true;d.status=STATES.PENDING;await atomic(persist);return clone(d)}
     let metadata=await remote.getMeta({id,remoteId:d.remoteId});
     if(d.remoteId&&metadata===null){
      // A remote delete is never silently replaced with a new file.
      d.status=STATES.CONFLICT;d.error='Remote document deleted';
     }else if(metadata&&d.remoteVersion&&metadata.version!==d.remoteVersion&&metadata.hash!==sentHash){
      d.status=STATES.CONFLICT;d.error='Concurrent remote change';
     }else if(metadata&&!d.remoteVersion&&metadata.hash!==sentHash){
      // A second device may see the same logical document ID without ever
      // observing its baseline. Never treat its copy as ours automatically.
      d.status=STATES.CONFLICT;d.error='Remote document not in local history';
     }else{
      const output=metadata&&metadata.hash===sentHash ? metadata : metadata
       ?await remote.update({id,remoteId:metadata.id,expectedVersion:metadata.version,
           name:d.name,bytes,hash:sentHash})
       :await remote.create({id,name:d.name,bytes,hash:sentHash});
      if(!output?.id||!output?.version)throw Error('Remote did not acknowledge a revision');
      // saveLocal can run concurrently; only clear dirty for exactly uploaded hash.
      await atomic(async()=>{
       d=index.documents[id];d.remoteId=output.id;d.remoteVersion=output.version;
       d.baseHash=sentHash;d.lastSuccess=now();d.attempts=0;d.nextRetry=0;
       d.dirty=d.localVersion!==sentVersion||d.hash!==sentHash;
       d.status=d.dirty?STATES.PENDING:STATES.SYNCED;d.error=null;
       await persist();notify(d);
      });
     }
     if(d.status===STATES.CONFLICT){await atomic(persist);notify(d)}
    }catch(error){
     await atomic(async()=>{
      d=index.documents[id];
      if(error?.conflict||error?.status===409||error?.status===412){
       d.status=STATES.CONFLICT;d.error='Concurrent remote change';
      }else{
       d.attempts=1+(d.attempts||0);
       const wait=Math.min(3600000,2000*2**Math.min(d.attempts,11));
       d.nextRetry=now()+Math.floor(wait*(.7+random()*.6));
       d.status=online()?STATES.ERROR:STATES.OFFLINE;
       // Errors are sanitized: NEVER persist request headers, token or URL.
       d.error=error?.retryable===false?'Cloud authentication or permission required':'Cloud unavailable';
      }
      d.dirty=true;await persist();notify(d);
     });
    }
    return clone(d);
   };
   const promise=process().finally(()=>{workers.delete(id)});
   workers.set(id,promise);
   return promise;
  }
  async function flushAll(){
   if(!ready)throw Error('Initialize cloud manager first');
   return Promise.all(Object.keys(index.documents).map(id=>flush(id)));
  }
  async function pull(id){
   if(!ready)throw Error('Initialize cloud manager first');
   let d=index.documents[id];
   if(!d)return null;
   if(!remote||!online())return clone(d);
   const observedHash=d.hash,observedRevision=d.localVersion;
   const metadata=await remote.getMeta({id,remoteId:d.remoteId});
   if(!metadata){
    if(d.remoteId){d.status=STATES.CONFLICT;d.error='Remote document deleted';
     await atomic(persist);notify(d);}
    return clone(d);
   }
   if(metadata.version===d.remoteVersion)return clone(d);
   if(d.dirty){
    d.status=STATES.CONFLICT;d.error='Concurrent remote change';
    await atomic(persist);notify(d);return clone(d);
   }
   const downloaded=await remote.download({id,remoteId:metadata.id});
   const bytes=downloaded?.bytes;
   if(typeof bytes!=='string')throw Error('Remote document is not a validated UTF-8 JSON string');
   assertDocument(bytes);
   const remoteDigest=await hash(bytes);
   // A provider may resolve a newer revision between the metadata check
   // and download (Google's immutable snapshots need a fresh lookup). Never
   // pair that new content with the old version in the index.
   if(!downloaded.metadata?.version||downloaded.metadata.version!==metadata.version||
      downloaded.metadata.id!==metadata.id||
      (metadata.hashAlgorithm==='sha256'&&metadata.hash&&metadata.hash!==remoteDigest)){
    await atomic(async()=>{
     d=index.documents[id];
     if(d.localVersion===observedRevision&&d.hash===observedHash&&!d.dirty){
      d.status=STATES.ERROR;d.error='Remote revision changed or integrity check failed';
      await persist();notify(d);
     }
    });
    throw Error('Remote revision changed during download');
   }
   return atomic(async()=>{
    d=index.documents[id];
    if(d.localVersion!==observedRevision||d.hash!==observedHash||d.dirty)
     return clone(d); // locally edited while the download was in progress
    await storage.writeDocument(id,bytes);
    d.hash=remoteDigest;d.baseHash=remoteDigest;
    d.remoteId=metadata.id;d.remoteVersion=metadata.version;
    d.status=STATES.SYNCED;d.dirty=false;d.error=null;
    d.lastSuccess=now();
    await persist();notify(d);return clone(d);
   });
  }
  // Never download unknown cloud documents without explicit user action.
  // Discovery is read-only, bounded, and reports conflict candidates.
  async function discoverRemote(){
   if(!ready)throw Error('Initialize cloud manager first');
   if(!remote||!online()||typeof remote.listRemote!=='function')
    throw Error('Cloud discovery is unavailable while offline');
   const list=await remote.listRemote();
   if(!Array.isArray(list)||list.length>1000)
    throw Error('Invalid or excessive remote document list');
   const ids=new Set();
   const found=[];
   for(const item of list){
    if(!safeId(item?.id)||!item.remoteId||!item.version||ids.has(item.id))
     throw Error('Invalid or ambiguous remote document');
    ids.add(item.id);
    const local=index.documents[item.id];
    let availability='new';
    if(local){
     if(local.dirty||local.status===STATES.CONFLICT)availability='local-pending';
     else if(local.remoteVersion===item.version)availability='same';
     else availability='remote-updated';
    }
    const name=String(item.name||item.id+'.glk')
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g,'_').slice(0,120);
    found.push(Object.freeze({id:item.id,name,
      status:availability,remoteId:item.remoteId,version:item.version}));
   }
   return found;
  }
  // Import is only for a *new* local document. Existing documents must use
  // pull()/explicit conflict resolution, never an overwriting "import".
  async function importRemote(id){
   if(!ready)throw Error('Initialize cloud manager first');
   if(!safeId(id))throw Error('Unsafe document ID');
   if(index.documents[id])throw Error('Local document already exists');
   const list=await discoverRemote();
   const item=list.find(row=>row.id===id&&row.status==='new');
   if(!item)throw Error('Remote document not available for safe import');
   const downloaded=await remote.download({id,remoteId:item.remoteId});
   if(!downloaded||typeof downloaded.bytes!=='string'||!downloaded.metadata||
      downloaded.metadata.id!==item.remoteId||
      downloaded.metadata.version!==item.version)
    throw Error('Remote document changed while importing');
   const bytes=assertDocument(downloaded.bytes);
   const digest=await hash(bytes);
   if(downloaded.metadata.hashAlgorithm==='sha256'&&downloaded.metadata.hash&&
      downloaded.metadata.hash!==digest)
    throw Error('Cloud document integrity check failed');
   return atomic(async()=>{
    if(index.documents[id]||(await storage.listDocuments()).includes(id))
     throw Error('Local document appeared during import');
    // File precedes index; initialize() can recover if a crash interrupts.
    await storage.writeDocument(id,bytes);
    const doc={id,name:item.name,hash:digest,baseHash:digest,
     remoteId:item.remoteId,remoteVersion:item.version,dirty:false,
     status:STATES.SYNCED,attempts:0,nextRetry:0,localVersion:1,
     lastSuccess:now()};
    index.documents[id]=doc;
    await persist();notify(doc);
    return clone(doc);
   });
  }
  async function syncAll(){
   if(!ready)throw Error('Initialize cloud manager first');
   const ids=Object.keys(index.documents);
   return Promise.all(ids.map(id=>index.documents[id].dirty?flush(id):pull(id)));
  }
  async function resolveKeepBoth(id,conflictName){
   if(!ready)throw Error('Initialize cloud manager first');
   const d=index.documents[id];
   if(!d||d.status!==STATES.CONFLICT)throw Error('No conflict to resolve');
   if(!remote||!online())throw Error('Cloud offline');
   const bytes=await storage.readDocument(id);
   assertDocument(bytes);
   const digest=await hash(bytes);
   if(digest!==d.hash)throw Error('Map changed during conflict review');
   const forkId=idFactory();
   if(!safeId(forkId)||index.documents[forkId])throw Error('Invalid or repeated conflict copy ID');
   const backupName=String(conflictName||d.name.replace(/\.glk$/i,'')+' (Conflitto)')
     .replace(/[\\/:*?"<>|\u0000-\u001F]/g,'_').slice(0,120)+'.glk';
   // First save a *separate* local logical document. A crash or network
   // failure must not erase the original or leave the only copy in cloud.
   await atomic(async()=>{
    const original=index.documents[id];
    if(!original||original.status!==STATES.CONFLICT||original.hash!==digest)
     throw Error('Original map changed during conflict review');
    if(index.documents[forkId])throw Error('Conflict copy ID collision');
    await storage.writeDocument(forkId,bytes);
    const fork={id:forkId,name:backupName,hash:digest,baseHash:null,
     remoteId:null,remoteVersion:null,dirty:true,status:STATES.PENDING,
     localVersion:1,attempts:0,nextRetry:0,sourceConflictId:id};
    index.documents[forkId]=fork;
    await persist();notify(fork);
   });
   // A new logical ID is essential: reusing the original Google glaukId
   // would hijack its canonical revision, and Dropbox would collide by path.
   const created=await remote.create({id:forkId,name:backupName,bytes,hash:digest});
   if(!created?.id||!created?.version)throw Error('Conflict copy was not confirmed');
   return atomic(async()=>{
    const fork=index.documents[forkId];
    if(!fork||fork.hash!==digest||fork.localVersion!==1){
     throw Error('Conflict copy changed during upload; leave it queued');
    }
    fork.remoteId=created.id;fork.remoteVersion=created.version;
    fork.baseHash=digest;fork.status=STATES.SYNCED;fork.dirty=false;
    fork.error=null;fork.lastSuccess=now();
    await persist();notify(fork);
    // The original remains marked CONFLICT until the user explicitly
    // reviews/replaces it; there has been no silent overwrite.
    return clone(fork);
   });
  }
  return Object.freeze({initialize,snapshot,save,flush,flushAll,pull,syncAll,discoverRemote,importRemote,resolveKeepBoth,STATES});
 }
 return Object.freeze({createManager,STATES,LIMIT,safeId,assertDocument});
});
