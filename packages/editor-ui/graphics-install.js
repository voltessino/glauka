 function installMeasurements(Layout){
  if(!Layout||Object.hasOwn(Layout.prototype,'_nmCachedMeasurements'))return;
  Layout.prototype._nmCachedMeasurements=true;
  const measure=Layout.prototype.measureNode;
  Layout.prototype.measureNode=function(node,depth=0){
   const measuredText=this.editingLabel?.id===node.id?this.editingLabel.text:node.text;
   const type=this.getNodeTypography(node,depth),signature=JSON.stringify([fontEpoch,measuredText,type.fontSize,type.fontWeight,!!node.fontItalic,node.fontFamily||null,node.side==='root',depth===1,node.labelWrapChars||this.defaultLabelWrapChars,node.labelIndent||0,!!node.illustration?.svg,node.objectArt?.id||null,Number(node.objectArt?.size)||null]);
   const cache=this._nmMeasurements||(this._nmMeasurements=new WeakMap()),old=cache.get(node),stats=this._nmMeasureStats||(this._nmMeasureStats={hits:0,misses:0});
   if(old?.signature===signature){stats.hits++;return {...old.size,lines:old.size.lines.slice()};}
   stats.misses++;const size=measure.call(this,node,depth);cache.set(node,{signature,size:{...size,lines:size.lines.slice()}});return size;
  };
 }
 // Reuse immutable intrinsic sizes on a deep copy, never the live nodes or geometry.
 // measureNode still validates the full signature (draft, depth, fonts and wrapping).
 function copyMeasurements(layout,sourceRoot,copyRoot){
  if(!layout?._nmMeasurements||!sourceRoot||!copyRoot)return;
  const cache=new WeakMap(),seen=new WeakSet(),pending=[[sourceRoot,copyRoot]];let copied=0;
  while(pending.length){
   const [source,copy]=pending.pop();
   if(!source||!copy||typeof copy!=='object'||seen.has(copy)||source.id!==copy.id)continue;
   seen.add(copy);const entry=layout._nmMeasurements.get(source);
   if(entry){cache.set(copy,entry);copied++;}
   const from=source.children||[],to=copy.children||[];
   for(let i=Math.min(from.length,to.length)-1;i>=0;i--)pending.push([from[i],to[i]]);
  }
  return copied?cache:undefined;
 }
 function install(App,Renderer,Layout){
  installMeasurements(Layout);
  root.NeuroMapGentleMotion?.install(App,Renderer);
  const bind=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=bind.apply(this,args),slider=document.getElementById('nm63-stroke-range');let gesture=false;
   slider?.addEventListener('input',()=>{const value=Math.max(.5,Math.min(3,Number(slider.value)||1));if(value===this.state.strokeScale)return;if(!gesture){this.state.pushHistory();gesture=true;}this.state.strokeScale=value;this.markChanged();});
   for(const event of ['change','blur','pointercancel'])slider?.addEventListener(event,()=>gesture=false);
   return result;
  };
  if(Renderer){
   const prepareExport=Renderer.prototype.prepareExportImages;
   if(prepareExport)Renderer.prototype.prepareExportImages=async function(...args){await document.fonts?.ready;return prepareExport.apply(this,args);};
   const geometry=Renderer.prototype.computeBranchGeometry;
   Renderer.prototype.computeBranchGeometry=function(parent,child,...args){
    const g=geometry.call(this,parent,child,...args);if(!g)return g;
    const span=Math.abs(g.endX-g.startX),dir=g.dir;
    // Keep controls ordered even at the minimum horizontal gap.
    g.cp1x=g.startX+dir*span*.42;g.cp2x=g.endX-dir*span*.42;
    if(!['simple','xmind8'].includes(this.state.branchStyle)){
     const factor=this.state.branchStyle==='buzan'?1.5:this.state.branchStyle==='thickparents'?1.25:1;
     const scale=this.state.strokeScale||1;
     g.endWidth=Math.max(1.1,Math.min(Math.max(2,5.5-(g.cLayout.depth||1)*.9)*factor*scale,9*Math.sqrt(scale)));
     if(parent.side==='root')g.startWidth=Math.max(1.2,Math.min(g.startWidth,g.pLayout.height*.8,26*Math.sqrt(scale)/(1+.12*Math.max(0,(Number(args[1])||1)-1))));
     else g.startWidth=Math.max(1.1,Math.min(Math.max(2,5.5-(g.pLayout.depth||1)*.9)*factor*scale,9*Math.sqrt(scale)));
    }
    return g;
   };
   const original=Renderer.prototype.render;
   Renderer.prototype.render=function(ctx,transform){
    if(!ctx)return original.call(this,ctx,transform);
    const stateKeys=['selectedNodeId','selectedNodeIds','selectedImageId','selectedRelationshipId','hoveredNodeId','hoveredImageId','hoveredRelationshipId','hoveredBadgeNodeId'],rendererKeys=['dragHoverNodeId','snapTargetNodeId','relationshipDraft','pulse','hoveredBoundaryId'];
    const saved=stateKeys.map(k=>this.state[k]),savedRenderer=rendererKeys.map(k=>this[k]),previous=this.ctx;
    stateKeys.forEach(k=>this.state[k]=k==='selectedNodeIds'?[]:null);rendererKeys.forEach(k=>this[k]=null);
    try{return original.call(this,ctx,transform);}finally{stateKeys.forEach((k,i)=>this.state[k]=saved[i]);rendererKeys.forEach((k,i)=>this[k]=savedRenderer[i]);this.ctx=previous;}
   };
   // Membership is stable for a synchronous frame, not between frames or renderers.
   const frameRender=Renderer.prototype.render;
   Renderer.prototype.render=function(...args){
    const previous=this._nmSelectedFrame,ids=this.state.selectedNodeIds;
    this._nmSelectedFrame=!args[0]&&Array.isArray(ids)&&ids.length>8?
      {renderer:this,ids,set:new Set(ids)}:null;
    try{return frameRender.apply(this,args);}finally{this._nmSelectedFrame=previous;}
   };
  }
  const p=App.prototype,closeTab=p.closeTab;
  if(closeTab)p.closeTab=function(...args){
   const tab=this.tabs.find(t=>t.id===(args[0]??this.activeTabId)),state=tab?.state;
   const finish=value=>{
    if(!state||this.tabs.includes(tab)||this.state===state)return value;
    const candidates=Array.isArray(state.images)?state.images.map(image=>image?.src).filter(src=>typeof src==='string'):[];
    if(!candidates.length)return value;
    const requested=new Set(candidates),retained=new Set();
    const keep=images=>{if(Array.isArray(images))for(const image of images)if(image&&requested.has(image.src))retained.add(image.src);};
    const hold=state=>{
     keep(state?.images);
     for(const stack of [state?.undoStack,state?.redoStack])if(Array.isArray(stack))
      for(const snapshot of stack)keep(snapshot?.images);
    };
    for(const tab of this.tabs)hold(tab.state);hold(this.state);
    this.renderer.releaseClosedRasterImages?.(candidates,retained);
    return value;
   };
   const result=closeTab.apply(this,args);
   return result?.then?result.then(finish):finish(result);
  };
  p.fitToScreen=function(){return fit(this,bounds(this));};p.fitWholeMap=p.fitToScreen;
  p.nmGraphicsFitSubtree=function(id){const node=this.state.findNode(id);if(!node)return false;let n=node,changed=false;
   while(n.parentId){n=this.state.findNode(n.parentId);if(!n)break;if(n.collapsed){if(!changed)this.state.pushHistory();n.collapsed=false;changed=true;}}
   if(changed)this.recalculateAndRender();this.selectNode(id);return fit(this,bounds(this,id),1.7);
  };
 }
