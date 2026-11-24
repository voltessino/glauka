 function clear(app){if(app._nmDragFrame)cancelAnimationFrame(app._nmDragFrame);app._nmDragFrame=0;clearTimeout(app._nmDragDwellTimer);app._nmDragDwellKey=null;
  app._nmDragPreview?.canvas.remove();app._nmDragPreview=null;app._nmDragCache=null;
  app._nmDragStatus?.remove();app._nmDragStatus=null;app._nmDragInvalid?.remove();app._nmDragInvalid=null;app._v5Ghost?.remove();app._v5Ring?.remove();app._v5Ghost=null;app._v5Ring=null;
  const old=document.getElementById('nm612-drop-indicator');if(old)old.style.display='none';
 }
 function markInvalid(app,x,y){clear(app);if(typeof document==='undefined'||!document.body?.append)return;
  const en=document.documentElement?.lang==='en',el=document.createElement('div');
  el.id='nm-drag-invalid';el.className='nm6-skiptranslate';el.setAttribute('role','status');el.dataset.drop='invalid';
  el.textContent=en?'This move is not available':'Spostamento non disponibile';
  const color=globalThis.NeuroMapCanvasPremium?.colors?.().dropInvalid||'#ad2039';
  el.style.cssText='position:fixed;pointer-events:none;z-index:44;max-width:240px;padding:6px 9px;border-radius:8px;border:1px solid '+color+';background:rgba(20,16,24,.92);color:#f8e8ea;font:600 12px/1.35 system-ui;';
  const width=globalThis.innerWidth||800,height=globalThis.innerHeight||600;
  el.style.left=Math.max(8,Math.min(width-248,x+14))+'px';el.style.top=Math.max(8,Math.min(height-48,y+16))+'px';
  document.body.append(el);app._nmDragInvalid=el;
 }
 function label(app,intent){
  const en=document.documentElement.lang==='en',name=intent.targetId&&app.state.findNode(intent.targetId)?.text;
  if(intent.kind==='child')return ((globalThis.GlaukaI18n?.pair("Sotto-ramo di ","Child of ")??(en?'Child of ':'Sotto-ramo di ')))+name;
  if(intent.kind==='place')return intent.parentId===app.state.root.id?((globalThis.GlaukaI18n?.pair("Sposta a ","Move to ")??(en?'Move to ':'Sposta a ')))+(intent.side==='left'?(en?'left':'sinistra'):(en?'right':'destra')):((globalThis.GlaukaI18n?.pair("Riordina tra i rami dello stesso livello","Reorder among siblings")??(en?'Reorder among siblings':'Riordina tra i rami dello stesso livello')));
  if(intent.kind==='reorder'){
   const target=app.state.findNode(intent.targetId),reversed=(app.layout.presentationRoot||target?.parentId===app.state.root.id)&&(intent.side||target?.side)==='left'&&app.state.branchStyle!=='radial';
   return (en?(intent.after!==reversed?'Insert after ':'Insert before '):(intent.after!==reversed?'Inserisci sotto ':'Inserisci sopra '))+name;
  }
  return (globalThis.GlaukaI18n?.pair("Ramo indipendente","Independent branch")??(en?'Independent branch':'Ramo indipendente'));
 }
 function preview(app,d,x,y){
  const nodeIds=d.nodeIds||[d.nodeId],intent=d.dropIntent||resolve(app,d.nodeId,x,y,{nodeIds});if(!intent||!validKinds.has(intent.kind)){markInvalid(app,x,y);return;}
  app._nmDragInvalid?.remove();app._nmDragInvalid=null;
  const tone=globalThis.NeuroMapCanvasPremium?.colors?.()||null,validTone=tone?.dropValid||'#5eead4',hintTone=tone?.dropValid||'rgba(125,211,252,.85)';
  const world=app.renderer.screenToWorld(x,y);
  const followsPointer=intent.kind==='detach'||nodeIds.length>1&&intent.kind==='place'&&intent.parentId===app.state.root.id;
  const key=[nodeIds.join(','),intent.kind,intent.targetId,intent.after,intent.side,intent.parentId,intent.beforeId,intent.afterId,app._nmDragRevision,followsPointer?world.x:0,followsPointer?world.y:0].join('|');
  let p=app._nmDragPreview;
  if(app._nmDragCache!==key||!p){
   const state=Object.assign(Object.create(Object.getPrototypeOf(app.state)),app.state,{root:app.state.constructor.cloneTree(app.state.root)});
   const measurements=root.NeuroMapGraphics?.copyMeasurements?.(app.layout,app.state.root,state.root);
   if(!applyGroup(app,state,nodeIds,intent,world,false,d.nodeId)){clear(app);return;}
   for(const key of ['selectedNodeId','selectedImageId','selectedRelationshipId','hoveredNodeId','hoveredImageId','hoveredRelationshipId','hoveredBadgeNodeId'])state[key]=null;state.selectedNodeIds=[];
   const layout=new app.layout.constructor();for(const [key,value] of Object.entries(app.layout))if(['string','number','boolean'].includes(typeof value))layout[key]=value;
   if(measurements)layout._nmMeasurements=measurements;
   layout._nmImages=state.images;layout.computeLayout(state.root,state.thresholdY);
   const canvas=p?.canvas||document.createElement('canvas');canvas.id='nm-drag-preview';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:38;width:100%;height:100%;';
   if(!canvas.isConnected)document.body.append(canvas);
   p={canvas,state,layout,nodeId:d.nodeId,nodeIds,intent:{...intent},parentId:state.findNode(d.nodeId).parentId};app._nmDragPreview=p;app._nmDragCache=key;
  }
  const {canvas,state,layout}=p,dpr=app.renderer.dpr||1;
  if(canvas.width!==Math.round(innerWidth*dpr)||canvas.height!==Math.round(innerHeight*dpr)){canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
  canvas.dataset.sourceIds=JSON.stringify(nodeIds);canvas.dataset.count=String(nodeIds.length);canvas.dataset.intent=intent.kind;canvas.dataset.drop='valid';canvas.dataset.sourceId=d.nodeId;canvas.dataset.targetId=intent.targetId||'';canvas.dataset.parentId=p.parentId;
  const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(dpr,dpr);ctx.translate(app.renderer.camera.x,app.renderer.camera.y);ctx.scale(app.renderer.camera.zoom,app.renderer.camera.zoom);ctx.globalAlpha=.28;
  // A reorder placeholder sits in the visible insertion gap. The committed
  // layout remains separately available: existing topics reflow only at drop.
  let displayLayout=layout;
  if(nodeIds.length===1&&(intent.kind==='reorder'||intent.kind==='place'&&state.findNode(d.nodeId).parentId!==state.root.id)&&intent.targetId&&!layout.presentationRoot){
   const target=app.layout.getLayout(intent.targetId),m=layout.getLayout(d.nodeId),targetPoint=app.renderer.worldToScreen(target.x,target.y),above=y<targetPoint.y,z=app.renderer.camera.zoom;
   const desired=target.y+(above?-1:1)*(target.height/2+m.height/2+8/z),dy=desired-m.y,ids=subtree(state.findNode(d.nodeId));
   displayLayout=Object.assign(Object.create(Object.getPrototypeOf(layout)),layout,{nodeLayoutMap:new Map(layout.nodeLayoutMap)});
   for(const id of ids){const m=layout.getLayout(id);if(!m)continue;const shifted={...m,y:m.y+dy,attachInY:m.attachInY+dy,attachOutY:m.attachOutY+dy};
    if(m.bracketGeom)shifted.bracketGeom={...m.bracketGeom,minY:m.bracketGeom.minY+dy,maxY:m.bracketGeom.maxY+dy,midY:m.bracketGeom.midY+dy};displayLayout.nodeLayoutMap.set(id,shifted);
   }
  }
  p.displayLayout=displayLayout;
  const renderer=Object.assign(Object.create(app.renderer),{canvas,ctx,layout:displayLayout,state,camera:{...app.renderer.camera},pulse:null,dragHoverNodeId:null,snapTargetNodeId:null,relationshipDraft:null});
  renderer.getOrLoadImage=src=>app.renderer.getOrLoadImage(src);
  const roots=nodeIds.map(id=>state.findNode(id)),ids=excludedFor(state,nodeIds);
  state.images=app.state.images.filter(i=>i.mode==='attached'&&ids.has(i.attachedNodeId));
  renderer.drawImagesLayer('back');
  for(const source of roots){const parent=state.findNode(source.parentId);
   if(layout.presentationRoot){
    const views=[...layout.viewNodes.values()].filter(n=>(n.logicalId||n.id)===source.id);
    for(const view of views){const parentView=layout.viewNodes.get(view.parentId);renderer.drawBoundariesRecursive(view);if(parentView)renderer.drawTaperingBranch(parentView,view,0,1);renderer.drawSummariesRecursive(view);renderer.drawNode(view);}
   }else{
    renderer.drawBoundariesRecursive(source);
    if(!source.isFloating){const siblings=parent.children.filter(n=>!n.isSummary&&!n.isFloating&&(parent===state.root?n.side===source.side:true)),index=siblings.indexOf(source),visual=parent===state.root&&source.side==='left'?siblings.length-1-index:index;
     renderer.drawTaperingBranch(parent,source,visual,siblings.length);
    }else if(!source.collapsed){const children=source.children.filter(n=>!n.isSummary);children.forEach((n,i)=>renderer.drawTaperingBranch(source,n,i,children.length));}
    renderer.drawSummariesRecursive(source);renderer.drawNode(source);
    const future=layout.getLayout(parent.id),current=app.layout.getLayout(parent.id);
    if(future&&current&&Math.hypot(future.x-current.x,future.y-current.y)>1){ctx.save();ctx.globalAlpha=.12;renderer.drawNode({...parent,children:[]});ctx.restore();}
   }
  }
  renderer.drawImagesLayer('front');
  ctx.restore();
  let snapDistance=0;
  if(intent.kind==='place'){
   // Mark where the projected node will ACTUALLY land, not the pointer. Long
   // branches and collision avoidance may require snapping to free space.
   let metric=layout.getLayout(d.nodeId);
   if(!metric&&layout.viewNodes){
    const alias=[...layout.viewNodes.values()].find(n=>(n.logicalId||n.id)===d.nodeId);
    if(alias)metric=layout.getLayout(alias.id);
   }
   const marker=metric?app.renderer.worldToScreen(metric.x,metric.y):app.renderer.worldToScreen(world.x,world.y);
   snapDistance=Math.hypot(marker.x-x,marker.y-y);
   ctx.save();ctx.scale(dpr,dpr);ctx.strokeStyle=validTone;ctx.fillStyle=validTone;ctx.lineWidth=1.75;
   if(snapDistance>30){
    ctx.globalAlpha=.7;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(marker.x,marker.y);ctx.stroke();ctx.globalAlpha=1;
   }
   ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(marker.x-40,marker.y);ctx.lineTo(marker.x+40,marker.y);ctx.stroke();ctx.setLineDash([]);
   if(intent.parentId===app.state.root.id&&(intent.side==='left'||intent.side==='right')){const dir=intent.side==='left'?-1:1;ctx.beginPath();ctx.moveTo(marker.x+dir*22,marker.y-16);ctx.lineTo(marker.x+dir*22,marker.y+16);ctx.stroke();}
   ctx.beginPath();ctx.arc(marker.x,marker.y,4,0,2*Math.PI);ctx.fill();ctx.restore();
  }
  if(intent.targetId&&intent.kind!=='place'){const m=app.layout.getLayout(intent.viewId||intent.targetId),pt=m&&app.renderer.worldToScreen(m.x,m.y),z=app.renderer.camera.zoom;if(pt){
   ctx.save();ctx.scale(dpr,dpr);ctx.strokeStyle=hintTone;ctx.lineWidth=1.75;ctx.setLineDash([5,4]);ctx.beginPath();
   if(intent.kind==='child')ctx.rect(pt.x-m.width*z/2-3,pt.y-m.height*z/2-3,m.width*z+6,m.height*z+6);
   else {const above=y<pt.y,lineY=pt.y+(above?-1:1)*(m.height*z/2+4);ctx.moveTo(pt.x-m.width*z/2-8,lineY);ctx.lineTo(pt.x+m.width*z/2+8,lineY);}ctx.stroke();
   if(intent.kind==='child'){const ix=pt.x+m.width*z/2+10,iy=pt.y;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(ix-4,iy);ctx.lineTo(ix+4,iy);ctx.moveTo(ix,iy-4);ctx.lineTo(ix,iy+4);ctx.stroke();}
   ctx.restore();
  }}
  if(!app._nmDragStatus){const status=document.createElement('div');status.id='nm-drag-status';status.className='nm6-skiptranslate';status.setAttribute('role','status');status.style.cssText='position:fixed;pointer-events:none;z-index:44;max-width:240px;padding:6px 9px;border:1px solid #58768f;border-radius:8px;background:linear-gradient(145deg,#102940f2,#132c42ef);color:#e0f4ff;font:600 12px/1.35 system-ui;box-shadow:0 12px 30px #0006;backdrop-filter:blur(12px);';document.body.append(status);app._nmDragStatus=status;}
  const en=document.documentElement.lang==='en';
  app._nmDragStatus.textContent=(nodeIds.length>1?nodeIds.length+(en?' branches · ':' rami · '):'')+label(app,intent)+(snapDistance>60?((globalThis.GlaukaI18n?.pair(" · Adatta allo spazio libero"," · Snaps to free space")??(en?' · Snaps to free space':' · Adatta allo spazio libero'))):'');app._nmDragStatus.style.left=Math.max(8,Math.min(innerWidth-255,x+14))+'px';app._nmDragStatus.style.top=Math.max(8,Math.min(innerHeight-70,y+16))+'px';
 }
 function install(App){const p=App.prototype,recalculate=p.recalculateAndRender;
  p.recalculateAndRender=function(...args){if(this._v5Candidate&&(this._v5Candidate.state!==this.state||this._v5Candidate.root&&this._v5Candidate.root!==this.state.root))this.nmCancelDrag();this._nmDragRevision=(this._nmDragRevision||0)+1;return recalculate.apply(this,args);};
  p.nm612ResolveDrop=function(id,x,y,modifiers){return resolve(this,id,x,y,modifiers||{});};p.nm612DropIndicator=function(){};
  p.v5DragVisual=function(d,x,y){
   d._nmLastPoint={x,y};const key=d.hoverId?d.nodeId+':'+d.hoverId+':'+d.hoverSince:null;
   if(this._nmDragDwellKey!==key){clearTimeout(this._nmDragDwellTimer);this._nmDragDwellKey=key;
    if(key)this._nmDragDwellTimer=setTimeout(()=>{
     if(this._v5Candidate!==d||d.state!==this.state||d.tabId!==this.activeTabId||!d.moving)return;
     const point=d._nmLastPoint;d.dropIntent=resolve(this,d.nodeId,point.x,point.y,{childIntent:true,nodeIds:d.nodeIds});d.targetId=d.dropIntent?.targetId||null;preview(this,d,point.x,point.y);
    },Math.max(0,610-(Date.now()-d.hoverSince)));
   }
   if(d.nodeIds?.length>1){
    // Coalesce group projections per frame; always draw the latest pointer.
    if(!this._nmDragFrame)this._nmDragFrame=requestAnimationFrame(()=>{
     this._nmDragFrame=0;if(this._v5Candidate!==d||d.state!==this.state)return;
     const point=d._nmLastPoint;preview(this,d,point.x,point.y);
    });
   }else preview(this,d,x,y);
  };p.v5DragVisualClear=function(){clear(this);};
  p.nmDragCommit=function(id,intent,x,y,nodeIds=[id]){if(!applyGroup(this,this.state,nodeIds,intent,this.renderer.screenToWorld(x,y),true,id))return false;this.markChanged();return true;};
  p.nmCancelDrag=function(){const d=this._v5Candidate;this._v5Candidate=null;clear(this);if(d&&this.canvas.hasPointerCapture(d.pointerId))this.canvas.releasePointerCapture(d.pointerId);this.canvas.style.cursor='grab';};
  const bind=p.bindUI;p.bindUI=function(...args){const result=bind.apply(this,args);window.addEventListener('blur',()=>this.nmCancelDrag());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.nmCancelDrag();});this.canvas.addEventListener('lostpointercapture',e=>{if(this._v5Candidate?.pointerId===e.pointerId)this.nmCancelDrag();});return result;};
 }
