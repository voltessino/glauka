  function setSideMode(app,mode,restoring=false){
    const state=app.state;
    if(!state?.root)return;
    if(!restoring)captureVisibleCamera(app);
    const primary=core.mode(state.root.viewMode);
    // A map can be either member of the pair: select the canonical
    // mind-map-primary representation for pairs containing a mind map.
    if(mode==='mindmap'&&primary!=='mindmap'){
      if(restoring)return false;
      if(setMode(app,'mindmap')===false)return false;
      return setSideMode(app,primary);
    }
    const current=sideMode.get(state);
    // Mobile never opens a dual pane: one presentation fills the shell.
    const wanted=root.GlaukaMobile?null:
      (mode&&mode!=='mindmap'&&mode!==primary?core.mode(mode):null);
    if(wanted&&wanted!=='mindmap'){
      if(!canProject(app,wanted))return false;
      if(!current&&root.NeuroMapWorkspaceLayout?.claim&&
         !root.NeuroMapWorkspaceLayout.claim(app,'linked-view'))return false;
      sideMode.set(state,wanted);
      if(!current&&primary==='mindmap'&&app.renderer?.camera){
        const offset=Math.round(Math.min(window.innerWidth*workspaceWidth(workspacePref(app).width)/100,850)*.48);
        // Restored tab cameras were already shifted when the split view was saved.
        // Applying the offset a second time would move the mind map on every restart.
        if(!(restoring==='recovery'&&workspaceOwner(app).camera))
          app.renderer.camera.x-=offset;
        sideShift.set(state,offset);
        app.requestRender?.();
      }
    }else{
      sideMode.delete(state);
      const offset=sideShift.get(state)||0;
      if(offset&&app.renderer?.camera){app.renderer.camera.x+=offset;app.requestRender?.()}
      sideShift.delete(state);
    }
    if(!restoring){
      const pref=workspacePref(app);
      pref.sideMode=sideMode.get(state)||null;
      pref.activeName=null;
      workspaceStates.add(state);
      app.scheduleSave?.();
    }
    queue(app);
  }
  // Per-tab presentation snapshots live in workspace recovery, never in node data.
  const workspaceStates=new WeakSet();
  const reopenedFromDisk=new WeakSet();
  const workspaceOwner=app=>app.tabs?.find(tab=>tab.id===app.activeTabId)||app;
  const workspacePref=app=>{
    const owner=workspaceOwner(app);
    if(!owner.viewWorkspace)owner.viewWorkspace={sideMode:null,width:50,layouts:[],activeName:null};
    if(!Array.isArray(owner.viewWorkspace.layouts))owner.viewWorkspace.layouts=[];
    return owner.viewWorkspace;
  };
  const workspaceWidth=value=>Number.isFinite(Number(value))?
    Math.max(30,Math.min(65,Math.round(Number(value)))):50;
  function workspaceMode(mode){
    return TYPE.some(([id])=>id===mode)&&mode!=='mindmap'?mode:null;
  }
  function restoreWorkspaceView(app){
    const state=app.state;
    if(!state||workspaceStates.has(state))return;
    workspaceStates.add(state);
    const fromFile=reopenedFromDisk.has(state);
    reopenedFromDisk.delete(state);
    const pref=workspacePref(app);
    if(workspaceMode(pref.sideMode)&&workspaceMode(pref.sideMode)!==core.mode(state.root?.viewMode))
      setSideMode(app,pref.sideMode,fromFile?true:'recovery');
  }
  function workspaceView(app,side,width,fromPreset=false,primaryMode='mindmap'){
    if(!app.state?.root)return false;
    const primary=core.mode(primaryMode),next=workspaceMode(side)===primary?null:workspaceMode(side),pref=workspacePref(app);
    if(primary!=='mindmap'&&!canProject(app,primary))return false;
    if(next&&!canProject(app,next))return false;
    // Claim the linked-view surface *before* changing either mode or saved
    // layout preferences. A protected draft may refuse the transition; in
    // that case no phantom secondary pane is persisted for later recovery.
    if(next&&root.NeuroMapWorkspaceLayout?.claim&&
       !root.NeuroMapWorkspaceLayout.claim(app,'linked-view')){
      queue(app);return false;
    }
    if(core.mode(app.state.root.viewMode)!==primary&&setMode(app,primary)===false)return false;
    pref.width=workspaceWidth(width);
    pref.sideMode=next;
    pref.activeName=fromPreset||null;
    setSideMode(app,next,true);
    app.scheduleSave?.();
    queue(app);
    return true;
  }
  function activeWorkspaceInfo(app){
    const pref=workspacePref(app),state=app.state;
    return {primaryMode:core.mode(state?.root?.viewMode),
      sideMode:sideMode.get(state)||null,width:workspaceWidth(pref.width)};
  }
  function saveWorkspaceLayout(app,name){
    const pref=workspacePref(app),label=String(name||'').trim().slice(0,50);
    if(!label){app.showToast?.(tr('Inserisci un nome per il layout.','Enter a layout name.'),'VISTE');return false}
    const existing=pref.layouts.findIndex(x=>x.name.toLocaleLowerCase()===label.toLocaleLowerCase());
    if(existing<0&&pref.layouts.length>=8){
      app.showToast?.(tr('Massimo otto layout personalizzati.','Maximum eight custom layouts.'),'VISTE');return false;
    }
    const next={name:label,...activeWorkspaceInfo(app)};
    if(existing>=0)pref.layouts[existing]=next;
    else pref.layouts.push(next);
    pref.activeName=label;
    app.scheduleSave?.();queue(app);return true;
  }
  function removeWorkspaceLayout(app){
    const pref=workspacePref(app),name=pref.activeName;
    if(!name)return false;
    pref.layouts=pref.layouts.filter(entry=>entry.name!==name);
    pref.activeName=null;
    app.scheduleSave?.();queue(app);return true;
  }
  function syncWorkspaceControls(app){
    const select=document.getElementById('nm-workspace-layouts'),name=document.getElementById('nm-workspace-layout-name'),
      width=document.getElementById('nm-workspace-width'),value=document.getElementById('nm-workspace-width-value'),
      remove=document.getElementById('nm-workspace-remove'),widthGroup=document.getElementById('nm-workspace-width-group');
    if(!select)return;
    const pref=workspacePref(app),isEnglish=document.documentElement.lang==='en';
    const modes=[['none',null,50,'Solo mappa','Mind map only'],['orgchart','orgchart',50,'Mappa + organigramma','Mind map + org chart'],
      ['kanban','kanban',50,'Mappa + Kanban','Mind map + Kanban'],['timeline','timeline',50,'Mappa + timeline','Mind map + timeline'],
      ['kanban-timeline','timeline',50,'Kanban + Timeline','Kanban + Timeline'],
      ['network-orgchart','orgchart',50,'Rete concettuale + Organigramma','Concept network + Org chart'],
      ['tree-flow','flowchart',50,'Albero concettuale + Flusso','Concept tree + Workflow']];
    const entries=[...modes.map(([id,mode,w,it,en])=>({id:'builtin:'+id,name:isEnglish?en:it,mode,width:w})),
      ...pref.layouts.map((item,i)=>({id:'user:'+i,name:'★ '+item.name,mode:item.sideMode,width:item.width}))];
    const selected=pref.activeName?
      entries.find(e=>e.id.startsWith('user:')&&e.name==='★ '+pref.activeName)?.id:null;
    select.replaceChildren();
    const current=document.createElement('option');current.value='current';current.textContent=tr('Disposizione corrente','Current layout');select.append(current);
    for(const entry of entries){
      const option=document.createElement('option');option.value=entry.id;if(entry.id.startsWith('user:'))option.dataset.glaukaUserContent='';option.textContent=entry.name;select.append(option);
    }
    select.value=selected||'current';
    const split=Boolean(sideMode.get(app.state));
    if(widthGroup)widthGroup.hidden=!split;
    if(width)width.value=String(workspaceWidth(pref.width));
    if(value)value.textContent=workspaceWidth(pref.width)+'%';
    if(remove){remove.disabled=!selected;remove.textContent=tr('Rimuovi','Remove');}
    if(name)name.placeholder=tr('Nome layout…','Layout name…');
    const label=document.getElementById('nm-workspace-caption');
    if(label)label.textContent=tr('Spazio di lavoro','Workspace');
    const save=document.getElementById('nm-workspace-save');
    if(save)save.textContent=tr('Salva layout','Save layout');
  }
  function changeAppearance(app,mode,patch,nodeId=null){
    if(!appearance||!app.state?.root||mode==='mindmap')return false;
    const current=app.state.root.viewAppearance;
    const next=appearance.update(current,mode,patch,nodeId);
    if(JSON.stringify(appearance.clean(current))===JSON.stringify(next))return false;
    app.state.pushHistory();
    app.state.root.viewAppearance=next;
    app.markChanged();
    queue(app);
    return true;
  }
  function resetAppearance(app,mode,nodeId=null){
    if(!appearance||!app.state?.root||mode==='mindmap')return false;
    const current=app.state.root.viewAppearance;
    const next=appearance.reset(current,mode,nodeId);
    if(JSON.stringify(appearance.clean(current))===JSON.stringify(next))return false;
    app.state.pushHistory();
    app.state.root.viewAppearance=next;
    app.markChanged();
    queue(app);
    return true;
  }
  function resetAppearanceProperty(app,mode,prop,nodeId=null){
    if(!appearance?.resetProperty||!app.state?.root||mode==='mindmap')return false;
    const current=app.state.root.viewAppearance;
    const next=appearance.resetProperty(current,mode,prop,nodeId);
    if(JSON.stringify(appearance.clean(current))===JSON.stringify(next))return false;
    app.state.pushHistory();
    app.state.root.viewAppearance=next;
    app.markChanged();
    queue(app);
    return true;
  }
  const appearanceGroupLabels=Object.freeze({
    theme:['Tema','Theme'],colors:['Colori','Colors'],nodes:['Nodi','Nodes'],
    links:['Collegamenti','Connections'],spacing:['Spaziatura','Spacing'],
    selected:['Selezionato','Selected']
  });
  function syncAppearancePanel(app,mode){
    const panel=document.getElementById('nm-view-appearance');
    if(!panel)return;
    panel.hidden=mode==='mindmap';
    if(panel.hidden||!appearance)return;
    const settings=viewStyle(app.state,mode);
    for(const section of panel.querySelectorAll('.nm-appearance-group')){
      const names=appearanceGroupLabels[section.dataset.group];
      const summary=section.querySelector('summary');
      if(names&&summary)summary.textContent=tr(...names);
    }
    const selected=app.state?.selectedNodeId;
    const scope=document.getElementById('nm-view-appearance-node');
    const validSelection=!!(selected&&app.state?.findNode?.(selected));
    // A removed/deselected node must never leave a stale node-only scope active.
    if(scope?.checked&&!validSelection)scope.checked=false;
    const scoped=!!(scope?.checked&&validSelection);
    const scopeHelp=document.getElementById('nm-view-appearance-help');
    const scopeReason=tr('Disponibile solo per tutta la vista: togli «Solo nodo selezionato».',
      'Available only for the whole view: uncheck “Selected node only”.');
    if(scopeHelp){
      // Bound live-region announcements for imported nodes with very long labels.
      // Count Unicode code points so truncation never splits emoji/surrogate pairs.
      const rawName=scoped?String(app.state.findNode(selected)?.text??'').trim():'';
      const namePoints=Array.from(rawName);
      const selectedName=namePoints.length>80?namePoints.slice(0,80).join('')+'…':rawName;
      const nodeDescription=tr('Stai modificando solo la presentazione di questo nodo in questa vista: Accento, Schede e Testo. Tema, collegamenti, dimensioni e spaziatura valgono per la vista intera.',
        'You are changing this node’s appearance only in this view: Accent, Cards and Text. Theme, connections, size and spacing apply to the entire view.');
      const description=scoped?
        (selectedName?tr('Nodo selezionato: ','Selected node: ')+selectedName+'. ':'')+nodeDescription:
        tr('Le modifiche qui cambiano solo la presentazione della vista, non il contenuto o i colori condivisi della mappa. Seleziona «Solo nodo selezionato» per personalizzare un singolo nodo.',
          'Changes here affect only the view appearance, not map content or shared node colors. Choose “Selected node only” to style one node.');
      // Avoid repeating live-region announcements on unrelated renders.
      if(scopeHelp.textContent!==description)scopeHelp.textContent=description;
    }
    const explainDisabled=control=>{
      if(!control)return;
      control.setAttribute('aria-describedby','nm-view-appearance-help');
      control.title=scoped?scopeReason:'';
    };
    const colors=viewStyle(app.state,mode,scoped?selected:null);
    const theme=document.getElementById('nm-view-appearance-theme');
    if(theme){
      if(theme._nmPresetMode!==mode){
        theme.replaceChildren();
        for(const preset of appearance.presetsFor(mode)){
          const option=document.createElement('option');option.value=preset;
          option.textContent=tr(...PRESET_NAMES[preset]);theme.append(option);
        }
        theme._nmPresetMode=mode;
      }
      theme.disabled=scoped;theme.value=settings.preset;explainDisabled(theme);
    }
    const preview=document.getElementById('nm-view-appearance-presets');
    if(preview){
      const language=document.documentElement.lang||'it';
      if(preview._nmMode!==mode||preview._nmLang!==language){
        preview.replaceChildren();
        for(const preset of appearance.presetsFor(mode)){
          const tokens=appearance.palette(mode,preset);
          const button=document.createElement('button');
          button.type='button';button.className='nm-appearance-preset';button.dataset.preset=preset;
          button.setAttribute('aria-label',tr('Usa tema ','Use theme ')+tr(...PRESET_NAMES[preset]));
          const swatch=document.createElement('span');swatch.className='nm-preset-swatch';
          swatch.style.backgroundColor=tokens.background;
          swatch.append(renderPresetThumbnail(mode,preset));
          const name=document.createElement('span');name.textContent=tr(...PRESET_NAMES[preset]);
          button.append(swatch,name);
          button.addEventListener('click',()=>changeAppearance(app,mode,{preset}));
          preview.append(button);
        }
        preview._nmMode=mode;preview._nmLang=language;
      }
      for(const button of preview.children){
        button.setAttribute('aria-pressed',String(button.dataset.preset===settings.preset));
        button.disabled=scoped;explainDisabled(button);
      }
    }
    const accent=document.getElementById('nm-view-appearance-accent');
    if(accent)accent.value=colors.accent;
    const surface=document.getElementById('nm-view-appearance-surface');
    if(surface)surface.value=colors.surface;
    const textColor=document.getElementById('nm-view-appearance-text');
    if(textColor)textColor.value=colors.text;
    const edgeColor=document.getElementById('nm-view-appearance-edge');
    if(edgeColor){edgeColor.disabled=scoped;edgeColor.value=settings.edge;explainDisabled(edgeColor)}
    const radius=document.getElementById('nm-view-appearance-radius');
    if(radius){
      radius.disabled=scoped;explainDisabled(radius);
      const value=String(settings.radius);
      if(!Array.from(radius.options).some(option=>option.value===value)){
        const option=document.createElement('option');option.value=value;option.textContent=value+' px';
        radius.append(option);
      }
      radius.value=value;
    }
    const fontSize=document.getElementById('nm-view-appearance-fontSize');
    if(fontSize){
      fontSize.disabled=scoped;explainDisabled(fontSize);
      const value=String(settings.fontSize);
      if(!Array.from(fontSize.options).some(option=>option.value===value)){
        const option=document.createElement('option');option.value=value;option.textContent=value+' px';
        fontSize.append(option);
      }
      fontSize.value=value;
    }
    const background=document.getElementById('nm-view-appearance-background');
    if(background){background.disabled=scoped;background.value=settings.background;explainDisabled(background)}
    const density=document.getElementById('nm-view-appearance-density');
    if(density){density.disabled=scoped;density.value=String(settings.density);explainDisabled(density)}
    const orientation=document.getElementById('nm-view-appearance-orientation');
    if(orientation){
      const control=orientation.parentElement;control.hidden=mode!=='orgchart';
      orientation.value=mode==='orgchart'?settings.orientation||'vertical':'vertical';
      orientation.disabled=scoped||mode!=='orgchart';
      explainDisabled(orientation);
    }
    if(scope)scope.disabled=!validSelection;
    const modeData=appearance.clean(app.state.root.viewAppearance).modes[mode];
    const reset=document.getElementById('nm-view-appearance-reset');
    if(reset){
      reset.disabled=scoped?!Boolean(modeData?.elements?.[selected]):!Boolean(modeData);
      reset.textContent=scoped?tr('Ripristina nodo','Reset node style'):tr('Ripristina vista','Reset view style');
      reset.setAttribute('aria-label',reset.textContent);
    }
    // Only list overrides that actually exist, so reset never changes default values.
    const propertyField=document.getElementById('nm-view-appearance-reset-property');
    const propertyButton=document.getElementById('nm-view-appearance-reset-single');
    if(propertyField&&propertyButton){
      const active=scoped?(modeData?.elements?.[selected]||{}):(modeData||{});
      const candidates=scoped?[
        ['accent','Accento','Accent'],['surface','Schede','Cards'],['text','Testo','Text']
      ]:[
        ['preset','Tema','Theme'],['accent','Accento','Accent'],
        ['surface','Schede','Cards'],['background','Sfondo','Background'],
        ['edge','Collegamenti','Connections'],['text','Testo','Text'],
        ['radius','Angoli','Corners'],['fontSize','Dimensione testo','Text size'],
        ['density','Spaziatura','Spacing'],
        ...(mode==='orgchart'?[['orientation','Direzione','Direction']]:[]),
        ...(mode==='timeline'?[['timeScale','Scala temporale','Time scale']]:[])
      ];
      const present=candidates.filter(([key])=>Object.prototype.hasOwnProperty.call(active,key)&&
        (key!=='preset'||active.preset!=='studio'));
      const signature=mode+'|'+String(scoped)+'|'+String(selected)+'|'+
        String(document.documentElement.lang)+'|'+present.map(([key])=>key).join(',');
      if(propertyField._nmOptionsSignature!==signature){
        const previous=propertyField.value;
        propertyField.replaceChildren();
        if(!present.length){
          const option=document.createElement('option');option.value='';
          option.textContent=tr('Nessuna modifica','No overrides');propertyField.append(option);
        }else for(const [key,it,en] of present){
          const option=document.createElement('option');option.value=key;
          option.textContent=tr(it,en);propertyField.append(option);
        }
        if(present.some(([key])=>key===previous))propertyField.value=previous;
        propertyField._nmOptionsSignature=signature;
      }
      propertyField.disabled=!present.length;
      propertyButton.disabled=!present.length;
      propertyButton.textContent=scoped?tr('Ripristina sul nodo','Reset on node'):
        tr('Ripristina nella vista','Reset in view');
    }
  }
