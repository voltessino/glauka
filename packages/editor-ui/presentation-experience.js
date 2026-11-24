/* Distraction-free desktop UX: Zen, breadcrumb actions and image preview.
 * Presentation only. No source node, image, map, file or Undo changes.
 */
(function(root){
  'use strict';
  const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const label=root.NeuroMapWorkspaceLocale?.bind||((element,it,en,attribute)=>{if(attribute)element.setAttribute(attribute,tr(it,en));else element.textContent=tr(it,en)});
  const STYLE=`
#nm616-zen-switch{border-color:rgba(181,163,249,.46)!important;background:linear-gradient(120deg,#302b56,#172d45)!important}
#nm616-zen-exit{position:fixed;z-index:240;top:20px;right:26px;display:none;align-items:center;gap:8px;border:1px solid #9f9ae0;background:rgba(18,23,48,.92);color:#f2f2ff;padding:10px 15px;border-radius:14px;box-shadow:0 13px 30px #0007;cursor:pointer;font:700 13px system-ui;backdrop-filter:blur(14px)}
#nm616-zen-exit:focus-visible,#nm616-lightbox button:focus-visible{outline:2px solid #c4b5fd;outline-offset:3px}
#nm616-context button:focus-visible{outline:2px solid var(--nm-theme-focus,#b5a6ff);outline-offset:3px}
body.nm616-zen .top-chrome,body.nm616-zen .topbar,body.nm616-zen #nm614-right-dock,body.nm616-zen #nm614-navigation-flyout,body.nm616-zen #inspector-sidebar,body.nm616-zen #v6-show-layout,body.nm616-zen #nm67-layout-panel,body.nm616-zen #image-controls,body.nm616-zen #nm616-context{display:none!important}
body.nm616-zen #nm616-zen-exit{display:flex!important}
body.nm616-zen #nm616-navigation{top:20px;left:22px;max-width:calc(100vw - 210px)}
body.nm616-zen #nm616-minimap-shell{right:25px;bottom:35px}
body.nm616-zen .hud-bottom-right{opacity:.5;transition:opacity .2s}
body.nm616-zen .hud-bottom-right:hover,body.nm616-zen .hud-bottom-right:focus-within{opacity:1}
#nm616-context{position:fixed;top:154px;right:89px;z-index:58;max-width:min(45vw,590px);box-sizing:border-box;display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:13px;background:var(--nm-skin-surface,#132139);color:var(--nm-skin-ink,#edf2fa);box-shadow:var(--nm-skin-shadow,0 12px 40px #0005);backdrop-filter:blur(14px);font:12px/1.3 system-ui}
#nm616-context[hidden]{display:none!important}
#nm616-context-path{display:flex;align-items:center;flex:1 1 140px;min-width:0;gap:4px;white-space:nowrap;overflow:hidden}
#nm616-context-path .nm616-crumb{flex:0 1 auto;min-width:0;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 5px;border:0;border-radius:7px;background:transparent;color:var(--nm-skin-muted,#b8c5d9);cursor:pointer}
#nm616-context-path .nm616-crumb:last-child{color:var(--nm-skin-ink,#edf2fa);font-weight:750}
#nm616-context-path .nm616-crumb:hover{background:color-mix(in srgb,var(--nm-skin-surface,#132139) 89%,var(--nm-theme-focus,#b5a6ff));color:var(--nm-skin-ink,#edf2fa)}
#nm616-context-path .nm616-separator{opacity:.5;flex-shrink:0}
#nm616-context-actions{display:flex;flex:0 0 auto;gap:4px}
#nm616-context-actions button{border:1px solid var(--nm-skin-stroke,#74869e);background:var(--nm-skin-top,#1f2d48);color:var(--nm-skin-ink,#edf2fa);font:650 11px system-ui;cursor:pointer;border-radius:9px;padding:7px 9px}
#nm616-context-actions button:hover{background:color-mix(in srgb,var(--nm-skin-surface,#132139) 89%,var(--nm-theme-focus,#b5a6ff));border-color:var(--nm-theme-focus,#b5a6ff)}
#nm616-lightbox{position:fixed;inset:0;z-index:5300;background:rgba(2,7,19,.85);backdrop-filter:blur(14px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;align-items:stretch;justify-content:stretch;padding:clamp(12px,3vw,42px);box-sizing:border-box;color:#f0f4ff;font:13px system-ui}
#nm616-lightbox[hidden]{display:none!important}
#nm616-lightbox header,#nm616-lightbox footer{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1200px;width:100%;margin:0 auto}
#nm616-lightbox header strong{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nm616-lightbox button{border:1px solid #7685b9;background:#263457;color:white;cursor:pointer;border-radius:10px;padding:8px 12px;font:650 12px system-ui}
#nm616-lightbox button:hover{background:#3c4775;border-color:#c4b5fd}
#nm616-lightbox .nm616-image-view{display:flex;align-items:center;justify-content:center;overflow:auto;min-height:0;max-width:1200px;width:100%;margin:15px auto;border:1px solid #455379;border-radius:16px;background:radial-gradient(ellipse at center,#17233f,#0a1224)}
#nm616-lightbox img{display:block;max-width:90%;max-height:90%;object-fit:contain;transform:scale(var(--nm-image-zoom,1));transform-origin:center center;box-shadow:0 18px 60px #0009;border-radius:8px}
#nm616-lightbox footer .nm616-image-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#nm616-lightbox footer{flex-wrap:wrap}
#nm616-lightbox footer small{color:#a9bad6}
@media(max-width:1450px){#nm616-context{top:215px;max-width:min(49vw,500px)}}
@media(max-width:760px){#nm616-context{right:55px;top:164px;max-width:calc(100vw - 72px);padding:7px}#nm616-context-actions button{padding:6px 7px}#nm616-zen-exit{right:12px;top:10px}body.nm616-zen #nm616-navigation{top:15px;left:10px;max-width:calc(100vw - 90px)}}
@media(prefers-reduced-motion:reduce){#nm616-context button,body.nm616-zen .hud-bottom-right{transition:none}}
`;
 function install(App){
   if(!App?.prototype)return;
   let zen=false,raf=new WeakMap(),imageZoom=1,returnFocus=null;
   function ensure(app){
     if(document.getElementById('nm616-zen-switch'))return;
     const styles=document.createElement('style');styles.id='nm616-presentation-css';styles.textContent=STYLE;
     document.head.append(styles);
     const zenToggle=document.createElement('button');zenToggle.id='nm616-zen-switch';
     zenToggle.className='tab-action-btn';zenToggle.type='button';
     label(zenToggle,'◈ Zen','◈ Zen');
     label(zenToggle,'Modalità concentrazione senza distrazioni','Distraction-free Zen mode','title');
     label(zenToggle,'Modalità concentrazione senza distrazioni','Distraction-free Zen mode','aria-label');
     zenToggle.addEventListener('click',()=>toggleZen(app));
     const fullscreen=document.getElementById('btn-fullscreen');
     if(fullscreen?.parentElement)fullscreen.parentElement.insertBefore(zenToggle,fullscreen);
     else document.querySelector('.top-chrome')?.append(zenToggle);
     const exit=document.createElement('button');exit.id='nm616-zen-exit';exit.type='button';
     label(exit,'← Esci da Zen','← Leave Zen');label(exit,'Esci da Zen','Leave Zen','aria-label');
     exit.addEventListener('click',()=>toggleZen(app,false));
     document.body.append(exit);

     const context=document.createElement('aside');context.id='nm616-context';context.className='nm6-skiptranslate';
     label(context,'Percorso e azioni del concetto selezionato','Selected concept path and actions','aria-label');
     const path=document.createElement('nav');path.id='nm616-context-path';
     label(path,'Percorso del concetto','Concept path','aria-label');
     const actions=document.createElement('div');actions.id='nm616-context-actions';
     const action=(id,it,en,fn)=>{
       const button=document.createElement('button');button.id=id;button.type='button';
       label(button,it,en);label(button,it,en,'title');
       button.addEventListener('click',fn);actions.append(button);return button;
     };
     action('nm616-quick-edit','✎ Modifica','✎ Edit',()=>app.editSelected?.());
     action('nm616-quick-add','＋ Figlio','＋ Child',()=>app.addChild?.());
     action('nm616-quick-focus','◎ Focus','◎ Focus',()=>{
       const id=app.state?.selectedNodeId;
       if(id)root.NeuroMapNavigation?.enterFocus(app,id);
     });
     action('nm616-quick-style','◫ Stile','◫ Style',()=>{
       if(root.NeuroMapWorkspaceLayout?.claim(app,'inspector')===false)return;
       document.getElementById('inspector-sidebar')?.classList.remove('collapsed');
     });
     context.append(path,actions);if(root.NeuroMapWorkspaceChrome)root.NeuroMapWorkspaceChrome.mount(context);else document.body.append(context);

     const imagePanel=document.getElementById('image-controls');
     if(imagePanel){
       const preview=document.createElement('button');preview.id='nm616-image-preview';preview.type='button';
       preview.className='btn-ui';label(preview,'⛶ Ingrandisci','⛶ Preview');
       label(preview,'Apri immagine a schermo grande','View image full size','title');
       preview.addEventListener('click',()=>openImage(app));
       const buttons=imagePanel.querySelector('.image-control-buttons');
       if(buttons)buttons.prepend(preview);else imagePanel.append(preview);
     }
     const menu=document.getElementById('ctx-group-image');
     if(menu){
       const button=document.createElement('button');button.type='button';button.id='nm616-context-preview-image';
       button.className='ctx-item';label(button,'⛶ Visualizza immagine','⛶ View image');
       button.addEventListener('click',()=>{
         document.getElementById('context-menu')?.classList.add('hidden');
         openImage(app);
       });
       menu.prepend(button);
     }
     const lightbox=document.createElement('section');lightbox.id='nm616-lightbox';lightbox.hidden=true;
     lightbox.className='nm6-skiptranslate';lightbox.setAttribute('role','dialog');
     lightbox.setAttribute('aria-modal','true');label(lightbox,'Anteprima immagine','Image preview','aria-label');
     const top=document.createElement('header'),caption=document.createElement('strong');
     caption.id='nm616-image-caption';
     const close=document.createElement('button');close.type='button';close.id='nm616-image-close';
     label(close,'✕ Chiudi','✕ Close');close.addEventListener('click',closeImage);
     top.append(caption,close);
     const viewport=document.createElement('div');viewport.className='nm616-image-view';
     const image=document.createElement('img');image.id='nm616-image-zoom';image.alt=tr('Immagine ingrandita della mappa','Enlarged map image');
     image.decoding='async';viewport.append(image);
     const bottom=document.createElement('footer'),hint=document.createElement('small');
     label(hint,'Anteprima indipendente: la mappa non viene modificata','Preview only: your map remains unchanged');
     const controls=document.createElement('div');controls.className='nm616-image-tools';
     const zoomOut=document.createElement('button');zoomOut.type='button';zoomOut.textContent='−';
     label(zoomOut,'Riduci anteprima','Zoom preview out','aria-label');
     zoomOut.addEventListener('click',()=>setImageZoom(imageZoom/1.25));
     const percent=document.createElement('span');percent.id='nm616-image-zoom-percent';percent.textContent='100%';
     const zoomIn=document.createElement('button');zoomIn.type='button';zoomIn.textContent='+';
     label(zoomIn,'Ingrandisci anteprima','Zoom preview in','aria-label');
     zoomIn.addEventListener('click',()=>setImageZoom(imageZoom*1.25));
     const reset=document.createElement('button');reset.type='button';label(reset,'Adatta','Fit');
     reset.addEventListener('click',()=>setImageZoom(1));
     controls.append(zoomOut,percent,zoomIn,reset);bottom.append(hint,controls);
     lightbox.append(top,viewport,bottom);document.body.append(lightbox);
     lightbox.addEventListener('click',event=>{if(event.target===lightbox)closeImage()});
     viewport.addEventListener('wheel',event=>{
       if(lightbox.hidden)return;
       event.preventDefault();setImageZoom(imageZoom*(event.deltaY<0?1.15:1/1.15));
     },{passive:false});
     document.addEventListener('keydown',event=>{
       if(!lightbox.hidden&&event.key==='Tab'){
         const controls=[...lightbox.querySelectorAll('button')];
         if(controls.length){
           event.preventDefault();event.stopPropagation();
           const current=controls.indexOf(document.activeElement);
           const next=(current+(event.shiftKey?-1:1)+controls.length)%controls.length;
           controls[next].focus();
         }
         return;
       }
       if(event.key!=='Escape'||event.defaultPrevented)return;
       if(!lightbox.hidden){event.preventDefault();event.stopImmediatePropagation?.();closeImage();return}
       if(!zen||event.target?.closest?.('[role=dialog],input,textarea,select,[contenteditable=true]'))return;
       if(app.drag||app.editorNodeId)return;
       event.preventDefault();toggleZen(app,false);
     },true);
   }
   function toggleZen(app,value){
     if(value===undefined)value=!zen;
     if(value===zen)return;
     if(value&&(app.state?.root?.viewMode||'mindmap')!=='mindmap'){
       app.showToast?.(tr('Apri la mappa mentale prima di entrare in Zen','Open the mind map before entering Zen'),'ZEN');
       return;
     }
     zen=value;
     document.body.classList.toggle('nm616-zen',zen);
     document.getElementById('nm616-zen-switch')?.setAttribute('aria-pressed',String(zen));
     document.getElementById('nm616-zen-exit')?.setAttribute('aria-label',tr('Esci da Zen','Leave Zen'));
     document.getElementById('nm616-zen-exit').textContent=tr('← Esci da Zen','← Leave Zen');
     app.positionEditor?.();app.requestRender?.();schedule(app);
   }
   function safeImageSource(src){
     const raw=String(src||'').trim();
     if(!raw)return null;
     if(/^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)(?:;|,)/i.test(raw))return raw;
     try{
       const protocol=new URL(raw,document.baseURI).protocol;
       if(['http:','https:','blob:'].includes(protocol))return raw;
     }catch{}
     return null;
   }
   function setImageZoom(value){
     imageZoom=Math.max(.4,Math.min(3,Math.round(value*100)/100));
     const img=document.getElementById('nm616-image-zoom');
     if(img)img.style.setProperty('--nm-image-zoom',String(imageZoom));
     const percent=document.getElementById('nm616-image-zoom-percent');
     if(percent)percent.textContent=Math.round(imageZoom*100)+'%';
   }
   function openImage(app){
     const item=app.state?.findImage?.(app.state.selectedImageId);
     const safe=safeImageSource(item?.src);
     if(!item||!safe){app.showToast?.(tr('Seleziona un’immagine valida','Select an available image'),'IMMAGINE');return false}
     ensure(app);
     const panel=document.getElementById('nm616-lightbox'),img=document.getElementById('nm616-image-zoom');
     if(!panel||!img)return false;
     returnFocus=document.activeElement;
     const text=String(item.alt||item.caption||tr('Immagine della mappa','Map image')).slice(0,180);
     document.getElementById('nm616-image-caption').textContent=text;
     img.alt=text;img.src=safe;panel.hidden=false;setImageZoom(1);
     document.getElementById('nm616-image-close')?.focus();
     return true;
   }
   function closeImage(){
     const panel=document.getElementById('nm616-lightbox'),img=document.getElementById('nm616-image-zoom');
     if(!panel||panel.hidden)return;
     panel.hidden=true;if(img)img.removeAttribute('src');
     returnFocus?.focus?.();returnFocus=null;
   }
   function breadcrumb(app){
     if(!app.state?.root||app.state.selectedImageId||document.body.classList.contains('nm616-zen'))return [];
     const node=app.state.findNode(app.state.selectedNodeId);
     if(!node||node.id===app.state.root.id)return [];
     const path=[],seen=new Set();let n=node;
     for(let i=0;n&&i<45&&!seen.has(n.id);i++){
       seen.add(n.id);path.unshift({id:n.id,text:String(n.text||'—')});
       n=n.parentId?app.state.findNode(n.parentId):null;
     }
     return path;
   }
   function refresh(app){
     ensure(app);
     const el=document.getElementById('nm616-context'),path=document.getElementById('nm616-context-path');
     if(!el||!path)return;
     const list=breadcrumb(app),visible=list.length>1&&(app.state.root.viewMode||'mindmap')==='mindmap'&&!zen;
     el.hidden=!visible;
     if(!visible)return;
     const chunks=list.length>5?[list[0],{id:null,text:'…'},...list.slice(-3)]:list;
     const signature=chunks.map(x=>x.id+':'+x.text).join('|')+'/'+document.documentElement.lang;
     if(path._nmSignature!==signature){
       path.replaceChildren();
       chunks.forEach((c,i)=>{
         if(i){const separator=document.createElement('span');separator.className='nm616-separator';separator.textContent='›';path.append(separator)}
         const b=document.createElement('button');b.type='button';b.className='nm616-crumb';b.setAttribute('data-glauka-user-content','');
         b.textContent=c.text;b.title=c.text;b.disabled=!c.id;
         if(c.id)b.addEventListener('click',()=>{
           const m=app.layout.getLayout(c.id);
           if(!m)return;
           app.selectNode?.(c.id);
           app.stopTeleport?.();
           const cam=app.renderer.camera;
           cam.x=root.innerWidth*.5-m.x*cam.zoom;cam.y=root.innerHeight*.5-m.y*cam.zoom;
           app.requestRender?.();
         });
         path.append(b);
       });
       path._nmSignature=signature;
     }
     for(const [id,it,en]of [
       ['nm616-quick-edit','✎ Modifica','✎ Edit'],
       ['nm616-quick-add','＋ Figlio','＋ Child'],
       ['nm616-quick-focus','◎ Focus','◎ Focus'],
       ['nm616-quick-style','◫ Stile','◫ Style']]){
       const button=document.getElementById(id);if(button){label(button,it,en);label(button,it,en,'title');label(button,it,en,'aria-label');}
     }
   }
   function schedule(app){
     if(raf.get(app))return;
     raf.set(app,true);requestAnimationFrame(()=>{raf.set(app,false);refresh(app)});
   }
   const bind=App.prototype.bindUI;
   App.prototype.bindUI=function(...args){
     const result=bind.apply(this,args);ensure(this);root.NeuroMapWorkspaceLocale?.watch(()=>schedule(this));schedule(this);return result;
   };
   const request=App.prototype.requestRender;
   App.prototype.requestRender=function(...args){const result=request.apply(this,args);schedule(this);return result};
   const activate=App.prototype.activateTab;
   if(typeof activate==='function')App.prototype.activateTab=function(...args){
     if(this.activeTabId!==args[0])closeImage();
     return activate.apply(this,args);
   };
   root.NeuroMapPresentation=Object.freeze({toggleZen,openImage,closeImage,safeImageSource});
 }
 root.NeuroMapPresentationInstall=install;
})(globalThis);
