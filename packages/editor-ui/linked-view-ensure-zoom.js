    const zoomBar=document.createElement('div');zoomBar.id='nm-view-zoom';zoomBar.setAttribute('role','group');
    zoomBar.setAttribute('aria-label',tr('Zoom della vista','View zoom'));
    function zoomButton(id,it,en,action,glyph){
      const b=document.createElement('button');b.type='button';b.id=id;
      const name=tr(it,en);
      b.textContent=glyph==null?name:glyph;
      b.title=name;b.setAttribute('aria-label',name);b.addEventListener('click',action);
      zoomBar.append(b);
    }
    zoomButton('nm-view-zoom-out','Riduci zoom','Zoom out',()=>zoomView(app,activeCamera(app).zoom/1.2),'−');
    zoomButton('nm-view-zoom-in','Aumenta zoom','Zoom in',()=>zoomView(app,activeCamera(app).zoom*1.2),'+');
    const zoomStatus=document.createElement('span');zoomStatus.id='nm-view-zoom-status';zoomStatus.textContent='100%';zoomBar.append(zoomStatus);
    zoomButton('nm-view-zoom-reset','Ripristina zoom','Reset zoom',()=>zoomView(app,1),'100%');
    zoomButton('nm-view-zoom-fit','Adatta la vista alla finestra','Fit the view to the window',()=>fitView(app),tr('Adatta','Fit'));
    // Existing exports remain accessible without four permanently visible buttons.
    const exportMenu=document.createElement('details');exportMenu.id='nm-view-export-menu';
    const exportSummary=document.createElement('summary');exportSummary.textContent=tr('Esporta','Export');
    exportSummary.setAttribute('aria-label',tr('Opzioni di esportazione della vista','View export options'));
    const exportActions=document.createElement('div');exportActions.id='nm-view-export-actions';
    exportActions.append(exportSvg,exportPng1,exportPng2,exportPdf);
    exportMenu.append(exportSummary,exportActions);
    look.addEventListener('toggle',()=>{if(look.open){exportMenu.open=false;options.open=false}});
    exportMenu.addEventListener('toggle',()=>{if(exportMenu.open){look.open=false;options.open=false}});
    options.addEventListener('toggle',()=>{if(options.open){look.open=false;exportMenu.open=false}});
    document.addEventListener('pointerdown',event=>{
      if(overlay.hidden)return;
      if(look.open&&!look.contains(event.target))look.open=false;
      if(exportMenu.open&&!exportMenu.contains(event.target))exportMenu.open=false;
      if(options.open&&!options.contains(event.target))options.open=false;
    },true);
    header.append(title,viewPicker,hint,orgSearch,headerFocus,zoomBar,look,exportMenu,back,actionStatus);
    const scroller=document.createElement('div');scroller.id='nm-view-scroller';scroller.tabIndex=0;
    const stage=document.createElement('div');stage.id='nm-view-stage';
    stage._nmGesturePinching=false;stage._nmPinchIds=new Set();
    stage._nmDragId=null;
    const clearDrag=()=>{
      stage._nmDragId=null;
      kanbanClearDropHints(stage);
    };
    const pickKanbanColumn=event=>kanbanColumnAt(app,event);
    stage.addEventListener('dragover',event=>{
      if(displayMode(app.state)!=='kanban'||!stage._nmDragId)return;
      event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      const target=pickKanbanColumn(event);
      const before=kanbanInsertionAt(stage,target,event.clientY,stage._nmDragId);
      kanbanPreviewDrop(stage,target,before);
    });
    stage.addEventListener('drop',event=>{
      if(displayMode(app.state)!=='kanban'||!stage._nmDragId)return;
      event.preventDefault();
      const id=stage._nmDragId,status=pickKanbanColumn(event);
      const before=kanbanInsertionAt(stage,status,event.clientY,id);
      clearDrag();
      kanbanApplyMove(app,stage,id,status,before);
    });
    stage.addEventListener('dragend',clearDrag);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='nm-view-lines';svg.setAttribute('aria-hidden','true');
    const frame=document.createElement('div');frame.id='nm-view-frame';
    stage.append(svg);frame.append(stage);scroller.append(frame);
    // WebKit on macOS can emit native gesture events instead of Ctrl-wheel.
    // GestureEvent.scale is relative to gesturestart, not the prior frame.
    let nativeGesture=null;
    // A closed view can disappear before WebKit dispatches gestureend (or the
    // operating system may omit it). Clear the gesture on hide as well.
    overlay._nmCancelNativeGesture=()=>{nativeGesture=null};
    document.addEventListener('gesturestart',event=>{
      if(overlay.hidden||!overlay.contains(event.target))return;
      const blocked=event.target.closest?.('input,textarea,select,[contenteditable="true"],.nm6-shade:not(.hidden),.nm-creative-shade,#nm-decision-overlay:not(.hidden)');
      if(blocked)return;
      event.preventDefault();event.stopPropagation();
      const dual=!dualPane.hidden&&dualPane.contains(event.target);
      nativeGesture={dual,zoom:dual?getCamera(app,sideMode.get(app.state),true).zoom:activeCamera(app).zoom};
    },{capture:true,passive:false});
    document.addEventListener('gesturechange',event=>{
      if(overlay.hidden||!nativeGesture)return;
      // A gesture can move to another workspace surface before WebKit
      // delivers gestureend. Release our pinch without consuming or applying
      // the other surface's gesturechange.
      if(!overlay.contains(event.target)||
         event.target.closest?.('input,textarea,select,[contenteditable="true"],.nm6-shade:not(.hidden),.nm-creative-shade,#nm-decision-overlay:not(.hidden)')){
        nativeGesture=null;
        return;
      }
      event.preventDefault();event.stopPropagation();
      if(!Number.isFinite(event.scale)||event.scale<=0)return;
      if(nativeGesture.dual){
        const cam=getCamera(app,sideMode.get(app.state),true);
        zoomDual(app,nativeGesture.zoom*event.scale/cam.zoom,event.clientX,event.clientY);
      }else zoomView(app,nativeGesture.zoom*event.scale,
        overlay.contains(event.target)?event.clientX:undefined,
        overlay.contains(event.target)?event.clientY:undefined);
    },{capture:true,passive:false});
    document.addEventListener('gestureend',event=>{
      if(!nativeGesture)return;
      // macOS may dispatch gestureend after a panel has already closed.
      // Always release the gesture state before deciding whether to suppress
      // the native event, otherwise future Ctrl-wheel zoom stays blocked.
      nativeGesture=null;
      // An unrelated panel may receive a new native gesture before WebKit
      // delivers this end event. Never consume its event outside our view.
      if(overlay.hidden||!overlay.contains(event.target))return;
      event.preventDefault();event.stopPropagation();
    },{capture:true,passive:false});
    // Capture trackpad pinch/Ctrl-wheel before Chromium can zoom the entire app.
    document.addEventListener('wheel',event=>{
      if(overlay.hidden||(!event.ctrlKey&&!event.metaKey))return;
      const blocked=event.target.closest?.('input,textarea,select,[contenteditable="true"],.nm6-shade:not(.hidden),.nm-creative-shade,#nm-decision-overlay:not(.hidden)');
      // Do not swallow Cmd/Ctrl-wheel on unrelated chrome, native editor
      // fields or modal surfaces while a linked view happens to be open.
      if(blocked||!overlay.contains(event.target))return;
      event.preventDefault();event.stopImmediatePropagation();
      // When WebKit also sends a GestureEvent, avoid applying zoom twice.
      if(nativeGesture)return;
      const lines=event.deltaMode===1?16:event.deltaMode===2?scroller.clientHeight:1;
      const delta=Math.max(-120,Math.min(120,event.deltaY*lines));
      const trackpad=event.deltaMode===0&&Math.abs(event.deltaY)<40;
      const gain=root.NeuroMapAppSettings?.linkedGain(trackpad?'trackpad':'mouse')??.002;
      const prefs=root.NeuroMapAppSettings?.zoom?.()||{cursor:true};
      const point=prefs.cursor&&scroller.contains(event.target)
        ?[event.clientX,event.clientY]:[undefined,undefined];
      if(!dualPane.hidden&&dualPane.contains(event.target))
        zoomDual(app,Math.exp(-delta*gain),prefs.cursor?event.clientX:undefined,prefs.cursor?event.clientY:undefined);
      else zoomView(app,activeCamera(app).zoom*Math.exp(-delta*gain),point[0],point[1]);
    },{capture:true,passive:false});
    // The document capture listener owns Ctrl/Cmd zoom for both panes.
    // Do not register a second scroller listener: a bubbling keydown would zoom twice.
    scroller.addEventListener('scroll',()=>{
      if(!app.state||document.getElementById('nm-view-overlay')?.hidden)return;
      const cam=activeCamera(app);cam.left=scroller.scrollLeft;cam.top=scroller.scrollTop;
      cameraSave(app);
    },{passive:true});
    // Touch gestures are scoped to this view, never to the surrounding app chrome.
    // A single finger pans empty space; two fingers pinch around their midpoint.
    // Cards retain their own tap/drag handlers and are not hijacked by panning.
    const contacts=new Map();
    let pan=null,pinch=null;
    const touchMeasure=()=>{
      const p=[...contacts.values()];
      if(p.length<2)return null;
      return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,
        distance:Math.max(1,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y))};
    };
    scroller.addEventListener('pointerdown',event=>{
      if(event.pointerType==='touch'){
        contacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(contacts.size>=2){
          stage._nmGesturePinching=true;
          for(const id of contacts.keys())stage._nmPinchIds.add(id);
          pinch=touchMeasure();pan=null;
          event.preventDefault();return;
        }
      }
      if(event.button!==0&&event.button!==1)return;
      if(event.target.closest?.('.nm-view-card,button,input,select,textarea'))return;
      pan={id:event.pointerId,x:event.clientX,y:event.clientY,left:scroller.scrollLeft,top:scroller.scrollTop};
      scroller.setPointerCapture?.(event.pointerId);
    });
    scroller.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch'&&contacts.has(event.pointerId)){
        contacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(stage._nmGesturePinching&&contacts.size>=2){
          const next=touchMeasure();
          if(pinch&&next)zoomView(app,activeCamera(app).zoom*(next.distance/pinch.distance),
            next.x,next.y,false,pinch.x,pinch.y);
          pinch=next;event.preventDefault();return;
        }
      }
      if(!pan||pan.id!==event.pointerId)return;
      scroller.scrollLeft=pan.left-(event.clientX-pan.x);
      scroller.scrollTop=pan.top-(event.clientY-pan.y);
      if(event.pointerType==='touch')event.preventDefault();
    });
    const endPan=event=>{
      if(pan?.id===event.pointerId){
        const cam=activeCamera(app);
        cam.left=scroller.scrollLeft;cam.top=scroller.scrollTop;
        cameraSave(app);
      }
      if(event.pointerType==='touch'){
        contacts.delete(event.pointerId);
        if(contacts.size<2){pinch=null;stage._nmGesturePinching=false}
        stage._nmPinchIds.delete(event.pointerId);
      }
      if(pan?.id===event.pointerId)pan=null;
      if(scroller.hasPointerCapture?.(event.pointerId))scroller.releasePointerCapture(event.pointerId);
    };
    scroller.addEventListener('pointerup',endPan);
    scroller.addEventListener('pointercancel',endPan);
    window.addEventListener?.('blur',()=>{
      contacts.clear();pan=null;pinch=null;nativeGesture=null;stage._nmGesturePinching=false;stage._nmPinchIds.clear();
    });
