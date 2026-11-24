/* Adaptive canvas: skip offscreen paint on large maps; respect explicit user preferences. */
(function (global) {
  'use strict';
  const KEY='neuromap.fastCanvas.enabled.v1';
  const isVisible=(r,b)=>r.x<=b.maxX&&r.x+r.w>=b.minX&&r.y<=b.maxY&&r.y+r.h>=b.minY;
  function viewport(renderer) {
    const zoom=Math.max(0.001,Number(renderer.camera.zoom)||1);
    const width=renderer.canvas.clientWidth||global.innerWidth||1;
    const height=renderer.canvas.clientHeight||global.innerHeight||1;
    const margin=180/zoom;
    return {minX:-renderer.camera.x/zoom-margin,maxX:(width-renderer.camera.x)/zoom+margin,
      minY:-renderer.camera.y/zoom-margin,maxY:(height-renderer.camera.y)/zoom+margin};
  }
  function box(m) {
    const w=Math.max(1,Number(m.width)||1),h=Math.max(1,Number(m.height)||1);
    return {x:m.x-w/2,y:m.y-h/2,w,h};
  }
 // The complete underline and label footprint must survive viewport culling.
 // Radial controls can curve outside the segment joining the node centres.
 function connectionBounds(a,b,radial=false){
  const pad=radial?Math.hypot(b.x-a.x,b.y-a.y)*.06+40:40;
  const left=m=>Math.min(m.x-(m.width||0)/2,m.attachInX??m.x,m.attachOutX??m.x);
  const right=m=>Math.max(m.x+(m.width||0)/2,m.attachInX??m.x,m.attachOutX??m.x);
  const top=m=>Math.min(m.y-(m.height||0)/2,m.attachInY??m.y,m.attachOutY??m.y);
  const bottom=m=>Math.max(m.y+(m.height||0)/2,m.attachInY??m.y,m.attachOutY??m.y);
  const x=Math.min(left(a),left(b))-pad,y=Math.min(top(a),top(b))-pad;
  return {x,y,w:Math.max(right(a),right(b))+pad-x,h:Math.max(bottom(a),bottom(b))+pad-y};
 }

  function syncAutoMode(renderer){
    if(!renderer._nmAutoFastCanvas)return;
    const enabled=(renderer.layout.nodeLayoutMap?.size||0)>300||(renderer.state.images?.length||0)>300;
    renderer.highPerformanceCanvas=enabled;
    if(renderer._nmFastToggle&&renderer._nmFastToggle.checked!==enabled)renderer._nmFastToggle.checked=enabled;
    if(renderer.fastCanvasStatus&&renderer.fastCanvasStatus.hidden===enabled)renderer.fastCanvasStatus.hidden=!enabled;
  }
  function install(App,Renderer) {
    const originalNode=Renderer.prototype.drawNode;
    Renderer.prototype.drawNode=function(node) {
      const v=this._nmFastViewport;
      if(!v)return originalNode.call(this,node);
      this._nmFastVisited++;
      const m=this.layout.getLayout(node.id);
      if(m&&!isVisible(box(m),v)) {
        if(!node.collapsed&&node.children)
          for(const child of node.children)this.drawNode(child);
        return;
      }
      this._nmFastDrawn++;
      return originalNode.call(this,node);
    };
    const originalBranch=Renderer.prototype.drawTaperingBranch;
    Renderer.prototype.drawTaperingBranch=function(parent,child,index=0,total=1) {
      const v=this._nmFastViewport;
      if(!v)return originalBranch.call(this,parent,child,index,total);
      this._nmFastEdges++;
      const p=this.layout.getLayout(parent.id),c=this.layout.getLayout(child.id);
      if(!p||!c||isVisible(connectionBounds(p,c,this.state.branchStyle==='radial'),v)) {
        this._nmFastPaintedEdges++;
        return originalBranch.call(this,parent,child,index,total);
      }
      // Still walk descendants: an off-screen parent may have on-screen children.
      if(child.collapsed)return;
      const children=child.children||[];
      const regular=children.filter(n=>!n.isSummary);
      regular.forEach((n,i)=>this.drawTaperingBranch(child,n,i,regular.length));
      if(this.state.branchStyle!=='radial') {
        for(const summary of children.filter(n=>n.isSummary)) {
          if(summary.collapsed)continue;
          const inside=(summary.children||[]).filter(n=>!n.isSummary);
          inside.forEach((n,i)=>this.drawTaperingBranch(summary,n,i,inside.length));
        }
      }
    };
    const originalRender=Renderer.prototype.render;
    Renderer.prototype.render=function(customCtx,customTransform) {
      if(!customCtx)syncAutoMode(this);
      if(!this.highPerformanceCanvas||customCtx)return originalRender.apply(this,arguments);
      const timer=global.performance&&typeof global.performance.now==='function'
        ?()=>global.performance.now():()=>Date.now();
      const started=timer();
      this._nmFastViewport=viewport(this);
      this._nmFastVisited=this._nmFastDrawn=this._nmFastEdges=this._nmFastPaintedEdges=0;
      try{return originalRender.apply(this,arguments);}
      finally {
        this.fastCanvasStats={visited:this._nmFastVisited,painted:this._nmFastDrawn,
          edges:this._nmFastEdges,paintedEdges:this._nmFastPaintedEdges,
          ms:Math.max(0,timer()-started)};
        this._nmFastViewport=null;
        if(this.fastCanvasStatus) {
          const s=this.fastCanvasStats;
          this.fastCanvasStatus.textContent=s.painted+'/'+s.visited+' nodi · '+
            s.paintedEdges+'/'+s.edges+' rami · '+s.ms.toFixed(1)+' ms';
        }
      }
    };
    const originalBind=App.prototype.bindUI;
    App.prototype.bindUI=function() {
      originalBind.apply(this,arguments);
      const toggle=global.document.getElementById('nm-fast-canvas-toggle');
      const stats=global.document.getElementById('nm-fast-canvas-stats');
      if(!toggle)return;
      let preference=null;
      try{preference=global.localStorage.getItem(KEY);}catch{}
      const enabled=preference==='true';
      this.renderer._nmAutoFastCanvas=preference!=='true'&&preference!=='false';
      this.renderer._nmFastToggle=toggle;
      const sync=(value)=>{
        this.renderer.highPerformanceCanvas=!!value;
        this.renderer.fastCanvasStatus=stats;
        toggle.checked=!!value;
        if(stats)stats.hidden=!value;
        this.requestRender();
      };
      sync(enabled);
      toggle.addEventListener('change',()=>{
        this.renderer._nmAutoFastCanvas=false;
        sync(toggle.checked);
        try{global.localStorage.setItem(KEY,String(toggle.checked));}catch{}
      });
    };
  }
  global.NeuroMapFastCanvas={install,viewport,isVisible,connectionBounds,syncAutoMode};
})(window);
