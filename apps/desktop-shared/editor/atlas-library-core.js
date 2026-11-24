/* NeuroMap 6.17 Atlas: bounded local snapshots of SAVED documents.
 * Closed-map records are derived metadata; original .neuromap/.xmind bytes
 * remain in their native file. No directory traversal or remote index.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapAtlasLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_DOCUMENTS=60,MAX_PER_DOCUMENT=1600,MAX_INDEX_NODES=30000,MAX_ALIASES=32;
 const string=(x,max=240)=>typeof x==='string'?x.slice(0,max):'';
 function normalizedPath(path){
  const s=string(path,1200);
  if(!s||s.includes('\0')||!(/^(?:[a-zA-Z]:[\\/]|\/)/.test(s)))return '';
  const fixed=s.replace(/\\/g,'/');
  // Windows filenames are case-insensitive; POSIX filenames are not.
  return /^[A-Za-z]:\//.test(fixed)?fixed.toLowerCase():fixed;
 }
 function keyFor(tab){
  const path=normalizedPath(tab?.filePath);
  if(!path)return '';
  const sheet=Number.isInteger(tab.originSheetIndex)&&tab.originSheetIndex>=0&&tab.originSheetIndex<=1000?
    tab.originSheetIndex:0;
  return 'file:'+path+'#'+sheet;
 }
 function idFor(tab){return keyFor(tab)||string(tab?.id,128)}
 function normalizeNode(n){
  if(!n||typeof n!=='object')return null;
  const id=string(n.id,128);if(!id)return null;
  return {id,text:string(n.text,220),notes:string(n.notes,280),
   parentId:string(n.parentId,128)||null,
   depth:Number.isSafeInteger(n.depth)&&n.depth>=0&&n.depth<=1024?n.depth:0};
 }
 function clean(raw){
  if(!Array.isArray(raw))return [];
  const found=new Map();let order=0;
  for(const record of raw.slice(0,MAX_DOCUMENTS*3)){
   if(!record||typeof record!=='object')continue;
   const path=normalizedPath(record.filePath);
   if(!path)continue;
   const tab={filePath:path,originSheetIndex:record.originSheetIndex};
   const key=keyFor(tab);if(!key)continue;
   const previous=found.get(key);
   // Untrusted or legacy timestamps must not displace a newer saved snapshot.
   const updatedAt=Number.isFinite(record.updatedAt)&&record.updatedAt>=0?
    Math.floor(record.updatedAt):0;
   const incomingAliases=(Array.isArray(record.tabIds)?record.tabIds:[])
    .slice(-MAX_ALIASES*3);
   const tabIds=[...new Set([...(previous?.tabIds||[]),...incomingAliases,
    record.tabId].map(x=>string(x,128)).filter(Boolean))].slice(-MAX_ALIASES);
   if(previous&&previous.updatedAt>updatedAt){
    // Older snapshots can still contain historical session IDs for backlinks.
    previous.tabIds=tabIds;
    continue;
   }
   const nodes=[],ids=new Set();
   for(const item of (Array.isArray(record.nodes)?record.nodes:[]).slice(0,MAX_PER_DOCUMENT)){
    const n=normalizeNode(item);
    if(!n||ids.has(n.id))continue;
    ids.add(n.id);nodes.push(n);
   }
   if(!nodes.length)continue;
   found.set(key,{key,filePath:path,originSheetIndex:tab.originSheetIndex??0,
    tabId:string(record.tabId,128),
    tabIds,
    title:string(record.title,220)||'NeuroMap',
    updatedAt,
    nodes,truncated:!!record.truncated,_order:order++});
  }
  let count=0;
  return [...found.values()].sort((a,b)=>b.updatedAt-a.updatedAt||b._order-a._order)
   .slice(0,MAX_DOCUMENTS).filter(entry=>{
    if(count+entry.nodes.length>MAX_INDEX_NODES)return false;
    count+=entry.nodes.length;return true;
   }).map(({_order,...entry})=>entry);
 }
 function capture(tab,Knowledge,force=false){
  if(!keyFor(tab)||!tab?.state?.root||(!force&&tab.state.isDirty))return null;
  const seen=Knowledge.walk(tab.state.root,MAX_PER_DOCUMENT+1);
  const entry={filePath:tab.filePath,originSheetIndex:tab.originSheetIndex??0,
   tabId:tab.id,tabIds:[tab.id],title:tab.title||tab.state.root.text,updatedAt:Date.now(),
   truncated:seen.length>MAX_PER_DOCUMENT,
   nodes:seen.slice(0,MAX_PER_DOCUMENT).map(n=>({
    id:n.id,text:n.text,notes:n.notes,parentId:n.parentId,depth:n.depth}))};
  return clean([entry])[0]||null;
 }
 function update(raw,tabs,Knowledge){
  const byKey=new Map(clean(raw).map(x=>[x.key,x]));
  for(const tab of Array.isArray(tabs)?tabs:[]){
   const snapshot=capture(tab,Knowledge);
   if(snapshot){
    const old=byKey.get(snapshot.key);
    if(old)snapshot.tabIds=[...new Set([...(old.tabIds||[]),...snapshot.tabIds])].slice(-MAX_ALIASES);
    byKey.set(snapshot.key,snapshot);
   }
  }
  return clean([...byKey.values()].sort((a,b)=>b.updatedAt-a.updatedAt));
 }
 function forget(raw,key){return clean(raw).filter(x=>x.key!==key)}
 function project(K,tabs,raw){
  const open=Array.isArray(tabs)?tabs:[],library=clean(raw);
  const records=[],perTab=new Map(),live=new Map(),aliases=new Map(),activeKeys=new Set();
  const max=K.MAX_NODES||50000;
  for(const tab of open.slice(0,100)){
   if(records.length>=max)break;
   const tabId=idFor(tab);if(!tabId||!tab?.state?.root||perTab.has(tabId))continue;
   if(keyFor(tab))activeKeys.add(tabId);
   const map=new Map(),walk=K.walk(tab.state.root,max-records.length);
   for(const n of walk){
    const item={tabId,nodeId:n.id,text:n.text,notes:n.notes,parentId:n.parentId,
     depth:n.depth,title:tab.title||tab.state.root.text,archived:false};
    records.push(item);map.set(item.nodeId,item);
   }
   perTab.set(tabId,map);live.set(tabId,tab.id);aliases.set(tab.id,tabId);
  }
  for(const entry of library){
   aliases.set(entry.tabId,entry.key);
   for(const formerId of entry.tabIds||[])aliases.set(formerId,entry.key);
   if(activeKeys.has(entry.key)||perTab.has(entry.key)||records.length>=max)continue;
   const map=new Map();
   for(const n of entry.nodes){
    if(records.length>=max)break;
    const item={...n,tabId:entry.key,nodeId:n.id,title:entry.title,
     archived:true,filePath:entry.filePath,originSheetIndex:entry.originSheetIndex,
     updatedAt:entry.updatedAt};
    delete item.id;
    records.push(item);map.set(item.nodeId,item);
   }
   perTab.set(entry.key,map);
  }
  return {records,perTab,live,aliases,limitReached:records.length>=max,
   archivedDocuments:library.filter(x=>!activeKeys.has(x.key)).length};
 }
 function stabilizeEdges(edges,tabs,raw){
  // Convert session-only tab IDs to durable file keys *before* the archive
  // advances to a new session; retain unknown/unresolved references untouched.
  const aliases=new Map();
  for(const entry of Array.isArray(raw)?raw:[]){
   if(!entry||typeof entry!=='object')continue;
   const key=keyFor(entry);
   if(!key)continue;
   for(const id of [...(Array.isArray(entry.tabIds)?entry.tabIds:[]),entry.tabId]){
    if(typeof id==='string'&&id)aliases.set(id,key);
   }
  }
  for(const tab of Array.isArray(tabs)?tabs:[]){
   const key=keyFor(tab);
   if(key&&typeof tab.id==='string')aliases.set(tab.id,key);
  }
  return (Array.isArray(edges)?edges:[]).slice(0,5000).map(e=>{
   if(!e||typeof e!=='object')return e;
   return {...e,fromTab:aliases.get(e.fromTab)||e.fromTab,
               toTab:aliases.get(e.toTab)||e.toTab};
  });
 }
 function normalizeEdges(K,edges,index){
  return K.normalizeEdges((Array.isArray(edges)?edges:[]).map(e=>({
   ...e,fromTab:index.aliases.get(e.fromTab)||e.fromTab,
   toTab:index.aliases.get(e.toTab)||e.toTab})),index);
 }
 return Object.freeze({MAX_DOCUMENTS,MAX_PER_DOCUMENT,MAX_INDEX_NODES,
  normalizedPath,keyFor,idFor,clean,capture,update,forget,project,stabilizeEdges,normalizeEdges});
});
