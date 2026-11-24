  function render(app){
    ensure(app);
    const state=app.state,rootNode=state?.root;
    if(!rootNode)return;
    closeNodeMenu(false);
    restoreWorkspaceView(app);
    const baseMode=core.mode(rootNode.viewMode);
    const chosenSide=sideMode.get(state)||null;
    const dual=baseMode!=='mindmap'&&!!chosenSide;
    const side=baseMode==='mindmap'?chosenSide:null;
    const mode=side||baseMode;
    // Popovers cannot survive a change of view or active project.
    if(lastView.get(app)!==String(app.activeTabId||'')+':'+mode+(side?':side':'')||lastRenderedState.get(app)!==state){
      const appearanceMenu=document.getElementById('nm-view-appearance');
      const exportMenu=document.getElementById('nm-view-export-menu');
      const layoutMenu=document.getElementById('nm-project-view-options');
      if(appearanceMenu)appearanceMenu.open=false;
      if(exportMenu)exportMenu.open=false;
      if(layoutMenu)layoutMenu.open=false;
    }

    if(side&&sideShift.has(state)&&app.renderer?.camera){
      const oldOffset=sideShift.get(state),newOffset=Math.round(Math.min(window.innerWidth*workspaceWidth(workspacePref(app).width)/100,850)*.48);
      if(oldOffset!==newOffset){
        app.renderer.camera.x+=oldOffset-newOffset;
        sideShift.set(state,newOffset);
        app.requestRender?.();
      }
    }
    const picker=document.getElementById('nm-view-picker'),overlay=document.getElementById('nm-view-overlay');
    const exportCaption=document.getElementById('nm-view-export-menu')?.querySelector('summary');if(exportCaption){exportCaption.textContent=tr('Esporta','Export');exportCaption.setAttribute('aria-label',tr('Opzioni di esportazione della vista','View export options'));exportCaption.title=exportCaption.getAttribute('aria-label')}
    if(!picker||!overlay)return;
    overlay.dataset.viewMode=mode;
    overlay.setAttribute('aria-label',tr('Vista collegata','Linked view'));
    const english=document.documentElement.lang==='en';
    picker.value=baseMode;
    const panelPicker=document.getElementById('nm-view-overlay-picker');if(panelPicker)panelPicker.value=mode;
    picker.setAttribute('aria-label',tr('Visualizza come','View as'));
    for(const select of [picker,panelPicker].filter(Boolean))for(const [i,opt]of [...select.options].entries())opt.textContent=TYPE[i][english?2:1];
    const optionsSummary=document.getElementById('nm-project-view-options')?.querySelector('summary');
    if(optionsSummary){optionsSummary.textContent=tr('Spazio di lavoro','Workspace');
      optionsSummary.setAttribute('aria-label',tr('Viste affiancate e layout salvati','Split views and saved layouts'));
      optionsSummary.title=optionsSummary.getAttribute('aria-label')}
    const appearanceSummary=document.getElementById('nm-view-appearance')?.querySelector('summary');
    if(appearanceSummary){appearanceSummary.textContent=tr('Aspetto','Appearance');
      appearanceSummary.setAttribute('aria-label',tr('Aspetto della vista','View appearance'));
      appearanceSummary.title=appearanceSummary.getAttribute('aria-label')}
    const viewLabel=document.querySelector('#nm-view-switch label');if(viewLabel)viewLabel.textContent=tr('Visualizza come','View as');
    const legacy=document.getElementById('nm-layout-modes');if(legacy)legacy.style.display=baseMode==='mindmap'?'':'none';
    if(panelPicker)panelPicker.setAttribute('aria-label',tr('Cambia vista','Change view'));
    picker.nmViewPicker?.sync();panelPicker?.nmViewPicker?.sync();
    syncNetworkToolbar(app,mode==='concept-network');
    syncFlowToolbar(app,mode==='flowchart');
    syncWorkToolbar(app,mode);
    syncAppearancePanel(app,mode);
    const orgSearch=document.getElementById('nm-orgchart-search');
    if(orgSearch){
      if(lastRenderedState.get(app)!==state)orgSearch.value='';
      orgSearch.hidden=mode!=='orgchart'&&!(dual&&chosenSide==='orgchart');
      const english=document.documentElement.lang==='en';
      orgSearch.placeholder=english?'Search org chart…':'Cerca nell’organigramma…';
      orgSearch.setAttribute('aria-label',english?
        'Search organization chart nodes':'Cerca nodi nell’organigramma');
    }
    const controlsHost=mode==='mindmap'?document.getElementById('nm-view-switch'):document.getElementById('nm-view-heading')?.parentElement;
    for(const id of ['nm-view-split','nm-project-view-options']){const control=document.getElementById(id);if(control&&controlsHost&&control.parentElement!==controlsHost)controlsHost.append(control)}
    overlay.classList.toggle('nm-side-panel',!!side);
    overlay.classList.toggle('nm-dual-view',dual);
    const dualPane=document.getElementById('nm-dual-pane');
    if(dualPane){dualPane.hidden=!dual;
      if(dual)dualPane.style.flex='0 0 '+workspaceWidth(workspacePref(app).width)+'%';}
    document.getElementById('nm-linked-panels')?.classList.toggle('nm-dual-active',dual);
    overlay.style.setProperty?.('--nm-split-width',workspaceWidth(workspacePref(app).width)+'vw');
    syncWorkspaceControls(app);
    const activeId=focusedIds.get(state),activeNode=activeId?state.findNode?.(activeId):null;
    for(const focusButton of [document.getElementById('nm-view-focus'),
      document.getElementById('nm-view-overlay-focus')].filter(Boolean)){
      focusButton.setAttribute('aria-pressed',String(!!activeId));
      focusButton.setAttribute('aria-label',activeId?
        tr('Disattiva filtro del ramo','Disable branch focus'):
        tr('Mostra solo il ramo selezionato','Show selected branch only'));
      focusButton.textContent=activeId?
        tr('Ramo: ','Branch: ')+String(activeNode?.text||activeId).slice(0,32):
        tr('Solo ramo selezionato','Selected branch only');
      focusButton.title=activeId?tr('Mostra di nuovo tutta la mappa',
        'Show the whole map again'):
        tr('Limita la vista al ramo selezionato, senza modificare la mappa',
          'Limit this view to the selected branch without modifying the map');
    }
    const splitButton=document.getElementById('nm-view-split');
    if(splitButton){
      // Mobile keeps split disabled so dock/sheets never share the screen.
      splitButton.disabled=!!root.GlaukaMobile;
      if(root.GlaukaMobile)splitButton.hidden=true;
      splitButton.setAttribute('aria-pressed',String(!!side||dual));
      splitButton.textContent=tr('Affianca','Split view');
      splitButton.setAttribute('aria-label',tr('Affianca una seconda vista','Show a second view'));
      splitButton.title=splitButton.getAttribute('aria-label');
    }
    const closingView=overlay.dataset.nmWasOpen==='1';
    overlay.hidden=baseMode==='mindmap'&&!side;
    overlay.dataset.nmWasOpen=overlay.hidden?'0':'1';
    globalThis.NeuroMapWorkspaceChrome?.refresh?.();
    if(root.GlaukaMobile){
      document.body.classList.toggle('nm-linked-view-open',!overlay.hidden);
      if(!overlay.hidden)root.GlaukaMobileShell?.dismissChrome?.();
    }
    if(overlay.hidden){
      overlay._nmCancelNativeGesture?.();
      releaseHiddenStage('nm-view-stage');lastView.delete(app);lastRenderedState.delete(app);
      renderDual(app,null,false);
      if(closingView && !globalThis._nmWorkspaceClaiming){
        const switcher=document.getElementById('nm-view-switch');
        if(switcher?.checkVisibility && !switcher.checkVisibility())
          document.getElementById('v6-show-layout')?.click();
      }
      return;
    }
    document.getElementById('nm-view-heading').textContent=TYPE.find(x=>x[0]===mode)[english?2:1];document.getElementById('nm-view-heading').title=document.getElementById('nm-view-heading').textContent;
    const backButton=document.getElementById('nm-view-back');
    backButton.textContent=side||dual?tr('Chiudi vista affiancata','Close split view'):tr('Torna alla mappa','Back to mind map');
    backButton.title=backButton.textContent;backButton.setAttribute('aria-label',backButton.textContent);
    const exportSvg=document.getElementById('nm-view-export-svg');
    exportSvg.textContent=tr('Esporta vista SVG','Export view SVG');
    exportSvg.title=exportSvg.textContent;exportSvg.setAttribute('aria-label',exportSvg.textContent);
    for(const [id,it,en] of [['nm-view-export-png1','Esporta vista PNG a scala 1×','Export view PNG at 1× scale'],['nm-view-export-png2','Esporta vista PNG a scala 2×','Export view PNG at 2× scale'],['nm-view-export-pdf','Esporta vista PDF','Export view PDF']]){
      const button=document.getElementById(id);if(!button)continue;
      const name=tr(it,en);button.setAttribute('aria-label',name);button.title=name;
    }
    for(const [id,it,en,glyph] of [['nm-view-zoom-out','Riduci zoom','Zoom out','−'],['nm-view-zoom-in','Aumenta zoom','Zoom in','+'],['nm-view-zoom-reset','Ripristina zoom','Reset zoom','100%']]){
      const button=document.getElementById(id);if(!button)continue;
      const name=tr(it,en);button.textContent=glyph;button.title=name;button.setAttribute('aria-label',name);
    }
    const fitButton=document.getElementById('nm-view-zoom-fit');
    if(fitButton){const name=tr('Adatta la vista alla finestra','Fit the view to the window');fitButton.textContent=tr('Adatta','Fit');fitButton.title=name;fitButton.setAttribute('aria-label',name)}
    overlay.querySelector('.nm-view-hint').textContent=focusedIds.has(state)?
      tr('Solo ramo selezionato · mappa originale intatta',
         'Selected branch only · original map unchanged'):
      side||dual?tr('Due viste · dati sincronizzati','Two views · synchronized data'):
      tr('Stessi nodi · dati sincronizzati','Same nodes · synchronized data');
    const mobile=!!root.GlaukaMobile;
    const shortcutHelp=mobile
      ?tr('Tocca un nodo per aprirlo, tieni premuto per le azioni, usa Indietro per chiudere la vista.',
          'Tap a node to open it, long-press for actions, use Back to leave the view.')+' '
      :tr('F2/Invio rinomina · Ins aggiunge figlio · Maiusc+F10 apre azioni · Esc chiude · Ctrl/Cmd+rotellina zoom. ',
          'F2/Enter rename · Ins adds child · Shift+F10 opens actions · Esc closes · Ctrl/Cmd+wheel zooms. ');
    document.getElementById('nm-view-help').textContent=shortcutHelp+(mode==='concept-network'?
      (mobile
        ?tr('Trascina i concetti per organizzarli; premi Collega e seleziona due nodi per creare una relazione con etichetta.','Drag concepts to arrange them; press Link and select two nodes to create a labeled relationship.')
        :tr('Trascina i concetti per organizzarli; premi Collega e seleziona due nodi per creare una relazione con etichetta. Esc annulla.','Drag concepts to arrange them; press Link and select two nodes to create a labeled relationship. Esc cancels.')):
      mode==='flowchart'
      ?tr('Usa + per un passaggio, Sì o No per una decisione. Nessuna sequenza viene dedotta dai rami.','Use + for a step, Yes or No for a decision. No process order is inferred from branches.')
      :mode==='kanban'?(mobile
        ?tr('Trascina le schede per riordinarle, anche fra colonne. Ogni spostamento si annulla con Annulla.','Drag cards to reorder within or across columns. Every move supports Undo.')
        :tr('Trascina le schede per riordinarle, anche fra colonne. Tastiera: Alt+frecce. Ogni spostamento si annulla con Annulla.','Drag cards to reorder within or across columns. Keyboard: Alt+arrows. Every move supports Undo.'))
      :mode==='timeline'?tr('Scrivi inizio e scadenza sulla scheda. I prerequisiti sono linee verdi, i possibili conflitti di scadenza in rosa. Nessuna data viene spostata da sola.','Type the start and due date on the card. Green predecessor links, pink potential conflicts. Dates never move on their own.')
      :mode==='orgchart'||mode==='concept-tree'?tr('Trascina un ramo sopra un altro per metterlo al livello sotto. Un ramo non può entrare dentro se stesso. Annulla ripristina.','Drag a branch onto another to place it one level below. A branch cannot move inside itself. Undo restores it.')
      :tr('Seleziona un nodo, modifica il contenuto o aggiungi un sottoramo.','Select a node, edit its content or add a child.'));
    document.getElementById('nm-view-help').title=document.getElementById('nm-view-help').textContent;
    const stage=document.getElementById('nm-view-stage');
    if(stage)stage.dataset.viewMode=mode;
    const oldScroll=document.getElementById('nm-view-scroller'),beforeX=oldScroll.scrollLeft,beforeY=oldScroll.scrollTop;
    // Do not erase an active inline editor when only a canvas render is requested.
    const editing=stage.querySelector('.nm-view-edit');
    if(editing){
      if(editing._nmViewOwner===state&&editing._nmViewMode===mode){
        // The primary editor must remain intact, but a secondary-only mode
        // switch still needs its own render (and must not stall behind edit).
        renderDual(app,chosenSide,dual);
        return;
      }
      editing.blur(); // commit to the original tab before the view is replaced
    }
    let layout;
    try{layout=projected(state,mode)}
    catch(error){
      stage.replaceChildren();
      stage.textContent=tr('Impossibile disporre la vista: ','Cannot lay out view: ')+error.message;
      return;
    }
    if(mode==='timeline')timelineScaleHint(layout,false);
    const manualOverlaps=mode==='concept-network'?overlappingManualConcepts(layout.nodes):null;
    const cam=getCamera(app,mode,!!side);
    const sceneStyle=viewStyle(state,mode);
    const modeElements=appearance?.clean(state.root.viewAppearance).modes[mode]?.elements||null;
    styleScene(oldScroll,sceneStyle);
    stage.style.width=layout.width+'px';stage.style.height=layout.height+'px';
    stage.style.transform='scale('+cam.zoom+')';
    stage.dataset.orgDetail=mode==='orgchart'&&cam.zoom<.62?'overview':'detail';
    const frame=document.getElementById('nm-view-frame');
    frame.style.width=Math.ceil(layout.width*cam.zoom)+'px';
    frame.style.height=Math.ceil(layout.height*cam.zoom)+'px';
    document.getElementById('nm-view-zoom-status').textContent=Math.round(cam.zoom*100)+'%';
    stage.replaceChildren();
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.id='nm-view-lines';svg.setAttribute('viewBox','0 0 '+layout.width+' '+layout.height);
    if(mode==='timeline')timelineAxis(svg,layout,sceneStyle);
    const coords=new Map(layout.nodes.map(n=>[n.id,n]));
    const networkLabels=mode==='concept-network'?network.placeLabels(layout):null;
    const netEdges=[];
    if(mode==='flowchart')addFlowArrowMarkers(svg,'nm-flow-process',sceneStyle);
    if(mode==='flowchart'||mode==='concept-network'||mode==='timeline'){
      const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
      const marker=document.createElementNS('http://www.w3.org/2000/svg','marker');
      marker.setAttribute('id','nm-flow-arrow');marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');
      marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');
      const tip=document.createElementNS('http://www.w3.org/2000/svg','path');tip.setAttribute('d','M0 0 L10 5 L0 10 z');tip.setAttribute('fill',sceneStyle?.edge||'#9cafd1');
      marker.append(tip);defs.append(marker);svg.append(defs);
    }
    for(const edge of layout.edges){
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      const a=coords.get(edge.fromId),b=coords.get(edge.toId);
      path.setAttribute('d',mode==='timeline'?timelineDependencyPath(a,b):mode==='flowchart'?flows.path(a,b,edge.kind):mode==='concept-network'?network.path(a,b):core.path(a,b,mode));
      path.setAttribute('fill','none');path.setAttribute('stroke',mode==='flowchart'?semanticFlowColor(edge.kind,sceneStyle):sceneStyle?.edge||'#8295b7');
      path.setAttribute('stroke-width','1.7');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
      if(mode==='orgchart'||mode==='concept-tree'){
        path.classList.add('nm-hierarchy-edge');
        path.setAttribute('stroke-opacity','.72');
        if(state.selectedNodeId&&(edge.toId===state.selectedNodeId||edge.fromId===state.selectedNodeId))
          path.classList.add('is-hierarchy-active');
      }
      if(mode==='timeline'){
        decorateTimelineDependency(path,edge,a,b,sceneStyle);
        path.setAttribute('marker-end','url(#nm-flow-arrow)');
      }
      if(mode==='flowchart')path.setAttribute('marker-end',flowArrowId('nm-flow-process',edge.kind));
      if(mode==='concept-network'){
         path.setAttribute('stroke',edge.type==='relation'?sceneStyle?.accent||'#a78bfa':sceneStyle?.edge||'#8295b7');
         if(edge.type==='hierarchy')path.setAttribute('stroke-opacity','.62');
         if(edge.type==='relation'){path.setAttribute('stroke-width','2.5');path.setAttribute('marker-end','url(#nm-flow-arrow)')}
       }
      if(mode==='concept-network'){
        describeNetworkEdge(path,edge);
        if(edge.type==='relation'){
          path.classList.add('nm-network-edge');
          path.dataset.relationId=String(edge.id);
        }
      }
      svg.append(path);
      if(mode==='concept-network'){
        const visual=edge.type==='relation'&&edge.label?
          drawNetworkLabel(svg,edge,networkLabels.get(edge.id),sceneStyle):null;
        netEdges.push({edge,path,visual});
      }
      if(mode==='flowchart'&&edge.kind!=='sequence'){
        const label=document.createElementNS('http://www.w3.org/2000/svg','text');
        label.textContent=edge.kind==='yes'?tr('Sì','Yes'):tr('No','No');
        const position=flows.labelPoint(a,b,edge.kind);
        label.setAttribute('x',String(position.x));label.setAttribute('y',String(position.y));
        label.setAttribute('fill',semanticFlowColor(edge.kind,sceneStyle));
        label.setAttribute('font-size','12');label.setAttribute('text-anchor','middle');svg.append(label);
      }
    }
    stage.append(svg);
    if(mode==='kanban')for(const column of layout.columns){
      const zone=document.createElement('div');zone.className='nm-kanban-dropzone';
      zone.dataset.status=column.id;
      zone.style.left=(column.x-column.width/2)+'px';zone.style.width=column.width+'px';
      zone.style.height=Math.max(240,layout.height-40)+'px';
      stage.append(zone);
      const header=document.createElement('div');header.className='nm-work-column';
      header.style.left=(column.x-column.width/2)+'px';header.dataset.status=column.id;
      header.style.setProperty?.('--nm-kanban-status',kanbanStatusColor(column.id));
      header.style.color=sceneStyle?.text||'#cbd5e1';
      header.textContent=tr(...({unassigned:['Da classificare','Unassigned'],todo:['Da fare','To do'],doing:['In corso','In progress'],done:['Completato','Done']}[column.id]))+' · '+column.count;
      stage.append(header);
    }
    if(mode==='timeline'&&layout.empty){
      const blank=document.createElement('p');blank.className='nm-work-blank';
      blank.textContent=tr('Nessuna data assegnata. Seleziona un nodo e indica Inizio e/o Fine per posizionarlo nel tempo.',
       'No dates assigned. Select a node and enter a start and/or due date to place it on the timeline.');
      stage.append(blank);
    }
    const addFlowDecision=(host,nodeId)=>{
      for(const [kind,it,en] of [['yes','Sì','Yes'],['no','No','No']]){
        const step=document.createElement('button');step.type='button';step.className='nm-view-flow-step';step.textContent=tr(it,en);
        step.setAttribute('aria-label',tr(kind==='yes'?'Aggiungi un passaggio Sì da ':'Aggiungi un passaggio No da ',
          kind==='yes'?'Add a Yes step from ':'Add a No step from ')+ (state.findNode(nodeId)?.text||''));
        step.addEventListener('click',event=>{
          event.stopPropagation();
          const before=app.state.relationships.length;
          addChild(app,nodeId,true);
          const edge=app.state.relationships[app.state.relationships.length-1];
          if(edge&&app.state.relationships.length===before+1&&edge.fromId===nodeId){
            edge.kind=kind;edge.label=tr(it,en);
          }
          queue(app);
        });
        host.append(step);
      }
    };
    if(mode==='flowchart'&&layout.empty){
      const blank=document.createElement('p');blank.className='nm-flow-empty';
      blank.textContent=tr('Nessun collegamento di processo. Premi Sì o No per creare il primo passaggio, oppure collega due nodi già presenti.','No process link yet. Press Yes or No to create the first step, or connect two nodes that already exist.');
      const actions=document.createElement('div');actions.className='nm-flow-empty-actions';
      addFlowDecision(actions,state.findNode(state.selectedNodeId)?.id||rootNode.id);
      stage.append(blank,actions);
    }
    const orgImages=(mode==='orgchart'||mode==='concept-tree')?orgAttachedImages(state):null;
    const fragment=document.createDocumentFragment();
    for(const n of layout.nodes){
      const card=document.createElement('div');
      card.className='nm-view-card'+(mode==='concept-network'?' nm-network-card':'')+(n.depth===0&&mode!=='flowchart'&&mode!=='kanban'&&mode!=='timeline'?' is-root':'')+
        (n.decision?' is-decision':'')+(['kanban','timeline'].includes(mode)?' nm-work-card':'')+(mode==='timeline'?' nm-timeline-card':'');
      card.tabIndex=0;card.role='button';card.dataset.nodeId=n.id;
      card.setAttribute('aria-selected',String(n.id===state.selectedNodeId));
      card.setAttribute('aria-label',n.text);
      cardBox(n,card);
      styleCard(card,state,mode,n,sceneStyle,modeElements);
       decorateNetworkCard(card,mode,n,manualOverlaps);
       decorateTreeCard(card,mode,n,orgImages?.get(n.id));
       decorateOrgCard(card,mode,n,orgImages?.get(n.id));
       decorateKanbanCard(card,mode,n);
       decorateFlowCard(card,mode,n);
      if(mode==='timeline'){
        if(n.milestone)card.classList.add('is-milestone');
        card.setAttribute('aria-label',n.text+' · '+timelineDateCaption(n));
        card.title=card.getAttribute('aria-label');
        const title=addTimelineTitle(stage,n,viewStyle(state,mode,n.id));
        card.addEventListener('click',()=>{app.selectNode(n.id);document.getElementById('nm-work-node').value=n.id;syncWorkFields(app);
          for(const other of stage.querySelectorAll('.nm-view-card'))other.setAttribute('aria-selected',String(other.dataset.nodeId===n.id));});
        card.addEventListener('dblclick',event=>{
          event.stopPropagation();edit(app,n.id,card,mode);
        });
        bindCardCommands(app,card,n.id,mode);
        const dates=document.createElement('div');dates.className='nm-timeline-edit';
        const live=state.findNode(n.id);
        for(const [key,it,en] of [['startDate','Inizio','Start'],['dueDate','Scadenza','Due']]){
          const field=document.createElement('input');field.type='date';field.className='nm-timeline-field';
          field.value=live?.[key]||'';
          field.setAttribute('aria-label',tr(it,en)+' · '+n.text);
          field.title=field.getAttribute('aria-label');
          field.addEventListener('pointerdown',event=>event.stopPropagation());
          field.addEventListener('click',event=>event.stopPropagation());
          field.addEventListener('dblclick',event=>event.stopPropagation());
          field.addEventListener('change',()=>{
            const current=state.findNode(n.id);
            const patch={[key]:field.value||''};
            if(state.setNodeWorkMetadata?.(n.id,patch)){app.markChanged();queue(app);}
            else{field.value=current?.[key]||'';
              app.showToast?.(tr('Intervallo non valido: l’inizio non può seguire la scadenza.','Invalid range: the start cannot follow the due date.'),'VISTA');}
          });
          dates.append(field);
        }
        title.append(dates);
        fragment.append(card);continue;
      }
      const label=document.createElement('span');label.className='nm-view-title';
      if(sceneStyle){
        const typography=mode==='concept-tree'?
          appearance.treeTypography(n.depth,sceneStyle.fontSize):null;
        label.style.fontSize=(typography?.fontSize??sceneStyle.fontSize)+'px';
        if(mode==='orgchart'&&sceneStyle.fontSize>=16)label.dataset.orgLargeFont='true';
        if(typography)label.style.fontWeight=String(typography.fontWeight);
      }
      label.dataset.glaukaUserContent='';label.textContent=n.text;label.title=n.text;
      if(n.hiddenChildren)label.title+=tr(' (ramo chiuso)',' (collapsed branch)');
      const add=document.createElement('button');add.type='button';add.className='nm-view-add';add.textContent='+';
      add.setAttribute('aria-label',tr('Aggiungi sottoramo a ','Add child to ')+n.text);
      add.addEventListener('click',event=>{event.stopPropagation();addChild(app,n.id,mode==='flowchart')});
      card.append(label);
      const liveNode=state.findNode(n.id);
      if(['orgchart','concept-tree'].includes(mode)&&n.depth!==0&&liveNode?.children?.length){
        const collapse=document.createElement('button');collapse.type='button';collapse.className='nm-view-collapse';
        decorateCollapseControl(collapse,!!liveNode.collapsed,n.text);
        if(liveNode.collapsed)collapse.classList.add('is-collapsed-persistent');
        collapse.addEventListener('click',event=>{event.stopPropagation();if(state.toggleCollapse(n.id))app.markChanged()});
        card.append(collapse);
      }
      card.append(add);
      if(mode==='flowchart'&&n.id===(layout.nodes.some(item=>item.id===state.selectedNodeId)?state.selectedNodeId:layout.nodes[0]?.id)){
        const actions=document.createElement('div');actions.className='nm-view-flow-actions';
        addFlowDecision(actions,n.id);card.append(actions);
      }
      if((mode==='orgchart'||mode==='concept-tree')&&n.depth!==0){
        card.draggable=true;
        card.title=tr('Trascina sopra un altro ramo per spostarlo','Drag onto another branch to move it');
        card.addEventListener('dragstart',event=>{
          if(event.target?.closest?.('button,input,select')){event.preventDefault();return}
          stage._nmTreeDrag=n.id;
          event.dataTransfer?.setData?.('text/plain',n.id);
          if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
        });
        card.addEventListener('dragend',()=>{stage._nmTreeDrag=null;
          stage.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'))});
      }
      if(mode==='orgchart'||mode==='concept-tree'){
        card.addEventListener('dragover',event=>{
          const sourceId=stage._nmTreeDrag;
          if(!sourceId||sourceId===n.id)return;
          event.preventDefault();card.classList.add('is-drop-target');
        });
        card.addEventListener('dragleave',()=>card.classList.remove('is-drop-target'));
        card.addEventListener('drop',event=>{
          event.preventDefault();card.classList.remove('is-drop-target');
          const sourceId=stage._nmTreeDrag||event.dataTransfer?.getData?.('text/plain');
          stage._nmTreeDrag=null;
          if(!sourceId||sourceId===n.id||typeof app.v5ReparentNode!=='function')return;
          if(app.v5ReparentNode(sourceId,n.id,false,true))
            announceViewAction('Ramo spostato','Branch moved');
          else app.showToast?.(tr('Quel ramo non può entrare dentro se stesso.','That branch cannot move inside itself.'),'VISTA');
          queue(app);
        });
      }
      if(mode==='kanban'&&n.dependsOn?.length){
        const names=n.dependsOn.map(id=>state.findNode(id)?.text).filter(Boolean);
        if(names.length){
          const note=document.createElement('small');note.className='nm-kanban-deps';
          note.textContent=tr('Prima: ','Before: ')+names.join(', ');
          note.title=note.textContent;card.append(note);
        }
      }
      if(mode==='kanban'){
        card.draggable=true;
        card.addEventListener('dragstart',event=>{
          if(event.target.closest('button,input,select')){event.preventDefault();return}
          stage._nmDragId=n.id;
          if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',n.id)}
          card.classList.add('is-dragging');
        });
        card.addEventListener('dragend',()=>{stage._nmDragId=null;card.classList.remove('is-dragging');
          kanbanClearDropHints(stage)});
        // HTML drag-and-drop is unreliable on touchscreens: mirror it with
        // pointer gestures, but never create a second data model or Undo step.
        let touchDrag=null;
        card.addEventListener('pointerdown',event=>{
          if(event.pointerType!=='touch'||touchDrag||event.target.closest('button,input,select'))return;
          touchDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
          card.setPointerCapture?.(event.pointerId);
        });
        card.addEventListener('pointermove',event=>{
          if(!touchDrag||touchDrag.id!==event.pointerId||
             stage._nmGesturePinching||stage._nmPinchIds.has(event.pointerId))return;
          if(!touchDrag.moved&&Math.hypot(event.clientX-touchDrag.x,event.clientY-touchDrag.y)<12)return;
          touchDrag.moved=true;
          const target=kanbanColumnAt(app,event);
          kanbanPreviewDrop(stage,target,kanbanInsertionAt(stage,target,event.clientY,n.id));
          event.preventDefault();
        });
        const finishTouchDrag=event=>{
          if(!touchDrag||touchDrag.id!==event.pointerId)return;
          const pending=touchDrag;touchDrag=null;
          const cancelled=event.type==='pointercancel'||stage._nmGesturePinching||stage._nmPinchIds.has(event.pointerId);
          if(!cancelled&&pending.moved){
            const status=kanbanColumnAt(app,event);
            const before=kanbanInsertionAt(stage,status,event.clientY,n.id);
            card._nmDragged=true;
            kanbanApplyMove(app,stage,n.id,status,before);
          }
          kanbanClearDropHints(stage);
          if(card.hasPointerCapture?.(event.pointerId))card.releasePointerCapture(event.pointerId);
        };
        card.addEventListener('pointerup',finishTouchDrag);
        card.addEventListener('pointercancel',finishTouchDrag);
        card.addEventListener('click',event=>{
          if(!card._nmDragged)return;
          card._nmDragged=false;event.preventDefault();event.stopImmediatePropagation();
        },true);
      }
      if(mode==='concept-network'){
        if(linking.get(state)?.source===n.id)card.classList.add('is-link-source');
        let pointer=null;
        const updateLines=()=>{
          const placements=network.placeLabels(layout);
          for(const item of netEdges){
            const from=coords.get(item.edge.fromId),to=coords.get(item.edge.toId);
            item.path.setAttribute('d',network.path(from,to));
            if(item.visual)updateNetworkLabelVisual(item.visual,placements.get(item.edge.id));
          }
        };
        card.addEventListener('pointerdown',event=>{
          if(event.button!==0||event.target.closest('button,input'))return;
          pointer={id:event.pointerId,x:event.clientX,y:event.clientY,originX:n.x,originY:n.y,moved:false};
          stage._nmNetworkDragging=true;clearNetworkNeighborhood(stage);
          card.setPointerCapture?.(event.pointerId);
        });
        card.addEventListener('pointermove',event=>{
          if(!pointer||pointer.id!==event.pointerId)return;
          if(stage._nmGesturePinching||stage._nmPinchIds.has(event.pointerId))return;
          const dx=(event.clientX-pointer.x)/cam.zoom,dy=(event.clientY-pointer.y)/cam.zoom;
          if(!pointer.moved&&Math.hypot(dx,dy)<5)return;
          pointer.moved=true;stage._nmNetworkDragging=true;
          n.x=Math.max(115,Math.min(20000,Math.round(pointer.originX+dx)));
          n.y=Math.max(65,Math.min(20000,Math.round(pointer.originY+dy)));
          card.style.left=n.x+'px';card.style.top=n.y+'px';
          layout.width=Math.max(layout.width,n.x+n.w/2+130);
          layout.height=Math.max(layout.height,n.y+n.h/2+130);
          stage.style.width=layout.width+'px';stage.style.height=layout.height+'px';
          frame.style.width=Math.ceil(layout.width*cam.zoom)+'px';frame.style.height=Math.ceil(layout.height*cam.zoom)+'px';
          svg.setAttribute('viewBox','0 0 '+layout.width+' '+layout.height);
          updateLines();
        });
        const finishDrag=event=>{
          if(!pointer||pointer.id!==event.pointerId)return;
          const last=pointer;pointer=null;stage._nmNetworkDragging=false;
          if(event.type==='pointercancel'||stage._nmGesturePinching||stage._nmPinchIds.has(event.pointerId)){
            n.x=last.originX;n.y=last.originY;card.style.left=n.x+'px';card.style.top=n.y+'px';updateLines();
          }else if(last.moved){
            card._nmDragged=true;
            if(state.setNodeNetworkPosition(n.id,{x:n.x,y:n.y}))app.markChanged();
          }
          if(card.hasPointerCapture?.(event.pointerId))card.releasePointerCapture(event.pointerId);
        };
        card.addEventListener('pointerup',finishDrag);
        card.addEventListener('pointercancel',finishDrag);
        card.addEventListener('click',event=>{
          if(card._nmDragged){card._nmDragged=false;event.preventDefault();event.stopImmediatePropagation()}
        },true);
      }
      card.addEventListener('click',()=>{if(mode==='concept-network'&&connectNetworkNode(app,n.id))return;app.selectNode(n.id);
        if(mode==='kanban'){document.getElementById('nm-work-node').value=n.id;syncWorkFields(app)}
        if(mode==='flowchart')queue(app);
        for(const c of stage.querySelectorAll('.nm-view-card'))c.setAttribute('aria-selected',String(c.dataset.nodeId===n.id))});
      card.addEventListener('dblclick',event=>{if(event.target.closest('.nm-view-add'))return;event.stopPropagation();edit(app,n.id,card)});
      bindCardCommands(app,card,n.id,mode);
      if(mode==='kanban')bindKanbanReorderKeys(app,card,n,stage);
      fragment.append(card);
    }
    stage.append(fragment);
    if(mode==='concept-network'){
      const overlay=document.getElementById('nm-view-overlay');
      overlay?.classList.toggle('nm-network-large',(layout.nodes||[]).length>220);
      const temp=networkPreview.get(app);
      if(temp?.nodes){
        const cardById=new Map();
        for(const card of stage.querySelectorAll('.nm-network-card'))
          if(card.dataset.nodeId)cardById.set(card.dataset.nodeId,card);
        for(const n of layout.nodes){
          const moved=temp.nodes.get(n.id);
          if(!moved||n.manual)continue;
          n.x=moved.x;n.y=moved.y;
          const card=cardById.get(n.id);
          if(card){card.style.left=n.x+'px';card.style.top=n.y+'px'}
        }
        const placements=network.placeLabels(layout);
        for(const item of netEdges){
          const from=coords.get(item.edge.fromId),to=coords.get(item.edge.toId);
          if(from&&to)item.path.setAttribute('d',network.path(from,to));
          if(item.visual)updateNetworkLabelVisual(item.visual,placements.get(item.edge.id));
        }
      }
      bindNetworkNeighborhood(stage,layout,netEdges);
    }
    if(mode==='orgchart')applyOrgSearch(stage,orgSearch?.value||'');
    const viewKey=String(app.activeTabId||'')+':'+mode+(side?':side':'');
    if(lastView.get(app)!==viewKey||lastRenderedState.get(app)!==state){
      const center=coords.get(rootNode.id)||layout.nodes[0];
      if(cam.left!==null&&cam.top!==null){oldScroll.scrollLeft=cam.left;oldScroll.scrollTop=cam.top}
      else if(mode==='timeline'){oldScroll.scrollLeft=0;oldScroll.scrollTop=0}
      else if(mode==='orgchart'){
        const cards=[...stage.querySelectorAll('.nm-view-card')];
        const top=cards.length?Math.min(...cards.map(card=>Number.parseFloat(card.style.top)||0)):center?.y||0;
        const lefts=cards.map(card=>Number.parseFloat(card.style.left)||0);
        const mid=lefts.length?(Math.min(...lefts)+Math.max(...lefts))/2:(center?.x||0);
        oldScroll.scrollLeft=Math.max(0,mid*cam.zoom-oldScroll.clientWidth/2);
        oldScroll.scrollTop=Math.max(0,(top-48)*cam.zoom);
      }
      else if(center){oldScroll.scrollLeft=Math.max(0,center.x*cam.zoom-oldScroll.clientWidth/2);
      oldScroll.scrollTop=Math.max(0,center.y*cam.zoom-oldScroll.clientHeight/3)}
      lastView.set(app,viewKey);lastRenderedState.set(app,state);
    }else{oldScroll.scrollLeft=beforeX;oldScroll.scrollTop=beforeY;}
    cam.left=oldScroll.scrollLeft;cam.top=oldScroll.scrollTop;
    renderDual(app,chosenSide,dual);
  }
