    NeuroMapApp.prototype.v6XMindSheets=function(tab){
      const related=tab?.filePath&&String(tab.fileName||'').toLowerCase().endsWith('.xmind')
        ?this.tabs.filter(t=>t.filePath===tab.filePath):[tab];
      this.saveActiveTabSnapshot();
      return related.filter(t=>t?.state?.root).sort((a,b)=>(a.originSheetIndex??0)-(b.originSheetIndex??0))
        .map(t=>({title:t.state.root.text,root:MindMapStateMachine.cloneTree(t.state.root),
          images:MindMapStateMachine.cloneImages(t.state.images),
          relationships:MindMapStateMachine.cloneRelationships(t.state.relationships),
          thresholdY:t.state.thresholdY,strokeScale:t.state.strokeScale,activeThemeId:t.state.activeThemeId,
          typographyPreset:t.state.typographyPreset,typographyScale:t.state.typographyScale,
          branchStyle:t.state.branchStyle||'neon',defaultLabelWrapChars:t.state.defaultLabelWrapChars||18,
          studyCards:this.getStudyCardsForTab?.(t.id)||[]}));
    };
    NeuroMapApp.prototype.v6SetOrigin=function(origin,before,replaceTab){
      if(!origin?.path)return;
      const created=this.tabs.filter(t=>!before.has(t.id));
      const targets=created.length?created:[this.tabs.find(t=>t.id===(replaceTab||this.activeTabId))].filter(Boolean);
      targets.forEach((t,i)=>{t.filePath=origin.path;t.fileName=origin.filename;t.originSheetIndex=i;});
      this.renderTabBar();this.scheduleSave();
    };
    NeuroMapApp.prototype.v6ImportNative=async function(payload,newTab=true){
      if(!payload?.bytes)throw Error('Documento vuoto o non leggibile');
      const before=new Set(this.tabs.map(t=>t.id));const previous=this.activeTabId;
      const f=new File([payload.bytes],payload.filename||'Mappa.neuromap');
      const imported=await this.importFiles([f],newTab);
      if(!(imported>0))throw Error('Il documento non è stato importato');
      this.v6SetOrigin(payload,before,previous);
      return true;
    };
    // Match the state updates to the selection, without N history snapshots.
