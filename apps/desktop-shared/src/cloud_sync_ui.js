/* Opt-in native-backed two-way workspace sync.
 * Upload only after durable local save; stage and verify remote changes first.
 * Apply updates automatically only against an unchanged locally confirmed
 * baseline. Concurrent changes become explicit review, never last-writer-wins.
 * No OAuth tokens pass through JavaScript.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const PROVIDERS=['google','dropbox','onedrive'];
 const KEYS={google:'glauka.cloud.optin.google',dropbox:'glauka.cloud.optin.dropbox',onedrive:'glauka.cloud.optin.onedrive'};
 const IDENTITIES={google:'glauka.cloud.identity.google',dropbox:'glauka.cloud.identity.dropbox',onedrive:'glauka.cloud.identity.onedrive'};
 const PREFIXES={google:'glg_',dropbox:'gld_',onedrive:'glw_'};
 const BASE={google:'glauka.cloud.applied.google',dropbox:'glauka.cloud.applied.dropbox',onedrive:'glauka.cloud.applied.onedrive'};
 const INCOMING={google:'glauka.cloud.inbox.google',dropbox:'glauka.cloud.inbox.dropbox',onedrive:'glauka.cloud.inbox.onedrive'};
 const UNPAIRED={google:'glauka.cloud.unpaired.google',dropbox:'glauka.cloud.unpaired.dropbox',onedrive:'glauka.cloud.unpaired.onedrive'};
 const CHECK_EVERY_MS=120000;
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,110}$/.test(id)
   &&!['__proto__','constructor','prototype'].includes(id);
 let manager=null,initializing=null,timer=null,pollTimer=null,latest=null,epoch=0,enableIntent=0,ongoing=null,suppress=false;
 const enabled=provider=>PROVIDERS.includes(provider)&&root.localStorage?.getItem(KEYS[provider])==='1';
 const canUse=()=>Boolean(root.neuromapDesktop?.cloudAuth&&root.neuromapDesktop.cloudLocal
   &&root.neuromapDesktop.cloudTransport&&root.GlaukaCloudCore&&root.GlaukaCloudProviders
   &&root.GlaukaCloudHash);
 const tr=(it,en)=>root.GlaukaI18n?.pair?.(it,en)??(root.document?.documentElement?.lang==='en'?en:it);
 const storage=()=>root.neuromapDesktop.cloudLocal;
 function driver(provider){
  const P=root.GlaukaCloudProviders;
  if(provider==='google')return P.google({transport:root.neuromapDesktop.cloudTransport});
  if(provider==='dropbox')return P.dropbox({transport:root.neuromapDesktop.cloudTransport});
  if(provider==='onedrive')return P.onedrive({transport:root.neuromapDesktop.cloudTransport});
  throw Error('Unsupported cloud provider');
 }
 function forId(id){
  if(String(id).startsWith(PREFIXES.google))return 'google';
  if(String(id).startsWith(PREFIXES.dropbox))return 'dropbox';
  if(String(id).startsWith(PREFIXES.onedrive))return 'onedrive';
  throw Error('Unscoped cloud document ID');
 }
 const remote=Object.fromEntries(['getMeta','create','update','download'].map(method=>[method,async request=>{
  const provider=forId(request?.id);
  if(!enabled(provider))throw Error('Cloud synchronization disabled');
  const status=await root.neuromapDesktop.cloudAuth.status();
  // Account or provider can be disabled while native auth.status is pending.
  if(!enabled(provider))throw Error('Cloud synchronization disabled');
  if(!status?.supported||!status[provider]?.configured||!status[provider]?.connected)
   throw Error('Cloud account not connected');
  return driver(provider)[method](request);
 }]));
 remote.listRemote=async()=>{
  const auth=await root.neuromapDesktop.cloudAuth.status();
  const results=[];
  for(const provider of PROVIDERS){
   if(!enabled(provider)||!auth?.[provider]?.connected)continue;
   const found=await driver(provider).listRemote();
   for(const item of found){
    if(validId(item.id)&&item.id.startsWith(PREFIXES[provider]))results.push(item);
   }
  }
  if(results.length>1000)throw Error('Too many cloud documents for safe discovery');
  return results;
 };
 const cloudHash=json=>root.GlaukaCloudHash.sha256(json);
 const getValue=(key)=>{try{return root.localStorage?.getItem(key)||null}catch{return null}};
 const setValue=(key,value)=>{if(value==null)root.localStorage?.removeItem?.(key);
   else root.localStorage?.setItem(key,String(value))};
 const pendingFor=provider=>{
  try{const value=JSON.parse(getValue(INCOMING[provider])||'null');
   return value&&validId(value.id)&&typeof value.hash==='string'&&/^[a-f0-9]{64}$/.test(value.hash)?value:null;
  }catch{return null}
 };
 const savePending=(provider,id,hash)=>{
  setValue(INCOMING[provider],JSON.stringify({id,hash}));
 };
 const clearPending=provider=>setValue(INCOMING[provider],null);
 async function getManager(){
  if(manager)return manager;
  if(!canUse())throw Error('Native cloud support is unavailable');
  if(!initializing)initializing=(async()=>{
   const m=root.GlaukaCloudCore.createManager({
    storage:storage(),remote,hash:root.GlaukaCloudHash.sha256,
    online:()=>root.navigator?.onLine!==false,
    // Only explicit callers are allowed to trigger outbound traffic.
    schedule:()=>{},onChange:()=>{}
   });
   await m.initialize();manager=m;return m;
  })().catch(e=>{initializing=null;throw e});
  return initializing;
 }
 function identity(provider,m){
  if(!PROVIDERS.includes(provider))throw Error('Unsupported provider');
  const key=IDENTITIES[provider],prefix=PREFIXES[provider];
  const stored=getValue(key);
  if(validId(stored)&&stored.startsWith(prefix))return stored;
  if(typeof root.crypto?.getRandomValues!=='function')throw Error('Secure random generator required');
  const random=new Uint8Array(16);root.crypto.getRandomValues(random);
  const id=prefix+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
  setValue(key,id);return id;
 }
 async function permitted(provider){
  const auth=root.neuromapDesktop?.cloudAuth;
  if(!auth||!PROVIDERS.includes(provider))throw Error('Cloud provider unavailable');
  const status=await auth.status();
  if(!status?.supported||!status[provider]?.configured||!status[provider]?.connected)
   throw Error(tr('Collega prima un account cloud configurato.','Connect a configured cloud account first.'));
 }
 function cancelTimer(){if(timer){root.clearTimeout(timer);timer=null}}
 function stopPoll(){if(pollTimer){root.clearTimeout(pollTimer);pollTimer=null}}
 function schedulePoll(){
  stopPoll();
  if(!PROVIDERS.some(enabled))return;
  pollTimer=root.setTimeout(()=>{
   pollTimer=null;
   if(!PROVIDERS.some(enabled))return;
   const app=root.neuroMapApp;
   if(!app?.editorNodeId&&!app?.drag)
    void pollOnce().catch(()=>{}).finally(schedulePoll);
   else schedulePoll();
  },CHECK_EVERY_MS);
 }
 async function pollOnce(){
  if(root.navigator?.onLine===false)return;
  const app=root.neuroMapApp;
  if(!app?.persistWorkspace||app.editorNodeId||app.drag)return;
  // Capture unsaved in-memory changes before comparing cloud revisions.
  // A remote fast-forward must never erase changes sitting in a save timer.
  if(await app.persistWorkspace()!==true)return;
  const json=await root.neuromapDesktop?.readWorkspace?.();
  if(typeof json!=='string'||!json)return;
  await perform(json);
 }
 async function selectIdentity(provider,m){
  const stored=getValue(IDENTITIES[provider]);
  if(root.navigator?.onLine===false){
   const id=identity(provider,m);
   if(!getValue(UNPAIRED[provider])&&!m.snapshot()[id])
    setValue(UNPAIRED[provider],'1');
   return {id};
  }
  if(stored&&getValue(UNPAIRED[provider])!=='1')return {id:stored};
  await permitted(provider);
  const candidates=(await driver(provider).listRemote())
    .filter(row=>validId(row.id)&&row.id.startsWith(PREFIXES[provider]));
  if(candidates.length>1)return {status:'needs-review',
    error:tr('Sono presenti più aree di lavoro sul cloud. Scegli quale recuperare da Trova mappe.',
             'Multiple cloud workspaces found. Select one from Find maps.')};
  if(stored&&getValue(UNPAIRED[provider])==='1'&&candidates.length&&candidates[0].id!==stored)
   return {status:'conflict',error:tr('Modifiche locali offline e area remota diversa: scegli quale copia conservare.',
   'Offline local changes and a different remote workspace require review.')};
  if(candidates.length===1){
   const id=candidates[0].id;
   setValue(IDENTITIES[provider],id);setValue(UNPAIRED[provider],null);
   const imported=!m.snapshot()[id];
   if(imported)await m.importRemote(id);
   return {id,imported};
  }
  const id=identity(provider,m);setValue(UNPAIRED[provider],null);return {id};
 }
 async function setEnabled(provider,value){
  if(!PROVIDERS.includes(provider))throw Error('Unsupported cloud provider');
  // The latest explicit user choice wins even if an older auth/init request
  // is still awaiting the native bridge.
  const intent=++enableIntent;
  if(!value){
   root.localStorage?.setItem(KEYS[provider],'0');
   ++epoch;cancelTimer();stopPoll();
   // Turning Google off must not drop a pending Dropbox upload (or vice versa).
   if(PROVIDERS.some(enabled)&&latest)onWorkspaceSaved(latest);
   schedulePoll();return false;
  }
  await permitted(provider);
  if(intent!==enableIntent)return false;
  await getManager();
  if(intent!==enableIntent)return false;
  // Two independent automatic accounts would each pull a whole workspace
  // and could overwrite one another. One active writable destination at once.
  ++epoch;cancelTimer();stopPoll();
  for(const other of PROVIDERS)
   root.localStorage?.setItem(KEYS[other],other===provider?'1':'0');
  schedulePoll();return true;
 }
 async function applyRemote(provider,id,expectedLocal,remoteBytes){
  const app=root.neuroMapApp;
  if(!app||typeof app.loadAutosave!=='function'||typeof app.persistWorkspace!=='function')
   return false;
  if(app.editorNodeId||app.drag||app._desktopRecoveryPending||app._nmRecoveryBlocked)
   return false;
  const native=await root.neuromapDesktop.readWorkspace();
  if(typeof native!=='string'||await cloudHash(native)!==expectedLocal)return false;
  if(app._nativeWorkspaceWrites?.isIdle&& !app._nativeWorkspaceWrites.isIdle())return false;
  root.GlaukaCloudCore.assertDocument(remoteBytes);
  const incoming=JSON.parse(remoteBytes);
  // Keep cloud apply aligned with native recovery's 100-tab limit;
  // fail before touching live tabs rather than silently dropping extras.
  if(!Array.isArray(incoming.tabs)||incoming.tabs.length<1||incoming.tabs.length>100)
   return false;
  const protect=root.neuromapDesktop.cloudLocal?.protectWorkspace;
  if(typeof protect!=='function')return false;
  const backup=await protect(expectedLocal);
  if(!backup?.saved)throw Error('Local recovery backup was not confirmed');
  const afterBackup=await root.neuromapDesktop.readWorkspace();
  if(typeof afterBackup!=='string'||await cloudHash(afterBackup)!==expectedLocal||
     app.editorNodeId||app.drag||
     (app._nativeWorkspaceWrites?.isIdle&&!app._nativeWorkspaceWrites.isIdle()))return false;
  // The disk may still equal the baseline while editing is pending in memory
  // (autosave is debounced). Persist first and never discard that new revision.
  if(await app.persistWorkspace()!==true)return false;
  const lastLocal=await root.neuromapDesktop.readWorkspace();
  if(typeof lastLocal!=='string'||await cloudHash(lastLocal)!==expectedLocal||
     app.editorNodeId||app.drag||
     (app._nativeWorkspaceWrites?.isIdle&&!app._nativeWorkspaceWrites.isIdle())||
     !enabled(provider))return false;
  // A confirmed native snapshot is the rollback copy in case reconstruction
  // fails. Do not change live tabs when local changes are newer.
  suppress=true;
  try{
   if(!app.loadAutosave(remoteBytes)){
    app._nmRecoveryBlocked=false;
    app.loadAutosave(native);
    return false;
   }
   app._nmHomePlaceholder=false;
   app.recalculateAndRender?.();app.renderTabBar?.();app.requestRender?.();
   const saved=await app.persistWorkspace();
   if(saved!==true)throw Error('Remote version not durably saved on device');
   const confirmed=await root.neuromapDesktop.readWorkspace();
   if(typeof confirmed!=='string')throw Error('Cloud apply cannot verify local save');
   setValue(BASE[provider],await cloudHash(confirmed));
   clearPending(provider);
   return true;
  }catch(error){
   app._nmRecoveryBlocked=false;
   app.loadAutosave(native);
   app.recalculateAndRender?.();app.renderTabBar?.();
   throw error;
  }finally{suppress=false}
 }
 async function reconcile(provider,json){
  if(!enabled(provider))return {status:'disabled'};
  root.GlaukaCloudCore.assertDocument(json);
  const m=await getManager();
  const chosen=await selectIdentity(provider,m);
  if(!chosen.id)return chosen;
  const id=chosen.id;
  let doc=m.snapshot()[id];
  const localHash=await cloudHash(json);
  // Joining an existing cloud workspace never uploads an unrelated local
  // workspace over the remote snapshot. Stage it for explicit review.
  if(chosen.imported){
   savePending(provider,id,doc.hash);
   return {id,status:'incoming',direction:'download',error:tr(
    'Area di lavoro trovata sul cloud. Scegli come aprirla prima di sincronizzare.',
    'Existing cloud workspace found. Choose how to open it before syncing.')};
  }
  const inbox=pendingFor(provider);
  if(inbox?.id===id&&doc?.hash===inbox.hash&&localHash!==inbox.hash){
   if(localHash===getValue(BASE[provider])){
    const bytes=await storage().readDocument(id);
    if(bytes&&await applyRemote(provider,id,localHash,bytes))
      return {id,status:'synced',direction:'download',applied:true};
   }
   return {id,status:'incoming',dirty:false,
     error:tr('Modifiche remote pronte: controlla e applica dal pannello.',
       'Remote changes available: review and apply from the cloud panel.')};
  }
  if(doc?.status===root.GlaukaCloudCore.STATES.CONFLICT)
   return {id,status:'conflict',error:doc.error};
  if(doc?.remoteVersion&&!doc.dirty){
   // Stage local edits before pulling, so the engine notices concurrent edits.
   if(localHash!==doc.hash)await m.save(id,json,tr('Area di lavoro Glauka','Glauka workspace'));
   const pulled=await m.pull(id);
   if(pulled?.status==='conflict')return {id,status:'conflict',error:pulled.error};
   doc=m.snapshot()[id];
   if(doc.hash!==localHash&&!doc.dirty){
    savePending(provider,id,doc.hash);
    if(localHash===getValue(BASE[provider])){
     const bytes=await storage().readDocument(id);
     if(bytes&&await applyRemote(provider,id,localHash,bytes))
      return {id,status:'synced',direction:'download',applied:true};
    }
    return {id,status:'incoming',
      error:tr('Versione cloud scaricata: è necessaria una revisione.',
        'Cloud version downloaded: review before replacing local data.')};
   }
  }
  if(doc&&!doc.dirty&&doc.hash!==localHash){
   savePending(provider,id,doc.hash);
   return {id,status:'incoming',
     error:tr('Prima sincronizzazione: scegli se recuperare la copia remota.',
       'First sync: choose whether to restore the remote copy.')};
  }
  if(!doc||doc.hash!==localHash)await m.save(id,json,tr('Area di lavoro Glauka','Glauka workspace'));
  if(!enabled(provider))return {id,status:'disabled'};
  // Early, honest size feedback. No remote request is made and the local
  // durable copy stays available for a subsequent update of the uploader.
  const byteCount=new TextEncoder().encode(json).byteLength;
  const maxCloudBytes=provider==='google'?5*1024*1024:12*1024*1024; // Dropbox & OneDrive transport limit
  if(byteCount>maxCloudBytes)return {id,status:'unsupported-size',dirty:true,
   error:tr('Workspace troppo grande per questa versione cloud ('+
    Math.round(byteCount/1048576)+' MiB). Il salvataggio locale è al sicuro.',
    'Workspace exceeds this cloud uploader limit ('+
    Math.round(byteCount/1048576)+' MiB). Local save is safe.')};
  if(root.navigator?.onLine===false)return {id,status:'offline',dirty:true};
  try{await permitted(provider)}catch{
   return {id,status:'error',dirty:true,error:tr('Account scollegato; copia locale conservata.',
    'Account disconnected; local copy retained.')};
  }
  // Recheck after the asynchronous authentication call, before starting an
  // outbound transfer for an account the user may have switched off.
  if(!enabled(provider))return {id,status:'disabled',dirty:true};
  // No queued upload may flush a revision superseded by an in-memory save
  // that became durable during remote discovery or native auth.
  if(await root.neuromapDesktop.readWorkspace()!==json)
   return {id,status:'stale-local',dirty:true,error:tr(
    'La mappa locale è cambiata: ripeti la sincronizzazione.',
    'The local map changed: sync again.')};
  const result=await m.flush(id);
  if(result.status==='synced'){
   setValue(BASE[provider],localHash);clearPending(provider);
  }
  return {id,status:result.status,dirty:result.dirty,
   error:result.error||null,direction:'upload',success:result.status==='synced'};
 }
 async function upload(provider,json){return reconcile(provider,json)}
 async function acceptIncoming(provider,{replaceLocal=false}={}){
  if(!enabled(provider))throw Error('Cloud synchronization disabled');
  const inbox=pendingFor(provider);
  if(!inbox)return {status:'no-incoming'};
  const m=await getManager(),doc=m.snapshot()[inbox.id];
  if(!doc||doc.hash!==inbox.hash)throw Error('Cloud revision changed; refresh first');
  await permitted(provider);
  const latestMeta=await driver(provider).getMeta({id:inbox.id,remoteId:doc.remoteId});
  if(!latestMeta||latestMeta.version!==doc.remoteVersion)
   return {status:'review',error:tr(
    'La versione cloud è cambiata. Premi Sincronizza ora prima di applicarla.',
    'Cloud revision changed. Sync again before applying it.')};
  const native=await root.neuromapDesktop.readWorkspace();
  if(typeof native!=='string')throw Error('Cannot read local workspace');
  const currentHash=await cloudHash(native);
  if(currentHash!==getValue(BASE[provider])&&!replaceLocal)
   return {status:'review',error:tr('Il workspace locale è diverso: puoi aprire la copia remota oppure confermare la sostituzione.',
    'Local workspace differs: open a remote copy or confirm replacing it.')};
  const bytes=await storage().readDocument(inbox.id);
  if(!enabled(provider))return {status:'disabled'};
  if(!bytes||!await applyRemote(provider,inbox.id,currentHash,bytes))
   return {status:'review'};
  return {status:'synced',direction:'download',applied:true};
 }
 function forgetAccount(provider){
  if(!PROVIDERS.includes(provider))return;
  ++enableIntent;++epoch;clearPending(provider);
  setValue(BASE[provider],null);setValue(IDENTITIES[provider],null);
  setValue(UNPAIRED[provider],null);
  cancelTimer();stopPoll();schedulePoll();
 }
 async function perform(json,only=null){
  if(ongoing)return ongoing.then(()=>perform(json,only));
  const currentEpoch=epoch;
  const run=async()=>{
   const results={};
   const stale=()=>({status:'stale-local',dirty:true,
    error:tr('Il workspace sul dispositivo è cambiato. Ripeti la sincronizzazione per inviare la versione più recente.',
             'The local workspace changed. Sync again to send the latest version.')});
   // A request queued behind an earlier upload must not push obsolete JSON.
   let confirmed;
   try{confirmed=await root.neuromapDesktop?.readWorkspace?.()}
   catch(error){
    for(const id of PROVIDERS)if((!only||only===id)&&enabled(id))
     results[id]={status:'error',dirty:true,error:String(error?.message||error).slice(0,150)};
    return results;
   }
   if(typeof confirmed!=='string'||confirmed!==json){
    for(const id of PROVIDERS)if((!only||only===id)&&enabled(id))results[id]=stale();
    return results;
   }
   for(const id of PROVIDERS){
    if(only&&only!==id||!enabled(id))continue;
    if(epoch!==currentEpoch)break;
    try{
     // Also recheck between providers after any asynchronous transfer.
     const before=await root.neuromapDesktop.readWorkspace();
     if(before!==json){results[id]=stale();continue;}
     results[id]=await upload(id,json);
    }catch(error){results[id]={status:'error',error:String(error?.message||error).slice(0,150)}}
   }
   return results;
  };
  ongoing=run().finally(()=>{ongoing=null});
  return ongoing;
 }
 // Called ONLY after native workspace write confirmed durable.
 function onWorkspaceSaved(json){
  if(suppress||!PROVIDERS.some(enabled)||typeof json!=='string')return;
  latest=json;
  cancelTimer();
  const captured=epoch;
  timer=root.setTimeout(()=>{
   timer=null;if(captured!==epoch||!PROVIDERS.some(enabled))return;
   void perform(latest);
  },9000);
 }
 async function syncNow(provider){
  if(!PROVIDERS.includes(provider)||!enabled(provider))
   throw Error(tr('Attiva prima la sincronizzazione per questo account.','Enable synchronization for this account first.'));
  await permitted(provider);
  cancelTimer();
  // Always upload the latest confirmed NATIVE workspace, not unsaved editor state.
  const app=root.neuroMapApp;
  if(!app||typeof app.persistWorkspace!=='function')
   throw Error('Glauka workspace unavailable');
  const saved=await app.persistWorkspace();
  if(saved!==true)throw Error(tr('Prima salva il workspace sul dispositivo.','Save your workspace on this device first.'));
  const savedNative=await root.neuromapDesktop.readWorkspace();
  const json=typeof savedNative==='string'?savedNative:JSON.stringify(savedNative);
  root.GlaukaCloudCore.assertDocument(json);
  return (await perform(json,provider))[provider]||{status:'pending'};
 }
 async function summary(provider){
  if(!PROVIDERS.includes(provider))throw Error('Unsupported provider');
  const base={enabled:enabled(provider),status:'local'};
  if(!base.enabled||!canUse())return base;
  try{
   const m=await getManager();
   const id=getValue(IDENTITIES[provider]);
   const doc=id?m.snapshot()[id]:null;
   const inbox=pendingFor(provider);
   return {...base,status:inbox?'incoming':doc?.status||'pending',dirty:!!doc?.dirty,
     lastSuccess:doc?.lastSuccess||null,error:doc?.error||null,
     incoming:!!inbox};
  }catch(error){return {...base,status:'error',error:String(error.message||error)}}
 }
 return Object.freeze({enabled,setEnabled,onWorkspaceSaved,syncNow,summary,
  acceptIncoming,forgetAccount});
});
