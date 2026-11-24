      showContextMenu(clientX,clientY,hit) {
        const menu=document.getElementById('context-menu');
        if(hit?.type==='node'&&!this.state.selectedNodeIds.includes(hit.item.id))this.selectNode(hit.item.id);
        if(hit?.type==='image'||hit?.type==='image-handle')this.selectImage(hit.item.id);
        const isImage=hit?.type==='image'||hit?.type==='image-handle';
        document.getElementById('ctx-group-node').classList.toggle('hidden',isImage);
        document.getElementById('ctx-group-image').classList.toggle('hidden',!isImage);
        document.getElementById('ctx-node-title').textContent=isImage?'Immagine':this.state.findNode(this.state.selectedNodeId)?.text||'Mappa';
        if(isImage){const img=this.state.findImage(this.state.selectedImageId);
          document.getElementById('ctx-img-toggle-mode-label').textContent=img?.mode==='attached'?'🔓 Sposta come ramo indipendente':'⚓ Aggancia al nodo';
          document.getElementById('ctx-img-toggle-zlayer-label').textContent=img?.zLayer==='back'?'⬆️ Porta sopra i rami':'⬇️ Manda sotto i rami';}
        menu.classList.remove('hidden');
        menu.style.left=Math.min(clientX,innerWidth-265)+'px';
        menu.style.top=Math.max(8,Math.min(clientY,innerHeight-440))+'px';
      }
      hideMenus() {
        document.querySelectorAll('.dropdown-panel').forEach(x=>x.classList.add('hidden'));
        document.getElementById('context-menu').classList.add('hidden');
      }
      openFind() {
        this.closeEditor(true);
        document.getElementById('find-overlay').classList.remove('hidden');
        const q=document.getElementById('find-query');q.value='';q.focus();this.updateFindResults();
      }
      closeFind() {document.getElementById('find-overlay').classList.add('hidden');}
      updateFindResults() {
        const q=document.getElementById('find-query').value.toLocaleLowerCase().trim();
        const host=document.getElementById('find-results');host.replaceChildren();
        if(!q) return;
        const nodes=[];
        const walk=n=>{nodes.push(n);(n.children||[]).forEach(walk);};walk(this.state.root);
        for(const node of nodes.filter(n=>n.text.toLocaleLowerCase().includes(q)).slice(0,25)) {
          const b=document.createElement('button');b.className='find-result';b.textContent=node.text;
          b.onclick=()=>{
            // Reveal any collapsed ancestors so the target appears in the layout.
            let parent=node;
            while(parent?.parentId){parent=this.state.findNode(parent.parentId);if(parent)parent.collapsed=false;}
            this.selectNode(node.id);this.recalculateAndRender();
            const m=this.layout.getLayout(node.id);
            if(m){this.renderer.camera.x=innerWidth/2-m.x*this.renderer.camera.zoom;
              this.renderer.camera.y=innerHeight/2-m.y*this.renderer.camera.zoom;this.requestRender();}
            this.closeFind();
          };
          host.appendChild(b);
        }
        if (!host.childElementCount) {
          const p=document.createElement('div');p.textContent='Nessun nodo trovato';p.className='find-hint';host.appendChild(p);
        }
      }
