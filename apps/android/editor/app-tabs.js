      addTab(state, title = null, makeActive = true) {
        if(this.tabs.length >= (globalThis.NeuroMapRecovery?.MAX_TABS||512))
          throw Error('Limite di 512 schede raggiunto. Esporta i progetti e crea un nuovo gruppo prima di proseguire.');
        const tab = { id: 'tab_' + this.state.generateId(), state,
          title: title || state.root?.text || 'Mappa', camera: null };
        this.tabs.push(tab);
        if (makeActive) this.activateTab(tab.id, false);
        return tab;
      }
      saveActiveTabSnapshot() {
        const t = this.tabs.find(t => t.id === this.activeTabId);
        if (t) {
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
        if(this.tabs.length >= (globalThis.NeuroMapRecovery?.MAX_TABS||512)){
          this.showToast('Hai raggiunto 512 schede: esporta i progetti prima di aggiungerne altri.', 'ATTENZIONE');
          return null;
        }
        this.closeEditor(true); this.saveActiveTabSnapshot();
        const tab = this.addTab(this.newState(title, starter), title);
        this.renderTabBar(); this.scheduleSave();
        return tab;
      }
      duplicateTab() {
        if(this.tabs.length >= (globalThis.NeuroMapRecovery?.MAX_TABS||512)){
          this.showToast('Hai raggiunto 512 schede: esporta i progetti prima di duplicarne altri.', 'ATTENZIONE');
          return null;
        }
        const original = this.state;
        const s = this.newState(original.root.text + ' (copia)');
        s.root = MindMapStateMachine.cloneTree(original.root);
        s.root.text += ' (copia)';
        s.images = MindMapStateMachine.cloneImages(original.images);
        s.relationships = MindMapStateMachine.cloneRelationships(original.relationships);
        s.thresholdY = original.thresholdY;
        s.rootBranchGap = nmClampRootBranchGap(original.rootBranchGap);
        s.strokeScale = original.strokeScale;
        nmAndroidRestoreSpacing(s,original);
        s.activeThemeId = original.activeThemeId;
        s.typographyPreset=original.typographyPreset; s.typographyScale=original.typographyScale;
        s.branchStyle=original.branchStyle||'neon';s.defaultLabelWrapChars=original.defaultLabelWrapChars||18;
        s.selectedNodeId = s.root.id;
        this.saveActiveTabSnapshot();
        this.addTab(s, s.root.text);
        this.recalculateAndRender(); this.fitToScreen(); this.renderTabBar(); this.scheduleSave();
      }
      closeTab(id = this.activeTabId) {
        const idx = this.tabs.findIndex(t => t.id === id);
        if (idx < 0) return;
        if (this.tabs[idx].state.isDirty && !confirm('Chiudere la scheda? Le modifiche non esportate potrebbero andare perse.')) return;
        this.closeEditor(true);
        const wasActive = id === this.activeTabId;
        this.tabs.splice(idx, 1);
        if (!this.tabs.length) {
          this.activeTabId = null;
          const s = this.newState(); this.addTab(s, s.root.text); this.recalculateAndRender(); this.fitToScreen();
        } else if (wasActive) {
          this.activeTabId = null;
          this.activateTab(this.tabs[Math.min(idx, this.tabs.length - 1)].id, true);
        }
        this.renderTabBar(); this.scheduleSave();
      }
