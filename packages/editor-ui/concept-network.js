/* Free concept network: a deterministic, non-destructive projection of the original map.
 * Positions are optional per-node metadata; cross-links reuse the native relationships.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NeuroMapConceptNetwork=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const MAX_NODES=1200;
 function position(value){
  if(!value||typeof value!=='object'||!Number.isFinite(value.x)||!Number.isFinite(value.y))return null;
  if(value.x<115||value.y<65||value.x>20000||value.y>20000)return null;
  return {x:Math.round(value.x),y:Math.round(value.y)};
 }
 function project(tree,relationships=[],opts={}){
  if(!tree||typeof tree.id!=='string'||!tree.id)throw Error('Missing concept map root');
  const maximum=Math.max(1,Math.min(MAX_NODES,Number(opts.maxNodes)||MAX_NODES));
  const seenIds=new Set(),seenNodes=new Set(),items=[],tiers=new Map(),stack=[{node:tree,parentId:null,depth:0,clusterId:null}];
  while(stack.length){
   const {node,parentId,depth,clusterId}=stack.pop();
   if(!node||typeof node!=='object'||typeof node.id!=='string'||!node.id||seenIds.has(node.id)||seenNodes.has(node))throw Error('Invalid concept graph');
   if(items.length>=maximum)throw Error('Concept network exceeds safe display limit');
   seenIds.add(node.id);seenNodes.add(node);
   const item={id:node.id,parentId,depth,text:String(node.text??''),color:node.color||'#818cf8',
    position:position(node.networkPosition),clusterId:clusterId||null};
   items.push(item);
   if(!tiers.has(depth))tiers.set(depth,[]);
   tiers.get(depth).push(item);
   const children=Array.isArray(node.children)?node.children:[];
   for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parentId:node.id,depth:depth+1,clusterId:depth===0?children[i]?.id:clusterId});
  }
  // Pack first-level subtrees into deterministic grid cells; large sibling
  // groups may occupy multiple lanes instead of one unbounded vertical strip.
  const density=Number.isFinite(opts.density)?Math.max(.85,Math.min(1.4,opts.density)):1;
  const STEP_Y=Math.round(122*density),GROUP_GAP=Math.round(72*density),CARD_W=184,CARD_H=68;
  const groups=[],groupCount=new Map();
  for(const item of items){
   if(!item.clusterId)continue;
   if(!groupCount.has(item.clusterId)){groupCount.set(item.clusterId,new Map());groups.push(item.clusterId)}
   const counts=groupCount.get(item.clusterId);
   counts.set(item.depth,(counts.get(item.depth)||0)+1);
  }
  const largestTier=Math.max(1,...groups.flatMap(id=>[...groupCount.get(id).values()]));
  const rowCap=Math.max(12,Math.min(30,Math.ceil(Math.sqrt(largestTier*1.6))));
  const shapes=new Map();
  let cellWidth=560,cellHeight=STEP_Y+GROUP_GAP;
  for(const id of groups){
   const depths=[...groupCount.get(id).keys()].sort((a,b)=>a-b),depthOffsets=new Map();
   let occupiedLanes=0,groupRows=1;
   for(const depth of depths){
    const count=groupCount.get(id).get(depth);
    depthOffsets.set(depth,occupiedLanes);
    occupiedLanes+=Math.ceil(count/rowCap);
    groupRows=Math.max(groupRows,Math.min(rowCap,count));
   }
   shapes.set(id,{depthOffsets});
   cellWidth=Math.max(cellWidth,occupiedLanes*256+70);
   cellHeight=Math.max(cellHeight,groupRows*STEP_Y+GROUP_GAP);
  }
  // Keep small maps familiar; wrap larger ones into balanced rows of clusters.
  const columns=groups.length<=3?1:Math.max(2,Math.min(groups.length,24,
   Math.round(Math.sqrt(groups.length*1.45*cellHeight/cellWidth))));
  const groupOrigins=new Map(groups.map((id,index)=>[id,{
   x:436+(index%columns)*cellWidth,
   y:110+Math.floor(index/columns)*cellHeight
  }]));
  const clusterIndex=new Map(groups.map((id,index)=>[id,index]));
  // Manual coordinates are immutable obstacles; auto nodes must route around them.
  const occupied=items.filter(n=>n.position).map(n=>({x:n.position.x,y:n.position.y,w:CARD_W,h:CARD_H}));
  // Query only nearby cells, but keep the original first-obstacle order.
  // This preserves exact deterministic placement while avoiding full scans
  // of every previously placed card for each automatic concept.
  const buckets=new Map();let occupiedCount=0;
  const occupy=rect=>{const key=Math.floor(rect.x/256)+':'+Math.floor(rect.y/128);
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push({...rect,order:occupiedCount++});
  };
  for(const rect of occupied)occupy(rect);
  const firstCollision=(x,y)=>{
   let hit=null;
   for(let bx=Math.floor((x-CARD_W-18)/256);bx<=Math.floor((x+CARD_W+18)/256);bx++)
    for(let by=Math.floor((y-CARD_H-22)/128);by<=Math.floor((y+CARD_H+22)/128);by++)
     for(const other of buckets.get(bx+':'+by)||[])
      if((!hit||other.order<hit.order)&&Math.abs(x-other.x)<(CARD_W+other.w)/2+18&&
         Math.abs(y-other.y)<(CARD_H+other.h)/2+22)hit=other;
   return hit;
  };
  const nodes=[],ranks=new Map();
  for(const [depth,tier]of tiers)for(const n of tier){
   const key=depth+':'+n.clusterId,rank=ranks.get(key)||0;
   ranks.set(key,rank+1);
   const p=n.position,origin=groupOrigins.get(n.clusterId),shape=shapes.get(n.clusterId);
   const x=p?p.x:!origin?180:origin.x+(shape.depthOffsets.get(depth)+Math.floor(rank/rowCap))*256;
   let y=p?p.y:!origin?110:origin.y+(rank%rowCap)*STEP_Y;
   if(!p){
    // Placement is deterministic; no random force simulation or writes to the map.
    for(let attempt=0;attempt<=occupiedCount;attempt++){
     const hit=firstCollision(x,y);
     if(!hit)break;
     y=Math.ceil(hit.y+(CARD_H+hit.h)/2+22);
    }
    occupy({x,y,w:CARD_W,h:CARD_H});
   }
   nodes.push({id:n.id,parentId:n.parentId,depth:n.depth,text:n.text,color:n.color,
    clusterId:n.clusterId,clusterIndex:clusterIndex.get(n.clusterId)??-1,
    x,y,w:CARD_W,h:CARD_H,manual:!!p});
  }
  const byId=new Map(nodes.map(n=>[n.id,n])),edges=[];
  for(const n of nodes)if(n.parentId)edges.push({id:'parent:'+n.id,fromId:n.parentId,toId:n.id,type:'hierarchy',label:''});
  const used=new Set();
  for(const rel of Array.isArray(relationships)?relationships:[]){
   if(!rel||!byId.has(rel.fromId)||!byId.has(rel.toId)||rel.fromId===rel.toId)continue;
   const id=String(rel.id??'');
   if(!id||used.has(id))continue;
   used.add(id);
   edges.push({id,fromId:rel.fromId,toId:rel.toId,type:'relation',
    kind:['sequence','yes','no'].includes(rel.kind)?rel.kind:null,
    label:String(rel.label??'').slice(0,100),color:String(rel.color||'#a78bfa')});
  }
  const width=Math.max(680,...nodes.map(n=>Math.ceil(n.x+n.w/2+130)));
  const height=Math.max(430,...nodes.map(n=>Math.ceil(n.y+n.h/2+130)));
  return {mode:'concept-network',nodes,edges,width,height};
 }
 function path(from,to){
  const right=to.x>=from.x;
  const dx=Math.abs(to.x-from.x),dy=to.y-from.y;
  if(dx>100){
   const sx=from.x+(right?from.w/2:-from.w/2),tx=to.x+(right?-to.w/2:to.w/2);
   const bend=Math.max(34,Math.abs(tx-sx)*.48);
   return 'M'+sx+' '+from.y+' C'+(sx+(right?bend:-bend))+' '+from.y+','+(tx+(right?-bend:bend))+' '+to.y+','+tx+' '+to.y;
  }
  const down=dy>=0,sy=from.y+(down?from.h/2:-from.h/2),ey=to.y+(down?-to.h/2:to.h/2);
  const bend=Math.max(30,Math.abs(ey-sy)*.45);
  return 'M'+from.x+' '+sy+' C'+from.x+' '+(sy+(down?bend:-bend))+','+to.x+' '+(ey+(down?-bend:bend))+','+to.x+' '+ey;
 }
 function labelPoint(from,to){
  const horizontal=Math.abs(from.x-to.x)>Math.abs(from.y-to.y);
  return {x:(from.x+to.x)/2,
   y:horizontal&&Math.abs(from.y-to.y)<38?Math.min(from.y-from.h/2,to.y-to.h/2)-14:
    (from.y+to.y)/2-12};
 }
 // Label measurement must count visible characters, not UTF-16 code units:
 // slice() could split a surrogate pair or an emoji ZWJ sequence in two.
 let labelSegmenter=null;
 function labelGraphemes(value){
  const text=String(value??'');
  if(typeof Intl==='object'&&typeof Intl.Segmenter==='function'){
   labelSegmenter ||= new Intl.Segmenter(undefined,{granularity:'grapheme'});
   return Array.from(labelSegmenter.segment(text),part=>part.segment);
  }
  // Older WebViews may lack Intl.Segmenter. Preserve common extended
  // graphemes (combining accents, variation selectors, skin tones, ZWJ emoji,
  // keycaps and regional-indicator flag pairs) without third-party libraries.
  const parts=[],codepoints=Array.from(text);
  const marks=/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\u{1f3fb}-\u{1f3ff}]/u;
  const regional=cp=>/[\u{1f1e6}-\u{1f1ff}]/u.test(cp);
  let current='',regionalCount=0;
  for(const cp of codepoints){
   if(!current){current=cp;regionalCount=regional(cp)?1:0;continue}
   if(cp==='\u200d'||current.endsWith('\u200d')||marks.test(cp)||
      (regional(cp)&&regionalCount===1)){
    current+=cp;
    if(regional(cp))regionalCount++;
    continue;
   }
   parts.push(current);current=cp;regionalCount=regional(cp)?1:0;
  }
  if(current)parts.push(current);
  return parts;
 }
 function graphemeWidth(unit){
  if(/^\s+$/u.test(unit))return 4;
  // Wide East Asian scripts and pictographs occupy more horizontal space at
  // a fixed 12px font than a Latin letter. This is a conservative estimate.
  return /[\u{1100}-\u{11ff}\u{2e80}-\u{a4cf}\u{ac00}-\u{d7af}\u{f900}-\u{faff}\u{1f000}-\u{1ffff}]/u.test(unit)?12:6.7;
 }
 function labelTextWidth(value){
  return labelGraphemes(value).reduce((total,unit)=>total+graphemeWidth(unit),0);
 }
 function displayLabel(value,maxLength=22){
  const normalized=String(value??'').replace(/\s+/g,' ').trim();
  const parts=labelGraphemes(normalized);
  const limit=Number.isInteger(maxLength)?Math.max(8,Math.min(60,maxLength)):22;
  // Reserve the same 20px padding used by placement's maximum 185px plate.
  const budget=165;
  let count=0,width=0;
  while(count<parts.length&&count<limit){
   const unit=parts[count],remaining=count+1<parts.length;
   const reserve=remaining?8:0;
   if(width+graphemeWidth(unit)+reserve>budget)break;
   width+=graphemeWidth(unit);count++;
  }
  if(count===parts.length)return normalized;
  // The ellipsis itself consumes a grapheme slot when the limit is reached.
  if(count>=limit)count=limit-1;
  return parts.slice(0,count).join('').trimEnd()+'…';
 }

 // Presentation-only label placement: spatial buckets avoid O(nodes * links)
 // scans on large maps. Hidden crowded labels still exist as full edge text.
 const LABEL_LIMIT=260,CELL=160;
 function placeLabels(graph,opts={}){
  const nodes=Array.isArray(graph?.nodes)?graph.nodes:[],edges=Array.isArray(graph?.edges)?graph.edges:[];
  const byId=new Map(nodes.map(n=>[n.id,n])),buckets=new Map(),result=new Map();
  const maximum=Number.isInteger(opts.maxLabels)?Math.max(0,Math.min(500,opts.maxLabels)):LABEL_LIMIT;
  const span=(rect)=>({
   x0:Math.floor((rect.x-rect.w/2)/CELL),x1:Math.floor((rect.x+rect.w/2)/CELL),
   y0:Math.floor((rect.y-rect.h/2)/CELL),y1:Math.floor((rect.y+rect.h/2)/CELL)
  });
  function insert(rect){
   const r=span(rect);
   for(let x=r.x0;x<=r.x1;x++)for(let y=r.y0;y<=r.y1;y++){
    const key=x+':'+y;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(rect);
   }
  }
  function blocked(rect){
   const r=span({x:rect.x,y:rect.y,w:rect.w+16,h:rect.h+16}),seen=new Set();
   for(let x=r.x0;x<=r.x1;x++)for(let y=r.y0;y<=r.y1;y++){
    for(const item of buckets.get(x+':'+y)||[]){
     if(seen.has(item))continue;
     seen.add(item);
     if(Math.abs(rect.x-item.x)<(rect.w+item.w)/2+8&&
        Math.abs(rect.y-item.y)<(rect.h+item.h)/2+8)return true;
    }
   }
   return false;
  }
  for(const node of nodes)insert(node);
  let attempts=0;
  for(const edge of edges){
   if(edge?.type!=='relation'||!edge.label||attempts>=maximum)continue;
   const from=byId.get(edge.fromId),to=byId.get(edge.toId);
   if(!from||!to)continue;
   attempts++;
   const text=displayLabel(edge.label),w=Math.min(185,Math.max(44,Math.ceil(labelTextWidth(text))+20)),h=25;
   const dx=to.x-from.x,dy=to.y-from.y,length=Math.max(1,Math.hypot(dx,dy));
   const px=-dy/length,py=dx/length;
   let placed=null;
   // Midpoint first, then other points along the link, shifted perpendicularly.
   for(const t of [.5,.32,.68,.18,.82]){
    if(placed)break;
    for(const offset of [0,-29,29,-58,58,-92,92]){
     const x=Math.round(from.x+dx*t+px*offset),y=Math.round(from.y+dy*t+py*offset);
     if(x-w/2<24||y-h/2<24||x+w/2>(graph.width||0)-18||
        y+h/2>(graph.height||0)-18)continue;
     const box={x,y,w,h};
     if(blocked(box))continue;
     placed=box;break;
    }
   }
   if(placed)insert(placed);
   result.set(edge.id,{...(placed||{x:0,y:0,w,h}),text,hidden:!placed});
  }
  return result;
 }
 // Temporary presentation-only layout for the selected node and its direct
 // neighbors. Manual networkPosition values stay immutable obstacles.
 function arrangeRelated(graph,focusId,opts={}){
  const nodes=Array.isArray(graph?.nodes)?graph.nodes.map(n=>({...n})):[];
  const edges=Array.isArray(graph?.edges)?graph.edges:[];
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const focus=byId.get(focusId);
  if(!focus)return {nodes:byId,changed:false,moved:[]};
  const neighborIds=new Set();
  for(const edge of edges){
   if(edge.fromId===focusId)neighborIds.add(edge.toId);
   else if(edge.toId===focusId)neighborIds.add(edge.fromId);
  }
  const neighbors=[...neighborIds].map(id=>byId.get(id)).filter(Boolean)
   .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const limit=Math.max(1,Math.min(40,Number(opts.maxNodes)||36));
  const candidates=neighbors.filter(n=>!n.manual).slice(0,limit);
  if(!candidates.length)return {nodes:byId,changed:false,moved:[]};
  const gap=Number.isFinite(opts.gap)?Math.max(16,Math.min(40,opts.gap)):24;
  const radius=Math.max(150,Math.min(420,
   90+Math.ceil(Math.sqrt(candidates.length))*((focus.w+focus.h)/2+gap)));
  const obstacles=nodes.filter(n=>n.manual||n.id===focusId||
   (neighborIds.has(n.id)&&n.manual));
  const buckets=new Map();
  const key=(x,y)=>Math.floor(x/256)+':'+Math.floor(y/128);
  const occupy=n=>{
   const k=key(n.x,n.y);if(!buckets.has(k))buckets.set(k,[]);
   buckets.get(k).push(n);
  };
  for(const n of nodes)if(n.manual||n.id===focusId||!candidates.includes(n))occupy(n);
  const collisions=(x,y,self)=>{
   for(let bx=Math.floor((x-self.w-gap)/256);bx<=Math.floor((x+self.w+gap)/256);bx++)
    for(let by=Math.floor((y-self.h-gap)/128);by<=Math.floor((y+self.h+gap)/128);by++)
     for(const other of buckets.get(bx+':'+by)||[]){
      if(other.id===self.id)continue;
      if(Math.abs(x-other.x)<(self.w+other.w)/2+gap&&
         Math.abs(y-other.y)<(self.h+other.h)/2+gap)return true;
     }
   return false;
  };
  const moved=[];
  const count=candidates.length;
  for(let i=0;i<count;i++){
   const node=candidates[i];
   const angle=-Math.PI/2+(i/count)*Math.PI*2;
   let x=Math.round(focus.x+Math.cos(angle)*radius);
   let y=Math.round(focus.y+Math.sin(angle)*radius);
   x=Math.max(115,Math.min(20000,x));
   y=Math.max(65,Math.min(20000,y));
   for(let attempt=0;attempt<24;attempt++){
    if(!collisions(x,y,node))break;
    const push=12+attempt*6;
    x=Math.round(focus.x+Math.cos(angle)*(radius+push));
    y=Math.round(focus.y+Math.sin(angle)*(radius+push));
    x=Math.max(115,Math.min(20000,x));
    y=Math.max(65,Math.min(20000,y));
   }
   node.x=x;node.y=y;occupy(node);moved.push(node.id);
  }
  return {nodes:byId,changed:moved.length>0,moved};
 }
 return Object.freeze({MAX_NODES,position,project,path,labelPoint,displayLabel,placeLabels,arrangeRelated});
});
