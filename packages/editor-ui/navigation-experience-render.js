 function paint(app,entry){
   const canvas=document.getElementById('nm616-map');if(!canvas||!entry)return;
   const wide=preferences.expanded,width=wide?310:190,height=wide?205:122;
   const physical=Math.min(2.5,root.devicePixelRatio||1);
   const bufferW=Math.max(1,Math.round(width*physical));
   const bufferH=Math.max(1,Math.round(height*physical));
   if(canvas.width!==bufferW||canvas.height!==bufferH){
     canvas.width=bufferW;canvas.height=bufferH;
   }
   const ctx=canvas.getContext('2d');if(!ctx)return;
   const theme=root.getComputedStyle?.(document.body);
   const focusInk=theme?.getPropertyValue('--nm-theme-focus').trim()||'#c4b5fd';
   const ink=theme?.getPropertyValue('--nm-skin-ink').trim()||'#d7def0';
   const surface=theme?.getPropertyValue('--nm-skin-top').trim()||'#101a30';
   ctx.setTransform(bufferW/width,0,0,bufferH/height,0,0);
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality='high';
   ctx.clearRect(0,0,width,height);
   ctx.fillStyle=surface;ctx.fillRect(0,0,width,height);
   const projected=core.minimap(entry.points,app.renderer.camera,
     {width:root.innerWidth,height:root.innerHeight},
     {width,height,padding:wide?14:9});
   canvas._nmProjection=projected;
   // Preserve map layout and hierarchy. The condensed overview shows
   // root and first two branch levels; detail can show deeper topics.
   const overview=!preferences.detail,selectedId=String(app.state.selectedNodeId);
   const stride=Math.max(1,Math.ceil(projected.nodes.length/(wide?5400:2600)));
   ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
   for(let i=0;i<projected.edges.length;i++){
     const edge=projected.edges[i];
     if(overview&&edge.depth>2)continue;
     if(!overview&&edge.depth>2&&i%stride!==0)continue;
     const dx=edge.x2-edge.x1;
     ctx.strokeStyle=edge.color;
     ctx.globalAlpha=edge.depth===1?.82:edge.depth===2?.55:.28;
     ctx.lineWidth=edge.depth===1?(wide?2.1:1.55):edge.depth===2?1.05:.7;
     ctx.beginPath();ctx.moveTo(edge.x1,edge.y1);
     const bend=dx*.52;
     ctx.bezierCurveTo(edge.x1+bend,edge.y1,edge.x2-bend,edge.y2,edge.x2,edge.y2);
     ctx.stroke();
   }
   ctx.restore();
   const focus=active.get(app.state),allowed=app.renderer.visualFocusIds;
   for(let i=0;i<projected.nodes.length;i++){
     const n=projected.nodes[i],selected=n.logicalId===selectedId;
     if(overview&&n.depth>2&&!selected)continue;
     if(!overview&&stride>1&&i%stride!==0&&n.depth>2&&!selected)continue;
     const w=Math.max(n.depth<2?4.4:1.7,n.w*(n.depth>2?.66:1));
     const h=Math.max(n.depth<2?3.2:1.5,n.h*(n.depth>2?.70:1));
     ctx.globalAlpha=focus&&allowed&&!allowed.has(String(n.logicalId))?.2:n.depth>2?.65:.95;
     ctx.fillStyle=n.color;ctx.fillRect(n.x-w/2,n.y-h/2,w,h);
     if(n.depth===0){ctx.globalAlpha=1;ctx.strokeStyle=ink;ctx.lineWidth=wide?1.25:.8;
       ctx.strokeRect(n.x-w/2-1,n.y-h/2-1,w+2,h+2)}
   }
   ctx.globalAlpha=1;
   const viewport=projected.viewport;
   if(viewport&&viewport.width>1&&viewport.height>1){
     ctx.fillStyle=focusInk;ctx.globalAlpha=.11;
     ctx.fillRect(viewport.x,viewport.y,viewport.width,viewport.height);
     ctx.globalAlpha=1;ctx.strokeStyle=focusInk;ctx.lineWidth=1.7;
     ctx.setLineDash([4,3]);
     ctx.strokeRect(viewport.x,viewport.y,viewport.width,viewport.height);
     ctx.setLineDash([]);
   }
   const selected=projected.nodes.find(n=>n.logicalId===selectedId);
   if(selected){
     ctx.globalAlpha=1;ctx.strokeStyle=focusInk;ctx.lineWidth=1.5;
     ctx.beginPath();ctx.arc(selected.x,selected.y,Math.max(4,selected.w/2+3),0,Math.PI*2);ctx.stroke();
   }
 }
 function refresh(app,{force=false}={}){
   ui(app);
   const h=document.getElementById('nm616-navigation'),shell=document.getElementById('nm616-minimap-shell');
   if(!h||!shell||!app.state?.root)return;
   const mode=app.state.root.viewMode||'mindmap',mapVisible=mode==='mindmap';
   const zoom=app.renderer.camera.zoom,focus=active.get(app.state);
   if(focus){
     const p=core.focusPath(app.state.root,focus.targetId);
     if(!p){exitFocus(app,{silent:true})}
     else app.renderer.visualFocusIds=p.ids;
   }else app.renderer.visualFocusIds=null;
   const curr=active.get(app.state),level=core.semanticTier(zoom,preferences.semantic),branchLevel=core.semanticTier(zoom,true);
   h.hidden=!mapVisible;
   shell.hidden=!mapVisible||!preferences.minimap;
   shell.classList.toggle('nm616-map-expanded',preferences.expanded);
   const modeBtn=document.getElementById('nm616-map-mode'),expandBtn=document.getElementById('nm616-map-expand');
   if(modeBtn){
     label(modeBtn,preferences.detail?'Mostra panoramica':'Mostra dettagli',
       preferences.detail?'Show overview':'Show detail','aria-label');
     modeBtn.title=modeBtn.getAttribute('aria-label');
     modeBtn.setAttribute('aria-pressed',String(preferences.detail));
   }
   if(expandBtn){
     label(expandBtn,preferences.expanded?'Riduci minimappa':'Espandi minimappa',
       preferences.expanded?'Shrink minimap':'Expand minimap','aria-label');
     expandBtn.title=expandBtn.getAttribute('aria-label');
     expandBtn.setAttribute('aria-expanded',String(preferences.expanded));
   }
   const focusBtn=document.getElementById('nm616-nav-focus'),restore=document.getElementById('nm616-nav-restore'),
     semantic=document.getElementById('nm616-nav-semantic'),toggle=document.getElementById('nm616-nav-map-toggle'),
     list=document.getElementById('nm616-nav-branches');
   h.querySelector('#nm616-nav-caption').textContent=curr?tr('FOCUS · MAPPA','FOCUS · MAP'):
      level===0?tr('PANORAMICA ESSENZIALE','ESSENTIAL OVERVIEW'):tr('VISTA D’INSIEME','MAP OVERVIEW');
   h.querySelector('#nm616-nav-status').textContent=Math.round(zoom*100)+'%';
   const summary=h.querySelector('summary');if(summary)summary.dataset.focus=String(!!curr);
  focusBtn.textContent=curr?tr('Mappa intera','Full map'):tr('Isola ramo','Isolate branch');
  focusBtn.title=curr
    ?tr('Mostra di nuovo tutti i rami. La mappa non viene modificata.','Show every branch again. The map is not modified.')
    :tr('I rami fuori dalla selezione vengono sfumati. La mappa non viene modificata.','Fade branches outside the selection. The map is not modified.');
  focusBtn.setAttribute('aria-label',focusBtn.title);
  focusBtn.setAttribute('aria-pressed',String(!!curr));
  restore.hidden=!curr;label(restore,'↩ Ripristina vista','↩ Restore view');
  restore.title=tr('Torna all’inquadratura precedente. La mappa non viene modificata.','Return to the previous framing. The map is not modified.');
  semantic.textContent=preferences.semantic?tr('Dettagli automatici','Automatic detail'):tr('Tutti i dettagli','All detail');
  semantic.title=preferences.semantic
    ?tr('A basso zoom il testo dei rami profondi viene nascosto. La mappa non cambia.','At low zoom, text on deep branches is hidden. The map is unchanged.')
    :tr('Mostra sempre il testo di ogni livello.','Always show text at every level.');
  semantic.setAttribute('aria-label',semantic.title);
  semantic.setAttribute('aria-pressed',String(preferences.semantic));
  toggle.textContent=preferences.minimap?tr('Nascondi minimappa','Hide minimap'):tr('Mostra minimappa','Show minimap');
  toggle.title=toggle.textContent;
  toggle.setAttribute('aria-label',toggle.title);
   toggle.setAttribute('aria-pressed',String(preferences.minimap));
   const mapCanvas=document.getElementById('nm616-map');
   if(mapCanvas){
     label(mapCanvas,'Minimappa interattiva. Clicca o trascina per spostare la vista.','Interactive minimap. Click or drag to pan.','aria-label');
     label(mapCanvas,'Minimappa interattiva. Clicca o trascina per spostare la vista.','Interactive minimap. Click or drag to pan.','title');
   }
   const trail=selectionTrail(app);
   const pathEl=document.getElementById('nm616-nav-trail-path');
   const metaEl=document.getElementById('nm616-nav-trail-meta');
   const pathText=trail.labels.length?trail.labels.join('  ›  '):tr('Nessun nodo selezionato','No selected node');
   const metaText=tr('Livello ','Level ')+trail.level+' · '+
     tr('Ramo ','Branch ')+trail.index+tr(' di ',' of ')+trail.count;
   // Camera changes do not re-announce the same trail to screen readers.
   if(pathEl&&pathEl.textContent!==pathText)pathEl.textContent=pathText;
   if(metaEl&&metaEl.textContent!==metaText)metaEl.textContent=metaText;
   const entry=stateCache(app,force,!shell.hidden);list.replaceChildren();list.hidden=true;
   app.renderer.semanticZoomEnabled=preferences.semantic;
   if(!shell.hidden)paint(app,entry);
   document.getElementById('nm616-map-ratio').textContent=entry.overview.total+
     tr(' nodi · ',' nodes · ')+(preferences.detail?tr('Dettaglio','Detail'):tr('Panoramica','Overview'));
   const prevBtn=document.getElementById('nm616-map-prev'),nextBtn=document.getElementById('nm616-map-next');
   if(prevBtn){label(prevBtn,'Ramo precedente','Previous branch','aria-label');prevBtn.title=prevBtn.getAttribute('aria-label');}
   if(nextBtn){label(nextBtn,'Ramo successivo','Next branch','aria-label');nextBtn.title=nextBtn.getAttribute('aria-label');}
   const navGroup=prevBtn?.parentElement;
   if(navGroup)label(navGroup,'Spostati tra i rami','Step through branches','aria-label');
 }
 function schedule(app,force=false){
   if(force){cache.delete(app.state);trailCache.delete(app.state)}
   if(frames.get(app)===true){if(force)frames.set(app,'force');return}
   frames.set(app,true);
   requestAnimationFrame(()=>{
     const again=frames.get(app)==='force';
     frames.set(app,false);
     if(app.state?.root)refresh(app,{force:false});
     if(again)schedule(app,true);
   });
 }
