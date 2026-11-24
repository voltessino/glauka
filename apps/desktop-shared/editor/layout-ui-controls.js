/* ================== NeuroMap 6.11 — scoped editor, safe defaults, compact UI ================== */
const NM70_GAP_STORAGE='neuromap.default.branchGapX.v6.11';
function nm70PreferredGap(){try{const n=Number(localStorage.getItem(NM70_GAP_STORAGE));return Number.isFinite(n)&&n>=30&&n<=220?n:30}catch{return 30}}
function nm70OrganizeControls(){
  const sidebar=document.getElementById('inspector-sidebar');
  const sections=[...sidebar.querySelectorAll(':scope > .inspector-section')];
  if(sections.length<2)return;
  const node=sections[0],global=sections[1];
  const accordion=(title,open=true)=>{
    const el=document.createElement('details');el.className='nm70-inspector-accordion';el.open=open;
    const head=document.createElement('summary');head.innerHTML='<span></span><span>›</span>';
    head.firstChild.textContent=title;
    const body=document.createElement('div');body.className='nm70-inspector-body';
    el.append(head,body);return {el,body};
  };
  const type=accordion('Aa  Testo e colore',true),paint=accordion('◈  Colori e palette',false);
  const hierarchy=accordion('◉  Dimensioni del testo',false),connections=accordion('〰  Rami e collegamenti',true);
  // Move existing nodes, preserving bound IDs and their listeners.
  const colorRow=[...node.children].find(el=>el.classList?.contains('inspector-control-row')&&el.textContent.includes('Colore Ramo'));
  const colorNodes=[colorRow,document.getElementById('inspector-swatch-grid'),node.querySelector('.custom-color-row')].filter(Boolean);
  for(const el of colorNodes)paint.body.append(el);
  type.body.append(node);
  const stroke=global.querySelector('#nm54-style-grid')?.closest('.nm54-control');
  const typography=global.querySelector('#v6-preset-wrap');
  const v6default=global.querySelector('.v6-default-row');
  const scale=document.getElementById('v5-font-scale');
  const scaleHeader=scale?.previousElementSibling;
  const scaleHint=scale?.nextElementSibling;
  const reset=global.querySelector('#v5-reset-map-fonts');
  for(const el of [typography,v6default,scaleHeader,scale,scaleHint,reset].filter(Boolean))hierarchy.body.append(el);
  if(stroke)connections.body.append(stroke);
  const theme=global.querySelector('.theme-grid');
  const themeHeader=theme?.previousElementSibling;
  for(const el of [themeHeader,theme].filter(Boolean))paint.body.append(el);
  // Remove old section and redundant labels and present organized accordions.
  const at=global.parentNode;
  sidebar.insertBefore(type.el,global);
  sidebar.insertBefore(hierarchy.el,global);
  sidebar.insertBefore(connections.el,global);
  sidebar.insertBefore(paint.el,global);
  global.remove();
  // Compact node context menu into accessible expandable groups.
  const menu=document.getElementById('ctx-group-node');
  if(menu){
    const all=[...menu.children];const nodes=new Map(all.filter(el=>el.id).map(el=>[el.id,el]));
    const groups=[
      ['＋  Nodo e contenuti',['ctx-add-child','ctx-add-sibling','ctx-edit-text','ctx-add-image','ctx-iconify-search','nm62-ctx-markers','nm67-notes-context']],
      ['✦  Assistente AI',['btn-ai-expand','btn-ai-explain','btn-ai-audit','v5-ctx-google-ai','v5-ctx-google-images']],
      ['▧  Struttura e disposizione',['ctx-toggle-boundary','ctx-add-summary','ctx-invert-branch','nm70-invert-all','ctx-toggle-collapse']],
      ['✂  Appunti e operazioni',['ctx-cut','ctx-copy','ctx-paste']]
    ];
    for(const [label,ids] of groups){
      const d=document.createElement('details');d.className='nm70-menu-group';d.open=label.startsWith('＋');
      const h=document.createElement('summary');h.textContent=label;d.append(h);
      const box=document.createElement('div');box.className='nm70-menu-items';
      for(const id of ids){const n=nodes.get(id);if(n)box.append(n)}
      d.append(box);menu.append(d);
    }
    [...menu.children].filter(x=>x.classList.contains('dropdown-divider')).forEach(x=>x.remove());
    const del=nodes.get('ctx-delete-node');if(del)menu.append(del);
  }
}
const nm70OriginalNewState=NeuroMapApp.prototype.newState;
NeuroMapApp.prototype.newState=function(...args){
  const state=nm70OriginalNewState.apply(this,args);
  state.branchGapX=nm70PreferredGap();
  return state;
};
NeuroMapApp.prototype.nm70ScopeNodes=function(){
  const root=this.state.root,mode=document.getElementById('nm70-style-scope')?.value||'selection';
  const ids=[...new Set((this.state.selectedNodeIds?.length?this.state.selectedNodeIds:[this.state.selectedNodeId]).filter(Boolean))];
  const picked=ids.map(id=>this.state.findNode(id)).filter(Boolean);
  const all=[];const levels=new Map();const visit=(n,depth)=>{if(!n)return;all.push(n);if(!levels.has(depth))levels.set(depth,[]);levels.get(depth).push(n);for(const child of n.children||[])visit(child,depth+1)};
  visit(root,0);
  if(mode==='map')return all;
  if(mode.startsWith('level'))return levels.get(Number(mode.slice(5)))||[];
  if(mode==='selection')return picked;
  const set=new Set(),out=[];
  const recursive=(n,include)=>{if(!n||set.has(n.id))return;set.add(n.id);if(include)out.push(n);for(const ch of n.children||[])recursive(ch,true)};
  for(const n of picked)recursive(n,mode==='subtree');
  return out;
};
NeuroMapApp.prototype.nm70UpdateScopeUI=function(){
  const nodes=this.nm70ScopeNodes();
  const label=document.getElementById('nm70-target-count');if(label){label.dataset.nm70Count=String(nodes.length);label.textContent=nodes.length+(document.documentElement.lang==='en'?(nodes.length===1?' node':' nodes'):(nodes.length===1?' nodo':' nodi'));}
  const italic=document.getElementById('nm70-italic');if(italic)italic.setAttribute('aria-pressed',String(nodes.length>0&&nodes.every(n=>!!n.fontItalic)));
  const node=nodes.length===1?nodes[0]:null;
  if(node){
    document.getElementById('btn-weight-bold')?.classList.toggle('active',(node.fontWeight??400)>=650);
    document.getElementById('btn-weight-normal')?.classList.toggle('active',(node.fontWeight??400)<650);
  }
  const gap=document.getElementById('nm70-gap-current-default');if(gap)gap.textContent=((globalThis.GlaukaI18n?.pair("Predefinito: ","Default: ")??(document.documentElement.lang==='en'?'Default: ':'Predefinito: ')))+nm70PreferredGap()+' px';
};
NeuroMapApp.prototype.nm70BatchStyle=function(label,fn){
  const nodes=this.nm70ScopeNodes();
  if(!nodes.length){this.showToast('Nessun nodo nell’ambito selezionato','STILE');return false;}
  this.state.pushHistory();
  for(const node of nodes)fn(node);
  this.markChanged();this.nm70UpdateScopeUI();
  this.showToast(label+' · '+nodes.length+' nodo/i · Ctrl+Z','STILE');
  return true;
};
NeuroMapApp.prototype.nm70InvertAll=function(){
  const selected=this.nm70ScopeNodes();const seen=new Set(),targets=[];
  const walk=n=>{if(!n||seen.has(n.id))return;seen.add(n.id);if(n.children?.length>1)targets.push(n);for(const c of n.children||[])walk(c)};
  for(const n of selected)walk(n);
  if(!targets.length){this.showToast('Nessun sotto-ramo invertibile','ORDINE');return;}
  this.state.pushHistory();
  for(const n of targets){n.children.reverse();this.state.normalizeChildrenOrder(n)}
  this.markChanged();this.hideMenus();this.showToast('Invertiti '+targets.length+' gruppi di sotto-rami','ORDINE');
};
const nm70OldBind=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm70OldBind.apply(this,args);
  const scope=document.getElementById('nm70-style-scope');
  scope?.addEventListener('change',()=>this.nm70UpdateScopeUI());
  document.getElementById('nm70-italic')?.addEventListener('click',()=>{
    const nodes=this.nm70ScopeNodes();const next=!nodes.every(n=>!!n.fontItalic);
    this.nm70BatchStyle(next?'Corsivo attivato':'Corsivo disattivato',n=>{n.fontItalic=next});
  });
  document.getElementById('nm70-gap-save')?.addEventListener('click',()=>{
    const val=nm68ClampGap(this.state.branchGapX);
    try{localStorage.setItem(NM70_GAP_STORAGE,String(val));this.showToast('Spazio '+val+' px salvato come predefinito per le nuove mappe','LAYOUT');this.nm70UpdateScopeUI()}
    catch{this.showToast('Impossibile salvare il predefinito su questo dispositivo','ERRORE')}
  });
  document.getElementById('nm70-invert-all')?.addEventListener('click',e=>{e.stopPropagation();this.nm70InvertAll()});
  // Capture before older node-only handlers; no duplicate history or accidental propagation.
  if(!document.documentElement.dataset.nm70Styled){
    document.documentElement.dataset.nm70Styled='1';
    const styles=[
      ['btn-weight-normal','click','Normale',n=>n.fontWeight=400],
      ['btn-weight-bold','click','Grassetto',n=>n.fontWeight=700],
      ['inspector-fontsize-slider','input',null,null],
      ['inspector-fontsize-slider','change','Dimensione', (n,e)=>n.fontSize=Math.max(9,Math.min(48,Number(e.target.value)))],
      ['nm54-wrap-slider','change','Testo a capo',(n,e)=>n.labelWrapChars=Math.max(8,Math.min(60,Number(e.target.value)))],
      ['nm68-text-indent','change','Rientro',(n,e)=>n.labelIndent=Math.max(0,Math.min(45,Number(e.target.value)))],
      ['inspector-color-picker','change','Colore',(n,e)=>n.color=e.target.value],
      ['v5-font-reset','click','Dimensioni automatiche',n=>n.fontSize=null]
    ];
    document.addEventListener('input',e=>{
      if(e.target.id!=='inspector-fontsize-slider')return;
      e.stopImmediatePropagation();
      document.getElementById('inspector-fontsize-val').textContent=e.target.value+'px';
    },true);
    document.addEventListener('change',e=>{
      const rule=styles.find(x=>x[0]===e.target.id&&x[1]==='change');
      if(!rule)return;e.stopImmediatePropagation();
      window.neuroMapApp?.nm70BatchStyle(rule[2],n=>rule[3](n,e));
    },true);
    document.addEventListener('click',e=>{
      const app=window.neuroMapApp;if(!app)return;
      const id=e.target.closest('[id]')?.id;
      const rule=styles.find(x=>x[0]===id&&x[1]==='click');
      if(rule){e.preventDefault();e.stopImmediatePropagation();app.nm70BatchStyle(rule[2],n=>rule[3](n,e));return;}
      const align=e.target.closest('[data-nm68-align]');if(align){e.preventDefault();e.stopImmediatePropagation();app.nm70BatchStyle('Allineamento',n=>n.labelAlign=align.dataset.nm68Align);return;}
      const sw=e.target.closest('#inspector-swatch-grid .color-swatch');if(sw){e.preventDefault();e.stopImmediatePropagation();app.nm70BatchStyle('Colore',n=>n.color=sw.dataset.color||sw.style.backgroundColor);return;}
      if(e.target.closest('#nm68-bullets')){
        e.preventDefault();e.stopImmediatePropagation();
        const nodes=app.nm70ScopeNodes();const all=nodes.every(n=>String(n.text||'').split(/\r?\n/).every(t=>!t.trim()||/^\s*[•●]\s/.test(t)));
        app.nm70BatchStyle('Elenco puntato',n=>{n.text=String(n.text||'').split(/\r?\n/).map(t=>all?t.replace(/^\s*[•●]\s/,''):t.trim()?(/^[ \t]*[•●]\s/.test(t)?t:'• '+t):t).join('\n')});return;
      }
    },true);
  }
  this.nm70UpdateScopeUI();
  return result;
};
const nm70Status=NeuroMapApp.prototype.updateStatus;
NeuroMapApp.prototype.updateStatus=function(...args){const out=nm70Status.apply(this,args);this.nm70UpdateScopeUI?.();return out};

