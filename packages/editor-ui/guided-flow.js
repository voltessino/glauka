/* Safe, read-only suggestions for turning sibling order into explicit workflow steps.
 * Siblings are not a process until the user reviews and confirms them.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NeuroMapGuidedFlow=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const LIMIT=1200,MAX_PAIRS=100;
 function inventory(tree){
  if(!tree||typeof tree.id!=='string'||!tree.id)throw Error('Missing source tree');
  const nodes=[],byId=new Map(),seen=new Set(),stack=[{node:tree,path:''}];
  while(stack.length){
   const {node,path}=stack.pop();
   if(!node||typeof node.id!=='string'||!node.id||seen.has(node)||byId.has(node.id))throw Error('Invalid source graph');
   if(nodes.length>=LIMIT)throw Error('Map too large for guided conversion');
   seen.add(node);
   const children=Array.isArray(node.children)?node.children:[];
   const entry={id:node.id,text:String(node.text??''),path:(path?path+' › ':'')+String(node.text??''),children:children.map(n=>n?.id)};
   byId.set(node.id,entry);nodes.push(entry);
   for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],path:entry.path.slice(-180)});
  }
  return {nodes,byId,groups:nodes.filter(n=>n.children.length>=2).map(n=>({id:n.id,text:n.text,path:n.path,children:n.children.length}))};
 }
 function preview(tree,parentId,relationships=[],opts={}){
  const info=inventory(tree),parent=info.byId.get(parentId);
  if(!parent)throw Error('Unknown source branch');
  const links=Array.isArray(relationships)?relationships:[];
  const adjacency=new Map(info.nodes.map(n=>[n.id,new Set()]));
  const existing=new Set();
  for(const r of links){
   if(!r||!adjacency.has(r.fromId)||!adjacency.has(r.toId)||r.fromId===r.toId)continue;
   if(!['sequence','yes','no'].includes(r.kind))continue;
   adjacency.get(r.fromId).add(r.toId);
   if(r.kind==='sequence')existing.add(r.fromId+'\x00'+r.toId);
  }
  const canReach=(start,target)=>{
   const visited=new Set(),stack=[start];
   while(stack.length){
    const id=stack.pop();
    if(id===target)return true;
    if(visited.has(id))continue;visited.add(id);
    for(const next of adjacency.get(id)||[])if(!visited.has(next))stack.push(next);
   }
   return false;
  };
  const pairs=[],skipped=[];
  const limit=Math.max(1,Math.min(MAX_PAIRS,Number(opts.maxPairs)||MAX_PAIRS));
  for(let i=0;i<Math.max(0,parent.children.length-1);i++){
   const fromId=parent.children[i],toId=parent.children[i+1];
   if(!info.byId.has(fromId)||!info.byId.has(toId)||fromId===toId)continue;
   const key=fromId+'\x00'+toId;
   if(existing.has(key)){skipped.push({fromId,toId,reason:'existing'});continue}
   if(canReach(toId,fromId)){skipped.push({fromId,toId,reason:'cycle'});continue}
   if(pairs.length>=limit){skipped.push({fromId,toId,reason:'limit'});continue}
   pairs.push({fromId,toId,kind:'sequence',fromText:info.byId.get(fromId).text,toText:info.byId.get(toId).text});
   adjacency.get(fromId).add(toId);
  }
  return {parentId,parentText:parent.text,pairs,skipped,candidateCount:Math.max(0,parent.children.length-1),requiresConfirmation:true};
 }
 return Object.freeze({LIMIT,MAX_PAIRS,inventory,preview});
});
