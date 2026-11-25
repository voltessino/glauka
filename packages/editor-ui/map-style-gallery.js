/* Node/branch style presets — distinct from UI appearance and map storage. */
(function(root){
 'use strict';
 const C=root.NeuroMapMapStyleCore;if(!C)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const CSS=`
 #nm-map-presets{margin:12px 0;padding:0;border-radius:12px;border:0;
  background:transparent;color:var(--text-primary,#f2f7ff);font:12px system-ui}
 #nm-map-presets .nm-map-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 8px;padding:0 2px}
 #nm-map-presets .nm-map-disclosure{min-width:0}
 #nm-map-presets .nm-map-disclosure>summary{display:flex;gap:10px;align-items:center;
  box-sizing:border-box;min-height:48px;padding:8px 28px 8px 10px;border:1px solid rgba(158,157,226,.55);
  border-radius:11px;background:rgba(34,52,87,.8);cursor:pointer;list-style:none;position:relative}
 #nm-map-presets .nm-map-disclosure>summary::-webkit-details-marker{display:none}
 #nm-map-presets .nm-map-disclosure>summary:focus-visible{outline:2px solid #b4a4ff;outline-offset:2px}
 #nm-map-presets .nm-map-disclosure>summary::after{content:'⌄';font-size:16px;position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;line-height:1}
 #nm-map-presets .nm-map-disclosure[open]>summary::after{transform:translateY(-50%) rotate(180deg)}
 #nm-map-presets .nm-map-current-preview{display:grid;place-items:center;width:66px;height:35px;
  border-radius:7px;background:#142339;overflow:hidden;flex:0 0 66px}
 #nm-map-presets .nm-map-current-preview>svg{width:100%;height:100%}
 #nm-map-presets .nm-map-current-name{font:650 12px/1.3 system-ui;min-width:0;flex:1}
 #nm-map-presets .nm-map-detail{padding-top:8px}
 #nm-map-presets .nm-map-disclosure:not([open])>.nm-map-detail{display:none!important}
 #nm-map-presets h3{font:700 13px system-ui;margin:0 0 4px}
 #nm-map-presets .nm-map-note{opacity:.78;line-height:1.4;margin:5px 0 10px}
 #nm-map-presets .nm-map-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;
  max-height:340px;overflow-y:auto;overscroll-behavior:auto}
 #nm-map-presets .nm-map-card{border-radius:11px;border:1px solid rgba(125,154,203,.28);
  background:rgba(22,39,70,.58);color:inherit;padding:7px;text-align:left;cursor:pointer;min-width:0}
 #nm-map-presets .nm-map-card:hover{border-color:#77d5ff;background:rgba(58,80,127,.35)}
 #nm-map-presets .nm-map-card:focus-visible{outline:2px solid #58e9ff;outline-offset:2px}
 #nm-map-presets .nm-map-card svg{width:100%;height:72px;display:block;border-radius:8px}
 #nm-map-presets .nm-map-card span{display:block;font:650 11px system-ui}
 #nm-map-presets .nm-map-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
 #nm-map-presets :is(button,select,input){font:12px system-ui}
 #nm-map-presets select{border:1px solid #6c829d;border-radius:8px;background:#192c45;color:#f1f7ff;padding:7px;max-width:100%}
 #nm-map-presets .nm-map-actions button{border:1px solid #6d8aa6;border-radius:8px;
  background:#29425c;color:#f3f8ff;padding:8px;cursor:pointer}
 #nm-map-presets [data-nm-selected="true"]{box-shadow:inset 0 0 0 1px #67d6ff;border-color:#67d6ff}
 body.nm-orbit-workspace[data-nm-skin="minimal"] #nm-map-presets{color:#152135;background:#f1f4fa}
 body.nm-orbit-workspace[data-nm-skin="minimal"] #nm-map-presets .nm-map-card{color:#152135;background:#fff}

 #nm-map-presets{background:transparent;color:var(--nm-ui-ink,var(--nm-skin-ink,#edf2fa));border:0}
 #nm-map-presets .nm-map-disclosure>summary{background:var(--nm-ui-top,var(--nm-skin-top,#192840));border-color:var(--nm-ui-line,var(--nm-skin-stroke,#6b7d93))}
 #nm-map-presets .nm-map-current-preview{background:var(--nm-ui-surface,var(--nm-skin-surface,#142138))}
 #nm-map-presets .nm-map-card{background:var(--nm-ui-surface,var(--nm-skin-surface,#142138));border-color:var(--nm-ui-line,var(--nm-skin-stroke,#6b7d93));color:var(--nm-ui-ink,var(--nm-skin-ink,#edf2fa))}
 #nm-map-presets .nm-map-card:hover{background:var(--nm-ui-hover,#31486a);border-color:var(--nm-ui-accent,#9b8de8)}
 #nm-map-presets .nm-map-card[data-nm-selected="true"]{border-color:var(--nm-ui-accent,#9b8de8);box-shadow:inset 0 0 0 1px var(--nm-ui-accent,#9b8de8)}
 #nm-map-presets .nm-map-card svg{height:64px}
 #nm-map-presets .nm-map-scope{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 10px;margin:8px 0 12px;font-size:12px;color:var(--nm-ui-muted,var(--nm-skin-muted,#c0cbdc))}
 #nm-map-presets .nm-map-scope select{flex:1 1 140px;max-width:220px;background:var(--nm-ui-surface,var(--nm-skin-surface,#142138));color:var(--nm-ui-ink,var(--nm-skin-ink,#edf2fa));border-color:var(--nm-ui-line,var(--nm-skin-stroke,#6b7d93))}
 #nm-map-presets .nm-map-actions button{background:var(--nm-ui-top,var(--nm-skin-top,#192840));color:var(--nm-ui-ink,var(--nm-skin-ink,#edf2fa));border-color:var(--nm-ui-line,var(--nm-skin-stroke,#6b7d93))}
 #nm-map-presets .nm-map-actions button:hover{background:var(--nm-ui-hover,#31486a)}
 #nm-map-presets .nm-map-disclosure:not([open])>.nm-map-detail{display:none!important}
 @media(max-width:900px){#nm-map-presets .nm-map-grid{max-height:235px}}
 @media(prefers-reduced-motion:reduce){#nm-map-presets *{transition:none!important}}
 `;
 function preview(p,colors){
  // A miniature *map*, not an abstract swatch. All shape/stroke decisions
  // correspond to settings actually applied by NeuroMapMapStyleCore.apply.
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 190 94');
  svg.setAttribute('aria-hidden','true');
  const el=(tag,attrs,text)=>{
   const n=document.createElementNS(ns,tag);
   for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));
   if(text!==undefined)n.textContent=text;
   svg.append(n);return n;
  };
  const colors3=(colors?.length?colors:['#38bdf8','#c084fc','#f59e0b']);
  const white='#f7f7ff',background='#162238';
  el('rect',{x:1,y:1,width:188,height:92,rx:11,fill:background});
  const curves=p.branchStyle==='circuit'||p.branchStyle==='thickparents';
  const strength=Number(p.strokeScale)||1;
  const lineWidth=(level)=>Math.max(.9,(p.branchStyle==='simple'?1.4:
    p.branchStyle==='buzan'?level===0?4.4:2.0:
    p.branchStyle==='thickparents'?level===0?4.7:2.0:
    p.branchStyle==='neon'?2.6:2.1)*strength);
  const links=[
   ['M 59 46 C 71 46 78 23 102 23',colors3[0]],
   ['M 59 46 C 75 46 77 67 102 67',colors3[1]],
   ['M 136 23 C 150 23 150 18 160 18',colors3[2]||colors3[0]]
  ];
  for(const [i,row] of links.entries()){
   const d=curves?
    (i===0?'M 59 46 H 77 V 23 H 102':
     i===1?'M 59 46 H 77 V 67 H 102':'M 136 23 H 149 V 18 H 160'):
    p.branchStyle==='radial'&&i===1?'M 59 46 Q 76 82 102 67':row[0];
   el('path',{d,fill:'none',stroke:row[1], 'stroke-width':lineWidth(i===2?1:0),
    'stroke-linecap':'round','stroke-linejoin':'round'});
  }
  const nodes=[
   {x:8,y:36,w:52,h:23,label:'IDEA',color:colors3[0]},
   {x:101,y:12,w:65,h:22,label:'Tema',color:colors3[1]},
   {x:101,y:56,w:65,h:22,label:'Ramo',color:colors3[2]||colors3[0]}
  ];
  for(const node of nodes){
   if(p.nodeShape!=='plain'){
    let shape;
    if(p.nodeShape==='hex'||p.nodeShape==='circuit'){
     const cut=p.nodeShape==='hex'?9:5;
     const points=p.nodeShape==='hex'?
      [[node.x+cut,node.y],[node.x+node.w-cut,node.y],[node.x+node.w,node.y+node.h/2],
       [node.x+node.w-cut,node.y+node.h],[node.x+cut,node.y+node.h],[node.x,node.y+node.h/2]]:
      [[node.x+cut,node.y],[node.x+node.w-cut,node.y],[node.x+node.w,node.y+cut],
       [node.x+node.w,node.y+node.h-cut],[node.x+node.w-cut,node.y+node.h],
       [node.x+cut,node.y+node.h],[node.x,node.y+node.h-cut],[node.x,node.y+cut]];
     shape=el('polygon',{points:points.map(x=>x.join(',')).join(' '),
       fill:p.nodeShape==='hex'?'#293248':'#232f42',
       stroke:node.color,'stroke-width':1.3});
    }else{
     const rx=p.nodeShape==='pill'?node.h/2:p.nodeShape==='glass'?10:4;
     shape=el('rect',{x:node.x,y:node.y,width:node.w,height:node.h,rx,
      fill:p.nodeShape==='outline'?'#142138':
       p.nodeShape==='glass'?'#35445e':'#263b58',
      stroke:node.color,'stroke-width':p.nodeShape==='outline'?1.8:1});
    }
   }else{
    el('path',{d:'M '+node.x+' '+(node.y+node.h-3)+' H '+(node.x+node.w),
      stroke:node.color,'stroke-width':1.15,opacity:.65});
   }
   el('text',{x:node.x+node.w/2,y:node.y+node.h/2+3.2,
    fill:white,'font-size':node.label==='IDEA'?10:9.5,
    'font-weight':Math.min(800,Math.max(400,p.weight||500)),
    'text-anchor':'middle','font-family':'system-ui,sans-serif'},node.label);
  }
  return svg;
 }
 function install(App){
  if(!App?.prototype?.bindUI)return;
  const old=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=old.apply(this,args);mount(this);return result};
 }
 function mount(app){
  if(document.getElementById('nm-map-presets'))return;
  const host=document.getElementById('inspector-sidebar');if(!host)return;
  const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
  const section=document.createElement('section');section.id='nm-map-presets';section.className='nm6-skiptranslate';
  const title=document.createElement('h3'),note=document.createElement('p');
  note.className='nm-map-note';
  const scope=document.createElement('select');scope.setAttribute('aria-label','Map style scope');
  for(const [value,it,en] of [['map','Tutta la mappa','Whole map'],['selection','Nodi selezionati','Selected nodes']]){
   const o=document.createElement('option');o.value=value;o.textContent=tr(it,en);scope.append(o)}
  const disclosure=document.createElement('details');disclosure.id='nm-map-style-picker';disclosure.className='nm-map-disclosure';
  const trigger=document.createElement('summary');trigger.id='nm-map-style-trigger';
  const currentPreview=document.createElement('span');currentPreview.className='nm-map-current-preview';
  const currentName=document.createElement('span');currentName.className='nm-map-current-name';
  trigger.append(currentPreview,currentName);disclosure.append(trigger);
  const detail=document.createElement('div');detail.className='nm-map-detail';
  const grid=document.createElement('div');grid.className='nm-map-grid';
  const tools=document.createElement('div');tools.className='nm-map-actions';
  const save=document.createElement('button');save.type='button';
  const restore=document.createElement('button');restore.type='button';
  restore.disabled=true;
  const scopeLabel=document.createElement('label');
  scopeLabel.className='nm-map-scope';
  const scopeText=document.createElement('span');
  scopeLabel.append(scopeText,scope);
  tools.append(save,restore);
  detail.append(note,scopeLabel,grid,tools);disclosure.append(detail);section.append(title,disclosure);
  const anchor=host.querySelector('.inspector-header');
  if(anchor)anchor.insertAdjacentElement('afterend',section);else host.prepend(section);
  let personal=null,previous=null,lastChosen=null,lastState=null;
  const chosen=()=>{
    const current=lastState===app.state&&lastChosen
      &&[...C.PRESETS,...(personal?[personal]:[])].find(p=>p.id===lastChosen);
    if(current)return current;
    const matched=C.PRESETS.find(p=>p.branchStyle===app.state?.branchStyle&&
      p.palette===app.state?.activeThemeId);
    return matched||C.sample(app.state,tr('Personalizzato','Custom'))||C.PRESETS[0];
  };
  const syncCards=()=>{
    const selected=chosen()?.id;
    for(const card of grid.querySelectorAll('.nm-map-card')){
      const isSelected=card.dataset.nmPreset===selected;
      card.dataset.nmSelected=String(isSelected);
      card.setAttribute('aria-pressed',String(isSelected));
    }
  };
  const updateTrigger=()=>{
    const p=chosen();
    currentName.textContent=tr(p.it,p.en);
    trigger.setAttribute('aria-label',tr('Stile della mappa: ','Map style: ')+tr(p.it,p.en));
    currentPreview.replaceChildren(preview(p,root.NeuroMapEditorPalettes?.[p.palette]));
    syncCards();
  };
  const refreshLocale=()=>{
   title.textContent=tr('Galleria stili della mappa','Map style gallery');
   note.textContent=tr('Passa sopra per vedere la tua mappa. Clicca per applicare.','Hover to preview your map. Click to apply.');
   scopeText.textContent=tr('Applica lo stile a','Apply style to');
   save.textContent=tr('Salva preset personale','Save personal preset');
   restore.textContent=tr('Annulla ultimo stile','Undo last style');
   updateTrigger();
   for(const option of scope.options)option.textContent=option.value==='map'?tr('Tutta la mappa','Whole map'):tr('Nodi selezionati','Selected nodes');
  };
  try{personal=C.personal(root.localStorage?.getItem(C.KEY))}catch{personal=null}
  const apply=p=>{
   root.NeuroMapRefinements?.cancelPreview(app);
   const styleScope=document.getElementById('nm-settings-scope-style');
   const applyAllTabs=styleScope?.value==='all';
   const targets=(applyAllTabs && Array.isArray(app.tabs) && app.tabs.length)
     ? [...new Set(app.tabs.map(t=>t.state).filter(Boolean))]
     : [app.state];
   const owner=app.state,undoBefore=owner.undoStack.length;
   let appliedTotal=0;
   for(const targetState of targets){
    const count=C.apply(targetState,p,applyAllTabs?'map':scope.value,root.NeuroMapEditorPalettes);
    if(count){
     targetState.isDirty=true;
     if(targetState!==app.state)targetState._nmNeedsLayout=true;
     appliedTotal+=count;
    }
   }
   if(!appliedTotal){app.showToast(tr('Seleziona un nodo non centrale','Select a non-root node'),'STILE');return}
   app.markChanged();app.nm54SyncSettings?.();app.nmFormatRefresh?.();app.renderTabBar();lastChosen=p.id;lastState=app.state;updateTrigger();disclosure.open=false;trigger.focus({preventScroll:true});
   previous={owner,undoLength:owner.undoStack.length,undoBefore};
   restore.disabled=false;
   app.showToast(tr('Stile applicato · Ctrl+Z per annullare','Style applied · Ctrl+Z to undo'),'STILE');
  };
  const render=()=>{
   root.NeuroMapRefinements?.cancelPreview(app);
   grid.replaceChildren();
   for(const p of [...C.PRESETS,...(personal?[personal]:[])]){
    const b=document.createElement('button');b.className='nm-map-card';b.type='button';
    b.setAttribute('aria-label',tr(p.it,p.en));
    b.dataset.nmPreset=p.id;
    b.dataset.nmSelected=String(p.id===chosen().id);
    b.setAttribute('aria-pressed',String(p.id===chosen().id));
    b.append(preview(p,root.NeuroMapEditorPalettes?.[p.palette]));
    const txt=document.createElement('span');txt.textContent=tr(p.it,p.en);b.append(txt);
    b.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')root.NeuroMapRefinements?.preview(app,p,scope.value,b);});
    b.addEventListener('pointerleave',()=>root.NeuroMapRefinements?.cancelPreview(app));
    b.addEventListener('focus',()=>root.NeuroMapRefinements?.preview(app,p,scope.value,b));
    b.addEventListener('blur',()=>root.NeuroMapRefinements?.cancelPreview(app));
    b.addEventListener('click',()=>apply(p));grid.append(b);
   }
   refreshLocale();
  };
  scope.addEventListener('change',()=>root.NeuroMapRefinements?.cancelPreview(app));
  disclosure.addEventListener('toggle',()=>{
    if(!disclosure.open)root.NeuroMapRefinements?.cancelPreview(app);
    else updateTrigger();
  });
  save.addEventListener('click',()=>{
   const value=C.sample(app.state,tr('Il mio preset','My preset'));if(!value)return;
   personal=value;
   try{root.localStorage?.setItem(C.KEY,JSON.stringify(value))}catch{}
   render();
   app.showToast(tr('Preset salvato solo su questo dispositivo','Preset saved on this device'),'STILE');
  });
  restore.addEventListener('click',()=>{
   if(!previous||previous.owner!==app.state||
      previous.owner.undoStack.length!==previous.undoLength){restore.disabled=true;return}
   app.undo();previous=null;restore.disabled=true;lastChosen=null;lastState=null;updateTrigger();
  });
  if(root.NeuroMapWorkspaceLocale?.watch)root.NeuroMapWorkspaceLocale.watch(render);
  render();
 }
 root.NeuroMapMapStylesInstall=install;
})(globalThis);
