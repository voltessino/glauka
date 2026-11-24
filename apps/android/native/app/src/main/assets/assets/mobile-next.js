/* NeuroMap Architect Android 0.3 - touch menus, branch navigation & safe large imports.
   The Android build remains Free: no Developer license material is included. */
(function(){'use strict';
  const Core=window.NeuroMapSmartImport;
  if(!Core)return console.error('NeuroMap smart import engine unavailable');
  const PARAM='nm_android_import_budget_v1';
  const DOMAINS=['file','edit','insert','view'];
  const RANGES=Core.RANGES;
  function budget(){try{const v=Number(localStorage.getItem(PARAM));return RANGES.includes(v)?v:125;}catch(_){return 125;}}
  function setBudget(v){try{localStorage.setItem(PARAM,String(v));}catch(_){}}
  function isTyping(target){return !!target?.closest?.('textarea,[contenteditable="true"], input:not([type="range"]):not([type="checkbox"]):not([type="color"]):not([type="file"])');}
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  function show(app,message){app.showToast(String(message),'ANDROID');}
  async function importText(app,text,title,firstNewTab=true,confirmed=false){
    if(!text||!text.trim())throw Error('Non hai inserito alcun testo.');
    const root=Core.parse(text,title);
    const plan=confirmed?Core.paginate(root,budget()):await window.NeuroMapAndroidEditor.preview(root,title);
    if(!plan)return {pages:0,originalSources:0,totalNodes:0};
    // Work chunk by chunk so Android can paint between pages. Never slice the input.
    app.closeEditor(true);
    let imported=0;
    for(let i=0;i<plan.pages.length;i++){
      const page=plan.pages[i];
      imported+=app.importHierarchy(page.root,{newTab:i===0?firstNewTab:true});
      if(i%4===3)await nextFrame();
    }
    app.renderTabBar();
    app.scheduleSave();
    show(app,plan.pages.length+' mappe · '+plan.originalSources+' argomenti importati');
    return {pages:plan.pages.length,originalSources:plan.originalSources,totalNodes:imported};
  }
  function makeModal(app){
    const overlay=document.createElement('div');overlay.id='nm-android-import-modal';
    overlay.className='nm-android-shade hidden';
    overlay.innerHTML=`<div class="nm-android-import" role="dialog" aria-modal="true" aria-labelledby="nm-android-import-title">
      <header><strong id="nm-android-import-title">Crea una mappa dal testo</strong><button type="button" id="nm-android-close" aria-label="Chiudi">×</button></header>
      <p>Titoli, righe, rientri ed elenchi diventano rami. Il testo lungo viene suddiviso, senza riassumerlo o interpretarlo con AI. Controlla l’anteprima prima di creare le mappe.</p>
      <label for="nm-android-budget">Dimensione indicativa di ogni mappa</label>
      <select id="nm-android-budget"></select>
      <textarea id="nm-android-text" rows="9" placeholder="# Capitolo 1&#10;## Anatomia&#10;- Primo argomento&#10;- Secondo argomento…"></textarea>
      <div id="nm-android-import-status" role="status"></div><div class="nm-android-preview-grid"></div>
      <footer><button type="button" id="nm-android-cancel">Annulla</button><button type="button" id="nm-android-import-button">Crea mappe</button></footer>
    </div>`;
    document.body.appendChild(overlay);
    const list=overlay.querySelector('#nm-android-budget');
    for(const v of RANGES){const opt=document.createElement('option');opt.value=String(v);opt.textContent=v+' nodi/mappa';list.appendChild(opt);}
    list.value=String(budget());
    list.addEventListener('change',()=>setBudget(Number(list.value)));
    const textarea=overlay.querySelector('#nm-android-text');
    const status=overlay.querySelector('#nm-android-import-status');
    const button=overlay.querySelector('#nm-android-import-button');
    const close=()=>overlay.classList.add('hidden');
    overlay.querySelector('#nm-android-close').onclick=close;
    overlay.querySelector('#nm-android-cancel').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    const update=()=>{
      try{const text=textarea.value;if(!text.trim()){status.textContent='';return;}
        const outline=Core.parse(text,'Appunti importati');const plan=Core.paginate(outline,budget());
        status.textContent=plan.originalSources+' argomenti → '+plan.pages.length+' mappe';
        window.NeuroMapAndroidEditor.renderPreview(overlay.querySelector('.nm-android-preview-grid'),plan);
      }catch(e){status.textContent=e.message;}
    };
    let previewTimer;textarea.addEventListener('input',()=>{clearTimeout(previewTimer);previewTimer=setTimeout(update,350);});
    list.addEventListener('change',update);
    button.onclick=async()=>{
      if(!textarea.value.trim())return status.textContent='Incolla del testo prima di procedere.';
      button.disabled=true;status.textContent='Creo le mappe in ordine…';
      try{await importText(app,textarea.value,'Appunti importati',true,true);close();textarea.value='';}
      catch(e){status.textContent='Errore: '+e.message;console.error(e);}finally{button.disabled=false;}
    };
    return {open(){list.value=String(budget());overlay.classList.remove('hidden');overlay.querySelector('#nm-android-close').focus({preventScroll:true});},close};
  }
  function buildMenu(app,modal){
    const top=document.querySelector('.top-chrome'),bar=document.querySelector('.topbar');
    if(!top||!bar)return;
    const rail=document.createElement('nav');rail.id='nm-android-menu-rail';rail.setAttribute('aria-label','Menu e navigazione Android');
    const files=['File','Modifica','Inserisci','Visualizza'];
    for(let i=0;i<DOMAINS.length;i++){
      const kind=DOMAINS[i],source=document.getElementById('btn-menu-'+kind);
      if(!source)continue;
      const b=document.createElement('button');b.type='button';b.textContent=files[i];b.className='nm-android-menu-button';
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();source.click();});
      rail.appendChild(b);
    }
    const next=document.createElement('button');next.type='button';next.textContent='Ramo ›';next.id='nm-android-next-branch';
    rail.appendChild(next);
    const order=document.createElement('button');order.type='button';order.textContent='Ord: Originale';order.id='nm-android-order';
    rail.appendChild(order);
    top.insertBefore(rail,bar);
    let mode='original',index=-1,lastKey='';
    order.onclick=()=>{mode=mode==='original'?'visual':'original';order.textContent=mode==='original'?'Ord: Originale':'Ord: Visivo';index=-1;show(app,'Ordine '+(mode==='original'?'originale della mappa':'visivo: dall’alto al basso'));};
    next.onclick=()=>{
      const branches=app.state?.root?.children||[];
      if(!branches.length)return show(app,'Non ci sono rami da esplorare');
      const items=[...branches];
      if(mode==='original')items.sort((a,b)=>(Number.isFinite(a.customOrder)?a.customOrder:branches.indexOf(a))-(Number.isFinite(b.customOrder)?b.customOrder:branches.indexOf(b)));
      else items.splice(0,items.length,...NeuroMapCore.visualOrder(items,app.layout));
      const key=app.activeTabId+'|'+mode+'|'+branches.map(x=>x.id).join(',');
      if(key!==lastKey){index=-1;lastKey=key;}
      index=(index+1)%items.length;
      const branch=items[index];
      app.selectNode(branch.id);
      app.nmGraphicsFitSubtree(branch.id);
      show(app,'Ramo '+(index+1)+'/'+items.length+' · '+branch.text);
    };
    for(const panel of document.querySelectorAll('.dropdown-panel'))document.body.appendChild(panel);
    const place=trigger=>{
      const panel=document.getElementById(trigger.dataset.dropdownTarget);
      if(!panel||panel.classList.contains('hidden'))return;
      const button=rail.querySelectorAll('.nm-android-menu-button')[DOMAINS.indexOf(trigger.id.slice('btn-menu-'.length))];
      const bounds=(button||trigger).getBoundingClientRect();
      panel.classList.add('nm-android-dropdown');
      const width=Math.min(350,innerWidth-20),left=Math.max(10,Math.min(bounds.left,innerWidth-width-10));
      panel.style.cssText+=';position:fixed!important;left:'+left+'px!important;right:auto!important;top:'+Math.min(innerHeight-100,bounds.bottom+5)+'px!important;width:'+width+'px!important;max-height:'+Math.max(150,innerHeight-bounds.bottom-90)+'px!important;z-index:950!important;';
    };
    document.addEventListener('click',e=>{
      const trigger=e.target.closest?.('[data-dropdown-target]');if(trigger)queueMicrotask(()=>place(trigger));
    });
    const file=document.getElementById('dropdown-file');
    if(file){const action=document.createElement('button');action.className='dropdown-item nm-android-text-action';
      action.textContent='✎ Crea una mappa dal testo…';
      action.addEventListener('click',()=>{app.hideMenus();modal.open();});file.append(action);}
  }
  window.addEventListener('DOMContentLoaded',async()=>{if(window.GlaukaAppReady)await window.GlaukaAppReady;
    const app=window.neuroMapApp;
    if(!app)return console.error('NeuroMap app not initialized');
    const originalImport=app.importFile.bind(app);
    app.importFile=async(file,options={})=>{
      const ext=(file?.name?.split('.').pop()||'').toLowerCase();
      if(['txt','text','md','markdown'].includes(ext)){
        if(file.size>100*1024*1024)throw Error('Importazione superiore a 100 MB: dividere il documento prima di aprirlo sul telefono.');
        const source=await file.text();
        const roots=['md','markdown'].includes(ext)?window.NeuroMapCore.parseMarkdownExport(source):null;
        if(roots){
          let count=0;
          for(let i=0;i<roots.length;i++){
            const importOptions={newTab:i===0?options.newTab!==false:true};
            // A root-only map has nothing to paginate; the preview paginator
            // intentionally rejects documents without any source topics.
            const imported=roots[i].children.length
              ?await app.importHierarchyPreview(roots[i],importOptions)
              :app.importHierarchy(roots[i],importOptions);
            if(!imported)break;
            count+=imported;
          }
          return count;
        }
        return (await importText(app,source,file.name.replace(/\.[^.]+$/,''),options.newTab!==false)).originalSources;
      }
      // Preserve native NeuroMap/XMind/OPML/JSON handling, attachments and metadata.
      return originalImport(file,options);
    };
    const modal=makeModal(app);buildMenu(app,modal);
    // Capture large external clipboard text BEFORE the legacy listener, which would truncate it at 250 lines.
    document.addEventListener('paste',e=>{
      if(isTyping(e.target)||!e.clipboardData)return;
      const items=[...e.clipboardData.items];
      if(items.some(x=>x.kind==='file'&&x.type.startsWith('image/')))return;
      const raw=e.clipboardData.getData('text/plain');
      if(!raw||raw===app._clipboardPlain && app.internalClipboard)return;
      if(raw.length<600 && raw.split('\n').length<40)return;
      e.preventDefault();e.stopImmediatePropagation();
      importText(app,raw,'Testo incollato').catch(error=>{console.error(error);show(app,error.message);});
    },true);
  });
})();
