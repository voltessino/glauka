    const panels=document.createElement('div');panels.id='nm-linked-panels';
    const dualPane=document.createElement('section');dualPane.id='nm-dual-pane';dualPane.hidden=true;
    dualPane.setAttribute('aria-label',tr('Seconda visualizzazione collegata','Second linked view'));
    const dualBar=document.createElement('div');dualBar.className='nm-dual-toolbar';
    const dualCaption=document.createElement('strong');dualCaption.id='nm-dual-caption';
    const dualPicker=document.createElement('select');dualPicker.id='nm-dual-picker';
    dualPicker.setAttribute('aria-label',tr('Vista a destra','Right-hand view'));
    for(const [id,it,en]of TYPE){const option=document.createElement('option');option.value=id;option.textContent=tr(it,en);dualPicker.append(option)}
    dualPicker.addEventListener('change',()=>setSideMode(app,dualPicker.value));
    const dualMinus=document.createElement('button');dualMinus.id='nm-dual-zoom-out';dualMinus.type='button';dualMinus.textContent='−';
    dualMinus.setAttribute('aria-label',tr('Riduci zoom seconda vista','Zoom out second view'));
    dualMinus.title=dualMinus.getAttribute('aria-label');
    const dualPlus=document.createElement('button');dualPlus.id='nm-dual-zoom-in';dualPlus.type='button';dualPlus.textContent='+';
    dualPlus.setAttribute('aria-label',tr('Aumenta zoom seconda vista','Zoom in second view'));
    dualPlus.title=dualPlus.getAttribute('aria-label');
    const dualFit=document.createElement('button');dualFit.id='nm-dual-fit';dualFit.type='button';
    dualFit.setAttribute('aria-label',tr('Adatta seconda vista','Fit second view'));
    dualFit.title=dualFit.getAttribute('aria-label');
    const dualZoom=document.createElement('span');dualZoom.id='nm-dual-zoom-status';dualZoom.textContent='100%';
    dualZoom.setAttribute('role','status');dualZoom.setAttribute('aria-live','polite');
    dualMinus.addEventListener('click',()=>zoomDual(app,1/1.2));
    dualPlus.addEventListener('click',()=>zoomDual(app,1.2));
    dualFit.addEventListener('click',()=>fitDual(app));
    const dualClose=document.createElement('button');dualClose.id='nm-dual-close';dualClose.type='button';dualClose.textContent='×';
    dualClose.setAttribute('aria-label',tr('Chiudi seconda vista','Close second view'));
    dualClose.title=dualClose.getAttribute('aria-label');
    dualClose.addEventListener('click',()=>setSideMode(app,null));
    dualBar.append(dualCaption,dualPicker,dualMinus,dualPlus,dualZoom,dualFit,dualClose);
    const dualScroller=document.createElement('div');dualScroller.id='nm-dual-scroller';dualScroller.tabIndex=0;
    const dualFrame=document.createElement('div');dualFrame.id='nm-dual-frame';
    const dualStage=document.createElement('div');dualStage.id='nm-dual-stage';dualFrame.append(dualStage);dualScroller.append(dualFrame);
    // Independent background pan and pinch on the right pane. Touching a
    // node never starts a background drag, and two fingers cancel card drags.
    const dualContacts=new Map();
    let dualPan=null,dualPinch=null;
    const dualMeasure=()=>{
      const contacts=[...dualContacts.values()];if(contacts.length<2)return null;
      return {x:(contacts[0].x+contacts[1].x)/2,y:(contacts[0].y+contacts[1].y)/2,
        distance:Math.max(1,Math.hypot(contacts[0].x-contacts[1].x,contacts[0].y-contacts[1].y))};
    };
    dualScroller.addEventListener('pointerdown',event=>{
      if(event.pointerType==='touch'){
        dualContacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(dualContacts.size>=2){dualStage._nmGesturePinching=true;
          dualPinch=dualMeasure();dualPan=null;event.preventDefault();return}
      }
      if(event.button!==0&&event.button!==1)return;
      if(event.target.closest?.('.nm-view-card,button,input,select,textarea'))return;
      dualPan={id:event.pointerId,x:event.clientX,y:event.clientY,
        left:dualScroller.scrollLeft,top:dualScroller.scrollTop};
      dualScroller.setPointerCapture?.(event.pointerId);
    });
    dualScroller.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch'&&dualContacts.has(event.pointerId)){
        dualContacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(dualStage._nmGesturePinching&&dualContacts.size>=2){
          const next=dualMeasure();
          if(dualPinch&&next)zoomDual(app,next.distance/dualPinch.distance,next.x,next.y);
          dualPinch=next;event.preventDefault();return;
        }
      }
      if(!dualPan||dualPan.id!==event.pointerId)return;
      dualScroller.scrollLeft=dualPan.left-(event.clientX-dualPan.x);
      dualScroller.scrollTop=dualPan.top-(event.clientY-dualPan.y);
      if(event.pointerType==='touch')event.preventDefault();
    });
    const endDualPan=event=>{
      if(event.pointerType==='touch'){
        dualContacts.delete(event.pointerId);
        if(dualContacts.size<2){dualPinch=null;dualStage._nmGesturePinching=false}
      }
      if(dualPan?.id===event.pointerId){
        dualPan=null;
        const side=sideMode.get(app.state);
        if(side&&core.mode(app.state.root?.viewMode)!=='mindmap'){
          const cam=getCamera(app,side,true);
          cam.left=dualScroller.scrollLeft;cam.top=dualScroller.scrollTop;
          cameraSave(app);
        }
      }
      if(dualScroller.hasPointerCapture?.(event.pointerId))
        dualScroller.releasePointerCapture(event.pointerId);
    };
    dualScroller.addEventListener('pointerup',endDualPan);
    dualScroller.addEventListener('pointercancel',endDualPan);
    window.addEventListener?.('blur',()=>{
      dualContacts.clear();dualPan=null;dualPinch=null;dualStage._nmGesturePinching=false;
    });
    dualScroller.addEventListener('scroll',()=>{
      if(dualPane.hidden||!app.state)return;
      const secondary=sideMode.get(app.state);if(!secondary)return;
      const cam=getCamera(app,secondary,true);
      cam.left=dualScroller.scrollLeft;cam.top=dualScroller.scrollTop;
      cameraSave(app);
    },{passive:true});
    dualScroller.addEventListener('wheel',event=>{
      if(!event.ctrlKey&&!event.metaKey)return;
      event.preventDefault();event.stopPropagation();
      zoomDual(app,Math.exp(-Math.max(-120,Math.min(120,event.deltaY))*.002),
        event.clientX,event.clientY);
    },{passive:false});
    const dualTools=document.createElement('div');dualTools.id='nm-dual-tools';dualTools.hidden=true;
    const dualMakeSelect=(id,label)=>{
      const el=document.createElement('select');el.id=id;el.setAttribute('aria-label',label);return el;
    };
    const dualMakeInput=(id,type,label)=>{
      const el=document.createElement('input');el.id=id;el.type=type;
      el.setAttribute('aria-label',label);return el;
    };
    const dualTimelineTools=document.createElement('div');dualTimelineTools.id='nm-dual-timeline-tools';
    dualTimelineTools.className='nm-dual-tool-group';
    const dualTask=dualMakeSelect('nm-dual-task',tr('Attività da modificare','Task to edit'));
    const dualStart=dualMakeInput('nm-dual-start','date',tr('Data inizio','Start date'));
    const dualDue=dualMakeInput('nm-dual-due','date',tr('Data fine','Due date'));
    const dualDatesApply=document.createElement('button');dualDatesApply.type='button';dualDatesApply.id='nm-dual-apply-dates';
    dualDatesApply.addEventListener('click',()=>{
      const owner=app.state,node=owner.findNode(dualTask.value);
      if(!node)return;
      if(owner.setNodeWorkMetadata(node.id,{startDate:dualStart.value||'',dueDate:dualDue.value||''})){
        owner.selectedNodeId=node.id;app.markChanged();queue(app);
      }else app.showToast?.(tr('Date non valide o invariate.','Invalid or unchanged dates.'),'TIMELINE');
    });
    dualTask.addEventListener('change',()=>{
      const node=app.state.findNode(dualTask.value);
      dualStart.value=work.parseDate(node?.startDate)||'';
      dualDue.value=work.parseDate(node?.dueDate)||'';
    });
    const dualTimeScale=dualMakeSelect('nm-dual-time-scale',tr('Scala temporale','Time scale'));
    for(const [value,it,en]of [
      ['auto','Automatica','Automatic'],['days','Giorni','Days'],
      ['weeks','Settimane','Weeks'],['months','Mesi','Months']
    ]){
      const option=document.createElement('option');option.value=value;
      option.textContent=tr(it,en);dualTimeScale.append(option);
    }
    dualTimeScale.addEventListener('change',()=>changeAppearance(app,'timeline',{timeScale:dualTimeScale.value}));
    const dualTimeScaleHint=document.createElement('small');
    dualTimeScaleHint.id='nm-dual-time-scale-hint';
    dualTimeScaleHint.className='nm-timeline-scale-hint';dualTimeScaleHint.hidden=true;
    dualTimeScaleHint.setAttribute('role','status');
    dualTimelineTools.append(dualTask,dualStart,dualDue,dualDatesApply,dualTimeScale,dualTimeScaleHint);
    const dualNetworkTools=document.createElement('div');dualNetworkTools.id='nm-dual-network-tools';
    dualNetworkTools.className='nm-dual-tool-group';
    const dualRelationLabel=dualMakeInput('nm-dual-relation-label','text',tr('Nome relazione','Relationship label'));
    dualRelationLabel.maxLength=160;
    const dualLinkButton=document.createElement('button');dualLinkButton.type='button';dualLinkButton.id='nm-dual-connect';
    dualLinkButton.setAttribute('aria-pressed','false');
    dualLinkButton.addEventListener('click',()=>{
      if(linking.has(app.state))linking.delete(app.state);
      else linking.set(app.state,{source:null});
      queue(app);
    });
    dualNetworkTools.append(dualRelationLabel,dualLinkButton);
    const dualFlowTools=document.createElement('div');dualFlowTools.id='nm-dual-flow-tools';
    dualFlowTools.className='nm-dual-tool-group';
    const dualFlowFrom=dualMakeSelect('nm-dual-flow-from',tr('Nodo iniziale','Source node'));
    const dualFlowTo=dualMakeSelect('nm-dual-flow-to',tr('Nodo finale','Target node'));
    const dualFlowKind=dualMakeSelect('nm-dual-flow-kind',tr('Tipo collegamento','Transition type'));
    for(const [code,it,en]of [['sequence','Segue','Next'],['yes','Sì','Yes'],['no','No','No']]){
      const option=document.createElement('option');option.value=code;option.textContent=tr(it,en);dualFlowKind.append(option);
    }
    const dualFlowAdd=document.createElement('button');dualFlowAdd.type='button';dualFlowAdd.id='nm-dual-flow-add';
    dualFlowAdd.addEventListener('click',()=>{
      if(dualFlowFrom.value===dualFlowTo.value)return;
      const created=app.state.addFlowTransition(dualFlowFrom.value,dualFlowTo.value,dualFlowKind.value);
      if(created)app.markChanged();
      else app.showToast?.(tr('Collegamento non valido o già presente.','Invalid or duplicate transition.'),'FLUSSO');
    });
    const dualFlowShape=dualMakeSelect('nm-dual-flow-shape',
      tr('Forma del nodo iniziale','Source node shape'));
    for(const [code,it,en]of FLOW_SHAPE_CHOICES){
      const option=document.createElement('option');option.value=code;option.textContent=tr(it,en);
      dualFlowShape.append(option);
    }
    dualFlowFrom.addEventListener('change',()=>{
      dualFlowShape.value=flows.shape(app.state.findNode(dualFlowFrom.value)?.flowShape);
      dualFlowShape.disabled=!dualFlowFrom.value||dualFlowFrom.value===app.state.root?.id;
    });
    dualFlowShape.addEventListener('change',()=>{
      if(app.state.setNodeFlowShape?.(dualFlowFrom.value,dualFlowShape.value)){
        app.markChanged();queue(app);
      }
    });
    dualFlowTools.append(dualFlowFrom,dualFlowTo,dualFlowKind,dualFlowShape,dualFlowAdd);
    dualTools.append(dualTimelineTools,dualNetworkTools,dualFlowTools);
    dualPane.append(dualBar,dualTools,dualScroller);panels.append(scroller,dualPane);
    overlay.append(controls,panels,help);document.body.append(overlay);
    picker.addEventListener('change',()=>setMode(app,picker.value));
    root.NeuroMapViewPicker?.create(picker);root.NeuroMapViewPicker?.create(viewPicker);
    root.addEventListener?.('glauka:language-change',()=>queue(app));
  }