// Independent localized labels for the new controls, aligned to the existing IT/EN toggle.
const NM70_EN_SCOPE={
  selection:'Selected node(s)',subtree:'Node and all descendants',descendants:'Descendants only',
  map:'Every node in this map',
  level1:'All nodes · Level 1',level2:'All nodes · Level 2',level3:'All nodes · Level 3',
  level4:'All nodes · Level 4',level5:'All nodes · Level 5',level6:'All nodes · Level 6',
  level7:'All nodes · Level 7',level8:'All nodes · Level 8'
};
function nm70Translate(language){
  const en=(language||document.documentElement.lang)==='en';
  const label=(selector,it,eng)=>{const el=document.querySelector(selector);if(el)el.textContent=en?eng:it};
  label('#nm70-scope-panel label span','✦ Applica le modifiche a','✦ Apply changes to');
  label('#nm70-scope-panel > p','Seleziona l’ambito e poi usa carattere, colore, dimensione, allineamento o elenco.','Select a target group, then change its font, color, size, alignment or bullets.');
  const options=document.getElementById('nm70-style-scope')?.options;
  if(options)for(const opt of options){
    if(!opt.dataset.nm70It)opt.dataset.nm70It=opt.textContent;
    opt.textContent=en?(NM70_EN_SCOPE[opt.value]||opt.dataset.nm70It):opt.dataset.nm70It;
  }
  const sectionLabels=[
    ['Aa  Testo e colore','Aa  Text and color'],
    ['◉  Dimensioni del testo','◉  Text sizes'],
    ['〰  Rami e collegamenti','〰  Branches & connectors'],
    ['◈  Colori e palette','◈  Colors & palettes']
  ];
  for(const el of document.querySelectorAll('.nm70-inspector-accordion>summary>span:first-child')){
    if(!el.dataset.nm70It)el.dataset.nm70It=el.textContent;
    el.textContent=en?(sectionLabels.find(x=>x[0]===el.dataset.nm70It)?.[1]||el.dataset.nm70It):el.dataset.nm70It;
  }
  const menus=[
    ['＋  Nodo e contenuti','＋  Node & content'],['✦  Assistente AI','✦  AI assistant'],
    ['▧  Struttura e disposizione','▧  Structure & layout'],['✂  Appunti e operazioni','✂  Clipboard & actions']
  ];
  for(const el of document.querySelectorAll('.nm70-menu-group>summary')){
    if(!el.dataset.nm70It)el.dataset.nm70It=el.textContent;
    el.textContent=en?(menus.find(x=>x[0]===el.dataset.nm70It)?.[1]||el.dataset.nm70It):el.dataset.nm70It;
  }
  label('#nm70-italic', 'I Corsivo','I Italic'); // style restored below
  const italic=document.getElementById('nm70-italic');if(italic){
    italic.replaceChildren();const i=document.createElement('em');i.textContent='I';italic.append(i);italic.title=(globalThis.GlaukaI18n?.pair("Corsivo","Italic")??(en?'Italic':'Corsivo'));italic.setAttribute('aria-label',italic.title);
  }
  label('#nm70-font-hint','Testo normale per impostazione iniziale','Normal weight by default');
  label('#nm70-gap-save','☆ Salva spazio come predefinito','☆ Save spacing as default');
  label('#nm70-invert-all','⇄ Inverti tutti i sottorami (ogni livello)','⇄ Reverse all descendants (every depth)');
  label('#ctx-invert-branch','↔ Inverti figli diretti','↔ Reverse immediate children');
  label('.nm70-gap-prefs small:last-child','Il cursore cambia la scheda attiva; il pulsante salva la preferenza per le nuove mappe.','The slider changes this tab; the button saves a preference for future maps.');
  const count=document.getElementById('nm70-target-count');if(count&&count.dataset.nm70Count){count.textContent=count.dataset.nm70Count+((globalThis.GlaukaI18n?.pair(" nodi"," nodes")??(en?' nodes':' nodi')))}
  const saved=document.getElementById('nm70-gap-current-default');if(saved)saved.textContent=((globalThis.GlaukaI18n?.pair("Predefinito: ","Default: ")??(en?'Default: ':'Predefinito: ')))+nm70PreferredGap()+' px';
}
const nm70InitLocalization=()=>{
  const orig=window.nm6ApplyLanguage;
  if(typeof orig==='function' && !orig.nm70Wrapped){
    window.nm6ApplyLanguage=(...args)=>{const ret=orig(...args);nm70Translate();return ret};
    window.nm6ApplyLanguage.nm70Wrapped=true;
  }
  nm70Translate();
};
/* ================== END NeuroMap 6.11 ================== */


