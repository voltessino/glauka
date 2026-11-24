    const flowBar=document.createElement('div');flowBar.id='nm-flow-toolbar';flowBar.hidden=true;
    const makeSelector=(id,it,en)=>{
      const label=document.createElement('label');label.className='nm-flow-selector-field';label.dataset.it=it;label.dataset.en=en;
      const name=document.createElement('span');name.textContent=tr(it,en);name.className='nm-flow-label';
      const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',tr(it,en));
      label.append(name,select);flowBar.append(label);return select;
    };
    const from=makeSelector('nm-flow-from','Da','From');
    const to=makeSelector('nm-flow-to','A','To');
    const kind=makeSelector('nm-flow-type','Collegamento','Transition');
    const form=makeSelector('nm-flow-shape','Forma nodo Da','From node shape');
    for(const [id,it,en]of FLOW_SHAPE_CHOICES){
      const option=document.createElement('option');option.value=id;
      option.textContent=tr(it,en);form.append(option);
    }
    form.addEventListener('change',()=>{
      if(!from.value||!app.state.setNodeFlowShape)return;
      if(app.state.setNodeFlowShape(from.value,form.value)){
        app.markChanged();queue(app);
      }
    });
    from.addEventListener('change',()=>{
      form.value=flows.shape(app.state.findNode(from.value)?.flowShape);
      form.disabled=!from.value||from.value===app.state.root?.id;
    });
    for(const [id,it,en]of [['sequence','Segue','Next'],['yes','Sì','Yes'],['no','No','No']]){
      const option=document.createElement('option');option.value=id;option.textContent=tr(it,en);kind.append(option);
    }
    const connect=document.createElement('button');connect.id='nm-flow-connect';connect.type='button';
    connect.textContent=tr('Collega','Connect');
    connect.addEventListener('click',()=>{
      if(!from.value||!to.value||from.value===to.value)return;
      const existing=app.state.relationships.some(r=>r.fromId===from.value&&r.toId===to.value&&r.kind===kind.value);
      if(existing){app.showToast?.(tr('Collegamento già presente','Transition already exists'),'FLUSSO');return}
      const edge=app.state.addFlowTransition(from.value,to.value,kind.value);
      if(edge){app.markChanged();queue(app)}
    });
    flowBar.append(connect);
    const flowList=document.createElement('div');flowList.id='nm-flow-list';
    flowList.setAttribute('aria-label',tr('Collegamenti del flusso','Workflow transitions'));
    flowBar.append(flowList);
    const suggest=document.createElement('button');suggest.type='button';suggest.id='nm-flow-suggest';
    suggest.addEventListener('click',()=>{
      if(flowPreview.has(app.state))flowPreview.delete(app.state);
      else{
        let groups=[];
        try{groups=guided.inventory(focusRoot(app.state)||app.state.root).groups}catch(error){app.showToast?.(error.message,'FLUSSO');return}
        if(!groups.length){app.showToast?.(tr('Servono almeno due sottoargomenti nello stesso ramo','At least two sibling topics are required'),'FLUSSO');return}
        const selected=groups.some(g=>g.id===app.state.selectedNodeId)?app.state.selectedNodeId:groups[0].id;
        flowPreview.set(app.state,{parentId:selected,checked:new Set()});
      }
      queue(app);
    });
    flowBar.append(suggest);
    const guide=document.createElement('section');guide.id='nm-flow-guide';guide.hidden=true;
    const guideHeading=document.createElement('strong');guideHeading.className='nm-flow-guide-heading';
    const guideNote=document.createElement('p');guideNote.className='nm-flow-guide-note';
    const guideSelect=document.createElement('select');guideSelect.id='nm-flow-guide-parent';
    guideSelect.setAttribute('aria-label',tr('Ramo da convertire','Branch to convert'));
    guideSelect.addEventListener('change',()=>{
      const preview=flowPreview.get(app.state);if(!preview)return;
      preview.parentId=guideSelect.value;preview.checked=new Set();queue(app);
    });
    const guideItems=document.createElement('div');guideItems.className='nm-flow-guide-items';
    const guideStatus=document.createElement('div');guideStatus.id='nm-flow-guide-status';guideStatus.className='nm-flow-guide-note';
    guideStatus.setAttribute('role','status');
    const guideActions=document.createElement('div');guideActions.className='nm-flow-guide-actions';
    const confirm=document.createElement('button');confirm.type='button';confirm.id='nm-flow-guide-confirm';
    confirm.addEventListener('click',()=>{
      const state=app.state,preview=flowPreview.get(state);
      if(!preview||!preview.checked.size)return;
      let fresh;
      try{fresh=guided.preview(state.root,preview.parentId,state.relationships)}
      catch(error){app.showToast?.(error.message,'FLUSSO');flowPreview.delete(state);queue(app);return}
      const chosen=fresh.pairs.filter(p=>preview.checked.has(p.fromId+'\\x00'+p.toId));
      const created=state.addFlowTransitionsBatch(chosen);
      flowPreview.delete(state);
      if(created.length){app.markChanged();app.showToast?.(tr('Passaggi confermati: ','Confirmed steps: ')+created.length,'FLUSSO')}
      queue(app);
    });
    const cancel=document.createElement('button');cancel.type='button';cancel.id='nm-flow-guide-cancel';
    cancel.addEventListener('click',()=>{flowPreview.delete(app.state);queue(app)});
    guideActions.append(confirm,cancel);
    guide.append(guideHeading,guideNote,guideSelect,guideItems,guideStatus,guideActions);
    flowBar.append(guide);
    const networkBar=document.createElement('div');networkBar.id='nm-network-toolbar';networkBar.hidden=true;
    const linkButton=document.createElement('button');linkButton.type='button';linkButton.id='nm-network-link';
    linkButton.addEventListener('click',()=>{
      if(linking.has(app.state))linking.delete(app.state);
      else linking.set(app.state,{source:null});
      queue(app);
    });
    const arrangeButton=document.createElement('button');arrangeButton.type='button';
    arrangeButton.id='nm-network-arrange';
    arrangeButton.textContent=tr('Organizza correlati','Arrange related');
    arrangeButton.setAttribute('aria-label',arrangeButton.textContent);
    arrangeButton.addEventListener('click',()=>{
      const focusId=app.state.selectedNodeId;
      if(!focusId){
        app.showToast?.(tr('Seleziona un concetto','Select a concept'),'RETE');
        return;
      }
      const layout=projectView(app.state,'concept-network');
      const result=network.arrangeRelated(layout,focusId,{maxNodes:36,gap:24});
      if(!result.changed){
        app.showToast?.(tr('Nessun vicino automatico da riorganizzare','No automatic neighbors to rearrange'),'RETE');
        return;
      }
      networkPreview.set(app,{nodes:result.nodes,focusId,signature:String(app.state.root?.id||'')});
      queue(app);
    });
    const restoreButton=document.createElement('button');restoreButton.type='button';
    restoreButton.id='nm-network-restore-arrange';
    restoreButton.textContent=tr('Ripristina disposizione','Restore arrangement');
    restoreButton.setAttribute('aria-label',restoreButton.textContent);
    restoreButton.addEventListener('click',()=>{
      if(!networkPreview.has(app))return;
      networkPreview.delete(app);
      queue(app);
    });
    const linkLabel=document.createElement('input');linkLabel.id='nm-network-label';linkLabel.type='text';linkLabel.maxLength=100;
    linkLabel.placeholder=tr('es. causa, comprende, dipende da','e.g. causes, includes, depends on');
    linkLabel.setAttribute('aria-label',tr('Etichetta della relazione','Relationship label'));
    const linkStatus=document.createElement('span');linkStatus.id='nm-network-status';linkStatus.setAttribute('role','status');
    const networkList=document.createElement('div');networkList.id='nm-network-list';
    networkList.setAttribute('aria-label',tr('Relazioni concettuali','Concept relationships'));
    networkBar.append(linkButton,arrangeButton,restoreButton,linkLabel,linkStatus,networkList);
    const workBar=document.createElement('div');workBar.id='nm-work-toolbar';workBar.hidden=true;
    const workDetails=document.createElement('details');workDetails.id='nm-work-details';
    const workSummary=document.createElement('summary');
    workSummary.textContent=tr('Dettagli','Details');
    workSummary.setAttribute('aria-label',tr('Dettagli','Details'));
    const workFields=document.createElement('div');workFields.className='nm-work-fields';
    workDetails.append(workSummary,workFields);workBar.append(workDetails);
    const workField=(id,it,en,tag)=>{
      const label=document.createElement('label'),span=document.createElement('span'),control=document.createElement(tag);
      span.textContent=tr(it,en);span.dataset.it=it;span.dataset.en=en;
      control.id=id;control.setAttribute('aria-label',tr(it,en));label.append(span,control);workFields.append(label);return control;
    };
    const nodePicker=workField('nm-work-node','Nodo','Node','select');
    const taskStatus=workField('nm-work-status','Stato','Status','select');
    for(const [value,it,en] of [['unassigned','Da classificare','Unassigned'],['todo','Da fare','To do'],['doing','In corso','In progress'],['done','Completato','Done']]){
      const option=document.createElement('option');option.value=value;option.textContent=tr(it,en);taskStatus.append(option);
    }
    const start=workField('nm-work-start','Inizio','Start','input');start.type='date';
    const due=workField('nm-work-end','Fine','Due','input');due.type='date';
    const apply=document.createElement('button');apply.id='nm-work-apply';apply.type='button';apply.textContent=tr('Applica','Apply');
    apply.addEventListener('click',()=>{
      const node=app.state.findNode(nodePicker.value);
      if(!node)return;
      const changed=app.state.setNodeWorkMetadata(node.id,{taskStatus:taskStatus.value==='unassigned'?'':taskStatus.value,
        startDate:start.value||'',dueDate:due.value||''});
      if(changed){app.markChanged();queue(app)}
      else app.showToast?.(tr('Nessuna modifica oppure date non valide','No changes or invalid dates'),'ATTIVITÀ');
    });
    nodePicker.addEventListener('change',()=>syncWorkFields(app));
    workFields.append(apply);
    const previous=workField('nm-work-dependency','Prerequisito','Predecessor','select');
    const toggleDependency=document.createElement('button');toggleDependency.id='nm-work-dependency-toggle';
    toggleDependency.type='button';toggleDependency.textContent=tr('Aggiungi / rimuovi','Add / remove');
    const dependencyNote=document.createElement('span');dependencyNote.id='nm-work-dependency-note';dependencyNote.setAttribute('role','status');
    toggleDependency.addEventListener('click',()=>{
      const chosen=nodePicker.value,predecessor=previous.value,current=app.state.findNode(chosen);
      if(!current||!predecessor)return;
      const ids=work.cleanDependencies(current.taskDependsOn);
      const next=ids.includes(predecessor)?ids.filter(x=>x!==predecessor):[...ids,predecessor];
      if(app.state.setNodeTaskDependencies(chosen,next)){app.markChanged();syncWorkFields(app);queue(app);}
      else app.showToast?.(app.state._nmLastDependencyError||tr('Dipendenza invariata','Dependency unchanged'),'ATTIVITÀ');
    });
    workFields.append(toggleDependency,dependencyNote);
    const timeScaleGroup=document.createElement('div');
    timeScaleGroup.id='nm-work-time-scale-group';timeScaleGroup.className='nm-timeline-scale-control';
    const timeScaleLabel=document.createElement('span');
    timeScaleLabel.textContent=tr('Scala temporale','Time scale');
    const timeScale=document.createElement('select');timeScale.id='nm-work-time-scale';
    timeScale.setAttribute('aria-label',tr('Scala temporale','Time scale'));
    for(const [value,it,en]of [
      ['auto','Automatica','Automatic'],['days','Giorni','Days'],
      ['weeks','Settimane','Weeks'],['months','Mesi','Months']
    ]){
      const option=document.createElement('option');option.value=value;
      option.textContent=tr(it,en);timeScale.append(option);
    }
    timeScale.addEventListener('change',()=>changeAppearance(app,'timeline',{timeScale:timeScale.value}));
    const timeScaleHint=document.createElement('small');
    timeScaleHint.id='nm-work-time-scale-hint';timeScaleHint.className='nm-timeline-scale-hint';
    timeScaleHint.hidden=true;timeScaleHint.setAttribute('role','status');
    timeScaleGroup.append(timeScaleLabel,timeScale,timeScaleHint);workBar.append(timeScaleGroup);
    const help=document.createElement('p');help.id='nm-view-help';
    const controls=document.createElement('div');controls.className='nm-view-controls';
    controls.append(header,networkBar,flowBar,workBar);
    // Both projections consume exactly the same state tree and node IDs.
    // The main linked renderer stays fully editable; the secondary pane is
    // independently zoomable and supports selection, rename, add and Kanban state.
