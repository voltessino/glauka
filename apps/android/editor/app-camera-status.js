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
          this.layout._nmBias=this.state.thresholdY;
          this.layout.compactness=this.state.compactness??100;
          this.layout.branchGapX=this.state.branchGapX??150;
          this.layout.rootBranchGap=nmClampRootBranchGap(this.state.rootBranchGap);
          this.layout.branchStyle=this.state.branchStyle||'neon';
          this.splitMetrics = this.layout.computeLayout(this.state.root, this.state.thresholdY);
          // Skip paint outside the viewport on large maps; exports always paint the full map.
          this.renderer.highPerformanceCanvas=this.layout.nodeLayoutMap.size>300;
        }
        this.updateStatus(); this.positionEditor(); this.updateImageControls(); this.requestRender();
        if (changed) { this.state.isDirty = true; this.scheduleSave(); }
      }
      markChanged(options) { this._desktopUserEdited = true; this.recalculateAndRender(true, options); }
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
        put('threshold-readout', this.state.thresholdY + '%');
        put('menu-threshold-val', this.state.thresholdY + '%');
        put('lbl-thresh-r', this.state.thresholdY); put('lbl-thresh-l', this.state.thresholdY);
        put('hud-balance-mode', 'SPLIT S=' + (this.splitMetrics?.splitIndex ?? 0));
        put('count-right', '(' + (this.splitMetrics?.rightCount ?? 0) + ')');
        put('count-left', '(' + (this.splitMetrics?.leftCount ?? 0) + ')');
        put('val-hr', this.splitMetrics?.H_R ?? 0); put('val-hl', this.splitMetrics?.H_L ?? 0);
        for (const [id, val] of [['bar-hr', this.splitMetrics?.H_R || 0], ['bar-hl', this.splitMetrics?.H_L || 0]]) {
          const el = document.getElementById(id); if (el) el.style.width = Math.min(100, Math.round(val / Math.max(1, this.state.thresholdY) * 100)) + '%';
        }
        const font = document.getElementById('inspector-fontsize-slider');
        if (font && document.activeElement !== font) font.value = node?.fontSize || this.layout.getNodeTypography(node || this.state.root).fontSize;
        put('inspector-fontsize-val', font?.value + 'px');
        const color = document.getElementById('inspector-color-picker');
        if (color && document.activeElement !== color && /^#[0-9a-f]{6}$/i.test(node?.color || '')) color.value = node.color;
        const selWeight = node?.fontWeight || 700;
        document.getElementById('btn-weight-normal')?.classList.toggle('active', selWeight === 400);
        document.getElementById('btn-weight-bold')?.classList.toggle('active', selWeight !== 400);
        if (this.state.root) { const t = this.tabs.find(t => t.id === this.activeTabId); if (t) t.title = this.state.root.text; }
      }
      showToast(message, label = 'INFO') {
        const el = document.getElementById('toast-notification');
        document.getElementById('toast-badge').textContent = label;
        // The shared map-style gallery mentions desktop keys. Match its
        // exact localized message and action type; never rewrite user text.
        const rawMessage = String(message);
        const desktopStyleHint = globalThis.GlaukaI18n?.pair(
          'Stile applicato · Ctrl+Z per annullare',
          'Style applied · Ctrl+Z to undo'
        );
        const undoLabel = document.getElementById('glauka-undo')?.getAttribute('aria-label');
        const toastMessage = label === 'STILE' && undoLabel && rawMessage === desktopStyleHint
          ? rawMessage.replace(/ · Ctrl\+Z[^\n]*$/, '') + ' · ' + undoLabel
          : rawMessage;
        document.getElementById('toast-text').textContent = toastMessage;
        el.classList.remove('hidden'); el.style.opacity = '1';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.classList.add('hidden'), 230); }, 3300);
      }
      fitToScreen() {
        const box = this.layout.computeBoundingBox(this.state.images);
        const w = innerWidth, h = innerHeight;
        // The Android toolbar and bottom dock cover part of the CSS viewport.
        // Fit inside the actual unobstructed map area, not behind those controls.
        const header = window.GlaukaMobile && w <= 850 ? document.getElementById('glauka-app-header') : null;
        const dock = header ? document.getElementById('glauka-app-dock') : null;
        const top = header?.getBoundingClientRect().bottom;
        const bottom = dock?.getBoundingClientRect().top;
        const usable = Number.isFinite(top) && Number.isFinite(bottom) && bottom - top >= 200;
        const availableW = usable ? Math.max(160, w - 40) : Math.max(260, w - (w > 850 ? 190 : 45));
        const availableH = usable ? Math.max(160, bottom - top - 32) : Math.max(180, h - (h > 650 ? 230 : 150));
        const fullZoom=Math.max(0.12,Math.min(1.5,availableW/Math.max(1,box.width+60),availableH/Math.max(1,box.height+60)));
        // Preserve the full-map fit instead of forcing a large zoom that crops nodes.
        const zoom=fullZoom;
        this.renderer.camera.zoom=zoom;
        const focus={x:(box.minX+box.maxX)/2,y:(box.minY+box.maxY)/2};
        this.renderer.camera.x=w/2-focus.x*zoom;
        this.renderer.camera.y=(usable ? (top+bottom)/2 : h/2+22)-focus.y*zoom;
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
        const next = Math.max(.12, Math.min(3.5, cam.zoom * factor));
        const wx = (clientX - cam.x) / cam.zoom;
        const wy = (clientY - cam.y) / cam.zoom;
        cam.x = clientX - wx * next; cam.y = clientY - wy * next; cam.zoom = next;
        this.updateStatus(); this.requestRender(); this.positionEditor();
      }
