/* 7.3 Portable Exchange: manual, conflict-aware OFFLINE project copies.
 * This is NOT cloud sync, multiuser editing or automatic overwrite.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapPortableExchange=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const SCHEMA='NeuroMapPortableExchange-v1',MAX_BYTES=25*1024*1024,MAX_NODES=3500;
 function validate(project){
  if(!project||project.schema!=='NeuroMapArchitect-SingleTab-v6'||!project.root||typeof project.root!=='object')
   throw Error('Select a valid NeuroMap single-tab project');
  const ids=new Set(),seen=new Set(),stack=[project.root];
  while(stack.length){
   const n=stack.pop();
   if(!n||typeof n!=='object'||seen.has(n)||typeof n.id!=='string'||!n.id||ids.has(n.id))throw Error('Invalid map structure');
   seen.add(n);ids.add(n.id);
   if(ids.size>MAX_NODES)throw Error('Portable copy exceeds 3,500 nodes');
   if(!Array.isArray(n.children))throw Error('Invalid node children');
   for(const child of n.children)stack.push(child);
  }
  return {nodes:ids.size,rootId:project.root.id,title:String(project.root.text||'Map').slice(0,120)};
 }
 function stable(project){
  // Ignore only export timestamps, never editable user content.
  return JSON.stringify({root:project.root,images:project.images||[],
   relationships:project.relationships||[],studyCards:project.studyCards||[],
   learningAttempts:project.learningAttempts||[],learningPlan:project.learningPlan||null,
   layout:{thresholdY:project.thresholdY,balanceBias:project.balanceBias,compactness:project.compactness,
    branchGapX:project.branchGapX,strokeScale:project.strokeScale,activeThemeId:project.activeThemeId,
    typographyPreset:project.typographyPreset,typographyScale:project.typographyScale,
    branchStyle:project.branchStyle,defaultLabelWrapChars:project.defaultLabelWrapChars,wrapCustom:project.wrapCustom}});
 }
 async function checksum(text){
  if(!root.crypto?.subtle?.digest||typeof root.TextEncoder!=='function')throw Error('SHA-256 unavailable in this environment');
  const sum=await root.crypto.subtle.digest('SHA-256',new root.TextEncoder().encode(text));
  return [...new Uint8Array(sum)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 async function create(project){
  const details=validate(project),serialized=JSON.stringify(project);
  if(serialized.length>MAX_BYTES)throw Error('Project exceeds 25 MB portable limit');
  const hash=await checksum(stable(project));
  return Object.freeze({format:SCHEMA,createdAt:new Date().toISOString(),manifest:{...details,sha256:hash},
   project});
 }
 function indexed(root){
  const nodes=new Map(),stack=[root];
  while(stack.length){
   const n=stack.pop();
   const field={...n,children:(n.children||[]).map(c=>c.id)};
   nodes.set(n.id,JSON.stringify(field));
   for(const c of n.children||[])stack.push(c);
  }
  return nodes;
 }
 function compareNodes(a,b){
  const left=indexed(a),right=indexed(b);
  let added=0,removed=0,modified=0;
  for(const [id,json]of right){if(!left.has(id))added++;else if(left.get(id)!==json)modified++}
  for(const id of left.keys())if(!right.has(id))removed++;
  return {added,removed,modified};
 }
 async function inspect(raw,local){
  const envelope=typeof raw==='string'?JSON.parse(raw):raw;
  if(!envelope||envelope.format!==SCHEMA||!envelope.project||!envelope.manifest)
   throw Error('Not a NeuroMap portable exchange file');
  const bytes=JSON.stringify(envelope);
  if(bytes.length>MAX_BYTES)throw Error('Portable copy exceeds 25 MB');
  const details=validate(envelope.project),actual=await checksum(stable(envelope.project));
  if(!/^[a-f0-9]{64}$/.test(envelope.manifest.sha256||'')||actual!==envelope.manifest.sha256||
     details.rootId!==envelope.manifest.rootId||details.nodes!==envelope.manifest.nodes)
   throw Error('Portable copy checksum or manifest mismatch');
  const localDetails=validate(local),localHash=await checksum(stable(local));
  const sameProject=details.rootId===localDetails.rootId;
  const equal=sameProject&&actual===localHash;
  return Object.freeze({
   status:equal?'identical':sameProject?'divergent':'different-project',
   incoming:details,current:localDetails,
   differences:sameProject?compareNodes(local.root,envelope.project.root):null,
   incomingHash:actual,currentHash:localHash,
   // A verified project is offered for explicit open-as-copy only.
   project:envelope.project
  });
 }
 return Object.freeze({SCHEMA,MAX_BYTES,MAX_NODES,create,inspect,validate,compareNodes});
});
