 function walkVisible(node,visit){
  const pending=[node],seen=new WeakSet();
  while(pending.length){const current=pending.pop();if(!current||seen.has(current))continue;seen.add(current);visit(current);
   if(!current.collapsed)for(let i=(current.children?.length||0)-1;i>=0;i--)pending.push(current.children[i]);
  }
 }
 // One geometry plan drives the preview and the saved file.
 function exportPlan(box,options={}){
  const padding=60,mapX=box.minX-padding,mapY=box.minY-padding;
  const mapW=Math.max(600,box.width+padding*2),mapH=Math.max(400,box.height+padding*2);
  if(options.format==='png'){
   const requested=[1,2,3].includes(Number(options.scale))?Number(options.scale):2;
   const scale=Math.min(requested,10000/mapW,10000/mapH,Math.sqrt(32000000/(mapW*mapH)));
   return {mapX,mapY,mapW,mapH,scale,width:Math.max(1,Math.floor(mapW*scale)),height:Math.max(1,Math.floor(mapH*scale))};
  }
  let pageW=options.paper==='a4'?841.89:1190.55,pageH=options.paper==='a4'?595.28:841.89;
  if(options.orientation==='portrait')[pageW,pageH]=[pageH,pageW];
  const margin=28,innerW=pageW-margin*2,innerH=pageH-margin*2;
  let worldPerPt=options.pagination==='tiles'?1:Math.max(mapW/innerW,mapH/innerH);
  let cols=Math.max(1,Math.ceil(mapW/(innerW*worldPerPt)-1e-9)),rows=Math.max(1,Math.ceil(mapH/(innerH*worldPerPt)-1e-9));
  while(cols*rows>48){worldPerPt*=1.22;cols=Math.ceil(mapW/(innerW*worldPerPt));rows=Math.ceil(mapH/(innerH*worldPerPt));}
  const fit=options.pagination!=='tiles';
  return {mapX,mapY,mapW,mapH,pageW,pageH,margin,innerW,innerH,worldPerPt,cols,rows,
   startX:mapX-(fit?Math.max(0,(innerW*worldPerPt-mapW)/2):0),startY:mapY-(fit?Math.max(0,(innerH*worldPerPt-mapH)/2):0)};
 }
 function viewport(){
  const r={left:18,top:18,right:innerWidth-18,bottom:innerHeight-22};
  const chrome=document.querySelector('.top-chrome')?.getBoundingClientRect();
  if(chrome&&chrome.bottom>0&&chrome.bottom<innerHeight-50)r.top=Math.max(r.top,Math.ceil(chrome.bottom)+12);
  const rail=document.getElementById('nm-workspace-rail')?.getBoundingClientRect();
  if(rail&&rail.width>0&&rail.height>0&&rail.bottom<innerHeight-50)r.top=Math.max(r.top,Math.ceil(rail.bottom)+12);
  const dock=document.getElementById('mobile-dock')?.getBoundingClientRect();
  if(dock&&dock.height>0&&dock.top>r.top+30)r.bottom=Math.min(r.bottom,dock.top-12);
  const tools=document.getElementById('nm614-right-dock')?.getBoundingClientRect();
  if(tools&&tools.width>0&&tools.left>180)r.right=Math.min(r.right,tools.left-12);
  const sidebar=document.getElementById('inspector-sidebar');
  if(sidebar&&!sidebar.classList.contains('collapsed')){
   const box=sidebar.getBoundingClientRect();
   // A full-width mobile inspector is an overlay; it has no canvas beside it.
   if(box.width>100&&box.left>=180)r.right=Math.min(r.right,box.left-17);
  }
  const drawing=document.getElementById('nm-drawing-toolbar');
  if(drawing&&!drawing.hidden){const box=drawing.getBoundingClientRect();if(box.width>0){if(innerWidth>650&&box.left>180)r.right=Math.min(r.right,box.left-12);else if(box.top>r.top+60)r.bottom=Math.min(r.bottom,box.top-12);}}
  const ai=document.getElementById('nm-ai-studio');
  if(ai&&!ai.classList.contains('hidden')&&!ai.classList.contains('minimized')){const box=ai.getBoundingClientRect();if(box.width>100&&box.left>=180)r.right=Math.min(r.right,box.left-16);}
  for(const panel of document.querySelectorAll('#nm-knowledge-panel,#nm-learn-panel,.hud-bottom-left')){
   if(panel.hidden||panel.classList.contains('hidden'))continue;const box=panel.getBoundingClientRect();
   if(box.width>100&&box.left>=180)r.right=Math.min(r.right,box.left-16);
  }
  const markerShelf=document.getElementById('nm62-assets');
  if(markerShelf&&!markerShelf.classList.contains('hidden')){const box=markerShelf.getBoundingClientRect();if(box.width>100&&box.left>=180)r.right=Math.min(r.right,box.left-16);}
  const library=document.getElementById('nm-creative-library-hub');
  const libraryPanel=library?.querySelector?.('.nm-creative-dialog');
  if(libraryPanel&&libraryPanel.getAttribute('aria-modal')==='false'){
   const box=libraryPanel.getBoundingClientRect();
   if(box.width>100&&box.left>=180)r.right=Math.min(r.right,box.left-16);
  }
  // The minimap is a corner HUD. Fit frames the map in the free canvas so a
  // node is not parked underneath it. A hidden radar keeps the full frame.
  // On a narrow window the radar is wide, so the reserve moves to the bottom
  // and the map keeps its width.
  const radar=document.getElementById('nm616-minimap-shell');
  if(radar&&!radar.hidden&&!radar.classList?.contains('hidden')){
   const box=radar.getBoundingClientRect?.();
   if(box&&box.width>40&&box.height>40){
    const gap=12,width=r.right-r.left,height=r.bottom-r.top;
    const right=Math.floor(box.left)-gap,bottom=Math.floor(box.top)-gap;
    if(box.left>r.left+width*0.55&&right-r.left>width*0.62)r.right=Math.min(r.right,right);
    else if(box.top>r.top+height*0.45&&bottom-r.top>height*0.62)r.bottom=Math.min(r.bottom,bottom);
   }
  }
  return r;
 }
 function fit(app,box,maxZoom=2.3){
  if(!box||![box.minX,box.maxX,box.minY,box.maxY].every(Number.isFinite))return false;
  const r=viewport(),w=Math.max(1,r.right-r.left),h=Math.max(1,r.bottom-r.top),pad=Math.min(20,w*.05,h*.05);
  const zoom=Math.max(.000001,Math.min(maxZoom,(w-pad*2)/Math.max(1,box.width),(h-pad*2)/Math.max(1,box.height)));
  app._teleportNonce=(app._teleportNonce||0)+1;app.stopTeleport?.();
  Object.assign(app.renderer.camera,{zoom,x:(r.left+r.right)/2-(box.minX+box.maxX)/2*zoom,y:(r.top+r.bottom)/2-(box.minY+box.maxY)/2*zoom});
  app.updateStatus();app.requestRender();app.positionEditor();return true;
 }
 function subtreeBounds(app,id){
  const node=app.state.findNode(id);if(!node)return null;
  const ids=new Set();walkVisible(node,n=>ids.add(n.id));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const include=(x,y,w,h,pad)=>{minX=Math.min(minX,x-w/2-pad);maxX=Math.max(maxX,x+w/2+pad);minY=Math.min(minY,y-h/2-pad);maxY=Math.max(maxY,y+h/2+pad);};
  if(app.layout.presentationRoot){for(const [id,view]of app.layout.viewNodes)if(ids.has(view.logicalId||id)){const m=app.layout.nodeLayoutMap.get(id);if(m)include(m.x,m.y,m.width,m.height,12);}}
  else for(const id of ids){const m=app.layout.getLayout(id);if(m)include(m.x,m.y,m.width,m.height,12);}
  for(const image of app.state.images||[])if(image.mode==='attached'&&ids.has(image.attachedNodeId)){
   const r=app.renderer.resolveImageWorldRect(image);if(r)include(r.cx,r.cy,r.w,r.h,10);
  }
  if(minX===Infinity)return null;return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
 }
 function bounds(app,id=null){
  const base=id?subtreeBounds(app,id):app.layout.computeBoundingBox(app.state.images);if(!base)return null;
  const box={...base},ctx=app.layout.measureCtx,ids=new Set(),rootNode=id?app.state.findNode(id):app.state.root;
  walkVisible(rootNode,n=>ids.add(n.id));
  const include=(x,y,w=0,h=0,pad=12)=>{box.minX=Math.min(box.minX,x-w/2-pad);box.maxX=Math.max(box.maxX,x+w/2+pad);box.minY=Math.min(box.minY,y-h/2-pad);box.maxY=Math.max(box.maxY,y+h/2+pad);};
  walkVisible(rootNode,n=>{const m=app.layout.getLayout(n.id);if(m&&n.markers?.length)include(m.x+m.width/2+11+(Math.min(3,n.markers.length)-1)*19,m.y-m.height/2+4,18,18,2);if(n.boundary?.enabled){const b=app.layout.getSubtreeBoundingBox(n,false);if(b){include((b.minX+b.maxX)/2,(b.minY+b.maxY)/2,b.width+32,b.height+28,18);
   const title=String(n.boundary.title||'').trim().slice(0,110);if(title){ctx.save();ctx.font='600 13px Inter,system-ui,sans-serif';const w=Math.min(Math.max(85,ctx.measureText(title).width+24),Math.max(110,b.width+32));ctx.restore();include(b.minX-2+w/2,b.minY-29,w,24);}
  }}});
  for(const rel of [...(app.state.relationships||[]),...(app.layout.presentationRelations||[])]){if(!ids.has(app.layout.viewNodes?.get(rel.fromId)?.logicalId||rel.fromId)||!ids.has(app.layout.viewNodes?.get(rel.toId)?.logicalId||rel.toId))continue;const a=app.layout.getLayout(rel.fromId),b=app.layout.getLayout(rel.toId);if(!a||!b)continue;
   const c=app.renderer.computeRelationshipCurve(a,b);include(c.cp1x,c.cp1y);include(c.cp2x,c.cp2y);
   ctx.save();ctx.font='600 11.5px Inter, -apple-system, sans-serif';const w=Math.max(54,ctx.measureText(rel.label||'Relazione').width+18);ctx.restore();include(c.labelX,c.labelY,w,22);
  }
  box.width=box.maxX-box.minX;box.height=box.maxY-box.minY;return box;
 }
 const esc=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 function svgLayers(renderer){
  const {state,layout}=renderer,boundaries=[],summaries=[],relationships=[],markers=[];
  walkVisible(layout.presentationRoot||state.root,node=>{
   const markerLayout=layout.getLayout(node.id),m=markerLayout,g=m?.bracketGeom;
    if(node.isSummary&&g){const {dir,baseX,tipX,minY,maxY,midY}=g,mid=(baseX+tipX)/2,r=Math.min(14,Math.max(4,(maxY-minY)/4));
     summaries.push(`<path d="M ${baseX} ${minY} Q ${mid} ${minY} ${mid} ${minY+r} L ${mid} ${midY-r} Q ${mid} ${midY} ${tipX} ${midY} Q ${mid} ${midY} ${mid} ${midY+r} L ${mid} ${maxY-r} Q ${mid} ${maxY} ${baseX} ${maxY} M ${tipX} ${midY} L ${m.x-dir*m.width/2} ${midY}" fill="none" stroke="${esc(node.color||'#10b981')}" stroke-width="${2.4*(state.strokeScale||1)}" stroke-linecap="round"/>`);
    }
   if(markerLayout)for(const [i,id] of (node.markers||[]).slice(0,3).entries()){
    const x=markerLayout.x+markerLayout.width/2+11+i*19,y=markerLayout.y-markerLayout.height/2+4;
    const symbol=root.NeuroMapMarkers?.symbols[id]||'•',color=/priority|warning/.test(id)?'#fbbf24':id==='done'||id==='check'?'#34d399':'#93c5fd';
    markers.push(`<circle cx="${x}" cy="${y}" r="9" fill="#090f1e"/><text x="${x}" y="${y+.5}" dominant-baseline="middle" text-anchor="middle" font-family="NeuroMapSymbols,Segoe UI Symbol,Apple Symbols,sans-serif" font-size="15" font-weight="700" fill="${color}">${esc(symbol)}</text>`);
   }
   if(node.boundary?.enabled){const b=layout.getSubtreeBoundingBox(node,false);if(b){
    const x=b.minX-16,y=b.minY-14,w=b.width+32,h=b.height+28,color=esc(node.boundary.color||node.color||'#a855f7');
    boundaries.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" fill-opacity=".09" stroke="${color}" stroke-opacity=".78" stroke-width="1.8" stroke-dasharray="7 5"/>`);
    const title=String(node.boundary.title||'').trim().slice(0,110);
    if(title){const ctx=layout.measureCtx;ctx.save();ctx.font='600 13px Inter,system-ui,sans-serif';const measured=ctx.measureText(title).width,tw=Math.min(Math.max(85,measured+24),Math.max(110,w));ctx.restore();
     boundaries.push(`<rect x="${x+14}" y="${y-27}" width="${tw}" height="24" rx="8" fill="#111a31" stroke="${color}"/><text x="${x+26}" y="${y-11}" fill="#eef2ff" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="600" ${measured>tw-22?`textLength="${tw-22}" lengthAdjust="spacingAndGlyphs"`:""}>${esc(title)}</text>`);
    }
   }}

  });
  for(const rel of [...(state.relationships||[]),...(layout.presentationRelations||[])]){const a=layout.getLayout(rel.fromId),b=layout.getLayout(rel.toId);if(!a||!b)continue;
   const c=renderer.computeRelationshipCurve(a,b),color=esc(rel.color||'#f43f5e'),angle=Math.atan2(c.y2-c.cp2y,c.x2-c.cp2x),head=t=>`${c.x2-11*Math.cos(angle+t)},${c.y2-11*Math.sin(angle+t)}`;
   const label=rel.label||'Relazione',ctx=layout.measureCtx;ctx.save();ctx.font='600 11.5px Inter, -apple-system, sans-serif';const w=Math.max(54,ctx.measureText(label).width+18);ctx.restore();
   relationships.push(`<path d="M ${c.x1} ${c.y1} C ${c.cp1x} ${c.cp1y} ${c.cp2x} ${c.cp2y} ${c.x2} ${c.y2}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/><polygon points="${c.x2},${c.y2} ${head(-Math.PI/6)} ${head(Math.PI/6)}" fill="${color}"/><rect x="${c.labelX-w/2}" y="${c.labelY-11}" width="${w}" height="22" rx="11" fill="#0f172a" stroke="${color}"/><text x="${c.labelX}" y="${c.labelY+4}" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="600" font-family="Inter, -apple-system, sans-serif">${esc(label)}</text>`);
  }
  return {boundaries:boundaries.join('\n'),summaries:summaries.join('\n'),relationships:relationships.join('\n'),markers:(markers.length?'<defs><style>'+root.NeuroMapMarkers.fontCSS+'</style></defs>':'')+markers.join('\n')};
 }
 function light(){return document.body.classList.contains('nm615-light')||document.body.classList.contains('nm-android-light');}
 function background(){return getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim()||'#0b0f19';}
 // Offset the centre curve along its normals: vertical offsets produce fins on
 // steep bends. Canvas and SVG use this same outline, with a constant underline.
 const ribbonCache=new WeakMap();
 function ribbonPath(g,node){
  const signature=[g.startX,g.startY,g.cp1x,g.cp1y,g.cp2x,g.cp2y,g.endX,g.endY,g.startWidth,g.endWidth].join('|');
  const cached=node&&ribbonCache.get(node);if(cached?.signature===signature)return cached.path;
  // A nonzero union of round sections keeps tight curves round instead of
  // pinching normal-offset outlines into fins. Filled once, so overlaps have no seams.
  const points=[],pieces=[],f=n=>Number(n).toFixed(3);
  const point=(x,y,t)=>({x,y,r:(g.startWidth*(1-t)+g.endWidth*t)/2});
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const subdivide=(a,b,c,d,t0,t1,depth)=>{
   const dx=d.x-a.x,dy=d.y-a.y,len=Math.hypot(dx,dy)||1;
   const error=Math.max(Math.abs(dx*(b.y-a.y)-dy*(b.x-a.x)),Math.abs(dx*(c.y-a.y)-dy*(c.x-a.x)))/len;
   if(error<=.08||depth>=10){points.push(point(d.x,d.y,t1));return;}
   const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd),t=(t0+t1)/2;
   subdivide(a,ab,abc,m,t0,t,depth+1);subdivide(m,bcd,cd,d,t,t1,depth+1);
  };
  const a={x:g.startX,y:g.startY},b={x:g.cp1x,y:g.cp1y},c={x:g.cp2x,y:g.cp2y},d={x:g.endX,y:g.endY};
  points.push(point(a.x,a.y,0));subdivide(a,b,c,d,0,1,0);
  for(let i=0;i<points.length;i++){
   const p=points[i],r=f(p.r),x=f(p.x),y=f(p.y);
   pieces.push(`M ${f(p.x+p.r)} ${y} A ${r} ${r} 0 1 1 ${f(p.x-p.r)} ${y} A ${r} ${r} 0 1 1 ${f(p.x+p.r)} ${y} Z`);
   if(!i)continue;
   const a=points[i-1],dx=p.x-a.x,dy=p.y-a.y,len=Math.hypot(dx,dy);if(len<1e-6)continue;
   const nx=-dy/len,ny=dx/len;
   pieces.push(`M ${f(a.x+nx*a.r)} ${f(a.y+ny*a.r)} L ${f(a.x-nx*a.r)} ${f(a.y-ny*a.r)} L ${f(p.x-nx*p.r)} ${f(p.y-ny*p.r)} L ${f(p.x+nx*p.r)} ${f(p.y+ny*p.r)} Z`);
  }
  const path=pieces.join(' ');
  if(node)ribbonCache.set(node,{signature,path});
  return path;
 }
 function ribbonShape(g,node){
  const path=ribbonPath(g,node),entry=ribbonCache.get(node);
  return entry.shape||(entry.shape=new Path2D(path));
 }
 function separateSubtrees(layout,root){
  const images=new Map();
  for(const image of layout._nmImages||[])if(image.mode==='attached'){
   const list=images.get(image.attachedNodeId)||[];list.push(image);images.set(image.attachedNodeId,list);
  }
  const occupied=(node,m,dir)=>Math.max(m.width/2+(dir>0?Math.min(3,node.markers?.length||0)*19+2:0),...(images.get(node.logicalId||node.id)||[]).map(im=>im.width/2+dir*(Number(im.offset?.dx)||0)));
  const shift=(node,dx,dy)=>walkVisible(node,current=>{
   const m=layout.getLayout(current.id);if(!m)return;
   m.x+=dx;m.y+=dy;
   for(const key of ['attachInX','attachOutX'])if(Number.isFinite(m[key]))m[key]+=dx;
   for(const key of ['attachInY','attachOutY'])if(Number.isFinite(m[key]))m[key]+=dy;
   if(m.bracketGeom){for(const key of ['baseX','tipX'])m.bracketGeom[key]+=dx;for(const key of ['minY','maxY','midY'])m.bracketGeom[key]+=dy;}
  });
  const boxes=new WeakMap(),pending=[...(root.children||[]).filter(n=>n.isFloating).reverse().map(node=>({node,phase:0})),{node:root,phase:0}],seen=new WeakSet();
  const include=(box,b)=>{if(!b)return;for(const key of ['minX','minY'])box[key]=Math.min(box[key],b[key]);for(const key of ['maxX','maxY'])box[key]=Math.max(box[key],b[key]);};
  while(pending.length){
   const frame=pending.pop(),{node}=frame,m=layout.getLayout(node.id);if(!m)continue;
   if(frame.phase===0){
    if(seen.has(node))continue;seen.add(node);
    const box={minX:m.x-m.width/2,maxX:m.x+m.width/2,minY:m.y-m.height/2,maxY:m.y+m.height/2};
    if(node.markers?.length){box.maxX+=20+19*(Math.min(3,node.markers.length)-1);box.minY-=5;}
    for(const im of images.get(node.logicalId||node.id)||[]){
     const x=m.x+(Number(im.offset?.dx)||0),y=m.y+(Number(im.offset?.dy??-84)||0);
     include(box,{minX:x-im.width/2,maxX:x+im.width/2,minY:y-im.height/2,maxY:y+im.height/2});
    }
    const children=node.collapsed?[]:(node.children||[]).filter(n=>!n.isFloating&&!n.isSummary);
    pending.push({node,box,children,phase:1});
    for(let i=children.length-1;i>=0;i--)pending.push({node:children[i],phase:0});
   }else if(frame.phase===1){
    const {box,children}=frame;
    const groups=node===root?[children.filter(n=>n.side!=='left'),children.filter(n=>n.side==='left').reverse()]:[children];
    if(node===root&&root.layoutMode==='columns')groups[1].reverse();
    for(const group of groups){let bottom=-Infinity;
     for(const child of group){const b=boxes.get(child),c=layout.getLayout(child.id);if(!b||!c)continue;
      const dir=child.side==='left'?-1:1,forward=dir*(c.x-m.x)-occupied(node,m,dir)-occupied(child,c,-dir);
      const dx=dir*Math.max(0,20-forward),dy=Math.max(0,bottom+Math.max(12,layout.verticalGap||0)-b.minY);
      if(dx||dy){shift(child,dx,dy);b.minX+=dx;b.maxX+=dx;b.minY+=dy;b.maxY+=dy;}
      bottom=b.maxY;include(box,b);
     }
    }
    const summaries=node.collapsed?[]:(node.children||[]).filter(n=>n.isSummary);
    pending.push({node,box,summaries,index:0,phase:2});
   }else{
    const {box,summaries,index}=frame;
    if(frame.completed)include(box,boxes.get(frame.completed));
    if(index<summaries.length){
     const child=summaries[index],summary=layout.getLayout(child.id),target=layout.getTargetNodesSubtreeBounds(node,child.summaryTargetIds||[]);
     if(summary&&target){
      const dir=child.side==='left'?-1:1,baseX=dir===1?target.maxX+10:target.minX-10,tipX=baseX+dir*24,midY=(target.minY+target.maxY)/2;
      shift(child,tipX+dir*(18+summary.width/2)-summary.x,midY-summary.y);
      summary.bracketGeom={dir,baseX,tipX,minY:target.minY+4,maxY:target.maxY-4,midY};
     }
     // Finish one summary before moving to the next, preserving bracket order.
     pending.push({...frame,index:index+1,completed:child});pending.push({node:child,phase:0});
    }else{
     if(node.boundary?.enabled){box.minX-=16;box.maxX+=16;box.minY-=node.boundary.title?41:14;box.maxY+=14;}
     boxes.set(node,box);
    }
   }
  }

 }

 // Cache only intrinsic label metrics, before image/continuation decorators.
 // One entry per live node; typography edits and completed font loads invalidate it.
 let fontEpoch=0;
 if(typeof document!=='undefined'&&document.fonts){document.fonts.ready?.then(()=>fontEpoch++);document.fonts.addEventListener?.('loadingdone',()=>fontEpoch++);}
