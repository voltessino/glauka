/* Android Free 0.5: editor features shared with desktop 6.16.0. */
(function() {
  'use strict';
  const Core = window.NeuroMapSmartImport;
  if(typeof NM_DICT!=='undefined')Object.assign(NM_DICT,{
    'File':'File','Modifica':'Edit','Inserisci':'Insert','Visualizza':'View',
    'Ramo ›':'Branch ›','Ord: Originale':'Order: Source','Ord: Visivo':'Order: Visual',
    'Importa testo o Markdown':'Import text or Markdown','Dimensione indicativa di ogni mappa':'Approximate map size',
    'Annulla':'Cancel','Crea mappe':'Create maps','✎ Incolla testo / Markdown lungo…':'✎ Paste text / long Markdown…',
    "Incolla i tuoi appunti: Glauka creerà automaticamente tutte le mappe necessarie, rispettando l'ordine e i capitoli.":'Paste your notes: Glauka will create all required maps, preserving order and chapters.'
  });

  const labels = {
    it: {preview:'Anteprima importazione',size:'Nodi per mappa',create:'Crea mappe',cancel:'Annulla',nodes:'nodi',maps:'mappe',more:'altre mappe',boundary:'Etichetta recinto',save:'Salva',remove:'Rimuovi etichetta',select:'Seleziona un ramo',theme:'Sfondo',night:'Notte',slate:'Ardesia',ocean:'Oceano',paper:'Carta',pearl:'Perla'},
    en: {preview:'Import preview',size:'Nodes per map',create:'Create maps',cancel:'Cancel',nodes:'nodes',maps:'maps',more:'more maps',boundary:'Boundary label',save:'Save',remove:'Remove label',select:'Select a branch',theme:'Background',night:'Night',slate:'Slate',ocean:'Ocean',paper:'Paper',pearl:'Pearl'}
  };
  const text = () => Object.fromEntries(Object.keys(labels.it).map(key=>[key,window.GlaukaI18n?.pair(labels.it[key],labels.en[key])||labels[document.documentElement.lang === 'en'?'en':'it'][key]]));
  function renderPreview(container, plan) {
    container.replaceChildren();
    for (const [i,page] of plan.pages.slice(0,60).entries()) {
      const card=document.createElement('div');card.className='nm-android-preview-card';
      const title=document.createElement('strong');title.textContent=(i+1)+'. '+page.root.text;
      const count=document.createElement('small');count.textContent=page.size+' '+text().nodes;
      card.append(title,count);container.append(card);
    }
    if(plan.pages.length>60){const rest=document.createElement('p');rest.textContent='+'+(plan.pages.length-60)+' '+text().more;container.append(rest);}
  }
  function preview(root, label) {
    return new Promise(resolve=>{
      const t=text(),shade=document.createElement('div');shade.className='nm-android-shade';shade.id='nm-android-root-preview';
      shade.innerHTML=`<section class="nm-android-import" role="dialog" aria-modal="true" aria-labelledby="nm-android-preview-title"><header><strong id="nm-android-preview-title"></strong></header><label for="nm-android-preview-size"></label><select id="nm-android-preview-size"></select><p role="status"></p><div class="nm-android-preview-grid"></div><footer><button data-action="cancel"></button><button data-action="create"></button></footer></section>`;
      const heading=shade.querySelector('strong'),authored=document.createElement('span');authored.setAttribute('data-glauka-user-content','');authored.textContent=String(label||root.text||'');heading.append(document.createTextNode(t.preview+' · '),authored);
      shade.querySelector('label').textContent=t.size;
      const select=shade.querySelector('select');
      let saved=125;try{saved=Number(localStorage.getItem('nm_android_import_budget_v1'))||125;}catch{}
      for(const size of Core.RANGES){const option=document.createElement('option');option.value=size;option.textContent=size+' '+t.nodes;select.append(option);}
      select.value=Core.RANGES.includes(saved)?String(saved):'125';
      let plan;
      const update=()=>{plan=Core.paginate(root,Number(select.value));shade.querySelector('[role="status"]').textContent=plan.originalSources+' '+t.nodes+' → '+plan.pages.length+' '+t.maps;renderPreview(shade.querySelector('.nm-android-preview-grid'),plan);};
      const close=result=>{shade.remove();resolve(result);};
      shade.querySelector('[data-action="cancel"]').textContent=t.cancel;
      shade.querySelector('[data-action="create"]').textContent=t.create;
      shade.onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action;
        if(action==='cancel'||e.target===shade)close(null);
        if(action==='create'){try{localStorage.setItem('nm_android_import_budget_v1',select.value);}catch{}close(plan);}
      };
      shade.onkeydown=e=>{if(e.key==='Escape')close(null);};select.onchange=update;
      document.body.append(shade);update();select.focus();
    });
  }
  const themes=NeuroMapThemePicker.themes;
  let themePicker;
  function setTheme(value){
    if(!themes[value])value='night';const {color,light}=themes[value];
    document.documentElement.style.setProperty('--bg-canvas',color);document.body.classList.toggle('nm-android-light',light);
    window.neuroMapApp?.requestRender();
    document.documentElement.dataset.nmTheme=value;
    themePicker?.setValue(value);
    try{localStorage.setItem('nm615.canvas.theme',value);}catch{}
    document.dispatchEvent(new CustomEvent('neuromap:canvas-theme'));
  }
  function editBoundary(app){
    const node=app.state.findNode(app.state.selectedNodeId),t=text();
    if(!node||node===app.state.root)return app.showToast(t.select,'MAP');
    const shade=document.createElement('div');shade.className='nm-android-shade';shade.id='nm-android-boundary-modal';
    shade.innerHTML='<section class="nm-android-import" role="dialog" aria-modal="true" aria-labelledby="nm-boundary-title"><header><strong id="nm-boundary-title"></strong></header><input id="nm-boundary-input" maxlength="110"><footer><button data-action="cancel"></button><button data-action="remove"></button><button data-action="save"></button></footer></section>';
    shade.querySelector('strong').textContent=t.boundary;
    const input=shade.querySelector('input');input.value=node.boundary?.title||'';input.setAttribute('aria-label',t.boundary);
    for(const action of ['cancel','remove','save'])shade.querySelector('[data-action="'+action+'"]').textContent=t[action];
    shade.onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action;
      if(action==='cancel'||e.target===shade)return shade.remove();
      if(action==='save'||action==='remove'){
        app.state.pushHistory();node.boundary={...node.boundary,enabled:true,title:action==='remove'?'':input.value.trim(),color:node.boundary?.color||node.color||'#a855f7'};
        app.markChanged();shade.remove();
      }
    };
    shade.onkeydown=e=>{if(e.key==='Escape')shade.remove();};document.body.append(shade);input.focus();
  }
  window.NeuroMapAndroidEditor={preview,renderPreview,setTheme};
  window.addEventListener('DOMContentLoaded',async()=>{if(window.GlaukaAppReady)await window.GlaukaAppReady;
    const app=window.neuroMapApp;if(!app)return;
    app.importHierarchyPreview=async function(root,options={}){
      const plan=await preview(root,root.text);if(!plan)return 0;
      let imported=0;
      for(let i=0;i<plan.pages.length;i++){
        imported+=this.importHierarchy(plan.pages[i].root,{newTab:i===0?options.newTab!==false:true});
        if(i%4===3)await new Promise(requestAnimationFrame);
      }
      this.renderTabBar();this.scheduleSave();return imported;
    };
    const sidebar=document.getElementById('inspector-sidebar');
    if(sidebar){
      themePicker=NeuroMapThemePicker.create({onChange:setTheme});
      const background=document.createElement('details');background.className='glauka-map-background';
      const caption=document.createElement('summary');
      const localizeBackground=()=>caption.textContent=window.GlaukaI18n?.pair('Sfondo della mappa','Map background')||'Sfondo della mappa';
      localizeBackground();window.addEventListener('glauka:language-change',localizeBackground);
      background.append(caption,themePicker.element);
      // One Android background section: canvas colour and screen-only texture.
      // Refinements may already have mounted inside the advanced settings area.
      const texture=document.getElementById('nm-map-refinements');
      if(texture&&sidebar.contains(texture))background.append(texture);
      sidebar.append(background);
      // The radial arrangement is no longer offered here. Old maps can still open it.
      const radial=sidebar.querySelector('#nm54-style-grid .nm54-style[data-style="radial"]');
      if(radial&&!sidebar.querySelector('.glauka-radial-heading')){
        const heading=document.createElement('p');
        heading.className='glauka-radial-heading';
        radial.before(heading);
        const localizeRadial=()=>{
          heading.textContent=window.GlaukaI18n?.pair('Disposizione alternativa','Alternative arrangement')||'Disposizione alternativa';
          radial.title=window.GlaukaI18n?.pair('La raggiera cambia la disposizione dei rami','Radial changes branch arrangement')||'La raggiera cambia la disposizione dei rami';
        };
        localizeRadial();
        window.addEventListener('glauka:language-change',localizeRadial);
      }
      let saved='white';try{saved=localStorage.getItem('nm615.canvas.theme')||'white';}catch{}setTheme(saved);
    }
  });
})();
