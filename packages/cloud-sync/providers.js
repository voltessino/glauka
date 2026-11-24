/* Minimal-privilege cloud provider drivers.
 * transport.send is a NATIVE authenticated HTTP transport. It injects Bearer
 * tokens after refreshing through OS-secure storage; JavaScript sees no keys.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudProviders=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function ensureNative(transport){
  if(typeof transport?.send!=='function')throw Error('Native authorized transport is required');
 }
 function safeId(id){
  if(!/^[A-Za-z0-9_-]{8,110}$/.test(id||'')||
     ['__proto__','constructor','prototype'].includes(id))
    throw Error('Invalid Glauka document ID');
  return id;
 }
 function check(result){
  if(!result||!Number.isInteger(result.status))throw Error('Invalid native cloud response');
  if(result.status<200||result.status>=300){
   const error=new Error('Cloud HTTP '+result.status);error.status=result.status;
   error.retryable=result.status===408||result.status===429||result.status>=500;
   if(result.status===409||result.status===412)error.conflict=true;
   throw error;
  }
  return result.json||{};
 }
 function google({transport}={}){
  ensureNative(transport);
  const base='https://www.googleapis.com/drive/v3/files';
  const upload='https://www.googleapis.com/upload/drive/v3/files';
  let folder=null;
  const send=(method,url,headers={},body=null,format='json')=>transport.send({
   provider:'google',method,url,headers,body,format});
  async function folderId(){
   // Recheck on every sync cycle. A cached folder ID could become split-brain
   // if a second device created a duplicate folder after our first upload.
   const query="trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Glauka'";
   const uri=base+'?fields=nextPageToken,incompleteSearch,files(id,name)&pageSize=100&q='+encodeURIComponent(query);
   const list=check(await send('GET',uri));
   if(!Array.isArray(list.files))throw Error('Invalid Google folder listing');
   if(list.incompleteSearch||list.nextPageToken||list.files.length>1)
    throw Error('Multiple or unverified Glauka folders: manual resolution required');
   if(list.files?.length){
    if(!list.files[0].id)throw Error('Glauka folder has no usable file ID');
    if(folder&&folder!==list.files[0].id)
     throw Error('Glauka folder changed on another device');
    folder=list.files[0].id;return folder;
   }
   if(folder)throw Error('Previously selected Glauka folder disappeared');
   const result=check(await send('POST',base+'?fields=id',{'Content-Type':'application/json'},
    JSON.stringify({name:'Glauka',mimeType:'application/vnd.google-apps.folder'})));
   if(!result.id)throw Error('Google Drive did not create the Glauka folder');
   // A second device may have created another /Glauka in parallel. Refuse
   // to upload into an ambiguous folder rather than splitting the library.
   const verified=check(await send('GET',uri));
   if(!Array.isArray(verified.files))throw Error('Invalid Google folder verification');
   if(verified.incompleteSearch||verified.nextPageToken||
       verified.files?.length!==1||verified.files[0].id!==result.id)
    throw Error('Glauka folder creation raced with another device');
   folder=result.id;return folder;
  }
  async function getMeta({id,remoteId}){
   safeId(id);
   // Query the latest document revision even if the local device remembers
   // an earlier file ID; Google snapshots are immutable and have new IDs.
   const parent=await folderId();
   const q="'"+parent+"' in parents and trashed = false and appProperties has { key='glaukaId' and value='"+id+"' }";
   const uri=base+'?q='+encodeURIComponent(q)+'&fields='+encodeURIComponent('nextPageToken,incompleteSearch,files(id,name,createdTime,md5Checksum,appProperties)')+
     '&orderBy=createdTime%20desc&pageSize=2';
   const res=check(await send('GET',uri));
   if(res.incompleteSearch)throw Error('Incomplete Google Drive revision listing');
   if(!Array.isArray(res.files))throw Error('Invalid Google revision listing');
   const files=res.files;
   if(files.length>1&&files[0].createdTime===files[1].createdTime&&
      files[0].appProperties?.glaukaHash!==files[1].appProperties?.glaukaHash)
    throw Error('Concurrent Glauka revisions: manual conflict review required');
   const found=files[0];
   if(found&&!found.id)throw Error('Google Drive returned an invalid revision');
   return found?{id:found.id,version:found.id+':'+(found.md5Checksum||found.createdTime||'unknown'),
     hash:found.appProperties?.glaukaHash||null,hashAlgorithm:'sha256'}:null;
  }
  async function create({id,name,bytes,hash,conflictCopy=false}){
   safeId(id);
   const parent=await folderId();
   const metadata={name:(conflictCopy?name:name||id+'.glk').slice(0,150),
    parents:[parent],mimeType:'application/json',
    appProperties:{glaukaId:id,glaukaHash:hash}};
   const length=new TextEncoder().encode(bytes).length;
   let response;
   if(length>5*1024*1024){
    // Large uploads MUST use native resumable sessions. Never buffer huge
    // payloads or silently downgrade to multipart.
    if(typeof transport.resumableUpload!=='function')
     throw Error('Google resumable upload not available on this device');
    response=await transport.resumableUpload({provider:'google',metadata,bytes});
   }else{
    const boundary='glauka_'+safeId(id).slice(0,30)+'_'+Date.now();
    const blob=new Blob([
     '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
     JSON.stringify(metadata),
     '\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n',
     bytes,
     '\r\n--'+boundary+'--'
    ],{type:'multipart/related; boundary='+boundary});
    response=await send('POST',upload+'?uploadType=multipart&fields=id,md5Checksum,createdTime',
     {'Content-Type':'multipart/related; boundary='+boundary},blob,'multipart');
   }
   const r=check(response);
   if(!r.id)throw Error('Google upload not acknowledged');
   return {id:r.id,version:r.id+':'+(r.md5Checksum||r.createdTime||'unknown'),hash};
  }
  async function update({id,name,bytes,hash}){
   // Google Drive v3 has no reliable documented compare-and-swap guarantee
   // for overwriting media. Store immutable snapshot revisions instead: even
   // races cannot destroy an earlier revision.
   return create({id,name,bytes,hash});
  }
  async function listRemote(){
   const parent=await folderId();
   const q="'"+parent+"' in parents and trashed = false and mimeType = 'application/json'";
   const fields='nextPageToken,incompleteSearch,files(id,name,createdTime,md5Checksum,appProperties)';
   const discovered=new Map(),tokens=new Set();
   let pageToken=null,count=0;
   for(let page=0;page<20;page++){
    const u=new URL(base);
    u.searchParams.set('q',q);u.searchParams.set('fields',fields);
    u.searchParams.set('pageSize','100');u.searchParams.set('orderBy','createdTime desc');
    if(pageToken)u.searchParams.set('pageToken',pageToken);
    const result=check(await send('GET',u.toString()));
    if(result.incompleteSearch||!Array.isArray(result.files))
     throw Error('Incomplete Google Drive discovery');
    count+=result.files.length;
    if(count>1000)throw Error('Google Drive discovery exceeds 1000 entries');
    for(const file of result.files){
     const id=file.appProperties?.glaukaId;
     if(!id||!file.id||!safeId(id))continue;
     if(!file.createdTime||!file.appProperties?.glaukaHash)
      throw Error('Unverifiable Glauka remote revision');
     const entry={id,remoteId:file.id,name:String(file.name||id+'.glk').slice(0,150),
      version:file.id+':'+(file.md5Checksum||file.createdTime),
      hash:file.appProperties.glaukaHash,hashAlgorithm:'sha256',
      createdTime:file.createdTime};
     const prior=discovered.get(id);
     if(!prior){discovered.set(id,entry);continue}
     // Search order alone is not reliable as a distributed sequence number.
     if(file.createdTime===prior.createdTime&&entry.hash!==prior.hash)
      throw Error('Ambiguous concurrent Google document revisions: '+id);
     if(file.createdTime>prior.createdTime)discovered.set(id,entry);
    }
    if(!result.nextPageToken)return [...discovered.values()];
    if(typeof result.nextPageToken!=='string'||tokens.has(result.nextPageToken))
     throw Error('Invalid or looping Google Drive discovery cursor');
    tokens.add(result.nextPageToken);pageToken=result.nextPageToken;
   }
   throw Error('Google Drive discovery pagination limit exceeded');
  }
  async function download({id,remoteId}){
   const record=await getMeta({id,remoteId});
   if(!record)throw Error('Cloud file missing');
   const result=await send('GET',base+'/'+encodeURIComponent(record.id)+'?alt=media',{},null,'bytes');
   check(result);
   return {bytes:result.bytes,metadata:record};
  }
  return Object.freeze({getMeta,create,update,download,folderId,listRemote});
 }
 function dropbox({transport}={}){
  ensureNative(transport);
  const rpc='https://api.dropboxapi.com/2/files/';
  const content='https://content.dropboxapi.com/2/files/';
  const send=(method,url,headers={},body=null,format='json')=>transport.send({
   provider:'dropbox',method,url,headers,body,format});
  let hasFolder=false;
  async function ensureFolder(){
   if(hasFolder)return;
   const result=await send('POST',rpc+'create_folder_v2',{'Content-Type':'application/json'},
    JSON.stringify({path:'/Glauka',autorename:false}));
   if(result.status===409){
    // Folder might already exist; verify that it IS a folder, not a file.
    const checkFolder=check(await send('POST',rpc+'get_metadata',{'Content-Type':'application/json'},
      JSON.stringify({path:'/Glauka'})));
    if(checkFolder['.tag']!=='folder')throw Error('Dropbox Glauka path is occupied');
   }else check(result);
   hasFolder=true;
  }
  const nameFor=id=>'/Glauka/'+safeId(id)+'.glk';
  async function getMeta({id,remoteId}){
   const path=remoteId||nameFor(id);
   const r=await send('POST',rpc+'get_metadata',{'Content-Type':'application/json'},
    JSON.stringify({path}));
   if(r.status===409){
    // Dropbox uses 409 for many errors, not just a missing path.
    if(/^path\/not_found(?:\/|$)/i.test(String(r.json?.error_summary||'')))return null;
    return check(r); // keep permission/path conflicts explicit
   }
   const m=check(r);
   if(m['.tag']!=='file')throw Error('Dropbox document is not a file');
   // Dropbox content_hash is a SHA-256-of-4MiB-block-SHA256s, NOT a direct
   // SHA-256 hash. Never compare it with the engine's SHA-256(local JSON).
   return {id:m.path_lower||path,version:m.rev,hash:null,
    contentHash:m.content_hash||null,hashAlgorithm:'dropbox-content-hash'};
  }
  async function create({id,bytes,conflictCopy=false}){
   await ensureFolder();
   let target=nameFor(id);
   if(conflictCopy)target='/Glauka/'+safeId(id)+'-conflict-'+Date.now()+'.glk';
   const h={'Content-Type':'application/octet-stream',
    'Dropbox-API-Arg':JSON.stringify({path:target,mode:'add',autorename:false,mute:true})};
   const r=check(await send('POST',content+'upload',h,bytes,'bytes'));
   return {id:r.path_lower||target,version:r.rev,hash:r.content_hash||null};
  }
  async function update({id,remoteId,expectedVersion,bytes}){
   if(!expectedVersion)throw Error('Dropbox revision required for compare-and-swap');
   const target=remoteId||nameFor(id);
   const h={'Content-Type':'application/octet-stream',
    'Dropbox-API-Arg':JSON.stringify({path:target,mode:{'.tag':'update',update:expectedVersion},
      autorename:false,mute:true})};
   const r=check(await send('POST',content+'upload',h,bytes,'bytes'));
   return {id:r.path_lower||target,version:r.rev,hash:r.content_hash||null};
  }
  async function listRemote(){
   await ensureFolder();
   const seen=new Set(),entries=new Map();
   let cursor=null,count=0;
   for(let page=0;page<20;page++){
    const endpoint=cursor?'list_folder/continue':'list_folder';
    const payload=cursor?{cursor}:{path:'/Glauka',recursive:false,
      include_deleted:false,limit:100};
    const out=check(await send('POST',rpc+endpoint,
      {'Content-Type':'application/json'},JSON.stringify(payload)));
    if(!Array.isArray(out.entries)||typeof out.has_more!=='boolean')
     throw Error('Invalid Dropbox discovery listing');
    count+=out.entries.length;
    if(count>1000)throw Error('Dropbox discovery exceeds 1000 entries');
    for(const file of out.entries){
     if(file['.tag']!=='file')continue;
     const remotePath=String(file.path_lower||'');
     const match=/^\/glauka\/([A-Za-z0-9_-]{8,110})\.glk$/.exec(remotePath);
     if(!match)continue;
     const id=match[1];
     if(!safeId(id)||!file.rev)throw Error('Invalid Dropbox Glauka metadata');
     if(entries.has(id))throw Error('Dropbox duplicate logical document '+id);
     entries.set(id,{id,remoteId:remotePath,version:file.rev,
      name:String(file.name||id+'.glk').slice(0,150),hash:null,
      hashAlgorithm:'dropbox-content-hash',contentHash:file.content_hash||null});
    }
    if(!out.has_more)return [...entries.values()];
    if(typeof out.cursor!=='string'||!out.cursor||seen.has(out.cursor))
     throw Error('Invalid or looping Dropbox discovery cursor');
    seen.add(out.cursor);cursor=out.cursor;
   }
   throw Error('Dropbox discovery pagination limit exceeded');
  }
  async function download({id,remoteId}){
   const record=await getMeta({id,remoteId});
   if(!record)throw Error('Dropbox file missing');
   const r=await send('POST',content+'download',
    {'Dropbox-API-Arg':JSON.stringify({path:record.id})},null,'bytes');
   check(r);
   return {bytes:r.bytes,metadata:record};
  }
  return Object.freeze({getMeta,create,update,download,ensureFolder,listRemote});
 }

 // OneDrive: immutable, app-scoped revisions using Microsoft Graph's approot.
 // The user sees files in Apps/Glauka; old revisions survive concurrent writes.
 function onedrive({transport}={}){
  ensureNative(transport);
  const base='https://graph.microsoft.com/v1.0/me/drive';
  const logical=/^glw_[a-f0-9]{32}$/;
  const itemId=/^[A-Za-z0-9!._-]{1,180}$/;
  const filename=/^(glw_[a-f0-9]{32})__([a-f0-9]{32})\.glk$/;
  const send=(method,url,headers={},body=null,format='json')=>transport.send({
   provider:'onedrive',method,url,headers,body,format});
  const guarded=id=>{if(!itemId.test(id)||id==='..')throw Error('Invalid OneDrive item ID');return id};
  const validate=id=>{safeId(id);if(!logical.test(id))throw Error('Invalid OneDrive logical ID');return id};
  let folder=null;
  async function folderId(){
   // Microsoft Graph creates the app's own Apps/Glauka folder on first access.
   const response=check(await send('GET',base+'/special/approot'));
   if(!itemId.test(response.id||''))throw Error('OneDrive app folder ID missing');
   if(folder&&folder!==response.id)throw Error('OneDrive app folder changed');
   folder=response.id;return folder;
  }
  async function revisions(){
   await folderId();
   let next=base+'/special/approot/children?$select=id,name,eTag,createdDateTime,file&$top=200';
   const visited=new Set(),latest=new Map();
   let count=0;
   for(let page=0;page<8;page++){
    if(visited.has(next))throw Error('Looping OneDrive pagination');
    visited.add(next);
    // The Graph server controls nextLink, but it must stay inside this folder.
    if(!next.startsWith(base+'/special/approot/children?'))throw Error('OneDrive pagination outside app folder');
    const response=check(await send('GET',next));
    if(!Array.isArray(response.value))throw Error('Invalid OneDrive app folder listing');
    count+=response.value.length;
    if(count>1000)throw Error('OneDrive discovery exceeds 1000 files');
    for(const item of response.value){
     const match=filename.exec(String(item?.name||''));
     if(!match)continue; // Ignore unrelated personal files in the app folder.
     if(!itemId.test(item.id||'')||!item.file||!item.createdDateTime)
      throw Error('Unverifiable OneDrive item');
     const id=match[1],created=item.createdDateTime;
     const entry={id,name:'Area di lavoro Glauka',remoteId:item.id,
      version:item.id+':'+(item.eTag||created),
      hash:null,hashAlgorithm:'onedrive-etag',
      createdTime:created};
     const previous=latest.get(id);
     if(previous&&previous.createdTime===created&&previous.remoteId!==item.id)
      throw Error('Concurrent OneDrive revisions need manual review');
     if(!previous||created>previous.createdTime)latest.set(id,entry);
    }
    const after=response['@odata.nextLink'];
    if(!after)return [...latest.values()];
    if(typeof after!=='string'||after.length>2400)throw Error('Invalid OneDrive cursor');
    next=after;
   }
   throw Error('OneDrive pagination limit exceeded');
  }
  async function listRemote(){return revisions()}
  async function getMeta({id}){
   validate(id);
   const list=await revisions();
   const entry=list.find(row=>row.id===id);
   return entry?{id:entry.remoteId,version:entry.version,
    hash:null,hashAlgorithm:'onedrive-etag'}:null;
  }
  async function create({id,bytes}){
   validate(id);
   if(typeof bytes!=='string')throw Error('OneDrive workspace must be UTF-8 JSON');
   const parent=await folderId();
   if(typeof globalThis.crypto?.getRandomValues!=='function')
    throw Error('Secure random file ID required');
   const random=new Uint8Array(16);globalThis.crypto.getRandomValues(random);
   const suffix=Array.from(random,v=>v.toString(16).padStart(2,'0')).join('');
   const file=id+'__'+suffix+'.glk';
   const url=base+'/items/'+guarded(parent)+':/'+file+':/content';
   // A 128-bit random filename makes revisions immutable in practice;
   // Microsoft Graph's basic PUT /content API does not document If-None-Match
   // for new-file creation. Never depend on an unsupported conditional header.
   const item=check(await send('PUT',url,
    {'Content-Type':'application/octet-stream'},bytes));
   if(!itemId.test(item.id||''))throw Error('OneDrive upload was not acknowledged');
   return {id:item.id,version:item.id+':'+(item.eTag||item.createdDateTime||'new'),hash:null};
  }
  async function update({id,expectedVersion,bytes}){
   validate(id);
   // An intervening update is a conflict; earlier revisions remain in the app folder.
   const current=await getMeta({id});
   if(!current||!expectedVersion||current.version!==expectedVersion){
    const conflict=new Error('OneDrive revision changed before upload');
    conflict.status=412;conflict.conflict=true;throw conflict;
   }
   return create({id,bytes});
  }
  async function download({id}){
   validate(id);
   const metadata=await getMeta({id});
   if(!metadata)throw Error('OneDrive workspace not found');
   const out=await send('GET',base+'/items/'+guarded(metadata.id)+'/content',{},null,'bytes');
   check(out);
   return {bytes:out.bytes,metadata};
  }
  return Object.freeze({folderId,listRemote,getMeta,create,update,download});
 }

 return Object.freeze({google,dropbox,onedrive});
});
