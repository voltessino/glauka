/* F11.0 — Safe local single-map handoff contract. No transport or ACL here.
 * A share manifest is NOT an invitation, identity proof or authorization.
 * The caller must authenticate peers, persist bytes durably and obtain
 * permission before sending anything to a remote transport.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GlaukaMapSharingCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SCHEMA='GlaukaMapHandoff-v1';
 const PROJECT_SCHEMA='NeuroMapArchitect-SingleTab-v6';
 const MAX_BYTES=25*1024*1024,MAX_NODES=3500;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const HASH=/^[a-f0-9]{64}$/;
 const fields=['schema','mapId','deviceId','revision','parentHash',
  'sha256','byteLength','createdAt'];
 const validUUID=s=>typeof s==='string'&&UUID.test(s);
 const validHash=s=>typeof s==='string'&&HASH.test(s);
 const bytesOf=str=>{
   if(typeof TextEncoder!=='function')throw Error('UTF-8 encoder unavailable');
   return new TextEncoder().encode(str).byteLength;
 };
 const has=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
 function assertProject(project){
  if(!project||typeof project!=='object'||Array.isArray(project)||
      project.schema!==PROJECT_SCHEMA||!project.root||
      typeof project.root!=='object'||Array.isArray(project.root)||
      has(project,'tabs'))
    throw Error('A Glauka share requires one SingleTab-v6 map, never a workspace');
  if(project.images!==undefined&&!Array.isArray(project.images))
    throw Error('Invalid Glauka images');
  if(project.relationships!==undefined&&!Array.isArray(project.relationships))
    throw Error('Invalid Glauka relationships');
  const seen=new Set(),ids=new Set(),stack=[project.root];let nodes=0;
  while(stack.length){
   const node=stack.pop();
   if(!node||typeof node!=='object'||Array.isArray(node)||seen.has(node)||
      typeof node.id!=='string'||!node.id||node.id.length>200||
      /[\u0000-\u001f]/.test(node.id)||ids.has(node.id)||
      typeof node.text!=='string'||!Array.isArray(node.children))
     throw Error('Invalid or cyclic Glauka tree');
   seen.add(node);ids.add(node.id);nodes++;
   if(nodes>MAX_NODES)throw Error('Glauka handoff exceeds node limit');
   for(let i=node.children.length-1;i>=0;i--)stack.push(node.children[i]);
  }
  return Object.freeze({rootId:project.root.id,nodes,
   title:project.root.text.slice(0,120),images:project.images?.length||0});
 }
 function assertManifest(m){
  if(!m||typeof m!=='object'||Array.isArray(m)||
      Object.keys(m).length!==fields.length||
      fields.some(k=>!has(m,k))||m.schema!==SCHEMA||
      !validUUID(m.mapId)||!validUUID(m.deviceId)||
      !Number.isSafeInteger(m.revision)||m.revision<1||
      (m.revision===1?m.parentHash!==null:!validHash(m.parentHash))||
      !validHash(m.sha256)||!Number.isSafeInteger(m.byteLength)||
      m.byteLength<1||m.byteLength>MAX_BYTES||
      typeof m.createdAt!=='string'||m.createdAt.length!==24||
      Number.isNaN(Date.parse(m.createdAt))||
      new Date(m.createdAt).toISOString()!==m.createdAt)
    throw Error('Invalid Glauka handoff manifest');
  return m;
 }
 async function makeHandoff(project,{mapId,deviceId,revision=1,
    parentHash=null,sha256,createdAt=new Date().toISOString()}={}){
  const summary=assertProject(project);
  if(!validUUID(mapId)||!validUUID(deviceId)||
     typeof sha256!=='function')
   throw Error('Secure map/device IDs and a SHA-256 implementation required');
  // Serialize once: subsequent editor changes cannot mutate these bytes.
  const bytes=JSON.stringify(project);
  const byteLength=bytesOf(bytes);
  if(byteLength>MAX_BYTES)throw Error('Glauka handoff exceeds 25 MiB');
  const digest=await sha256(bytes);
  const manifest=Object.freeze({
   schema:SCHEMA,mapId,deviceId,revision,parentHash,
   sha256:String(digest).toLowerCase(),byteLength,createdAt
  });
  assertManifest(manifest);
  return Object.freeze({manifest,bytes,summary});
 }
 async function verifyHandoff({manifest,bytes,sha256}={}){
  assertManifest(manifest);
  if(typeof bytes!=='string'||typeof sha256!=='function'||
     bytesOf(bytes)!==manifest.byteLength)
   throw Error('Glauka handoff byte length mismatch');
  const actual=await sha256(bytes);
  if(typeof actual!=='string'||actual.toLowerCase()!==manifest.sha256)
   throw Error('Glauka handoff integrity mismatch');
  let project;try{project=JSON.parse(bytes)}catch{throw Error('Invalid Glauka JSON')}
  const summary=assertProject(project);
  return Object.freeze({project,summary,manifest});
 }
 // Classifier ONLY. The host must recheck the local hash against durable
 // storage immediately before applying a fast-forward, and back up first.
 function reviewRevision(local,incoming,{localDirty=false}={}){
  assertManifest(incoming);
  if(local===null||local===undefined)
   return Object.freeze({status:'new-map',mayReplace:false});
  assertManifest(local);
  if(local.mapId!==incoming.mapId)
   return Object.freeze({status:'other-map',mayReplace:false});
  if(local.sha256===incoming.sha256)
   return Object.freeze({status:'identical',mayReplace:false});
  if(localDirty)
   return Object.freeze({status:'conflict',mayReplace:false});
  if(incoming.revision<local.revision)
   return Object.freeze({status:'stale',mayReplace:false});
  if(incoming.revision===local.revision)
   return Object.freeze({status:'conflict',mayReplace:false});
  if(incoming.revision>local.revision+1)
   return Object.freeze({status:'history-gap',mayReplace:false});
  if(incoming.parentHash===local.sha256)
   return Object.freeze({status:'fast-forward-candidate',mayReplace:false,
    requiresBackup:true,requiresLocalRecheck:true});
  return Object.freeze({status:'conflict',mayReplace:false});
 }
 return Object.freeze({SCHEMA,PROJECT_SCHEMA,MAX_BYTES,MAX_NODES,
  assertProject,assertManifest,makeHandoff,verifyHandoff,reviewRevision});
});
