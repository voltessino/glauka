/* UI appearance is a separate preference from map/node/branch styling. */
(function(root){
 'use strict';
 const core=root.NeuroMapUISkinCore;
 if(!core)return;
 const CSS=`


 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] {
   --nm-skin-surface:#14243e;--nm-skin-top:#111d36;--nm-skin-stroke:#55708e;
   --nm-skin-ink:#f4f7ff;--nm-skin-muted:#c5d1e7;--nm-skin-radius:13px;
   --nm-skin-shadow:0 16px 44px rgba(0,0,0,.34);--nm-skin-blur:blur(14px);
 }
 /* Explicit Blue/Orbit values outrank the shared fallback and remain
    unaffected by source-order differences in luminous-chrome.css. */
 body:is(.nm-orbit-workspace,.nm-workspace-v2):is([data-nm-skin="classic"],[data-nm-skin="orbit"]){
   --nm-skin-surface:#07142f;--nm-skin-top:#0c214a;--nm-skin-stroke:#3875dc;
   --nm-skin-ink:#f4f7ff;--nm-skin-muted:#b1cdf8;--nm-skin-radius:16px;
   --nm-skin-shadow:0 12px 32px rgba(0,8,30,.36);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="prisma"]{
   --nm-skin-surface:#ffffff;--nm-skin-top:#f7f5ff;--nm-skin-canvas:#ffffff;--nm-skin-stroke:#ddd6ee;
   --nm-skin-ink:#1b2140;--nm-skin-muted:#625e78;--nm-skin-radius:12px;
   --nm-skin-pad:12px;--nm-skin-gap:8px;--nm-skin-control-pad:8px;--nm-skin-control-size:36px;
   --nm-skin-shadow:0 8px 28px rgba(55,39,99,.10);--nm-skin-blur:none;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="slate"]{
   --nm-skin-surface:#1c2433;--nm-skin-top:#151b27;--nm-skin-canvas:#232c3d;--nm-skin-stroke:#3a465c;
   --nm-skin-ink:#f6f1e8;--nm-skin-muted:#c9c2b6;--nm-skin-radius:12px;
   --nm-skin-pad:12px;--nm-skin-gap:8px;--nm-skin-control-pad:8px;--nm-skin-control-size:36px;
   --nm-skin-shadow:0 14px 32px rgba(0,0,0,.28);--nm-skin-blur:none;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="purple"]{
   --nm-skin-surface:#17142f;--nm-skin-top:#33265c;--nm-skin-stroke:#8d6dd7;
   --nm-skin-ink:#f8f2ff;--nm-skin-muted:#d4c3ef;--nm-skin-radius:16px;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="aurora"]{
   --nm-skin-surface:#19304a;--nm-skin-top:#14213f;--nm-skin-stroke:#8c82d7;
   --nm-skin-ink:#f4fcff;--nm-skin-muted:#d9ddfa;--nm-skin-radius:18px;
   --nm-skin-shadow:0 16px 48px rgba(20,20,67,.38);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="glass"]{
   --nm-skin-surface:rgba(24,43,72,.73);--nm-skin-top:rgba(30,41,69,.72);
   --nm-skin-stroke:rgba(194,217,250,.56);--nm-skin-ink:#fff;
   --nm-skin-muted:#e1e9fa;--nm-skin-radius:23px;
   --nm-skin-shadow:0 20px 42px rgba(5,12,28,.35);--nm-skin-blur:blur(28px) saturate(150%);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="cyber"]{
   --nm-skin-surface:#101418;--nm-skin-top:#090d11;--nm-skin-stroke:#99b84c;
   --nm-skin-ink:#e8f9d8;--nm-skin-muted:#bdd6ae;--nm-skin-radius:3px;
   --nm-skin-shadow:6px 6px 0 rgba(135,173,31,.13);--nm-skin-blur:none;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="minimal"]{
   --nm-skin-surface:#fafcff;--nm-skin-top:#f2f6fb;--nm-skin-stroke:#b4c3d8;
   --nm-skin-ink:#17243a;--nm-skin-muted:#4e5e73;--nm-skin-radius:9px;
   --nm-skin-shadow:0 5px 13px rgba(43,60,92,.08);--nm-skin-blur:none;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="graphite"]{
   --nm-skin-surface:#292b30;--nm-skin-top:#1b1c20;--nm-skin-stroke:#666a73;
   --nm-skin-ink:#eff0f3;--nm-skin-muted:#bdc0cb;--nm-skin-radius:8px;
   --nm-skin-pad:12px;--nm-skin-gap:8px;--nm-skin-control-pad:8px;--nm-skin-control-size:36px;
   --nm-skin-shadow:0 14px 24px rgba(0,0,0,.25);--nm-skin-blur:none;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="neon"]{
   --nm-skin-surface:#171137;--nm-skin-top:#100d28;--nm-skin-stroke:#a268eb;
   --nm-skin-ink:#fff6ff;--nm-skin-muted:#dfbfff;--nm-skin-radius:15px;
   --nm-skin-shadow:0 0 26px rgba(180,55,250,.26),0 20px 54px rgba(0,0,0,.35);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin]:is(body) :is(.top-chrome,.topbar.nm-ribbon,.inspector-header){
   background:var(--nm-skin-top);color:var(--nm-skin-ink);border-color:var(--nm-skin-stroke);
   backdrop-filter:var(--nm-skin-blur);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] :is(.tab-item,.tab-action-btn,.dropdown-panel,#context-menu,
   #find-overlay,#inspector-sidebar,.toolbar-group.glass-panel,.v4-toolstrip,.hud-bottom-left,
   .hud-bottom-right .glass-panel,.status-pill,.zoom-bar,#nm616-minimap-shell,#nm-orbit-command-dialog){
   background:var(--nm-skin-surface);color:var(--nm-skin-ink);
   border:1px solid var(--nm-skin-stroke);border-radius:var(--nm-skin-radius);
   box-shadow:var(--nm-skin-shadow);backdrop-filter:var(--nm-skin-blur);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] .tab-item.active{
   border-color:var(--nm-orbit-accent);color:var(--nm-skin-ink);
   background:color-mix(in srgb,var(--nm-skin-surface) 86%,var(--nm-orbit-accent));
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] :is(.dropdown-item,.ctx-item,
    #inspector-sidebar label,.inspector-section-label,#nm-orbit-command-dialog button){
   color:var(--nm-skin-ink);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] :is(.dropdown-item,.ctx-item):hover,
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] .tab-action-btn:hover{
   background:color-mix(in srgb,var(--nm-skin-surface) 75%,var(--nm-orbit-accent));
   border-color:var(--nm-orbit-accent);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] :is(.inspector-section,#nm-orbit-desktop-settings,#nm-ui-skin-settings){
   border-color:var(--nm-skin-stroke);border-radius:var(--nm-skin-radius);
   color:var(--nm-skin-ink);background:var(--nm-skin-surface);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] #nm-orbit-desktop-settings :is(label,small,strong,p){
   color:var(--nm-skin-ink);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] :is(#nm-orbit-desktop-settings select,#nm-ui-skin-settings select,
   #nm-ui-skin-settings button){
   background:var(--nm-skin-top);color:var(--nm-skin-ink);border:1px solid var(--nm-skin-stroke);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="cyber"] :is(.tab-item,.tab-action-btn,.dropdown-panel){
   text-transform:uppercase;letter-spacing:.045em;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="neon"] :is(.tab-item.active,.tab-action-btn:hover){
   box-shadow:0 0 16px rgba(196,74,255,.35),inset 0 0 15px rgba(96,42,182,.12);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="aurora"] :is(.tab-item.active,#inspector-sidebar){
   background:linear-gradient(130deg,#13334c,#382b61);
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="glass"] :is(.tab-item.active,#inspector-sidebar){
   background:linear-gradient(130deg,rgba(71,108,159,.56),rgba(46,41,101,.52));
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin-contrast="high"]{
   --nm-skin-stroke:#f1f5ff;--nm-skin-muted:#f1f5ff;
 }
 body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin="minimal"][data-nm-skin-contrast="high"]{
   --nm-skin-stroke:#20334d;--nm-skin-ink:#0b1524;
 }
 #nm-ui-skin-settings{display:grid;gap:8px;padding:11px;margin:8px 0;
   border:1px solid rgba(132,158,196,.27);border-radius:13px;font:12px system-ui;}
 #nm-ui-skin-settings label{display:grid;gap:4px;color:inherit;}
 #nm-ui-skin-settings select{min-width:0;width:100%;border-radius:8px;padding:8px;
   background:#102138;color:#eef6ff;border:1px solid #53769b;}
 #nm-ui-skin-settings strong{font-size:12px;}
 #nm-ui-skin-settings small{font-size:11px;opacity:.8;}
 /* Comfortable reading mode is a CHROME preference, not a node/text layout rewrite.
    Keep the user's original canvas geometry and project data untouched. */
 body[data-nm-skin-readability="comfortable"] :is(
  .tab-action-btn,.dropdown-item,.ctx-item,.zoom-btn,
  #nm-ui-skin-settings select,#gl-settings-center .gl-settings-control select,
  #gl-settings-center .gl-settings-control button,#nm-view-focus,#nm-view-overlay-focus,
  #nm-view-picker,#nm-view-overlay-picker,#nm-view-split,
  .nm616-nav-card button,.nm616-nav-heading button) {
   min-height:44px!important;line-height:1.4!important;font-size:14px!important;
 }
 body[data-nm-skin-readability="comfortable"] :is(
  .inspector-section-label,.dropdown-section-title,.nm-ux-slider-label,
  #nm-ui-skin-settings label,#nm-workspace-rail,#nm-view-switch,
  #nm-view-overlay .nm-view-hint,#nm-ui-skin-settings small){
   font-size:14px!important;line-height:1.5!important;
 }
 body[data-nm-skin-readability="comfortable"] :is(
  .tab-action-btn,.dropdown-item,.ctx-item,#nm-ui-skin-settings select){
   padding-block:10px!important;
 }
 body[data-nm-skin-readability="comfortable"] :is(
  .dropdown-panel,#context-menu,#nm-orbit-command-dialog){
   max-height:calc(100dvh - 26px)!important;overflow-y:auto!important;
   max-width:calc(100vw - 16px)!important;
 }
 body[data-nm-skin-readability="comfortable"] :is(
  button,select,input,textarea,summary,[role="button"]):focus-visible {
   outline:3px solid #fbbf24!important;outline-offset:2px!important;
 }
 body[data-nm-skin-readability="comfortable"] #nm-ui-skin-settings small{
   opacity:1;color:var(--nm-skin-muted,#e2e8f0);
 }
 @media(max-width:750px){
  body[data-nm-skin-readability="comfortable"] #nm-ui-skin-settings{
   max-width:min(100%,calc(100vw - 16px));overflow:auto;
  }
 }
 @media(prefers-reduced-motion:reduce){
  body :is(.tab-action-btn,.dropdown-item,.ctx-item,#nm-ui-skin-settings select){
    transition:none!important;animation:none!important;scroll-behavior:auto!important;
  }
 }
 @media(prefers-reduced-motion:reduce){
  body:is(.nm-orbit-workspace,.nm-workspace-v2)[data-nm-skin] :is(.tab-item,.tab-action-btn,.dropdown-panel){transition:none!important;animation:none!important;}
 }
 `;
 const LUMINOUS=/* @neuromap-luminous-chrome-styles */ "";
 const get=id=>document.getElementById(id),tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 let state;
 let firstAppearance=false;
 try{const raw=root.localStorage?.getItem(core.STORAGE_KEY);firstAppearance=!raw;state=core.read(raw)}catch{state=core.read(null)}
 function save(){try{root.localStorage?.setItem(core.STORAGE_KEY,JSON.stringify(state))}catch{}}
 function apply(){
  const enabled=!!root.NeuroMapOrbit?.get()?.enabled;
  document.body.dataset.nmSkin=core.visible(state,enabled);
  document.body.dataset.nmSkinContrast=state.contrast;
  document.body.dataset.nmSkinReadability=state.readability;
  const picker=get('nm-ui-skin-choice'),contrast=get('nm-ui-skin-contrast'),
        readability=get('nm-ui-skin-readability');
  if(picker){picker.value=core.visible(state,enabled);
   picker.setAttribute('aria-label',tr('Tema dell’interfaccia','Interface theme'));
   for(const [i,opt] of [...picker.options].entries())opt.textContent=tr(core.THEMES[i].it,core.THEMES[i].en);}
  if(contrast){contrast.value=state.contrast;contrast.setAttribute('aria-label',tr('Contrasto interfaccia','Interface contrast'))}
  const readableCaption=get('nm-ui-readability-label');
  if(readableCaption)readableCaption.textContent=tr('Leggibilità','Readability');
  const readableHint=get('nm-ui-readability-hint');
  if(readableHint)readableHint.textContent=tr(
   'Rende i comandi più chiari e mette in evidenza la selezione. Non modifica le dimensioni dei nodi della mappa.',
   'Makes controls clearer and highlights the selection. Does not resize map nodes.');
  if(readability){
   readability.value=state.readability;
   readability.setAttribute('aria-label',tr('Leggibilità dei comandi','Control readability'));
   const labels=[['standard','Standard','Standard'],
     ['comfortable','Comandi grandi','Larger controls']];
   for(const opt of readability.options){
    const match=labels.find(([id])=>id===opt.value);
    if(match)opt.textContent=tr(match[1],match[2]);
   }
  }
  const themeCaption=get('nm-ui-theme-label');if(themeCaption)themeCaption.textContent=tr('Tema','Theme');
  const contrastCaption=get('nm-ui-contrast-label');if(contrastCaption)contrastCaption.textContent=tr('Contrasto','Contrast');
  if(contrast)for(const opt of contrast.options)opt.textContent=opt.value==='high'?tr('Alto','High'):tr('Standard','Standard');
  const title=get('nm-ui-skin-title');if(title)title.textContent=tr('Temi dell’interfaccia','Interface themes');
  const hint=get('nm-ui-skin-hint');if(hint)hint.textContent=tr(
   'Le modifiche sono immediate e salvate su questo dispositivo.',
   'Changes apply immediately and are saved on this device.');
  // UI canvases (minimap) repaint their outlines without touching document data.
  if(typeof root.CustomEvent==='function')document.dispatchEvent(new root.CustomEvent('neuromap:ui-theme-change'));
 }
 function set(value={}){
  state=core.read({...state,...value});save();
  if('theme' in value)root.NeuroMapOrbit?.set?.({enabled:true});
  apply();return {...state};
 }
 function mount(){
   // Legacy "Classico" was blue and disabled the skin layer. Migrate that
   // old choice to Prisma Vivo, while a user who later selects "Blu originale"
   // still gets the blue skin and has their preference saved normally.
   if(!root.NeuroMapOrbit?.get()?.enabled){
    if(state.theme==='classic'){state=core.read({...state,theme:'prisma'});save();}
    root.NeuroMapOrbit?.set?.({enabled:true});
   }
   if(firstAppearance){firstAppearance=false;save();}
  if(!get('nm-ui-skin-styles')){
   const style=document.createElement('style');style.id='nm-ui-skin-styles';
   style.textContent=CSS+'\n'+LUMINOUS;document.head.append(style);
  }
  if(get('nm-ui-skin-settings')){apply();return}
  const anchor=get('nm-orbit-desktop-settings');
  if(!anchor)return;
  const section=document.createElement('section');section.id='nm-ui-skin-settings';
  section.className='nm6-skiptranslate';
  section.setAttribute('aria-labelledby','nm-ui-skin-title');
  const heading=document.createElement('div');heading.className='nm-ui-skin-heading';
  const icon=document.createElement('span');icon.className='nm-ui-palette-icon';icon.setAttribute('aria-hidden','true');
  const title=document.createElement('strong');title.id='nm-ui-skin-title';heading.append(icon,title);
  const pickerLabel=document.createElement('label'),picker=document.createElement('select');
  picker.id='nm-ui-skin-choice';
  for(const theme of core.THEMES){const option=document.createElement('option');option.value=theme.id;
   option.textContent=theme.it;picker.append(option)}
  const themeCaption=document.createElement('span');themeCaption.id='nm-ui-theme-label';
  pickerLabel.append(themeCaption,picker);
  picker.addEventListener('change',()=>set({theme:picker.value}));
  const contrastLabel=document.createElement('label'),contrast=document.createElement('select');
  contrast.id='nm-ui-skin-contrast';
  for(const [value,it] of [['normal','Contrasto standard'],['high','Alto contrasto']]){
   const option=document.createElement('option');option.value=value;option.textContent=it;contrast.append(option)}
  const contrastCaption=document.createElement('span');contrastCaption.id='nm-ui-contrast-label';
  contrastLabel.append(contrastCaption,contrast);contrast.addEventListener('change',()=>set({contrast:contrast.value}));
  const readabilityLabel=document.createElement('label'),
        readability=document.createElement('select');
  readability.id='nm-ui-skin-readability';
  for(const [value,text] of [['standard','Standard'],
    ['comfortable','Comandi grandi']]){
    const option=document.createElement('option');option.value=value;
    option.textContent=text;readability.append(option);
  }
  const readableCaption=document.createElement('span');
  readableCaption.id='nm-ui-readability-label';
  const readableHint=document.createElement('small');
  readableHint.id='nm-ui-readability-hint';
  readabilityLabel.append(readableCaption,readability);
  readability.addEventListener('change',()=>set({readability:readability.value}));
  const hint=document.createElement('small');hint.id='nm-ui-skin-hint';
  const note=document.createElement('div');note.className='nm-ui-skin-note';
  const info=document.createElement('span');info.className='nm-ui-info-icon';info.textContent='i';info.setAttribute('aria-hidden','true');
  const help=document.createElement('div');help.append(readableHint,hint);note.append(info,help);
  section.append(heading,pickerLabel,contrastLabel,readabilityLabel,note);
  anchor.insertAdjacentElement('beforebegin',section);
  if(typeof root.MutationObserver==='function'){
   const watcher=new root.MutationObserver(()=>apply());
   watcher.observe(document.body,{attributes:true,attributeFilter:['class']});
   watcher.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  }
  apply();
 }
 function install(App){
  if(!App?.prototype?.bindUI)return;
  const before=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=before.apply(this,args);mount();return result};
 }
 root.NeuroMapUISkin=Object.freeze({get:()=>({...state}),set,themes:core.THEMES});
 root.NeuroMapUISkinInstall=install;
})(globalThis);
