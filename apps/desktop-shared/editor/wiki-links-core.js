/* NeuroMap 7.5 Knowledge Links. Offline, read-only index of map notes.
 * Canonical references use stable map-root/node IDs instead of transient tab IDs.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapWikiLinks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_NOTE=50000,MAX_LINKS=64,MAX_NODES=40000,MAX_INDEX_TEXT=5000000;
 const key=(a,b)=>JSON.stringify([a,b]);
 const fold=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const validId=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\u0000-\u001f]/.test(v);
 const label=v=>String(v||'').trim().replace(/[|\]\r\n]/g,' ').slice(0,140);
 function format(target){
  if(!validId(target?.rootId)||!validId(target?.nodeId))throw Error('Invalid logical node ID');
  return '[[nm:'+encodeURIComponent(target.rootId)+'/'+encodeURIComponent(target.nodeId)+'|'+label(target.title||target.nodeId)+']]';
 }
 function parseRef(value){
  const raw=String(value||'').trim();
  if(raw.startsWith('nm:')){
   const hit=/^nm:([^/\s]+)\/([^|\s]+)(?:\|([\s\S]*))?$/.exec(raw);
   if(!hit)return {kind:'invalid',label:label(raw)};
   try{
    const rootId=decodeURIComponent(hit[1]),nodeId=decodeURIComponent(hit[2]);
    if(!validId(rootId)||!validId(nodeId))throw Error('Bad ID');
    return {kind:'id',rootId,nodeId,label:label(hit[3]||nodeId)};
   }catch{return {kind:'invalid',label:label(raw)}}
  }
  if(raw.includes('|'))return {kind:'invalid',label:label(raw)};
  if(!raw||raw.length>140)return {kind:'invalid',label:label(raw)};
  return {kind:'title',query:fold(raw),label:label(raw)};
 }
 function parse(text){
  const source=String(text??'');
  const links=[],lines=source.slice(0,MAX_NOTE).replace(/\r\n?/g,'\n').split('\n');
  let fence='',overflow=source.length>MAX_NOTE;
  for(const line of lines){
   const mark=/^\s{0,3}(\x60{3,}|~{3,})/.exec(line);
   if(mark){
    if(!fence)fence=mark[1][0]+mark[1].length;
    else if(mark[1][0]===fence[0]&&mark[1].length>=Number(fence.slice(1)))fence='';
    continue;
   }
   if(fence)continue;
   const safe=line.replace(/(\x60+)([\s\S]*?)\1/g,match=>' '.repeat(match.length));
   const matcher=/\[\[([^\]\r\n]{1,240})\]\]/g;let match;
   while((match=matcher.exec(safe))){
    if(links.length>=MAX_LINKS){overflow=true;break}
    links.push({...parseRef(match[1]),raw:match[0],offset:match.index});
   }
   if(links.length>=MAX_LINKS)break;
  }
  return {links,overflow};
 }
 function index(tabs,{maxNodes=MAX_NODES,maxText=MAX_INDEX_TEXT}={}){
  const limit=Math.max(1,Math.min(MAX_NODES,Number(maxNodes)||MAX_NODES));
  const records=[],byIdentity=new Map(),byTitle=new Map(),bySource=new Map(),incoming=new Map();
  const open=Array.isArray(tabs)?tabs.slice(0,100):[];
  let partial=false,remaining=Math.max(0,Math.min(MAX_INDEX_TEXT,Number(maxText)||MAX_INDEX_TEXT));
  for(const tab of open){
   const tree=tab?.state?.root,tabId=String(tab?.id||'');
   if(!tabId||!tree)continue;
   const rootId=String(tree.id||''),stack=[tree],seen=new Set();
   while(stack.length){
    const node=stack.pop();
    if(!node||typeof node!=='object'||seen.has(node)){partial=true;continue}
    seen.add(node);
    if(records.length>=limit){partial=true;break}
    const nodeId=String(node.id||'');
    if(!validId(rootId)||!validId(nodeId)){partial=true;continue}
    const item={tabId,rootId,nodeId,title:String(node.text||'').slice(0,300),node};
    records.push(item);
    const idKey=key(rootId,nodeId);
    if(!byIdentity.has(idKey))byIdentity.set(idKey,[]);
    byIdentity.get(idKey).push(item);
    const titleKey=fold(item.title);
    if(titleKey){
     if(!byTitle.has(titleKey))byTitle.set(titleKey,[]);
     byTitle.get(titleKey).push(item);
    }
    const children=Array.isArray(node.children)?node.children:[];
    for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
   }
  }
  function resolve(ref){
   if(ref.kind==='invalid')return {status:'invalid',target:null};
   const matches=ref.kind==='id'?byIdentity.get(key(ref.rootId,ref.nodeId))||[]:byTitle.get(ref.query)||[];
   if(matches.length===1)return {status:'resolved',target:matches[0]};
   return {status:matches.length?'ambiguous':'missing',target:null};
  }
  for(const item of records){
   const original=String(item.node.notes||'');if(!original)continue;
   if(!remaining){partial=true;continue}
   const value=original.slice(0,remaining);remaining-=value.length;
   if(value.length<original.length)partial=true;
   const parsed=parse(value),found=[];
   if(parsed.overflow)partial=true;
   for(const ref of parsed.links){
    const result=resolve(ref),entry={...ref,status:result.status,
     target:result.target?{tabId:result.target.tabId,rootId:result.target.rootId,nodeId:result.target.nodeId,title:result.target.title}:null,
     source:{tabId:item.tabId,rootId:item.rootId,nodeId:item.nodeId,title:item.title}};
    found.push(entry);
    if(entry.target){
     const to=key(entry.target.tabId,entry.target.nodeId);
     if(!incoming.has(to))incoming.set(to,[]);
     incoming.get(to).push(entry);
    }
   }
   bySource.set(key(item.tabId,item.nodeId),found);
  }
  return Object.freeze({records,partial,resolve,
   forward(tabId,nodeId){return bySource.get(key(tabId,nodeId))||[]},
   backlinks(tabId,nodeId){return incoming.get(key(tabId,nodeId))||[]},
   search(query,max=60){
    const needle=fold(query);if(!needle)return [];
    const results=[];
    for(const item of records){if(fold(item.title).includes(needle)){results.push(item);if(results.length>=Math.min(100,max))break}}
    return results;
   }
  });
 }
 // During import/copy, remap links only to nodes that were actually cloned.
 // References to external nodes are deliberately preserved, never fabricated.
 function remapInternal(text,sourceRoot,destRoot,idMap){
  const input=String(text??'');
  if(!validId(sourceRoot)||!validId(destRoot)||!idMap?.get)return input;
  const lines=input.split(/(\r\n|\r|\n)/);
  let fence='';
  for(let i=0;i<lines.length;i+=2){
   const line=lines[i];
   const mark=/^\s{0,3}(\x60{3,}|~{3,})/.exec(line);
   if(mark){
    if(!fence)fence=mark[1][0]+mark[1].length;
    else if(mark[1][0]===fence[0]&&mark[1].length>=Number(fence.slice(1)))fence='';
    continue;
   }
   if(fence)continue;
   const mask=line.replace(/(\x60+)([\s\S]*?)\1/g,x=>' '.repeat(x.length));
   const re=/\[\[([^\]\r\n]{1,240})\]\]/g,changes=[];let match;
   while((match=re.exec(mask))){
    const parsed=parseRef(match[1]);
    if(parsed.kind!=='id'||parsed.rootId!==sourceRoot)continue;
    const newId=idMap.get(parsed.nodeId);
    if(!validId(newId))continue;
    const updated=format({rootId:destRoot,nodeId:newId,title:parsed.label});
    changes.push({start:match.index,end:match.index+match[0].length,updated});
   }
   let result=line;
   for(let j=changes.length-1;j>=0;j--){
    const c=changes[j];result=result.slice(0,c.start)+c.updated+result.slice(c.end);
   }
   lines[i]=result;
  }
  return lines.join('');
 }
 function saveNote(state,nodeId,text){
  const value=String(text??'');
  if(value.length>MAX_NOTE)throw Error('Maximum Markdown note length is 50,000 characters');
  const node=state?.findNode?.(nodeId);if(!node)throw Error('Target node is missing');
  if(String(node.notes||'')===value)return false;
  state.pushHistory();node.notes=value;return true;
 }
 function safeURL(input){
  try{const u=new URL(input);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}
  catch{return ''}
 }
 function inline(text){
  const out=[],input=String(text||'');
  const re=/(\[\[[^\]\r\n]{1,240}\]\]|\[([^\]\r\n]{1,120})\]\((https?:\/\/[^)\s]{1,2048})\)|\x60[^\x60\n]+\x60|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let cursor=0,match;
  while((match=re.exec(input))){
   if(match.index>cursor)out.push({kind:'text',value:input.slice(cursor,match.index)});
   const token=match[0];
   if(token.startsWith('[['))out.push({kind:'wiki',value:token,ref:parseRef(token.slice(2,-2))});
   else if(match[2]!==undefined)out.push(safeURL(match[3])?{kind:'url',value:match[2],url:safeURL(match[3])}:{kind:'text',value:token});
   else if(token.charCodeAt(0)===96)out.push({kind:'code',value:token.slice(1,-1)});
   else if(token.startsWith('**'))out.push({kind:'strong',value:token.slice(2,-2)});
   else out.push({kind:'em',value:token.slice(1,-1)});
   cursor=match.index+token.length;
  }
  if(cursor<input.length)out.push({kind:'text',value:input.slice(cursor)});
  return out;
 }
 return Object.freeze({MAX_NOTE,MAX_LINKS,MAX_NODES,format,parse,parseRef,fold,index,remapInternal,saveNote,safeURL,inline});
});
