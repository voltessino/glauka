 function apply(app,state,id,intent,world,record=false){
  if(!intent||!validKinds.has(intent.kind))return false;
  const source=state.findNode(id),target=intent.targetId&&state.findNode(intent.targetId);
  if(!source||source.id===state.root.id)return false;
  const excluded=subtree(source);
  const oldParent=state.findNode(source.parentId);
  const parent=intent.kind==='detach'?state.root:
    intent.kind==='child'?target:
    intent.kind==='place'?state.findNode(intent.parentId):
    target&&state.findNode(target.parentId);
  if(!oldParent||!parent||excluded.has(parent.id)||target&&excluded.has(target.id))return false;
  if(intent.kind==='place'&&
     (parent.isSummary||parent.isFloating||parent===state.root&&!['left','right'].includes(intent.side)))return false;
  const oldIndex=oldParent.children.indexOf(source);
  if(oldIndex<0)return false;
  const siblings=parent.children.filter(n=>n.id!==id);
  let index;
  if(intent.kind==='place'){
    index=intent.beforeId?siblings.findIndex(n=>n.id===intent.beforeId):-1;
    if(index<0&&intent.afterId)index=siblings.findIndex(n=>n.id===intent.afterId)+1;
    if(index<0)index=parent===state.root&&intent.side==='right'?0:siblings.length;
  }else if(intent.kind==='reorder')index=siblings.indexOf(target)+(intent.after?1:0);
  else index=siblings.length;
  if(index<0)return false;
  const pinChanged=intent.kind==='place'&&parent===state.root&&source.sidePinned!==intent.side;
  const live=app.layout.getLayout?.(id);
  const relocate=intent.kind==='place'&&parent===state.root&&!!live&&
    Number.isFinite(world?.x)&&Number.isFinite(world?.y)&&
    Math.hypot(world.x-live.x,world.y-live.y)>8;
  if(parent===oldParent&&index===oldIndex&&!source.manualOffset&&!source.isFloating&&
    intent.kind!=='detach'&&!pinChanged&&!relocate)return false;
  if(record)state.pushHistory();
  oldParent.children.splice(oldIndex,1);parent.children.splice(index,0,source);
  source.parentId=parent.id;source.manualOffset=null;
  if(intent.kind==='detach'){
    source.isFloating=true;source.floatingPosition={x:world.x,y:world.y};source.sidePinned=null;
  }else{
    source.isFloating=false;source.floatingPosition=null;
    if(intent.kind==='child')parent.collapsed=false;
    if(parent===state.root&&intent.kind==='place')source.sidePinned=intent.side;
    else if(parent===state.root&&intent.kind==='reorder'&&!app.layout.presentationRoot)source.sidePinned=target.side;
    else if(parent!==oldParent)source.sidePinned=null;
    const side=parent===state.root?(intent.kind==='place'?intent.side:
      target?.side==='left'?'left':'right'):parent.side;
    const walk=n=>{const pending=[n];while(pending.length){const curr=pending.pop();curr.side=side;
      for(const child of curr.children||[])pending.push(child);}};walk(source);
    if(parent!==oldParent)app.v5SubtreeColors?.(source,parent);
  }
  state.normalizeChildrenOrder(oldParent);state.normalizeChildrenOrder(parent);
  // Respect the user's actual landing point, instead of only assigning a new
  // sibling index. Reuse the existing manual-offset mechanism (saved in the
  // tree and Undo/Redo); collision separation remains the layout's job.
  if(intent.kind==='place'&&parent===state.root&&
     Number.isFinite(world?.x)&&Number.isFinite(world?.y)){
   const projected=new app.layout.constructor();
   if(typeof projected.computeLayout==='function'){
    for(const [key,value] of Object.entries(app.layout))
     if(['string','number','boolean'].includes(typeof value))projected[key]=value;
    projected._nmImages=state.images||[];
    projected.computeLayout(state.root,state.thresholdY);
    let metric=projected.getLayout(source.id);
    // Clockwise uses visual aliases for its continuation sectors. A pin/order
    // still persists if that projection has no canonical geometry.
    if(!metric&&projected.viewNodes){
     const alias=[...projected.viewNodes.values()].find(n=>(n.logicalId||n.id)===id);
     if(alias)metric=projected.getLayout(alias.id);
    }
    const rootMetric=projected.getLayout(state.root.id);
    if(metric&&!projected.presentationRoot){
     const buffer=(rootMetric?.width||100)/2+(metric.width||80)/2+
        Math.max(40,projected.primaryGapX||120);
     const targetX=intent.side==='left'?Math.min(world.x,-buffer):Math.max(world.x,buffer);
     const clamp=v=>Math.max(-3500,Math.min(3500,v));
     source.manualOffset={dx:clamp(targetX-metric.x),dy:clamp(world.y-metric.y)};
    }
   }
  }
  state.selectedNodeId=id;state.selectedNodeIds=[id];return true;
 }
 // The group is validated before any mutation. All roots share one insertion
 // slot and history snapshot; single-node drops retain the established path.
 function applyGroup(app,state,ids,intent,world,record=false,anchorId=ids?.[0]){
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>!state.findNode(id)))return false;
  if(ids.length===1)return apply(app,state,ids[0],intent,world,record);
  const sources=rootsFor(state,ids);
  if(sources.length===1)return apply(app,state,sources[0].id,intent,world,record);
  if(!sources.length||!intent||!validKinds.has(intent.kind)||!Number.isFinite(world?.x)||!Number.isFinite(world?.y))return false;
  const excluded=excludedFor(state,sources.map(n=>n.id)),target=intent.targetId&&state.findNode(intent.targetId);
  const parent=intent.kind==='detach'?state.root:intent.kind==='child'?target:
   intent.kind==='place'?state.findNode(intent.parentId):target&&state.findNode(target.parentId);
  if(!parent||intent.targetId&&!target||excluded.has(parent.id)||target&&excluded.has(target.id)||
     intent.kind==='place'&&(parent.isSummary||parent.isFloating||parent===state.root&&!['left','right'].includes(intent.side)))return false;
  const oldParents=sources.map(n=>state.findNode(n.parentId));
  if(oldParents.some((p,i)=>!p||!p.children.includes(sources[i])))return false;
  const sourceIds=new Set(sources.map(n=>n.id)),siblings=parent.children.filter(n=>!sourceIds.has(n.id));
  let index=siblings.length;
  if(intent.kind==='place'){
   if(intent.beforeId){index=siblings.findIndex(n=>n.id===intent.beforeId);if(index<0)return false;}
   else if(intent.afterId){index=siblings.findIndex(n=>n.id===intent.afterId);if(index<0)return false;index++;}
   else index=parent===state.root&&intent.side==='right'?0:siblings.length;
  }else if(intent.kind==='reorder'){index=siblings.indexOf(target);if(index<0)return false;if(intent.after)index++;}
  const anchor=sources.find(n=>n.id===anchorId)||sources[0],anchorMetric=app.layout.getLayout(anchor.id);
  const relocate=intent.kind==='place'&&parent===state.root&&anchorMetric&&Math.hypot(world.x-anchorMetric.x,world.y-anchorMetric.y)>8;
  const next=[...siblings.slice(0,index),...sources,...siblings.slice(index)];
  if(intent.kind!=='detach'&&!relocate&&oldParents.every(p=>p===parent)&&
     next.every((n,i)=>parent.children[i]===n)&&sources.every(n=>!n.manualOffset&&!n.isFloating&&
      !(intent.kind==='place'&&parent===state.root&&n.sidePinned!==intent.side)))return false;
  const oldPositions=sources.map(n=>app.layout.getLayout(n.id));
  if(record)state.pushHistory();
  for(const p of new Set(oldParents))p.children=p.children.filter(n=>!sourceIds.has(n.id));
  parent.children=next;
  const side=parent===state.root?(intent.kind==='place'?intent.side:target?.side==='left'?'left':'right'):parent.side;
  sources.forEach((source,i)=>{
   source.parentId=parent.id;source.manualOffset=null;
   if(intent.kind==='detach'){
    const metric=oldPositions[i];source.isFloating=true;source.sidePinned=null;
    source.floatingPosition={x:world.x+(metric&&anchorMetric?metric.x-anchorMetric.x:0),y:world.y+(metric&&anchorMetric?metric.y-anchorMetric.y:i*60)};
   }else{
    source.isFloating=false;source.floatingPosition=null;
    if(parent===state.root&&intent.kind==='place')source.sidePinned=intent.side;
    else if(parent===state.root&&intent.kind==='reorder'&&!app.layout.presentationRoot)source.sidePinned=target.side;
    else if(parent!==oldParents[i])source.sidePinned=null;
    const pending=[source];while(pending.length){const n=pending.pop();n.side=side;pending.push(...(n.children||[]));}
    if(parent!==oldParents[i])app.v5SubtreeColors?.(source,parent);
   }
  });
  if(intent.kind==='child')parent.collapsed=false;
  for(const p of new Set([...oldParents,parent]))state.normalizeChildrenOrder(p);
  if(intent.kind==='place'&&parent===state.root){
   const projected=new app.layout.constructor();
   if(typeof projected.computeLayout==='function'){
    for(const [key,value]of Object.entries(app.layout))if(['string','number','boolean'].includes(typeof value))projected[key]=value;
    projected._nmImages=state.images||[];projected.computeLayout(state.root,state.thresholdY);
    const metric=projected.getLayout(anchor.id),rootMetric=projected.getLayout(state.root.id);
    if(metric&&!projected.presentationRoot){
     const buffer=(rootMetric?.width||100)/2+(metric.width||80)/2+Math.max(40,projected.primaryGapX||120);
     const x=intent.side==='left'?Math.min(world.x,-buffer):Math.max(world.x,buffer),clamp=v=>Math.max(-3500,Math.min(3500,v));
     const offset={dx:clamp(x-metric.x),dy:clamp(world.y-metric.y)};
     for(const n of sources)n.manualOffset={...offset};
    }
   }
  }
  state.selectedNodeId=anchor.id;state.selectedNodeIds=sources.map(n=>n.id);return true;
 }
