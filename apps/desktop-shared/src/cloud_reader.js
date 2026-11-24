/* Glauka: manual cloud recovery, no automatic syncing or token handling.
 * Import uses the existing application importer and then native durable
 * workspace save. No shared cloud index: different accounts/providers cannot
 * collide until account-namespaced two-way sync is implemented.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudReader=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function createReader({providers,hash,assertDocument,editor,onChange=()=>{},isAllowed=()=>true}={}){
  if(!providers||typeof providers.google!=='function'||typeof providers.dropbox!=='function'||
     typeof hash!=='function'||typeof assertDocument!=='function'||
     typeof editor!=='function')throw Error('Missing cloud recovery dependency');
  const cache=new Map(),active=new Set();
  const allowed=new Set(['google','dropbox']);
  if(typeof providers.onedrive==='function')allowed.add('onedrive');
  function providerFor(id){
   if(!allowed.has(id))throw Error('Unsupported cloud provider');
   return providers[id]();
  }
  async function discover(provider){
   if(active.has(provider))throw Error('Cloud operation already in progress');
   active.add(provider);
   try{
    onChange({provider,state:'searching'});
    const entries=await providerFor(provider).listRemote();
    if(!Array.isArray(entries)||entries.length>1000)throw Error('Unsafe remote list');
    const seen=new Set(),visible=[];
    for(const record of entries){
     if(!record||typeof record.id!=='string'||
      !/^[A-Za-z0-9_-]{8,110}$/.test(record.id)||
      ['__proto__','constructor','prototype'].includes(record.id)||
      !record.remoteId||!record.version||seen.has(record.id))
       throw Error('Ambiguous cloud library');
     seen.add(record.id);
     const name=String(record.name||record.id+'.glk')
       .replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,110);
     visible.push(Object.freeze({id:record.id,name,version:record.version,
       remoteId:record.remoteId}));
    }
    cache.set(provider,visible);
    onChange({provider,state:'listed',count:visible.length});
    return visible.map(x=>({...x}));
   }catch(err){
    cache.delete(provider);
    onChange({provider,state:'error'});
    throw err;
   }finally{active.delete(provider)}
  }
  async function restore(provider,id){
   if(active.has(provider))throw Error('Cloud operation already in progress');
   if(!allowed.has(provider))throw Error('Unsupported cloud provider');
   const entry=cache.get(provider)?.find(row=>row.id===id);
   if(!entry)throw Error('Select a document from the verified cloud list first');
   if(!isAllowed())throw Error('Cloud recovery cancelled');
   active.add(provider);
   try{
    onChange({provider,state:'downloading',id});
    // Re-discover remote metadata to ensure the user's selection is current.
    const driver=providerFor(provider);
    const latest=await driver.listRemote();
    const matched=latest.find(x=>x.id===id);
    if(!matched||matched.remoteId!==entry.remoteId||matched.version!==entry.version)
     throw Error('Remote revision changed; refresh list and review before import');
    const result=await driver.download({id,remoteId:entry.remoteId});
    if(!result||typeof result.bytes!=='string'||!result.metadata||
      result.metadata.id!==entry.remoteId||result.metadata.version!==entry.version)
      throw Error('Remote revision changed during download');
    assertDocument(result.bytes);
    const localHash=await hash(result.bytes);
    if(result.metadata.hashAlgorithm==='sha256'&&result.metadata.hash&&
       result.metadata.hash!==localHash)
       throw Error('Remote document integrity check failed');
    // A user may close the cloud dialog or disconnect the account while
    // a provider request is in flight. Do not import after cancellation.
    if(!isAllowed())throw Error('Cloud recovery cancelled');
    const app=editor();
    if(!app||typeof app.importFile!=='function'||typeof app.persistWorkspace!=='function')
     throw Error('Glauka editor is not ready');
    // Force JSON importer, not .glk (which the legacy parser sees as Markdown).
    const filename=entry.name.replace(/\.(?:glk|neuromap|json)$/i,'').slice(0,95)+'.json';
    const file=new File([result.bytes],filename,{type:'application/json'});
    // Never silently replace a user's existing tab. The importer validates
    // the whole workspace structure before applying any sheets.
    const count=await app.importFile(file,{newTab:true});
    onChange({provider,state:'saving',id});
    const persisted=await app.persistWorkspace();
    if(persisted!==true)throw Error('Cloud map loaded but local save is not confirmed. Export a backup now.');
    onChange({provider,state:'restored',id,count});
    return {id,name:entry.name,count,savedLocally:true};
   }catch(err){
    onChange({provider,state:'error',id});
    throw err;
   }finally{active.delete(provider)}
  }
  return Object.freeze({discover,restore});
 }
 return Object.freeze({createReader});
});
