 function subtree(node){const ids=new Set(),stack=[node];while(stack.length){const n=stack.pop();if(!n||ids.has(n.id))continue;ids.add(n.id);stack.push(...(n.children||[]));}return ids;}
 // Normalize once in document order: selected descendants travel with their
 // ancestor, including collapsed descendants that getAllNodes() omits.
 function rootsFor(state,ids){
  const wanted=new Set(ids),roots=[],pending=[{node:state.root,covered:false}],seen=new Set();
  while(pending.length){const {node,covered}=pending.pop();if(!node||seen.has(node.id))continue;seen.add(node.id);
   const selected=node!==state.root&&wanted.has(node.id);
   if(selected&&!covered)roots.push(node);
   for(let i=(node.children||[]).length-1;i>=0;i--)pending.push({node:node.children[i],covered:covered||selected});
  }
  return roots;
 }
 function dragIds(app,id){
  const selected=app.state.selectedNodeIds||[];
  return rootsFor(app.state,selected.includes(id)?selected:[id]).map(n=>n.id);
 }
 function dragAnchor(state,id,ids){
  const roots=new Set(ids);let n=state.findNode(id);
  while(n&&!roots.has(n.id))n=state.findNode(n.parentId);
  return n?.id||ids[0];
 }
 function excludedFor(state,ids){const excluded=new Set();for(const n of rootsFor(state,ids))for(const id of subtree(n))excluded.add(id);return excluded;}
 function resolve(app,id,x,y,options={}){
  const from=app.state.findNode(id),rootNode=app.state.root;
  if(!from||from.id===rootNode.id)return null;
  const excluded=options.nodeIds?.length>1?excludedFor(app.state,options.nodeIds):subtree(from),hit=app.findHit(x,y),zoom=Math.max(.05,app.renderer.camera.zoom||1);
  const rootLayout=app.layout.getLayout(rootNode.id);
  const centre=rootLayout?app.renderer.worldToScreen(rootLayout.x,rootLayout.y):{x:0,y:0};
  // Presentation copies are only views; drop decisions always use canonical IDs.
  const visible=new Map(),destinationSide=x<centre.x?'left':'right';
  for(const [viewId,view] of app.layout.viewNodes||[]){
    const logicalId=view.logicalId||viewId,metric=app.layout.getLayout(viewId);
    if(metric){
      const p=app.renderer.worldToScreen(metric.x,metric.y);
      const score=(view.side===destinationSide?0:1000000)+Math.abs(p.x-x)+Math.abs(p.y-y);
      if(!visible.has(logicalId)||score<visible.get(logicalId).score)visible.set(logicalId,{metric,side:view.side,score});
    }
  }
  const point=n=>{
    const m=visible.get(n.id)?.metric||app.layout.getLayout(n.id);
    return m?app.renderer.worldToScreen(m.x,m.y):null;
  };
  const sideOf=n=>visible.get(n.id)?.side||n.sidePinned||n.side||'right';
  const world=app.renderer.screenToWorld(x,y);
  const target=hit?.type==='node'?app.state.findNode(hit.item.logicalId||hit.item.id):null;
  if(target&&excluded.has(target.id))return {kind:'keep'};
  const isHotspot=()=>{
    if(!target||excluded.has(target.id))return false;
    const m=visible.get(target.id)?.metric||app.layout.getLayout(hit.viewId||target.id);
    if(!m)return false;
    const p=app.renderer.worldToScreen(m.x,m.y);
    return Math.abs(x-p.x)<=Math.max(12,m.width*zoom*.28)&&
      Math.abs(y-p.y)<=Math.max(10,m.height*zoom*.3);
  };
  // A deliberate central hotspot attaches under another parent. Siblings
  // normally reorder; Alt makes nesting under a sibling explicit.
  if(target&&!excluded.has(target.id)&&isHotspot()&&
     (options.altKey||options.childIntent)&&
     target.id!==from.parentId)return {kind:'child',targetId:target.id,viewId:hit.viewId};
  // Explicit edge targeting remains available alongside geometric level selection.
  if(target&&!excluded.has(target.id)&&!isHotspot()&&(options.altKey||options.childIntent)&&target.parentId!==from.parentId){
   const parent=app.state.findNode(target.parentId);if(parent&&!excluded.has(parent.id)){const metric=app.layout.getLayout(hit.viewId||target.id),point=metric&&app.renderer.worldToScreen(metric.x,metric.y);if(point)return {kind:'reorder',targetId:target.id,after:y>point.y,viewId:hit.viewId};}
  }
  if(hit&&hit.type!=='node')return {kind:'keep'};
  if(from.isFloating)return {kind:'detach'};
  if(options.altKey&&!hit&&Math.hypot(x-(point(from)?.x||x),y-(point(from)?.y||y))>160)
    return {kind:'detach'};

  let parent=app.state.findNode(from.parentId);
  if(!parent)return {kind:'keep'};
  const side=x<centre.x?'left':'right';
  // Candidate lanes belong to the destination tree, including its deeper levels.
  // Compare screen geometry so the same gesture works at every zoom and side.
  const lanes=[];
  const pending=[{n:rootNode,parent:null}];
  while(pending.length){
    const {n,parent:candidateParent}=pending.pop();
    if(excluded.has(n.id)||n.isFloating||n.isSummary)continue;
    if(!n.collapsed)for(const child of n.children||[])pending.push({n:child,parent:n});
    if(n===rootNode||sideOf(n)!==side)continue;
    const p=point(n),m=visible.get(n.id)?.metric||app.layout.getLayout(n.id);
    if(!p||!m)continue;
    if(candidateParent&&!excluded.has(candidateParent.id))
      lanes.push({parent:candidateParent,score:Math.abs(x-p.x)+Math.abs(y-p.y)*.22});
    // An outward drop beyond a topic can create its first child. The parent must
    // also be close vertically; distant empty canvas never captures a leaf.
    const outward=(side==='left'?-1:1)*(x-p.x);
    const childDistance=Math.max(12,(m.width/2+70)*zoom);
    if(outward>m.width*zoom/2+Math.max(6,24*zoom)&&Math.abs(y-p.y)<Math.max(16,70*zoom))
      lanes.push({parent:n,score:Math.abs(outward-childDistance)+Math.abs(y-p.y)*.5+12});
  }
  lanes.sort((a,b)=>a.score-b.score);
  if(lanes.length)parent=lanes[0].parent;
  // Root space remains available even when that side has no branches yet.
  const rootBand=Math.max(20,(rootLayout?.width||70)*zoom/2+45*zoom);
  if(Math.abs(x-centre.x)<rootBand||!lanes.length)parent=rootNode;
  const isPrimary=parent===rootNode;
  // Dropping onto the central topic is not a hidden reparenting operation.
  if(isPrimary&&Math.abs(x-centre.x)<Math.max(20,(rootLayout?.width||70)*zoom/2+12))
    return {kind:'keep'};
  const candidates=(parent.children||[]).filter(n=>!excluded.has(n.id)&&!n.isSummary&&!n.isFloating&&
    (!isPrimary||sideOf(n)===side));
  const positions=candidates.map(n=>({n,p:point(n)})).filter(it=>it.p);
  // Alt+drop in truly empty space is the explicit detach operation.
  const sign=isPrimary&&side==='left'?-1:1;
  positions.sort((a,b)=>sign*(a.p.y-b.p.y));
  let slot=positions.findIndex(it=>sign*y<sign*it.p.y);
  if(slot<0)slot=positions.length;
  const before=positions[slot]?.n,after=positions[slot-1]?.n;
  const anchor=positions.reduce((best,item)=>!best||Math.abs(item.p.y-y)<Math.abs(best.p.y-y)?item:best,null)?.n;
  // A missing sibling is still a valid landing area: a branch may be the
  // first one moved to an empty side without becoming a floating island.
  return {kind:'place',parentId:parent.id,side,
    beforeId:before?.id||null,afterId:after?.id||null,
    targetId:anchor?.id||null};
 }
