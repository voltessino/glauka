      positionEditor() {
        if (!this.editorNodeId) return;
        const m=this.layout.getLayout(this.editorNodeId);
        const node=this.state.findNode(this.editorNodeId);
        if(!m||!node){this.closeEditor(false);return;}
        const field=document.getElementById('inline-editor-input');
        const container=document.getElementById('inline-editor-container');
        if(!field||!container)return;
        const zoom=this.renderer.camera.zoom;
        const font=Math.max(window.GlaukaMobile?16:1,(m.fontSize||16)*zoom);
        const lineHeight=(m.lineHeight||Math.ceil((m.fontSize||16)*1.24))*zoom;
        const vv=window.visualViewport;
        const viewportWidth=vv?.width||innerWidth;
        const viewportHeight=vv?.height||innerHeight;
        const left=vv?.offsetLeft||0,top=vv?.offsetTop||0;
        const art=window.NeuroMapCreativeCore?.objectGeometry(node,m);
        const labelY=art?art.labelY+art.labelHeight/2:m.y-2;
        const icon=node.illustration?.svg?(m.iconSize||31)+(m.iconGap||9):0;
        const textVal=String(field.value??node.text??'');
        // Hug the node box by default; widen smoothly only when the user types long content.
        const nodeW=Math.max(art?.labelWidth||0,m.width-icon,(m.textWidth||32)+28);
        const longDraft=textVal.length>28||textVal.includes('\n')||(m.lines?.length||1)>1;
        const baseW=longDraft?Math.max(nodeW,240/Math.max(zoom,0.4)):nodeW;
        const rawWidth=Math.max(24,baseW*zoom);
        const width=Math.min(rawWidth,Math.max(60,viewportWidth-24));
        const setImp=(prop,val)=>{if(field.style.getPropertyValue?.(prop)!==val)field.style.setProperty(prop,val,'important');};
        setImp('font-family',window.GlaukaNodeText?.cssFamily(node)||'Inter, sans-serif');
        setImp('font-size',font+'px');
        setImp('font-weight',String(m.fontWeight||node.fontWeight||400));
        setImp('font-style',node.fontItalic?'italic':'normal');
        setImp('text-decoration',[node.fontUnderline?'underline':'',node.fontStrike?'line-through':''].filter(Boolean).join(' ')||'none');
        setImp('text-align',node.labelAlign||'center');
        setImp('line-height',lineHeight+'px');
        setImp('white-space','pre-wrap');
        setImp('overflow-wrap','break-word');
        setImp('overflow-x','hidden');
        setImp('overflow-y','auto');
        const light=window.NeuroMapGraphics?.light?.();
        setImp('color',window.GlaukaNodeText?.color(node)||((art||node.side==='root')?'#ffffff':light?'#152139':'#f1f5f9'));
        const wPx=Math.ceil(width)+'px';
        if(field.style.width!==wPx)field.style.width=wPx;
        const labelHeight=(art?.labelHeight||m.height-4)*zoom;
        const maxHeight=Math.max(48,Math.min(viewportHeight*0.72,viewportHeight-110));
        setImp('max-height',maxHeight+'px');
        field.style.height='1px';
        const contentHeight=field.scrollHeight||0;
        const singleRow=!textVal.includes('\n')&&(m.lines?.length||1)<=1&&contentHeight<=lineHeight+10;
        const padY=singleRow?Math.max(2,Math.floor((labelHeight-lineHeight)/2)):2;
        setImp('padding',`${padY}px 4px`);
        if(singleRow){
          const height=Math.min(Math.max(labelHeight,lineHeight+padY*2),maxHeight);
          const hPx=Math.ceil(height)+'px';
          if(field.style.height!==hPx)field.style.height=hPx;
          var editorH=height;
        }else{
          field.style.height='1px';
          const grown=Math.max(labelHeight,field.scrollHeight||0,textVal?lineHeight+8:32);
          const height=Math.min(grown,maxHeight);
          const hPx=Math.ceil(height)+'px';
          if(field.style.height!==hPx)field.style.height=hPx;
          var editorH=height;
        }
        const height=editorH;
        let pos=this.renderer.worldToScreen(m.x+icon/2,labelY);
        // Keep the actual node visible above the keyboard, moving the camera
        // rather than opening a second editor somewhere else on screen.
        const minY=top+70+height/2,maxY=top+viewportHeight-30-height/2;
        const minX=left+12+width/2,maxX=left+viewportWidth-12-width/2;
        const dx=Math.max(minX,Math.min(maxX,pos.x))-pos.x;
        const dy=Math.max(minY,Math.min(Math.max(minY,maxY),pos.y))-pos.y;
        // Default: editing never changes the camera. Keep the textbox inside
        // the visible area instead; users can opt in under Interaction.
        const follow=window.GlaukaMobile||(()=>{try{return localStorage.getItem('glauka.edit.autofocus.v1')==='1'}catch{return false}})();
        if(Math.abs(dx)>.5||Math.abs(dy)>.5){
          if(follow){
            this.renderer.camera.x+=dx;this.renderer.camera.y+=dy;
            pos=this.renderer.worldToScreen(m.x+icon/2,labelY);this.requestRender();
          }else pos={x:pos.x+dx,y:pos.y+dy};
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
        const editAutoZoom=window.GlaukaMobile||(()=>{try{return localStorage.getItem('glauka.edit.autofocus.v1')==='1'}catch{return false}})();
        if(metrics&&editAutoZoom){
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
      scheduleInlineRelayout() {
        this.positionEditor();
        clearTimeout(this._inlineRelayoutTimer);
        this._inlineRelayoutTimer=setTimeout(()=>{
          this._inlineRelayoutTimer=null;
          if(this.editorNodeId)this.recalculateAndRender();
        },90);
      }
      closeEditor(commit) {
        clearTimeout(this._inlineRelayoutTimer);
        this._inlineRelayoutTimer=null;
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
