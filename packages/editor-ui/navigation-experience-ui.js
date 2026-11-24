 function ui(app){
   let h=document.getElementById('nm616-navigation');
   if(h)return h;
   const style=document.createElement('style');style.id='nm616-navigation-css';style.textContent=styles;document.head.append(style);
   h=document.createElement('section');h.id='nm616-navigation';h.className='nm6-skiptranslate';
   label(h,'Esplora la mappa','Explore map','aria-label');
   const flyout=document.getElementById('nm614-navigation-flyout'),embedded=!!flyout;
   const disclosure=document.createElement('details');disclosure.open=embedded;h.dataset.embedded=String(embedded);disclosure.id='nm616-nav-disclosure';
   const summary=document.createElement('summary'),name=document.createElement('span');
   label(name,'Esplora','Explore');summary.hidden=embedded;summary.append(name);disclosure.append(summary);
   const bar=document.createElement('div');bar.className='nm616-nav-card';
   const caption=document.createElement('strong');caption.id='nm616-nav-caption';
   const status=document.createElement('span');status.id='nm616-nav-status';
   const focus=document.createElement('button');focus.id='nm616-nav-focus';focus.type='button';
   focus.addEventListener('click',()=>{
     const record=active.get(app.state);
     if(record)exitFocus(app);
     else{
       const rootNode=app.state.root;
       const selected=app.state.findNode(app.state.selectedNodeId);
       const target=selected&&selected.id!==rootNode.id?selected.id:
         (rootNode.children||[]).find(n=>!n.isSummary)?.id||rootNode.id;
       enterFocus(app,target);
     }
   });
   const restore=document.createElement('button');restore.id='nm616-nav-restore';restore.type='button';
   restore.addEventListener('click',()=>exitFocus(app));
   const semantic=document.createElement('button');semantic.id='nm616-nav-semantic';semantic.type='button';
   semantic.addEventListener('click',()=>{
     preferences.semantic=!preferences.semantic;persist();
     app.renderer.semanticZoomEnabled=preferences.semantic;
     app.requestRender();schedule(app,true);
   });
   const mapToggle=document.createElement('button');mapToggle.id='nm616-nav-map-toggle';mapToggle.type='button';
   mapToggle.addEventListener('click',()=>{preferences.minimap=!preferences.minimap;persist();schedule(app,true)});
   const trail=document.createElement('div');trail.id='nm616-nav-trail';
   trail.setAttribute('aria-live','polite');
   const trailLabel=document.createElement('small');trailLabel.id='nm616-nav-trail-label';
   label(trailLabel,'Posizione nella mappa','Position in map');
   const trailPath=document.createElement('div');trailPath.id='nm616-nav-trail-path';
   const trailMeta=document.createElement('small');trailMeta.id='nm616-nav-trail-meta';
   trail.append(trailLabel,trailPath,trailMeta);
   const branchList=document.createElement('div');branchList.id='nm616-nav-branches';
   const heading=document.createElement('div');heading.className='nm616-nav-heading';heading.append(caption,status);
   const options=document.createElement('details');options.id='nm616-nav-options';const optionsTitle=document.createElement('summary');label(optionsTitle,'Opzioni di visualizzazione','Display options');options.append(optionsTitle,semantic);
   heading.hidden=embedded;options.hidden=true;branchList.hidden=true;bar.append(heading,trail,focus,restore,mapToggle,branchList,options);
   disclosure.append(bar);h.append(disclosure);
   if(embedded)flyout.append(h);else if(root.NeuroMapWorkspaceChrome)root.NeuroMapWorkspaceChrome.mount(h);else document.body.append(h);
   document.addEventListener('pointerdown',e=>{if(!embedded&&!h.contains(e.target))disclosure.open=false;});
   document.addEventListener('neuromap:ui-theme-change',()=>schedule(app,true));
   disclosure.addEventListener('keydown',e=>{if(!embedded&&e.key==='Escape'&&disclosure.open){e.preventDefault();e.stopPropagation();disclosure.open=false;summary.focus();}});
   const shell=document.createElement('section');shell.id='nm616-minimap-shell';shell.className='nm6-skiptranslate';
   const header=document.createElement('header'),title=document.createElement('span');label(title,'Minimappa','Minimap');
   const full=document.createElement('button');full.type='button';full.textContent='◎';
   label(full,'Mostra mappa intera','Fit full map','title');label(full,'Mostra mappa intera','Fit full map','aria-label');
   full.addEventListener('click',()=>app.fitWholeMap?.());
   const close=document.createElement('button');close.type='button';close.id='nm616-map-close';close.textContent='×';label(close,'Nascondi minimappa','Hide minimap','aria-label');label(close,'Nascondi minimappa','Hide minimap','title');close.addEventListener('click',()=>{preferences.minimap=false;persist();shell.hidden=true;schedule(app,true)});
   const radarMode=document.createElement('button');radarMode.type='button';radarMode.id='nm616-map-mode';radarMode.textContent='≋';
   radarMode.addEventListener('click',()=>{preferences.detail=!preferences.detail;persist();schedule(app,true)});
   const expand=document.createElement('button');expand.type='button';expand.id='nm616-map-expand';expand.textContent='⤢';
   expand.addEventListener('click',()=>{preferences.expanded=!preferences.expanded;persist();schedule(app,true)});
   header.append(title,radarMode,expand,full,close);
   const canvas=document.createElement('canvas');canvas.id='nm616-map';canvas.width=380;canvas.height=244;
   canvas.tabIndex=0;canvas.setAttribute('role','button');
   label(canvas,'Minimappa interattiva. Clicca o trascina per spostare la vista.','Interactive minimap. Click or drag to pan.','aria-label');
   label(canvas,'Minimappa interattiva. Clicca o trascina per spostare la vista.','Interactive minimap. Click or drag to pan.','title');
   const footer=document.createElement('footer'),navGroup=document.createElement('div'),prevBtn=document.createElement('button'),nextBtn=document.createElement('button'),ratio=document.createElement('span');
   navGroup.className='nm616-map-nav';navGroup.setAttribute('role','group');
   prevBtn.type='button';prevBtn.id='nm616-map-prev';prevBtn.textContent='‹';
   nextBtn.type='button';nextBtn.id='nm616-map-next';nextBtn.textContent='›';
   const stepBranch=dir=>{
     if(typeof app.nm67NavigateMain==='function'){app.nm67NavigateMain(dir);schedule(app);return;}
     const items=app.state?.root?.children;if(!items?.length)return;
     const idx=items.findIndex(n=>n.id===app.state.selectedNodeId);
     const next=items[(idx+dir+items.length)%items.length];
     app.selectNode?.(next.id);schedule(app);
   };
   prevBtn.addEventListener('click',()=>stepBranch(-1));
   nextBtn.addEventListener('click',()=>stepBranch(1));
   navGroup.append(prevBtn,nextBtn);
   ratio.id='nm616-map-ratio';
   footer.append(navGroup,ratio);shell.append(header,canvas,footer);
   shell.addEventListener('pointerdown',event=>{event.stopPropagation();});
   const adopt=()=>{
     if(shell.parentElement!==document.body)document.body.append(shell);
     const panel=document.getElementById('nm614-navigation-flyout');
     if(!panel)return false;
     if(h.parentElement!==panel)panel.append(h);
     return true;
   };
   adopt();
   if(!document.getElementById('nm614-navigation-flyout')&&typeof MutationObserver==='function'){
     const watch=new MutationObserver(()=>{if(adopt())watch.disconnect();});
     watch.observe(document.body,{childList:true});
   }
   const pan=event=>{
     if(!app.state?.root||!canvas._nmProjection||dragging!==null&&dragState!==app.state)return;
     const rect=canvas.getBoundingClientRect();
     const proj=canvas._nmProjection;
     const x=(event.clientX-rect.left)*proj.width/Math.max(1,rect.width),
       y=(event.clientY-rect.top)*proj.height/Math.max(1,rect.height);
     const world=core.minimapToWorld(canvas._nmProjection,x,y);
     if(!world)return;
     const camera=app.renderer.camera;
     camera.x=root.innerWidth*.5-world.x*camera.zoom;
     camera.y=root.innerHeight*.5-world.y*camera.zoom;
     app.requestRender?.();
   };
   let dragging=null,dragState=null,pendingPan=null,panFrame=0;
   const flushPan=()=>{if(panFrame)cancelAnimationFrame(panFrame);panFrame=0;const event=pendingPan;pendingPan=null;if(event)pan(event)};
   canvas.addEventListener('pointerdown',event=>{
     if(event.button!==0)return;
     dragging=event.pointerId;dragState=app.state;app.stopTeleport?.();canvas.setPointerCapture?.(event.pointerId);pan(event);
   });
   canvas.addEventListener('pointermove',event=>{if(dragging!==event.pointerId)return;pendingPan={clientX:event.clientX,clientY:event.clientY};if(!panFrame)panFrame=requestAnimationFrame(flushPan)});
   const end=event=>{if(dragging!==event.pointerId)return;flushPan();dragging=null;dragState=null;
     if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
   };
   canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
   canvas.addEventListener('keydown',event=>{
     if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
       event.preventDefault();event.stopPropagation();
       const camera=app.renderer.camera,step=70;
       if(event.key==='ArrowLeft')camera.x+=step;
       if(event.key==='ArrowRight')camera.x-=step;
       if(event.key==='ArrowUp')camera.y+=step;
       if(event.key==='ArrowDown')camera.y-=step;
       app.requestRender();
     }
     if(event.key==='Enter'){event.preventDefault();app.fitWholeMap?.()}
   });
   document.addEventListener('keydown',event=>{
     if(event.key!=='Escape'||!active.has(app.state)||event.defaultPrevented)return;
     if(event.target?.closest?.('input,textarea,select,[contenteditable=true],[role=dialog],#nm616-nav-disclosure[open]'))return;
     // Do not swallow active editing / drag gestures. Leave native editor escape handling in charge.
     if(app.editorNodeId||app.drag||app.relationshipSourceId)return;
     event.preventDefault();exitFocus(app);
   },true);
   return h;
 }
 // The minimap can be hidden while the compass is in use. Defer geometry
 // reads until visible; camera motion can reuse the last measured points.
