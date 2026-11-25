      scheduleSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.persistWorkspace(), 1100);
      }
      persistWorkspace() {
        // A close during startup must not overwrite the workspace still being read.
        if(this._desktopRecoveryPending)return this._desktopRecoveryReady.then(()=>this.persistWorkspace());
        if(this._nmRecoveryBlocked)return false;
        try {
          this.saveActiveTabSnapshot();
          const clampRootGap=typeof nmClampRootBranchGap==='function'?nmClampRootBranchGap:(v=>v!=null&&Number.isFinite(+v)?Math.round(Math.max(0,Math.min(48,+v))):14);
          const doc={version:3,editorDraft:this.editorNodeId?{nodeId:this.editorNodeId,text:document.getElementById('inline-editor-input').value,tabId:this.activeTabId}:null,studyCards:this.studyCards||[],
            learningAttempts:(this.learningAttempts||[]).slice(-2500),learningPlans:(this.learningPlans||[]).slice(-20),
            activeTabId:this.activeTabId,tabs:this.tabs.map(t=>({id:t.id,title:t.title,filePath:t.filePath||null,fileName:t.fileName||null,originSheetIndex:t.originSheetIndex??null,
            isDirty:!!t.state.isDirty,root:t.state.root,images:t.state.images,relationships:t.state.relationships,
            thresholdY:t.state.thresholdY,balanceBias:t.state.balanceBias,compactness:t.state.compactness,branchGapX:t.state.branchGapX,rootBranchGap:clampRootGap(t.state.rootBranchGap),wrapCustom:t.state.wrapCustom,strokeScale:t.state.strokeScale,activeThemeId:t.state.activeThemeId,
            typographyPreset:t.state.typographyPreset,typographyScale:t.state.typographyScale,branchStyle:t.state.branchStyle,defaultLabelWrapChars:t.state.defaultLabelWrapChars,camera:t.camera}))};
          globalThis.NeuroMapRecovery?.validate(doc);
          const json=(globalThis.NeuroMapSafeJSON?.stringify||JSON.stringify)(doc);
          const recoveryBridge=window.neuromapDesktop || window.NeuroMapRecovery?.bridge;
          if (recoveryBridge) {
            if(!this._nativeWorkspaceWrites)this._nativeWorkspaceWrites=NeuroMapWorkspaceWriteQueue.create(snapshot=>recoveryBridge.writeWorkspace(snapshot));
            return this._nativeWorkspaceWrites.write(json).then(() => { this._desktopAutosaveWarned=false; return true; }).catch(error => {
              console.warn('Autosalvataggio desktop:', error);
              if (!this._desktopAutosaveWarned) {
                this._desktopAutosaveWarned=true;
                this.showToast('Autosalvataggio su disco non riuscito: esporta un backup JSON', 'ATTENZIONE');
              }
              return false;
            });
          }
          // Avoid exceeding localStorage quotas on image-heavy projects.
          if (json.length < 2_600_000) {localStorage.setItem('neuromap.workspace.v2',json);this.autosaveCapacityWarning=false;return true;}
          else {
            // Keep the last valid backup when the current map cannot be saved.
            if (!this.autosaveCapacityWarning) {
              this.autosaveCapacityWarning = true;
              this.showToast('Autosalvataggio sospeso: troppe immagini. Esporta il progetto in JSON per conservarlo.', 'BACKUP');
            }
          }
        } catch (e) {
          console.warn('Autosave unavailable:', e.message);
          if(!this.autosaveCapacityWarning){
            this.autosaveCapacityWarning=true;
            this.showToast('Autosalvataggio non riuscito. Esporta il progetto in JSON per conservare le ultime modifiche.','ATTENZIONE');
          }
        }
        return false;
      }
      loadAutosave(jsonOverride = null) {
        try {
          const json=jsonOverride || localStorage.getItem('neuromap.workspace.v2'); if (!json) return;
          const data=JSON.parse(json);
          const maxTabs=globalThis.NeuroMapRecovery?.MAX_TABS||512;
          if(!Array.isArray(data.tabs)||!data.tabs.length||data.tabs.length>maxTabs)
            throw Error('Copia di recupero non valida: limite delle schede superato.');
          globalThis.NeuroMapRecovery?.validate(data);
          // Reconstruct all validated tabs, never silently discard tabs 21+.
          const restored=[];
          for (const obj of data.tabs) {
            if (!obj.root || typeof obj.root.text!=='string' || (obj.root.children!=null&&!Array.isArray(obj.root.children)))throw Error('Scheda di recupero non valida.');
            const state=this.newState(obj.root.text);
            state.root=MindMapStateMachine.cloneTree(obj.root);
            state.images=MindMapStateMachine.cloneImages(obj.images);
            state.relationships=MindMapStateMachine.cloneRelationships(obj.relationships);
            state.thresholdY=Number.isFinite(Number(obj.thresholdY)) && Number(obj.thresholdY)>=0 && Number(obj.thresholdY)<=100 ? Number(obj.thresholdY) : 50;
            state.strokeScale=Number(obj.strokeScale)||1;
            nmAndroidRestoreSpacing(state,obj);
            state.activeThemeId=obj.activeThemeId||null;
            state.typographyPreset=obj.typographyPreset||'uniform';state.typographyScale=Number(obj.typographyScale)||1;
            state.branchStyle=obj.branchStyle||'neon';state.defaultLabelWrapChars=Number(obj.defaultLabelWrapChars)||18;
            state.selectedNodeId=state.root.id;state.selectedNodeIds=[state.root.id];
            state.isDirty=obj.isDirty!==false;
            restored.push({id:obj.id||state.generateId(),title:obj.title||state.root.text,state,
              filePath:window.neuromapDesktop && typeof obj.filePath==='string'?obj.filePath:null,fileName:obj.fileName||null,originSheetIndex:obj.originSheetIndex??null,
              camera:globalThis.NeuroMapRecovery?.camera(obj.camera,.12)||null});
          }
          if (!restored.length) return;
          this.studyCards=Array.isArray(data.studyCards)?data.studyCards:[];
          this.learningAttempts=Array.isArray(data.learningAttempts)?data.learningAttempts
            .filter(a=>a&&typeof a==='object'&&!Array.isArray(a)).slice(-2500):[];
          this.learningPlans=Array.isArray(data.learningPlans)?data.learningPlans
            .filter(p=>p&&typeof p==='object'&&!Array.isArray(p)).slice(-20):[];
          this._nmRecoveryBlocked=false;
          this.tabs=restored;
          this.activeTabId=data.activeTabId;
          const active=restored.find(t=>t.id===this.activeTabId)||restored[0];
          this.activeTabId=active.id;this.state=active.state;this.renderer.state=this.state;
          const draft=data.editorDraft;const edited=draft?.tabId===active.id&&this.state.findNode(draft.nodeId);
          if(edited&&typeof draft.text==='string'&&draft.text.trim()&&draft.text.trim()!==edited.text){edited.text=draft.text.trim();this.state.isDirty=true;}
          if(active.camera)this.renderer.camera={...active.camera};
          return true;
        } catch (e) {this._nmRecoveryBlocked=true;globalThis.NeuroMapSaveStatus?.report?.(this,false);console.warn('Could not restore workspace:', e);}
      }
      toggleBoundary() { if(this.state.toggleNodeBoundary(this.state.selectedNodeId))this.markChanged(); }
