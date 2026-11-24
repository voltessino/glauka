/* Spatial acceleration for the optional NeuroMap Fast Canvas. No map/schema changes. */
(function(global){
  'use strict';
  const CELL=512,MAX_CELLS_PER_ITEM=96,MAX_QUERY_CELLS=50000;
  const intersect=(a,b)=>a.x<=b.maxX&&a.x+a.w>=b.minX&&a.y<=b.maxY&&a.y+a.h>=b.minY;
  const bounds=m=>{
    const w=Math.max(1,Number(m.width)||1),h=Math.max(1,Number(m.height)||1);
    return {x:m.x-w/2,y:m.y-h/2,w,h};
  };
  function spatialTable(items){
    const cells=new Map(),large=[];
    for(const item of items){
      const b=item.box;
      const minX=Math.floor(b.x/CELL),maxX=Math.floor((b.x+b.w)/CELL);
      const minY=Math.floor(b.y/CELL),maxY=Math.floor((b.y+b.h)/CELL);
      if((maxX-minX+1)*(maxY-minY+1)>MAX_CELLS_PER_ITEM){large.push(item);continue;}
      for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
        const key=x+','+y;
        if(!cells.has(key))cells.set(key,[]);
        cells.get(key).push(item);
      }
    }
    return {items,cells,large};
  }
  function query(table,view){
    const x0=Math.floor(view.minX/CELL),x1=Math.floor(view.maxX/CELL);
    const y0=Math.floor(view.minY/CELL),y1=Math.floor(view.maxY/CELL);
    let candidates;
    if((x1-x0+1)*(y1-y0+1)>MAX_QUERY_CELLS)candidates=table.items;
    else{
      const found=new Set(table.large);
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)
        for(const item of table.cells.get(x+','+y)||[])found.add(item);
      candidates=[...found];
    }
    return candidates.filter(item=>intersect(item.box,view)).sort((a,b)=>a.order-b.order);
  }
  function indexFor(renderer){
    const root=renderer.state.root,layout=renderer.layout;
    const old=renderer._nmSpatialIndex;
    if(old&&old.root===root&&old.layout===layout&&old.version===(layout._nmSpatialVersion||0))return old;
    const nodes=[],stack=[root],seen=new Set();
    while(stack.length){
      const node=stack.pop();
      if(!node||seen.has(node))continue;
      seen.add(node);
      const m=layout.getLayout(node.id);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y))
        nodes.push({node,box:bounds(m),order:nodes.length});
      if(!node.collapsed&&node.children)
        for(let i=node.children.length-1;i>=0;i--)stack.push(node.children[i]);
    }
    const edges=[];
    const append=(parent,child,index,total)=>{
      const p=layout.getLayout(parent.id),c=layout.getLayout(child.id);
      if(p&&c&&Number.isFinite(p.x)&&Number.isFinite(c.x))
        edges.push({parent,child,index,total,box:global.NeuroMapFastCanvas.connectionBounds(p,c,renderer.state.branchStyle==='radial'),order:edges.length});
    };
    // Mirror the renderer's primary ordering, including reversed LEFT indices.
    const primaries=(root.children||[]).filter(n=>!n.isSummary&&!n.isFloating);
    const right=primaries.filter(n=>n.side==='right');
    const left=primaries.filter(n=>n.side==='left');
    const visit=(initial)=>{
      const pending=[initial],visited=new Set();
      while(pending.length){
        const edge=pending.pop(),node=edge.child;
        if(visited.has(node))continue;
        visited.add(node);append(edge.parent,node,edge.index,edge.total);
        if(node.collapsed)continue;
        const children=node.children||[];
        const regular=children.filter(n=>!n.isSummary);
        const next=regular.map((child,i)=>({parent:node,child,index:i,total:regular.length}));
        if(renderer.state.branchStyle!=='radial'){
          for(const summary of children.filter(n=>n.isSummary&&!n.collapsed)){
            const children=(summary.children||[]).filter(n=>!n.isSummary);
            next.push(...children.map((child,i)=>({parent:summary,child,index:i,total:children.length})));
          }
        }
        for(let i=next.length-1;i>=0;i--)pending.push(next[i]);
      }
    };
    right.forEach((child,i)=>visit({parent:root,child,index:i,total:right.length}));
    left.forEach((child,i)=>visit({parent:root,child,index:left.length-1-i,total:left.length}));
    for(const floater of (root.children||[]).filter(n=>n.isFloating&&!n.collapsed)){
      const children=(floater.children||[]).filter(n=>!n.isSummary);
      children.forEach((child,i)=>visit({parent:floater,child,index:i,total:children.length}));
    }
    return renderer._nmSpatialIndex={root,layout,version:layout._nmSpatialVersion||0,
      nodes:spatialTable(nodes),edges:spatialTable(edges)};
  }
  // Point hit testing must preserve nodeLayoutMap insertion order, as the classic
  // editor chooses the LAST overlapping node (images retain higher priority).
  function hitIndexFor(app){
    const layout=app.layout,map=layout?.nodeLayoutMap;
    // A Map from another JavaScript realm (e.g. a VM-based test or embed)
    // does not pass instanceof Map here, despite exposing the same API.
    if(!map||typeof map.size!=='number'||typeof map[Symbol.iterator]!=='function')return null;
    const root=app.state?.root,revision=layout._nmSpatialVersion||0;
    const existing=app._nmSpatialHitIndex;
    if(existing&&existing.layout===layout&&existing.map===map&&
       existing.root===root&&existing.revision===revision&&existing.size===map.size)
      return existing;
    const items=[];
    for(const [id,metric] of map){
      if(!metric||!Number.isFinite(metric.x)||!Number.isFinite(metric.y))continue;
      items.push({id,box:bounds(metric),order:items.length});
    }
    // Build the logical ID index once per layout revision. Previously every
    // pointer hit did a potentially O(all nodes) state.findNode() traversal,
    // defeating spatial indexing on large maps.
    const nodeById=new Map(),pending=[root],seen=new Set();
    while(pending.length){
      const node=pending.pop();
      if(!node||seen.has(node))continue;
      seen.add(node);
      if(!nodeById.has(node.id))nodeById.set(node.id,node);
      if(Array.isArray(node.children))
        for(let i=node.children.length-1;i>=0;i--)pending.push(node.children[i]);
    }
    return app._nmSpatialHitIndex={layout,map,root,revision,size:map.size,
      nodeById,table:spatialTable(items)};
  }
  function hitNodeAt(app,x,y){
    const idx=hitIndexFor(app);
    if(!idx)return null;
    // Point hit tests visit exactly one spatial cell. Both the cell entries
    // and the oversize-object list are already in insertion order, so a
    // reverse scan finds the last overlapping node without allocating a Set,
    // filtering or sorting a candidate array on every mouse movement.
    const cell=idx.table.cells.get(Math.floor(x/CELL)+','+Math.floor(y/CELL))||[];
    const large=idx.table.large;
    const hit={minX:x,maxX:x,minY:y,maxY:y};
    let best=null,bestOrder=-1;
    for(let i=cell.length-1;i>=0;i--){
      const item=cell[i];
      if(item.order<=bestOrder)break;
      if(!intersect(item.box,hit))continue;
      const node=idx.nodeById.get(item.id);
      if(node){best=node;bestOrder=item.order;break}
    }
    for(let i=large.length-1;i>=0;i--){
      const item=large[i];
      if(item.order<=bestOrder)break;
      if(!intersect(item.box,hit))continue;
      const node=idx.nodeById.get(item.id);
      if(node){best=node;bestOrder=item.order;break}
    }
    return best;
  }
  function indexedHit(app,clientX,clientY){
    if(typeof app.v5RelationLabelHit==='function'){
      const label=app.v5RelationLabelHit(clientX,clientY);
      if(label)return label;
    }
    const handle=app.imageHandleHit(clientX,clientY);
    if(handle)return handle;
    const point=app.renderer.screenToWorld(clientX,clientY);
    const images=app.state.images||[];
    for(let i=images.length-1;i>=0;i--){
      const image=images[i];
      if(image.zLayer==='back')continue;
      const rect=app.renderer.resolveImageWorldRect(image);
      if(rect&&point.x>=rect.x&&point.x<=rect.x+rect.w&&
         point.y>=rect.y&&point.y<=rect.y+rect.h)return {type:'image',item:image};
    }
    const node=hitNodeAt(app,point.x,point.y);
    if(node)return {type:'node',item:node};
    for(let i=images.length-1;i>=0;i--){
      const image=images[i];
      if(image.zLayer!=='back')continue;
      const rect=app.renderer.resolveImageWorldRect(image);
      if(rect&&point.x>=rect.x&&point.x<=rect.x+rect.w&&
         point.y>=rect.y&&point.y<=rect.y+rect.h)return {type:'image',item:image};
    }
    // Study UI adds relationship hit detection after the classic node/image pass.
    return typeof app.v5RelationHit==='function'?app.v5RelationHit(clientX,clientY):null;
  }
  function install(App,Renderer){
    const paintNode=Renderer.prototype.drawNode,paintEdge=Renderer.prototype.drawTaperingBranch;
    Renderer.prototype.drawNode=function(node){
      if(!this._nmFastViewport)return paintNode.call(this,node);
      if(this._nmSpatialPaintingNode)return;
      if(node!==this.state.root)return paintNode.call(this,node);
      const index=indexFor(this),list=query(index.nodes,this._nmFastViewport);
      this._nmSpatialNodeCandidates=list.length;
      this._nmSpatialPaintingNode=true;
      try{for(const row of list)paintNode.call(this,row.node);}
      finally{this._nmSpatialPaintingNode=false;}
    };
    Renderer.prototype.drawTaperingBranch=function(parent,child,index,total){
      if(!this._nmFastViewport)return paintEdge.call(this,parent,child,index,total);
      if(this._nmSpatialPaintingEdge||this._nmSpatialEdgesDone)return;
      this._nmSpatialEdgesDone=true;
      const idx=indexFor(this),list=query(idx.edges,this._nmFastViewport);
      this._nmSpatialEdgeCandidates=list.length;
      this._nmSpatialPaintingEdge=true;
      try{for(const row of list)paintEdge.call(this,row.parent,row.child,row.index,row.total);}
      finally{this._nmSpatialPaintingEdge=false;}
    };
    const render=Renderer.prototype.render;
    Renderer.prototype.render=function(customCtx,customTransform){
      this._nmSpatialEdgesDone=false;
      this._nmSpatialNodeCandidates=this._nmSpatialEdgeCandidates=0;
      const result=render.apply(this,arguments);
      if(this.highPerformanceCanvas&&!customCtx&&this.fastCanvasStatus&&this._nmSpatialIndex){
        const idx=this._nmSpatialIndex,s=this.fastCanvasStats||{};
        this.fastCanvasStatus.textContent=(s.painted||0)+'/'+idx.nodes.items.length+
          ' nodi · '+(s.paintedEdges||0)+'/'+idx.edges.items.length+
          ' rami · '+(s.ms||0).toFixed(1)+' ms';
      }
      return result;
    };
    const classicHit=App.prototype.findHit;
    App.prototype.findHit=function(x,y){
      // Continuation views can contain multiple visual aliases for one logical
      // node. Defer to its dedicated view-aware hit test until those aliases
      // have their own spatial index; otherwise the selected side is lost.
      if(this.layout?.presentationRoot)return classicHit.apply(this,arguments);
      if(!this.renderer?.highPerformanceCanvas||
         !this.layout?.nodeLayoutMap||!this.state?.root||
         !this.renderer?.screenToWorld||!this.imageHandleHit)
        return classicHit.apply(this,arguments);
      return indexedHit(this,x,y);
    };
    const bind=App.prototype.bindUI;
    App.prototype.bindUI=function(){
      const result=bind.apply(this,arguments);
      if(this.layout&&!this.layout._nmSpatialWrapped){
        const layout=this.layout,compute=layout.computeLayout;
        if(typeof compute==='function'){
          layout._nmSpatialVersion=0;
          layout.computeLayout=function(){
            const result=compute.apply(this,arguments);
            this._nmSpatialVersion++;
            return result;
          };
          const recalc=layout.recomputeDescendantsLayout;
          if(typeof recalc==='function'){
            layout.recomputeDescendantsLayout=function(){
              const value=recalc.apply(this,arguments);
              this._nmSpatialVersion++;
              return value;
            };
          }
          layout._nmSpatialWrapped=true;
        }
      }
      return result;
    };
  }
  global.NeuroMapSpatialCanvas={install,query,spatialTable,indexFor,hitIndexFor,hitNodeAt,indexedHit};
})(window);
