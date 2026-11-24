      addSummary() {
        const selection=this.state.selectedNodeIds;
        const summary=this.state.addSummaryForNodes(selection);
        if(summary){this.markChanged();this.showToast('Riepilogo aggiunto','RIEPILOGO');}
        else this.showToast(globalThis.GlaukaTouchGuidance?.text('summary')??'Seleziona almeno due nodi fratelli.','SUGGERIMENTO');
      }
      toggleImageMode() {
        const img=this.state.findImage(this.state.selectedImageId);if(!img)return;
        const pos=this.renderer.resolveImageWorldRect(img);
        this.state.pushHistory();
        if(img.mode==='attached'){img.mode='free';img.worldPos={x:pos.cx,y:pos.cy};img.attachedNodeId=null;}
        else {const target=this.state.findNode(this.state.selectedNodeId)||this.state.root;
          const anchor=this.layout.getLayout(target.id);
          img.mode='attached';img.attachedNodeId=target.id;
          img.offset={dx:pos.cx-(anchor?.x||0),dy:pos.cy-(anchor?.y||0)};}
        this.markChanged();
      }
      selectImage(id) {
        this.state.selectedImageId=id;
        this.state.selectedNodeIds=[];
        this.state.selectedRelationshipId=null;
        this.updateImageControls();this.updateStatus();this.requestRender();
      }
