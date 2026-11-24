      addChild() {
        this.closeEditor(true);
        const node = this.state.addChildNode(this.state.selectedNodeId || this.state.root.id, this.layout);
        if (node) { this.markChanged(); this.editSelected(); }
      }
      addSibling(reverse = false) {
        this.closeEditor(true);
        const node = this.state.addSiblingNode(this.state.selectedNodeId || this.state.root.id, this.layout, reverse);
        if (node) { this.markChanged(); this.editSelected(); }
      }
      deleteSelected() {
        this.closeEditor(false);
        if(this.state.selectedImageId){if(this.state.deleteImage(this.state.selectedImageId)){
          this.state.selectedImageId=null;this.updateImageControls();this.markChanged();}return;}
        const nodes=this.selectedTopLevelNodes();if(!nodes.length)return;
        const ids=this.collectDescendantIds(nodes);
        this.state.pushHistory();
        // Deleting a multi-selection must be safe on deep imported trees.
        const pending=[this.state.root],seen=new Set();
        while(pending.length){
          const parent=pending.pop();
          if(!parent||seen.has(parent))continue;
          seen.add(parent);
          parent.children=parent.children.filter(n=>!ids.has(n.id));
          this.state.normalizeChildrenOrder(parent);
          for(let i=parent.children.length-1;i>=0;i--)pending.push(parent.children[i]);
        }
        const remaining=new Set(this.state.getAllNodesIncludingCollapsed().map(n=>n.id));
        this.state.images=this.state.images.filter(im=>im.mode==='free'||remaining.has(im.attachedNodeId));
        this.state.relationships=this.state.relationships.filter(r=>remaining.has(r.fromId)&&remaining.has(r.toId));
        const summaryPending=[this.state.root],summarySeen=new Set();
        while(summaryPending.length){
          const node=summaryPending.pop();
          if(!node||summarySeen.has(node))continue;
          summarySeen.add(node);
          node.children=node.children.filter(c=>!c.isSummary||(
            c.summaryTargetIds=(c.summaryTargetIds||[]).filter(id=>remaining.has(id))).length);
          for(let i=node.children.length-1;i>=0;i--)summaryPending.push(node.children[i]);
        }
        this.state.selectedNodeId=this.state.findNode(nodes[0].parentId)?.id||this.state.root.id;
        this.state.selectedNodeIds=[this.state.selectedNodeId];this.selectionAnchorId=this.state.selectedNodeId;
        this.markChanged();
      }
      undo() { this.closeEditor(true); if (this.state.undo()) this.markChanged(); }
      redo() { this.closeEditor(true); if (this.state.redo()) this.markChanged(); }
      setWeight(w) { if (this.state.updateNodeFontWeight(this.state.selectedNodeId, w)) this.markChanged(); }
      saveToFile(as = false) { this.closeEditor(true); this.io.saveProjectFile(as); }
      // Build tree from XMind, OPML, JSON and Markdown preserving child order and attachments.
