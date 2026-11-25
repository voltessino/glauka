      scheduleSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.persistWorkspace(), 1100);
      }
      persistWorkspace() {
        // A close during startup must not overwrite the workspace still being read.
        if(this._desktopRecoveryPending)return this._desktopRecoveryReady.then(()=>this.persistWorkspace());
        if(this._nmRecoveryBlocked)return false;
        clearTimeout(this.saveTimer);this.saveTimer=null;
        try {
          this.saveActiveTabSnapshot();
          if(typeof NeuroMapAtlasLibrary!=='undefined'&&typeof NeuroMapKnowledgeCore!=='undefined'){
            // Resolve transient previous-session tab identifiers BEFORE archive
            // updates replace their latest tab ID. Do not delete orphan links.
            this._nmAtlasEdges=NeuroMapAtlasLibrary.stabilizeEdges(
              this._nmAtlasEdges,this.tabs,this._nmAtlasArchive);
            this._nmAtlasArchive=NeuroMapAtlasLibrary.update(this._nmAtlasArchive,this.tabs,NeuroMapKnowledgeCore);
          }
          this._nmViewWorkspaceArchive=nmArchiveViewWorkspaces(this._nmViewWorkspaceArchive,this.tabs);
          const clampRootGap=typeof nmClampRootBranchGap==='function'?nmClampRootBranchGap:(v=>v!=null&&Number.isFinite(+v)?Math.round(Math.max(0,Math.min(48,+v))):14);
          const doc={version:3,viewWorkspaceArchive:this._nmViewWorkspaceArchive,atlasLibrary:(this._nmAtlasArchive||[]),atlasEdges:(this._nmAtlasEdges||[]).slice(0,500),journeyProgress:this._nmJourneyProgress||{},editorDraft:this.editorNodeId?{nodeId:this.editorNodeId,text:document.getElementById('inline-editor-input').value,tabId:this.activeTabId}:null,studyCards:this.studyCards||[],learningAttempts:NeuroMapLearningCore.cleanAttempts(this.learningAttempts||[]),learningPlans:NeuroMapAdaptiveCore.cleanPlans(this.learningPlans),activeTabId:this.activeTabId,tabs:this.tabs.map(t=>({id:t.id,title:t.title,filePath:t.filePath||null,fileName:t.fileName||null,originSheetIndex:t.originSheetIndex??null,
            isDirty:!!t.state.isDirty,root:t.state.root,images:t.state.images,relationships:t.state.relationships,
            thresholdY:t.state.thresholdY,balanceBias:t.state.balanceBias??50,compactness:t.state.compactness??100,branchGapX:nm68ClampGap(t.state.branchGapX),rootBranchGap:clampRootGap(t.state.rootBranchGap),strokeScale:t.state.strokeScale,activeThemeId:t.state.activeThemeId,
            typographyPreset:t.state.typographyPreset,typographyScale:t.state.typographyScale,branchStyle:t.state.branchStyle,defaultLabelWrapChars:t.state.defaultLabelWrapChars,wrapCustom:!!t.state.wrapCustom,camera:nmCleanCanvasCamera(t.camera),
            viewWorkspace:nmCleanViewWorkspace(t.viewWorkspace)}))};
          globalThis.NeuroMapRecovery?.validate(doc);
          const json=NeuroMapSafeJSON.stringify(doc);
          const saveRev=this._nmRecoveryRevision||0;
          if (window.neuromapDesktop) {
            // Native workspace writes must be serialized. OS/network completion
            // can otherwise reorder saves and overwrite the latest snapshot
            // with stale JSON from an earlier editing state. Coalesce backlog.
            if (!this._nativeWorkspaceWrites) {
              this._nativeWorkspaceWrites=NeuroMapWorkspaceWriteQueue.create(
                snapshot=>window.neuromapDesktop.writeWorkspace(snapshot));
            }
            return this._nativeWorkspaceWrites.write(json).then(() => {
              this._desktopAutosaveWarned=false;
              if((this._nmRecoveryRevision||0)===saveRev)this._nmLastPersistedRevision=saveRev;
              // The write queue can coalesce A then B and resolve both callers
              // with B. Never upload A merely because its promise completed.
              if(!this._nmClosingFlush&&window.GlaukaCloudSync&&this._nativeWorkspaceWrites.isIdle()){
                void window.neuromapDesktop.readWorkspace()
                  .then(onDisk=>{if(typeof onDisk==='string'&&this._nativeWorkspaceWrites.isIdle())
                    window.GlaukaCloudSync?.onWorkspaceSaved(onDisk);})
                  .catch(()=>{});
              }
              return true;
            }).catch(error => {
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
          const data=JSON.parse(json); if (!Array.isArray(data.tabs)||!data.tabs.length||data.tabs.length>100)throw Error('Copia di recupero non valida: massimo 100 schede.');
          globalThis.NeuroMapRecovery?.validate(data);
          // Validate and reconstruct all candidate tabs BEFORE changing live
          // flashcards, Atlas links, Journey progress, or the active workspace.
          // A corrupt/empty recovery file must not partially replace user data.
          const clampRootGap=typeof nmClampRootBranchGap==='function'?nmClampRootBranchGap:(v=>v!=null&&Number.isFinite(+v)?Math.round(Math.max(0,Math.min(48,+v))):14);
          const restored=[];
          for (const obj of data.tabs) {
            if (!obj.root || typeof obj.root.text!=='string' || (obj.root.children!=null&&!Array.isArray(obj.root.children)))throw Error('Scheda di recupero non valida.');
            const state=this.newState(obj.root.text);
            state.root=MindMapStateMachine.cloneTree(obj.root);
            state.images=MindMapStateMachine.cloneImages(obj.images);
            state.relationships=MindMapStateMachine.cloneRelationships(obj.relationships);
            state.thresholdY=obj.thresholdY != null && Number.isFinite(Number(obj.thresholdY)) ? Number(obj.thresholdY) : 500;
            state.balanceBias=Number.isFinite(+obj.balanceBias)?Math.max(0,Math.min(100,+obj.balanceBias)):50;
            state.compactness=Number.isFinite(+obj.compactness)?Math.max(55,Math.min(145,+obj.compactness)):100;
            state.branchGapX=nm68ClampGap(obj.branchGapX);
            state.rootBranchGap=clampRootGap(obj.rootBranchGap);
            state.strokeScale=Number(obj.strokeScale)||1;
            state.activeThemeId=obj.activeThemeId||null;
            state.typographyPreset=obj.typographyPreset||'uniform';state.typographyScale=Number(obj.typographyScale)||1;
            state.branchStyle=obj.branchStyle||'neon';state.defaultLabelWrapChars=Number(obj.defaultLabelWrapChars)||nm64PreferredWrap();state.wrapCustom=nm64WasCustom(obj);nm64ApplyWrapPreference(state);
            state.selectedNodeId=state.root.id;state.selectedNodeIds=[state.root.id];
            state.isDirty=obj.isDirty!==false;
            restored.push({id:obj.id||state.generateId(),title:obj.title||state.root.text,state,
              filePath:window.neuromapDesktop && typeof obj.filePath==='string'?obj.filePath:null,fileName:obj.fileName||null,originSheetIndex:obj.originSheetIndex??null,
              camera:nmCleanCanvasCamera(obj.camera),viewWorkspace:nmCleanViewWorkspace(obj.viewWorkspace)});
          }
          if (!restored.length) return;
          this.studyCards=Array.isArray(data.studyCards)?data.studyCards:[];
          this.learningAttempts=NeuroMapLearningCore.cleanAttempts(data.learningAttempts);
          this.learningPlans=NeuroMapAdaptiveCore.cleanPlans(data.learningPlans);
          // Atlas edges belong to the workspace only; never alter project node formats.
          this._nmAtlasEdges=Array.isArray(data.atlasEdges)?data.atlasEdges.slice(0,500):[];
          this._nmAtlasArchive=typeof NeuroMapAtlasLibrary!=='undefined'?NeuroMapAtlasLibrary.clean(data.atlasLibrary):[];
          this._nmViewWorkspaceArchive=nmArchiveViewWorkspaces(data.viewWorkspaceArchive);
          this._nmJourneyProgress=data.journeyProgress&&typeof data.journeyProgress==='object'&&!Array.isArray(data.journeyProgress)?
           Object.fromEntries(Object.entries(data.journeyProgress).slice(0,100).filter(([k,v])=>typeof k==='string'&&k.length<200&&Number.isInteger(v)&&v>=0&&v<=50000)):{};
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
