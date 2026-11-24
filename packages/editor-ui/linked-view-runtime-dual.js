  function renderDual(app,secondary,visible){
    const pane=document.getElementById('nm-dual-pane'),panels=document.getElementById('nm-linked-panels');
    if(!pane)return;
    pane.hidden=!visible;panels?.classList.toggle('nm-dual-active',!!visible);
    if(!visible){
      delete pane.dataset.viewMode;
      releaseHiddenStage('nm-dual-stage');lastDualView.delete(app);lastDualState.delete(app);
      const task=document.getElementById('nm-dual-task');
      if(task){delete task._nmSourceState;delete task._nmSelected}
      return;
    }
    pane.style.flex='0 0 '+workspaceWidth(workspacePref(app).width)+'%';
    const picker=document.getElementById('nm-dual-picker'),caption=document.getElementById('nm-dual-caption'),
      sc=document.getElementById('nm-dual-scroller'),frame=document.getElementById('nm-dual-frame'),
      stage=document.getElementById('nm-dual-stage'),state=app.state;
    pane.dataset.viewMode=secondary;
    if(stage)stage.dataset.viewMode=secondary;
    const english=document.documentElement.lang==='en';
    caption.textContent=tr('Seconda vista','Second view');
    document.getElementById('nm-dual-fit').textContent=tr('Adatta','Fit');
    for(const [id,it,en] of [['nm-dual-zoom-out','Riduci zoom seconda vista','Zoom out second view'],['nm-dual-zoom-in','Aumenta zoom seconda vista','Zoom in second view'],['nm-dual-fit','Adatta seconda vista','Fit second view'],['nm-dual-close','Chiudi seconda vista','Close second view']]){
      const control=document.getElementById(id);if(!control)continue;
      const name=tr(it,en);control.title=name;control.setAttribute('aria-label',name);
    }
    for(const [i,option]of [...picker.options].entries())option.textContent=TYPE[i][english?2:1];
    picker.value=secondary;
    syncDualTools(app,secondary);
    const editing=stage.querySelector('.nm-view-edit');
    if(editing){
      // A rename can outlive a paint, but not a change of secondary mode/tab.
      // The editor's original state owns the save, then we render the new view.
      if(editing._nmViewOwner===state&&editing._nmViewMode===secondary)return;
      editing.blur();
    }
    let layout;
    try{layout=projected(state,secondary)}catch(error){
      stage.replaceChildren();
      const warning=document.createElement('p');warning.className='nm-dual-message';
      warning.textContent=tr('Vista non disponibile: ','View unavailable: ')+String(error?.message||error);
      stage.append(warning);return;
    }
    if(secondary==='timeline')timelineScaleHint(layout,true);
    const manualOverlaps=secondary==='concept-network'?overlappingManualConcepts(layout.nodes):null;
    const cam=getCamera(app,secondary,true),previousLeft=sc.scrollLeft,previousTop=sc.scrollTop;
    const sceneStyle=viewStyle(state,secondary);
    const modeElements=appearance?.clean(state.root.viewAppearance).modes[secondary]?.elements||null;
    styleScene(sc,sceneStyle);
    stage.replaceChildren();
    stage.style.width=layout.width+'px';stage.style.height=layout.height+'px';
    stage.style.transform='scale('+cam.zoom+')';
    stage.dataset.orgDetail=secondary==='orgchart'&&cam.zoom<.62?'overview':'detail';
    frame.style.width=Math.ceil(layout.width*cam.zoom)+'px';
    frame.style.height=Math.ceil(layout.height*cam.zoom)+'px';
    document.getElementById('nm-dual-zoom-status').textContent=Math.round(cam.zoom*100)+'%';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.classList.add('nm-dual-lines');
    svg.setAttribute('viewBox','0 0 '+layout.width+' '+layout.height);
    const coords=new Map(layout.nodes.map(n=>[n.id,n]));
    const networkLabels=secondary==='concept-network'?network.placeLabels(layout):null;
    if(secondary==='flowchart')addFlowArrowMarkers(svg,'nm-dual-process',sceneStyle);
    if(secondary==='timeline'){
      timelineAxis(svg,layout,sceneStyle);
      const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
      const marker=document.createElementNS('http://www.w3.org/2000/svg','marker');
      marker.setAttribute('id','nm-dual-timeline-arrow');
      for(const [k,v]of Object.entries({viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'}))
        marker.setAttribute(k,String(v));
      const tip=document.createElementNS('http://www.w3.org/2000/svg','path');
      tip.setAttribute('d','M0 0 L10 5 L0 10 z');
      tip.setAttribute('fill',sceneStyle?.edge||'#9cafd1');
      marker.append(tip);defs.append(marker);svg.append(defs);
    }
    for(const edge of layout.edges||[]){
      const a=coords.get(edge.fromId),z=coords.get(edge.toId);if(!a||!z)continue;
      const link=document.createElementNS('http://www.w3.org/2000/svg','path');
      link.setAttribute('d',secondary==='timeline'?timelineDependencyPath(a,z):
        secondary==='flowchart'?flows.path(a,z,edge.kind):
        secondary==='concept-network'?network.path(a,z):core.path(a,z,secondary));
      link.setAttribute('fill','none');
      link.setAttribute('stroke',secondary==='flowchart'?semanticFlowColor(edge.kind,sceneStyle):edge.conflict?'#fb7185':
        secondary==='timeline'?'#46d2bd':sceneStyle?.edge||'#8295b7');
      link.setAttribute('stroke-width',secondary==='concept-network'&&edge.type==='relation'?'2.5':'1.7');
      link.setAttribute('stroke-linecap','round');link.setAttribute('stroke-linejoin','round');
      if(secondary==='orgchart'||secondary==='concept-tree'){
        link.classList.add('nm-hierarchy-edge');
        link.setAttribute('stroke-opacity','.72');
        if(state.selectedNodeId&&(edge.toId===state.selectedNodeId||edge.fromId===state.selectedNodeId))
          link.classList.add('is-hierarchy-active');
      }
       if(secondary==='concept-network'){
         link.setAttribute('stroke',edge.type==='relation'?sceneStyle?.accent||'#a78bfa':sceneStyle?.edge||'#8295b7');
         if(edge.type==='hierarchy')link.setAttribute('stroke-opacity','.62');
       }
      if(secondary==='concept-network'){
        describeNetworkEdge(link,edge);
        if(edge.type==='relation'){
          link.classList.add('nm-network-edge');
          link.dataset.relationId=String(edge.id);
        }
      }
      if(secondary==='flowchart')link.setAttribute('marker-end',flowArrowId('nm-dual-process',edge.kind));
      if(secondary==='timeline'){
        decorateTimelineDependency(link,edge,a,z,sceneStyle);
        link.setAttribute('marker-end','url(#nm-dual-timeline-arrow)');
      }
      svg.append(link);
      if(secondary==='concept-network'&&edge.type==='relation'&&edge.label)
        drawNetworkLabel(svg,edge,networkLabels.get(edge.id),sceneStyle);
      if(secondary==='flowchart'&&(edge.kind==='yes'||edge.kind==='no')){
        const label=document.createElementNS('http://www.w3.org/2000/svg','text');
        label.textContent=edge.kind==='yes'?tr('Sì','Yes'):tr('No','No');
        const position=flows.labelPoint(a,z,edge.kind);
        label.setAttribute('x',String(position.x));label.setAttribute('y',String(position.y));
        label.setAttribute('fill',semanticFlowColor(edge.kind,sceneStyle));svg.append(label);
      }
    }
    stage.append(svg);
    // Split view has its own camera: reuse the same insertion and Undo logic
    // without applying the primary pane's zoom to right-hand coordinates.
    if(secondary==='kanban'&&!stage._nmKanbanDnDInstalled){
      stage._nmKanbanDnDInstalled=true;
      stage.addEventListener('dragover',event=>{
        if(sideMode.get(app.state)!=='kanban'||!stage._nmDragId)return;
        event.preventDefault();
        if(event.dataTransfer)event.dataTransfer.dropEffect='move';
        const zoom=getCamera(app,'kanban',true).zoom;
        const column=kanbanColumnAt(app,event,stage,zoom);
        kanbanPreviewDrop(stage,column,kanbanInsertionAt(stage,column,event.clientY,stage._nmDragId));
      });
      stage.addEventListener('drop',event=>{
        if(sideMode.get(app.state)!=='kanban'||!stage._nmDragId)return;
        event.preventDefault();
        const id=stage._nmDragId,zoom=getCamera(app,'kanban',true).zoom;
        const column=kanbanColumnAt(app,event,stage,zoom);
        const before=kanbanInsertionAt(stage,column,event.clientY,id);
        stage._nmDragId=null;
        kanbanApplyMove(app,stage,id,column,before);
      });
      stage.addEventListener('dragend',()=>{
        stage._nmDragId=null;kanbanClearDropHints(stage);
      });
    }
    if(secondary==='kanban')for(const col of layout.columns||[]){
      const zone=document.createElement('div');zone.className='nm-kanban-dropzone';
      zone.dataset.status=col.id;zone.style.left=(col.x-col.width/2)+'px';
      zone.style.width=col.width+'px';zone.style.height=Math.max(240,layout.height-40)+'px';
      stage.append(zone);
      const header=document.createElement('div');header.className='nm-work-column';
      header.style.left=(col.x-col.width/2)+'px';header.dataset.status=col.id;
      header.style.setProperty?.('--nm-kanban-status',kanbanStatusColor(col.id));
      header.style.color=sceneStyle?.text||'#cbd5e1';
      header.textContent=tr(...({unassigned:['Da classificare','Unassigned'],
        todo:['Da fare','To do'],doing:['In corso','In progress'],done:['Completato','Done']}[col.id]))+
        ' · '+col.count;
      stage.append(header);
    }
    if(layout.empty){
      const empty=document.createElement('p');empty.className='nm-dual-message';
      empty.textContent=secondary==='timeline'?
        tr('Assegna le date alle attività per visualizzarle qui.','Add dates to tasks to see them here.'):
        secondary==='flowchart'?
        tr('Aggiungi collegamenti al flusso di lavoro.','Add workflow transitions.'):
        tr('Nessun elemento disponibile.','No items available.');
      stage.append(empty);
    }
    const orgImages=(secondary==='orgchart'||secondary==='concept-tree')?orgAttachedImages(state):null;
    const fragment=document.createDocumentFragment();
    for(const n of layout.nodes){
      const card=document.createElement('div');card.className='nm-view-card'+
        (n.depth===0?' is-root':'')+(n.decision?' is-decision':'')+
        (['timeline','kanban'].includes(secondary)?' nm-work-card':'')+
        (secondary==='timeline'?' nm-timeline-card':'')+(secondary==='concept-network'?' nm-network-card':'');
      card.tabIndex=0;card.dataset.nodeId=n.id;card.setAttribute('role','button');
      if(secondary==='concept-network'&&linking.get(state)?.source===n.id)
        card.classList.add('is-link-source');
      card.setAttribute('aria-label',n.text);card.setAttribute('aria-selected',String(n.id===state.selectedNodeId));
      cardBox(n,card);
      styleCard(card,state,secondary,n,sceneStyle,modeElements);
       decorateNetworkCard(card,secondary,n,manualOverlaps);
       decorateTreeCard(card,secondary,n,orgImages?.get(n.id));
       decorateOrgCard(card,secondary,n,orgImages?.get(n.id));
       decorateKanbanCard(card,secondary,n);
       decorateFlowCard(card,secondary,n);
      if(secondary==='timeline'){
        if(n.milestone)card.classList.add('is-milestone');
        card.setAttribute('aria-label',n.text+' · '+timelineDateCaption(n));
        card.title=card.getAttribute('aria-label');
        addTimelineTitle(stage,n,viewStyle(state,secondary,n.id));
        card.addEventListener('click',()=>{app.selectNode(n.id);
          const task=document.getElementById('nm-dual-task');
          if(task){task.value=n.id;task._nmSelected=n.id;syncDualDateFields(app,n.id)}
        });
        card.addEventListener('dblclick',event=>{event.stopPropagation();edit(app,n.id,card,secondary)});
        bindCardCommands(app,card,n.id,secondary);
        fragment.append(card);continue;
      }
      const label=document.createElement('span');label.className='nm-view-title';
      if(sceneStyle){
        const typography=secondary==='concept-tree'?
          appearance.treeTypography(n.depth,sceneStyle.fontSize):null;
        label.style.fontSize=(typography?.fontSize??sceneStyle.fontSize)+'px';
        if(secondary==='orgchart'&&sceneStyle.fontSize>=16)label.dataset.orgLargeFont='true';
        if(typography)label.style.fontWeight=String(typography.fontWeight);
      }
      label.dataset.glaukaUserContent='';label.textContent=n.text;label.title=n.text;card.append(label);
      const add=document.createElement('button');add.type='button';add.className='nm-view-add';
      add.textContent='+';add.setAttribute('aria-label',tr('Aggiungi figlio a ','Add child to ')+n.text);
      add.addEventListener('click',event=>{event.stopPropagation();addChild(app,n.id,secondary==='flowchart')});
      card.append(add);
      const liveNode=state.findNode(n.id);
      if(['orgchart','concept-tree'].includes(secondary)&&n.depth!==0&&liveNode?.children?.length){
        const collapse=document.createElement('button');collapse.type='button';collapse.className='nm-view-collapse';
        decorateCollapseControl(collapse,!!liveNode.collapsed,n.text);
        if(liveNode.collapsed)collapse.classList.add('is-collapsed-persistent');
        collapse.addEventListener('click',event=>{
          event.stopPropagation();
          if(state.toggleCollapse(n.id)){app.markChanged();queue(app)}
        });
        card.append(collapse);
      }
      if(secondary==='kanban'){
        card.draggable=true;
        card.addEventListener('dragstart',event=>{
          if(event.target.closest('input,button,select')){event.preventDefault();return}
          stage._nmDragId=n.id;
          event.dataTransfer?.setData('text/plain',n.id);
        });
        card.addEventListener('dragend',()=>{
          stage._nmDragId=null;kanbanClearDropHints(stage);
        });
        const status=document.createElement('select');
        status.setAttribute('aria-label',tr('Stato di ','Status of ')+n.text);
        for(const [value,it,en]of [['','Da classificare','Unassigned'],
          ['todo','Da fare','To do'],['doing','In corso','In progress'],['done','Completato','Done']]){
          const option=document.createElement('option');option.value=value;option.textContent=tr(it,en);
          status.append(option);
        }
        status.value=n.status||state.findNode(n.id)?.taskStatus||'';
        status.addEventListener('click',event=>event.stopPropagation());
        status.addEventListener('change',()=>{
          kanbanApplyMove(app,stage,n.id,status.value||'unassigned');
        });
        card.append(status);
        // Pointer Events are necessary on touch: HTML draggable does not
        // reliably fire on phones/tablets. Pinch cancels the pending change.
        let touchDrag=null;
        card.addEventListener('pointerdown',event=>{
          if(event.pointerType!=='touch'||touchDrag||event.target.closest('button,input,select'))return;
          touchDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
          card.setPointerCapture?.(event.pointerId);
        });
        card.addEventListener('pointermove',event=>{
          if(!touchDrag||touchDrag.id!==event.pointerId||stage._nmGesturePinching)return;
          if(!touchDrag.moved&&Math.hypot(event.clientX-touchDrag.x,event.clientY-touchDrag.y)<12)return;
          touchDrag.moved=true;
          const column=kanbanColumnAt(app,event,stage,getCamera(app,'kanban',true).zoom);
          kanbanPreviewDrop(stage,column,kanbanInsertionAt(stage,column,event.clientY,n.id));
          event.preventDefault?.();
        });
        const endKanbanTouch=event=>{
          if(!touchDrag||touchDrag.id!==event.pointerId)return;
          const pending=touchDrag;touchDrag=null;
          if(event.type!=='pointercancel'&&!stage._nmGesturePinching&&pending.moved){
            const column=kanbanColumnAt(app,event,stage,getCamera(app,'kanban',true).zoom);
            const before=kanbanInsertionAt(stage,column,event.clientY,n.id);
            card._nmDragged=true;
            kanbanApplyMove(app,stage,n.id,column,before);
          }
          kanbanClearDropHints(stage);
          if(card.hasPointerCapture?.(event.pointerId))card.releasePointerCapture(event.pointerId);
        };
        card.addEventListener('pointerup',endKanbanTouch);
        card.addEventListener('pointercancel',endKanbanTouch);
      }
      if(secondary==='concept-network'){
        let drag=null;
        card.addEventListener('pointerdown',event=>{
          if(event.button!==0||event.target.closest('button,input,select'))return;
          drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:n.x,y:n.y};
          card.setPointerCapture?.(event.pointerId);
        });
        card.addEventListener('pointermove',event=>{
          if(!drag||drag.id!==event.pointerId||stage._nmGesturePinching)return;
          const dx=(event.clientX-drag.startX)/cam.zoom,dy=(event.clientY-drag.startY)/cam.zoom;
          if(Math.hypot(dx,dy)<5)return;
          card.style.left=Math.round(drag.x+dx)+'px';card.style.top=Math.round(drag.y+dy)+'px';
        });
        const end=event=>{
          if(!drag||drag.id!==event.pointerId)return;
          const d=drag;drag=null;
          const dx=(event.clientX-d.startX)/cam.zoom,dy=(event.clientY-d.startY)/cam.zoom;
          if(event.type!=='pointercancel'&&!stage._nmGesturePinching&&Math.hypot(dx,dy)>5){
            const x=Math.max(115,Math.min(20000,Math.round(d.x+dx))),
              y=Math.max(65,Math.min(20000,Math.round(d.y+dy)));
            card._nmDragged=true;
            if(state.setNodeNetworkPosition(n.id,{x,y}))app.markChanged();
          }else{card.style.left=d.x+'px';card.style.top=d.y+'px'}
          if(card.hasPointerCapture?.(event.pointerId))card.releasePointerCapture(event.pointerId);
        };
        card.addEventListener('pointerup',end);card.addEventListener('pointercancel',end);
      }
      card.addEventListener('click',event=>{
        if(card._nmDragged){card._nmDragged=false;event.preventDefault();event.stopImmediatePropagation();return}
        if(secondary==='concept-network'&&
          connectNetworkNode(app,n.id,document.getElementById('nm-dual-relation-label').value))return;
        app.selectNode(n.id);
        if(secondary==='timeline'){
          const task=document.getElementById('nm-dual-task');task.value=n.id;task._nmSelected=n.id;
          syncDualDateFields(app,n.id);
        }
        for(const el of document.querySelectorAll('.nm-view-card'))
          el.setAttribute('aria-selected',String(el.dataset.nodeId===n.id));
      });
      card.addEventListener('dblclick',event=>{
        if(event.target.closest('.nm-view-add,select'))return;
        event.stopPropagation();edit(app,n.id,card,secondary);
      });
      bindCardCommands(app,card,n.id,secondary);
      if(secondary==='kanban')bindKanbanReorderKeys(app,card,n,stage);
      fragment.append(card);
    }
    stage.append(fragment);
    if(secondary==='concept-network'){
      const dualEdges=[...stage.querySelectorAll('.nm-network-edge')].map(path=>({
        edge:{id:path.dataset.relationId,fromId:'',toId:''},path,visual:null
      }));
      // Rebuild a lightweight edge list from the layout for neighborhood focus.
      const netEdges=(layout.edges||[]).filter(edge=>edge.type==='relation').map(edge=>{
        const path=stage.querySelector('.nm-network-edge[data-relation-id="'+String(edge.id).replace(/"/g,'')+'"]');
        return {edge,path,visual:null};
      }).filter(item=>item.path);
      bindNetworkNeighborhood(stage,layout,netEdges.length?netEdges:dualEdges);
    }
    if(secondary==='orgchart')
      applyOrgSearch(stage,document.getElementById('nm-orgchart-search')?.value||'');
    const key=String(app.activeTabId||'')+':'+secondary;
    if(lastDualView.get(app)!==key||lastDualState.get(app)!==state){
      if(cam.left!==null&&cam.top!==null){sc.scrollLeft=cam.left;sc.scrollTop=cam.top}
      else{
        const center=coords.get(state.root.id)||layout.nodes[0];
        if(center){sc.scrollLeft=Math.max(0,center.x*cam.zoom-sc.clientWidth/2);
          sc.scrollTop=Math.max(0,center.y*cam.zoom-sc.clientHeight/3)}
      }
      lastDualView.set(app,key);lastDualState.set(app,state);
    }else{sc.scrollLeft=previousLeft;sc.scrollTop=previousTop}
    cam.left=sc.scrollLeft;cam.top=sc.scrollTop;
  }
