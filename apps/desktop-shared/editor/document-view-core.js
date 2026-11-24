/* NeuroMap 8.0: canonical map nodes are the only document source. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NeuroMapDocumentView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_NODES=12000,MAX_EDITS=100,MAX_TITLE=10000,MAX_NOTES=50000,MAX_EXPORT=16*1024*1024;
function project(tree,{limit=MAX_NODES}={}){
 if(!tree||typeof tree!=='object')throw Error('Missing document root');
 const cap=Math.min(MAX_NODES,Math.max(1,Number.isFinite(limit)?Math.floor(limit):MAX_NODES));
 const seen=new WeakSet(),ids=new Set(),rows=[],stack=[{node:tree,parentId:null,depth:0}];
 while(stack.length){
  if(rows.length>=cap)throw Error('Document exceeds projection limit');
  const {node,parentId,depth}=stack.pop();
  if(!node||typeof node!=='object'||seen.has(node))throw Error('Cyclic or shared document node');
  seen.add(node);
  const id=node.id;
  if(typeof id!=='string'||!id||id.length>200||ids.has(id))throw Error('Missing or duplicate node ID');
  ids.add(id);
  if(typeof node.text!=='string'||node.text.length>MAX_TITLE||
   (node.notes!==undefined&&typeof node.notes!=='string')||String(node.notes||'').length>MAX_NOTES)
   throw Error('Invalid document text');
  rows.push(Object.freeze({id,parentId,depth,title:node.text,notes:node.notes||''}));
  const children=node.children===undefined?[]:node.children;
  if(!Array.isArray(children))throw Error('Invalid document children');
  for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parentId:id,depth:depth+1});
 }
 return Object.freeze(rows);
}
function commit(state,edits){
 if(!state?.root||typeof state.findNode!=='function'||typeof state.pushHistory!=='function')throw Error('Document state not editable');
 if(!Array.isArray(edits)||edits.length>MAX_EDITS)throw Error('Too many document edits');
 if(!edits.length)return {changed:false,updatedIds:[]};
 const rows=project(state.root),ids=new Set(rows.map(x=>x.id)),seen=new Set(),changes=[];
 for(const edit of edits){
  if(!edit||typeof edit!=='object'||!ids.has(edit.id)||seen.has(edit.id))throw Error('Unknown or duplicate edit target');
  seen.add(edit.id);
  const node=state.findNode(edit.id);
  if(!node||typeof edit.expectedTitle!=='string'||typeof edit.expectedNotes!=='string'||
   node.text!==edit.expectedTitle||(node.notes||'')!==edit.expectedNotes)
   throw Error('Stale document edit: reload before saving');
  if(!Object.hasOwn(edit,'title')&&!Object.hasOwn(edit,'notes'))throw Error('Empty document edit');
  const title=Object.hasOwn(edit,'title')?edit.title:node.text;
  const notes=Object.hasOwn(edit,'notes')?edit.notes:(node.notes||'');
  if(typeof title!=='string'||!title.trim()||title.length>MAX_TITLE||
   typeof notes!=='string'||notes.length>MAX_NOTES)throw Error('Invalid document field');
  if(title!==node.text||notes!==(node.notes||''))changes.push({node,id:edit.id,title,notes});
 }
 if(!changes.length)return {changed:false,updatedIds:[]};
 state.pushHistory();
 for(const item of changes){item.node.text=item.title;item.node.notes=item.notes;}
 return {changed:true,updatedIds:changes.map(x=>x.id)};
}
function exportText(tree){
 const rows=project(tree),lines=['NEUROMAP-DOCUMENT-1'];let size=20;
 for(const row of rows){
  const line=JSON.stringify([row.id,row.parentId,row.depth,row.title,row.notes]);
  size+=line.length+1;if(size>MAX_EXPORT)throw Error('Document export exceeds 16 MiB');
  lines.push(line);
 }
 return lines.join('\n')+'\n';
}
function parseText(text){
 if(typeof text!=='string'||text.length>MAX_EXPORT||!text.startsWith('NEUROMAP-DOCUMENT-1\n'))
  throw Error('Invalid document text');
 const body=text.slice(20);if(!body.endsWith('\n'))throw Error('Incomplete document export');
 const lines=body.slice(0,-1).split('\n');
 if(!lines.length||lines.length>MAX_NODES)throw Error('Invalid document row count');
 const rows=[],ids=new Set(),depthById=new Map();
 for(const line of lines){
  let r;try{r=JSON.parse(line)}catch{throw Error('Invalid document JSON line')}
  if(!Array.isArray(r)||r.length!==5||typeof r[0]!=='string'||!r[0]||ids.has(r[0])||
   !(r[1]===null||typeof r[1]==='string')||!Number.isInteger(r[2])||r[2]<0||
   typeof r[3]!=='string'||typeof r[4]!=='string'||r[3].length>MAX_TITLE||r[4].length>MAX_NOTES)
   throw Error('Invalid document row');
  if(rows.length===0?(r[1]!==null||r[2]!==0):(depthById.get(r[1])!==r[2]-1))
   throw Error('Invalid document hierarchy');
  ids.add(r[0]);depthById.set(r[0],r[2]);
  rows.push({id:r[0],parentId:r[1],depth:r[2],title:r[3],notes:r[4]});
 }
 return rows;
}
return Object.freeze({project,commit,exportText,parseText,MAX_NODES,MAX_EDITS});
});
