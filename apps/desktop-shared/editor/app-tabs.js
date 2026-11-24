      addTab(state, title = null, makeActive = true) {
        // Any explicit tab creation makes the first-run placeholder ineligible.
        this._nmHomePlaceholder=false;
        const tab = { id: 'tab_' + this.state.generateId(), state,
          title: title || state.root?.text || 'Mappa', camera: null,viewWorkspace:nmCleanViewWorkspace(null) };
        this.tabs.push(tab);
        if (makeActive) this.activateTab(tab.id, false);
        return tab;
      }
      saveActiveTabSnapshot() {
        const t = this.tabs.find(t => t.id === this.activeTabId);
        if (t) {
          // Replacing the actual project in a tab must never inherit the
          // previous project's remembered presentation/camera positions.
          if(t.state!==this.state)t.viewWorkspace=nmCleanViewWorkspace(null);
          t.state = this.state;
          t.title = this.state.root?.text || 'Mappa';
          t.camera = { ...this.renderer.camera };
        }
      }
      activateTab(id, fit = false) {
        if (this.activeTabId === id && !fit) return;
        this.closeEditor(true);
        this.saveActiveTabSnapshot();
        const tab = this.tabs.find(t => t.id === id);
        if (!tab) return;
        this.activeTabId = tab.id;
        this.state = tab.state;
        nm64ApplyWrapPreference(this.state);
        this.renderer.state = this.state;
        if (tab.camera) this.renderer.camera = { ...tab.camera };
        this.recalculateAndRender();
        if (fit || !tab.camera) this.fitToScreen();
        this.renderTabBar();
      }
      renderTabBar() {
        this.saveActiveTabSnapshot();
        const host = document.getElementById('tabs-list');
        host.replaceChildren();
        for (const tab of this.tabs) {
          const b = document.createElement('div');
          b.className = 'tab-item' + (tab.id === this.activeTabId ? ' active' : '');
          b.title = tab.title;
          const text = document.createElement('span');
          text.className = 'tab-title';
          text.textContent = tab.title + (tab.state.isDirty ? ' •' : '');
          b.appendChild(text);
          b.addEventListener('click', () => this.activateTab(tab.id));
          b.addEventListener('auxclick', e => {if(e.button===1){e.preventDefault();e.stopPropagation();this.closeTab(tab.id);}});
          b.addEventListener('pointerdown',e=>{if(e.button===1){e.preventDefault();e.stopPropagation();}},true);
          const close = document.createElement('button');
          close.className = 'tab-close-btn'; close.type = 'button'; close.textContent = '×';
          close.setAttribute('aria-label', globalThis.GlaukaI18n?.translate('Chiudi scheda') || 'Chiudi scheda');
          close.title = close.getAttribute('aria-label');
          close.addEventListener('click', e => { e.stopPropagation(); this.closeTab(tab.id); });
          b.appendChild(close);
          host.appendChild(b);
        }
      }
      createNewTab(title = (globalThis.GlaukaI18n?.translate('Nuova Mappa')||'Nuova Mappa'), starter = false) {
        this.closeEditor(true); this.saveActiveTabSnapshot();
        const tab = this.addTab(this.newState(title, starter), title);
        this.renderTabBar(); this.scheduleSave();
        return tab;
      }
      duplicateTab() {
        const original = this.state;
        const suffix=globalThis.GlaukaI18n?.translate(' (copia)')||' (copia)';
        const s = this.newState(original.root.text + suffix);
        s.root = MindMapStateMachine.cloneTree(original.root);
        s.root.text += suffix;
        s.images = MindMapStateMachine.cloneImages(original.images);
        s.relationships = MindMapStateMachine.cloneRelationships(original.relationships);
        s.thresholdY = original.thresholdY;
        s.balanceBias=original.balanceBias??50;s.compactness=original.compactness??100;
        s.strokeScale = original.strokeScale;
        s.activeThemeId = original.activeThemeId;
        s.typographyPreset=original.typographyPreset; s.typographyScale=original.typographyScale;
        s.branchStyle=original.branchStyle||'neon';s.defaultLabelWrapChars=original.defaultLabelWrapChars||nm64PreferredWrap();s.wrapCustom=Boolean(original.wrapCustom);
        s.selectedNodeId = s.root.id;
        this.saveActiveTabSnapshot();
        this.addTab(s, s.root.text);
        this.recalculateAndRender(); this.fitToScreen(); this.renderTabBar(); this.scheduleSave();
      }
      closeTab(id = this.activeTabId) {
        const idx = this.tabs.findIndex(t => t.id === id);
        if (idx < 0) return;
        if (this.tabs[idx].state.isDirty && !confirm(globalThis.GlaukaI18n?.translate('Chiudere la scheda? Le modifiche non esportate potrebbero andare perse.')||'Chiudere la scheda? Le modifiche non esportate potrebbero andare perse.')) return;
        this.closeEditor(true);
        // Keep a bounded index for SAVED documents even after their tab closes.
        if(typeof NeuroMapAtlasLibrary!=='undefined'&&typeof NeuroMapKnowledgeCore!=='undefined'){
          this._nmAtlasArchive=NeuroMapAtlasLibrary.update(this._nmAtlasArchive,[this.tabs[idx]],NeuroMapKnowledgeCore);
        }
        this._nmViewWorkspaceArchive=nmArchiveViewWorkspaces(this._nmViewWorkspaceArchive,[this.tabs[idx]]);
        const wasActive = id === this.activeTabId;
        this.tabs.splice(idx, 1);
        if (!this.tabs.length) {
          this.activeTabId = null;
          const s = this.newState(); this.addTab(s, s.root.text); this.recalculateAndRender(); this.fitToScreen();
          this._nmHomePlaceholder=true;
          window.NeuroMapHome?.open?.();
        } else if (wasActive) {
          this.activeTabId = null;
          this.activateTab(this.tabs[Math.min(idx, this.tabs.length - 1)].id, false);
        }
        this.renderTabBar(); this.scheduleSave();
      }
