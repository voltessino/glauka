      visibleSelectionOrder() {
        // Iterate only nodes currently present in the layout, sorted for a predictable range selection.
        return this.state.getAllNodes().filter(n=>n.id!==this.state.root.id && this.layout.getLayout(n.id))
          .sort((a,b)=>{const A=this.layout.getLayout(a.id), B=this.layout.getLayout(b.id);
            return A.y-B.y || A.x-B.x;}).map(n=>n.id);
      }
      selectNode(id, mode = 'single') {
        const n = this.state.findNode(id); if (!n) return;
        const existing = new Set(this.state.selectedNodeIds || []);
        if (mode === 'toggle') {
          existing.has(id) ? existing.delete(id) : existing.add(id);
          this.state.selectedNodeIds = [...existing];
          this.selectionAnchorId = id;
        } else if (mode === 'range') {
          const anchor = this.state.findNode(this.selectionAnchorId) || this.state.findNode(this.state.selectedNodeId);
          let ordered = this.visibleSelectionOrder();
          // Siblings take precedence: their tree order should be preserved even on the left side.
          if (anchor && anchor.parentId && anchor.parentId === n.parentId) {
            const parent = this.state.findNode(n.parentId);
            ordered = parent.children.filter(c=>this.layout.getLayout(c.id)).map(c=>c.id);
          }
          const i = anchor ? ordered.indexOf(anchor.id) : -1, j = ordered.indexOf(id);
          if (i < 0 || j < 0) this.state.selectedNodeIds = [id];
          else this.state.selectedNodeIds = ordered.slice(Math.min(i,j),Math.max(i,j)+1);
          if (!this.selectionAnchorId) this.selectionAnchorId = anchor?.id || id;
        } else {
          this.state.selectedNodeIds = [id];
          this.selectionAnchorId = id;
        }
        this.state.selectedNodeId = id; this.state.selectedImageId = null;
        this.state.selectedRelationshipId = null;
        this.updateStatus();this.updateImageControls();this.requestRender();
      }
      selectSiblingRange(direction) {
        const focus = this.state.findNode(this.state.selectedNodeId);
        if (!focus?.parentId || focus.id === this.state.root.id) return false;
        const parent = this.state.findNode(focus.parentId);
        if (!parent) return false;
        // Visual order may differ from tree order, especially on the left.
        const siblings = (parent.children || []).filter(n => !!this.layout.getLayout(n.id))
          .sort((a, b) => {
            const A = this.layout.getLayout(a.id), B = this.layout.getLayout(b.id);
            return A.y - B.y || A.x - B.x;
          });
        const current = siblings.findIndex(n => n.id === focus.id);
        if (current < 0) return false;
        const target = siblings[current + direction];
        if (!target) return true; // Edge reached: keep the existing selection.
        const previousAnchor = this.state.findNode(this.selectionAnchorId);
        const anchor = previousAnchor?.parentId === focus.parentId &&
          siblings.some(n => n.id === previousAnchor.id) ? previousAnchor : focus;
        const anchorIndex = siblings.findIndex(n => n.id === anchor.id);
        const targetIndex = current + direction;
        this.state.selectedNodeIds = siblings.slice(
          Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1
        ).map(n => n.id);
        this.state.selectedNodeId = target.id;
        this.selectionAnchorId = anchor.id;
        this.state.selectedImageId = null;
        this.state.selectedRelationshipId = null;
        this.updateStatus();
        this.updateImageControls();
        this.requestRender();
        return true;
      }
      selectAllBranches() {
        const ids = this.state.getAllNodes().filter(n=>n.id!==this.state.root.id).map(n=>n.id);
        if (!ids.length) {this.showToast('Non ci sono rami selezionabili','SELEZIONE');return;}
        this.state.selectedNodeIds = ids;
        this.state.selectedNodeId = ids[ids.length-1];
        this.selectionAnchorId = ids[0];
        this.state.selectedImageId = null;
        this.updateImageControls();this.updateStatus();this.requestRender();
        this.showToast(ids.length+' rami selezionati · Usa Copia o Elimina nel menu','SELEZIONE');
      }
      clearSelection() {
        this.state.selectedNodeIds=[];this.state.selectedNodeId=this.state.root.id;
        this.state.selectedImageId=null;this.state.selectedRelationshipId=null;
        this.selectionAnchorId=null;this.updateImageControls();this.updateStatus();this.requestRender();
      }
      selectedTopLevelNodes() {
        const ids=new Set(this.state.selectedNodeIds||[]);
        if(!ids.size && this.state.selectedNodeId)ids.add(this.state.selectedNodeId);
        ids.delete(this.state.root.id);
        return this.state.getAllNodes().filter(n=>ids.has(n.id)&&!this.hasSelectedAncestor(n,ids));
      }
      hasSelectedAncestor(node, ids) {
        let parent=node.parentId;
        while(parent){if(ids.has(parent))return true;parent=this.state.findNode(parent)?.parentId;}
        return false;
      }
      collectDescendantIds(nodes) {
        const ids=new Set(),pending=[...(nodes||[])];
        while(pending.length){
          const node=pending.pop();
          if(!node||ids.has(node.id))continue;
          ids.add(node.id);
          for(const child of node.children||[])pending.push(child);
        }
        return ids;
      }
      buildClipboardPayload() {
        const img=this.state.findImage(this.state.selectedImageId);
        if(img) return {kind:'image',image:MindMapStateMachine.cloneImages([img])[0]};
        const nodes=this.selectedTopLevelNodes();
        if(!nodes.length)return null;
        const ids=this.collectDescendantIds(nodes);
        return {kind:'nodes',sourceRootId:this.state.root.id,nodes:nodes.map(n=>MindMapStateMachine.cloneTree(n)),
          images:MindMapStateMachine.cloneImages(this.state.images.filter(im=>im.mode==='attached' && ids.has(im.attachedNodeId))),
          relationships:MindMapStateMachine.cloneRelationships(this.state.relationships.filter(r=>ids.has(r.fromId)&&ids.has(r.toId)))};
      }
      copySelection(withoutToast=false) {
        const data=this.buildClipboardPayload();
        if(!data){if(!withoutToast)this.showToast('Seleziona un ramo o una immagine','APPUNTI');return null;}
        this.internalClipboard=data;
        // In parallel, publish portable plain text for pasting into other applications.
        const plain=data.kind==='nodes'?data.nodes.map(n=>n.text).join('\n'):'Immagine NeuroMap';
        this._clipboardPlain=plain;
        if(navigator.clipboard?.writeText)navigator.clipboard.writeText(plain).catch(()=>{});
        if(!withoutToast)this.showToast(data.kind==='image'?'Immagine copiata':data.nodes.length+' rami copiati','COPIA');
        return data;
      }
      cutSelection() {
        const data=this.copySelection(true);if(!data)return;
        this.deleteSelected();
        this.showToast(data.kind==='image'?'Immagine tagliata':data.nodes.length+' rami tagliati','TAGLIA');
      }
      pasteSelection(data=this.internalClipboard) {
        if(!data)return this.showToast('Prima copia o taglia un ramo o una immagine','APPUNTI');
        this.closeEditor(true);
        if(data.kind==='image') {
          const img=MindMapStateMachine.cloneImages([data.image])[0];
          const target=this.state.findNode(this.state.selectedNodeId)||this.state.root;
          const m=this.layout.getLayout(target.id);
          const position=img.mode==='attached' && m ? {x:m.x,y:m.y-85}:
            {x:(img.worldPos?.x||0)+30,y:(img.worldPos?.y||0)+30};
          this.state.addImageItem({...img,id:this.state.generateId('img'),mode:'free',attachedNodeId:null,
            worldPos:position});
          this.selectImage(this.state.selectedImageId);
          this.markChanged();this.showToast('Immagine incollata: ora puoi spostarla','INCOLLA');return;
        }
        if(data.kind!=='nodes'||!Array.isArray(data.nodes)||!data.nodes.length)return;
        const selected=this.state.findNode(this.state.selectedNodeId)||this.state.root;
        // Match desktop: paste into the selected node unless sibling paste is requested.
        const siblingPaste=Boolean(this._nm612PasteSibling);
        const parent=siblingPaste&&selected.parentId?this.state.findNode(selected.parentId):selected;
        if(!parent)return;
        if(this.state.getNodeCountIncludingCollapsed() + data.nodes.reduce((k,n)=>{const count=x=>1+(x.children||[]).reduce((q,c)=>q+count(c),0);return k+count(n);},0)>3500){
          this.showToast('Limite di 3500 nodi raggiunto','ERRORE');return;
        }
        this.state.pushHistory();
        const idMap=new Map(),created=[];
        const clone=(old,parentId,side)=>{
          const id=this.state.generateId();idMap.set(old.id,id);
          const n=MindMapStateMachine.cloneTree(old);n.id=id;n.parentId=parentId;
          n.side=side;n.children=(old.children||[]).map(c=>clone(c,id,side));
          if(n.isSummary)n.summaryTargetIds=(n.summaryTargetIds||[]).map(x=>idMap.get(x)||x);
          return n;
        };
        const insertAfter=parent.children.findIndex(n=>n.id===selected.id);
        const at=siblingPaste && insertAfter>=0 ? insertAfter+1 : parent.children.length;
        for(const src of data.nodes){const side=parent.side==='root'?(src.side==='left'?'left':'right'):parent.side;
          created.push(clone(src,parent.id,side));}
        // Repair summary references now that all IDs are available.
        const fix=n=>{
          if(n.isSummary)n.summaryTargetIds=(n.summaryTargetIds||[]).map(x=>idMap.get(x)).filter(Boolean);
          if(Array.isArray(n.taskDependsOn))
            n.taskDependsOn=n.taskDependsOn.map(x=>idMap.get(x)).filter(Boolean).slice(0,12);
          if(typeof NeuroMapWikiLinks!=='undefined'&&data.sourceRootId)
            n.notes=NeuroMapWikiLinks.remapInternal(n.notes,data.sourceRootId,this.state.root.id,idMap);
          n.children.forEach(fix);
        };created.forEach(fix);
        parent.children.splice(at,0,...created);this.state.normalizeChildrenOrder(parent);
        for(const image of data.images||[]){const attachedNodeId=idMap.get(image.attachedNodeId);
          if(attachedNodeId)this.state.images.push({...image,id:this.state.generateId('img'),attachedNodeId});}
        for(const rel of data.relationships||[]){const fromId=idMap.get(rel.fromId),toId=idMap.get(rel.toId);
          if(fromId&&toId)this.state.relationships.push({...rel,id:this.state.generateId('rel'),fromId,toId});}
        this.state.selectedNodeIds=created.map(n=>n.id);
        this.state.selectedNodeId=created[created.length-1].id;
        this.selectionAnchorId=created[0].id;
        this.markChanged();this.showToast(created.length+' rami incollati','INCOLLA');
      }
      duplicateSelection() {
        const data=this.buildClipboardPayload();
        if(!data)return this.showToast('Seleziona dei rami da duplicare','APPUNTI');
        this.pasteSelection(data);
      }
