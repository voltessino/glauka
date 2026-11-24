/* Local-first concept comparison. Strings are compared literally; never infer semantic facts. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NeuroMapComparisonCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MAX_SCAN=25000,MAX_ITEMS=240;
  const norm=value=>String(value??'').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  function catalog(root){
    if(!root||typeof root!=='object'||!root.id)throw Error('Invalid comparison map');
    const indexed=new Map(),parent=new Map(),stack=[{node:root,parentId:null}],seen=new Set();
    while(stack.length){
      const {node,parentId}=stack.pop();
      if(!node||!node.id||typeof node.id!=='string'||seen.has(node)||indexed.has(node.id))
        throw Error('Invalid or cyclic comparison map');
      if(indexed.size>=MAX_SCAN)throw Error('Comparison map exceeds safe limit');
      indexed.set(node.id,node);parent.set(node.id,parentId);seen.add(node);
      const children=Array.isArray(node.children)?node.children:[];
      for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parentId:node.id});
    }
    return {indexed,parent};
  }
  function choosePair(tree,selectedIds=[],selectedId=null){
    const {indexed,parent}=catalog(tree),unique=[...new Set(Array.isArray(selectedIds)?selectedIds:[])]
      .filter(id=>indexed.has(id)&&id!==tree.id);
    if(unique.length>=2)return {leftId:unique[unique.length-2],rightId:unique[unique.length-1],source:'multi-selection'};
    const chosen=unique[0]||((selectedId&&indexed.has(selectedId)&&selectedId!==tree.id)?selectedId:null);
    if(chosen){
      const p=indexed.get(parent.get(chosen));
      const brothers=(p?.children||[]).filter(n=>!n.isSummary&&n.id!==chosen&&indexed.has(n.id));
      if(brothers.length){
        const all=(p?.children||[]).filter(n=>!n.isSummary&&indexed.has(n.id)),i=all.findIndex(n=>n.id===chosen);
        const other=all[i+1]||all[i-1]||brothers[0];
        return {leftId:chosen,rightId:other.id,source:'adjacent-sibling'};
      }
    }
    const primaries=(tree.children||[]).filter(n=>!n.isSummary&&!n.isFloating&&indexed.has(n.id));
    if(primaries.length>=2)return {leftId:primaries[0].id,rightId:primaries[1].id,source:'primary-siblings'};
    return null;
  }
  function list(node,{maxDepth=2,maxItems=MAX_ITEMS}={}){
    const depthLimit=Math.max(1,Math.min(8,Number(maxDepth)||2)),
      max=Math.max(1,Math.min(MAX_ITEMS,Number(maxItems)||MAX_ITEMS));
    const items=[],stack=[],seen=new Set([node]);
    const children=Array.isArray(node.children)?node.children:[];
    for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],depth:1});
    let truncated=false;
    while(stack.length){
      const cur=stack.pop(),n=cur.node;
      if(!n||!n.id||seen.has(n))continue;
      seen.add(n);
      if(n.isSummary)continue;
      if(items.length>=max){truncated=true;break}
      items.push({id:n.id,text:String(n.text||''),depth:cur.depth,key:norm(n.text)});
      if(cur.depth>=depthLimit||n.collapsed)continue;
      const kids=Array.isArray(n.children)?n.children:[];
      for(let i=kids.length-1;i>=0;i--)stack.push({node:kids[i],depth:cur.depth+1});
    }
    return {items,truncated};
  }
  function compare(tree,leftId,rightId,opts={}){
    const {indexed}=catalog(tree);
    if(!indexed.has(leftId)||!indexed.has(rightId)||leftId===rightId)
      throw Error('Select two different concepts');
    const leftNode=indexed.get(leftId),rightNode=indexed.get(rightId);
    const left=list(leftNode,opts),right=list(rightNode,opts);
    const leftNames=new Set(left.items.map(i=>i.key).filter(Boolean)),
      rightNames=new Set(right.items.map(i=>i.key).filter(Boolean));
    const shared=new Set([...leftNames].filter(key=>rightNames.has(key)));
    const uniqueLeft=left.items.filter(i=>!shared.has(i.key)),
      uniqueRight=right.items.filter(i=>!shared.has(i.key));
    const common=left.items.filter(i=>shared.has(i.key))
      .filter((item,index,all)=>all.findIndex(x=>x.key===item.key)===index)
      .map(i=>({key:i.key,label:i.text}));
    return {
      left:{id:leftId,title:String(leftNode.text||'—'),items:left.items,truncated:left.truncated,uniqueCount:uniqueLeft.length},
      right:{id:rightId,title:String(rightNode.text||'—'),items:right.items,truncated:right.truncated,uniqueCount:uniqueRight.length},
      common,sharedKeys:shared,mode:'exact-labels',maxDepth:Math.max(1,Math.min(8,Number(opts.maxDepth)||2))
    };
  }
  return Object.freeze({MAX_SCAN,MAX_ITEMS,norm,catalog,choosePair,list,compare});
});
