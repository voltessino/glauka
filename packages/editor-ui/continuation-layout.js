/* Desktop presentation layout. Logical IDs and the saved tree never contain view copies. */
(function(root){'use strict';
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 // Legacy files always use a single centre without rewriting saved layout metadata.
 const settings=node=>({...root.NeuroMapCore.continuationSettings({...node?.layoutDistribution,overflowMode:'expand'}),initialOrder:false});
 // Visual forecast is derived from the existing projection; never stored in files.
 function forecastSummary(plan,config,adaptive,prediction){
  const pages=Array.isArray(plan?.pages)?plan.pages:[];
  const configured=Math.max(0,Number(config?.height)||0);
  const effective=Math.max(configured,Number(adaptive?.effective)||0);
  const summarize=side=>{
   const sidePages=pages.filter(p=>p.side===side);
   const largest=sidePages.reduce((m,p)=>Math.max(m,Number(p.height)||0),0);
   const capacity=sidePages.reduce((m,p)=>Math.max(m,Number(p.capacity)||effective),effective>0&&sidePages.length===0?effective:0);
   return {pages:sidePages.length,nodes:sidePages.reduce((n,p)=>n+(p.units?.length||0),0),
    occupied:Math.round(largest),capacity:Math.round(capacity),
    percent:capacity>0?Math.min(100,Math.round(largest/capacity*100)):0};
  };
  return {right:summarize('right'),left:summarize('left'),
   configured,effective,sectors:pages.length,blocked:!!adaptive?.blocked||!!plan?.blocked,
   next:prediction&&typeof prediction==='object'?
    {side:prediction.side||null,sector:prediction.sector??null,blocked:!!prediction.blocked}:null};
 }
 function updateForecast(app,prediction){
  const host=document.getElementById('nm620-layout-forecast');
  if(!host)return;
  const config=settings(app.state.root),data=forecastSummary(app.layout.continuationPlan,config,app.layout.adaptiveLimit,prediction);
  const summary=document.getElementById('nm620-forecast-summary');
  const right=document.getElementById('nm620-forecast-right');
  const left=document.getElementById('nm620-forecast-left');
  const rightBar=document.getElementById('nm620-forecast-right-bar');
  const leftBar=document.getElementById('nm620-forecast-left-bar');
  const next=document.getElementById('nm620-forecast-next');
  if(!right||!left||!next||!summary)return;
  host.hidden=!config.enabled||app.state.branchStyle==='radial';
  host.style.display=host.hidden?'none':'grid';
  if(host.hidden)return;
  summary.textContent=tr('Un solo centro · rami sui due lati','One centre · branches on both sides');
  const label=(side,info)=>side+' · '+tr('spazio occupato','space used')+' '+info.percent+'%';
  right.textContent=label(tr('Destra','Right'),data.right);
  left.textContent=label(tr('Sinistra','Left'),data.left);
  if(rightBar)rightBar.style.width=data.right.percent+'%';
  if(leftBar)leftBar.style.width=data.left.percent+'%';
  if(data.blocked)next.textContent=tr('Limite tecnico raggiunto: non aggiungere rami senza ridurre la mappa.',
    'Technical limit reached: compact the map before adding more branches.');
  else if(data.next){
   const parent=app.state.findNode?.(app.state.selectedNodeId)||app.state.root;
   const name=String(parent?.text||tr('Nodo centrale','Central node')).slice(0,60);
   next.textContent=data.next.blocked?tr('Non c’è spazio per il nuovo sottoramo. Riduci le distanze o redistribuisci i rami.','No room for a new sub-branch. Reduce spacing or redistribute branches.'):
    tr('Sottoramo di «','Sub-branch of “')+name+tr('»: ','”: ')+(data.next.side==='right'?tr('a destra','on the right'):data.next.side==='left'?tr('a sinistra','on the left'):tr('non calcolabile','unavailable'));
  }else next.textContent=tr('Seleziona un nodo e premi «Calcola il lato»: non verrà inserito alcun ramo.','Select a node and choose “Calculate side”: no branch will be added.');

 }
 function install(App,Layout,Renderer){
  const compute=Layout.prototype.computeLayout;
  Layout.prototype.computeLayout=function(logical,...args){
   this.logicalRoot=logical;this.presentationRoot=null;this.continuationPlan=null;this.viewNodes=new Map();this.presentationRelations=[];this.continuationGroups=[];this.adaptiveLimit=null;this.predictContinuation=null;
   const config=settings(logical);
   if(!logical||!config.enabled||this.branchStyle==='radial'){this.classicDistribution=compute.call(this,logical,...args);return this.classicDistribution;}
   // Measure actual labels/images at their logical depth before planning page boundaries.
   // The classic measure pass can assign visual sides; an adaptive map keeps its source sides.
   const originalSides=config.overflowMode==='expand'?new Map():null;
   if(originalSides){const stack=[logical];while(stack.length){const n=stack.pop();originalSides.set(n.id,n.side);for(const c of n.children||[])stack.push(c);}}
   compute.call(this,logical,...args);
   if(originalSides){const stack=[logical];while(stack.length){const n=stack.pop();n.side=originalSides.get(n.id);for(const c of n.children||[])stack.push(c);}}
   const logicalNodes=new Map(),depths=new Map(),sizes=new Map();
   const index=(n,depth)=>{
    const pending=[{node:n,depth}];
    while(pending.length){
     const frame=pending.pop(),current=frame.node;
     logicalNodes.set(current.id,current);depths.set(current.id,frame.depth);
     if(!current.collapsed)for(let i=(current.children?.length||0)-1;i>=0;i--)
      pending.push({node:current.children[i],depth:frame.depth+1});
    }
   };index(logical,0);
   // A map with thousands of images must not rescan ALL attachments for every
   // node on each slider tick (the former O(nodes * images) hot path).
   const attachedImages=new Map();
   for(const image of this._nmImages||[]){
     // Creative shapes, drawings, charts and WordArt are overlays, not
     // structural children. Their attachment must NEVER repaginate the map.
     // They still follow their anchor and extend the viewport bounding box.
     if(image.graphic||image.mode!=='attached'||!image.attachedNodeId)continue;
     let list=attachedImages.get(image.attachedNodeId);
     if(!list)attachedImages.set(image.attachedNodeId,list=[]);
     list.push(image);
   }
   const measure=n=>{
    if(sizes.has(n.id))return sizes.get(n.id);
    const m=this.nodeLayoutMap.get(n.id)||this.measureNode(n,depths.get(n.id)||1);let top=m.height/2,bottom=top;
    for(const image of attachedImages.get(n.id)||[]){const dy=Number(image.offset?.dy??-84)||0,h=Number(image.height)||100;top=Math.max(top,h/2-dy);bottom=Math.max(bottom,h/2+dy);}const box={height:m.height,top,bottom};sizes.set(n.id,box);return box;
   };
   const planner=config.overflowMode==='expand'?root.NeuroMapCore.planAdaptiveContinuation:root.NeuroMapCore.planContinuation;
   const baseParams={...config,bias:this.balanceBias??this._nmBias??50,gap:this.verticalGap,primaryGap:this.primaryGroupGap};
   const plan=planner(logical,measure,baseParams);
   this.adaptiveLimit={enabled:config.overflowMode==='expand',blocked:!!plan.blocked,
     configured:config.height,effective:plan.effectiveHeight||config.height,
     maximum:root.NeuroMapCore.ADAPTIVE_LIMIT_MAX};
   // IMPORTANT: layout computation is a pure projection. Never persist the
   // computed height here: that made low->high->low irreversible and bypassed
   // undo/history. configuredHeight remains the user's saved preference;
   // effectiveHeight is derived from the latest logical tree and dimensions.
   this._continuationPrediction=new Map();
   this.predictContinuation=parentId=>{
    const formatter=root.NeuroMapCreativeModules?.formatting,saved=formatter?.load?.()||{};
    const nodeStyle=Object.assign({},...(formatter?.specs||[]).filter(spec=>spec.kind==='node').map(spec=>saved[spec.id]||{}));
    const cacheKey=parentId+'|'+JSON.stringify(nodeStyle);
    if(this._continuationPrediction.has(cacheKey))return this._continuationPrediction.get(cacheKey);
    const probe={...nodeStyle,id:'nm-probe-new-child',text:'Nuovo Nodo',side:'right',children:[]};while(logicalNodes.has(probe.id))probe.id+='_';sizes.delete(probe.id);depths.set(probe.id,(depths.get(parentId)||0)+1);
    // Clone ONLY the insertion path. The previous recursive whole-tree clone
    // could overflow the JS stack and perform a full-map copy on every hint.
    const owners=new Map([[logical.id,null]]);
    const byId=new Map([[logical.id,logical]]);
    const stack=[logical];
    while(stack.length && !byId.has(parentId)){
      const n=stack.pop();
      for(const child of n.children||[]){
        if(!child||byId.has(child.id))continue;
        byId.set(child.id,child);owners.set(child.id,n.id);stack.push(child);
      }
    }
    if(!byId.has(parentId))return {blocked:true,side:null,sector:null};
    let changed={...byId.get(parentId),collapsed:false,
      children:[...(byId.get(parentId).children||[]),probe]};
    for(let id=owners.get(parentId),childId=parentId;id!=null;childId=id,id=owners.get(id)){
      const owner=byId.get(id);
      changed={...owner,children:(owner.children||[]).map(c=>c.id===childId?changed:c)};
    }
    const next=planner(changed,measure,baseParams);
    const page=next.pages.find(p=>p.units.includes(probe.id));
    // A blocked plan can omit the synthetic node entirely. Treat that as
    // blocked, never as consent to create an orphaned logical node.
    const result={side:page?.side||null,sector:page? page.index+1:null,
      blocked:!!next.blocked||!page,effectiveHeight:next.effectiveHeight};
    this._continuationPrediction.set(cacheKey,result);return result;
   };
   if(plan.blocked||plan.pages.length>2||new Set(plan.pages.map(p=>p.side)).size!==plan.pages.length){
     this.adaptiveLimit.blocked=true;
     // No detached islands at the technical ceiling. The fallback may assign
     // presentation sides, so restore all stored logical sides afterwards.
     const fallbackSides=new Map(),nodes=[logical];
     while(nodes.length){const n=nodes.pop();fallbackSides.set(n.id,n.side);
       for(const c of n.children||[])nodes.push(c);
     }
     try{this.classicDistribution=compute.call(this,logical,...args);}
     finally{
       const pending=[logical];
       while(pending.length){const n=pending.pop();n.side=fallbackSides.get(n.id);
         for(const c of n.children||[])pending.push(c);
       }
     }
     this.continuationPlan=plan;
     return this.classicDistribution;
   }
   const combined=new Map(),groups=[];
   for(const page of plan.pages){let group=groups.at(-1);if(!group||group.pages.some(p=>p.side===page.side))groups.push(group={pages:[]});group.pages.push(page);}
   if(!groups.length)groups.push({pages:[]});
   let outerLeft=0,outerRight=0,presentation;
   groups.forEach((group,i)=>{
    const visual={...logical,id:'nm-root:'+i+':'+logical.id,logicalId:logical.id,
     layoutDistribution:null,manualOffset:null,children:group.pages.flatMap(p=>p.roots)};
    // Left-hand descendants read bottom-to-top, following the same clockwise sequence.
    const reverse=n=>{
     const pending=[n];
     while(pending.length){
      const current=pending.pop(),children=current.children||[];
      if(current.side==='left'&&!config.initialOrder)children.reverse();
      for(let i=children.length-1;i>=0;i--)pending.push(children[i]);
     }
    };visual.children.forEach(reverse);
    const local=compute.call(this,visual,...args),box=this.computeBoundingBox([]);
    for(const [id,m]of this.nodeLayoutMap)for(const image of this._nmImageMap?.get(id)||[]){const x=m.x+(Number(image.offset?.dx)||0),y=m.y+(Number(image.offset?.dy??-84)||0),w=Number(image.width)||135,h=Number(image.height)||100;box.minX=Math.min(box.minX,x-w/2-40);box.maxX=Math.max(box.maxX,x+w/2+40);box.minY=Math.min(box.minY,y-h/2-40);box.maxY=Math.max(box.maxY,y+h/2+40);}
    const direction=i%2?1:-1;
    const dx=!i?0:direction===1?outerRight+48-box.minX:outerLeft-48-box.maxX;
    for(const [id,m]of this.nodeLayoutMap){
     m.x+=dx;for(const key of ['attachInX','attachOutX'])if(Number.isFinite(m[key]))m[key]+=dx;
     if(m.bracketGeom)for(const key of ['baseX','tipX'])m.bracketGeom[key]+=dx;
     combined.set(id,m);
    }
    group.root=visual;group.x=dx;group.metrics=local;group.bounds={minX:box.minX+dx,maxX:box.maxX+dx};
    outerLeft=Math.min(outerLeft,box.minX+dx);outerRight=Math.max(outerRight,box.maxX+dx);
    if(!i)presentation=visual;else{visual.isFloating=true;presentation.children.push(visual);}
   });
   // Floating topics keep their logical location and are rendered once.
   const floating=(logical.children||[]).filter(n=>n.isFloating);
   if(floating.length){const tree={...logical,layoutDistribution:null,children:floating};compute.call(this,tree,...args);for(const [id,m]of this.nodeLayoutMap)if(id!==logical.id)combined.set(id,m);const copy=n=>({...n,children:(n.children||[]).map(copy)});presentation.children.push(...floating.map(copy));}
   this.nodeLayoutMap=combined;this.presentationRoot=presentation;this.continuationPlan=plan;this.continuationGroups=groups;
   plan.aliases.set(logical.id,presentation.id);
   const record=(n,parent)=>{
    const pending=[{node:n,parent}];
    while(pending.length){
     const frame=pending.pop(),current=frame.node;
     if(frame.parent)current.parentId=frame.parent.id;
     this.viewNodes.set(current.id,current);
     const source=logicalNodes.get(current.logicalId);
     if(source&&current.id!==logical.id&&!plan.aliases.has(current.logicalId))
      plan.aliases.set(current.logicalId,current.id);
     if(!current.collapsed)for(let i=(current.children?.length||0)-1;i>=0;i--)
      pending.push({node:current.children[i],parent:current});
    }
   };record(presentation);
   // A canonical anchor per logical node supports relationships, images and keyboard editing.
   for(const [id,viewId]of plan.aliases){const m=combined.get(viewId);if(m){combined.set(id,m);const source=logicalNodes.get(id);if(source&&config.overflowMode!=='expand')source.side=this.viewNodes.get(viewId).side;}}
   for(const [viewId,view]of this.viewNodes){const source=logicalNodes.get(view.logicalId);if(source?.isSummary&&!view.isSummary)for(const target of source.summaryTargetIds||[]){const anchor=plan.aliases.get(target);if(anchor&&combined.has(anchor))this.presentationRelations.push({id:'nm-summary-link:'+viewId+':'+target,fromId:anchor,toId:viewId,label:'',color:source.color});}}
   this._preferredViews=this._preferredViews||new Map();
   for(const [id,viewId]of this._preferredViews)if(!combined.has(viewId))this._preferredViews.delete(id);
   const rights=plan.pages.filter(p=>p.side==='right'),lefts=plan.pages.filter(p=>p.side==='left');
   return {H_R:Math.max(0,...rights.map(p=>p.height)),H_L:Math.max(0,...lefts.map(p=>p.height)),
    rightCount:rights.reduce((n,p)=>n+p.roots.length,0),leftCount:lefts.reduce((n,p)=>n+p.roots.length,0),
    rightIds:rights.flatMap(p=>p.roots.map(n=>n.logicalId)),leftIds:lefts.flatMap(p=>p.roots.map(n=>n.logicalId)),
    totalPrimary:logical.children.length,splitIndex:rights[0]?.roots.length||0,pages:plan.pages.length};
  };
  const get=Layout.prototype.getLayout;Layout.prototype.getLayout=function(id){const preferred=this._preferredViews?.get(id);return get.call(this,this.presentationRoot&&preferred?preferred:id);};
  // Reserve the image footprint for every view of an ancestor, too.
  const measure=Layout.prototype.measureNode;Layout.prototype.measureNode=function(n,...args){
   if(n.logicalId&&this._nmImageMap?.has(n.logicalId))this._nmImageMap.set(n.id,this._nmImageMap.get(n.logicalId));return measure.call(this,n,...args);
  };
  const render=Renderer.prototype.render;Renderer.prototype.render=function(...args){
   if(!this.layout.presentationRoot)return render.apply(this,args);
   const logical=this.state.root,relations=this.state.relationships;this.state.root=this.layout.presentationRoot;this.state.relationships=[...relations,...this.layout.presentationRelations];
   try{return render.apply(this,args);}finally{this.state.root=logical;this.state.relationships=relations;}
  };
  const p=App.prototype,move=p.nm611MoveSelection;
  p.nm611MoveSelection=function(key){
   if(!this.layout.presentationRoot)return move.call(this,key);
   const layout=this.layout,id=this.state.selectedNodeId||this.state.root.id,viewId=layout._preferredViews?.get(id)||layout.continuationPlan.aliases.get(id)||id;
   const current=layout.viewNodes.get(viewId);if(!current)return false;
   const here=layout.nodeLayoutMap.get(current.id);let candidates=[];
   if(key==='ArrowLeft'||key==='ArrowRight'){
    const left=key==='ArrowLeft',outward=current.side==='root'||((current.side==='left')===left);
    if(outward)candidates=(current.collapsed?[]:current.children||[]).filter(n=>!n.isFloating&&!n.isSummary&&(left?layout.getLayout(n.id).x<here.x:layout.getLayout(n.id).x>here.x));
    else {const parent=layout.viewNodes.get(current.parentId);if(parent)candidates=[parent];}
    candidates.sort((a,b)=>{const A=layout.getLayout(a.id),B=layout.getLayout(b.id);return current.side==='root'?Math.abs(A.y-here.y)-Math.abs(B.y-here.y)||(left?B.y-A.y:A.y-B.y):(left?B.y-A.y:A.y-B.y);});
   }else{
    const up=key==='ArrowUp';candidates=[...layout.viewNodes.values()].filter(n=>n.id!==viewId&&(n.logicalId||n.id)!==id&&(up?layout.getLayout(n.id).y<here.y-1:layout.getLayout(n.id).y>here.y+1));
    const score=n=>{const m=layout.getLayout(n.id);return Math.hypot(m.y-here.y,(m.x-here.x)*1.5)+(n.parentId===current.parentId?0:40);};candidates.sort((a,b)=>score(a)-score(b)||a.id.localeCompare(b.id));
   }
   const target=candidates[0];if(!target)return false;
   this._distributionHit=null;const logicalId=target.logicalId||target.id;layout._preferredViews.set(logicalId,target.id);this.selectNode(logicalId);this.canvas.focus({preventScroll:true});
   const m=layout.getLayout(logicalId),point=this.renderer.worldToScreen(m.x,m.y);if(point.x<50||point.x>innerWidth-50||point.y<120||point.y>innerHeight-70)this.teleportToNode(logicalId);return true;
  };
  const bounds=p.nm612Bounds;p.nm612Bounds=function(id,...args){return this.layout.presentationRoot?root.NeuroMapGraphics.bounds(this,id):bounds.call(this,id,...args);};
  const hit=p.findHit;p.findHit=function(x,y){
   if(!this.layout.presentationRoot)return hit.call(this,x,y);
   const initial=hit.call(this,x,y);if(initial?.type==='image'||initial?.type==='image-handle')return initial;
   const point=this.renderer.screenToWorld(x,y);
   for(const [id,view]of [...this.layout.viewNodes].reverse()){
    const m=this.layout.nodeLayoutMap.get(id);if(!m)continue;
    if(Math.abs(point.x-m.x)<=m.width/2&&Math.abs(point.y-m.y)<=m.height/2){const logicalId=view.logicalId||id;this._distributionHit={logicalId,viewId:id};return {type:'node',item:this.state.findNode(logicalId),viewId:id};}
   }return initial;
  };
  const select=p.selectNode;p.selectNode=function(id,...args){if(this._distributionHit?.logicalId===id&&this.layout.presentationRoot)this.layout._preferredViews.set(id,this._distributionHit.viewId);this._distributionHit=null;return select.call(this,id,...args);};
  const bind=p.bindUI;p.bindUI=function(...args){const result=bind.apply(this,args);mount(this);return result;};
  // All active-map insertion entry points (toolbar, keyboard and outline) use
  // these same existing state methods. Abort BEFORE pushHistory or mutations
  // if a map has hit the technical ceiling; never create surprise islands.
  const guard=app=>{
    const State=app.state?.constructor;
    if(!State?.prototype||State.prototype._nmAdaptiveGuarded)return;
    const originalChild=State.prototype.addChildNode,originalSibling=State.prototype.addSiblingNode;
    const canAdd=(state,parentId)=>{
      if(state!==app.state||!settings(state.root).enabled)return true;
      // Independent topics are laid out separately and have no continuation page.
      // Their descendants must not inherit the central map's page-space rejection.
      let ancestor=state.findNode(parentId);const seen=new Set();
      while(ancestor&&!seen.has(ancestor.id)){
       if(ancestor.isFloating)return true;
       seen.add(ancestor.id);ancestor=ancestor.parentId?state.findNode(ancestor.parentId):null;
      }
      const prediction=app.layout.predictContinuation?.(parentId);
      // If the planner fails or is unavailable while already over capacity,
      // fail closed rather than letting an unsafe insertion create islands.
      if(prediction && !prediction.blocked)return true;
      if(!prediction && !app.layout.adaptiveLimit?.blocked)return true;
      if(!app._nmAdaptiveBlockingNotice){
        app._nmAdaptiveBlockingNotice=true;
        Promise.resolve().then(()=>app.nmAsk?.({
          title:tr('Spazio del ramo esaurito','Branch space limit'),
          message:tr('Questo ramo supera lo spazio massimo della disposizione. Riduci spaziatura o dimensioni del testo, oppure ridistribuisci i rami.','This branch exceeds the layout space limit. Reduce spacing or text sizes, or redistribute branches.'),
          choices:[{value:'cancel',text:tr('Annulla','Cancel')},
            {value:'redistribute',text:tr('Redistribuisci','Redistribute'),primary:true}]
        })).then(action=>{
          if(action==='redistribute'&&app.state===state){
            state.pushHistory();state.balanceBias=50;app.markChanged();showGuides(app);
          }
        }).catch(error=>console.warn('Adaptive limit:',error))
          .finally(()=>{app._nmAdaptiveBlockingNotice=false});
      }
      return false;
    };
    State.prototype.addChildNode=function(parentId,...args){
      return canAdd(this,parentId)?originalChild.call(this,parentId,...args):null;
    };
    State.prototype.addSiblingNode=function(id,...args){
      const node=this.findNode(id),parentId=node?.parentId||this.root?.id;
      return canAdd(this,parentId)?originalSibling.call(this,id,...args):null;
    };
    State.prototype._nmAdaptiveGuarded=true;
  };
  const bindGuard=p.bindUI;p.bindUI=function(...args){const result=bindGuard.apply(this,args);guard(this);return result;};
  const status=p.updateStatus;p.updateStatus=function(...args){const result=status.apply(this,args);updatePanel(this);return result;};
  const guides=Renderer.prototype.drawThresholdGuides;Renderer.prototype.drawThresholdGuides=function(){
   if(this.state.branchStyle==='radial'||!this._distributionGuidesUntil||this._distributionGuideState!==this.state||performance.now()>this._distributionGuidesUntil)return;
   guides.call(this);
   const config=settings(this.layout.logicalRoot||this.state.root),plan=this.layout.continuationPlan,bias=(this.state.balanceBias??50)/100;
   const guideHeight=config.overflowMode==='expand'?this.layout.adaptiveLimit?.effective||config.height:config.height;
   const right=plan?Math.max(guideHeight*2*bias,0,...plan.pages.filter(p=>p.side==='right').map(p=>p.height)):(this.layout.classicDistribution?.H_R||0),
     left=plan?Math.max(guideHeight*2*(1-bias),0,...plan.pages.filter(p=>p.side==='left').map(p=>p.height)):(this.layout.classicDistribution?.H_L||0);
   const ctx=this.ctx,zoom=Math.max(.05,Number(this.camera?.zoom)||1);
   const groups=this.layout.continuationGroups?.length?this.layout.continuationGroups:[{x:0}];
   const draw=(heights,stroke,dashes)=>{
     ctx.strokeStyle=stroke;ctx.setLineDash(dashes.map(v=>v/zoom));ctx.lineWidth=1.3/zoom;
     for(const group of groups)for(const [dir,h]of [[1,heights[0]],[-1,heights[1]]]){
       if(h<=0)continue;
       for(const y of [-h/2,h/2]){
         ctx.beginPath();ctx.moveTo(group.x,y);
         ctx.lineTo(dir===1?(group.bounds?.maxX??group.x+1100):(group.bounds?.minX??group.x-1100),y);
         ctx.stroke();
       }
     }
   };
   ctx.save();
   // Two distinct guides when content forces a safe expansion:
   // amber = user's exact slider threshold, purple = effective safe boundary.
   if(guideHeight>config.height+1&&config.overflowMode==='expand')
     draw([config.height*2*bias,config.height*2*(1-bias)],'rgba(251,191,36,.9)',[5,5]);
   draw([right,left],'rgba(129,140,248,.8)',[9,6]);
   ctx.restore();
  };
 }
 const guideControls=new Set(["threshold-slider","menu-threshold-slider","nm67-compact-slider","nm68-branch-gap","nm-distribution-height","nm-distribution-exact","nm-distribution-less","nm-distribution-more","nm620-preview-next","nm620-show-guides"]);
 function isGuideControl(element){return guideControls.has(element?.id);}
 function hideGuides(app){
  const active=app._distributionGuideHeld||app.renderer._distributionGuidesUntil;
  app._distributionGuideHeld=false;clearTimeout(app._distributionGuideTimer);
  app.renderer._distributionGuidesUntil=0;app.renderer._distributionGuideState=null;if(active)app.requestRender();
 }
 function showGuides(app,duration=1500){
  if(!settings(app.state.root).enabled||app.state.branchStyle==="radial")return hideGuides(app);
  app.renderer._distributionGuideState=app.state;
  app.renderer._distributionGuidesUntil=app._distributionGuideHeld?Infinity:performance.now()+duration;app.requestRender();clearTimeout(app._distributionGuideTimer);
  if(!app._distributionGuideHeld)app._distributionGuideTimer=setTimeout(()=>{app.renderer._distributionGuidesUntil=0;app.requestRender();},duration+20);
 }
 function initialSettings(app){
  const bias=(app.state.balanceBias??app.state.thresholdY??50)/100,m=app.splitMetrics||{};
  const height=Math.ceil(Math.max(480,bias>0?(m.H_R||0)/(2*bias):0,bias<1?(m.H_L||0)/(2*(1-bias)):0)/20)*20;
  return {enabled:true,height,minimumHeight:480,overflowMode:'expand'};
 }
 // Keep pointer adjustments precise without limiting the planner's 100,000 px capacity.
 function sliderWindow(height,lower,upper){
  const span=Math.min(1200,upper-lower);
  let start=Math.max(lower,Math.floor((height-span/2)/20)*20);
  let end=Math.min(upper,start+span);
  start=Math.max(lower,end-span);
  return {start,end};
 }
/* @neuromap-continuation-layout-mount */
 root.NeuroMapContinuation={install,settings,showGuides,hideGuides,isGuideControl,initialSettings,forecastSummary,updateForecast};
})(globalThis);
