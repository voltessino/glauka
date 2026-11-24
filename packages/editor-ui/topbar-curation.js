/* v7 topbar clarity: move original controls, never duplicate or rebind actions.
 * Presentation-only; node structure, project serialization and shortcuts untouched.
 */
(function(root){
 'use strict';
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const find=id=>document.getElementById(id);
 const CSS=`
body.nm7-clear-topbar .tab-bar{gap:6px;min-width:0}
body.nm7-clear-topbar .brand-Mini{display:none!important}
body.nm7-clear-topbar .tab-bar #tabs-list{flex:1 1 180px;min-width:100px}
body.nm7-clear-topbar .topbar.nm-ribbon{gap:6px;align-items:center}
body.nm7-clear-topbar .toolbar-group{flex-wrap:nowrap;min-width:0;max-width:100%;gap:5px;position:relative;z-index:75}
/* Drop-downs belong above the status toolbar even when it wraps below the menu row. */
body.nm7-clear-topbar .nm-status-actions{position:relative;z-index:1}
body.nm7-clear-topbar .nm7-duplicate-action{display:none!important}
body.nm7-clear-topbar .toolbar-group .dropdown-panel{
 background:var(--nm-skin-surface,#132139);box-shadow:var(--nm-skin-shadow,0 16px 44px rgba(0,0,0,.24));
 max-height:min(75dvh,610px);overflow-y:auto;overscroll-behavior:contain;
}
body.nm7-clear-topbar .nm7-relocated{width:100%;min-height:38px;justify-content:flex-start;text-align:left}
body.nm7-clear-topbar #dropdown-view #nm616-zen-switch{
 background:transparent!important;border:1px solid transparent!important;
 color:var(--text-secondary,#e2e8f0);border-radius:8px!important;box-shadow:none!important;
}
body.nm7-clear-topbar #dropdown-view #nm616-zen-switch:is(:hover,:focus-visible){
 background:var(--bg-hover,rgba(51,65,85,.65))!important;
 border-color:rgba(165,180,252,.35)!important;
}
body.nm7-clear-topbar .nm7-relocated:focus-visible,
body.nm7-clear-topbar #btn-menu-help:focus-visible{outline:2px solid var(--nm-theme-focus,#b5a6ff);outline-offset:2px}
body.nm7-clear-topbar #dropdown-help{width:240px;min-width:200px;left:auto;right:0}
body.nm7-clear-topbar #dropdown-tools{width:260px;min-width:220px;left:auto;right:0}
body.nm7-clear-topbar .v4-toolstrip:empty{display:none!important}
body.nm7-clear-topbar .nm7-advanced-navigation{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:8px 3px;
 border-top:1px solid var(--nm-skin-stroke,#74869e);margin-top:6px}
body.nm7-clear-topbar .nm7-nav-label{font:650 11px/1.5 system-ui;color:var(--nm-skin-muted,#b8c5d9);width:100%}
body.nm7-clear-topbar .nm7-advanced-navigation :is(select,button){min-height:35px}
body.nm7-clear-topbar .nm7-advanced-navigation :is(.nm69-nav-level,.nm612-nav-order){max-width:200px;min-width:0}
@media(max-width:1100px){
 body.nm7-clear-topbar .tab-bar{padding:5px 8px}
 body.nm7-clear-topbar .brand-name{max-width:126px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 body.nm7-clear-topbar .topbar.nm-ribbon{align-items:stretch}
 body.nm7-clear-topbar .toolbar-group{overflow:visible}
 body.nm7-clear-topbar .nm-status-actions{min-width:0}
}
@media(max-width:700px){
 body.nm7-clear-topbar .nm-status-actions{width:100%;min-width:0;justify-content:flex-start}
 body.nm7-clear-topbar .status-pill{min-width:0;max-width:min(280px,calc(100vw - 125px));overflow:hidden;white-space:nowrap}
 body.nm7-clear-topbar .status-pill>span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 body.nm7-clear-topbar #status-selected-node{display:inline-block;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
 body.nm7-clear-topbar .status-pill>span:last-child{display:none}
 body.nm7-clear-topbar #status-selected-side{display:none}
 body.nm7-clear-topbar .brand-name{display:none}
 body.nm7-clear-topbar .tab-bar .tab-action-btn{white-space:nowrap}
 body.nm7-clear-topbar .toolbar-group{flex-wrap:wrap}
 body.nm7-clear-topbar .dropdown-panel{max-width:calc(100vw - 20px)}
 body.nm7-clear-topbar #dropdown-help,body.nm7-clear-topbar #dropdown-tools{right:auto;left:0}
}
@media(prefers-reduced-motion:reduce){
 body.nm7-clear-topbar :is(.tab-action-btn,.dropdown-item,#btn-menu-help){transition:none!important}
}
`;
 function relocate(id,target,afterId){
  const node=find(id),host=find(target);
  if(!node||!host)return false;
  if(afterId&&find(afterId)?.parentElement===host)find(afterId).after(node);
  else host.append(node);
  node.classList.remove('tab-action-btn','v4-tool-btn','btn-micro-icon');
  node.classList.add('dropdown-item','nm7-relocated','nm6-skiptranslate');
  if(!node.dataset.nm7MenuBound){
   node.dataset.nm7MenuBound='1';
   node.addEventListener('click',()=>root.neuroMapApp?.hideMenus?.());
  }
  return true;
 }
 function hideRedundant(){
  const clipboard=document.querySelector('.clipboard-tools');
  if(clipboard){
   clipboard.classList.add('nm7-duplicate-action');
   for(const neighbor of [clipboard.previousElementSibling,clipboard.nextElementSibling])
    if(neighbor?.classList.contains('divider-v'))
     neighbor.classList.add('nm7-duplicate-action');
  }
  for(const id of ['quick-icon-invert','quick-icon-center'])
   find(id)?.classList.add('nm7-duplicate-action');
  // The same operations remain in File/Edit/View and the keyboard shortcuts.
 }
 function navigation(){
  const details=find('nm616-nav-disclosure');
  const panel=find('nm614-navigation-flyout')||details?.querySelector('.nm616-nav-card');
  if(!panel)return;
  let group=find('nm7-advanced-navigation');
  if(!group){
   group=document.createElement('div');group.id='nm7-advanced-navigation';
   group.className='nm7-advanced-navigation nm6-skiptranslate';
   const label=document.createElement('strong');label.id='nm7-nav-advanced-caption';
   label.className='nm7-nav-label';group.append(label);
  }
  if(group.parentElement!==panel)panel.append(group);
  for(const id of ['nm67-prev-main','nm67-next-main','nm69-nav-level','nm612-nav-order']){
   const element=find(id);
   const control=element?.closest?.('label')||element;
   if(control&&control.parentElement!==group)group.append(control);
  }
 }
 function labels(){
  const help=find('btn-menu-help'),submenu=find('dropdown-help'),tools=find('btn-menu-tools');
  if(tools){tools.textContent=tr('Strumenti','Tools');
   tools.setAttribute('aria-label',tr('Studio, risorse e intelligenza artificiale','Study, assets and AI'));}
  const toolMenu=find('dropdown-tools');
  if(toolMenu)toolMenu.setAttribute('aria-label',tr('Studio, risorse e intelligenza artificiale','Study, assets and AI'));
  const toolsTitle=toolMenu?.querySelector('.dropdown-section-title');
  if(toolsTitle)toolsTitle.textContent=tr('Studio e risorse','Study and assets');
  if(help){help.textContent=tr('Aiuto','Help');help.setAttribute('aria-label',tr('Guida e scorciatoie','Help and keyboard shortcuts'));}
  if(submenu)submenu.setAttribute('aria-label',tr('Guida e scorciatoie','Help and keyboard shortcuts'));
  const duplicate=find('btn-duplicate-tab'),fullscreen=find('btn-fullscreen'),zen=find('nm616-zen-switch');
  if(duplicate){const dupLabel=tr('Duplica scheda','Duplicate tab');let sp=duplicate.querySelector?.('span');if(!sp&&typeof document.createElement==='function'&&typeof duplicate.replaceChildren==='function'){sp=document.createElement('span');const icons=typeof duplicate.querySelectorAll==='function'?[...duplicate.querySelectorAll(':scope>svg.nm-semantic-menu-icon')]:[];duplicate.replaceChildren(...icons,sp);}if(sp){if(sp.textContent!==dupLabel)sp.textContent=dupLabel;}else duplicate.textContent=dupLabel;duplicate.title=dupLabel;}
  if(fullscreen){fullscreen.textContent=tr('Schermo intero','Full screen');fullscreen.title=fullscreen.textContent;fullscreen.setAttribute('aria-label',fullscreen.title);}
  if(zen){zen.textContent=tr('◈ Modalità Zen','◈ Zen mode');zen.title=tr('Modalità concentrazione senza distrazioni','Distraction-free focus mode');zen.setAttribute('aria-label',zen.title);}
  if(submenu){
   let about=find('nm-about-open');
   if(!about){about=document.createElement('button');about.id='nm-about-open';about.type='button';about.className='dropdown-item nm6-skiptranslate';submenu.append(about);
    about.addEventListener('click',()=>{root.neuroMapApp?.hideMenus?.();const data=document.documentElement.dataset;root.neuroMapApp?.nmAsk?.({title:tr('Informazioni su Glauka','About Glauka'),message:tr('Versione: ','Version: ')+(data.neuromapVersion||'workspace')+' · '+tr('Build: ','Build: ')+(data.neuromapBuild||'workspace').slice(0,8),choices:[{value:'close',text:tr('Chiudi','Close')}]})});}
   about.textContent=tr('Informazioni su Glauka…','About Glauka…');
  }
  const helpTitle=submenu?.querySelector('.dropdown-section-title');
  if(helpTitle)helpTitle.textContent=tr('Per iniziare','Getting started');
  const caption=find('nm7-nav-advanced-caption');
  if(caption)caption.textContent=tr('Livello e percorso','Level and order');
 }
 function clampOpenMenus(){
  if(!Number.isFinite(root.innerWidth))return;
  const width=root.innerWidth;
  for(const panel of document.querySelectorAll('.toolbar-group .dropdown-panel')){
   if(panel.classList.contains('hidden')||typeof panel.getBoundingClientRect!=='function')continue;
   panel.style.transform='none';
   const bounds=panel.getBoundingClientRect();
   let delta=bounds.left<8?8-bounds.left:0;
   if(bounds.right+delta>width-8)delta+=width-8-(bounds.right+delta);
   if(Math.abs(delta)>0.5)panel.style.transform='translateX('+Math.round(delta)+'px)';
  }
 }

 // Browser-inspired first row. Move the ORIGINAL buttons, never clones:
 // shortcut listeners and existing modal handlers keep working.
 const icons={
  search:'<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15.3 15.3 4.4 4.4"/>',
  command:'<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  cloud:'<path d="M7 18.5h10.1a4.4 4.4 0 0 0 .35-8.8 6.25 6.25 0 0 0-11.8 1.5A3.8 3.8 0 0 0 7 18.5Z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>'
 };
 function pictogram(icon){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[icon]+'</svg>';
 }
 function browserChrome(){
  const bar=document.querySelector('.tab-bar'),tabs=find('tabs-list'),plus=find('btn-new-tab');
  if(!bar||!tabs||!plus)return;
  if(!find('gl-chrome-utilities')){
   const utilities=document.createElement('div');
   utilities.id='gl-chrome-utilities';utilities.className='gl-chrome-utilities nm6-skiptranslate';
   plus.after(utilities);
  }
  const utilities=find('gl-chrome-utilities');
  const home=find('nm-home-open'),brand=document.querySelector('.tab-bar .brand-Mini');
  if(home&&brand&&home.parentElement!==brand){
   const logo=brand.querySelector('.brand-icon');
   home.classList.add('gl-chrome-home');home.classList.remove('nm6-mini');
   home.textContent='';if(logo)home.append(logo);
   home.title=tr('Home · inizia o apri una mappa','Home · create or open a map');
   home.setAttribute('aria-label',home.title);
   brand.prepend(home);
  }
  const parts=[
   ['nm-orbit-command-trigger','command','Comandi rapidi · Ctrl+Maiusc+P','Quick commands · Ctrl+Shift+P'],
   ['gl-history-quick','history','Cronologia versioni','Version history'],
   ['gl-cloud-quick','cloud','Account cloud','Cloud accounts'],
   ['gl-settings-quick','settings','Impostazioni','Settings'],
   ['glauka-save-indicator',null,'Stato del recupero automatico','Automatic recovery status']
  ];
  for(const [id,ico,it,en] of parts){
   const node=find(id);if(!node)continue;
   if(node.parentElement!==utilities)utilities.append(node);
   node.classList.add('gl-chrome-icon-btn');
   if(ico&&!node.querySelector('svg'))node.innerHTML=pictogram(ico);
   if(ico){node.title=tr(it,en);node.setAttribute('aria-label',node.title)}
   else node.setAttribute('data-gl-chrome-status','');
  }
  let more=find('gl-chrome-more');
  if(!more){
   more=document.createElement('details');more.id='gl-chrome-more';
   more.className='gl-chrome-more';
   const summary=document.createElement('summary');summary.title=tr('Altre opzioni','More options');
   summary.setAttribute('aria-label',summary.title);summary.textContent='⋯';
   const body=document.createElement('div');body.className='gl-chrome-more-menu';
   more.append(summary,body);
   more.addEventListener('keydown',e=>{if(e.key==='Escape'){more.open=false;summary.focus()}});
   if(typeof document.addEventListener==='function')
    document.addEventListener('click',e=>{if(more.open&&!more.contains(e.target))more.open=false});
   utilities.append(more);
  }else if(more.parentElement!==utilities)utilities.append(more);
  const plan=find('nm6-plan-button');
  if(plan){
   const menu=more.querySelector('.gl-chrome-more-menu');
   if(plan.parentElement!==menu){
    plan.classList.add('gl-chrome-menu-action');plan.classList.remove('nm6-mini');
    menu.append(plan);
   }
  }
  // Stable action order regardless of whether command, recovery, history
  // or cloud mounts first. Reorder only when needed to prevent observer loops.
  const ordered=[...parts.map(([id])=>find(id)).filter(Boolean),more];
  for(let i=ordered.length-2;i>=0;i--){
   const current=ordered[i],next=ordered[i+1];
   if(current.parentElement!==utilities||current.nextElementSibling!==next)
    utilities.insertBefore(current,next);
  }
  if(more.nextElementSibling)utilities.append(more);
  document.body.classList.add('gl-browser-chrome');
 }
 function curate(){
  if(!find('dropdown-file')||!find('dropdown-view')||!find('dropdown-tools')||!find('dropdown-help'))return;
  if(!find('nm7-topbar-clarity-css')){
   const style=document.createElement('style');style.id='nm7-topbar-clarity-css';
   style.textContent=CSS;document.head.append(style);
  }
  relocate('btn-duplicate-tab','dropdown-file','menu-new-tab');
  relocate('nm616-zen-switch','dropdown-view','menu-reset-zoom');
  relocate('btn-fullscreen','dropdown-view','nm616-zen-switch');
  for(const id of ['btn-flashcards'])
   relocate(id,'dropdown-tools');
  relocate('btn-shortcuts','dropdown-help');
  relocate('nm7-guide-open','dropdown-help');
  hideRedundant();navigation();labels();
  document.body.classList.add('nm7-clear-topbar');
  browserChrome();
 }
 function install(App){
  if(!App?.prototype?.bindUI)return;
  const previous=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){
   const result=previous.apply(this,args);curate();return result;
  };
  if(typeof document.addEventListener==='function'){
   // App opens dropdowns on the same bubbling event; correct viewport overflow
   // afterwards rather than relying on fixed widths at narrow window sizes.
   document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-dropdown-target]'))clampOpenMenus();
   });
  }
  if(typeof root.addEventListener==='function')
   root.addEventListener('resize',clampOpenMenus);
  if(typeof root.MutationObserver==='function'){
   // Other desktop modules mount clock/cloud/recovery after bindUI. Watch
   // new children and put them into the stable utility group exactly once.
   const tabBar=document.querySelector('.tab-bar');
   if(tabBar){
     const chromeObserver=new root.MutationObserver(()=>browserChrome());
     chromeObserver.observe(tabBar,{childList:true,subtree:true});
   }
   const observer=new root.MutationObserver(()=>{labels();browserChrome()});
   observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
   for(const [id,buttonId] of [['dropdown-help','btn-menu-help'],
     ['dropdown-tools','btn-menu-tools']]){
    const dropdown=find(id),button=find(buttonId);
    if(dropdown&&button){
     new root.MutationObserver(()=>button.setAttribute('aria-expanded',
      String(!dropdown.classList.contains('hidden'))))
      .observe(dropdown,{attributes:true,attributeFilter:['class']});
    }
   }
  }
 }
 root.NeuroMapTopbarCuration=Object.freeze({install,curate});
})(globalThis);
