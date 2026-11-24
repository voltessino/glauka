/* Context Menu Refresh: presentation only, existing action IDs and handlers retained. */
(function(global){
  'use strict';
  const DOC=()=>global.document;
  const LABELS={
    it:{quick:'Azioni rapide',child:'Figlio',sibling:'Fratello',rename:'Rinomina',image:'Immagine',
      photo:'Immagine e posizione',clipboard:'Appunti',node:'NODO',canvas:'MAPPA · nodo attivo'},
    en:{quick:'Quick actions',child:'Child',sibling:'Sibling',rename:'Rename',image:'Image',
      photo:'Image & position',clipboard:'Clipboard',node:'NODE',canvas:'CANVAS · active node'}
  };
  const lang=()=>{
    try{const value=global.localStorage?.getItem('nm6_locale');
      if(value==='en'||value==='it')return value;
    }catch{}
    return DOC().documentElement?.lang?.toLowerCase().startsWith('en')?'en':'it';
  };

  // Vector icons aligned 1:1 with the topbar SVG symbols (zero raw emojis).
  const ICONS={
    'ctx-add-child':{paths:['M12 5v14','M5 12h14'],color:'#7c3aed'},
    'ctx-add-sibling':{paths:['M7 7h10','M7 12h10','M11 17h6'],color:'#059669'},
    'ctx-edit-text':{paths:['M12 20h9','M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z']},
    'ctx-copy':{rects:[{x:9,y:9,w:12,h:12,rx:2}],paths:['M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1']},
    'ctx-img-copy':{rects:[{x:9,y:9,w:12,h:12,rx:2}],paths:['M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1']},
    'ctx-cut':{circles:[{cx:6,cy:6,r:3},{cx:6,cy:18,r:3}],paths:['M20 4 8.12 15.88','M14.47 14.48 20 20','M8.12 8.12 12 12']},
    'ctx-img-cut':{circles:[{cx:6,cy:6,r:3},{cx:6,cy:18,r:3}],paths:['M20 4 8.12 15.88','M14.47 14.48 20 20','M8.12 8.12 12 12']},
    'ctx-paste':{rects:[{x:8,y:2,w:8,h:4,rx:1}],paths:['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2']},
    'ctx-img-paste':{rects:[{x:8,y:2,w:8,h:4,rx:1}],paths:['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2']},
    'nm612-paste-sibling':{rects:[{x:8,y:2,w:8,h:4,rx:1}],paths:['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2']},
    'ctx-delete-node':{paths:['M3 6h18','M8 6V4h8v2','M19 6l-1 14H6L5 6','M10 11v6','M14 11v6'],color:'#e11d48'},
    'ctx-img-delete':{paths:['M3 6h18','M8 6V4h8v2','M19 6l-1 14H6L5 6','M10 11v6','M14 11v6'],color:'#e11d48'},
    'ctx-add-image':{rects:[{x:3,y:3,w:18,h:18,rx:2}],circles:[{cx:9,cy:9,r:1.5}],paths:['M21 15l-5-5L5 21']},
    'ctx-iconify-search':{circles:[{cx:11,cy:11,r:7}],paths:['M21 21l-4.3-4.3']},
    'nm62-ctx-markers':{paths:['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z'],circles:[{cx:7,cy:7,r:1.5}]},
    'nm67-notes-context':{paths:['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M8 13h8','M8 17h5']},
    'btn-ai-expand':{paths:['M5 5v14','M5 12h6','M14.5 6.5l1.6 3.9L20 12l-3.9 1.6-1.6 3.9-1.6-3.9L9 12l3.9-1.6z'],color:'#8b5cf6'},
    'btn-ai-explain':{paths:['M9 18h6','M10 21h4','M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .9 1.6h5.2c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z'],color:'#06b6d4'},
    'btn-ai-audit':{paths:['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z','M9 12l2 2 4-4'],color:'#10b981'},
    'v5-ctx-google-ai':{circles:[{cx:11,cy:11,r:7}],paths:['m21 21-4.3-4.3','M11 8v6','M8 11h6'],color:'#6366f1'},
    'v5-ctx-google-images':{rects:[{x:3,y:4,w:18,h:16,rx:2}],circles:[{cx:8.5,cy:9.5,r:1.5}],paths:['m21 16-5-5-6 6'],color:'#ec4899'},
    'ctx-toggle-boundary':{rects:[{x:3,y:5,w:18,h:14,rx:5,dash:'3 2.5'}],paths:['M8 10h8','M8 14h5'],color:'#a855f7'},
    'nm70-boundary-title':{rects:[{x:3,y:5,w:18,h:14,rx:5,dash:'3 2.5'}],paths:['M8 12h8'],color:'#a855f7'},
    'ctx-add-summary':{paths:['M7 4c2.5 0 3.5 1.2 3.5 3.5v2c0 1.4 1 2.5 2.5 2.5-1.5 0-2.5 1.1-2.5 2.5v2C10.5 18.8 9.5 20 7 20'],rects:[{x:15,y:9.5,w:6,h:5,rx:1.5}],color:'#10b981'},
    'ctx-invert-branch':{paths:['M7 16V4','M3 8l4-4 4 4','M17 8v12','M13 16l4 4 4-4'],color:'#d97706'},
    'nm70-invert-all':{paths:['M3 10h14','M13 6l4 4-4 4','M21 14H7','M11 10l-4 4 4 4'],color:'#d97706'},
    'ctx-toggle-collapse':{paths:['M7 15l5 5 5-5','M7 9l5-5 5 5']},
    'v5-ctx-promote':{paths:['M7 17L17 7','M7 7h10v10']},
    'v5-ctx-reset-position':{paths:['M15 3h6v6','M9 21H3v-6','M21 3l-7 7','M3 21l7-7']},
    'ctx-canvas-center':{paths:['M15 3h6v6','M9 21H3v-6','M21 3l-7 7','M3 21l7-7'],color:'#0284c7'},
    'ctx-canvas-new-floating':{rects:[{x:3,y:3,w:18,h:18,rx:3}],paths:['M12 8v8','M8 12h8'],color:'#7c3aed'},
    'nm67-pin-left':{paths:['M19 12H5','M11 6l-6 6 6 6']},
    'nm67-pin-right':{paths:['M5 12h14','M13 6l6 6-6 6']},
    'nm67-pin-auto':{paths:['M12 3v18','M8 8l-4 4 4 4','M16 8l4 4-4 4']},
    'ctx-img-toggle-mode':{rects:[{x:3,y:11,w:18,h:10,rx:2}],paths:['M7 11V7a5 5 0 0 1 9.9-1']},
    'ctx-img-reset-aspect':{rects:[{x:3,y:3,w:18,h:18,rx:2}],paths:['M9 3v18','M3 9h18']},
    'ctx-img-toggle-zlayer':{paths:['M12 2 2 7l10 5 10-5-10-5z','M2 17l10 5 10-5','M2 12l10 5 10-5']}
  };

  function stripLeadingGlyph(text){
    return String(text||'').replace(/^[\s✨🧠📝🖼🏷⬚｝↔⇄👁✂▢▣🗑↗◎←→🔓📐⬇➕⤵✏＋↳✎⤢▧✦\uFE0F\u200D]+/g,'').trim();
  }

  function applyIcon(d,button,id){
    if(!button||typeof d.createElementNS!=='function')return;
    const spec=ICONS[id]||(button.id?.includes('link')?{paths:['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71','M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']}:null);
    const labelSpan=button.querySelector('span:not(.counter-pill)')||button;
    if(labelSpan.textContent){
      const clean=stripLeadingGlyph(labelSpan.textContent);
      if(clean&&clean!==labelSpan.textContent)labelSpan.textContent=clean;
    }
    if(button.style?.color&&!['ctx-delete-node','ctx-img-delete'].includes(id))button.style.removeProperty('color');
    if(!spec||button.querySelector('.nm-ctx-svg'))return;
    const NS='http://www.w3.org/2000/svg';
    const svg=d.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.9');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');
    svg.classList.add('nm-ctx-svg');
    if(spec.color)svg.style.color=spec.color;
    for(const r of spec.rects||[]){
      const el=d.createElementNS(NS,'rect');
      el.setAttribute('x',String(r.x));el.setAttribute('y',String(r.y));
      el.setAttribute('width',String(r.w));el.setAttribute('height',String(r.h));
      el.setAttribute('rx',String(r.rx||0));
      if(r.dash)el.setAttribute('stroke-dasharray',r.dash);
      svg.append(el);
    }
    for(const c of spec.circles||[]){
      const el=d.createElementNS(NS,'circle');
      el.setAttribute('cx',String(c.cx));el.setAttribute('cy',String(c.cy));el.setAttribute('r',String(c.r));
      svg.append(el);
    }
    for(const p of spec.paths||[]){
      const el=d.createElementNS(NS,'path');
      el.setAttribute('d',p);
      svg.append(el);
    }
    button.prepend(svg);
  }

  function fitMenu(menu){
    const vv=global.visualViewport,originLeft=vv?.offsetLeft||0,originTop=vv?.offsetTop||0;
    const width=vv?.width||global.innerWidth,height=vv?.height||global.innerHeight,margin=12;
    const topFloor=Math.max(originTop+margin,Math.min(92,originTop+height-220));
    menu.style.setProperty('box-sizing','border-box');
    const maxHeight=Math.min(500,Math.max(120,height-topFloor-margin))+'px';
    if(menu.style.getPropertyValue('max-height')!==maxHeight)
      menu.style.setProperty('max-height',maxHeight,'important');
    if(menu.style.getPropertyValue('overflow-y')!=='auto')
      menu.style.setProperty('overflow-y','auto','important');
    const r=menu.getBoundingClientRect();
    const left=Math.max(originLeft+margin,Math.min(r.left,originLeft+width-r.width-margin))+'px';
    const top=Math.max(topFloor,Math.min(r.top,originTop+height-Math.min(r.height,height-topFloor-margin)-margin))+'px';
    if(menu.style.left!==left) menu.style.left=left;
    if(menu.style.top!==top) menu.style.top=top;
  }

  // Only show the few actions a person can perform on the thing clicked.
  // Move, never clone: the original buttons keep every listener and shortcut.
  function compactGroup(group,kind){
    if(!group)return;
    const d=DOC(),en=lang()==='en',realDom=typeof d.createElementNS==='function';
    const primaryId=kind==='image'?'nm-context-primary-image':'nm-context-primary-node';
    const moreId=kind==='image'?'nm-context-more-image':'nm-context-more-node';
    let primary=d.getElementById(primaryId),more=d.getElementById(moreId);
    if(!primary){
      primary=d.createElement('div');primary.id=primaryId;primary.className='nm-context-essential';
      more=d.createElement('details');more.id=moreId;more.className='nm-context-other';
      const label=d.createElement('summary');label.textContent=en?'More actions…':'Altre azioni…';
      label.setAttribute('aria-label',en?'Show more actions for this item':'Mostra altre azioni per questo elemento');
      const contents=d.createElement('div');contents.className='nm-context-other-items';
      more.append(label,contents);
      // Move all pre-existing DOM commands into the optional submenu.
      while(group.firstChild)contents.append(group.firstChild);
      group.append(primary,more);
    }
    const contents=more.querySelector('.nm-context-other-items');
    if(!contents)return;
    const preferred=kind==='image'
      ?['nm616-context-preview-image','ctx-img-copy','ctx-img-toggle-mode','ctx-img-delete']
      :['ctx-add-child','ctx-add-sibling','ctx-edit-text','ctx-copy','ctx-paste','ctx-delete-node'];
    for(const id of preferred){
      const b=d.getElementById(id);
      if(b&&group.contains(b))primary.append(b);
    }
    for(const e of [...group.children]){
      if(e!==primary&&e!==more)contents.append(e);
    }
    for(const redundant of contents.querySelectorAll('.nm-context-quick,.nm-context-section-title')){
      if(!redundant.querySelector('button'))redundant.hidden=true;
    }
    if(realDom){
      for(const div of contents.querySelectorAll('.dropdown-divider'))div.hidden=true;
      for(const groupBox of contents.querySelectorAll('.nm70-menu-group')){
        groupBox.open=true;
        const sum=groupBox.querySelector(':scope > summary');
        if(sum){
          const cleanSum=stripLeadingGlyph(sum.textContent);
          if(cleanSum)sum.textContent=cleanSum;
        }
      }
      // Group the three branch-side buttons into one compact horizontal row.
      const pinLeft=d.getElementById('nm67-pin-left');
      const pinAuto=d.getElementById('nm67-pin-auto');
      const pinRight=d.getElementById('nm67-pin-right');
      const sideHost=pinLeft?.parentElement;
      if(pinLeft&&pinAuto&&pinRight&&sideHost&&!sideHost.classList.contains('nm-ctx-side-row')&&!d.querySelector('#context-menu .nm-ctx-side-row')){
        const row=d.createElement('div');row.className='nm-ctx-side-row';
        sideHost.append(row);
        for(const [btn,lblIt,lblEn] of [[pinLeft,'Sx','Left'],[pinAuto,'Auto','Auto'],[pinRight,'Dx','Right']]){
          btn.textContent=en?lblEn:lblIt;
          applyIcon(d,btn,btn.id);
          row.append(btn);
        }
      }
      for(const btn of group.querySelectorAll('.ctx-item'))applyIcon(d,btn,btn.id);
    }
    const summary=more.querySelector('summary');
    if(summary)summary.textContent=en?
      (kind==='image'?'More image actions…':'More branch actions…'):
      (kind==='image'?'Altre azioni sull’immagine…':'Altre azioni sul ramo…');
    if(kind==='node'){
      const app=global.neuroMapApp;
      const selected=app?.state?.findNode?.(app?.state?.selectedNodeId);
      const isRoot=Boolean(app?.state?.selectedNodeId&&app?.state?.selectedNodeId===app?.state?.root?.id);
      const rootNode=d.getElementById('ctx-add-sibling');
      if(rootNode)rootNode.hidden=isRoot;
      if(realDom&&selected){
        const hasKids=Boolean(selected.children?.length);
        const invert=d.getElementById('ctx-invert-branch');
        const collapse=d.getElementById('ctx-toggle-collapse');
        if(invert)invert.hidden=(selected.children?.length||0)<2;
        if(collapse)collapse.hidden=!hasKids;
        const promote=d.getElementById('v5-ctx-promote');
        const resetPos=d.getElementById('v5-ctx-reset-position');
        const sideRow=contents.querySelector('.nm-ctx-side-row');
        if(promote)promote.hidden=isRoot;
        if(resetPos)resetPos.hidden=isRoot;
        if(sideRow)sideRow.hidden=isRoot;
        const pasteSib=d.getElementById('nm612-paste-sibling');
        if(pasteSib)pasteSib.hidden=isRoot;
      }
    }
    more.open=false;
  }

  function decorate(){
    const d=DOC(),menu=d.getElementById('context-menu'),node=d.getElementById('ctx-group-node');
    const image=d.getElementById('ctx-group-image');
    if(!menu||!node||!image||menu.dataset.nmContextRefresh==='1')return false;
    const words=LABELS[lang()];
    menu.dataset.nmContextRefresh='1';
    menu.classList.add('nm-context-refined');
    menu.setAttribute('role','region');
    menu.setAttribute('aria-label','Glauka · '+((globalThis.GlaukaI18n?.pair("azioni contestuali","context actions")??(lang()==='en'?'context actions':'azioni contestuali'))));
    const header=menu.querySelector('.ctx-header');
    if(header)header.classList.add('nm-context-head');
    const short=d.createElement('div');
    short.className='nm-context-section-title';
    short.textContent=words.quick;
    const quick=d.createElement('div');
    quick.className='nm-context-quick';
    quick.setAttribute('role','group');
    quick.setAttribute('aria-label',words.quick);
    const hasSvg=typeof d.createElementNS==='function';
    const actions=[['ctx-add-child','child'],['ctx-add-sibling','sibling'],['ctx-edit-text','rename']];
    for(const [id,key] of actions){
      const button=d.getElementById(id);
      if(!button)continue;
      const original=button.querySelector('span')?.textContent?.trim()||button.textContent.trim();
      button.title=original;
      button.setAttribute('aria-label',original);
      button.classList.add('nm-context-quick-item');
      const label=button.querySelector('span');
      if(label)label.textContent=(hasSvg?'':({child:'＋ ',sibling:'↳ ',rename:'✎ '})[key])+words[key];
      quick.append(button);
    }
    node.prepend(quick);
    node.prepend(short);
    const sections=[...node.querySelectorAll('.nm70-menu-group')];
    for(const group of sections){
      const summary=group.querySelector(':scope > summary');
      if(!summary)continue;
      group.classList.add('nm-context-section');
      group.open=hasSvg||sections.indexOf(group)===0;
      summary.setAttribute('title',summary.textContent.trim());
    }
    const extra=node.querySelector(':scope > .v5-context-extra');
    const structure=sections.find(g=>/Struttura|Structure/i.test(g.querySelector('summary')?.textContent||''));
    if(extra&&structure)structure.querySelector('.nm70-menu-items')?.append(extra);
    const imageGroups=[
      [words.photo,['ctx-img-toggle-mode','ctx-img-reset-aspect','ctx-img-toggle-zlayer']],
      [words.clipboard,['ctx-img-cut','ctx-img-copy','ctx-img-paste']]
    ];
    for(const [title,ids] of imageGroups){
      const section=d.createElement('section');section.className='nm-context-image-section';
      const heading=d.createElement('div');heading.className='nm-context-section-title';
      heading.textContent=title;section.append(heading);
      for(const id of ids){const button=d.getElementById(id);if(button)section.append(button);}
      image.append(section);
    }
    const imageDelete=d.getElementById('ctx-img-delete');
    if(imageDelete)image.append(imageDelete);
    for(const x of image.querySelectorAll(':scope > .dropdown-divider'))x.hidden=true;
    for(const button of menu.querySelectorAll('.ctx-item')){
      button.setAttribute('type','button');
      applyIcon(d,button,button.id);
    }
    menu.addEventListener('toggle',()=>requestAnimationFrame(()=>fitMenu(menu)),true);
    global.addEventListener('resize',()=>{if(!menu.classList.contains('hidden'))fitMenu(menu)});
    menu.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    menu.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();
        menu.classList.add('hidden');
        d.getElementById('mindmap-canvas')?.focus({preventScroll:true});
      }
    });
    return true;
  }
  function install(App){
    const base=App.prototype.bindUI;
    App.prototype.bindUI=function(){
      const result=base.apply(this,arguments);
      decorate();
      const nodeGroup=DOC().getElementById('ctx-group-node');
      const imageGroup=DOC().getElementById('ctx-group-image');
      compactGroup(nodeGroup,'node');
      compactGroup(imageGroup,'image');
      const add=DOC().getElementById('ctx-canvas-new-floating');
      const center=DOC().getElementById('ctx-canvas-center');
      if(add&&center&&!this._nmCanvasContextBound){
        this._nmCanvasContextBound=true;
        add.addEventListener('click',()=>{
          const at=this._nmCanvasContextWorld;
          this.hideMenus();
          if(at)this.createFloatingTopicAt(at.x,at.y);
        });
        center.addEventListener('click',()=>{
          this.hideMenus();
          if(typeof this.fitWholeMap==='function')this.fitWholeMap();
          else this.fitToScreen();
        });
      }
      return result;
    };
    const show=App.prototype.showContextMenu;
    App.prototype.showContextMenu=function(x,y,hit){
      const result=show.apply(this,arguments);
      const menu=DOC().getElementById('context-menu');
      if(menu&&!menu.classList.contains('hidden')){
        const d=DOC(),hasSvg=typeof d.createElementNS==='function';
        const canvas=d.getElementById('ctx-group-canvas');
        const empty=!hit;
        if(canvas){
          canvas.classList.toggle('hidden',!empty);
          if(empty)d.getElementById('ctx-group-node')?.classList.add('hidden');
        }
        if(empty){
          this._nmCanvasContextWorld=this.renderer.screenToWorld(x,y);
          const heading=d.getElementById('ctx-canvas-heading');
          const createBtn=d.getElementById('ctx-canvas-new-floating');
          const centerBtn=d.getElementById('ctx-canvas-center');
          const create=createBtn?.querySelector('span');
          const center=centerBtn?.querySelector('span');
          const hint=d.getElementById('ctx-canvas-hint');
          const title=d.getElementById('ctx-node-title');
          if(heading)heading.textContent=(globalThis.GlaukaI18n?.pair("Spazio libero","Empty canvas")??(lang()==='en'?'Empty canvas':'Spazio libero'));
          if(create)create.textContent=hasSvg?(globalThis.GlaukaI18n?.pair("Nuovo nodo libero qui","New floating topic here")??(lang()==='en'?'New floating topic here':'Nuovo nodo libero qui')):(globalThis.GlaukaI18n?.pair("＋ Nuovo nodo libero qui","＋ New floating topic here")??(lang()==='en'?'＋ New floating topic here':'＋ Nuovo nodo libero qui'));
          if(center)center.textContent=hasSvg?(globalThis.GlaukaI18n?.pair("Centra e adatta la mappa","Fit whole map")??(lang()==='en'?'Fit whole map':'Centra e adatta la mappa')):(globalThis.GlaukaI18n?.pair("⤢ Centra e adatta la mappa","⤢ Fit whole map")??(lang()==='en'?'⤢ Fit whole map':'⤢ Centra e adatta la mappa'));
          if(createBtn)applyIcon(d,createBtn,'ctx-canvas-new-floating');
          if(centerBtn)applyIcon(d,centerBtn,'ctx-canvas-center');
          if(hint)hint.textContent=(globalThis.GlaukaI18n?.pair("Il nodo libero nasce qui. Clicca su un nodo per modificarlo.","Place a free topic here. Right-click a node to see its editing actions.")??(lang()==='en'?
            'Place a free topic here. Right-click a node to see its editing actions.':
            'Il nodo libero nasce qui. Clicca su un nodo per modificarlo.'));
          if(title)title.textContent=lang()==='en'?'Canvas':'Canvas';
        }else this._nmCanvasContextWorld=null;
        const words=LABELS[lang()];
        const short=menu.querySelector('#ctx-group-node > .nm-context-section-title');
        if(short)short.textContent=words.quick;
        const names=[['ctx-add-child','child','＋ '],['ctx-add-sibling','sibling','↳ '],['ctx-edit-text','rename','✎ ']];
        for(const [id,key,icon] of names){
          const button=d.getElementById(id),text=button?.querySelector('span');
          if(text)text.textContent=(hasSvg?'':icon)+words[key];
          if(button)applyIcon(d,button,id);
        }
        const headings=menu.querySelectorAll('#ctx-group-image > .nm-context-image-section > .nm-context-section-title');
        if(headings[0])headings[0].textContent=words.photo;
        if(headings[1])headings[1].textContent=words.clipboard;
        const label=d.getElementById('ctx-header-type');
        if(label){
          const image=hit?.type==='image'||hit?.type==='image-handle';
          label.textContent=image?((globalThis.GlaukaI18n?.pair("IMMAGINE","IMAGE")??(lang()==='en'?'IMAGE':'IMMAGINE'))):
            hit?.type==='node'?LABELS[lang()].node:
            !hit?((globalThis.GlaukaI18n?.pair("MAPPA","CANVAS")??(lang()==='en'?'CANVAS':'MAPPA'))):LABELS[lang()].canvas;
        }
        const isImage=hit?.type==='image'||hit?.type==='image-handle';
        if(hit?.type==='node')compactGroup(d.getElementById('ctx-group-node'),'node');
        if(isImage)compactGroup(d.getElementById('ctx-group-image'),'image');
        if(!hit){
          d.getElementById('ctx-group-node')?.classList.add('hidden');
          d.getElementById('ctx-group-image')?.classList.add('hidden');
        }
        menu.style.left=Math.max(12,Math.min(x,global.innerWidth-menu.offsetWidth-12))+'px';
        const height=Math.min(menu.scrollHeight,global.innerHeight-24);
        menu.style.top=Math.max(12,Math.min(y,global.innerHeight-height-12))+'px';
        fitMenu(menu);
        menu.focus?.({preventScroll:true});
      }
      return result;
    };
  }
  global.NeuroMapContextRefresh={install,decorate};
})(window);
