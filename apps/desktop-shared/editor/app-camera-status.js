      requestRender() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        requestAnimationFrame(() => { this.renderQueued = false; this.renderer.render(); });
      }
      recalculateAndRender(changed = false, { layout = true } = {}) {
        // Only explicit paint-only edits may reuse geometry; all other callers recompute.
        // Continuation views copy node styles: rebuild them together with geometry.
        if (layout || !this.layout.nodeLayoutMap.size || this.layout.presentationRoot) {
          this.layout.typographyPreset=this.state.typographyPreset||'uniform';
          this.layout.typographyScale=Number(this.state.typographyScale)||1;
          this.layout.defaultLabelWrapChars=Number(this.state.defaultLabelWrapChars)||18;
          this.layout.branchStyle=this.state.branchStyle||'neon';
          this.layout.balanceBias=this.state.balanceBias??50;
          this.layout.compactness=this.state.compactness??100;
          this.layout.branchGapX=nm68ClampGap(this.state.branchGapX);
          this.layout.rootBranchGap=nmClampRootBranchGap(this.state.rootBranchGap);
          this.splitMetrics = this.layout.computeLayout(this.state.root, this.state.thresholdY, this.state.images);
        }
        this.updateStatus(); this.positionEditor(); this.updateImageControls(); this.requestRender();
        if (changed) { this.state.isDirty = true; this.scheduleSave(); }
      }
      markChanged(options) { this._desktopUserEdited = true; this._nmHomePlaceholder=false; this.recalculateAndRender(true, options); }
      updateStatus() {
        const node = this.state.findNode(this.state.selectedNodeId) || this.state.root;
        const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
        const selectionCount = this.state.selectedNodeIds?.length || 0;
        put('status-selected-node', this.state.selectedImageId ? 'Immagine selezionata' : selectionCount > 1 ? selectionCount + ' nodi selezionati' : (node?.text || 'Mappa'));
        put('inspector-node-badge', node?.text || 'Mappa');
        put('status-selected-side', node?.side === 'root' ? 'ROOT' : String(node?.side || '').toUpperCase());
        put('undo-count', this.state.undoStack.length);
        put('redo-count', this.state.redoStack.length);
        put('zoom-percentage', Math.round(this.renderer.camera.zoom * 100) + '%');
        const bias=Math.max(0,Math.min(100,Number(this.state.balanceBias??50)));
        const caption=bias===50?'Auto 50%':bias<50?`← ${50-bias}%`:`${bias-50}% →`;
        put('threshold-readout',caption);put('menu-threshold-val',caption);
        put('hud-balance-mode', 'DES '+(this.splitMetrics?.rightCount??0)+' / SIN '+(this.splitMetrics?.leftCount??0));
        put('count-right','('+(this.splitMetrics?.rightCount??0)+')');
        put('count-left','('+(this.splitMetrics?.leftCount??0)+')');
        const hr=this.splitMetrics?.H_R||0,hl=this.splitMetrics?.H_L||0;
        put('val-hr',hr);put('val-hl',hl);
        const maxH=Math.max(hr,hl,1);
        for(const [id,val] of [['bar-hr',hr],['bar-hl',hl]]){
          const el=document.getElementById(id);if(el)el.style.width=Math.round(100*val/maxH)+'%';
        }
        for(const id of ['threshold-slider','menu-threshold-slider']){
          const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=String(bias);
        }
        const compact=this.state.compactness??100;
        put('nm67-compact-readout',compact+'%');
        const compactEl=document.getElementById('nm67-compact-slider');
        if(compactEl&&document.activeElement!==compactEl)compactEl.value=String(compact);
        const gapSlider=document.getElementById('nm68-branch-gap');
        if(gapSlider && document.activeElement!==gapSlider)gapSlider.value=String(nm68ClampGap(this.state.branchGapX));
        put('nm68-gap-value',nm68ClampGap(this.state.branchGapX)+' px');
        const typNode=this.state.findNode(this.state.selectedNodeId)||this.state.root;
        const aligned=['left','center','right'].includes(typNode?.labelAlign)?typNode.labelAlign:'center';
        document.querySelectorAll('[data-nm68-align]').forEach(b=>b.classList.toggle('active',b.dataset.nm68Align===aligned));
        const indentControl=document.getElementById('nm68-text-indent');
        if(indentControl && document.activeElement!==indentControl)indentControl.value=String(Math.max(0,Math.min(45,Number(typNode?.labelIndent)||0)));
        put('nm68-indent-value',Math.max(0,Math.min(45,Number(typNode?.labelIndent)||0))+' px');
        const font = document.getElementById('inspector-fontsize-slider');
        if (font && document.activeElement !== font) font.value = node?.fontSize || this.layout.getNodeTypography(node || this.state.root).fontSize;
        put('inspector-fontsize-val', font?.value + 'px');
        const color = document.getElementById('inspector-color-picker');
        if (color && document.activeElement !== color && /^#[0-9a-f]{6}$/i.test(node?.color || '')) color.value = node.color;
        const selWeight = node?.fontWeight ?? 400;
        document.getElementById('btn-weight-normal')?.classList.toggle('active', selWeight === 400);
        document.getElementById('btn-weight-bold')?.classList.toggle('active', selWeight !== 400);
        if (this.state.root) { const t = this.tabs.find(t => t.id === this.activeTabId); if (t) t.title = this.state.root.text; }
      }
      showToast(message, label = 'INFO') {
        const el = document.getElementById('toast-notification');
        document.getElementById('toast-badge').textContent = label;
        document.getElementById('toast-text').textContent = String(message);
        el.classList.remove('hidden'); el.style.opacity = '1';
        clearTimeout(this.toastTimer);clearTimeout(this.toastFadeTimer);
        this.toastTimer = setTimeout(() => { el.style.opacity = '0'; this.toastFadeTimer=setTimeout(() => el.classList.add('hidden'), 230); }, 3300);
      }
      fitToScreen() {
        const box = this.layout.computeBoundingBox(this.state.images);
        const w = innerWidth, h = innerHeight;
        const availableW = Math.max(260, w - (w > 850 ? 190 : 45));
        const topInset = Math.max(84, document.querySelector('.top-chrome')?.getBoundingClientRect().bottom || 84) + 12;
        const availableH = Math.max(80, h - topInset - 76);
        const fullZoom=Math.max(0.12,Math.min(1.5,availableW/Math.max(1,box.width+60),availableH/Math.max(1,box.height+60)));
        // 6.3: restore the original fit-to-map, without the forced 80% zoom.
        // A large mind map should not be cropped on every open; users can zoom
        // explicitly with Ctrl+wheel, or switch to a different layout style.
        const zoom=fullZoom;
        this.renderer.camera.zoom=zoom;
        const focus={x:(box.minX+box.maxX)/2,y:(box.minY+box.maxY)/2};
        this.renderer.camera.x=w/2-focus.x*zoom;
        this.renderer.camera.y=topInset+availableH/2-focus.y*zoom;
        this.updateStatus(); this.requestRender(); this.positionEditor();
      }
      zoomAt(factor, clientX = innerWidth / 2, clientY = innerHeight / 2) {
        const cam = this.renderer.camera;
        // A malformed wheel/pinch value must not poison the camera with NaN;
        // one invalid event should never make the whole map disappear.
        if(!Number.isFinite(factor)||factor<=0||
           !Number.isFinite(clientX)||!Number.isFinite(clientY)||
           !Number.isFinite(cam.zoom)||cam.zoom<=0||
           !Number.isFinite(cam.x)||!Number.isFinite(cam.y))return;
        const next = Math.max(.001, Math.min(3.5, cam.zoom * factor));
        const wx = (clientX - cam.x) / cam.zoom;
        const wy = (clientY - cam.y) / cam.zoom;
        cam.x = clientX - wx * next; cam.y = clientY - wy * next; cam.zoom = next;
        this.updateStatus(); this.requestRender(); this.positionEditor();
      }
