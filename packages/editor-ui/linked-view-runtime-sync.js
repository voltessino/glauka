  function syncWorkFields(app,force=true){
    const node=document.getElementById('nm-work-node'),status=document.getElementById('nm-work-status'),
      start=document.getElementById('nm-work-start'),end=document.getElementById('nm-work-end');
    if(!node||!status||!start||!end)return;
    const selected=app.state.findNode(node.value);
    const owner=document.getElementById('nm-work-toolbar');
    const signature=JSON.stringify([selected?.id,selected?.taskStatus,selected?.startDate,selected?.dueDate,selected?.taskDependsOn]);
    if(!force&&owner._nmWorkState===app.state&&owner._nmWorkValues===signature)return;
    owner._nmWorkState=app.state;owner._nmWorkValues=signature;
    status.value=work.status(selected?.taskStatus);
    start.value=work.parseDate(selected?.startDate)||'';
    end.value=work.parseDate(selected?.dueDate)||'';
    const depSelect=document.getElementById('nm-work-dependency'),note=document.getElementById('nm-work-dependency-note');
    if(depSelect&&note){
      const previous=depSelect.value;
      depSelect.replaceChildren();
      for(const item of work.candidates(app.state.root,2000)){
        if(item.id===selected?.id)continue;
        const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.path.slice(0,110);depSelect.append(opt);
      }
      if([...depSelect.options].some(x=>x.value===previous))depSelect.value=previous;
      const deps=work.cleanDependencies(selected?.taskDependsOn);
      note.textContent=tr('Prerequisiti: ','Predecessors: ')+deps.length+
       (deps.length?' · '+deps.map(x=>app.state.findNode(x)?.text||tr('Nodo mancante','Missing node')).join(', ').slice(0,170):'');
    }
  }
  function syncWorkToolbar(app,mode){
    const bar=document.getElementById('nm-work-toolbar');if(!bar)return;
    const visible=mode==='kanban'||mode==='timeline';
    bar.hidden=!visible;if(!visible){delete bar._nmWorkState;delete bar._nmWorkValues;return}
    const scale=document.getElementById('nm-work-time-scale');
    const scaleGroup=document.getElementById('nm-work-time-scale-group');
    if(scaleGroup)scaleGroup.hidden=mode!=='timeline';
    if(scale&&mode==='timeline')scale.value=viewStyle(app.state,'timeline')?.timeScale||'auto';
    let all=[];try{all=work.candidates(focusRoot(app.state)||app.state.root,2000)}catch(error){app.showToast?.(error.message,'ATTIVITÀ');return}
    const select=document.getElementById('nm-work-node'),previous=select.value;
    const signature=all.map(n=>n.id+'\\x01'+n.text).join('\\x02');
    if(bar._signature!==signature){
      select.replaceChildren();
      for(const n of all){const option=document.createElement('option');option.value=n.id;option.textContent=n.path.slice(0,110);select.append(option)}
      bar._signature=signature;
    }
    const wanted=all.some(n=>n.id===previous)?previous:all.some(n=>n.id===app.state.selectedNodeId)?app.state.selectedNodeId:all[0]?.id;
    if(wanted)select.value=wanted;
    const labels=[['Nodo','Node'],['Stato','Status'],['Inizio','Start'],['Fine','Due'],['Prerequisito','Predecessor']];
    for(const [i,label]of [...bar.querySelectorAll('label')].entries()){
      const el=label.querySelector('span');el.textContent=tr(...labels[i]);
      label.querySelector('select')?.setAttribute('aria-label',tr(...labels[i]));
      label.querySelector('input')?.setAttribute('aria-label',tr(...labels[i]));
    }
    for(const [i,option]of [...document.getElementById('nm-work-status').options].entries())option.textContent=
      tr(...[['Da classificare','Unassigned'],['Da fare','To do'],['In corso','In progress'],['Completato','Done']][i]);
    document.getElementById('nm-work-apply').textContent=tr('Applica','Apply');
    document.getElementById('nm-work-apply').disabled=!wanted;
    syncWorkFields(app,false);
  }
  function setMode(app,kind){
    if(!app.state?.root)return;
    // A primary-mode switch can dismantle the secondary pane. Commit both
    // live editors to their original document before view-mode Undo/history.
    document.querySelector('#nm-view-stage .nm-view-edit')?.blur();
    document.querySelector('#nm-dual-stage .nm-view-edit')?.blur();
    const wanted=core.mode(kind),was=core.mode(app.state.root.viewMode);
    if(was===wanted){queue(app);return}
    if(!canProject(app,wanted))return false;
    // Use existing side-panel coordinator; never ignore protected drafts.
    if(wanted!=='mindmap'&&root.NeuroMapWorkspaceLayout?.claim&&
       !root.NeuroMapWorkspaceLayout.claim(app,'linked-view'))return false;
    captureVisibleCamera(app);
    if(sideMode.has(app.state))setSideMode(app,null);
    if(wanted!=='concept-network'){linking.delete(app.state);networkPreview.delete(app)}
    if(wanted!=='flowchart')flowPreview.delete(app.state);
    app.closeEditor?.(true);
    app.state.pushHistory();
    app.state.root.viewMode=wanted;
    app.markChanged();
    queue(app);
  }
  function announceViewAction(it,en){
    const feedback=document.getElementById('nm-view-action-status');
    if(feedback)feedback.textContent=tr(it,en);
  }
  function closeNodeMenu(returnFocus=true){
    const menu=document.getElementById('nm-view-context');
    if(!menu||menu.hidden)return false;
    menu.hidden=true;
    const target=menu._nmReturnFocus;
    if(returnFocus&&target?.isConnected!==false)target?.focus?.();
    return true;
  }
  function openNodeMenu(app,card,id,mode,event){
    // A keyboard-opened node menu must never sit behind appearance/export flyouts.
    for(const id of ['nm-view-appearance','nm-view-export-menu','nm-project-view-options']){
      const panel=document.getElementById(id);if(panel)panel.open=false;
    }
    const menu=document.getElementById('nm-view-context');
    const node=app.state?.findNode?.(id);
    if(!menu||!node)return false;
    closeNodeMenu(false);
    app.selectNode?.(id);
    menu.replaceChildren();menu.hidden=false;menu._nmReturnFocus=card;
    menu.setAttribute('aria-label',tr('Azioni per ','Actions for ')+node.text);
    const options=[
      {key:'rename',it:'Rinomina',en:'Rename',shortcut:'F2',run:()=>edit(app,id,card)},
      {key:'child',it:'Aggiungi sottoramo',en:'Add child',shortcut:'Ins',run:()=>addChild(app,id,mode==='flowchart')},
      {key:'focus',it:'Mostra solo questo ramo',en:'Focus on branch',shortcut:'',
        disabled:!node.children?.length,run:()=>setFocus(app,id)},
      {key:'all',it:'Mostra tutti i rami',en:'Show all branches',shortcut:'',
        disabled:!focusedIds.has(app.state),run:()=>setFocus(app,null)}
    ];
    for(const action of options){
      const button=document.createElement('button');button.type='button';
      button.dataset.action=action.key;button.setAttribute('role','menuitem');
      button.disabled=!!action.disabled;
      const name=document.createElement('span');name.textContent=tr(action.it,action.en);
      button.append(name);
      if(action.shortcut&&!root.GlaukaMobile){const key=document.createElement('small');key.textContent=action.shortcut;button.append(key)}
      button.addEventListener('click',()=>{
        if(button.disabled)return;
        closeNodeMenu(false);action.run();
        if(action.key==='focus'||action.key==='all')announceViewAction(action.it,action.en);
      });
      menu.append(button);
    }
    const bounds=card.getBoundingClientRect();
    const x=Number.isFinite(event?.clientX)?event.clientX:bounds.left+bounds.width/2;
    const y=Number.isFinite(event?.clientY)?event.clientY:bounds.top+bounds.height/2;
    menu.style.left=Math.max(8,Math.min((window.innerWidth||1200)-285,x))+'px';
    menu.style.top=Math.max(8,Math.min((window.innerHeight||800)-230,y))+'px';
    menu.querySelector('button:not([disabled])')?.focus?.();
    return true;
  }
  function bindCardCommands(app,card,id,mode){
    if(root.GlaukaMobile){
      card.removeAttribute?.('aria-keyshortcuts');
      card.setAttribute('title',tr('Tieni premuto per le azioni del nodo','Long-press for node actions'));
    }else{
      card.setAttribute('aria-keyshortcuts','F2 Enter Insert Shift+F10');
      card.setAttribute('title',tr('Invio/F2: rinomina · Ins: sottoramo · Maiusc+F10: azioni',
        'Enter/F2: rename · Ins: child · Shift+F10: actions'));
    }
    card.addEventListener('contextmenu',event=>{
      if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault?.();event.stopPropagation?.();
      openNodeMenu(app,card,id,mode,event);
    });
    card.addEventListener('keydown',event=>{
      if(event.target!==card||event.ctrlKey||event.metaKey||event.altKey)return;
      const menu=event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10');
      if(menu){
        event.preventDefault();event.stopPropagation();openNodeMenu(app,card,id,mode,event);
      }else if(!event.shiftKey&&(event.key==='Enter'||event.key==='F2')){
        event.preventDefault();event.stopPropagation();edit(app,id,card);
      }else if(!event.shiftKey&&(event.key==='Insert'||event.key==='NumpadInsert')){
        event.preventDefault();event.stopPropagation();addChild(app,id,mode==='flowchart');
      }else if(event.key===' '&&!event.shiftKey){
        event.preventDefault();event.stopPropagation();card.click();
      }
    });
  }
  function edit(app,id,card,viewMode=displayMode(app.state)){
    if(!app.state.findNode(id)||card.querySelector('.nm-view-edit'))return;
    let label=card.querySelector('.nm-view-title');
    if(!label){
      // Timeline bars display their text alongside the chart; retain a
      // screen-reader-only label so the same inline editor works on each view.
      label=document.createElement('span');label.className='nm-view-title nm-view-sr-label';
      label.textContent=app.state.findNode(id).text;card.append(label);
    }
    const ownerState=app.state,ownerMode=viewMode;
    const field=document.createElement('input');field.className='nm-view-edit';field.type='text';field.maxLength=3000;
    field._nmViewOwner=ownerState;field._nmViewMode=ownerMode;
    field.value=ownerState.findNode(id).text;
    label.replaceWith(field);
    field.focus();field.select();
    let finished=false;
    const finish=save=>{
      if(finished)return;finished=true;
      field.removeEventListener('blur',blur);
      if(save&&ownerState.updateNodeText(id,field.value)){
        announceViewAction('Nodo rinominato','Node renamed');
        if(app.state===ownerState)app.markChanged();
        else{ownerState.isDirty=true;app._desktopUserEdited=true;app.scheduleSave?.()}
        app.renderTabBar?.();
      }
      field.replaceWith(label);
      queue(app);
    };
    const blur=()=>finish(true);
    field.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.isComposing||event.keyCode===229)return;
      if(event.key==='Escape'){event.preventDefault();finish(false)}
      else if(event.key==='Enter'){event.preventDefault();finish(true)}
    });
    field.addEventListener('blur',blur);
  }
  function addChild(app,id,asFlow=false){
    const node=app.state.addChildNode(id,app.layout);
    if(!node)return;
    if(asFlow){
      // addChildNode recorded one history snapshot: keep the new arrow in the
      // same atomic user action, rather than creating a second Undo step.
      app.state.relationships.push({id:app.state.generateId('rel'),fromId:id,toId:node.id,
        kind:'sequence',label:'Segue',color:'#818cf8'});
    }
    app.state.selectedNodeId=node.id;
    announceViewAction('Sottoramo aggiunto','Child added');
    app.markChanged();app.renderTabBar?.();
    queue(app);
    requestAnimationFrame(()=>{const card=[...document.querySelectorAll('.nm-view-card')].find(x=>x.dataset.nodeId===node.id);if(card)edit(app,node.id,card)});
  }
  function syncDualDateFields(app,id){
    const node=app.state?.findNode?.(id);
    const start=document.getElementById('nm-dual-start'),due=document.getElementById('nm-dual-due');
    if(start)start.value=work.parseDate(node?.startDate)||'';
    if(due)due.value=work.parseDate(node?.dueDate)||'';
  }
  function syncDualTools(app,mode){
    const root=document.getElementById('nm-dual-tools');if(!root)return;
    const timeline=mode==='timeline',networkMode=mode==='concept-network',flowMode=mode==='flowchart';
    root.hidden=!(timeline||networkMode||flowMode);
    document.getElementById('nm-dual-timeline-tools').hidden=!timeline;
    if(timeline){
      const scale=document.getElementById('nm-dual-time-scale');
      if(scale)scale.value=viewStyle(app.state,'timeline')?.timeScale||'auto';
    }
    document.getElementById('nm-dual-network-tools').hidden=!networkMode;
    document.getElementById('nm-dual-flow-tools').hidden=!flowMode;
    document.getElementById('nm-dual-apply-dates').textContent=tr('Applica date','Apply dates');
    const flowAdd=document.getElementById('nm-dual-flow-add');
    flowAdd.textContent=tr('Collega','Connect');
    flowAdd.title=tr('Collega i due passaggi selezionati','Connect the two selected steps');
    flowAdd.setAttribute('aria-label',flowAdd.title);
    if(networkMode){
      const action=linking.get(app.state),button=document.getElementById('nm-dual-connect');
      button.textContent=action?tr('Annulla collegamento','Cancel link'):tr('Collega due concetti','Link two concepts');
      button.title=button.textContent;button.setAttribute('aria-label',button.textContent);
      button.setAttribute('aria-pressed',String(!!action));
      document.getElementById('nm-dual-relation-label').placeholder=tr('es. causa, comprende, dipende da','e.g. causes, includes, depends on');
      return;
    }
    if(!timeline&&!flowMode)return;
    let candidates=[];
    try{candidates=work.candidates(focusRoot(app.state)||app.state.root,2000)}
    catch(error){root.hidden=true;app.showToast?.(String(error?.message||error),'VISTA');return}
    const update=(select)=>{
      const oldValue=select.value,signature=candidates.map(n=>n.id+'\u0001'+n.text).join('\u0002');
      if(select._nmSignature!==signature){
        select.replaceChildren();
        for(const node of candidates){
          const option=document.createElement('option');option.value=node.id;option.textContent=node.path.slice(0,90);select.append(option);
        }
        select._nmSignature=signature;
      }
      const exists=id=>candidates.some(n=>n.id===id);
      select.value=exists(oldValue)?oldValue:
        exists(app.state.selectedNodeId)?app.state.selectedNodeId:candidates[0]?.id||'';
      return select.value;
    };
    if(timeline){
      const select=document.getElementById('nm-dual-task'),previous=select._nmSelected;
      const chosen=update(select);
      if(previous!==chosen||select._nmSourceState!==app.state){
        syncDualDateFields(app,chosen);select._nmSelected=chosen;select._nmSourceState=app.state;
      }
    }
    if(flowMode){
      const from=document.getElementById('nm-dual-flow-from'),to=document.getElementById('nm-dual-flow-to');
      update(from);update(to);
      if(to.value===from.value&&candidates.length>1)to.value=candidates.find(n=>n.id!==from.value)?.id;
      const shape=document.getElementById('nm-dual-flow-shape');
      if(shape){
        shape.value=flows.shape(app.state.findNode(from.value)?.flowShape);
        shape.disabled=!from.value||from.value===app.state.root?.id;
      }
    }
  }
  const lastDualView=new WeakMap();
  const lastDualState=new WeakMap();
  function zoomDual(app,factor,clientX,clientY,fit=false){
    const side=sideMode.get(app.state);
    const pane=document.getElementById('nm-dual-pane');
    if(!side||!pane||pane.hidden)return;
    const sc=document.getElementById('nm-dual-scroller'),stage=document.getElementById('nm-dual-stage'),
      frame=document.getElementById('nm-dual-frame'),cam=getCamera(app,side,true);
    const box=sc.getBoundingClientRect(),x=(clientX??(box.left+box.width/2))-box.left,
      y=(clientY??(box.top+box.height/2))-box.top;
    const previous=cam.zoom,next=Math.max(.02,Math.min(3.5,previous*factor));
    const wx=(sc.scrollLeft+x)/previous,wy=(sc.scrollTop+y)/previous;
    cam.zoom=next;stage.style.transform='scale('+next+')';
    if(stage.dataset)stage.dataset.orgDetail=
      side==='orgchart'&&next<.62?'overview':'detail';
    frame.style.width=Math.ceil(stage.offsetWidth*next)+'px';
    frame.style.height=Math.ceil(stage.offsetHeight*next)+'px';
    sc.scrollLeft=fit?Math.max(0,(stage.offsetWidth*next-sc.clientWidth)/2):Math.max(0,wx*next-x);
    sc.scrollTop=fit?Math.max(0,(stage.offsetHeight*next-sc.clientHeight)/2):Math.max(0,wy*next-y);
    cam.left=sc.scrollLeft;cam.top=sc.scrollTop;
    document.getElementById('nm-dual-zoom-status').textContent=Math.round(next*100)+'%';
    cameraSave(app);
  }
  function fitDual(app){
    const sc=document.getElementById('nm-dual-scroller'),stage=document.getElementById('nm-dual-stage');
    if(!sc||!stage)return;
    const factor=Math.min(1.5,(sc.clientWidth-32)/Math.max(1,stage.offsetWidth),
      (sc.clientHeight-32)/Math.max(1,stage.offsetHeight));
    zoomDual(app,factor/getCamera(app,sideMode.get(app.state),true).zoom,undefined,undefined,true);
  }
  function releaseHiddenStage(id){
    const stage=document.getElementById(id);if(!stage)return;
    // Commit through the existing editor owner before releasing its DOM.
    stage.querySelector('.nm-view-edit')?.blur();
    if(stage.children.length)stage.replaceChildren();
  }
