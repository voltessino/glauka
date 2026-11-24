      positionEditor() {
        if (!this.editorNodeId) return;
        const m=this.layout.getLayout(this.editorNodeId);
        const node=this.state.findNode(this.editorNodeId);
        if(!m||!node){this.closeEditor(false);return;}
        const field=document.getElementById('inline-editor-input');
        const container=document.getElementById('inline-editor-container');
        if(!field||!container)return;
        const zoom=this.renderer.camera.zoom;
        const font=Math.max(window.GlaukaMobile?16:12,(m.fontSize||16)*zoom);
        const lineHeight=(m.lineHeight||Math.ceil((m.fontSize||16)*1.24))*zoom;
        const vv=window.visualViewport;
        const viewportWidth=vv?.width||innerWidth;
        const viewportHeight=vv?.height||innerHeight;
        const left=vv?.offsetLeft||0,top=vv?.offsetTop||0;
        const art=window.NeuroMapCreativeCore?.objectGeometry(node,m);
        const labelY=art?art.labelY+art.labelHeight/2:m.y-2;
        const icon=node.illustration?.svg?(m.iconSize||31)+(m.iconGap||9):0;
        // Use the node interior, not an independently growing floating textbox.
        const rawWidth=Math.max(20,(art?.labelWidth||m.width-icon-12)*zoom);
        const width=Math.min(rawWidth,Math.max(60,viewportWidth-24));
        field.style.setProperty('font-family',window.GlaukaNodeText?.cssFamily(node)||'Inter, sans-serif','important');
        field.style.setProperty('font-size',font+'px','important');
        field.style.setProperty('font-weight',String(m.fontWeight||node.fontWeight||400),'important');
        field.style.setProperty('font-style',node.fontItalic?'italic':'normal','important');
        field.style.setProperty('text-decoration',[node.fontUnderline?'underline':'',node.fontStrike?'line-through':''].filter(Boolean).join(' ')||'none','important');
        field.style.setProperty('text-align',node.labelAlign||'center','important');
        field.style.setProperty('line-height',lineHeight+'px','important');
        const light=window.NeuroMapGraphics?.light?.();
        field.style.setProperty('color',window.GlaukaNodeText?.color(node)||((art||node.side==='root')?'#ffffff':light?'#152139':'#f1f5f9'),'important');
        field.style.width=width+'px';
        const labelHeight=(art?.labelHeight||m.height-4)*zoom;
        const height=Math.min(labelHeight,Math.max(lineHeight+8,(m.lines?.length||1)*lineHeight+8),Math.max(24,viewportHeight-110));
        field.style.height=height+'px';
        let pos=this.renderer.worldToScreen(m.x+icon/2,labelY);
        // Keep the actual node visible above the keyboard, moving the camera
        // rather than opening a second editor somewhere else on screen.
        const minY=top+70+height/2,maxY=top+viewportHeight-30-height/2;
        const minX=left+12+width/2,maxX=left+viewportWidth-12-width/2;
        const dx=Math.max(minX,Math.min(maxX,pos.x))-pos.x;
        const dy=Math.max(minY,Math.min(Math.max(minY,maxY),pos.y))-pos.y;
        if(Math.abs(dx)>.5||Math.abs(dy)>.5){
          this.renderer.camera.x+=dx;this.renderer.camera.y+=dy;
          pos=this.renderer.worldToScreen(m.x+icon/2,labelY);this.requestRender();
        }
        container.style.left=(pos.x-width/2)+'px';
        container.style.top=(pos.y-height/2)+'px';
      }
      editSelected(initialText = null) {
        const node = this.state.findNode(this.state.selectedNodeId) || this.state.root;
        if (!node) return;
        this.closeEditor(true);
        this.editorNodeId = node.id;
        this.renderer.inlineEditingNodeId=node.id;
        this.renderer.inlineEditingContext=this.renderer.ctx;
        const metrics=this.layout.getLayout(node.id);
        if(metrics){
          const camera=this.renderer.camera;
          const readableZoom=Math.max(camera.zoom,(window.GlaukaMobile?16:14)/(metrics.fontSize||16));
          if(readableZoom>camera.zoom){
            const anchor=this.renderer.worldToScreen(metrics.x,metrics.y);
            camera.zoom=readableZoom;camera.x=anchor.x-metrics.x*readableZoom;
            camera.y=anchor.y-metrics.y*readableZoom;
          }
        }
        this.requestRender();
        const field = document.getElementById('inline-editor-input');
        field.value = initialText === null ? node.text : initialText;
        document.getElementById('inline-editor-container').classList.remove('hidden');
        this.layout.editingLabel={id:node.id,text:field.value};
        this.recalculateAndRender();
        field.focus({ preventScroll: true });
        if (initialText === null) field.select();
      }
      closeEditor(commit) {
        if (!this.editorNodeId) return;
        const id = this.editorNodeId;
        const field = document.getElementById('inline-editor-input');
        const text = field.value.trim();
        this.editorNodeId = null;
        this.layout.editingLabel=null;
        this.renderer.inlineEditingNodeId=null;
        this.renderer.inlineEditingContext=null;
        this.requestRender();
        document.getElementById('inline-editor-container').classList.add('hidden');
        if (document.activeElement === field) field.blur();
        if (commit && text && this.state.updateNodeText(id, text)) {
          this.markChanged(); this.renderTabBar();
        } else this.recalculateAndRender();
      }
