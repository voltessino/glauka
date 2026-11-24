/* Desktop image editor, website links, and durable map defaults. */
(function(root){'use strict';
 const core=root.NeuroMapMediaCore;
 const Caption=root.NeuroMapCaption;
 const captionOf=(img,renderer)=>{const draft=renderer?._nmCaptionDraft;return draft&&draft.owner===renderer.state&&draft.id===img.id?draft.doc:Caption.sanitize(img.caption,img.captionStyles)};
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const KEY='neuromap.editor.spacing.defaults.v1';
 let defaults={compactness:55,branchGapX:30},initialized=false,haveDefaults=false,revision=0,preferenceWrites=Promise.resolve();
 try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v==='object'){defaults=core.spacing(v);haveDefaults=true;}}catch{}
 function currentDefaults(){if(haveDefaults)return defaults;try{const gap=Number(localStorage.getItem('neuromap.default.branchGapX.v6.11'));if(Number.isFinite(gap)&&gap>=30&&gap<=220)return {...defaults,branchGapX:gap};}catch{}return defaults;}
 const item=app=>app?.state?.findImage(app.state.selectedImageId);
 const emptyMap=tab=>tab&&!tab.filePath&&!tab.state?.isDirty&&!tab.state?.root?.children?.length;
 function load(app){
  if(initialized)return;
  initialized=true;
  root.neuromapDesktop?.readEditorPreferences?.().then(json=>{
   if(!json||revision)return;
   let values;try{values=JSON.parse(json);}catch{return;}
   if(!values||typeof values!=='object'||!Number.isFinite(values.compactness)||!Number.isFinite(values.branchGapX))return;
   defaults=core.spacing(values);haveDefaults=true;
   try{localStorage.setItem(KEY,JSON.stringify(defaults));}catch{}
   // Only empty unsaved startup tabs may adopt new defaults. Open project values belong to that project.
   let dirty=false;for(const tab of app.tabs||[])if(emptyMap(tab)){
    tab.state.compactness=defaults.compactness;tab.state.branchGapX=defaults.branchGapX;
    if(tab.state===app.state)dirty=true;
   }
   if(dirty)app.recalculateAndRender();status();
  }).catch(error=>console.warn('Desktop spacing defaults:',error.message));
 }
 function status(){
  const button=document.getElementById('nm70-gap-save');
  if(button)button.textContent=tr('☆ Salva entrambi gli spazi come predefiniti','☆ Save both spacings as defaults');
  const note=document.getElementById('nm70-gap-current-default');
  if(note)note.textContent=tr('Predefiniti: verticale ','Defaults: vertical ')+currentDefaults().compactness+'% · '+tr('padre-ramo ','parent-branch ')+currentDefaults().branchGapX+' px';
 }
 function saveDefaults(app){
  const next=core.spacing({compactness:app.state.compactness,branchGapX:app.state.branchGapX});revision++;
  const pending=preferenceWrites.then(()=>persistDefaults(app,next),()=>persistDefaults(app,next));preferenceWrites=pending.catch(()=>{});return pending;
 }
 function setDefaults(values){
  const next=core.spacing(values);revision++;
  const quiet={showToast(){}};
  const pending=preferenceWrites.then(()=>persistDefaults(quiet,next,true),()=>persistDefaults(quiet,next,true));
  preferenceWrites=pending.catch(()=>{});
  return next;
 }
 async function persistDefaults(app,next,quiet){
  if(root.neuromapDesktop?.writeEditorPreferences){
   await root.neuromapDesktop.writeEditorPreferences(JSON.stringify(next));
  }
  try{localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem('neuromap.default.branchGapX.v6.11',String(next.branchGapX));}catch(e){
   if(!root.neuromapDesktop?.writeEditorPreferences)throw e;
  }
  defaults=next;haveDefaults=true;status();
  if(!quiet)app.showToast(tr('Spazi predefiniti salvati sul computer per tutte le nuove mappe. Le mappe esistenti mantengono le loro impostazioni.','Default spacings saved for all new maps. Existing maps keep their settings.'),'LAYOUT');
 }
 const props=img=>core.imageProps(img);
 const cropDefault=p=>!p.crop.left&&!p.crop.right&&!p.crop.top&&!p.crop.bottom;
 const hasCaptionDraft=(img,renderer)=>renderer?._nmCaptionDraft?.owner===renderer.state&&renderer._nmCaptionDraft.id===img.id;
 const legacyImage=(img,renderer)=>plainImage(props(img))&&!hasCaptionDraft(img,renderer);
 const plainImage=p=>p.rotation===0&&cropDefault(p)&&p.borderRadius===8&&p.frame==='thin'&&!p.caption;
 function surface(ctx,img,rect,renderer){
  const p=props(img),picture=renderer.getOrLoadImage(img.src),{x,y,w,h}=rect;
  const caption=captionOf(img,renderer),labelH=Math.min(Math.max(0,h-8),Caption.height(ctx,caption,w,{align:p.captionAlign,fontSize:p.captionFontSize})),drawH=Math.max(8,h-labelH);
  const rounded=(rx,ry,rw,rh,r)=>renderer.roundRectPath.call({ctx},rx,ry,Math.max(0,rw),Math.max(0,rh),Math.max(0,Math.min(r,rw/2,rh/2)));
  ctx.save();rounded(x,y,w,h,p.borderRadius);ctx.clip();ctx.fillStyle='#111a31';ctx.fillRect(x,y,w,h);
  if(picture?.complete&&picture.naturalWidth>0){
   const s=core.imageSourceRect(picture.naturalWidth,picture.naturalHeight,p.crop);
   ctx.save();rounded(x,y,w,drawH,p.borderRadius);ctx.clip();ctx.translate(x+w/2,y+drawH/2);ctx.rotate(p.rotation*Math.PI/180);
   const dw=p.rotation%180?drawH:w,dh=p.rotation%180?w:drawH;
   ctx.drawImage(picture,s.sx,s.sy,s.sw,s.sh,-dw/2,-dh/2,dw,dh);ctx.restore();
  }
  if(labelH){ctx.save();ctx.beginPath();ctx.rect(x,y+drawH,w,labelH);ctx.clip();ctx.fillStyle='#111a31';ctx.fillRect(x,y+drawH,w,labelH);Caption.paint(ctx,caption,{x,y:y+drawH,w,h:labelH},{align:p.captionAlign,fontSize:p.captionFontSize});ctx.restore();}
  ctx.restore();
  if(p.frame!=='none'){
   ctx.save();ctx.strokeStyle=p.frame==='double'?'#a5b4fc':'#64748b';ctx.lineWidth=p.frame==='double'?2.5:1.3;
   const inset=ctx.lineWidth/2;rounded(x+inset,y+inset,w-2*inset,h-2*inset,Math.max(0,p.borderRadius-inset));ctx.stroke();
   if(p.frame==='double'&&w>10&&h>10){rounded(x+4,y+4,w-8,h-8,Math.max(0,p.borderRadius-4));ctx.stroke();}ctx.restore();
  }
 }
 function paint(renderer,layer){
  const ctx=renderer.ctx;
  for(const img of renderer.state.images||[]){
   if((img.zLayer==='back'?'back':'front')!==layer)continue;
   const p=props(img),selected=renderer.state.selectedImageId===img.id,r=renderer.resolveImageWorldRect(img);if(!r)continue;
   p.caption=captionOf(img,renderer).text;const plain=legacyImage(img,renderer);if(!plain)surface(ctx,img,r,renderer);
   if(selected&&!p.caption){ctx.save();renderer.roundRectPath(r.x,r.y,r.w,r.h,Math.min(p.borderRadius,r.w/2,r.h/2));ctx.clip();ctx.fillStyle='rgba(16,25,45,.85)';const h=Math.min(30,Math.max(23,r.h*.25));ctx.fillRect(r.x,r.y+r.h-h,r.w,h);ctx.fillStyle='#e5ecfc';ctx.font='500 11px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tr('Doppio clic per un titolo','Double-click for a title'),r.cx,r.y+r.h-h/2,Math.max(1,r.w-14));ctx.restore();}
   if(selected&&!plain){ctx.save();for(const hd of r.handles){ctx.fillStyle='white';ctx.strokeStyle='#4f46e5';ctx.lineWidth=2;ctx.fillRect(hd.x-r.handleSize/2,hd.y-r.handleSize/2,r.handleSize,r.handleSize);ctx.strokeRect(hd.x-r.handleSize/2,hd.y-r.handleSize/2,r.handleSize,r.handleSize);}ctx.restore();}
  }
 }
 function install(App,State,Renderer){
  const tree=State.cloneTree;State.cloneTree=function(node){const out=tree.call(this,node);if(out&&node){const url=core.safeURL(node.linkUrl);if(url)out.linkUrl=url;}return out;};
  const images=State.cloneImages;State.cloneImages=function(list=[]){
   const out=images.call(this,list);
   out.forEach((im,i)=>Object.assign(im,core.imageProps(list[i])));
   return out;
  };
  const addImage=State.prototype.addImageItem;State.prototype.addImageItem=function(data,...args){
   const img=addImage.call(this,data,...args);if(img)Object.assign(img,core.imageProps(data));return img;
  };
  const drawImages=Renderer.prototype.drawImagesLayer;Renderer.prototype.drawImagesLayer=function(layer='front',...args){
   // Keep unmodified media in the legacy painter; edited media are drawn once,
   // avoiding old borders or unrotated pixels bleeding through rounded crops.
   const all=this.state.images||[];
   const plain=all.filter(img=>legacyImage(img,this));
   let result;
   try{this.state.images=plain;result=drawImages.call(this,layer,...args);}
   finally{this.state.images=all;}
   paint(this,layer);return result;
  };
  const newState=App.prototype.newState;App.prototype.newState=function(...args){
   const state=newState.apply(this,args);
   state.compactness=currentDefaults().compactness;state.branchGapX=currentDefaults().branchGapX;
   return state;
  };
  const importHierarchy=App.prototype.importHierarchy;App.prototype.importHierarchy=function(source,...args){
   const count=importHierarchy.call(this,source,...args);
   const preserve=(original,created)=>{
    if(!original||!created)return;
    const url=core.safeURL(original.linkUrl);if(url)created.linkUrl=url;
    (original.children||[]).forEach((child,i)=>preserve(child,created.children?.[i]));
   };
   if(count)preserve(source,this.state.root);
   return count;
  };
  // Duplicating an existing tab copies that map's explicit layout, not global defaults.
  const duplicate=App.prototype.duplicateTab;App.prototype.duplicateTab=function(...args){
   const gap=this.state?.branchGapX;
   const result=duplicate.apply(this,args);
   if(this.state&&Number.isFinite(Number(gap))){this.state.branchGapX=gap;this.recalculateAndRender();this.scheduleSave();}
   return result;
  };
  const close=App.prototype.closeEditor;App.prototype.closeEditor=function(commit,...args){flushEditors(this,commit!==false);return close.call(this,commit,...args);};
  for(const name of ['selectImage','selectNode','clearSelection','importHierarchy','duplicateTab']){const method=App.prototype[name];App.prototype[name]=function(...args){flushEditors(this,true);return method.apply(this,args);};}
  const bind=App.prototype.bindUI;App.prototype.bindUI=function(...args){
   const result=bind.apply(this,args);mount(this);load(this);
   const app=this,svg=this.io.exportSVG;this.io.exportSVG=function(...args){const pending=app.state.images.some(img=>!plainImage(props(img))&&!app.renderer.getOrLoadImage(img.src));if(pending)return app.renderer.prepareExportImages().then(()=>svg.apply(this,args));return svg.apply(this,args);};return result;
  };
  const update=App.prototype.updateImageControls;App.prototype.updateImageControls=function(...args){
   const result=update.apply(this,args);syncImage(this);return result;
  };
  const statusMethod=App.prototype.updateStatus;App.prototype.updateStatus=function(...args){
   const result=statusMethod.apply(this,args);status();return result;
  };
 }
 function setImage(app,modify,target=item(app),owner=app.state,size=null){
  const img=target;if(!img||owner!==app.state||!owner.images.includes(img))return;
  const before=JSON.stringify(props(img));const next=props(img);modify(next);
  const clean=core.imageProps(next);if(before===JSON.stringify(clean))return;
  app.state.pushHistory();if(!clean.captionStyles)delete img.captionStyles;Object.assign(img,clean,size||{});app.markChanged();
 }
 function flushEditors(app,commit){
  if(app._nmFlushingMedia)return;app._nmFlushingMedia=true;
  try{app._nmCaptionEditor?.finish(commit);app._nmCaptionPanel?.flush(commit);const active=document.activeElement;if(active?.id==='nm-img-caption')active.blur();}finally{app._nmFlushingMedia=false;}
 }
 function labeled(tag,label,id,attrs={}){
  const wrapper=document.createElement('label');wrapper.className='nm-media-field';
  const title=document.createElement('span');title.textContent=label;wrapper.append(title);
  const control=document.createElement(tag);control.id=id;
  for(const [k,v]of Object.entries(attrs)){if(k==='options')for(const [value,name]of v){const opt=document.createElement('option');opt.value=value;opt.textContent=name;control.append(opt);}
   else control[k]=v;}wrapper.append(control);return {wrapper,control,title};
 }
 function openCrop(app){
  const target=item(app),owner=app.state;if(!target||target.graphic)return;
  const dialog=document.createElement('dialog');dialog.id='nm-image-crop-dialog';dialog.className='nm6-skiptranslate';
  dialog.setAttribute('aria-labelledby','nm-crop-title');
  const title=document.createElement('h2');title.id='nm-crop-title';title.textContent=tr('Ritaglia immagine','Crop image');
  const hint=document.createElement('p');hint.textContent=tr('Trascina gli angoli o i bordi. Trascina il riquadro per spostarlo.','Drag corners or edges. Drag inside the selection to move it.');
  const stage=document.createElement('div');stage.className='nm-crop-stage';
  const image=document.createElement('img');image.src=target.src;image.alt='';image.draggable=false;
  const selection=document.createElement('div');selection.className='nm-crop-selection';selection.tabIndex=0;selection.setAttribute('role','group');selection.setAttribute('aria-label',tr('Area da conservare. Frecce per spostare, Maiusc e frecce per ridimensionare.','Area to keep. Arrow keys move; Shift and arrow keys resize.'));
  let rect={x:props(target).crop.left,y:props(target).crop.top,w:100-props(target).crop.left-props(target).crop.right,h:100-props(target).crop.top-props(target).crop.bottom};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const draw=()=>Object.assign(selection.style,{left:rect.x+'%',top:rect.y+'%',width:rect.w+'%',height:rect.h+'%'});
  for(const edge of ['nw','n','ne','e','se','s','sw','w']){const h=document.createElement('span');h.className='nm-crop-handle';h.dataset.edge=edge;selection.append(h)}
  stage.append(image,selection);
  let gesture;
  stage.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.preventDefault();selection.focus();stage.setPointerCapture(e.pointerId);
   gesture={id:e.pointerId,edge:e.target.dataset.edge||'move',x:e.clientX,y:e.clientY,start:{...rect},bounds:stage.getBoundingClientRect()};
  });
  stage.addEventListener('pointermove',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;const g=gesture,r=g.start,dx=(e.clientX-g.x)/g.bounds.width*100,dy=(e.clientY-g.y)/g.bounds.height*100;
   if(g.edge==='move')rect={...r,x:clamp(r.x+dx,0,100-r.w),y:clamp(r.y+dy,0,100-r.h)};
   else{let l=r.x,t=r.y,b=t+r.h,right=l+r.w;if(g.edge.includes('w'))l=clamp(l+dx,0,right-5);if(g.edge.includes('e'))right=clamp(right+dx,l+5,100);if(g.edge.includes('n'))t=clamp(t+dy,0,b-5);if(g.edge.includes('s'))b=clamp(b+dy,t+5,100);rect={x:l,y:t,w:right-l,h:b-t};}draw();
  });
  const end=()=>{gesture=null};stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);stage.addEventListener('lostpointercapture',end);
  selection.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
   if(e.shiftKey){rect.w=clamp(rect.w+dx,5,100-rect.x);rect.h=clamp(rect.h+dy,5,100-rect.y)}else{rect.x=clamp(rect.x+dx,0,100-rect.w);rect.y=clamp(rect.y+dy,0,100-rect.h)}draw();});
  const actions=document.createElement('footer');
  for(const [name,it,en,run]of [['reset','Ripristina intera','Reset crop',()=>{rect={x:0,y:0,w:100,h:100};draw()}],['cancel','Annulla','Cancel',()=>dialog.close()],['apply','Applica ritaglio','Apply crop',()=>{const old=props(target),cw=100-old.crop.left-old.crop.right,ch=100-old.crop.top-old.crop.bottom,sw=old.rotation%180?rect.h/ch:rect.w/cw,sh=old.rotation%180?rect.w/cw:rect.h/ch;setImage(app,p=>{p.crop={left:rect.x,top:rect.y,right:100-rect.x-rect.w,bottom:100-rect.y-rect.h}},target,owner,{width:Math.max(8,target.width*sw),height:Math.max(8,target.height*sh)});dialog.close()}]]){
   const b=document.createElement('button');b.type='button';b.dataset.action=name;b.textContent=tr(it,en);b.addEventListener('click',run);actions.append(b);
  }
  dialog.append(title,hint,stage,actions);dialog.addEventListener('keydown',e=>e.stopPropagation());
  const unregister=root.NeuroMapLifecycle?.registerDraft({hasPending:()=>dialog.open,confirmClose:async()=>{dialog.close();return true}});
  dialog.addEventListener('close',()=>{unregister?.();dialog.remove()},{once:true});
  // Keep the original pixels; the saved crop is reversible and shared by exports.
  const fit=()=>{if(!image.naturalWidth)return;const scale=Math.min(1,(innerWidth-80)/image.naturalWidth,(innerHeight-240)/image.naturalHeight);stage.style.width=image.naturalWidth*scale+'px';stage.style.height=image.naturalHeight*scale+'px'};
  image.addEventListener('load',fit);image.addEventListener('error',()=>{dialog.close();app.showToast?.(tr('Immagine non disponibile.','Image unavailable.'),'ERRORE')});root.addEventListener('resize',fit);dialog.addEventListener('close',()=>root.removeEventListener('resize',fit),{once:true});document.body.append(dialog);dialog.showModal();fit();draw();selection.focus();
 }
 function mount(app){
  if(document.getElementById('nm-media-tools'))return;
  const css=document.createElement('style');css.textContent=
   '#image-controls{max-height:calc(100vh - 125px);overflow:auto;scrollbar-color:#30456c #101a30}'+
   '.nm-media-box{display:grid;gap:8px;margin:12px 0;padding-top:12px;border-top:1px solid #354260}'+
   '.nm-media-field{display:grid;gap:3px;font:11px/1.4 system-ui;color:#cfdaef}'+
   '.nm-media-field :is(input,select){min-width:0;width:100%;box-sizing:border-box;background:#131f37;border:1px solid #435375;border-radius:8px;color:white;padding:7px}'+
   '.nm-media-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}'+
   '.nm-media-actions button{background:#243455;border:1px solid #546992;color:#f1f5ff;border-radius:7px;padding:7px;cursor:pointer}';
  document.head.append(css);
  const panel=document.getElementById('image-controls');
  const box=document.createElement('div');box.id='nm-media-tools';box.className='nm-media-box nm6-skiptranslate';
  const header=document.createElement('strong');header.textContent=tr('Modifica e didascalia','Edit and caption');box.append(header);
  const actions=document.createElement('div');actions.className='nm-media-actions';
  for(const [id,it,en,delta]of [['nm-img-rot-left','↶ Ruota 90°','↶ Rotate left',-90],['nm-img-rot-right','↷ Ruota 90°','↷ Rotate right',90]]){
   const b=document.createElement('button');b.type='button';b.id=id;b.textContent=tr(it,en);b.addEventListener('click',()=>setImage(app,p=>{p.rotation=(p.rotation+delta+360)%360;}));actions.append(b);
  }box.append(actions);
  const cropButton=document.createElement('button');cropButton.id='nm-img-crop';cropButton.type='button';
  cropButton.addEventListener('click',()=>openCrop(app));box.append(cropButton);
  const frame=labeled('select',tr('Cornice','Frame'),'nm-img-frame',{options:[['none',tr('Nessuna','None')],['thin',tr('Sottile','Thin')],['double',tr('Doppia','Double')]]});
  const radius=labeled('select',tr('Angoli','Corners'),'nm-img-radius',{options:[[0,'0 px'],[8,'8 px'],[16,'16 px'],[24,'24 px'],[32,'32 px']]});
  frame.control.addEventListener('change',()=>setImage(app,p=>{p.frame=frame.control.value;}));
  radius.control.addEventListener('change',()=>setImage(app,p=>{p.borderRadius=Number(radius.control.value);}));
  box.append(frame.wrapper,radius.wrapper);
  const captionEditor=root.NeuroMapCaptionEditor.mount({app,panel:box,setImage,props,item,tr});
  panel.append(box);
  // Inline caption editing right inside the bottom strip of an image.
  app.canvas.addEventListener('dblclick',event=>{
   const hit=app.findHit(event.clientX,event.clientY);
   if(hit?.type!=='image'&&hit?.type!=='image-handle'||hit.item?.graphic)return;
   const img=app.state.findImage(hit.item.id),r=img&&app.renderer.resolveImageWorldRect(img);
   if(!r)return;
   const pt=app.renderer.screenToWorld(event.clientX,event.clientY);
   if(pt.y<r.y+r.h-Math.max(30,Caption.height(app.renderer.ctx,Caption.sanitize(img.caption,img.captionStyles),r.w,{align:props(img).captionAlign,fontSize:props(img).captionFontSize})))return;
   event.preventDefault();event.stopImmediatePropagation();
   app.selectImage(img.id);
   document.getElementById('nm-inline-image-caption')?.remove();
   const editor=document.createElement('textarea');editor.id='nm-inline-image-caption';editor.maxLength=Caption.MAX;Caption.bindListInput(editor);
   editor.value=props(img).caption;editor.setAttribute('aria-label',tr('Titolo immagine','Image caption'));
   const tl=app.renderer.worldToScreen(r.x,r.y+r.h-Math.min(30,Math.max(23,r.h*.25))),zoom=app.renderer.camera.zoom;
   editor.style.cssText='position:fixed;z-index:120;box-sizing:border-box;background:#14213b;color:#fff;border:2px solid #818cf8;border-radius:6px;padding:3px 6px;font:12px system-ui;text-align:center;';
   editor.style.left=Math.max(4,tl.x)+'px';editor.style.top=Math.max(4,tl.y)+'px';
   editor.style.width=Math.max(110,r.w*zoom)+'px';editor.style.height='62px';
   document.body.append(editor);
   const owner=app.state;let finished=false;
   const finish=commit=>{if(finished)return;finished=true;app._nmCaptionEditor=null;editor.remove();if(commit){const doc=Caption.edit(Caption.sanitize(img.caption,img.captionStyles),editor.value);app._nmCaptionPanel.commit(doc,img,owner);}};
   app._nmCaptionEditor={finish};
   editor.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish(false);app.canvas.focus();}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finish(true);app.canvas.focus();}});
   editor.addEventListener('blur',()=>finish(true));
   editor.focus();editor.select();
  },true);
  const defaultsButton=document.getElementById('nm70-gap-save');defaultsButton?.classList.add('nm6-skiptranslate');document.getElementById('nm70-gap-current-default')?.classList.add('nm6-skiptranslate');
  defaultsButton?.addEventListener('click',async event=>{
   event.preventDefault();event.stopImmediatePropagation();
   try{await saveDefaults(app);}catch(err){app.showToast(tr('Preferenze non salvate: ','Could not save preferences: ')+err.message,'ERRORE');}
  },true);
  // Explicit per-map values remain untouched on reopen; only the global defaults apply to new maps.
  const translate=()=>{header.textContent=tr('Modifica e didascalia','Edit and caption');cropButton.textContent=tr('Ritaglia immagine…','Crop image…');
   document.getElementById('nm-img-rot-left').textContent=tr('↶ Ruota 90°','↶ Rotate left');document.getElementById('nm-img-rot-right').textContent=tr('↷ Ruota 90°','↷ Rotate right');
   frame.title.textContent=tr('Cornice','Frame');radius.title.textContent=tr('Angoli','Corners');captionEditor.translate();
   [['Nessuna','None'],['Sottile','Thin'],['Doppia','Double']].forEach(([it,en],i)=>frame.control.options[i].textContent=tr(it,en));
   document.getElementById('nm-inline-image-caption')?.setAttribute('aria-label',tr('Titolo immagine','Image caption'));
   status();};
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  translate();syncImage(app);status();
 }
 function syncImage(app){
  const img=item(app),box=document.getElementById('nm-media-tools');if(!box||!img)return;
  const p=props(img),v=(id,value)=>{const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=String(value);};
  v('nm-img-frame',p.frame);v('nm-img-radius',p.borderRadius);app._nmCaptionPanel?.sync();
 }

 function svgImage(img,rect,renderer){
  const p=props(img);
  if(p.rotation===0&&cropDefault(p)&&p.borderRadius===8&&p.frame==='thin'&&!p.caption)return null;
  const picture=renderer.getOrLoadImage(img.src);if(!picture?.complete||!picture.naturalWidth)throw Error(tr('Impossibile esportare: una delle immagini modificate non è caricabile.','Cannot export: an edited image could not be loaded.'));
  const w=rect.w,h=rect.h,canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*2));canvas.height=Math.max(1,Math.round(h*2));
  const ctx=canvas.getContext('2d');ctx.scale(canvas.width/w,canvas.height/h);surface(ctx,img,{x:0,y:0,w,h},renderer);
  const url=canvas.toDataURL('image/png');
  return '<image x="'+rect.x+'" y="'+rect.y+'" width="'+w+'" height="'+h+'" href="'+url+'" preserveAspectRatio="none"/>';
 }
 root.NeuroMapMedia={install,load,saveDefaults,setDefaults,currentDefaults,paint,svgImage};
})(globalThis);
