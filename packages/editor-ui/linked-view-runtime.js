/* @neuromap-linked-view-runtime-sync */
/* @neuromap-linked-view-runtime-dual */
/* @neuromap-linked-view-runtime-render */
  function queue(app){
    if(refresh.get(app))return;
    refresh.set(app,true);
    requestAnimationFrame(()=>{refresh.set(app,false);render(app)});
  }
  const bind=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){
    const result=bind.apply(this,args);
    ensure(this);queue(this);
    if(!this._nmLinkedLocaleBound&&root.NeuroMapWorkspaceLocale?.watch){
      this._nmLinkedLocaleBound=true;
      root.NeuroMapWorkspaceLocale.watch(()=>queue(this));
    }
    return result;
  };
  const activate=App.prototype.activateTab;
  App.prototype.activateTab=function(...args){
    const nextId=args[0];
    if(this.activeTabId&&this.activeTabId!==nextId){
      captureVisibleCamera(this);
      cameraSave(this);
      linking.delete(this.state);
      flowPreview.delete(this.state);
      // Preserve the original tab's active inline edit in either canvas
      // before activateTab changes the document owner.
      document.querySelector('#nm-view-stage .nm-view-edit')?.blur();
      document.querySelector('#nm-dual-stage .nm-view-edit')?.blur();
    }
    return activate.apply(this,args);
  };
  // The primary mind-map camera is already saved as tab.camera. Persist
  // viewport-only navigation too: zoom, mouse/touch pan, keyboard movement,
  // Fit and teleport do not necessarily mutate any project node.
  const requestRender=App.prototype.requestRender;
  if(typeof requestRender==='function')App.prototype.requestRender=function(...args){
    const camera=this.renderer?.camera;
    if(camera&&!this._desktopRecoveryPending&&
       [camera.x,camera.y,camera.zoom].every(Number.isFinite)){
      const signature=[camera.x,camera.y,camera.zoom].map(n=>Math.round(n*10000)/10000).join('|');
      if(signature!==this._nmViewportSaveSignature){
        this._nmViewportSaveSignature=signature;
        if(!this._nmHomePlaceholder)this.scheduleSave?.();
      }
    }
    return requestRender.apply(this,args);
  };
  const recalc=App.prototype.recalculateAndRender;
  App.prototype.recalculateAndRender=function(...args){const result=recalc.apply(this,args);queue(this);return result};
  if(!document.documentElement?.dataset?.nmViewThemeBound){
    if(document.documentElement?.dataset)document.documentElement.dataset.nmViewThemeBound='1';
    document.addEventListener('neuromap:canvas-theme',()=>{
      const app=root.neuroMapApp;
      if(app)queue(app);
    });
  }
  root.NeuroMapLinkedViews=Object.freeze({setMode,setFocus,refresh:queue,
    exportSVG:(app,options)=>exportView(app,'svg',2,options),
    exportPNG:(app,scale=2,options)=>exportView(app,'png',scale,options),
    exportPDF:(app,options)=>exportView(app,'pdf',2,options),
    exportPDFPage:(app,options)=>exportView(app,'pdf-jpg',2,{captureOnly:true,...options}),
    restoreFromTab(app,fromFile=false){
      if(!app?.state)return;
      if(fromFile)reopenedFromDisk.add(app.state);
      workspaceStates.delete(app.state);
      viewCameras.delete(app.state);lastView.delete(app);lastRenderedState.delete(app);
      queue(app);
    }
  });
