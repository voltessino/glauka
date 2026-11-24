  function captureVisibleCamera(app){
    if(!app.state||document.getElementById('nm-view-overlay')?.hidden)return;
    const scroller=document.getElementById('nm-view-scroller');if(!scroller)return;
    const camera=activeCamera(app);
    camera.left=scroller.scrollLeft;camera.top=scroller.scrollTop;
    const base=core.mode(app.state.root?.viewMode),secondary=sideMode.get(app.state);
    const secondaryPane=document.getElementById('nm-dual-pane');
    if(base!=='mindmap'&&secondary&&!secondaryPane?.hidden){
      const other=document.getElementById('nm-dual-scroller');
      if(other){const otherCamera=getCamera(app,secondary,true);
        otherCamera.left=other.scrollLeft;otherCamera.top=other.scrollTop;}
    }
  }
  // Shared between desktop HTML drag-and-drop and touch pointer gestures.
  const kanbanColumnAt=(app,event,stage=document.getElementById('nm-view-stage'),zoom=activeCamera(app).zoom)=>{
    const x=(event.clientX-stage.getBoundingClientRect().left)/zoom;
    return ['unassigned','todo','doing','done'][Math.max(0,Math.min(3,Math.round((x-135)/235)))];
  };
  // Shared move semantics for native drag, touch, keyboard and split view.
  // All coordinates are viewport coordinates; boundingClientRect already
  // includes the active CSS zoom, so avoid applying zoom a second time.
/* @neuromap-linked-view-camera-kanban */
  function zoomView(app,wanted,clientX,clientY,fit=false,anchorClientX=clientX,anchorClientY=clientY){
    const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
    const frame=document.getElementById('nm-view-frame');
    if(!scroller||!frame||!app.state)return;
    const camera=activeCamera(app),previous=camera.zoom,zoom=Math.max(.02,Math.min(3.5,Number(wanted)||1));
    const box=scroller.getBoundingClientRect(),x=(clientX??(box.left+box.width/2))-box.left,y=(clientY??(box.top+box.height/2))-box.top;
    const worldX=(scroller.scrollLeft+(anchorClientX??(box.left+box.width/2))-box.left)/previous;
    const worldY=(scroller.scrollTop+(anchorClientY??(box.top+box.height/2))-box.top)/previous;
    camera.zoom=zoom;stage.style.transform='scale('+zoom+')';
    if(stage.dataset)stage.dataset.orgDetail=
      displayMode(app.state)==='orgchart'&&zoom<.62?'overview':'detail';
    frame.style.width=Math.ceil(stage.offsetWidth*zoom)+'px';
    frame.style.height=Math.ceil(stage.offsetHeight*zoom)+'px';
    scroller.scrollLeft=fit?Math.max(0,(stage.offsetWidth*zoom-scroller.clientWidth)/2):Math.max(0,worldX*zoom-x);
    scroller.scrollTop=fit?Math.max(0,(stage.offsetHeight*zoom-scroller.clientHeight)/2):Math.max(0,worldY*zoom-y);
    camera.left=scroller.scrollLeft;camera.top=scroller.scrollTop;
    cameraSave(app);
    const status=document.getElementById('nm-view-zoom-status');if(status)status.textContent=Math.round(zoom*100)+'%';
  }
  function fitView(app){
    const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
    if(!scroller||!stage)return;
    const mode=displayMode(app.state);
    const raw=Math.min(1.5,(scroller.clientWidth-36)/Math.max(1,stage.offsetWidth),(scroller.clientHeight-36)/Math.max(1,stage.offsetHeight));
    // A long timeline or a wide chart must stay readable. Manual zoom can
    // still go closer or farther; this only bounds the Fit command.
    const framed=mode==='timeline'||mode==='orgchart';
    const zoom=framed?Math.max(mode==='timeline'?1:0.85,Math.min(1.15,raw)):raw;
    zoomView(app,zoom,undefined,undefined,!framed);
    if(!framed)return;
    const camera=activeCamera(app);
    if(mode==='timeline'){scroller.scrollLeft=0;scroller.scrollTop=0;}
    else{
      const cards=[...stage.querySelectorAll('.nm-view-card')];
      if(cards.length){
        const top=Math.min(...cards.map(card=>Number.parseFloat(card.style.top)||0));
        const lefts=cards.map(card=>Number.parseFloat(card.style.left)||0);
        const mid=(Math.min(...lefts)+Math.max(...lefts))/2;
        scroller.scrollLeft=Math.max(0,mid*zoom-scroller.clientWidth/2);
        scroller.scrollTop=Math.max(0,(top-28)*zoom);
      }
    }
    camera.left=scroller.scrollLeft;camera.top=scroller.scrollTop;
  }
  // Per-tab session-only focus, never written to project data.
  const focusedIds=new WeakMap();
  function focusRoot(state,requestedId=focusedIds.get(state)){
    if(!requestedId)return null;
    const found=state.findNode?.(requestedId);
    if(!found)throw Error(tr('Il ramo scelto non esiste più. Disattiva il filtro.',
      'Selected branch no longer exists. Turn off branch focus.'));
    return found;
  }
  function projected(state,mode,id=focusedIds.get(state)){
    const layout=projectView(state,mode,focusRoot(state,id));
    return appearance&&mode!=='concept-network'?appearance.applyDensity(layout,viewStyle(state,mode)):layout;
  }
  function setFocus(app,selectedId){
    const state=app.state;
    if(!state?.root)return false;
    const original=focusedIds.get(state)||null;
    const next=selectedId||null;
    if(original===next){queue(app);return true;}
    if(next){
      let node;
      try{node=focusRoot(state,next)}
      catch(error){
        app.showToast?.(tr('Ramo non disponibile: ','Branch unavailable: ')+
          String(error?.message||error),'VISTA');
        queue(app);return false;
      }
      if(!Array.isArray(node.children)||!node.children.length){
        app.showToast?.(tr('Seleziona un ramo che abbia dei discendenti.',
          'Select a branch with descendants.'),'VISTA');
        queue(app);return false;
      }
    }
    const current=displayMode(state);
    if(current!=='mindmap'){
      try{projected(state,current,next)}
      catch(error){
        app.showToast?.(tr('Impossibile cambiare ambito: ','Cannot change view scope: ')+
          String(error?.message||error),'VISTA');
        queue(app);return false;
      }
    }
    if(next)focusedIds.set(state,next);else focusedIds.delete(state);
    queue(app);
    return true;
  }
  function displayMode(state){
    const base=core.mode(state?.root?.viewMode);
    return base==='mindmap'?(sideMode.get(state)||base):base;
  }
  // A view switch is a reversible presentation choice, not permission to
  // put the project into an unrenderable state. Validate before pushHistory.
  function canProject(app,wanted){
    if(!wanted||wanted==='mindmap')return true;
    try{
      projected(app.state,wanted);
      return true;
    }catch(error){
      app.showToast?.(tr('Vista non disponibile: ','View unavailable: ')+
        String(error?.message||error),'VISTA');
      // Reset pickers to the last working mode; no state/history mutation.
      queue(app);
      return false;
    }
  }
/* @neuromap-linked-view-camera-workspace-panels */
