    /* NeuroMap v5 enhancements */
    // ==========================================================================
    // NeuroMap 5: bulk typography, editable relationships, organic drag & drop,
    // AI-generated study cards with stable node references and local archives.
    // ==========================================================================
    const $v5 = id => document.getElementById(id);
    const v5Bound = (n,lo,hi)=>Math.max(lo,Math.min(hi,n));
    const v5SafeText = str=>String(str||'').trim().replace(/[\u0000-\u001f]/g,' ');
    const v5CardId = ()=> 'card_'+Math.random().toString(36).slice(2,11)+'_'+Date.now().toString(36);
    const v5Esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    OrganicLayoutEngine.prototype.applyManualOffsets=function(root){
      // A node's manual displacement carries its entire subtree, preserving
      // the relative structure and keeping connectors attached to their nodes.
      const move=(node,px,py)=>{
        const dx=px+(Number(node.manualOffset?.dx)||0),dy=py+(Number(node.manualOffset?.dy)||0);
        const m=this.nodeLayoutMap.get(node.id);
        if(m && (dx||dy)){
          m.x+=dx;m.y+=dy;
          for(const field of ['attachInX','attachOutX'])if(Number.isFinite(m[field]))m[field]+=dx;
          for(const field of ['attachInY','attachOutY'])if(Number.isFinite(m[field]))m[field]+=dy;
        }
        if(!node.collapsed)for(const child of node.children||[])move(child,dx,dy);
      };
      move(root,0,0);
    };

    NeuroMapApp.prototype.getStudyCardsForTab=function(tabId){
      return (this.studyCards||[]).filter(c=>c.sourceTabId===tabId).map(c=>JSON.parse(JSON.stringify(c)));
    };
    NeuroMapApp.prototype.v5FindStudyNode=function(card){
      const tab=this.tabs.find(t=>t.id===card.sourceTabId);
      return tab?.state.findNode(card.sourceNodeId)||null;
    };
    NeuroMapApp.prototype.v5Signature=function(node,state=this.state){
      if(!node)return 'deleted';
      // Compact deterministic signature: contextual node + direct children and notes.
      const ancestry=[];let cursor=node;for(let j=0;cursor&&j<12;j++){ancestry.unshift([cursor.id,cursor.text]);cursor=state.findNode(cursor.parentId);}
      const text=JSON.stringify([ancestry,node.notes||'',(node.children||[]).map(c=>[c.id,c.text,c.children?.length||0])]);
      let hash=2166136261;
      for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
      return (hash>>>0).toString(36);
    };
    NeuroMapApp.prototype.v5Staleness=function(card){
      const node=this.v5FindStudyNode(card);
      if(!node)return 'missing';
      const tab=this.tabs.find(t=>t.id===card.sourceTabId);
      return this.v5Signature(node,tab?.state)===(card.sourceSignature||'')?'fresh':'stale';
    };

    // Update status of the inspector selection and remember the last edited set.
    const v5Status0=NeuroMapApp.prototype.updateStatus;
    NeuroMapApp.prototype.updateStatus=function(){
      v5Status0.call(this);
      if($v5('v5-selection-hint')){
        const len=(this.state.selectedNodeIds||[]).length;
        $v5('v5-selection-hint').textContent=len>1?`${len} nodi selezionati · dimensione applicata a tutti (un solo Undo)`:
          'Ctrl+A seleziona tutti · Shift/Ctrl+Clic seleziona più nodi';
      }
      if($v5('v5-font-preset'))$v5('v5-font-preset').value=this.state.typographyPreset||'uniform';
      if($v5('v5-font-scale')){
        $v5('v5-font-scale').value=Math.round((this.state.typographyScale||1)*100);
        $v5('v5-font-scale-value').textContent=Math.round((this.state.typographyScale||1)*100)+'%';
      }
    };
    NeuroMapApp.prototype.v5BulkNodes=function(){
      const ids=this.state.selectedNodeIds?.length?this.state.selectedNodeIds:[this.state.selectedNodeId];
      return [...new Set(ids)].map(id=>this.state.findNode(id)).filter(Boolean);
    };
    NeuroMapApp.prototype.v5BulkFont=function(size){
      const nodes=this.v5BulkNodes();if(!nodes.length)return;
      for(const n of nodes)n.fontSize=size===null?null:v5Bound(Number(size),9,48);
      // Layout is expensive. Coalesce slider moves into one frame.
      if(!this._v5FontFrame)this._v5FontFrame=requestAnimationFrame(()=>{
        this._v5FontFrame=null;this.recalculateAndRender();
      });
      $v5('inspector-fontsize-val').textContent=size===null?'Auto':size+'px';
    };
    NeuroMapApp.prototype.v5SetPreset=function(preset){
      if(!['balanced','pyramid','branches','compact','uniform'].includes(preset))return;
      if(this.state.typographyPreset===preset)return;
      this.state.pushHistory();this.state.typographyPreset=preset;
      this.markChanged();
    };

    // Relationship selection: hit a label or any section of its Bezier path.
    NeuroMapApp.prototype.v5RelationHit=function(clientX,clientY){
      const world=this.renderer.screenToWorld(clientX,clientY), zoom=this.renderer.camera.zoom||1;
      let best=null, bestDistance=Infinity;
      for(const rel of this.state.relationships||[]){
        const a=this.layout.getLayout(rel.fromId),b=this.layout.getLayout(rel.toId);
        if(!a||!b)continue;
        const c=this.renderer.computeRelationshipCurve(a,b);
        const labelHalf=Math.max(31,7*String(rel.label||'Relazione').length*.55)/zoom;
        if(Math.abs(world.x-c.labelX)<Math.max(30,labelHalf) && Math.abs(world.y-c.labelY)<Math.max(12,14/zoom))
          return {type:'relationship',item:rel};
        let dist=Infinity;
        for(let i=0;i<=32;i++){
          const t=i/32,k=1-t;
          const x=k*k*k*c.x1+3*k*k*t*c.cp1x+3*k*t*t*c.cp2x+t*t*t*c.x2;
          const y=k*k*k*c.y1+3*k*k*t*c.cp1y+3*k*t*t*c.cp2y+t*t*t*c.y2;
          dist=Math.min(dist,Math.hypot(world.x-x,world.y-y));
        }
        if(dist<Math.max(8,9/zoom) && dist<bestDistance){best=rel;bestDistance=dist;}
      }
      return best?{type:'relationship',item:best}:null;
    };
    // The painted label is a fixed world-space pill. Prefer it over a node
    // that happens to contain the same point, without growing the box when
    // the map is zoomed out.
    NeuroMapApp.prototype.v5RelationLabelHit=function(clientX,clientY){
      const world=this.renderer.screenToWorld(clientX,clientY);
      for(const rel of this.state.relationships||[]){
        const a=this.layout.getLayout(rel.fromId),b=this.layout.getLayout(rel.toId);
        if(!a||!b)continue;
        const c=this.renderer.computeRelationshipCurve(a,b);
        const label=String(rel.label||'Relazione');
        const halfW=Math.max(27,label.length*3.4+9),halfH=11;
        if(Math.abs(world.x-c.labelX)<=halfW&&Math.abs(world.y-c.labelY)<=halfH)
          return {type:'relationship',item:rel};
      }
      return null;
    };
    const v5Hit0=NeuroMapApp.prototype.findHit;
    NeuroMapApp.prototype.findHit=function(x,y){
      const label=this.v5RelationLabelHit(x,y);
      if(label)return label;
      const original=v5Hit0.call(this,x,y);return original||this.v5RelationHit(x,y);
    };
    NeuroMapApp.prototype.v5SelectRelation=function(id){
      const rel=this.state.findRelationship(id);if(!rel)return;
      this.state.selectedRelationshipId=id;this.state.selectedNodeIds=[];this.state.selectedImageId=null;
      this.state.hoveredRelationshipId=id;
      $v5('v5-rel-label').value=rel.label;
      $v5('v5-rel-color').value=/^#[0-9a-f]{6}$/i.test(rel.color)?rel.color:'#f43f5e';
      $v5('v5-relation-panel').classList.remove('hidden');
      this.updateStatus();this.requestRender();
    };
    NeuroMapApp.prototype.v5CloseRelation=function(clear=true){
      $v5('v5-relation-panel').classList.add('hidden');
      if(clear){this.state.selectedRelationshipId=null;this.state.hoveredRelationshipId=null;this.requestRender();}
    };
    NeuroMapApp.prototype.v5ChangeRelation=function(updates){
      const rel=this.state.findRelationship(this.state.selectedRelationshipId);if(!rel)return;
      if(Object.keys(updates).every(k=>rel[k]===updates[k]))return;
      this.state.pushHistory();Object.assign(rel,updates);this.markChanged();
    };
    NeuroMapApp.prototype.v5DeleteRelation=function(){
      const id=this.state.selectedRelationshipId;
      if(id&&this.state.deleteRelationship(id)){this.v5CloseRelation();this.markChanged();this.showToast('Relazione eliminata (Ctrl+Z per annullare)','RELAZIONE');}
    };

    NeuroMapApp.prototype.v5IsDescendant=function(candidate,ancestor){
      let node=candidate;const visited=new Set();
      while(node&&!visited.has(node.id)){if(node.id===ancestor.id)return true;visited.add(node.id);
        node=this.state.findNode(node.parentId);}
      return false;
    };
    NeuroMapApp.prototype.v5SubtreeColors=function(node,parent){
      const propagate=(n,c,depth)=>{
        n.color=depth===0?c:ColorUtils.lighten(c,Math.min(42,depth*9));
        n.colorIndex=parent.colorIndex||0;
        for(const child of n.children||[])propagate(child,c,depth+1);
      };
      if(parent.side==='root')return; // Keep existing color of whole promoted branch.
      propagate(node,parent.color||'#818cf8',1);
    };
    NeuroMapApp.prototype.v5ReparentNode=function(nodeId,targetId,after=false,forceChild=false){
      const source=this.state.findNode(nodeId),dest=this.state.findNode(targetId);
      if(!source||!dest||source.side==='root'||source.id===dest.id||this.v5IsDescendant(dest,source))return false;
      const oldParent=this.state.findNode(source.parentId);
      const actualParent=(!forceChild && dest.parentId===source.parentId && dest.side!=='root')?oldParent:dest;
      if(!oldParent||!actualParent)return false;
      const oldIndex=oldParent.children.indexOf(source);
      const siblings=actualParent.children;
      // Dropping onto a sibling reorders it; onto another node attaches under it.
      const reorder=actualParent===oldParent && dest.parentId===source.parentId && dest.side!=='root';
      if(reorder){const targetIndex=siblings.indexOf(dest);if(oldIndex===targetIndex || (after&&oldIndex===targetIndex+1)||(!after&&oldIndex===targetIndex-1))return false;}
      this.state.pushHistory();oldParent.children.splice(oldIndex,1);
      if(reorder){const index=siblings.indexOf(dest);siblings.splice(index+(after?1:0),0,source);}
      else{actualParent.children.push(source);source.parentId=actualParent.id;actualParent.collapsed=false;
        source.manualOffset=null;
        this.v5SubtreeColors(source,actualParent);}
      this.state.normalizeChildrenOrder(oldParent);this.state.normalizeChildrenOrder(actualParent);
      const adjust=(n,side)=>{n.side=side;for(const c of n.children||[])adjust(c,side);};
      adjust(source,actualParent.side==='root'?'right':actualParent.side);
      if(!reorder){source.isFloating=false;source.floatingPosition=null;}
      this.state.selectedNodeId=source.id;this.state.selectedNodeIds=[source.id];
      this.markChanged();return true;
    };
    NeuroMapApp.prototype.v5MoveFree=function(nodeId,dx,dy){
      const node=this.state.findNode(nodeId);if(!node||node.side==='root')return false;
      if(Math.hypot(dx,dy)<5)return false;
      this.state.pushHistory();
      // Crossing the center with a primary branch pins it to the destination side.
      const layout=this.layout.getLayout(node.id);
      const newX=(layout?.x||0)+dx;
      const desiredSide=newX<-(this.layout.primaryGapX*.3)?'left':newX>(this.layout.primaryGapX*.3)?'right':null;
      if(node.parentId===this.state.root.id&&desiredSide&&desiredSide!==node.side){
        node.sidePinned=desiredSide;node.manualOffset=null;this.markChanged();return true;
      }
      node.manualOffset={dx:v5Bound((Number(node.manualOffset?.dx)||0)+dx,-3500,3500),
        dy:v5Bound((Number(node.manualOffset?.dy)||0)+dy,-3500,3500)};
      this.markChanged();return true;
    };
    NeuroMapApp.prototype.nm67PinSelected=function(side){
      const selected=this.v6SelectedNodes?.()||[];
      const roots=selected.filter(n=>n.parentId===this.state.root.id&&!n.isFloating);
      if(!roots.length){this.showToast('Seleziona uno o più rami principali','LAYOUT');return;}
      this.state.pushHistory();
      for(const node of roots)node.sidePinned=side;
      this.markChanged();
      this.showToast(side?'Lato fissato: '+(side==='right'?'destra':'sinistra'):'Lato automatico ripristinato','LAYOUT');
    };
    NeuroMapApp.prototype.v5Promote=function(){
      const node=this.state.findNode(this.state.selectedNodeId);
      if(!node||node.side==='root'||node.parentId===this.state.root.id)return;
      if(this.v5ReparentNode(node.id,this.state.root.id))this.showToast('Sotto-ramo promosso a ramo principale','SPOSTAMENTO');
    };
    NeuroMapApp.prototype.v5ResetPosition=function(){
      const nodes=this.v5BulkNodes().filter(n=>n.manualOffset);
      if(!nodes.length)return;
      this.state.pushHistory();for(const n of nodes)n.manualOffset=null;this.markChanged();
    };
    NeuroMapApp.prototype.v5DragVisual=function(d,x,y){NeuroMapDrag.preview(this,d,x,y);};
    NeuroMapApp.prototype.v5DragVisualClear=function(){NeuroMapDrag.clear(this);};

