/* NeuroMap Orbit universal desktop/Web workspace (Windows, macOS and desktop browser).
 * UI-only opt-in visual layer + accessible command deck. Never edits user content.
 */
(function(root){
  'use strict';
  const core=root.NeuroMapOrbitCore;
  if(!core)return;
  const STYLE=/* @neuromap-orbit-desktop-styles */ "";
  const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
  let state;
  // Never infer whether a previously saved cyan accent was selected by the
  // user or supplied by an earlier default. Preserving a stored choice is
  // safer than silently replacing it. Fresh profiles default to 'auto'.
  try{state=core.read(root.localStorage?.getItem(core.STORAGE_KEY))}
  catch{state=core.read(null)}
  let currentApp=null,modalOpen=false,previousFocus=null,results=[],selected=0;
  const get=id=>document.getElementById(id);
  function save(){
    try{root.localStorage?.setItem(core.STORAGE_KEY,JSON.stringify(state))}catch{}
  }
  function setSettings(value={}){
    state=core.read({...state,...value});
    save();apply();
    return {...state};
  }
  function apply(){
    document.body.classList.toggle('nm-orbit-workspace',state.enabled);
    document.body.dataset.nmOrbitAccent=state.accent;
    document.body.dataset.nmOrbitDensity=state.density;
    // Orbit is selected only in the existing Interface themes picker.
    const active=state.enabled;
    const details=get('nm-orbit-desktop-settings');
    if(details)details.hidden=!active;
    const title=get('nm-orbit-desktop-title'),description=get('nm-orbit-desktop-description');
    if(title)title.textContent=tr('Finiture del tema','Theme details');
    if(description)description.textContent=tr(
      'L’accento cambia i colori dei comandi; la spaziatura cambia la densità dei pannelli. Non modifica la mappa.',
      'Accent changes control colors; spacing changes panel density. Your map is not modified.');
    const color=get('nm-orbit-desktop-accent'),density=get('nm-orbit-desktop-density');
    if(color){
      color.value=state.accent;color.disabled=!active;
      color.setAttribute('aria-label',tr('Accento del tema','Theme accent color'));
      [...color.options].forEach((option,i)=>option.textContent=tr(['Segui il tema','Ciano elettrico','Viola aurora','Ambra solare'][i],['Follow theme','Electric cyan','Aurora violet','Solar amber'][i]));
    }
    if(density){
      density.value=state.density;density.disabled=!active;
      density.setAttribute('aria-label',tr('Spaziatura dei comandi','Control spacing'));
      [...density.options].forEach((option,i)=>option.textContent=tr(['Spaziosa','Compatta'][i],['Comfortable','Compact'][i]));
    }
    const colorLabel=get('nm-orbit-desktop-accent-label'),densityLabel=get('nm-orbit-desktop-density-label');
    if(colorLabel)colorLabel.textContent=tr('Accento','Accent');
    if(densityLabel)densityLabel.textContent=tr('Spaziatura','Spacing');
    const shortcut=get('nm-orbit-desktop-shortcut');
    if(shortcut)shortcut.textContent=tr('Comandi rapidi: Ctrl+Maiusc+P','Command deck: Ctrl+Shift+P');
    const opener=get('nm-orbit-command-trigger');
    if(opener){
      opener.textContent=tr('⌘ Comandi','⌘ Commands');
      opener.title=tr('Trova un comando · Ctrl+Maiusc+P','Find a command · Ctrl+Shift+P');
      opener.setAttribute('aria-label',opener.title);
      opener.setAttribute('aria-haspopup','dialog');
    }
    const prompt=get('nm-orbit-command-search'),heading=get('nm-orbit-command-heading'),close=get('nm-orbit-command-close');
    if(prompt){
      prompt.placeholder=tr('Cerca salvataggio, viste, Focus, AI…','Find save, views, Focus, AI…');
      prompt.setAttribute('aria-label',tr('Cerca un comando','Search commands'));
    }
    if(heading)heading.textContent=tr('Trova un comando','Find a command');
    if(close)close.textContent=tr('Chiudi','Close');
    if(modalOpen)renderResults();
  }
  function button(id,txt,parent,handler){
    const el=document.createElement('button');el.type='button';el.id=id;
    el.textContent=txt;el.addEventListener('click',handler);
    parent.append(el);return el;
  }
  function inspect(app){
    const sidebar=get('inspector-sidebar'),header=sidebar?.querySelector('.inspector-header');
    if(!header||get('nm-orbit-desktop-settings'))return;
    const section=document.createElement('section');section.id='nm-orbit-desktop-settings';
    section.className='nm6-skiptranslate';section.setAttribute('aria-labelledby','nm-orbit-desktop-title');
    const h=document.createElement('strong');h.id='nm-orbit-desktop-title';h.className='nm-orbit-heading';
    const p=document.createElement('p');p.id='nm-orbit-desktop-description';p.className='nm-orbit-description';
    const fields=document.createElement('div');fields.className='nm-orbit-fields';
    function dropdown(id,labelId,items,onChange){
      const wrapper=document.createElement('label'),label=document.createElement('span');
      label.id=labelId;wrapper.append(label);
      const select=document.createElement('select');select.id=id;
      for(const [value,name]of items){
        const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);
      }
      select.addEventListener('change',()=>onChange(select.value));
      wrapper.append(select);fields.append(wrapper);
    }
    dropdown('nm-orbit-desktop-accent','nm-orbit-desktop-accent-label',
      [['auto','Segui il tema'],['cyan','Ciano elettrico'],['violet','Viola aurora'],['amber','Ambra solare']],accent=>setSettings({accent}));
    dropdown('nm-orbit-desktop-density','nm-orbit-desktop-density-label',
      [['comfortable','Spaziosa'],['compact','Compatta']],density=>setSettings({density}));
    const hint=document.createElement('small');hint.id='nm-orbit-desktop-shortcut';hint.className='nm-orbit-hint';
    section.append(h,p,fields,hint);
    header.insertAdjacentElement('afterend',section);
  }
  function shell(){
    if(get('nm-orbit-command-overlay'))return;
    const overlay=document.createElement('div');overlay.id='nm-orbit-command-overlay';overlay.hidden=true;
    overlay.className='nm6-skiptranslate';
    const dialog=document.createElement('section');dialog.id='nm-orbit-command-dialog';
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','nm-orbit-command-heading');
    const header=document.createElement('header'),heading=document.createElement('h2');
    heading.id='nm-orbit-command-heading';
    const close=button('nm-orbit-command-close','Chiudi',header,closeDeck);
    header.prepend(heading);
    const search=document.createElement('input');search.type='search';search.id='nm-orbit-command-search';
    search.autocomplete='off';search.spellcheck=false;
    search.addEventListener('input',()=>{selected=0;renderResults()});
    search.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        if(!results.length)return;
        event.preventDefault();event.stopPropagation();
        selected=(selected+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;
        highlight();
      }else if(event.key==='Enter'){
        event.preventDefault();event.stopPropagation();
        if(results[selected])invoke(results[selected].id);
      }
    });
    const list=document.createElement('div');list.id='nm-orbit-command-results';list.setAttribute('role','listbox');
    list.setAttribute('aria-label',tr('Comandi disponibili','Available commands'));
    const status=document.createElement('div');status.id='nm-orbit-command-status';status.setAttribute('role','status');
    dialog.append(header,search,list,status);overlay.append(dialog);document.body.append(overlay);
    overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closeDeck()});
  }
  function ensure(app){
    currentApp=app;
    if(!get('nm-orbit-desktop-css')){
      const style=document.createElement('style');style.id='nm-orbit-desktop-css';style.textContent=STYLE;document.head.append(style);
    }
    const anchor=get('btn-fullscreen'),bar=anchor?.parentElement||document.querySelector('.tab-bar');
    // Avoid a second Orbit switch in the tab bar.
    if(bar&&!get('nm-orbit-command-trigger')){
      const launch=document.createElement('button');launch.type='button';
      launch.id='nm-orbit-command-trigger';launch.className='tab-action-btn nm6-skiptranslate';
      launch.addEventListener('click',openDeck);
      if(anchor)bar.insertBefore(launch,anchor);else bar.append(launch);
    }
    shell();inspect(app);apply();
  }
  function available(id){
    const element=get(id);
    return !!(element&&!element.disabled&&element.isConnected!==false&&typeof element.click==='function');
  }
  function find(query){
    return core.search(query,document.documentElement.lang,available);
  }
  function highlight(){
    const buttons=[...get('nm-orbit-command-results')?.querySelectorAll('.nm-orbit-command-result')||[]];
    buttons.forEach((button,i)=>{
      button.setAttribute('aria-selected',String(i===selected));
      button.tabIndex=i===selected?0:-1;
    });
    buttons[selected]?.scrollIntoView?.({block:'nearest'});
  }
  function renderResults(){
    const list=get('nm-orbit-command-results'),status=get('nm-orbit-command-status'),field=get('nm-orbit-command-search');
    if(!list||!status||!field)return;
    results=find(field.value);
    if(selected>=results.length)selected=0;
    list.replaceChildren();
    let group=null;
    const locale=document.documentElement.lang==='en'?'en':'it';
    for(const [i,action]of results.entries()){
      if(action.group!==group){
        const title=document.createElement('div');title.className='nm-orbit-command-group';
        title.textContent=core.GROUPS[locale][action.group];list.append(title);group=action.group;
      }
      const entry=document.createElement('button');entry.type='button';
      entry.className='nm-orbit-command-result';entry.setAttribute('role','option');entry.dataset.action=action.id;
      const label=document.createElement('span');label.textContent=action[locale];
      const tag=document.createElement('small');tag.textContent=core.GROUPS[locale][action.group];
      entry.append(label,tag);entry.addEventListener('click',()=>invoke(action.id));
      list.append(entry);
    }
    status.textContent=results.length?results.length+tr(' comandi disponibili',' available commands'):
      tr('Nessun comando corrispondente','No matching commands');
    highlight();
  }
  function openDeck(){
    const overlay=get('nm-orbit-command-overlay'),field=get('nm-orbit-command-search');
    if(!overlay||!field)return false;
    if(modalOpen)return true;
    previousFocus=document.activeElement;
    modalOpen=true;overlay.hidden=false;field.value='';selected=0;
    apply();renderResults();field.focus();return true;
  }
  function closeDeck(){
    if(!modalOpen)return;
    const overlay=get('nm-orbit-command-overlay'),field=get('nm-orbit-command-search');
    if(overlay)overlay.hidden=true;
    if(field)field.value='';
    modalOpen=false;results=[];
    const focus=previousFocus&&previousFocus.isConnected!==false?previousFocus:get('nm-orbit-command-trigger');
    previousFocus=null;focus?.focus?.();
  }
  function invoke(id){
    if(!core.hasCommand(id)||!available(id))return false;
    const control=get(id);
    closeDeck();
    control.click();
    return true;
  }
  function keydown(event){
    if(modalOpen){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation?.();closeDeck();return}
      if(event.key==='Tab'){
        const panel=get('nm-orbit-command-dialog');
        if(!panel)return;
        const focusable=[...panel.querySelectorAll('input,button')].filter(n=>!n.disabled);
        if(!focusable.length)return;
        const current=focusable.indexOf(document.activeElement);
        const next=(current+(event.shiftKey?-1:1)+focusable.length)%focusable.length;
        event.preventDefault();event.stopPropagation();focusable[next].focus();
      }
      // Keep typing/Delete/clipboard away from the canvas while the modal is active.
      if(!event.defaultPrevented)event.stopPropagation();
      return;
    }
    if(event.target?.closest?.('#nm-knowledge-panel'))return;
    if(event.isComposing||event.defaultPrevented||event.altKey||!event.ctrlKey||!event.shiftKey)return;
    if(String(event.key).toLowerCase()==='p'){
      event.preventDefault();event.stopPropagation();openDeck();
    }
  }
  function install(App){
    if(!App?.prototype||typeof App.prototype.bindUI!=='function')return;
    const original=App.prototype.bindUI;
    App.prototype.bindUI=function(...args){
      const value=original.apply(this,args);ensure(this);return value;
    };
    document.addEventListener('keydown',keydown,true);
    if(typeof root.MutationObserver==='function'){
      new root.MutationObserver(()=>{
        if(get('nm-orbit-desktop-settings'))apply();
      }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    }
    root.NeuroMapOrbit=Object.freeze({get:()=>({...state}),set:setSettings,openDeck,closeDeck,find,invoke});
  }
  root.NeuroMapOrbitInstall=install;
})(globalThis);
