/* NeuroMap 7.4 Quality Center — bounded, read-only evidence audit.
 * Never infers facts or removes content; issues are explicit source/data checks.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapQualityCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const LIMIT=2500,MAX_NODES=3500,MAX_TABS=20;
 const tidy=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 function inspect({tabs=[],studyCards=[],today='',staleness=null}={}){
  const items=[],counts={nodes:0,sourceRefs:0,images:0,cards:0,datedTasks:0,problems:0,overdue:0};
  const add=(kind,severity,tabId,nodeId,label,detail='')=>{
   if(items.length>=LIMIT)return;
   items.push({kind,severity,tabId,nodeId,label:String(label||'').slice(0,200),detail:String(detail||'').slice(0,220)});
  };
  const validDate=typeof today==='string'&&/^\d{4}-\d\d-\d\d$/.test(today)?today:'';
  const lookups=new Map(),flat=[];
  for(const tab of Array.isArray(tabs)?tabs.slice(0,MAX_TABS):[]){
   const id=String(tab?.id||'');if(!id||!tab.state?.root)continue;
   const map=new Map(),rows=[],visited=new Set(),stack=[{n:tab.state.root,parent:null,depth:0}];
   while(stack.length){
    const {n,parent,depth}=stack.pop();
    if(!n||typeof n!=='object'||visited.has(n))throw Error('Cyclic hierarchy in map');
    visited.add(n);if(visited.size>MAX_NODES)throw Error('Quality scan supports 3,500 nodes per tab');
    const nodeId=String(n.id||'');
    if(!nodeId||map.has(nodeId))throw Error('Duplicate or missing node ID');
    const row={tabId:id,nodeId,n,parent,depth};map.set(nodeId,row);rows.push(row);flat.push(row);
    counts.nodes++;
    const siblings=Array.isArray(n.children)?n.children:[];
    for(let j=siblings.length-1;j>=0;j--)stack.push({n:siblings[j],parent:nodeId,depth:depth+1});
   }
   lookups.set(id,map);
   // Same-label siblings are a *suggestion*, never proof that contents duplicate.
   for(const row of rows){
    const names=new Map(),children=row.n.children||[];
    for(const c of children){
     const key=tidy(c.text);
     if(key.length<3)continue;
     if(names.has(key))add('same-label','info',id,c.id,String(c.text),'Same title as sibling '+String(names.get(key)));
     else names.set(key,c.id);
    }
   }
   for(const row of rows){
    const n=row.n;
    const refs=Array.isArray(n.sourceRefs)?n.sourceRefs:[];
    counts.sourceRefs+=refs.length;
    if(root.NeuroMapSourceCore){
     for(const ref of refs.slice(0,48))
      if(!root.NeuroMapSourceCore.normalize(ref))add('invalid-source','warning',id,row.nodeId,String(n.text),'Source reference has invalid saved metadata');
    }
    const deps=Array.isArray(n.taskDependsOn)?n.taskDependsOn:[];
    for(const predecessor of deps.slice(0,80)){
     const from=map.get(predecessor);
     if(!from){add('broken-dependency','error',id,row.nodeId,String(n.text),'Predecessor no longer exists');continue}
     if(predecessor===row.nodeId){add('self-dependency','error',id,row.nodeId,String(n.text),'Task depends on itself');continue}
     if(n.taskStatus!=='done'&&from.n.taskStatus!=='done')
      add('blocked-task','info',id,row.nodeId,String(n.text),'Prerequisite not marked complete: '+String(from.n.text));
     if(n.startDate&&from.n.dueDate&&from.n.dueDate>=n.startDate)
      add('date-conflict','warning',id,row.nodeId,String(n.text),'Predecessor ends on or after task start');
    }
    if(n.startDate||n.dueDate)counts.datedTasks++;
    if(n.startDate&&n.dueDate&&n.startDate>n.dueDate)
     add('inverted-dates','error',id,row.nodeId,String(n.text),'Start date occurs after due date');
    if(validDate&&n.dueDate&&n.dueDate<validDate&&n.taskStatus!=='done'){
     add('overdue','warning',id,row.nodeId,String(n.text),'Task due date has passed');counts.overdue++;
    }
   }
   for(const image of tab.state.images||[]){
    counts.images++;
    if(image.mode!=='free'&&image.attachedNodeId&&!map.has(image.attachedNodeId))
     add('orphan-image','warning',id,null,'Image','Attached image points to missing node');
    for(const point of Array.isArray(image.studyHotspots)?image.studyHotspots.slice(0,50):[]){
     if(!map.has(point.nodeId))add('broken-hotspot','warning',id,null,'Visual Learning','Hotspot points to missing node');
    }
   }
   for(const relation of tab.state.relationships||[])
    if(!map.has(relation.fromId)||!map.has(relation.toId))
     add('broken-relation','warning',id,null,'Relationship','One endpoint no longer exists');
  }
  for(const card of Array.isArray(studyCards)?studyCards.slice(0,10000):[]){
   counts.cards++;
   const tabId=String(card?.sourceTabId||''),nodeId=String(card?.sourceNodeId||'');
   if(!lookups.has(tabId))continue; // closed tabs need not be missing documents
   const ref=lookups.get(tabId).get(nodeId);
   if(!ref)add('orphan-card','warning',tabId,nodeId,String(card?.question||'Flashcard'),'Flashcard source node is missing');
   else if(typeof staleness==='function'&&staleness(card)==='stale')
    add('stale-card','info',tabId,nodeId,String(card?.question||'Flashcard'),'Card source changed; review the answer');
  }
  counts.problems=items.filter(x=>x.severity!=='info').length;
  return Object.freeze({items,counts,truncated:items.length>=LIMIT,scannedTabs:lookups.size});
 }
 function missingPredecessorPlan(tree){
  if(!tree||typeof tree!=='object')throw Error('Missing map');
  const nodes=new Map(),stack=[tree];
  while(stack.length){
   const item=stack.pop();
   if(!item||typeof item!=='object'||nodes.has(item.id))throw Error('Invalid node hierarchy');
   nodes.set(item.id,item);
   if(nodes.size>MAX_NODES)throw Error('Map too large to repair');
   for(const child of item.children||[])stack.push(child);
  }
  const changes=[];
  for(const [id,node]of nodes){
   const old=Array.isArray(node.taskDependsOn)?node.taskDependsOn:[];
   const keep=old.filter(dep=>typeof dep==='string'&&nodes.has(dep)&&dep!==id&&dep!==tree.id);
   if(keep.length!==old.length)changes.push({nodeId:id,previous:old.slice(),next:keep});
  }
  return changes;
 }
 function summary(report){
  const result={error:0,warning:0,info:0};
  for(const item of report.items)result[item.severity]=(result[item.severity]||0)+1;
  return result;
 }
 return Object.freeze({inspect,summary,missingPredecessorPlan,LIMIT,MAX_NODES});
});
