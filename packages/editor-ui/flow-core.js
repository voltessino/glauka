/* NeuroMap process flow core: no implicit edges from tree sibling order.
 * The map hierarchy is an inventory of node IDs; directed transitions are explicit.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NeuroMapFlowCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const TYPES=Object.freeze(['sequence','yes','no']);
 const isFlowKind=value=>TYPES.includes(value);
 const SHAPES=Object.freeze(['auto','start','end','process','decision','input','output']);
 // Input and Output are explicit user-authored semantics; both share the
 // standard flowchart parallelogram. No sibling order or node text inference.
 const isIOShape=value=>value==='input'||value==='output';
 const IO_SKEW_RATIO=.12;
 function ioPoints(node){
  const x=node.x,y=node.y,w=node.w,h=node.h,skew=w*IO_SKEW_RATIO;
  return [[x-w/2+skew,y-h/2],[x+w/2,y-h/2],
          [x+w/2-skew,y+h/2],[x-w/2,y+h/2]];
 }
 const shape=value=>SHAPES.includes(value)?value:'auto';
 const clampMax=n=>Math.max(1,Math.min(1200,Number(n)||500));
 function candidates(tree,max=1200){
  if(!tree||typeof tree!=='object')throw Error('Missing map');
  const found=[],seenIds=new Set(),seenNodes=new Set(),stack=[{node:tree,path:[]}];
  while(stack.length){
   const {node,path}=stack.pop();
   if(!node||typeof node.id!=='string'||!node.id||seenNodes.has(node)||seenIds.has(node.id))throw Error('Invalid node graph');
   if(found.length>=max)throw Error('Map too large for flow editor');
   seenNodes.add(node);seenIds.add(node.id);
   const texts=[...path,String(node.text||'')];
   found.push({id:node.id,text:String(node.text||''),path:texts.slice(-4).join(' › '),index:found.length,
     flowShape:shape(node.flowShape)});
   const children=Array.isArray(node.children)?node.children:[];
   for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],path:texts});
  }
  return found;
 }
 function project(tree,relationships=[],options={}){
  const all=candidates(tree,clampMax(options.maxCandidates));
  const lookup=new Map(all.map(n=>[n.id,n]));
  const edges=[],edgeIds=new Set();
  for(const raw of Array.isArray(relationships)?relationships:[]){
   if(!raw||!isFlowKind(raw.kind)||!lookup.has(raw.fromId)||!lookup.has(raw.toId))continue;
   if(raw.fromId===raw.toId)continue;
   const key=raw.fromId+'\x00'+raw.toId+'\x00'+raw.kind;
   if(edgeIds.has(key))continue;
   edgeIds.add(key);
   edges.push({id:String(raw.id||key),fromId:raw.fromId,toId:raw.toId,kind:raw.kind,
    label:String(raw.label|| (raw.kind==='yes'?'Sì':raw.kind==='no'?'No':'' )).slice(0,80)});
  }
  const participating=new Set();
  for(const edge of edges){participating.add(edge.fromId);participating.add(edge.toId)}
  // A manually marked process shape is an intentional user-authored step,
  // even before the user attaches a transition. Unmarked siblings stay hidden.
  for(const node of all)if(node.flowShape!=='auto'&&node.id!==tree.id)
    participating.add(node.id);
  const members=all.filter(n=>participating.has(n.id));
  if(!members.length)return {nodes:[],edges:[],candidates:all,width:560,height:300,empty:true,hasCycles:false};
  // Topological layering. Cyclic residues stay visible in a finite final tier;
  // loop-back arrows remain explicit rather than silently breaking the graph.
  const inDegree=new Map(members.map(n=>[n.id,0]));
  const outgoing=new Map(members.map(n=>[n.id,[]]));
  for(const edge of edges){inDegree.set(edge.toId,inDegree.get(edge.toId)+1);outgoing.get(edge.fromId).push(edge.toId)}
  const depth=new Map(),queued=[];
  for(const n of members)if(inDegree.get(n.id)===0){queued.push(n.id);depth.set(n.id,0)}
  for(let i=0;i<queued.length;i++){
   const id=queued[i],d=depth.get(id)||0;
   for(const target of outgoing.get(id)){
    depth.set(target,Math.max(depth.get(target)||0,Math.min(50,d+1)));
    const incoming=inDegree.get(target)-1;inDegree.set(target,incoming);
    if(incoming===0)queued.push(target);
   }
  }
  const hasCycles=queued.length!==members.length;
  let residueDepth=Math.max(0,...depth.values())+1;
  for(const n of members)if(!queued.includes(n.id))depth.set(n.id,residueDepth);
  const tiers=new Map();
  for(const n of members){const d=depth.get(n.id)||0;if(!tiers.has(d))tiers.set(d,[]);tiers.get(d).push(n)}
  const nodes=[],maxDepth=Math.max(...tiers.keys()),decisionSources=new Set();
  const incomingCounts=new Map(members.map(n=>[n.id,0])),outgoingCounts=new Map(members.map(n=>[n.id,0]));
  for(const edge of edges){
   incomingCounts.set(edge.toId,incomingCounts.get(edge.toId)+1);
   outgoingCounts.set(edge.fromId,outgoingCounts.get(edge.fromId)+1);
  }
  for(const edge of edges)if(edge.kind==='yes'||edge.kind==='no')decisionSources.add(edge.fromId);
  const COLUMN_STEP=280,ROW_STEP=184;
  // Large explicitly authored stages need bounded rows, not microscopic cards.
  // Wrap presentation-only into columns, preserving typed links and depth.
  const MAX_TIER_ROWS=18,WRAP_AFTER=24;
  let extraColumns=0;
  // A decision's explicit Yes branch appears above No when both land in the
  // same tier, regardless of arbitrary mind-map sibling order.
  // This reorders presentation only, never the canonical tree or transitions.
  const decisions=new Map();
  for(const edge of edges)if(edge.kind==='yes'||edge.kind==='no'){
   let pair=decisions.get(edge.fromId);
   if(!pair){pair={};decisions.set(edge.fromId,pair)}
   if(!pair[edge.kind])pair[edge.kind]=edge.toId;
  }
  for(const [tier,items] of [...tiers.entries()].sort((a,b)=>a[0]-b[0])){
   const ranked=items.slice();
   const columns=ranked.length>WRAP_AFTER?Math.ceil(ranked.length/MAX_TIER_ROWS):1;
   const xBase=155+(tier+extraColumns)*COLUMN_STEP;
   // Dense process cards can use a 112px row. Tall decision diamonds
   // retain 184px clearance; small unwrapped diagrams stay unchanged.
   const tierRowStep=columns>1&&
     !ranked.some(n=>n.flowShape==='decision'||decisionSources.has(n.id))?112:ROW_STEP;
   for(const pair of decisions.values()){
    if(!pair.yes||!pair.no)continue;
    const yes=ranked.findIndex(n=>n.id===pair.yes);
    const no=ranked.findIndex(n=>n.id===pair.no);
    if(yes>=0&&no>=0&&yes>no){
      const [entry]=ranked.splice(yes,1);
      ranked.splice(no,0,entry);
    }
   }
   for(let index=0;index<ranked.length;index++){
    const n=ranked[index];
    const column=columns===1?0:index%columns;
    const row=columns===1?index:Math.floor(index/columns);
    // Stable stagger keeps the ordered Yes item above No in a shared row.
    const stagger=columns===1?0:column;
    const flowShape=n.flowShape!=='auto'?n.flowShape:
      decisionSources.has(n.id)?'decision':
      incomingCounts.get(n.id)===0&&outgoingCounts.get(n.id)>0?'start':
      outgoingCounts.get(n.id)===0&&incomingCounts.get(n.id)>0?'end':'process';
    const isDecision=flowShape==='decision',terminal=flowShape==='start'||flowShape==='end',
      io=isIOShape(flowShape);
    // Preserve an explicit user override even if later links contradict it,
    // but make that contradiction visible rather than disguising the process.
    const roleConflict=(flowShape==='start'&&incomingCounts.get(n.id)>0)||
      (flowShape==='end'&&outgoingCounts.get(n.id)>0);
    nodes.push({...n,depth:tier,x:xBase+column*COLUMN_STEP,y:130+row*tierRowStep+stagger,
      w:isDecision?206:io?200:terminal?186:190,h:isDecision?148:io?82:terminal?70:76,
      decision:isDecision,terminal,io,shape:flowShape,roleConflict,
      incoming:incomingCounts.get(n.id),outgoing:outgoingCounts.get(n.id),
      ...(columns>1?{layoutColumn:column,layoutColumns:columns}:{})});

   }
   extraColumns+=columns-1;
  }
  const width=Math.max(580,210+(maxDepth+extraColumns)*COLUMN_STEP+170);
  const height=Math.max(340,...nodes.map(n=>Math.ceil(n.y+n.h/2+84)));
  return {nodes,edges,candidates:all,width,height,empty:false,hasCycles};
 }
 function ports(from,to,kind='sequence'){
  const decision=from.decision&&(kind==='yes'||kind==='no');
  // Two outlets on the right-hand sloped sides of the diamond.
  const sx=decision?from.x+from.w/4:
    from.x+from.w/2-(from.io?from.w*IO_SKEW_RATIO/2:0);
  const sy=decision?from.y+(kind==='yes'?-from.h/4:from.h/4):from.y;
  const ex=to.x-to.w/2+(to.io?to.w*IO_SKEW_RATIO/2:0),ey=to.y;
  return {sx,sy,ex,ey};
 }
 function longWrappedLink(from,to,sx,ex){
  return (from.layoutColumns>1||to.layoutColumns>1)&&
    to.depth>from.depth&&ex-sx>200;
 }
 function path(from,to,kind='sequence'){
  const {sx,sy,ex,ey}=ports(from,to,kind);
  if(longWrappedLink(from,to,sx,ex)){
   // A long cubic curve in a folded tier would cut through earlier cards.
   // Travel in the free gutters beside cards and above the topmost row.
   const railY=20+Math.min(22,(to.layoutColumn||0)*2);
   return 'M'+sx+' '+sy+' H'+(sx+24)+' V'+railY+
     ' H'+(ex-28)+' V'+ey+' H'+ex;
  }
  if(to.depth<=from.depth||ex<=sx+32){
   // Explicit backward/cycle transitions detour below both cards.
   const bottom=Math.max(from.y+from.h/2,to.y+to.h/2)+44;
   const right=Math.max(sx,ex)+56;
   const left=ex-35;
   return 'M'+sx+' '+sy+' H'+right+' V'+bottom+' H'+left+' V'+ey+' H'+ex;
  }
  const mid=Math.max(24,(ex-sx)*.45);
  return 'M'+sx+' '+sy+' C'+(sx+mid)+' '+sy+','+(ex-mid)+' '+ey+','+ex+' '+ey;
 }
 function labelPoint(from,to,kind='sequence'){
  const {sx,sy,ex,ey}=ports(from,to,kind);
  if(longWrappedLink(from,to,sx,ex))
   return {x:sx+24,y:sy+(kind==='yes'?-15:kind==='no'?18:-18)};
  if(to.depth<=from.depth||ex<=sx+32)
   return {x:Math.max(sx,ex)+40,y:Math.max(from.y+from.h/2,to.y+to.h/2)+29};
  return {x:sx+Math.max(18,(ex-sx)*.22),y:sy+(kind==='yes'?-13:kind==='no'?21:0)};
 }
 return Object.freeze({TYPES,SHAPES,isFlowKind,isIOShape,IO_SKEW_RATIO,ioPoints,shape,candidates,project,ports,path,labelPoint});
});
