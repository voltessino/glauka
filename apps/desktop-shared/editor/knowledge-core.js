/* Offline read-only projections of NeuroMap logical nodes for Outline/Atlas.
 * Does not clone or persist nodes. Shared by Windows and macOS. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapKnowledgeCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_NODES=50000,MAX_EDGES=5000;
 const s=x=>typeof x==='string'?x:'';
 const fold=x=>s(x).normalize('NFKC').toLocaleLowerCase();
 function walk(root,limit=MAX_NODES){
  const rows=[],seen=new Set(),ids=new Set(),stack=[{node:root,depth:0,parentId:null}];
  while(stack.length&&rows.length<limit){
   const item=stack.pop(),n=item.node;if(!n||typeof n!=='object'||seen.has(n))continue;seen.add(n);
   const id=s(n.id);if(!id||ids.has(id))continue;ids.add(id);
   const children=Array.isArray(n.children)?n.children:[];
   rows.push({id,depth:item.depth,parentId:item.parentId,text:s(n.text),notes:s(n.notes),
    collapsed:!!n.collapsed,hasChildren:children.length>0,node:n});
   for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],depth:item.depth+1,parentId:id});
  }
  return rows;
 }
 function outline(tree,query='',limit=MAX_NODES){
  const all=walk(tree,Math.max(1,Math.min(limit,MAX_NODES))),needle=fold(query.trim());
  if(needle){
   const keep=new Set(),lookup=new Map(all.map(x=>[x.id,x]));
   for(const row of all){if(!fold(row.text+' '+row.notes).includes(needle))continue;
    for(let p=row;p&&!keep.has(p.id);p=lookup.get(p.parentId))keep.add(p.id);
   }
   return all.filter(r=>keep.has(r.id));
  }
  const hidden=new Set();
  return all.filter(r=>{if(hidden.has(r.parentId))hidden.add(r.id);
   if(r.collapsed)hidden.add(r.id);
   return r.parentId===null||!hidden.has(r.parentId);
  });
 }
 function indexTabs(tabs,limit=MAX_NODES){
  const records=[],perTab=new Map();
  for(const tab of Array.isArray(tabs)?tabs.slice(0,100):[]){
   const tid=s(tab?.id),tree=tab?.state?.root;if(!tid||!tree)continue;
   const items=walk(tree,Math.max(0,limit-records.length)),byId=new Map();
   for(const row of items){const item={tabId:tid,nodeId:row.id,title:s(tab.title)||s(tree.text),
     text:row.text,notes:row.notes,parentId:row.parentId,depth:row.depth};
    records.push(item);byId.set(row.id,item);}
   perTab.set(tid,byId);if(records.length>=limit)break;
  }
  return {records,perTab,limitReached:records.length>=limit};
 }
 function search(index,query,max=100){
  const words=fold(query).trim().split(/\s+/).filter(Boolean);if(!words.length)return [];
  const result=[];for(const n of index.records){
   const hay=fold(n.text+' '+n.notes+' '+n.title);
   if(words.every(w=>hay.includes(w))){result.push(n);if(result.length>=max)break;}
  }return result;
 }
 function normalizeEdges(edges,index){
  const out=[],seen=new Set();
  for(const e of Array.isArray(edges)?edges.slice(0,MAX_EDGES):[]){
   const a=s(e?.fromTab),b=s(e?.toTab),x=s(e?.fromNode),y=s(e?.toNode);
   if(!index.perTab.get(a)?.has(x)||!index.perTab.get(b)?.has(y)||(a===b&&x===y))continue;
   const key=JSON.stringify([a,x,b,y]);if(seen.has(key))continue;seen.add(key);
   out.push({fromTab:a,fromNode:x,toTab:b,toNode:y,label:s(e.label).slice(0,140)});
  }return out;
 }
 function suggested(index,max=80){
  const groups=new Map(),out=[];
  for(const n of index.records){
   const key=fold(n.text.trim());if(key.length<5||key.length>100||/^\d+$/.test(key))continue;
   if(!groups.has(key))groups.set(key,[]);const arr=groups.get(key);if(arr.length<8)arr.push(n);
  }
  for(const group of groups.values()){for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
   if(group[i].tabId===group[j].tabId)continue;
   out.push({from:group[i],to:group[j],kind:'suggestion',reason:'same-label'});
   if(out.length>=max)return out;
  }}return out;
 }
 function backlinks(index,edges,tab,node){
  return normalizeEdges(edges,index).filter(e=>(e.toTab===tab&&e.toNode===node)||(e.fromTab===tab&&e.fromNode===node));
 }
 function route(index,edges,fromTab,fromNode,toTab,toNode,maxVisited=20000){
  const key=(tab,node)=>JSON.stringify([tab,node]),start=key(fromTab,fromNode),goal=key(toTab,toNode);
  if(!index.perTab.get(fromTab)?.has(fromNode)||!index.perTab.get(toTab)?.has(toNode))return [];
  if(start===goal)return [{tabId:fromTab,nodeId:fromNode}];
  const graph=new Map(),add=(a,b)=>{if(!graph.has(a))graph.set(a,[]);graph.get(a).push(b)};
  for(const e of index.records)if(e.parentId){const a=key(e.tabId,e.nodeId),b=key(e.tabId,e.parentId);add(a,b);add(b,a);}
  for(const e of normalizeEdges(edges,index)){const a=key(e.fromTab,e.fromNode),b=key(e.toTab,e.toNode);add(a,b);add(b,a);}
  const queue=[start],previous=new Map([[start,null]]);
  for(let i=0;i<queue.length&&i<maxVisited;i++){
   const here=queue[i];if(here===goal)break;
   for(const next of graph.get(here)||[]){if(previous.has(next))continue;previous.set(next,here);queue.push(next);}
  }
  if(!previous.has(goal))return [];
  const path=[];for(let p=goal;p!==null;p=previous.get(p)){const [tabId,nodeId]=JSON.parse(p);path.push({tabId,nodeId});}
  return path.reverse();
 }
 function journey(tree,limit=12000){
  // A read-only chapter sequence. Notes are verbatim text, never interpreted as HTML.
  return walk(tree,Math.min(MAX_NODES,Math.max(1,limit))).map((row,i)=>({
   index:i,id:row.id,parentId:row.parentId,depth:row.depth,
   title:row.text,notes:row.notes,collapsed:row.collapsed
  }));
 }
 function memoryRadar(tree,studyCards=[],tabId='',now=Date.now()){
  // Evidence only: observed dueAt/reviews/lapses. No invented AI mastery score.
  const cardsByNode=new Map();
  for(const c of Array.isArray(studyCards)?studyCards.slice(0,10000):[]){
   if(c?.sourceTabId!==tabId||!s(c.sourceNodeId))continue;
   if(!cardsByNode.has(c.sourceNodeId))cardsByNode.set(c.sourceNodeId,[]);
   cardsByNode.get(c.sourceNodeId).push(c);
  }
  const results=[],totals={unreviewed:0,due:0,scheduled:0,reviewed:0};
  for(const row of walk(tree)){
   let reviews=Math.max(0,Number(row.node?.sr?.reviews)||0);
   let lapses=Math.max(0,Number(row.node?.sr?.lapses)||0);
   let dueAt=Number(row.node?.sr?.dueAt)||0;
   let observed=reviews>0;
   for(const c of cardsByNode.get(row.id)||[]){
    const sr=c.sr&&typeof c.sr==='object'?c.sr:{};
    const cv=Math.max(0,Number(sr.reviews)||0);
    if(cv>0){observed=true;reviews+=cv}
    lapses+=Math.max(0,Number(sr.lapses)||0);
    const d=Number(sr.dueAt)||0;if(d>0&&(dueAt===0||d<dueAt))dueAt=d;
   }
   const status=!observed?'unreviewed':dueAt>0&&dueAt<=now?'due':
    dueAt>now?'scheduled':'reviewed';
   results.push({nodeId:row.id,text:row.text,status,reviews,lapses,
    dueAt:dueAt||null,hasEvidence:observed});
   totals[status]++;
  }
  return {nodes:results,totals};
 }

 return Object.freeze({walk,outline,indexTabs,search,normalizeEdges,suggested,backlinks,route,journey,memoryRadar,MAX_NODES});
});
