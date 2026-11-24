/* NeuroMap 6.15: chronological XMind, previewable import, boundary captions, backgrounds. */
const nm615Styles=document.createElement('style');
nm615Styles.textContent=`
.nm615-shade{position:fixed;inset:0;z-index:550;background:rgba(3,8,22,.76);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}
.nm615-shade.hidden{display:none!important}
.nm615-dialog{width:min(570px,95vw);max-height:min(87vh,830px);overflow:auto;box-sizing:border-box;background:#111a2f;border:1px solid #47577a;border-radius:18px;color:#edf2ff;box-shadow:0 40px 115px #000a;padding:23px;font:13px/1.5 Inter,system-ui,sans-serif}
.nm615-dialog h2{font:750 19px/1.3 Inter,system-ui,sans-serif;margin:0 0 8px;color:#f7f9ff}
.nm615-dialog p{color:#b4c2dc;margin:0 0 17px}
.nm615-dialog label{display:block;color:#d9e3ff;font-weight:750;font-size:12px;margin:10px 0 6px}
.nm615-dialog select,.nm615-dialog input{width:100%;box-sizing:border-box;border:1px solid #455579;background:#0a1429;border-radius:11px;color:#f2f6ff;font-size:13px;padding:11px 12px}
.nm615-dialog-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:18px}
.nm615-dialog-actions button,.nm615-style-tools button{border:1px solid #44557a;background:#1e2d48;border-radius:10px;color:#eaf1ff;padding:9px 12px;font:700 12px Inter,system-ui,sans-serif;cursor:pointer}
.nm615-dialog-actions button:hover,.nm615-style-tools button:hover{border-color:#9785ff}
.nm615-dialog-actions .nm615-primary{border-color:#9d84ff;background:linear-gradient(115deg,#514be1,#8c35d3)}
.nm615-import-dialog{width:min(670px,95vw)}
#nm615-import-count{padding:10px 0;font-size:13px;font-weight:750;color:#a9bfff}
#nm615-import-preview{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;max-height:245px;overflow:auto;padding:7px;border:1px solid #354361;border-radius:11px}
.gl-import-paste{width:min(710px,95vw)}
.gl-import-paste .gl-import-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.gl-import-paste .gl-import-field{margin:0;min-width:0}
.gl-import-paste .gl-import-caption{display:block;margin:10px 0 5px;font-size:11px}
.gl-import-paste .gl-import-name{padding:12px;background:rgba(143,154,188,.07);border:1px solid #354361;border-radius:12px;margin:13px 0}
.gl-import-paste #gl-import-summary{color:#c6c9fb;font-weight:700;margin:10px 0}
.gl-import-paste .gl-import-preview{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;max-height:170px;overflow:auto}
.gl-import-paste .gl-import-preview>div{padding:9px;border-radius:9px;border:1px solid #384765;min-width:0;overflow:hidden;text-overflow:ellipsis}
.gl-import-paste .gl-import-status{color:#b9c4e0;font-size:11px;line-height:1.45}
@media(max-width:520px){.gl-import-paste .gl-import-fields{grid-template-columns:1fr}}
.nm615-preview-card{background:#19263f;border-radius:10px;padding:9px 10px;min-width:0;display:flex;flex-direction:column;gap:5px}
.nm615-preview-card b{font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nm615-preview-card small{font-size:10px;color:#b4c1de;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nm615-meter{height:5px;background:#344560;border-radius:5px;overflow:hidden}.nm615-meter span{height:100%;display:block;background:#9b82ff;border-radius:5px}
.nm615-style-tools{border:1px solid #354362;border-radius:13px;padding:12px;margin:12px 12px 17px;display:flex;flex-direction:column;gap:10px}
.nm615-style-tools[hidden]{display:none!important}
#inspector-sidebar,#inspector-sidebar *{scrollbar-color:#3e5287 #121e35;scrollbar-width:thin}
#inspector-sidebar::-webkit-scrollbar{width:9px}#inspector-sidebar::-webkit-scrollbar-thumb{background:#344e85;border-radius:12px}#inspector-sidebar::-webkit-scrollbar-track{background:#101a30}

/* Light map colors are painted by the renderer; tool panels keep light text. */
`;
document.head.append(nm615Styles);
const NM615={
  preferredCapacity(){return NM613.capacity()},
  clockwise(nodes,layout){return NeuroMapCore.visualOrder(nodes,layout);},
  updatePreview(root,name,modal){
    const cap=Number(modal.querySelector('#nm615-capacity').value)||125;
    const pages=NM613.split(root,cap),total=NM611.count(root),max=Math.max(...pages.map(p=>NM611.count(p)),1);
    modal.querySelector('#nm615-import-count').textContent=(document.documentElement.lang==='en'?`${total} nodes → ${pages.length} maps, up to ${cap} nodes each`:`${total} nodi → ${pages.length} mappe, massimo ${cap} nodi ciascuna`);
    const grid=modal.querySelector('#nm615-import-preview');grid.replaceChildren();
    // Lightweight overview; cap DOM work when importing tens of thousands of nodes.
    const preview=pages.slice(0,60);
    for(let i=0;i<preview.length;i++){
      const page=preview[i],nodes=NM611.count(page);
      const card=document.createElement('div');card.className='nm615-preview-card';
      const number=document.createElement('b');number.textContent=(i+1)+'. '+(page.text||name);
      const meter=document.createElement('div');meter.className='nm615-meter';
      const fill=document.createElement('span');fill.style.width=Math.round(nodes/max*100)+'%';meter.append(fill);
      const detail=document.createElement('small');detail.textContent=nodes+((globalThis.GlaukaI18n?.pair(" nodi"," nodes")??(document.documentElement.lang==='en'?' nodes':' nodi')))+' · '+(page.children||[]).slice(0,2).map(x=>x.text).join(', ').slice(0,76);
      card.append(number,meter,detail);grid.append(card);
    }
    if(pages.length>preview.length){const rest=document.createElement('p');rest.textContent=`+${pages.length-preview.length} ${(globalThis.GlaukaI18n?.pair("altre mappe","more maps")??(document.documentElement.lang==='en'?'more maps':'altre mappe'))}`;grid.append(rest);}
    return pages.length;
  },
  openBoundaryEditor(app){
    const node=app.state.findNode(app.state.selectedNodeId);
    if(!node||node===app.state.root){app.showToast('Seleziona un nodo da racchiudere','RECINTO');return;}
    let modal=document.getElementById('nm615-boundary-modal');
    if(!modal){modal=document.createElement('div');modal.id='nm615-boundary-modal';modal.className='nm615-shade';modal.innerHTML=`<section class="nm615-dialog" role="dialog" aria-modal="true" aria-labelledby="nm615-boundary-heading"><h2 id="nm615-boundary-heading">Etichetta del recinto</h2><p>Una breve descrizione apparirà appena sopra il contorno del ramo.</p><input id="nm615-boundary-input" maxlength="110" placeholder="Es. Argomenti da ripassare"/><div class="nm615-dialog-actions"><button data-nm615="cancel">Annulla</button><button data-nm615="remove">Rimuovi etichetta</button><button data-nm615="ok" class="nm615-primary">Salva etichetta</button></div></section>`;document.body.append(modal);}
    const input=modal.querySelector('input');input.value=node.boundary?.title||'';modal.classList.remove('hidden');input.focus();input.select();
    const finish=action=>{
      modal.classList.add('hidden');if(action==='cancel')return;
      app.state.pushHistory();node.boundary={...node.boundary,enabled:true,title:action==='remove'?'':input.value.trim(),color:node.boundary?.color||node.color||'#a855f7'};
      app.markChanged();app.showToast(action==='remove'?'Etichetta rimossa':'Recinto aggiornato','RECINTO');
    };
    modal.onclick=e=>{const action=e.target.closest('[data-nm615]')?.dataset.nm615;if(action)finish(action);else if(e.target===modal)finish('cancel');};
    input.onkeydown=e=>{if(e.key==='Escape')finish('cancel');if(e.key==='Enter')finish('ok');};
  },
  themeKey:'nm615.canvas.theme',
  setTheme(theme){
    const options=NeuroMapThemePicker.themes;
    const {color,light}=options[theme]||options.night;
    document.documentElement.style.setProperty('--bg-canvas',color);
    document.body.style.backgroundColor=color;
    document.body.classList.toggle('nm615-light',light);
    window.neuroMapApp?.requestRender();
    document.documentElement.dataset.nm615Theme=options[theme]?theme:'night';
    this.themePicker?.setValue(document.documentElement.dataset.nm615Theme);
    try{localStorage.setItem(this.themeKey,theme);}catch{}
    document.dispatchEvent(new CustomEvent('neuromap:canvas-theme'));
  }
};
window.NM615=NM615;
const nm615OriginalCapacity=NM613.capacity.bind(NM613);
NM613.capacity=function(){return this._nm615Size||nm615OriginalCapacity();};
// A missing locale must not make a provider's friendly model name a request identifier.
// Native AI provider returns stable ID as value; never silently convert or invent IDs.
const nm615OriginalTraversal=NeuroMapApp.prototype.nm612Traversal;
NeuroMapApp.prototype.nm612Traversal=function(level,mode){
  if(mode!=='visual')return nm615OriginalTraversal.call(this,level,mode);
  const nodes=nm615OriginalTraversal.call(this,level,'source');
  return NM615.clockwise(nodes,this.layout);
};
// Consistent modal for both Markdown files and huge text pasted via Ctrl/Cmd+V.
NeuroMapApp.prototype.nm611LargeImportChoice=async function(root,label='Documento'){
  const total=NM611.count(root);
  if(total<=NM613.capacity()&&NM613.split(root).length<=1)return 'one';
  return new Promise(resolve=>{
    let modal=document.getElementById('nm615-import-modal');
    if(!modal){
      modal=document.createElement('div');modal.id='nm615-import-modal';modal.className='nm615-shade';
      modal.innerHTML=`<section class="nm615-dialog nm615-import-dialog" role="dialog" aria-modal="true" aria-labelledby="nm615-import-title"><h2 id="nm615-import-title">Dimensione mappe grandi</h2><p id="nm615-import-description">Scegli la dimensione prima di creare le schede. Il contenuto resterà nell'ordine originale.</p><label for="nm615-capacity">Dimensione mappe grandi</label><select id="nm615-capacity"><option value="80">80 nodi · Dettagliata</option><option value="100">100 nodi · Compatta</option><option value="125">125 nodi · Equilibrata</option><option value="150">150 nodi · Estesa</option><option value="200">200 nodi · Ampia</option></select><div id="nm615-import-count" role="status"></div><div id="nm615-import-preview" aria-label="Anteprima mappe risultanti"></div><div class="nm615-dialog-actions"><button data-nm615="cancel">Annulla</button><button data-nm615="one">Una sola mappa</button><button data-nm615="split" class="nm615-primary">Crea le mappe</button></div></section>`;
      document.body.append(modal);
    }
    modal.classList.remove('hidden');const selector=modal.querySelector('select');selector.value=String(NM613.capacity());
    const recalc=()=>NM615.updatePreview(root,label,modal);recalc();
    selector.onchange=()=>{recalc();};selector.focus();
    const close=choice=>{modal.classList.add('hidden');if(choice==='split'){
        NM613._nm615Size=Number(selector.value);
        try{localStorage.setItem(NM613.capacityKey,selector.value);}catch{}
        const global=document.getElementById('nm613-import-size');if(global)global.value=selector.value;
      }resolve(choice);
    };
    modal.onclick=e=>{const btn=e.target.closest('[data-nm615]');if(btn)close(btn.dataset.nm615);};
    modal.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close('cancel');}};
  });
};

