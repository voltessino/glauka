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
    const maxHeight=Math.min(680,Math.max(120,height-topFloor-margin))+'px';
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

  function findSectionByTitle(sections,pattern){
    return sections.find(g=>pattern.test(g.querySelector(':scope > summary, summary')?.textContent||''));
  }

  function ensureContextHost(d,group,id,className,role){
    let el=d.getElementById(id);
    if(!el){
      el=d.createElement('div');
      el.id=id;
      el.className=className;
      if(role)el.setAttribute('role',role);
      group.append(el);
    }
    return el;
  }

  function compactEditBarButton(btn,itLabel,enLabel,en,realDom){
    if(!btn||!realDom)return;
    const span=btn.querySelector('span');
    const prev=span?.textContent?.trim()||btn.textContent.trim();
    if(prev&&!btn.title)btn.title=prev;
    if(prev&&!btn.getAttribute('aria-label'))btn.setAttribute('aria-label',prev);
    const shortTxt=en?enLabel:itLabel;
    if(span)span.textContent=shortTxt;
    else btn.textContent=shortTxt;
  }

  // Expose every node and image command cleanly without hiding tools behind a collapsed drawer.
  // Move, never clone: original DOM buttons keep every listener and shortcut intact.
  function compactGroup(group,kind){
    if(!group)return;
    const d=DOC(),en=lang()==='en',realDom=typeof d.createElementNS==='function';
    if(kind==='image'){
      const quick=ensureContextHost(d,group,'nm-context-primary-image','nm-context-quick','group');
      const editbar=ensureContextHost(d,group,'nm-context-editbar-image','nm-context-editbar','group');
      const grid=ensureContextHost(d,group,'nm-context-image-grid','nm-context-grid');
      for(const id of ['nm616-context-preview-image','ctx-img-toggle-mode','ctx-img-reset-aspect']){
        const b=d.getElementById(id);
        if(b&&(group.contains(b)||quick.contains(b))){
          b.classList.add('nm-context-quick-item');
          const sp=b.querySelector('span');
          if(realDom&&sp)sp.textContent=stripLeadingGlyph(sp.textContent.replace(/^[\s\u2600-\u27BF\uFE0F]+/gu,''));
          quick.append(b);
        }
      }
      for(const [id,itTxt,enTxt] of [['ctx-img-cut','Taglia','Cut'],['ctx-img-copy','Copia','Copy'],['ctx-img-paste','Incolla','Paste'],['ctx-img-delete','Elimina','Delete']]){
        const b=d.getElementById(id);
        if(b&&(group.contains(b)||editbar.contains(b))){
          compactEditBarButton(b,itTxt,enTxt,en,realDom);
          editbar.append(b);
        }
      }
      const sections=[...group.querySelectorAll('.nm-context-image-section')];
      const firstBody=sections[0]?.querySelector('.nm70-menu-items')||sections[0];
      for(const child of [...group.children]){
        if(child===quick||child===editbar||child===grid)continue;
        if(child.classList?.contains('nm-context-image-section'))continue;
        if(child.matches?.('button.ctx-item')&&firstBody){
          firstBody.append(child);
        }else if(child.classList?.contains('dropdown-divider')||child.classList?.contains('nm-context-section-title')){
          child.hidden=true;
        }
      }
      for(const sec of sections){
        sec.classList.add('nm-context-section','nm-context-section-wide');
        sec.open=true;
        grid.append(sec);
      }
      for(const div of group.querySelectorAll('.dropdown-divider'))div.hidden=true;
      for(const sec of sections){
        sec.hidden=!sec.querySelector('button.ctx-item:not([hidden])');
      }
      if(realDom){
        for(const btn of group.querySelectorAll('.ctx-item')){
          applyIcon(d,btn,btn.id);
          if(!btn.querySelector('span')&&btn.querySelector('svg')){
            for(const node of [...btn.childNodes]){
              if(node.nodeType===3)node.textContent=stripLeadingGlyph(node.textContent);
            }
          }
        }
      }
      quick.hidden=!quick.querySelector('button:not([hidden])');
      editbar.hidden=!editbar.querySelector('button:not([hidden])');
      grid.hidden=!grid.querySelector('.nm-context-section:not([hidden])');
      group.prepend(editbar);
      group.prepend(quick);
      group.append(grid);
      return;
    }

    const quick=ensureContextHost(d,group,'nm-context-primary-node','nm-context-quick','group');
    const editbar=ensureContextHost(d,group,'nm-context-editbar-node','nm-context-editbar','group');
    const grid=ensureContextHost(d,group,'nm-context-workspace-grid','nm-context-grid');

    for(const id of ['ctx-add-child','ctx-add-sibling','ctx-edit-text']){
      const b=d.getElementById(id);
      if(b&&group.contains(b)){
        b.classList.add('nm-context-quick-item');
        quick.append(b);
      }
    }
    for(const [id,itTxt,enTxt] of [['ctx-cut','Taglia','Cut'],['ctx-copy','Copia','Copy'],['ctx-paste','Incolla','Paste'],['ctx-delete-node','Elimina','Delete']]){
      const b=d.getElementById(id);
      if(b&&group.contains(b)){
        compactEditBarButton(b,itTxt,enTxt,en,realDom);
        editbar.append(b);
      }
    }

    const preSections=[...group.querySelectorAll('.nm70-menu-group')];
    const structurePre=findSectionByTitle(preSections,/Struttura|Structure|Ramo|Branch|Disposizione/i);
    for(const child of [...group.children]){
      if(child===quick||child===editbar||child===grid)continue;
      if(child.classList?.contains('nm-context-quick')&&!child.id){
        while(child.firstChild)quick.append(child.firstChild);
        child.hidden=true;
        continue;
      }
      if(child.classList?.contains('nm70-menu-group')){
        grid.append(child);
        continue;
      }
      if(child.classList?.contains('v5-context-extra')&&structurePre){
        (structurePre.querySelector('.nm70-menu-items')||structurePre).append(child);
        continue;
      }
      if(child.querySelector?.('button.ctx-item')){
        grid.append(child);
      }else{
        child.hidden=true;
      }
    }

    const sections=[...grid.querySelectorAll('.nm70-menu-group')];
    const structure=findSectionByTitle(sections,/Struttura|Structure|Ramo|Branch|Disposizione/i);
    const clipboard=findSectionByTitle(sections,/Appunti|Clipboard/i);
    const content=findSectionByTitle(sections,/Contenut|Content|Media/i);

    if(realDom){
      for(const div of group.querySelectorAll('.dropdown-divider'))div.hidden=true;
      for(const groupBox of sections){
        groupBox.classList.add('nm-context-section');
        groupBox.open=true;
        const sum=groupBox.querySelector(':scope > summary');
        if(sum){
          const cleanSum=stripLeadingGlyph(sum.textContent);
          if(cleanSum)sum.textContent=cleanSum;
          sum.setAttribute('title',sum.textContent.trim());
        }
      }
      if(structure)structure.classList.add('nm-context-section-wide');
      const extra=grid.querySelector(':scope > .v5-context-extra')||group.querySelector(':scope > .v5-context-extra');
      if(extra&&structure)(structure.querySelector('.nm70-menu-items')||structure).append(extra);
      const pasteSib=d.getElementById('nm612-paste-sibling');
      if(pasteSib&&structure)(structure.querySelector('.nm70-menu-items')||structure).append(pasteSib);
      const notesBtn=d.getElementById('nm67-notes-context');
      if(notesBtn&&content)(content.querySelector('.nm70-menu-items')||content).append(notesBtn);

      // Group the three branch-side buttons into one compact horizontal row.
      const pinLeft=d.getElementById('nm67-pin-left');
      const pinAuto=d.getElementById('nm67-pin-auto');
      const pinRight=d.getElementById('nm67-pin-right');
      const sideHost=(structure?.querySelector('.nm70-menu-items'))||pinLeft?.parentElement;
      if(pinLeft&&pinAuto&&pinRight&&sideHost&&!d.querySelector('#context-menu .nm-ctx-side-row')){
        const row=d.createElement('div');row.className='nm-ctx-side-row';
        sideHost.append(row);
        for(const [btn,lblIt,lblEn] of [[pinLeft,'Sx','Left'],[pinAuto,'Auto','Auto'],[pinRight,'Dx','Right']]){
          btn.textContent=en?lblEn:lblIt;
          applyIcon(d,btn,btn.id);
          row.append(btn);
        }
      }
      if(structure){
        const row=structure.querySelector('.nm-ctx-side-row');
        if(row)(structure.querySelector('.nm70-menu-items')||structure).append(row);
      }
      for(const btn of group.querySelectorAll('.ctx-item'))applyIcon(d,btn,btn.id);
    }

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
      const sideRow=grid.querySelector('.nm-ctx-side-row');
      if(promote)promote.hidden=isRoot;
      if(resetPos)resetPos.hidden=isRoot;
      if(sideRow)sideRow.hidden=isRoot;
      const pasteSib=d.getElementById('nm612-paste-sibling');
      if(pasteSib)pasteSib.hidden=isRoot;
    }

    if(realDom){
      for(const groupBox of sections){
        const items=groupBox.querySelector('.nm70-menu-items')||groupBox;
        const hasVisibleBtn=[...items.querySelectorAll('button.ctx-item')].some(b=>!b.hidden);
        groupBox.hidden=!hasVisibleBtn;
      }
      if(clipboard){
        const hasVisibleBtn=[...clipboard.querySelectorAll('button.ctx-item')].some(b=>!b.hidden);
        clipboard.hidden=!hasVisibleBtn;
      }
      const visibleCols=sections.filter(s=>!s.hidden&&!s.classList.contains('nm-context-section-wide'));
      visibleCols.forEach(s=>s.classList.remove('nm-context-section-wide'));
      if(visibleCols.length%2===1)visibleCols[visibleCols.length-1].classList.add('nm-context-section-wide');
    }

    group.prepend(editbar);
    group.prepend(quick);
    group.append(grid);
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
    const quick=ensureContextHost(d,node,'nm-context-primary-node','nm-context-quick','group');
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
    const sections=[...node.querySelectorAll('.nm70-menu-group')];
    for(const group of sections){
      const summary=group.querySelector(':scope > summary');
      if(!summary)continue;
      group.classList.add('nm-context-section');
      group.open=true;
      summary.setAttribute('title',summary.textContent.trim());
    }
    const extra=node.querySelector(':scope > .v5-context-extra');
    const structure=findSectionByTitle(sections,/Struttura|Structure|Ramo|Branch|Disposizione/i);
    if(extra&&structure)(structure.querySelector('.nm70-menu-items')||structure).append(extra);
    const imageGroups=[
      [words.photo,['nm616-context-preview-image','ctx-img-toggle-mode','ctx-img-reset-aspect','ctx-img-toggle-zlayer']],
      [words.clipboard,['ctx-img-cut','ctx-img-copy','ctx-img-paste','ctx-img-delete']]
    ];
    for(const [title,ids] of imageGroups){
      const section=d.createElement('details');
      section.className='nm-context-image-section nm-context-section';
      section.open=true;
      const heading=d.createElement('summary');
      heading.className='nm-context-section-title';
      heading.textContent=title;
      section.append(heading);
      const body=d.createElement('div');
      body.className='nm70-menu-items';
      for(const id of ids){const button=d.getElementById(id);if(button)body.append(button);}
      section.append(body);
      image.append(section);
    }
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
        const headings=menu.querySelectorAll('#ctx-group-image .nm-context-image-section > .nm-context-section-title');
        if(headings[0])headings[0].textContent=words.photo;
        if(headings[1])headings[1].textContent=words.clipboard;
        const label=d.getElementById('ctx-header-type');
        const isImage=hit?.type==='image'||hit?.type==='image-handle';
        menu.classList.toggle('is-compact-target',empty||isImage);
        if(label){
          label.textContent=isImage?((globalThis.GlaukaI18n?.pair("IMMAGINE","IMAGE")??(lang()==='en'?'IMAGE':'IMMAGINE'))):
            hit?.type==='node'?LABELS[lang()].node:
            !hit?((globalThis.GlaukaI18n?.pair("MAPPA","CANVAS")??(lang()==='en'?'CANVAS':'MAPPA'))):LABELS[lang()].canvas;
        }
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
