/* NeuroMap 6.17 Source Lens — explicit, bounded provenance only.
 * PDF contents are NEVER embedded in projects or uploaded to services.
 * A reference records the original filename / SHA-256, page and selected quote.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapSourceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_REFS=16,MAX_QUOTE=1800,MAX_TITLE=180,MAX_FILE=255;
 const value=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
 function safeUrl(v){
  const input=value(v,2048);if(!input)return '';
  try{
   const u=new URL(input);
   if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';
   return u.href;
  }catch{return ''}
 }
 function normalize(ref){
  if(!ref||typeof ref!=='object'||Array.isArray(ref))return null;
  const kind=ref.kind;
  if(!['pdf','web','text'].includes(kind))return null;
  const title=value(ref.title,MAX_TITLE),quote=value(ref.quote,MAX_QUOTE);
  const page=Number(ref.page),pageNumber=Number.isSafeInteger(page)&&page>=1&&page<=100000?page:null;
  const url=kind==='web'?safeUrl(ref.url):'';
  const fileName=kind==='pdf'?value(ref.fileName,MAX_FILE):'';
  const sha256=kind==='pdf'&&/^[a-f0-9]{64}$/i.test(ref.sha256||'')?ref.sha256.toLowerCase():'';
  if(kind==='web'&&!url)return null;
  if(kind==='pdf'&&(!fileName||pageNumber===null||!sha256))return null;
  if(kind==='text'&&!quote)return null;
  const id=value(ref.id,100);
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))return null;
  return {id,kind,title:title||fileName||(kind==='web'?url.slice(0,MAX_TITLE):'Excerpt'),
   ...(kind==='pdf'?{fileName,sha256,page:pageNumber}:{}),
   ...(kind==='web'?{url}:{}),
   quote,createdAt:typeof ref.createdAt==='string'&&/^\d{4}-\d\d-\d\dT/.test(ref.createdAt)?
     ref.createdAt.slice(0,32):''};
 }
 function normalizeAll(refs){
  if(!Array.isArray(refs))return [];
  const out=[],seen=new Set();
  for(const candidate of refs.slice(0,MAX_REFS*3)){
   const r=normalize(candidate);
   if(!r||seen.has(r.id))continue;
   seen.add(r.id);out.push(r);
   if(out.length>=MAX_REFS)break;
  }return out;
 }
 function attach(node,ref){
  const item=normalize(ref);
  if(!node||!item)return false;
  const existing=normalizeAll(node.sourceRefs);
  if(existing.some(x=>x.id===item.id)||existing.length>=MAX_REFS)return false;
  node.sourceRefs=[...existing,item];return true;
 }
 function sameDocument(ref,digest){
  const item=normalize(ref);
  return !!(item&&item.kind==='pdf'&&item.sha256&&digest===item.sha256);
 }
 function detach(node,id){
  if(!node||!Array.isArray(node.sourceRefs))return false;
  const old=normalizeAll(node.sourceRefs),next=old.filter(x=>x.id!==id);
  if(next.length===old.length)return false;
  node.sourceRefs=next;return true;
 }
 function newId(){
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')
   return 'src_'+crypto.randomUUID().replace(/-/g,'');
  throw Error('Secure random IDs not available');
 }
 function isPDF(file){
  return !!file && /\.pdf$/i.test(file.name||'') &&
   Number.isFinite(file.size)&&file.size>0&&file.size<=80*1024*1024 &&
   (!file.type||file.type==='application/pdf');
 }
 async function fingerprint(file){
  if(!isPDF(file))throw Error('Only PDF files up to 80 MB are supported');
  if(!globalThis.crypto?.subtle?.digest)throw Error('SHA-256 is not available');
  const content=await file.arrayBuffer();
  if(String.fromCharCode(...new Uint8Array(content).slice(0,5))!=='%PDF-')
   throw Error('File is not a valid PDF header');
  const hash=await globalThis.crypto.subtle.digest('SHA-256',content);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 return Object.freeze({MAX_REFS,MAX_QUOTE,normalize,normalizeAll,attach,detach,
  sameDocument,safeUrl,newId,isPDF,fingerprint});
});
