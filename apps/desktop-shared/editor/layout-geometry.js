/* ======== NeuroMap 6.12: geometry, stable navigation, drag and style ======== */
const NM612_NAV_STORAGE='neuromap.nav.order.v6.12';
function nm612Viewport(){return NeuroMapGraphics.viewport();}

function nm612BoundingFromLayouts(metrics,pad=0){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const m of metrics){if(!m||![m.x,m.y,m.width,m.height].every(Number.isFinite))continue;
    minX=Math.min(minX,m.x-m.width/2);maxX=Math.max(maxX,m.x+m.width/2);
    minY=Math.min(minY,m.y-m.height/2);maxY=Math.max(maxY,m.y+m.height/2);
  }
  if(minX===Infinity)return {minX:-160,maxX:160,minY:-100,maxY:100,width:320,height:200};
  return {minX:minX-pad,minY:minY-pad,maxX:maxX+pad,maxY:maxY+pad,width:maxX-minX+2*pad,height:maxY-minY+2*pad};
}
NeuroMapApp.prototype.nm612Bounds=function(nodeId=null){
  return NeuroMapGraphics.bounds(this,nodeId);
};
NeuroMapApp.prototype.nm612FitBounds=function(box,{animated=false,maxZoom=2.3,selectId=null}={}){
  if(!box||!Number.isFinite(box.width)||!Number.isFinite(box.height))return false;
  const r=nm612Viewport(),spaceW=Math.max(100,r.right-r.left),spaceH=Math.max(100,r.bottom-r.top);
  const padding=Math.max(12,Math.min(25,Math.min(spaceW,spaceH)*.025));
  const targetZoom=Math.max(.001,Math.min(maxZoom,(spaceW-padding*2)/Math.max(1,box.width),(spaceH-padding*2)/Math.max(1,box.height)));
  const centerX=(r.left+r.right)/2,centerY=(r.top+r.bottom)/2;
  const target={zoom:targetZoom,x:centerX-(box.minX+box.maxX)*.5*targetZoom,y:centerY-(box.minY+box.maxY)*.5*targetZoom};
  this._teleportNonce=(this._teleportNonce||0)+1;this.stopTeleport?.();
  const camera=this.renderer.camera;
  if(!animated){Object.assign(camera,target);this.updateStatus();this.requestRender();this.positionEditor();return true;}
  const initial={...camera},started=performance.now(),nonce=this._teleportNonce;
  const tick=now=>{if(nonce!==this._teleportNonce)return;
    const u=Math.max(0,Math.min(1,(now-started)/430));const ease=1-Math.pow(1-u,3);
    camera.zoom=initial.zoom+(target.zoom-initial.zoom)*ease;
    camera.x=initial.x+(target.x-initial.x)*ease;camera.y=initial.y+(target.y-initial.y)*ease;
    this.requestRender();if(u<1)this._teleportFrame=requestAnimationFrame(tick);
    else{this._teleportFrame=null;this.updateStatus();this.positionEditor();if(selectId)this.renderer.startRadar?.(selectId,()=>this.requestRender());}
  };
  this._teleportFrame=requestAnimationFrame(tick);return true;
};
NeuroMapApp.prototype.fitToScreen=function(){return this.nm612FitBounds(this.nm612Bounds(),{animated:false,maxZoom:2.3});};
NeuroMapApp.prototype.fitWholeMap=function(){return this.fitToScreen();};
NeuroMapApp.prototype.nm612FitSubtree=function(id,{animated=true}={}){
  const node=this.state.findNode(id);if(!node)return false;
  let ancestor=node,expanded=false;
  while(ancestor?.parentId){ancestor=this.state.findNode(ancestor.parentId);if(!ancestor)break;
    if(ancestor.collapsed){if(!expanded)this.state.pushHistory();ancestor.collapsed=false;expanded=true;}
  }
  if(expanded)this.recalculateAndRender(true);
  this.selectNode(id);
  return this.nm612FitBounds(this.nm612Bounds(id),{animated,maxZoom:1.7,selectId:id});
};
NeuroMapApp.prototype.nm612NavMode=function(){return document.getElementById('nm612-nav-order')?.value||'source';};
NeuroMapApp.prototype.nm612Traversal=function(level,mode){
  let nodes=this.nm69NodesAtLevel(level);
  if(mode==='local'){
    const candidate=this.state.findNode(this.state.selectedNodeId);
    // Pin the active branch once, so navigation within it does not change the subtree on every click.
    if(!this._nm612LocalRootId||!this.state.findNode(this._nm612LocalRootId)){
      let anchor=candidate;while(anchor?.parentId&&anchor.parentId!==this.state.root.id)anchor=this.state.findNode(anchor.parentId);
      this._nm612LocalRootId=anchor?.id||this.state.root.id;
    }
    const ancestor=this.state.findNode(this._nm612LocalRootId);
    if(ancestor&&ancestor.id!==this.state.root.id)nodes=nodes.filter(n=>this.v5IsDescendant(n,ancestor));
  }else if(mode==='visual'){
    const radial=this.state.branchStyle==='radial';
    nodes=nodes.filter(n=>this.layout.getLayout(n.id)).sort((a,b)=>{
      const A=this.layout.getLayout(a.id),B=this.layout.getLayout(b.id);
      if(radial){const theta=m=>((Math.atan2(m.y,m.x)+Math.PI/2+2*Math.PI)%(2*Math.PI));return theta(A)-theta(B)||A.y-B.y;}
      return A.y-B.y||A.x-B.x;
    });
  }
  return nodes;
};
NeuroMapApp.prototype.nm67NavigateMain=function(direction=1){
  const level=this.nm69NavigationLevel(),mode=this.nm612NavMode(),nodes=this.nm612Traversal(level,mode);
  if(!nodes.length){this.showToast('Nessun ramo al livello '+level,'NAVIGAZIONE');return false;}
  const selected=this.state.findNode(this.state.selectedNodeId);
  let anchor=selected;while(anchor&&anchor.id!==this.state.root.id&&!nodes.includes(anchor))anchor=this.state.findNode(anchor.parentId);
  const index=nodes.findIndex(n=>n.id===anchor?.id);
  const remembered=this._nm612LastNavId&&nodes.findIndex(n=>n.id===this._nm612LastNavId);
  const from=index>=0?index:(Number.isInteger(remembered)&&remembered>=0?remembered:-1);
  const next=from<0?(direction>0?0:nodes.length-1):(from+direction+nodes.length)%nodes.length;
  this._nm612LastNavId=nodes[next].id;
  this.nm612FitSubtree(nodes[next].id);
  this.showToast(`${next+1}/${nodes.length} · Livello ${level} · ${nodes[next].text}`,'RAMO');return true;
};
NeuroMapApp.prototype.nm612DropIndicator=function(){};
NeuroMapApp.prototype.nm612ResolveDrop=function(id,x,y){return NeuroMapDrag.resolve(this,id,x,y);};
NeuroMapApp.prototype.nm612DetachBranch=function(id,x,y){return this.nmDragCommit(id,{kind:'detach'},x,y);};
const nm612PrevBatch=NeuroMapApp.prototype.nm70BatchStyle;
NeuroMapApp.prototype.nm70BatchStyle=function(label,fn){
  const applyAll=document.getElementById('nm612-all-tab-scope')?.checked;
  const mode=document.getElementById('nm70-style-scope')?.value||'selection';
  if(!applyAll)return nm612PrevBatch.call(this,label,fn);
  // Cross-map node editing requires a meaningful common scope; never guess what a selected
  // node in a different map represents.
  if(!mode.startsWith('level')&&mode!=='map'){
    this.showToast('Per tutte le schede scegli “Tutta la mappa” o “Livello N”','STILE');return false;
  }
  this.saveActiveTabSnapshot();let changed=0,count=0;
  for(const tab of this.tabs){
    const nodes=[];const visit=(n,depth)=>{if(mode==='map'||depth===Number(mode.slice(5)))nodes.push(n);for(const c of n.children||[])visit(c,depth+1)};
    visit(tab.state.root,0);if(!nodes.length)continue;
    tab.state.pushHistory();for(const node of nodes)fn(node);
    tab.state.isDirty=true;changed++;count+=nodes.length;
  }
  this.recalculateAndRender();this.renderTabBar();this.scheduleSave();this.nm70UpdateScopeUI();
  this.showToast(`${label}: ${count} nodi · ${changed} schede`,'STILE');return true;
};
NeuroMapApp.prototype.nm67AllStyles=function(){
  this.saveActiveTabSnapshot();
  const fields=['branchStyle','strokeScale','typographyPreset','typographyScale','branchGapX','defaultLabelWrapChars','wrapCustom','compactness','activeThemeId'];
  let count=0;
  for(const tab of this.tabs){if(tab.id===this.activeTabId)continue;
    const different=fields.some(key=>tab.state[key]!==this.state[key]);if(!different)continue;
    tab.state.pushHistory();for(const key of fields)tab.state[key]=this.state[key];
    tab.state.isDirty=true;count++;
  }
  this.recalculateAndRender();this.nm54SyncSettings?.();this.renderTabBar();this.scheduleSave();
  this.showToast('Stile globale copiato in '+count+' altre schede · Ctrl+Z per ogni scheda','STILE');
};
const nm612BindBefore=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm612BindBefore.apply(this,args);
  const chooser=document.getElementById('nm612-nav-order');
  if(chooser){try{chooser.value=localStorage.getItem(NM612_NAV_STORAGE)||'source';}catch{}
    chooser.addEventListener('change',()=>{
      this._nm612LastNavId=null;this._nm612LocalRootId=null;
      try{localStorage.setItem(NM612_NAV_STORAGE,chooser.value);}catch{}
      this.showToast('Navigazione: '+chooser.selectedOptions[0].textContent,'NAVIGAZIONE');
    });}
  document.getElementById('nm69-nav-level')?.addEventListener('change',()=>{this._nm612LastNavId=null;this._nm612LocalRootId=null});
  const ctx=document.getElementById('ctx-group-node');
  if(ctx&&!document.getElementById('nm612-paste-sibling')){
    const btn=document.createElement('button');btn.id='nm612-paste-sibling';btn.type='button';btn.className='ctx-item';btn.innerHTML='<span>▣ Incolla come fratello</span>';
    const group=[...ctx.querySelectorAll('.nm70-menu-group')].find(d=>d.textContent.includes('Appunti'));
    (group?.querySelector('.nm70-menu-items')||ctx).append(btn);
    btn.addEventListener('click',()=>{
      this._nm612PasteSibling=true;
      try{this.pasteSelection()}finally{this._nm612PasteSibling=false;}
      this.hideMenus();
    });
  }
  document.getElementById('nm67-apply-all-styles')?.setAttribute('title','Copia tutte le proprietà di stile globali (non modifica i nodi)');
  const global=document.getElementById('nm612-all-tab-scope');
  global?.addEventListener('change',()=>{if(global.checked){
    const scope=document.getElementById('nm70-style-scope');
    if(scope?.value==='selection')scope.value='map';
    this.nm70UpdateScopeUI();
  }});
  return result;
};
/* ======== end NeuroMap 6.12 ======== */