// Clipboard import studio: explicit single/multiple choice, compact per-map naming
// and a common layout setting. No map is changed until the user confirms.
NM615.pasteWizard=function(app,roots){
  const en=document.documentElement.lang==='en';
  const tr=(it,eng)=>en?eng:it;
  const modal=document.createElement('div');
  modal.className='nm615-shade';modal.id='gl-paste-studio';
  const panel=document.createElement('section');panel.className='nm615-dialog gl-import-paste';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','gl-import-heading');
  const heading=document.createElement('h2');heading.id='gl-import-heading';
  heading.textContent=tr('Crea mappe dagli appunti','Create maps from notes');
  const intro=document.createElement('p');intro.textContent=tr(
    'Scegli quante mappe creare, la disposizione comune e, se vuoi, rinomina una mappa alla volta.',
    'Choose the number of maps, shared layout and optional individual names.');
  const fields=document.createElement('div');fields.className='gl-import-fields';
  function makeField(id,caption,choices){
    const label=document.createElement('label');label.className='gl-import-field';
    const title=document.createElement('span');title.className='gl-import-caption';title.textContent=caption;
    const sel=document.createElement('select');sel.id=id;
    for(const [value,text] of choices){const option=document.createElement('option');option.value=value;option.textContent=text;sel.append(option);}
    label.append(title,sel);fields.append(label);return sel;
  }
  const mode=makeField('gl-import-mode',tr('Modalità','Mode'),[
    ['split',tr('Più mappe ordinate','Multiple ordered maps')],['one',tr('Una sola mappa','One map')]]);
  const capacity=makeField('gl-import-capacity',tr('Dimensione per mappa','Nodes per map'),[
    ['80','80'],['100','100'],['125','125'],['150','150'],['200','200']]);
  capacity.value=String(NM613.capacity());
  const layout=makeField('gl-import-layout',tr('Disposizione · per tutte','Layout · all maps'),[
    ['clockwise',tr('In senso orario','Clockwise')],
    ['balanced',tr('Bilanciata','Balanced')],
    ['right',tr('Verso destra','Right')],
    ['left',tr('Verso sinistra','Left')]]);
  layout.value='clockwise';
  const naming=document.createElement('div');naming.className='gl-import-name';
  const selectLabel=document.createElement('label');selectLabel.htmlFor='gl-import-map-select';
  selectLabel.textContent=tr('Rinomina una mappa (facoltativo)','Rename a map (optional)');
  const mapSelect=document.createElement('select');mapSelect.id='gl-import-map-select';
  const nameInput=document.createElement('input');nameInput.id='gl-import-map-name';nameInput.maxLength=120;
  nameInput.setAttribute('aria-label',tr('Nome della mappa selezionata','Selected map name'));
  naming.append(selectLabel,mapSelect,nameInput);
  const summary=document.createElement('div');summary.id='gl-import-summary';summary.setAttribute('role','status');
  const preview=document.createElement('div');preview.className='gl-import-preview';
  const info=document.createElement('p');info.className='gl-import-status';
  info.textContent=tr('La mappa attuale non viene modificata. Le schede nuove mantengono l’ordine del testo.',
                       'The current map remains unchanged. New tabs preserve the source order.');
  const actions=document.createElement('div');actions.className='nm615-dialog-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent=tr('Annulla','Cancel');
  const create=document.createElement('button');create.type='button';create.className='nm615-primary';
  create.textContent=tr('Crea mappe','Create maps');
  actions.append(cancel,create);panel.append(heading,intro,fields,naming,summary,preview,info,actions);modal.append(panel);
  document.body.append(modal);
  const names=new Map();let maps=[],active=0;
  const total=roots.reduce((sum,root)=>sum+NM611.count(root),0);
  function nameFor(item,i){return names.get(i)||String(item.text||tr('Mappa ','Map ')+(i+1)).slice(0,120);}
  function storeName(){
    const typed=nameInput.value.trim();
    if(!maps[active])return;
    // Empty input restores the automatically generated title.
    if(typed&&typed!==String(maps[active].text||''))names.set(active,typed);
    else names.delete(active);
  }
  function render(){
    const selected=Number(capacity.value)||125;
    maps=mode.value==='one'?
      [{text:tr('Appunti importati','Imported notes'),children:roots}]:
      roots.flatMap(root=>NM611.count(root)<=selected?[root]:NM613.split(root,selected));
    if(mode.value==='one'&&roots.length===1)maps=[roots[0]];
    if(maps.length>250){summary.textContent=tr('Troppi gruppi: aumenta la dimensione per mappa.','Too many maps: increase nodes per map.');create.disabled=true;}
    else if(mode.value==='one'&&total+(roots.length>1?1:0)>3500){
      summary.textContent=tr('Una mappa supera il limite di 3500 nodi: scegli più mappe.','One map exceeds the 3500-node limit: choose multiple maps.');
      create.disabled=true;
    }else{create.disabled=false;summary.textContent=total+' '+tr('nodi → ','nodes → ')+maps.length+' '+tr('mappe','maps');}
    mapSelect.replaceChildren();preview.replaceChildren();
    for(let i=0;i<maps.length;i++){
      const opt=document.createElement('option');opt.value=String(i);opt.textContent=(i+1)+'. '+nameFor(maps[i],i);
      mapSelect.append(opt);
      if(i<24){
        const item=document.createElement('div');item.textContent=(i+1)+'. '+nameFor(maps[i],i);
        item.title=item.textContent;preview.append(item);
      }
    }
    if(maps.length>24){
      const more=document.createElement('div');more.textContent='+'+(maps.length-24)+' '+tr('altre','more');preview.append(more);
    }
    active=Math.min(active,maps.length-1);mapSelect.value=String(Math.max(active,0));
    nameInput.value=maps.length?nameFor(maps[active],active):'';
    naming.hidden=!maps.length;
    create.textContent=tr('Crea ','Create ')+maps.length+' '+tr('mappe','maps');
  }
  mapSelect.onchange=()=>{storeName();active=Number(mapSelect.value);nameInput.value=nameFor(maps[active],active);};
  nameInput.oninput=()=>{
    if(!maps[active])return;
    const label=nameInput.value.trim()||String(maps[active].text||'');
    if(label===String(maps[active].text||''))names.delete(active);else names.set(active,label);
    mapSelect.options[active].textContent=(active+1)+'. '+label;
    const card=preview.children[active];if(card){card.textContent=(active+1)+'. '+label;card.title=card.textContent;}
  };
  mode.onchange=()=>{names.clear();active=0;render();};
  capacity.onchange=()=>{names.clear();active=0;render();};
  render();
  return new Promise(resolve=>{
    let done=false;
    const close=(result)=>{
      if(done)return;done=true;modal.remove();resolve(result);
    };
    cancel.onclick=()=>close(null);
    modal.onclick=e=>{if(e.target===modal)close(null);};
    modal.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close(null);}};
    create.onclick=()=>{
      if(create.disabled)return;
      storeName();
      close({mode:mode.value,capacity:Number(capacity.value),layout:layout.value,
        names:maps.map((root,i)=>nameFor(root,i)),pages:maps});
    };
    mode.focus();
  });
};
NM615.commitPastedMaps=function(app,plan){
  if(!plan||!Array.isArray(plan.pages)||!plan.pages.length)return 0;
  // All validation before creating the first tab.
  for(const root of plan.pages)if(NM611.count(root)>3500)throw Error('Mappa oltre 3500 nodi.');
  let count=0;
  for(let i=0;i<plan.pages.length;i++){
    const source=plan.pages[i];
    const name=String(plan.names[i]||source.text||'Mappa').trim().slice(0,120)||'Mappa';
    count+=app.importHierarchy({...source,text:name},{newTab:true});
    const tab=app.tabs.find(t=>t.id===app.activeTabId);
    if(!tab)throw Error('Scheda importata non trovata');
    const root=tab.state.root;
    root.layoutMode=plan.layout;
    root.layoutDistribution={
      ...(root.layoutDistribution||{height:960,minimumHeight:480,overflowMode:'expand'}),
      enabled:plan.layout==='clockwise'
    };
    if(plan.layout==='balanced')root.layoutBalanceMode='geometry';
    tab.title=name;root.text=name;tab.state.isDirty=true;
  }
  app.recalculateAndRender();app.renderTabBar();app.scheduleSave();
  return count;
};

