    NeuroMapApp.prototype.v6XMindSheets=function(tab){
      const related=tab?.filePath&&String(tab.fileName||'').toLowerCase().endsWith('.xmind')
        ?this.tabs.filter(t=>t.filePath===tab.filePath):[tab];
      this.saveActiveTabSnapshot();
      return related.filter(t=>t?.state?.root).sort((a,b)=>(a.originSheetIndex??0)-(b.originSheetIndex??0))
        .map(t=>({title:t.state.root.text,root:MindMapStateMachine.cloneTree(t.state.root),
          images:MindMapStateMachine.cloneImages(t.state.images),
          relationships:MindMapStateMachine.cloneRelationships(t.state.relationships),
          thresholdY:t.state.thresholdY,balanceBias:t.state.balanceBias??50,compactness:t.state.compactness??100,branchGapX:nm68ClampGap(t.state.branchGapX),strokeScale:t.state.strokeScale,activeThemeId:t.state.activeThemeId,
          typographyPreset:t.state.typographyPreset,typographyScale:t.state.typographyScale,
          branchStyle:t.state.branchStyle||'neon',defaultLabelWrapChars:t.state.defaultLabelWrapChars||nm64PreferredWrap(),wrapCustom:!!t.state.wrapCustom,
          studyCards:this.getStudyCardsForTab?.(t.id)||[],
          learningAttempts:typeof NeuroMapLearningCore==='undefined'?[]:NeuroMapLearningCore.cleanAttempts(this.learningAttempts).filter(a=>a.tabId===t.id),
          learningPlan:typeof NeuroMapAdaptiveCore==='undefined'?null:NeuroMapAdaptiveCore.cleanPlans(this.learningPlans).find(p=>p.tabId===t.id)||null}));
    };
    NeuroMapApp.prototype.v6SetOrigin=function(origin,before,replaceTab,importedTabIds,deferRefresh=false){
      if(!origin?.path)return [];
      const created=this.tabs.filter(t=>!before.has(t.id));
      const targets=Array.isArray(importedTabIds)?importedTabIds.map(id=>this.tabs.find(t=>t.id===id)).filter(Boolean):(created.length?created:[this.tabs.find(t=>t.id===(replaceTab||this.activeTabId))].filter(Boolean));
      targets.forEach((t,i)=>{t.filePath=origin.path;t.fileName=origin.filename;t.originSheetIndex=i;});
      // Reopen with the last saved workspace presentation; never mutate the file's nodes.
      if(typeof NeuroMapAtlasLibrary!=='undefined'){
        const archived=new Map((this._nmViewWorkspaceArchive||[]).map(item=>[NeuroMapAtlasLibrary.keyFor(item),item.viewWorkspace]));
        for(const tab of targets){
          const saved=archived.get(NeuroMapAtlasLibrary.keyFor(tab));
          if(saved)tab.viewWorkspace=JSON.parse(JSON.stringify(saved));
        }
      }
      window.NeuroMapLinkedViews?.restoreFromTab?.(this,true);
      // The imported bytes came from an existing file: index that initial,
      // unmodified projection even though import marks its tab dirty.
      if(typeof NeuroMapAtlasLibrary!=='undefined'&&typeof NeuroMapKnowledgeCore!=='undefined'){
        const byKey=new Map(NeuroMapAtlasLibrary.clean(this._nmAtlasArchive).map(d=>[d.key,d]));
        for(const t of targets){if(t.state.undoStack.length||t.state.redoStack.length)continue;const s=NeuroMapAtlasLibrary.capture(t,NeuroMapKnowledgeCore,true);
          if(s)byKey.set(s.key,s);}
        this._nmAtlasArchive=NeuroMapAtlasLibrary.clean([...byKey.values()].sort((a,b)=>b.updatedAt-a.updatedAt));
      }
      if(!deferRefresh){this.renderTabBar();this.scheduleSave();}
      return targets;
    };
    // Import preparation can overlap; only this queue may mutate live tabs.
    NeuroMapApp.prototype.v6ImportNative=function(payload,newTab=true,context={}){
      if(!newTab)context={...context,targetTabId:context.targetTabId||this.activeTabId};
      const pending=(this._nmNativeImportTail||Promise.resolve()).then(()=>this.v6ApplyNative(payload,newTab,context));
      this._nmNativeImportTail=pending.catch(()=>{});return pending;
    };
    NeuroMapApp.prototype.v6ApplyNative=async function(payload,newTab=true,context={}){
      const outcome=context.outcome||{};
      const normalized=p=>window.GlaukaNativeOpen?.pathKey(p)||(()=>{const value=String(p||'').replace(/\\/g,'/');return /^[a-z]:\//i.test(value)||value.startsWith('//')?value.toLowerCase():value;})();
      if(newTab&&payload?.path){
        const existing=this.tabs.find(t=>t.filePath&&normalized(t.filePath)===normalized(payload.path));
        if(existing){
          if(!context.deferDuplicateActivation)this.activateTab(existing.id);
          if(!context.quiet)this.showToast('Progetto già aperto · '+existing.title,'FILE');
          Object.assign(outcome,{status:'ignored',code:'duplicate',tabId:existing.id});return true;
        }
      }
      if(!payload?.bytes)throw Error('Documento vuoto o non leggibile');
      const before=new Set(this.tabs.map(t=>t.id)),previous=newTab?this.activeTabId:context.targetTabId,created=[];
      const original=this.tabs.find(t=>t.id===previous),originalState=original?.state;
      if(!newTab&&!original)throw Error('La scheda da sostituire non è più aperta.');
      const originalView=original?.viewWorkspace,originalCamera=original?.camera,originalTitle=original?.title;
      const bytes=payload.bytes;
      // File-like read-only adapter avoids a second full-size File/Blob copy.
      const file={name:payload.filename||'Mappa.gk',size:bytes.byteLength,
        text:async()=>new TextDecoder().decode(bytes),
        arrayBuffer:async()=>bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes.buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
      try{
        const imported=await this.importFiles([file],newTab,{throwOnError:true,quiet:!!context.quiet,nativeOpen:true,targetTabId:previous,
          preparedHierarchy:payload.preparedHierarchy,preparedArchive:payload.preparedArchive,
          onImportTab:tab=>created.push(tab.id)});
        if(!(imported>0)){Object.assign(outcome,{status:'ignored',code:'cancelled'});return false;}
        this.v6SetOrigin(payload,before,previous,created.length?created:undefined);
        Object.assign(outcome,{status:'opened',tabId:this.activeTabId,pathWarning:!!payload.pathWarning});return true;
      }catch(error){
        // Remove only tabs created by this import, never tabs the user created
        // while a read/dialog was pending. Original files are never written.
        if(created.length){
          const owned=new Set(created.filter(id=>!before.has(id)));this.tabs=this.tabs.filter(t=>!owned.has(t.id));
          this.studyCards=(this.studyCards||[]).filter(c=>!owned.has(c.sourceTabId));
          this.learningAttempts=(this.learningAttempts||[]).filter(c=>!owned.has(c.tabId));
          this.learningPlans=(this.learningPlans||[]).filter(c=>!owned.has(c.tabId));
          if(owned.has(this.activeTabId)){const target=this.tabs.find(t=>t.id===previous)||this.tabs.at(-1);if(target)this.activateTab(target.id);}
        }
        if(!newTab&&original&&original.state!==originalState){
          Object.assign(original,{state:originalState,viewWorkspace:originalView,camera:originalCamera,title:originalTitle});
          if(this.activeTabId===previous){this.state=originalState;this.renderer.state=originalState;this.recalculateAndRender();this.renderTabBar();}
        }
        throw error;
      }
    };
    NeuroMapApp.prototype.v6ReportNativeOpen=function(report){
      const core=window.GlaukaNativeOpen;if(!core)return;
      this._nmLastNativeOpenReport=report;
      const last=report.entries.filter(e=>e.status!=='failed'&&e.tabId).at(-1);
      if(last&&last.tabId!==this.activeTabId)this.activateTab(last.tabId);
      const locale=globalThis.GlaukaI18n?.locale?.()||'it',title=core.labels(locale).title;
      this.showToast(core.summary(report,locale),title);
      if(report.failed||report.entries.some(e=>e.pathWarning)||report.backupProtected===false){
        const signature=report.source==='external'?report.entries.map(e=>[e.deliveryId,e.status,e.code,e.message].join(':')).join('|'):null;
        const seen=this._nmNativeReportSeen||(this._nmNativeReportSeen=new Set());
        if(signature&&seen.has(signature))return;
        if(signature){seen.add(signature);if(seen.size>64)seen.delete(seen.values().next().value);}
        (this._nmNativeReportQueue||(this._nmNativeReportQueue=[])).push(report);
        this.v6ShowNextNativeReport();
      }
    };
    NeuroMapApp.prototype.v6ShowNextNativeReport=function(){
      if(this._nmNativeReportActive||!this._nmNativeReportQueue?.length)return;
      const overlay=document.getElementById('nm-decision-overlay');
      if(overlay&&!overlay.classList.contains('hidden')){
        if(!this._nmNativeReportObserver){
          this._nmNativeReportObserver=new MutationObserver(()=>{if(overlay.classList.contains('hidden')){this._nmNativeReportObserver.disconnect();this._nmNativeReportObserver=null;this.v6ShowNextNativeReport();}});
          this._nmNativeReportObserver.observe(overlay,{attributes:true,attributeFilter:['class']});
        }
        return;
      }
      const report=this._nmNativeReportQueue.shift(),core=window.GlaukaNativeOpen,locale=globalThis.GlaukaI18n?.locale?.()||'it';
      const backupWarning=report.backupProtected===false?(globalThis.GlaukaI18n?.translate('Autosalvataggio su disco non riuscito: esporta un backup JSON')||'Autosalvataggio su disco non riuscito: esporta un backup JSON'):'';
      this._nmNativeReportActive=true;
      Promise.resolve(this.nmAsk({title:core.labels(locale).title,message:core.summary(report,locale)+'\n\n'+core.details(report,locale)+(backupWarning?'\n'+backupWarning:''),choices:[{value:'close',text:globalThis.GlaukaI18n?.pair('Chiudi','Close')||'Close',primary:true}]})).finally(()=>{this._nmNativeReportActive=false;this.v6ShowNextNativeReport();});
    };
    NeuroMapApp.prototype.v6ImportNativeBatch=async function(files){
      const core=window.GlaukaNativeOpen;
      this.closeEditor(true);
      // Preserve the pre-existing unsaved workspace before adding documents.
      // A preferences/disk failure still allows a readable file to open, with
      // an explicit backup warning in the final report.
      // An all-duplicate/error selection cannot add or replace maps. Serializing
      // its entire existing workspace is expensive and protects no import.
      const backupRequired=files.some(file=>!file.error&&!file.ignored&&!(file.path&&this.tabs.some(tab=>tab.filePath&&core.pathKey(tab.filePath)===core.pathKey(file.path))));
      let backupProtected;
      if(backupRequired){backupProtected=false;try{backupProtected=(await this.persistWorkspace())===true;}catch(error){console.warn('Pre-import recovery copy:',error);}}
      const result=await core.run(files,{
        load:async file=>{
          if(file.path&&this.tabs.some(t=>t.filePath&&core.pathKey(t.filePath)===core.pathKey(file.path)))return file;
          const loaded=file.read?await file.read():file;
          if(loaded.bytes){
            const ext=(loaded.filename||'').split('.').pop().toLowerCase();
            if(ext==='xmind')loaded.preparedArchive=await this.io.parseZipArchiveInMemory(loaded.bytes.byteOffset===0&&loaded.bytes.byteLength===loaded.bytes.buffer.byteLength?loaded.bytes.buffer:loaded.bytes.buffer.slice(loaded.bytes.byteOffset,loaded.bytes.byteOffset+loaded.bytes.byteLength));
            else if(['gk','glk','neuromap','json'].includes(ext))loaded.preparedHierarchy=this.parseTextHierarchy(new TextDecoder().decode(loaded.bytes),ext);
          }
          return loaded;
        },
        apply:async payload=>{const outcome={};await this.v6ImportNative(payload,true,{quiet:true,deferDuplicateActivation:true,outcome});return outcome;},
        onProgress:(report,entry)=>{this.showToast(report.entries.length+'/'+files.length+' · '+entry.filename,'IMPORT');}
      });
      if(backupRequired)result.backupProtected=backupProtected;
      this.v6ReportNativeOpen(result);return result;
    };
    // Match the state updates to the selection, without N history snapshots.
