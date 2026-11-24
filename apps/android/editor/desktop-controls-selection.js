    NeuroMapApp.prototype.v6SelectedNodes=function(){
      const selected=this.state.selectedNodeIds?.length?this.state.selectedNodeIds:[this.state.selectedNodeId];
      return NeuroMapCore.findNodesById(this.state.root,new Set(selected)).filter(Boolean);
    };
    NeuroMapApp.prototype.v6InvertSelection=function(){
      const nodes=this.v6SelectedNodes().filter(n=>(n.children||[]).length>1);
      if(!nodes.length){this.showToast('Nessun ramo selezionato con almeno due figli','ORDINE');return;}
      this.state.pushHistory();for(const node of nodes){node.children.reverse();this.state.normalizeChildrenOrder(node);}
      this.markChanged();this.showToast('Ordine invertito su '+nodes.length+' rami · Tocca Annulla per ripristinare','ORDINE');
    };
    NeuroMapApp.prototype.v6WeightSelection=function(weight){
      const nodes=this.v6SelectedNodes().filter(n=>n.fontWeight!==weight);
      if(!nodes.length)return;
      this.state.pushHistory();for(const node of nodes)node.fontWeight=weight;
      this.markChanged();
    };
    NeuroMapApp.prototype.v6ColorSelection=function(color){
      const nodes=this.v6SelectedNodes();if(!nodes.length)return;
      if(nodes.length===1){if(this.state.updateNodeColorWithPropagation(nodes[0].id,color))this.markChanged();return;}
      this.state.pushHistory();for(const node of nodes)node.color=color;
      this.markChanged();this.showToast('Colore applicato a '+nodes.length+' nodi','STILE');
    };
    NeuroMapApp.prototype.v6BoundarySelection=function(){
      const nodes=this.v6SelectedNodes();if(!nodes.length)return;
      const enabled=nodes.some(n=>!n.boundary?.enabled);
      this.state.pushHistory();for(const node of nodes)node.boundary={...node.boundary,enabled,title:node.boundary?.title||'',color:node.boundary?.color||node.color||'#a855f7'};
      this.markChanged();
    };
    NeuroMapApp.prototype.v6CollapseSelection=function(){
      const nodes=this.v6SelectedNodes().filter(n=>n.side!=='root'&&n.children?.length);
      if(!nodes.length)return;
      const collapsed=nodes.some(n=>!n.collapsed);
      this.state.pushHistory();for(const n of nodes)n.collapsed=collapsed;
      this.markChanged();
    };
    NeuroMapApp.prototype.v6PromoteSelection=function(){
      const chosen=this.v6SelectedNodes().filter(n=>n.side!=='root'&&n.parentId!==this.state.root.id);
      if(!chosen.length)return;
      const chosenIds=new Set(chosen.map(n=>n.id));
      const top=chosen.filter(n=>{let p=n.parentId;while(p){if(chosenIds.has(p))return false;p=this.state.findNode(p)?.parentId;}return true;});
      if(!top.length)return;
      this.state.pushHistory();const root=this.state.root;
      for(const n of top){
        const p=this.state.findNode(n.parentId);if(!p)continue;
        p.children=p.children.filter(c=>c.id!==n.id);this.state.normalizeChildrenOrder(p);
        n.parentId=root.id;n.manualOffset=null;
        const side=n.side==='left'?'left':'right';
        const update=x=>{x.side=side;for(const c of x.children||[])update(c)};update(n);
        root.children.push(n);
      }
      this.state.normalizeChildrenOrder(root);this.markChanged();
      this.showToast(top.length+' rami promossi al primo livello','RAMI');
    };
    NeuroMapApp.prototype.v5Promote=function(){this.v6PromoteSelection();};
    NeuroMapApp.prototype.selectAllBranches=function(){
      const ids=[];const walk=(n)=>{for(const c of n.children||[]){ids.push(c.id);walk(c);}};walk(this.state.root);
      if(!ids.length){this.showToast('Non ci sono rami selezionabili','SELEZIONE');return;}
      this.state.selectedNodeIds=ids;this.state.selectedNodeId=ids[ids.length-1];this.selectionAnchorId=ids[0];
      this.state.selectedImageId=null;this.updateImageControls();this.updateStatus();this.requestRender();
      this.showToast(ids.length+' rami selezionati, inclusi quelli compressi','SELEZIONE');
    };