// Default to closed Inspector sections. Native details remembers expansion while editing.
const nm615OldBind=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm615OldBind.apply(this,args);
  for(const details of document.querySelectorAll('.nm70-inspector-accordion'))details.open=false;
  const group=document.querySelector('#ctx-group-node .nm70-menu-group')||document.getElementById('ctx-group-node');
  if(group&&!document.getElementById('nm615-edit-boundary')){
    const button=document.createElement('button');button.type='button';button.id='nm615-edit-boundary';button.className='ctx-item';button.textContent='✎ Etichetta recinto…';
    (group.querySelector('.nm70-menu-items')||group).append(button);
    button.addEventListener('click',()=>{this.hideMenus();NM615.openBoundaryEditor(this);});
  }
  const sidebar=document.getElementById('inspector-sidebar');
  if(sidebar&&!document.getElementById('nm615-style-tools')){
    const block=document.createElement('section');block.id='nm615-style-tools';block.className='nm615-style-tools';
    block.hidden=true;
    block.innerHTML=`<button type="button" id="nm615-boundary-caption">✎ Etichetta recinto…</button>`;
    sidebar.insertBefore(block,sidebar.querySelector('.nm70-inspector-accordion'));
    block.querySelector('button').addEventListener('click',()=>NM615.openBoundaryEditor(this));
    const syncFence=()=>{
      const node=this.state?.findNode?.(this.state.selectedNodeId);
      block.hidden=!node?.boundary?.enabled;
    };
    syncFence();
  }
  if(!NM615.themePicker&&globalThis.NeuroMapThemePicker){
    NM615.themePicker=NeuroMapThemePicker.create({
      value:document.documentElement.dataset.nm615Theme||'night',
      onChange:theme=>NM615.setTheme(theme)
    });
    const canvas=document.getElementById('gl-format-map-canvas');
    if(canvas)canvas.append(NM615.themePicker.element);
    else {
      let park=document.getElementById('gl-appearance-park');
      if(!park){
        park=document.createElement('div');
        park.id='gl-appearance-park';
        park.hidden=true;
        document.body.append(park);
      }
      park.append(NM615.themePicker.element);
    }
  }
  return result;
};
// Language switching: menu strings, panels and newly injected controls are translated too.
Object.assign(NM_DICT,{
  'Etichetta recinto…':'Boundary label…','✎ Etichetta recinto…':'✎ Boundary label…',
  'Sfondo mappa':'Map background','Notte':'Night','Ardesia':'Slate','Blu oceano':'Ocean blue',
  'Carta chiara':'Light paper','Grigio perla':'Pearl gray',
  'Dimensione mappe grandi':'Large map size','Seleziona un ambito e poi usa carattere, colore, dimensione, allineamento o elenco.':'Choose a scope, then edit font, color, size, alignment or bullets.',
  'Ramo precedente':'Previous branch','Ramo successivo':'Next branch','Ordine visivo':'Visual order',
  'Salva tutte le schede':'Save all tabs','Applica le modifiche a':'Apply changes to',
  'Ricerca globale':'Global search','Ricerca modelli':'Find models','Livello':'Level','Sotto-rami':'Sub-branches',
  'Distribuzione':'Distribution','Recinto':'Boundary','Rinominare recinto':'Rename boundary',
  'Anteprima mappe risultanti':'Preview resulting maps', 'Solo scheda attiva':'Active tab only',
  'Nodi selezionati':'Selected nodes','Tutte le schede':'All tabs',
  'Inserisci nodo':'Insert node','Crea nuova mappa':'Create new map',
  'Salva come':'Save as','Apri scheda':'Open tab','Centra e adatta mappa':'Fit map to screen',
  'Contorno del ramo e dei sottorami':'Subtree boundary'
});
const nm615PreviousTranslation=window.nm6ApplyLanguage;
// nm6ApplyLanguage is assigned on DOMReady, so wrap it after shell creation.
window.addEventListener('DOMContentLoaded',()=>{
  const apply=window.nm6ApplyLanguage;
  if(typeof apply==='function'){
    window.nm6ApplyLanguage=(...args)=>{const result=apply(...args);nm6Translate();return result;};
  }
  try{NM615.setTheme(localStorage.getItem(NM615.themeKey)||'white');}catch{NM615.setTheme('white');}
});
/* end NeuroMap 6.15 */


