/* NeuroMap 6.14: durable single-tab and batch saving, right-hand tools dock. */
const NM614 = {
  serialize(app,tab){
    const state=tab.state;
    return {
      schema:'NeuroMapArchitect-SingleTab-v6',savedAt:new Date().toISOString(),
      thresholdY:state.thresholdY,balanceBias:state.balanceBias??50,
      compactness:state.compactness??100,branchGapX:nm68ClampGap(state.branchGapX),
      strokeScale:state.strokeScale||1,activeThemeId:state.activeThemeId||null,
      typographyPreset:state.typographyPreset||'uniform',typographyScale:state.typographyScale||1,
      branchStyle:state.branchStyle||'neon',defaultLabelWrapChars:state.defaultLabelWrapChars||nm64PreferredWrap(),wrapCustom:!!state.wrapCustom,
      studyCards:app.getStudyCardsForTab?.(tab.id)||[],
      learningAttempts:(typeof NeuroMapLearningCore==='undefined'?[]:NeuroMapLearningCore.cleanAttempts(app.learningAttempts)).filter(a=>a.tabId===tab.id),
      learningPlan:typeof NeuroMapAdaptiveCore==='undefined'?null:NeuroMapAdaptiveCore.cleanPlans(app.learningPlans).find(p=>p.tabId===tab.id)||null,
      root:MindMapStateMachine.cloneTree(state.root),images:MindMapStateMachine.cloneImages(state.images),
      relationships:MindMapStateMachine.cloneRelationships(state.relationships)
    };
  },
  fingerprint(app,tab){const s=tab.state;
    return NeuroMapSafeJSON.stringify([s.root,s.images,s.relationships,s.thresholdY,s.balanceBias,s.compactness,s.branchGapX,
      s.strokeScale,s.activeThemeId,s.typographyPreset,s.typographyScale,s.branchStyle,s.defaultLabelWrapChars,s.wrapCustom,
      // Flashcards belong to the saved project too: edits during async I/O must not be marked saved.
      app.getStudyCardsForTab?.(tab.id)||[],
      (typeof NeuroMapLearningCore==='undefined'?[]:NeuroMapLearningCore.cleanAttempts(app.learningAttempts)).filter(a=>a.tabId===tab.id),
      typeof NeuroMapAdaptiveCore==='undefined'?null:NeuroMapAdaptiveCore.cleanPlans(app.learningPlans).find(p=>p.tabId===tab.id)||null]);
  },
  async performSave(app,tab,saveAs=false){
    if(!tab||!tab.state?.root)return {ok:false};
    try{
      app.saveActiveTabSnapshot();
      const linked=!!tab.filePath && /\.xmind$/i.test(tab.filePath);
      const siblings=linked?app.tabs.filter(t=>t.filePath===tab.filePath):[tab];
      const savedFingerprints=new Map(siblings.map(t=>[t.id,this.fingerprint(app,t)]));
      const payload=this.serialize(app,tab);
      const originalName=tab.fileName||app.io.sanitizeFilename(tab.state.root.text)+'.gk';
       const filename=saveAs&&/\.(neuromap|glk)$/i.test(originalName)?originalName.replace(/\.(neuromap|glk)$/i,'.gk'):originalName;
      if(window.neuromapDesktop){
        const result=await window.neuromapDesktop.saveProject({json:NeuroMapSafeJSON.stringify(payload),filename,
          filePath:tab.filePath||null,saveAs:!!saveAs,
          xmindSheets:app.v6XMindSheets?.(tab)});
        if(!result||result.cancelled)return {ok:false,cancelled:true};
        // Never clear a dirty indicator if the user continued editing while saving.
        tab.filePath=result.path;tab.fileName=result.name;
        const group=linked&&!saveAs?siblings:[tab];
        for(const t of group){
          t.state.isDirty=this.fingerprint(app,t)!==savedFingerprints.get(t.id);
        }
        if(typeof NeuroMapAtlasLibrary!=='undefined'&&typeof NeuroMapKnowledgeCore!=='undefined'){
          try{
            const byKey=new Map(NeuroMapAtlasLibrary.clean(app._nmAtlasArchive).map(d=>[d.key,d]));
            for(const t of group){
              const snap=NeuroMapAtlasLibrary.capture(t,NeuroMapKnowledgeCore,true);
              if(snap)byKey.set(snap.key,snap);
            }
            app._nmAtlasArchive=NeuroMapAtlasLibrary.clean([...byKey.values()].sort((a,b)=>b.updatedAt-a.updatedAt));
          }catch(_){}
        }
        app.renderTabBar();app.scheduleSave();
        return {ok:true,tabId:tab.id,name:result.name};
      }
      // Browser fallback: the active tab can use its native file handle. Do not switch tabs.
      const json=NeuroMapSafeJSON.stringify(payload,2);
      if(typeof window.showSaveFilePicker==='function'){
        let handle=!saveAs?tab.fileHandle:null;
        if(!handle)handle=await showSaveFilePicker({suggestedName:filename,
          types:[{description:'Progetto Glauka',accept:{'application/json':['.gk','.glk','.neuromap','.json']}}]});
        const writer=await handle.createWritable();
        try{await writer.write(json);await writer.close();}catch(error){await writer.abort?.().catch(()=>{});throw error;}
        tab.fileHandle=handle;
      } else app.io.triggerDownload(new Blob([json],{type:'application/json'}),filename);
      tab.state.isDirty=this.fingerprint(app,tab)!==savedFingerprints.get(tab.id);
      app.renderTabBar();app.scheduleSave();
      return {ok:true,tabId:tab.id,name:filename};
    }catch(error){
      if(error?.name==='AbortError')return {ok:false,cancelled:true};
      console.error('NeuroMap 6.14 save failure:',error);
      app.showToast('Impossibile salvare «'+tab.state.root.text+'»: '+error.message,'ERRORE');
      // Emergency workspace export only when saving service itself is unreachable.
      if(/non raggiungibile|Failed to fetch|NetworkError|fetch failed/i.test(String(error?.message))&&app.nmAsk){
        const action=await app.nmAsk({title:'Servizio di salvataggio non disponibile',
          message:'Il servizio sul PC non risponde. Nessuna scheda viene indicata come salvata; esporta subito un backup di tutte le schede in JSON.',
          choices:[{value:'cancel',text:'Resta nella mappa'},{value:'backup',text:'Esporta backup JSON',primary:true}]});
        if(action==='backup')app.io.exportBatchWorkspaceJSON();
      }
      return {ok:false,error};
    }
  },
  enqueue(app,job){
    const tail=app._nm614Saving||Promise.resolve();
    const next=tail.then(job,job);
    app._nm614Saving=next.catch(()=>{});
    return next;
  },
  prepareSave(app){
    try{app.closeEditor(true);app.saveActiveTabSnapshot();return true;}
    catch(error){
      console.error('NeuroMap save preparation failed:',error);
      app.showToast('Impossibile preparare il salvataggio: '+error.message,'ERRORE');
      return false;
    }
  },
  async saveOne(app,saveAs=false){
    if(!this.prepareSave(app))return false;
    const id=app.activeTabId;
    const result=await this.enqueue(app,()=>this.performSave(app,app.tabs.find(t=>t.id===id),saveAs));
    if(result.ok)app.showToast('Scheda salvata: '+result.name,'SALVATO');
    return !!result.ok;
  },
  async saveAll(app){
    if(!this.prepareSave(app))return false;
    if(!app.tabs.length)return false;
    const ids=app.tabs.map(t=>t.id);
    return this.enqueue(app,async()=>{
      let ok=0,failed=0,cancelled=false;
      const savedXmind=new Set();
      for(const id of ids){
        const tab=app.tabs.find(t=>t.id===id);if(!tab)continue;
        if(tab.filePath&&/\.xmind$/i.test(tab.filePath)&&savedXmind.has(tab.filePath)){ok++;continue;}
        const result=await this.performSave(app,tab,false);
        if(result.cancelled){cancelled=true;break;}
        if(result.ok){ok++;if(tab.filePath&&/\.xmind$/i.test(tab.filePath))savedXmind.add(tab.filePath);}
        else failed++;
      }
      app.renderTabBar();
      app.showToast(`Salvataggio schede: ${ok}/${ids.length} riuscito${failed?' · '+failed+' errori':''}${cancelled?' · interrotto':''}`,
        failed?'ERRORE':cancelled?'INTERROTTO':'SALVA TUTTE');
      return !failed&&!cancelled&&ok===ids.length;
    });
  },
  mountDock(){
    const chrome=document.querySelector('.top-chrome'),bar=document.querySelector('.topbar.nm-ribbon');
    const actions=bar?.querySelector('.nm-status-actions'),strip=actions?.querySelector('.v4-toolstrip');
    const style=document.getElementById('btn-toggle-inspector');
    if(!chrome||!actions||!strip||!style||document.getElementById('nm614-right-dock'))return;
    const dock=document.createElement('nav');dock.id='nm614-right-dock';
    dock.setAttribute('aria-label','Strumenti rapidi Glauka');
    const fly=document.createElement('section');fly.id='nm614-navigation-flyout';fly.hidden=true;
    // Give the flyout a real first-frame anchor.  Without this, the fallback
    // CSS top (102px) can be painted once before the toolbar measurement is
    // available, making the compass menu visibly jump when opened.
    const initialDockTop=Math.max(72,Math.ceil(chrome.getBoundingClientRect().bottom)+11);
    document.documentElement.style.setProperty('--nm614-dock-top',initialDockTop+'px');
    fly.style.visibility='hidden';
    fly.setAttribute('aria-label','Navigazione della mappa');
    const flyTitle=document.createElement('div');flyTitle.className='nm614-fly-title';
    const flyCaption=document.createElement('strong');flyCaption.textContent='Esplora la mappa';flyTitle.append(flyCaption);
    const close=document.createElement('button');close.type='button';close.textContent='×';close.title='Chiudi navigazione';
    close.addEventListener('click',()=>open(false));flyTitle.append(close);fly.append(flyTitle);
    const navRow=document.createElement('div');navRow.className='nm614-fly-buttons';
    for(const id of ['nm67-prev-main','nm67-next-main']){const b=document.getElementById(id);if(b)navRow.append(b);}
    const hint=document.createElement('p');hint.className='nm614-nav-hint';hint.textContent='Passa da un concetto all’altro e centralo sullo schermo.';fly.append(hint,navRow);
    for(const selector of ['.nm69-nav-level','.nm612-nav-order']){
      const el=strip.querySelector(selector);if(el)fly.append(el);
    }
    const toggle=document.createElement('button');toggle.id='nm614-open-navigation';toggle.type='button';
    toggle.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M16 8 L14 14 L8 16 L10 10 Z"/><path d="M12 2 V4 M22 12 H20 M12 22 V20 M2 12 H4"/></svg>';toggle.title='Navigazione: rami, livelli e ordine';toggle.setAttribute('aria-label','Apri navigazione rami');
    toggle.setAttribute('aria-expanded','false');
    const open=shown=>{fly.hidden=!shown;toggle.setAttribute('aria-expanded',String(shown));};
    toggle.addEventListener('click',()=>open(fly.hidden));
    fly.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();open(false);toggle.focus();}e.stopPropagation();});
    const spotlight=document.getElementById('btn-spotlight');if(spotlight)dock.append(spotlight);
    dock.append(toggle);
    for(const id of ['btn-flashcards','nm62-toolbar-assets','btn-illustrate','btn-ai-settings']){
      const b=document.getElementById(id);if(b)dock.append(b);
    }
    dock.append(style);document.body.append(dock,fly);
    document.addEventListener('pointerdown',e=>{if(!fly.hidden&&!fly.contains(e.target)&&!toggle.contains(e.target))open(false);});
    document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;if(e.key==='Escape'&&!fly.hidden)open(false);});
    let appliedDockTop=initialDockTop;
    const position=()=>{
      if(!fly.hidden)return;
      const y=Math.max(72,Math.ceil(chrome.getBoundingClientRect().bottom)+11);
      // Ignore a one-pixel toolbar flicker. Opening the compass must not
      // move the menu; a real toolbar resize still updates the anchor.
      if(Math.abs(y-appliedDockTop)>=8){
        appliedDockTop=y;
        document.documentElement.style.setProperty('--nm614-dock-top',y+'px');
      }
      fly.style.visibility='visible';};
    position();window.addEventListener('resize',position);
    new ResizeObserver(position).observe(chrome);
  }
};
NeuroMapApp.prototype.saveActiveTabSafe=function(saveAs=false){return NM614.saveOne(this,saveAs);};
NeuroMapApp.prototype.saveAllTabs=function(){return NM614.saveAll(this);};
NeuroMapApp.prototype.saveToFile=function(as=false){return as?this.saveAllTabs():this.saveActiveTabSafe(false);};
MindMapIOManager.prototype.saveProjectFile=function(as=false){return NM614.saveOne(this.app,as);};
// Stop legacy listeners from mapping Ctrl+Shift+S to Save As.
const nm614OriginalExec=nm66ExecuteShortcut;
nm66ExecuteShortcut=function(app,action,event){
  if(action==='saveAs'){app.saveAllTabs();return true;}
  return nm614OriginalExec(app,action,event);
};
const nm614SaveAction=NM66_ACTIONS.find(x=>x.id==='saveAs');
if(nm614SaveAction)nm614SaveAction.label='Salva tutte le schede';
