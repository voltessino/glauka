      addSummary() {
        const selection=this.state.selectedNodeIds;
        const summary=this.state.addSummaryForNodes(selection);
        if(summary){this.markChanged();this.showToast('Riepilogo aggiunto','RIEPILOGO');}
        else this.showToast('Seleziona almeno due nodi fratelli con Shift+Clic','SUGGERIMENTO');
      }
      toggleImageMode() {
        const img=this.state.findImage(this.state.selectedImageId);if(!img)return;
        const pos=this.renderer.resolveImageWorldRect(img);
        if(img.mode==='attached'){
          this.state.pushHistory();
          img.mode='free';img.worldPos={x:pos.cx,y:pos.cy};img.attachedNodeId=null;
          this.markChanged();
          return;
        }
        const picked=this.state.selectedNodeIds?.[0]||this.state.selectedNodeId;
        let target=picked?this.state.findNode(picked):null;
        if(!target){
          let bestId=null,bestD=Infinity;
          for(const [id,m] of this.layout?.nodeLayoutMap||[]){
            const dx=m.x-pos.cx,dy=m.y-pos.cy,d=dx*dx+dy*dy;
            if(d<bestD){bestD=d;bestId=id;}
          }
          target=bestId?this.state.findNode(bestId):null;
        }
        if(!target){this.showToast('Seleziona un ramo a cui agganciare l’immagine','IMMAGINE');return;}
        const box=this.layout.getLayout(target.id);
        const nodeH=Number(box?.height)>0?Number(box.height):36;
        const imgH=Number(img.height)>0?Number(img.height):100;
        this.state.pushHistory();
        img.mode='attached';img.attachedNodeId=target.id;
        img.offset={dx:0,dy:-(nodeH/2+imgH/2+16)};
        this.markChanged();
        this.showToast('Immagine agganciata a: '+(target.text||''),'IMMAGINE');
      }
      selectImage(id) {
        this.state.selectedImageId=id;
        this.state.selectedNodeIds=[];
        this.state.selectedRelationshipId=null;
        this.updateImageControls();this.updateStatus();this.requestRender();
      }
      createFloatingTopicAt(worldX,worldY) {
        // Shared by canvas double-click and the right-click canvas menu.
        // One undo snapshot and exactly one new logical node per action.
        const x=Number(worldX),y=Number(worldY);
        if(!Number.isFinite(x)||!Number.isFinite(y))return null;
        this.state.pushHistory();
        const node={id:this.state.generateId(),text:'Argomento libero',
          parentId:this.state.root.id,side:'right',collapsed:false,
          customOrder:this.state.root.children.length,colorIndex:0,color:'#38bdf8',
          isFloating:true,floatingPosition:{x,y},children:[]};
        this.state.root.children.push(node);
        this.state.selectedNodeId=node.id;this.state.selectedNodeIds=[node.id];
        this.markChanged();this.editSelected();
        return node;
      }
