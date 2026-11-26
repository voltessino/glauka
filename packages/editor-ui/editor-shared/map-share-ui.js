/* @neuromap-map-share-core */
/* F11.1–F11.2 — share or transfer one map locally or via encrypted Wi-Fi LAN / password file.
 * Zero external servers. The open document is never replaced. */
(function(root){
 'use strict';
 const Transfer=root.GlaukaMapTransfer;
 if(!Transfer)return;
 const tr=(it,en)=>(root.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(name,cls,txt)=>{const node=document.createElement(name);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node;};
 function safeUuid(){
  if(typeof root.crypto?.randomUUID==='function')return root.crypto.randomUUID();
  if(typeof root.NeuroMapRecovery?.requestId==='function')return root.NeuroMapRecovery.requestId();
  const bytes=new Uint8Array(16);
  if(typeof root.crypto?.getRandomValues==='function')root.crypto.getRandomValues(bytes);
  else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 }
 function svgIcon(paths,size=18){
  if(typeof document.createElementNS!=='function')return document.createElement('span');
  const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');
  s.setAttribute('viewBox','0 0 24 24');s.setAttribute('width',String(size));s.setAttribute('height',String(size));
  s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','1.8');
  s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');
  s.setAttribute('aria-hidden','true');
  for(const d of paths){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}
  return s;
 }
 const PC_PHONE_PATHS=[
  'M2 7h9v7H2z','M4.5 17h4','M6.5 14v3',
  'M16 7h6v12h-6z','M18.5 16.5h1',
  'M11.5 4.5h5','M15 3l1.5 1.5L15 6','M13 3 11.5 4.5 13 6','M12.5 12.5h2.5'
 ];
 const CSS=[
  '#nm-map-share[hidden],#nm-map-share [hidden]{display:none!important}',
  '#nm-map-share{position:fixed;inset:0;z-index:2360;background:rgba(15,23,42,.58);backdrop-filter:blur(5px);display:grid;place-items:center;padding:16px;box-sizing:border-box}',
  '#nm-map-share .nm-share-window{box-sizing:border-box;display:flex;flex-direction:column;width:min(680px,100%);max-height:min(90dvh,calc(100dvh - 32px));overflow:hidden;padding:0;border:1px solid var(--nm-skin-stroke,#d7deed);border-radius:18px;background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#141926);box-shadow:0 24px 68px rgba(15,23,42,.26);font:13.5px/1.45 Inter,system-ui,-apple-system,sans-serif}',
  '#nm-map-share .nm-share-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--nm-skin-stroke,#d7deed);background:var(--nm-skin-surface,#ffffff);flex:0 0 auto}',
  '#nm-map-share .nm-share-head-left{display:flex;align-items:center;gap:11px;min-width:0}',
  '#nm-map-share .nm-share-badge{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 14%,transparent);color:var(--nm-theme-action,#5b3fd0);border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 26%,transparent)}',
  '#nm-map-share .nm-share-head-copy{display:grid;gap:1px;min-width:0}',
  '#nm-map-share h2{margin:0;font-size:16.5px;font-weight:750;line-height:1.25}',
  '#nm-map-share .nm-share-head p{margin:0;color:var(--nm-skin-muted,#5c6680);font-size:11.5px;line-height:1.35}',
  '#nm-map-share h3{margin:0;font-size:13.5px;font-weight:700}',
  '#nm-map-share .nm-share-close{width:32px;height:32px;min-height:32px;padding:0;border-radius:9px;border:1px solid var(--nm-skin-stroke,#d7deed);background:var(--nm-skin-top,#f4f6fc);color:var(--nm-skin-ink,#141926);display:grid;place-items:center;flex:none;cursor:pointer}',
  '#nm-map-share .nm-share-close:hover{border-color:var(--nm-theme-focus,#7c5ce7)}',
  '#nm-map-share .nm-share-scroll{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:12px;padding:14px 18px 18px}',
  '#nm-map-share .nm-share-scroll>*{flex-shrink:0}',
  '#nm-map-share .nm-share-map-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;padding:10px 12px;border-radius:12px;background:var(--nm-skin-top,#f4f6fc);border:1px solid var(--nm-skin-stroke,#d7deed)}',
  '#nm-map-share label{display:grid;gap:4px;font-size:11.5px;font-weight:700;color:var(--nm-skin-muted,#5c6680)}',
  '#nm-map-share select,#nm-map-share input:not([type="file"]){box-sizing:border-box;width:100%;min-height:36px;padding:6px 10px;border:1px solid var(--nm-skin-stroke,#d7deed);border-radius:9px;background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#141926);font:inherit;font-weight:600}',
  '#nm-map-share button{box-sizing:border-box;min-height:36px;padding:8px 12px;border:1px solid var(--nm-skin-stroke,#d7deed);border-radius:10px;background:var(--nm-skin-top,#f4f6fc);color:var(--nm-skin-ink,#141926);font:inherit;font-weight:650;cursor:pointer;transition:border-color .15s,background .15s}',
  '#nm-map-share button:hover:not(:disabled){border-color:var(--nm-theme-focus,#7c5ce7)}',
  '#nm-map-share button:disabled{opacity:.48;cursor:default}',
  '#nm-map-share .nm-share-facts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
  '#nm-map-share .nm-share-fact-pill{font-size:11px;font-weight:650;padding:4px 9px;border-radius:999px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed);color:var(--nm-skin-ink,#141926)}',
  '#nm-map-share .nm-share-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
  '#nm-map-share .nm-share-choice{display:flex!important;align-items:flex-start!important;gap:9px!important;min-height:64px;padding:10px 11px!important;text-align:left!important;border-radius:12px!important;background:var(--nm-skin-top,#f4f6fc)!important;color:var(--nm-skin-ink,#141926)!important}',
  '#nm-map-share .nm-share-choice-icon{width:28px;height:28px;flex:0 0 28px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 12%,transparent);color:var(--nm-theme-action,#5b3fd0)}',
  '#nm-map-share .nm-share-choice-copy{display:grid;gap:2px;min-width:0}',
  '#nm-map-share .nm-share-choice-copy strong{font-size:12.5px;font-weight:750;line-height:1.25}',
  '#nm-map-share .nm-share-choice-copy small{font-size:11px;font-weight:500;line-height:1.3;color:var(--nm-skin-muted,#5c6680)}',
  '#nm-map-share .nm-share-choice[aria-pressed="true"]{border-color:var(--nm-theme-action,#5b3fd0)!important;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 9%,var(--nm-skin-surface,#ffffff))!important;box-shadow:inset 0 0 0 1.5px var(--nm-theme-action,#5b3fd0)}',
  '#nm-map-share .nm-share-stage{display:grid;gap:10px}',
  '#nm-map-share .nm-share-panel-card{display:grid;gap:10px;padding:12px 14px;border-radius:13px;background:var(--nm-skin-top,#f4f6fc);border:1px solid var(--nm-skin-stroke,#d7deed)}',
  '#nm-map-share .nm-share-panel-card p{margin:0;color:var(--nm-skin-muted,#5c6680);font-size:12px;line-height:1.45}',
  '#nm-map-share .nm-share-dir-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
  '#nm-map-share .nm-share-dir-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 11px;border-radius:11px;background:var(--nm-skin-surface,#ffffff);text-align:left}',
  '#nm-map-share .nm-share-dir-btn strong{font-size:12.5px;font-weight:750}',
  '#nm-map-share .nm-share-dir-btn small{font-size:11px;font-weight:500;color:var(--nm-skin-muted,#5c6680)}',
  '#nm-map-share .nm-share-dir-btn[aria-pressed="true"]{border-color:var(--nm-theme-action,#5b3fd0);box-shadow:inset 0 0 0 1.5px var(--nm-theme-action,#5b3fd0);background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 8%,var(--nm-skin-surface,#ffffff))}',
  '#nm-map-share .nm-share-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
  '#nm-map-share .nm-share-step{padding:8px 9px;border-radius:10px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed);font-size:11.5px;line-height:1.35}',
  '#nm-map-share .nm-share-step strong{display:block;font-size:11px;color:var(--nm-theme-action,#5b3fd0);margin-bottom:2px}',
  '#nm-map-share .nm-share-phase{margin:0;font-weight:700;font-size:13px;color:var(--nm-skin-ink,#141926);text-align:center}',
  '#nm-map-share .nm-share-pair-grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:12px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed)}',
  '#nm-map-share .nm-share-qr-view{width:146px;height:auto;background:#fff;border-radius:9px;padding:6px;border:1px solid rgba(15,23,42,.12);display:block;margin:0 auto}',
  '#nm-map-share .nm-share-creds{display:grid;gap:8px;min-width:0}',
  '#nm-map-share .nm-share-cred-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:9px;background:var(--nm-skin-top,#f4f6fc);border:1px solid var(--nm-skin-stroke,#d7deed);font:700 13px/1.2 ui-monospace,monospace;word-break:break-all}',
  '#nm-map-share .nm-share-cred-pill span{font:600 11px/1.2 Inter,system-ui,sans-serif;color:var(--nm-skin-muted,#5c6680)}',
  '#nm-map-share .nm-share-verify{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 auto;padding:12px 16px;border-radius:12px;background:var(--nm-skin-surface,#ffffff);border:1.5px solid var(--nm-theme-action,#5b3fd0);text-align:center;width:min(360px,100%);box-sizing:border-box}',
  '#nm-map-share .nm-share-verify>span{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--nm-skin-muted,#5c6680)}',
  '#nm-map-share .nm-share-code{font-size:28px;letter-spacing:.14em;color:var(--nm-theme-action,#5b3fd0);font-family:ui-monospace,monospace}',
  '#nm-map-share .nm-share-wait{margin:0;font-size:12px;line-height:1.4;color:var(--nm-skin-muted,#5c6680);text-align:center}',
  '#nm-map-share .nm-share-action-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
  '#nm-map-share .nm-share-inline-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,140px);gap:8px;align-items:end}',
  '#nm-map-share .nm-share-card{display:grid;gap:6px;padding:10px 12px;border-radius:11px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed)}',
  '#nm-map-share .nm-share-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
  '#nm-map-share .nm-share-row input{flex:1 1 160px}',
  '#nm-map-share .nm-share-device-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}',
  '#nm-map-share .nm-share-device-pill{font-size:11px;font-weight:700;padding:7px 10px;border-radius:9px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed);color:var(--nm-skin-muted,#5c6680);font-family:ui-monospace,monospace}',
  '#nm-map-share .nm-share-subbox{display:grid;gap:8px;padding:10px 12px;border-radius:11px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed)}',
  '#nm-map-share .nm-share-subbox summary{cursor:pointer;font-size:12.5px;font-weight:700;color:var(--nm-skin-ink,#141926)}',
  '#nm-map-share .nm-share-file{position:relative;display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:8px 13px;overflow:hidden;cursor:pointer;border:1px dashed var(--nm-theme-action,#5b3fd0);border-radius:10px;background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#141926);font-size:12.5px;font-weight:650}',
  '#nm-map-share .nm-share-file input{position:absolute;inset:0;opacity:0;cursor:pointer}',
  '#nm-map-share .nm-share-primary{background:var(--nm-theme-action,#5b3fd0)!important;color:#fff!important;border-color:var(--nm-theme-action,#5b3fd0)!important}',
  '#nm-map-share .nm-share-primary:hover:not(:disabled){filter:brightness(1.06)}',
  '#nm-map-share #nm-map-share-status{margin:0;font-size:12px;color:var(--nm-skin-muted,#5c6680);min-height:16px}',
  '@media(max-width:680px){#nm-map-share{padding:8px}#nm-map-share .nm-share-map-bar,#nm-map-share .nm-share-choices,#nm-map-share .nm-share-steps,#nm-map-share .nm-share-device-row,#nm-map-share .nm-share-pair-grid,#nm-map-share .nm-share-inline-form{grid-template-columns:minmax(0,1fr)}#nm-map-share .nm-share-dir-grid{grid-template-columns:minmax(0,1fr)}#nm-map-share .nm-share-scroll{padding:12px}}',
  'body.glauka-mobile-app #nm-map-share{padding:0}body.glauka-mobile-app #nm-map-share .nm-share-window{width:100%;height:100%;max-height:none;border-radius:0;border:0}body.glauka-mobile-app #nm-map-share .nm-share-head{padding-top:max(14px,env(safe-area-inset-top,0px))}body.glauka-mobile-app #nm-map-share .nm-share-scroll{padding-bottom:max(20px,env(safe-area-inset-bottom,0px))}body.glauka-mobile-app #nm-map-share button{min-height:44px}',
  '#nm-map-share :focus-visible{outline:2px solid var(--nm-theme-focus,#6441df);outline-offset:2px}'
 ].join('\n');
 const isMobile=()=>Boolean(root.GlaukaMobile||document.body?.classList?.contains('glauka-mobile-app'));
 const lanPendingCallbacks=new Map();
 if(!root.nmAndroidLanReply){
  root.nmAndroidLanReply=function(id,raw){
   const pending=lanPendingCallbacks.get(id);
   if(!pending)return;
   lanPendingCallbacks.delete(id);
   clearTimeout(pending.timer);
   try{pending.resolve(typeof raw==='string'?JSON.parse(raw):raw);}
   catch(err){pending.reject(err);}
  };
 }
 function androidLanRequest(host,port,pin,path,body){
  return new Promise((resolve,reject)=>{
   if(!root.GlaukaLanPair?.request){reject(Error(tr('Bridge Wi-Fi Android non disponibile','Android Wi-Fi bridge unavailable')));return;}
   const id='lan_'+safeUuid().replace(/-/g,'').slice(0,20);
   const timer=setTimeout(()=>{lanPendingCallbacks.delete(id);reject(Error(tr('Connessione Wi-Fi scaduta','Wi-Fi connection timed out')));},16000);
   lanPendingCallbacks.set(id,{resolve,reject,timer});
   try{
    root.GlaukaLanPair.request(String(host),Number(port),String(pin||''),String(path),JSON.stringify(body||{}),id);
   }catch(err){
    lanPendingCallbacks.delete(id);clearTimeout(timer);reject(err);
   }
  });
 }
 async function sha256(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 function deviceId(){
  const key='glauka.f11.device';
  let id=localStorage.getItem(key);
  if(!/^[0-9a-f-]{36}$/i.test(id||'')){id=safeUuid();localStorage.setItem(key,id);}
  return id;
 }
 function deviceNameDefault(){
  if(root.GlaukaMobile||document.body?.classList?.contains('glauka-mobile-app'))return tr('Telefono Android','Android Phone');
  if(/Mac/i.test(navigator.platform||''))return 'Mac';
  return tr('PC Windows','Windows PC');
 }
 function projectFromTab(app,tab){
  const state=tab.state;
  return {
   schema:'NeuroMapArchitect-SingleTab-v6',
   savedAt:new Date().toISOString(),
   thresholdY:state.thresholdY,
   balanceBias:state.balanceBias??50,compactness:state.compactness??100,
   branchGapX:typeof nm68ClampGap==='function'?nm68ClampGap(state.branchGapX):state.branchGapX,
   strokeScale:state.strokeScale||1,
   activeThemeId:state.activeThemeId||null,
   typographyPreset:state.typographyPreset||'uniform',typographyScale:state.typographyScale||1,
   branchStyle:state.branchStyle||'neon',
   defaultLabelWrapChars:state.defaultLabelWrapChars||(typeof nm64PreferredWrap==='function'?nm64PreferredWrap():48),
   wrapCustom:!!state.wrapCustom,
   studyCards:app.getStudyCardsForTab?app.getStudyCardsForTab(tab.id):[],
   learningAttempts:typeof NeuroMapLearningCore==='undefined'?[]:NeuroMapLearningCore.cleanAttempts(app.learningAttempts).filter(a=>a.tabId===tab.id),
   learningPlan:typeof NeuroMapAdaptiveCore==='undefined'?null:NeuroMapAdaptiveCore.cleanPlans(app.learningPlans).find(p=>p.tabId===tab.id)||null,
   root:MindMapStateMachine.cloneTree(state.root),
   images:MindMapStateMachine.cloneImages(state.images),
   relationships:MindMapStateMachine.cloneRelationships(state.relationships)
  };
 }
 function install(App){
  const bind=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=bind.apply(this,args);mount(this);return result;};
 }
 function mount(app){
  if(app._nmMapShare||!document.getElementById('dropdown-file'))return;
  if(!document.getElementById('nm-map-share-style')){
   const css=el('style');css.id='nm-map-share-style';css.textContent=CSS;document.head.append(css);
  }
  const menu=document.getElementById('dropdown-file');
  const launch=el('button','dropdown-item',tr('Condividi mappa…','Share map…'));
  launch.type='button';launch.id='nm-map-share-open';
  const after=document.getElementById('nm-share-export-open')||document.getElementById('nm-export-launch');
  const tabButton=document.getElementById('menu-new-map');
  if(after&&after.parentElement===menu)after.after(launch);
  else if(tabButton&&tabButton.parentElement===menu)tabButton.before(launch);
  else menu.append(launch);
  const shade=el('div');shade.id='nm-map-share';shade.hidden=true;
  shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',tr('Condividi o trasferisci mappa','Share or transfer map'));
  const box=el('section','nm-share-window');
  const head=el('div','nm-share-head');
  const headLeft=el('div','nm-share-head-left');
  const badge=el('div','nm-share-badge');
  badge.append(svgIcon(PC_PHONE_PATHS,19));
  const heading=el('div','nm-share-head-copy');
  const title=el('h2','',tr('Condividi o trasferisci mappa','Share or transfer map'));title.id='nm-map-share-title';
  const note=el('p','',tr('Zero server esterni: i tuoi file restano sempre sotto il tuo controllo.','No external servers: your maps always stay under your control.'));
  heading.append(title,note);
  headLeft.append(badge,heading);
  const close=el('button','nm-share-close');close.type='button';
  close.setAttribute('aria-label',tr('Chiudi','Close'));
  close.append(svgIcon(['m6 6 12 12','M18 6 6 18'],16));
  head.append(headLeft,close);

  const mapBar=el('div','nm-share-map-bar');
  const pickerLabel=el('label');pickerLabel.append(el('span','',tr('Mappa da condividere','Map to share')));
  const picker=el('select');picker.id='nm-map-share-picker';pickerLabel.append(picker);
  const preview=el('div','nm-share-facts');preview.id='nm-map-share-preview';
  mapBar.append(pickerLabel,preview);

  const choices=el('div','nm-share-choices');
  const mkChoice=(id,stage,paths,label,hint)=>{
   const b=el('button','nm-share-choice');b.type='button';b.id=id;b.dataset.stage=stage;
   const ic=el('span','nm-share-choice-icon');ic.append(svgIcon(paths,17));
   const cp=el('span','nm-share-choice-copy');cp.append(el('strong','',label),el('small','',hint));
   b.append(ic,cp);return b;
  };
  const device=mkChoice('nm-map-share-device','device',PC_PHONE_PATHS,
   tr('PC ↔ Telefono','PC ↔ Phone'),
   tr('Trasferimento diretto Wi-Fi cifrato','Direct encrypted Wi-Fi link'));
  const save=mkChoice('nm-map-share-save','save',
   ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M12 18v-6','m9 15 3 3 3-3'],
   tr('Invia o apri file','Send or open file'),
   tr('Copie .gk, cifrate con password o Drive','Save .gk, password file or open'));
  const sync=mkChoice('nm-map-share-sync','sync',
   ['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'],
   tr('I miei dispositivi','My devices'),
   tr('Nome dispositivo e cartella Cloud','Device name & Cloud folder sync'));
  choices.append(device,save,sync);

  const deviceOut=el('div','nm-share-stage');deviceOut.id='nm-map-share-device-result';deviceOut.hidden=true;

  // Stage 2: Clean human File send & receive (ZERO technical JSON dump)
  const saveOut=el('div','nm-share-stage');saveOut.hidden=true;
  const sendCard=el('section','nm-share-panel-card');
  sendCard.append(
   el('h3','',tr('Salva una copia da inviare a PC, Telefono o altre persone','Save a copy to send to Phone, PC or others')),
   el('p','',tr('Esporta una copia completa (.json) oppure proteggila con una password AES-256 prima di inviarla via chat, email o chiavetta.',
    'Export a full copy (.json) or lock it with an AES-256 password before sending via chat, email or USB.'))
  );
  const sendActions=el('div','nm-share-action-row');
  const exportBtn=el('button','nm-share-primary',tr('Scarica file mappa (.json)','Download map file (.json)'));
  exportBtn.type='button';
  const htmlShareBtn=el('button','',tr('Esporta pagina HTML (sola lettura)…','Export read-only HTML…'));
  htmlShareBtn.type='button';
  sendActions.append(exportBtn,htmlShareBtn);

  const encBox=el('details','nm-share-subbox');
  encBox.append(el('summary','',tr('Salva copia cifrata con password (AES-256)','Save password-protected copy (AES-256)')));
  const encForm=el('div','nm-share-inline-form');
  const passLbl=el('label');passLbl.append(el('span','',tr('Password di protezione (min. 4 caratteri)','Protection password (min. 4 chars)')));
  const passInput=el('input');passInput.type='password';passInput.autocomplete='new-password';passInput.maxLength=128;
  passInput.placeholder=tr('Es. esame-storia-2026','e.g. study-notes-2026');
  passLbl.append(passInput);
  const encBtn=el('button','nm-share-primary',tr('Scarica file cifrato (.glk)','Download encrypted (.glk)'));
  encBtn.type='button';
  encForm.append(passLbl,encBtn);
  encBox.append(encForm);
  sendCard.append(sendActions,encBox);

  const receiveCard=el('section','nm-share-panel-card');
  receiveCard.append(
   el('h3','',tr('Hai ricevuto un file?','Received a map file?')),
   el('p','',tr('Apri un file .json, .glk (protetto con password), .gk o .xmind: si apre sempre in una nuova scheda senza toccare il lavoro aperto.',
    'Open a received .json, .glk (password-locked), .gk or .xmind file: it always opens in a new tab safely.'))
  );
  const receiveRow=el('div','nm-share-action-row');
  const fileWrap=el('label','nm-share-file');
  fileWrap.append(svgIcon(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','m17 8-5-5-5 5','M12 3v12'],16),
   el('span','',tr('Apri file ricevuto (.json / .glk / .gk / .xmind)…','Open received file (.json / .glk / .gk / .xmind)…')));
  const file=el('input');file.type='file';file.accept='application/json,.json,.gk,.glk,.neuromap,.xmind,.md,.opml';
  file.setAttribute('aria-label',tr('Apri un file ricevuto','Open a received file'));
  fileWrap.append(file);
  receiveRow.append(fileWrap);
  if(root.NMAndroid?.pickProjectDocument){
   const drivePick=el('button','',tr('Apri e collega da Drive…','Open and link from Drive…'));
   drivePick.type='button';
   drivePick.addEventListener('click',async()=>{
    await closeModal();
    await root.NeuroMapLifecycle?.androidOpenProject?.(null);
   });
   receiveRow.append(drivePick);
  }
  const decryptBox=el('div','nm-share-subbox');decryptBox.hidden=true;
  const decTitle=el('strong','',tr('Questo file è protetto da password','This file is password-protected'));
  const decRow=el('div','nm-share-inline-form');
  const decLbl=el('label');decLbl.append(el('span','',tr('Inserisci la password del file','Enter file password')));
  const decPass=el('input');decPass.type='password';decPass.autocomplete='off';
  decLbl.append(decPass);
  const decOpen=el('button','nm-share-primary',tr('Sblocca e apri','Unlock & open'));decOpen.type='button';
  decRow.append(decLbl,decOpen);
  decryptBox.append(decTitle,decRow);

  const inbox=el('div');inbox.id='nm-map-share-inbox';
  receiveCard.append(receiveRow,decryptBox,inbox);
  saveOut.append(sendCard,receiveCard);

  // Stage 3: My devices & Cloud folder sync
  const syncOut=el('div','nm-share-stage');syncOut.hidden=true;
  const thisDeviceCard=el('section','nm-share-panel-card');
  thisDeviceCard.append(
   el('h3','',tr('Questo dispositivo','This device')),
   el('p','',tr('Nome mostrato su questo PC o Telefono durante il collegamento diretto.',
    'Label shown on this PC or Phone during direct pairing.'))
  );
  const devRow=el('div','nm-share-device-row');
  const devNameLbl=el('label');devNameLbl.append(el('span','',tr('Nome dispositivo','Device name')));
  const devNameInput=el('input');devNameInput.type='text';devNameInput.maxLength=40;
  const savedDevName=localStorage.getItem('glauka.f11.deviceName');
  devNameInput.value=savedDevName||deviceNameDefault();
  devNameInput.addEventListener('change',()=>{
   const v=devNameInput.value.trim()||deviceNameDefault();
   devNameInput.value=v;localStorage.setItem('glauka.f11.deviceName',v);
  });
  devNameLbl.append(devNameInput);
  const devBadge=el('span','nm-share-device-pill','ID '+deviceId().slice(0,8));
  devBadge.title=deviceId();
  devRow.append(devNameLbl,devBadge);
  thisDeviceCard.append(devRow);

  const cloudCard=el('section','nm-share-panel-card');
  cloudCard.append(
   el('h3','',tr('Sincronizza automaticamente anche fuori casa','Keep maps synced everywhere')),
   el('p','',isMobile()
    ?tr('Apri il tuo file .gk da Google Drive o OneDrive dal telefono: quando salvi su Glauka aggiorni lo stesso file sul tuo computer, senza nessun server intermedio.',
     'Open your .gk map directly from Google Drive or OneDrive on your phone: saving updates the same file on your computer with zero intermediary server.')
    :tr('Se PC e telefono sono su reti diverse, usa la tua cartella Google Drive, OneDrive o iCloud: Glauka legge e scrive direttamente sul tuo spazio cloud privato.',
     'When PC and phone are on different networks, use your own Google Drive, OneDrive or iCloud folder directly.'))
  );
  const syncActions=el('div','nm-share-action-row');
  const openDevices=el('button','nm-share-primary',isMobile()?tr('Apri da Google Drive / File…','Open from Google Drive / Files…'):tr('Configura cartella Cloud…','Configure Cloud folder…'));openDevices.type='button';
  const compareQuick=el('button','',tr('Confronta due copie…','Compare two copies…'));compareQuick.type='button';
  syncActions.append(openDevices,compareQuick);
  cloudCard.append(syncActions);
  syncOut.append(thisDeviceCard,cloudCard);

  const status=el('p');status.id='nm-map-share-status';status.setAttribute('role','status');
  const scroll=el('div','nm-share-scroll');
  scroll.tabIndex=0;
  scroll.setAttribute('aria-labelledby','nm-map-share-title');
  scroll.append(mapBar,choices,deviceOut,saveOut,syncOut,status);
  box.append(head,scroll);
  shade.append(box);document.body.append(shade);

  const store=Transfer.createInbox();
  let sealed='',ownerId='',previewToken=0,pendingEncryptedRaw='',pendingEncryptedName='mappa-protetta';
  let lanState={role:isMobile()?'receive':'send',active:false,sessionId:'',mode:'send',host:'',port:0,token:'',certPin:'',expiresAt:0,keys:null,channel:null,peerDevice:'',localApproved:false,peerApproved:false,pushed:false,pulled:false,completed:false,error:'',pollTimer:0,tickTimer:0};

  const stages={device:deviceOut,save:saveOut,sync:syncOut};
  const selected=()=>app.tabs.find(item=>item.id===picker.value)||app.tabs.find(item=>item.id===app.activeTabId);
  function showStage(name){
   for(const [key,node] of Object.entries(stages)) node.hidden=key!==name;
   for(const button of [device,save,sync]) button.setAttribute('aria-pressed',String(button.dataset.stage===name));
  }
  async function stopLanSession(keepRole=true){
   clearInterval(lanState.pollTimer);clearInterval(lanState.tickTimer);
   lanState.pollTimer=0;lanState.tickTimer=0;
   const wasActive=lanState.active;
   lanState={role:keepRole?lanState.role:(isMobile()?'receive':'send'),active:false,sessionId:'',mode:lanState.role,host:'',port:0,token:'',certPin:'',expiresAt:0,keys:null,channel:null,peerDevice:'',localApproved:false,peerApproved:false,pushed:false,pulled:false,completed:false,error:'',pollTimer:0,tickTimer:0};
   if(wasActive&&root.neuromapDesktop?.lanPair?.stop){
    try{await root.neuromapDesktop.lanPair.stop();}catch{}
   }
  }
  async function closeModal(){
   await stopLanSession(false);
   shade.hidden=true;
  }
  function sizeText(bytes){
   const kb=bytes/1024;
   return (bytes>=1024?(kb>=10?String(Math.round(kb)):kb.toFixed(1))+' KB':'< 1 KB');
  }
  function paintPreview(view){
   preview.replaceChildren();
   for(const label of [view.nodes+' '+tr('nodi','nodes'),view.images+' '+tr('allegati','attachments'),sizeText(view.bytes)])
    preview.append(el('span','nm-share-fact-pill',label));
  }
  const fillPicker=()=>{
   app.saveActiveTabSnapshot?.();
   const current=picker.value||app.activeTabId;
   picker.replaceChildren();
   for(const item of app.tabs){
    const option=el('option','',item.state.root?.text||item.title||tr('Mappa','Map'));
    option.value=item.id;picker.append(option);
   }
   if([...picker.options].some(option=>option.value===current))picker.value=current;
  };
  async function buildCopy(){
   app.saveActiveTabSnapshot?.();
   const tab=selected();if(!tab)throw Error('Missing map');
   ownerId=tab.id;
   tab.f11MapId=tab.f11MapId||safeUuid();
   const project=projectFromTab(app,tab);
   const copy=await Transfer.prepareCopy(project,{mapId:tab.f11MapId,deviceId:deviceId(),sha256});
   sealed=Transfer.sealFile(copy.handoff);
   paintPreview(copy.preview);
   return {tab,copy};
  }
  async function refreshPreview(){
   const token=++previewToken;
   try{
    app.saveActiveTabSnapshot?.();
    const tab=selected();if(!tab||token!==previewToken)return;
    tab.f11MapId=tab.f11MapId||safeUuid();
    const project=projectFromTab(app,tab);
    const copy=await Transfer.prepareCopy(project,{mapId:tab.f11MapId,deviceId:deviceId(),sha256});
    if(token!==previewToken)return;
    paintPreview(copy.preview);
   }catch(error){if(token===previewToken)status.textContent=String(error.message||error);}
  }
  function qrFigure(payload){
   const code=root.GlaukaQr?.encode?.(payload);
   if(!code)return null;
   const quiet=4,cell=4,n=code.size+quiet*2;
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('class','nm-share-qr-view');
   svg.setAttribute('viewBox','0 0 '+(n*cell)+' '+(n*cell));
   svg.setAttribute('role','img');
   svg.tabIndex=0;
   svg.setAttribute('aria-label',tr('Codice QR di collegamento Wi-Fi','Wi-Fi pairing QR code'));
   const back=document.createElementNS('http://www.w3.org/2000/svg','rect');
   back.setAttribute('width','100%');back.setAttribute('height','100%');back.setAttribute('fill','#fff');
   svg.append(back);
   for(let y=0;y<code.size;y++)for(let x=0;x<code.size;x++){
    if(!code.modules[y*code.size+x])continue;
    const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x',(x+quiet)*cell);rect.setAttribute('y',(y+quiet)*cell);
    rect.setAttribute('width',cell);rect.setAttribute('height',cell);rect.setAttribute('fill','#111');
    svg.append(rect);
   }
   return svg;
  }
  async function openVerifiedCopy(verified){
   const item=store.receive(verified);
   const before=app.state,beforeId=app.activeTabId,beforeText=before.root.text,beforeColor=before.root.color,beforeUndo=before.undoStack.length;
   const opened=store.accept(item.id);
   if(opened.mayReplace!==false||opened.action!=='open-new')throw Error('Refusing automatic replace');
   const raw=JSON.stringify(opened.project);
   await app.importFile(new File([raw],(app.io?.sanitizeFilename?.(opened.displayName)||'mappa')+'.gk',{type:'application/json'}),{newTab:true});
   const original=app.tabs.find(row=>row.id===beforeId);
   if(!original||original.state.root.text!==beforeText||original.state.root.color!==beforeColor||original.state.undoStack.length!==beforeUndo)
    throw Error('The open map changed while receiving a copy');
  }
  function parseManualTarget(rawAddr,rawCode){
   const txt=String(rawAddr||'').trim();
   if(txt.startsWith('{')){
    const q=JSON.parse(txt);
    if(q&&q.h&&q.p&&q.t)return {host:String(q.h),port:Number(q.p),token:String(q.t),pin:String(q.f||''),peerJwk:q.k||null,mode:q.m||'send',sessionId:String(q.s||'')};
   }
   const parts=txt.split(/\s+/);
   let addr=parts[0]||'',tok=String(rawCode||parts[1]||'').trim().toUpperCase();
   const m=addr.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{4,5})$/);
   if(!m||tok.length<4)throw Error(tr('Inserisci indirizzo IP:porta (es. 192.168.1.42:54120) e codice di 6 caratteri','Enter IP:port (e.g. 192.168.1.42:54120) and 6-character code'));
   return {host:m[1],port:Number(m[2]),token:tok,pin:'',peerJwk:null,mode:lanState.role==='send'?'receive':'send',sessionId:''};
  }
  async function startDesktopLan(role){
   await stopLanSession(false);
   lanState.role=role;lanState.mode=role;
   paintDevice();
   const bridge=root.neuromapDesktop?.lanPair;
   if(!bridge?.start)return;
   try{
    const keys=await Transfer.pairKeys();
    const res=await bridge.start({mode:role,senderJwk:keys.publicJwk,deviceName:devNameInput.value||deviceNameDefault()});
    lanState.active=true;lanState.sessionId=res.sessionId;lanState.host=res.host;lanState.port=res.port;
    lanState.token=res.token;lanState.certPin=res.certPin;lanState.expiresAt=Date.parse(res.expiresAt);
    lanState.keys=keys;lanState.error='';
    paintDevice();
    lanState.tickTimer=setInterval(()=>{
     if(!lanState.active)return;
     if(Date.now()>=lanState.expiresAt){stopLanSession(true);lanState.error=tr('Collegamento scaduto. Premi Riprova per generarne uno nuovo.','Session expired. Click retry for a new link.');}
     paintDevice();
    },1000);
    lanState.pollTimer=setInterval(()=>pollDesktopLan(),1100);
   }catch(err){
    lanState.error=String(err.message||err);
    paintDevice();
   }
  }
  async function pollDesktopLan(){
   const bridge=root.neuromapDesktop?.lanPair;
   if(!bridge?.poll||!lanState.active||!lanState.sessionId)return;
   try{
    const st=await bridge.poll(lanState.sessionId);
    if(!st.active&&(st.state==='cancelled'||st.state==='rejected'||st.state==='expired')){
     await stopLanSession(true);
     lanState.error=st.state==='rejected'?tr('L’altro dispositivo ha rifiutato.','The other device refused.'):tr('Sessione terminata.','Session ended.');
     paintDevice();return;
    }
    if(st.paired&&st.peerJwk&&!lanState.channel){
     lanState.peerDevice=st.peerDevice||tr('Telefono','Phone');
     lanState.channel=await Transfer.deriveLanChannel(lanState.keys.privateKey,st.peerJwk,lanState.certPin,lanState.sessionId);
     paintDevice();
    }
    lanState.peerApproved=!!st.peerApprove;
    if(lanState.role==='send'&&lanState.localApproved&&!lanState.pushed&&lanState.channel){
     lanState.pushed=true;
     const {copy}=await buildCopy();
     const chunks=await lanState.channel.encryptProject(copy.handoff);
     await bridge.push(lanState.sessionId,chunks,'approve');
     status.textContent=tr('Mappa cifrata pronta per il telefono…','Encrypted map ready for phone…');
    }
    if(lanState.role==='receive'&&lanState.localApproved&&st.state==='accepted'&&!lanState.pulled&&lanState.channel){
     lanState.pulled=true;
     const pulled=await bridge.pull(lanState.sessionId);
     const verified=await lanState.channel.decryptChunks(pulled.chunks,sha256);
     await openVerifiedCopy(verified);
     lanState.completed=true;lanState.active=false;
     clearInterval(lanState.pollTimer);clearInterval(lanState.tickTimer);
     status.textContent=tr('Mappa ricevuta dal telefono e aperta in una nuova scheda ✓','Map received from phone in a new tab ✓');
    }
    if(lanState.role==='send'&&st.state==='accepted'&&!lanState.completed){
     lanState.completed=true;lanState.active=false;
     clearInterval(lanState.pollTimer);clearInterval(lanState.tickTimer);
     status.textContent=tr('Mappa ricevuta dal telefono ✓','Map delivered to phone ✓');
    }
    paintDevice();
   }catch(err){
    lanState.error=String(err.message||err);
    paintDevice();
   }
  }
  function paintDevice(){
   deviceOut.replaceChildren();
   const cardBox=el('section','nm-share-panel-card');
   const dirGrid=el('div','nm-share-dir-grid');
   const mkDir=(role,titleTxt,subTxt)=>{
    const b=el('button','nm-share-dir-btn');b.type='button';
    b.setAttribute('aria-pressed',String(lanState.role===role));
    b.append(el('strong','',titleTxt),el('small','',subTxt));
    b.addEventListener('click',()=>{
     if(isMobile()){stopLanSession(false);lanState.role=role;paintDevice();}
     else startDesktopLan(role);
    });
    return b;
   };
   const isPhone=isMobile()&&Boolean(root.GlaukaLanPair?.request);
   if(isPhone){
    dirGrid.append(
     mkDir('receive',tr('Ricevi dal PC / Mac','Receive from PC / Mac'),tr('Apre sul telefono una mappa dal computer','Receives an encrypted map onto phone')),
     mkDir('send',tr('Invia al PC / Mac','Send to PC / Mac'),tr('Trasferisce questa mappa al computer (senza QR/webcam)','Sends active phone map directly to PC'))
    );
   }else{
    dirGrid.append(
     mkDir('send',tr('Invia al Telefono','Send to Phone'),tr('Mostra QR e codice Wi-Fi per il telefono','Shows Wi-Fi QR & pairing code for phone')),
     mkDir('receive',tr('Ricevi dal Telefono','Receive from Phone'),tr('Attende una mappa dal telefono sulla stessa Wi-Fi','Receives encrypted map from phone over Wi-Fi'))
    );
   }
   cardBox.append(dirGrid);

   const steps=el('div','nm-share-steps');
   for(const [num,txt] of [
    ['1 · '+tr('Stessa Wi-Fi','Same Wi-Fi'),tr('Apri Condividi mappa → PC ↔ Telefono su entrambi (zero server esterni).','Open Share map → PC ↔ Phone on both devices (zero external servers).')],
    ['2 · '+tr('Collega','Pair'),tr('Usa QR o inserisci indirizzo Wi-Fi e codice mostrati dal computer.','Use QR or type Wi-Fi address & pairing code shown by computer.')],
    ['3 · '+tr('Verifica 6 cifre','Verify 6 digits'),tr('Controlla il codice di sicurezza prima che i file cifrati partano.','Confirm the 6-digit security code before encrypted transfer starts.')]
   ]){
    const step=el('div','nm-share-step');
    step.append(el('strong','',num),document.createTextNode(txt));
    steps.append(step);
   }
   cardBox.append(steps);

   // Mobile client flow (connects over TLS LAN directly to PC)
   if(isPhone){
    if(lanState.completed){
     cardBox.append(el('p','nm-share-phase',lanState.role==='send'?tr('Mappa inviata al computer in modo cifrato ✓','Map sent encrypted to computer ✓'):tr('Mappa ricevuta e aperta in una nuova scheda ✓','Map received in a new tab ✓')));
     deviceOut.append(cardBox);return;
    }
    if(!lanState.channel){
     cardBox.append(el('p','',lanState.role==='receive'
      ?tr('Sul computer apri Condividi mappa → PC ↔ Telefono → Invia al Telefono, poi inserisci i dati mostrati dallo schermo del PC:','On PC open Share map → PC ↔ Phone → Send to Phone, then enter the pairing info shown:')
      :tr('Sul computer apri Condividi mappa → PC ↔ Telefono → Ricevi dal Telefono, poi inserisci indirizzo e codice mostrati dal PC:','On PC open Share map → PC ↔ Phone → Receive from Phone, then enter address & code shown on PC:')));
     const formRow=el('div','nm-share-inline-form');
     const addrLbl=el('label');addrLbl.append(el('span','',tr('Indirizzo Wi-Fi del PC (o QR incollato)','PC Wi-Fi address (or pasted QR)')));
     const addrIn=el('input');addrIn.placeholder='192.168.1.42:54120';addrIn.value=lanState.host&&lanState.port?(lanState.host+':'+lanState.port):'';
     addrLbl.append(addrIn);
     const codeLbl=el('label');codeLbl.append(el('span','',tr('Codice 6 caratteri','6-char code')));
     const codeIn=el('input');codeIn.placeholder='K7M492';codeIn.maxLength=12;codeIn.style.textTransform='uppercase';codeIn.value=lanState.token||'';
     codeLbl.append(codeIn);
     formRow.append(addrLbl,codeLbl);
     const connectRow=el('div','nm-share-action-row');
     const connectBtn=el('button','nm-share-primary',tr('Collega al PC','Connect to PC'));connectBtn.type='button';
     connectBtn.addEventListener('click',async()=>{
      connectBtn.disabled=true;lanState.error='';
      try{
       const target=parseManualTarget(addrIn.value,codeIn.value);
       const keys=await Transfer.pairKeys();
       const res=await androidLanRequest(target.host,target.port,target.pin,'/f11/v1/hello',{token:target.token,publicJwk:keys.publicJwk,deviceName:devNameInput.value||deviceNameDefault()});
       if(!res.ok)throw Error((()=>{try{return JSON.parse(res.body||'{}').message;}catch{return '';}})()||res.message||tr('Collegamento rifiutato','Pairing rejected'));
       const payload=JSON.parse(res.body||'{}');
       const ch=await Transfer.deriveLanChannel(keys.privateKey,payload.senderJwk,res.certPin,target.sessionId||res.certPin);
       lanState={...lanState,active:true,host:target.host,port:target.port,token:target.token,certPin:res.certPin,keys,channel:ch,peerDevice:payload.senderDevice||'PC',mode:payload.mode||lanState.role};
       paintDevice();
      }catch(err){lanState.error=String(err.message||err);paintDevice();}
      finally{connectBtn.disabled=false;}
     });
     connectRow.append(connectBtn);
     cardBox.append(formRow,connectRow);
     if(lanState.error)cardBox.append(el('p','nm-share-wait',lanState.error));
     deviceOut.append(cardBox);return;
    }
    const verify=el('div','nm-share-verify');
    verify.append(
     el('span','',tr('Codice di sicurezza Wi-Fi','Wi-Fi security code')),
     el('strong','nm-share-code',lanState.channel.confirmCode),
     el('p','nm-share-wait',tr('Controlla che questo numero identico compaia anche su ','Confirm this exact code appears on ')+lanState.peerDevice)
    );
    const goBtn=el('button','nm-share-primary',lanState.role==='send'?tr('Conferma codice e invia mappa ✓','Confirm code & send map ✓'):tr('Conferma codice e ricevi mappa ✓','Confirm code & receive map ✓'));
    goBtn.type='button';
    goBtn.addEventListener('click',async()=>{
     goBtn.disabled=true;status.textContent=tr('Conferma e trasferimento cifrato in corso…','Confirming and transferring encrypted…');
     try{
      const dec=await androidLanRequest(lanState.host,lanState.port,lanState.certPin,'/f11/v1/decision',{token:lanState.token,decision:'approve'});
      if(!dec.ok)throw Error(tr('Conferma rifiutata','Confirmation refused'));
      if(lanState.role==='send'){
       const {copy}=await buildCopy();
       const chunks=await lanState.channel.encryptProject(copy.handoff);
       for(const ch of chunks){
        const up=await androidLanRequest(lanState.host,lanState.port,lanState.certPin,'/f11/v1/chunk',{token:lanState.token,...ch});
        if(!up.ok)throw Error(tr('Invio bloccato: premi prima Conferma sul PC','Waiting for confirmation on PC first'));
       }
       lanState.completed=true;paintDevice();
       status.textContent=tr('Mappa inviata al computer ✓','Map sent to computer ✓');
      }else{
       const got=[];let idx=0;
       for(;;){
        const chRes=await androidLanRequest(lanState.host,lanState.port,lanState.certPin,'/f11/v1/chunk',{token:lanState.token,index:idx});
        if(chRes.status===202){await new Promise(r=>setTimeout(r,900));continue;}
        if(!chRes.ok)throw Error(tr('Premi prima Conferma sullo schermo del PC e riprova','Click Confirm on PC first, then tap again'));
        const ch=JSON.parse(chRes.body||'{}');
        got.push(ch);idx++;
        if(idx>=ch.total)break;
       }
       await androidLanRequest(lanState.host,lanState.port,lanState.certPin,'/f11/v1/decision',{token:lanState.token,decision:'accept'});
       const verified=await lanState.channel.decryptChunks(got,sha256);
       await openVerifiedCopy(verified);
       lanState.completed=true;paintDevice();
       status.textContent=tr('Mappa ricevuta e aperta in una nuova scheda ✓','Map received in a new tab ✓');
      }
     }catch(err){status.textContent=String(err.message||err);}
     finally{goBtn.disabled=false;}
    });
    verify.append(goBtn);cardBox.append(verify);deviceOut.append(cardBox);return;
   }

   // Desktop flow (hosts local TLS LAN endpoint, or shows crisp preview notice when in static web browser)
   if(!root.neuromapDesktop?.lanPair?.start){
    cardBox.append(
     el('p','nm-share-phase',tr('Disponibile nell’app Glauka Desktop e Android','Available in Glauka Desktop & Android apps')),
     el('p','',tr('In questa anteprima web statica usa "Invia o apri file" per salvare un file .json o cifrato con password AES-256.',
      'In this static browser preview, use "Send or open file" to export a .json or AES-256 password file.'))
    );
    deviceOut.append(cardBox);return;
   }
   if(lanState.completed){
    cardBox.append(el('p','nm-share-phase',lanState.role==='send'?tr('Mappa consegnata al telefono ✓','Map delivered to phone ✓'):tr('Mappa ricevuta dal telefono ✓','Map received from phone ✓')));
    deviceOut.append(cardBox);return;
   }
   if(!lanState.active){
    const startBtn=el('button','nm-share-primary',tr('Avvia collegamento Wi-Fi locale','Start local Wi-Fi link'));
    startBtn.type='button';startBtn.addEventListener('click',()=>startDesktopLan(lanState.role));
    cardBox.append(startBtn);
    if(lanState.error)cardBox.append(el('p','nm-share-wait',lanState.error));
    deviceOut.append(cardBox);return;
   }
   const left=Math.max(0,Math.ceil((lanState.expiresAt-Date.now())/1000));
   if(!lanState.channel){
    cardBox.append(el('p','nm-share-phase',tr('In attesa del telefono su Wi-Fi locale · ','Waiting for phone on local Wi-Fi · ')+left+' s'));
    const pairGrid=el('div','nm-share-pair-grid');
    const qrPayload=JSON.stringify({v:2,m:lanState.role,s:lanState.sessionId,h:lanState.host,p:lanState.port,t:lanState.token,f:lanState.certPin,k:lanState.keys.publicJwk});
    const figure=qrFigure(qrPayload);
    const qrWrap=el('div');if(figure)qrWrap.append(figure);
    const creds=el('div','nm-share-creds');
    creds.append(
     el('div','nm-share-cred-pill',undefined),
     el('div','nm-share-cred-pill',undefined)
    );
    const pills=creds.querySelectorAll('.nm-share-cred-pill');
    pills[0].append(el('span','',tr('Indirizzo Wi-Fi','Wi-Fi Address')),document.createTextNode(lanState.host+':'+lanState.port));
    pills[1].append(el('span','',tr('Codice','Code')),document.createTextNode(lanState.token));
    const copyCreds=el('button','',tr('Copia collegamento','Copy link data'));copyCreds.type='button';
    copyCreds.addEventListener('click',()=>{navigator.clipboard?.writeText?.(qrPayload);copyCreds.textContent=tr('Copiato ✓','Copied ✓');});
    creds.append(copyCreds);
    pairGrid.append(qrWrap,creds);
    cardBox.append(pairGrid);
   }else{
    cardBox.append(el('p','nm-share-phase',lanState.peerDevice+' '+tr('collegato su Wi-Fi locale ✓','connected over local Wi-Fi ✓')));
    const verify=el('div','nm-share-verify');
    verify.append(
     el('span','',tr('Codice di sicurezza (6 cifre)','Security verification code')),
     el('strong','nm-share-code',lanState.channel.confirmCode),
     el('p','nm-share-wait',tr('Controlla che sul telefono compaia questo stesso codice, poi premi Conferma su entrambi.','Confirm this exact code on your phone, then click Confirm on both devices.'))
    );
    if(!lanState.localApproved){
     const approveBtn=el('button','nm-share-primary',tr('Conferma e trasferisci ✓','Confirm & transfer ✓'));
     approveBtn.type='button';
     approveBtn.addEventListener('click',async()=>{
      lanState.localApproved=true;paintDevice();
      if(lanState.role==='receive'){await root.neuromapDesktop.lanPair.push(lanState.sessionId,[],'approve');}
      await pollDesktopLan();
     });
     verify.append(approveBtn);
    }else{
     verify.append(el('p','nm-share-wait',lanState.peerApproved?tr('Trasferimento cifrato in corso…','Encrypted transfer in progress…'):tr('Confermato ✓ Ora tocca Conferma sul telefono.','Confirmed ✓ Now tap Confirm on your phone.')));
    }
    cardBox.append(verify);
   }
   deviceOut.append(cardBox);
  }

  launch.addEventListener('click',()=>{
   app.hideMenus?.();fillPicker();
   stopLanSession(false);
   showStage('save');
   decryptBox.hidden=true;status.textContent='';shade.hidden=false;picker.focus();
   refreshPreview();
  });
  picker.addEventListener('change',()=>{refreshPreview();});
  close.addEventListener('click',()=>{closeModal();});
  shade.addEventListener('click',event=>{if(event.target===shade)closeModal();});
  shade.addEventListener('keydown',event=>{
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();closeModal();return;}
   if(event.target.closest('input,textarea,select'))return;
   const scroller=shade.querySelector('.nm-share-scroll');
   if(!scroller)return;
   const pageStep=Math.max(48,scroller.clientHeight-32);
   const step=event.key==='ArrowDown'?48:event.key==='ArrowUp'?-48:event.key==='PageDown'?pageStep:event.key==='PageUp'?-pageStep:0;
   if(event.key==='Home'||event.key==='End'||step){
    event.preventDefault();
    if(event.key==='Home')scroller.scrollTop=0;
    else if(event.key==='End')scroller.scrollTop=scroller.scrollHeight;
    else scroller.scrollBy({top:step});
   }
  });
  save.addEventListener('click',()=>{stopLanSession(true);showStage('save');status.textContent='';});
  exportBtn.addEventListener('click',async()=>{
   showStage('save');exportBtn.disabled=true;
   try{
    await buildCopy();
    const tab=app.tabs.find(item=>item.id===ownerId);
    const name=(app.io?.sanitizeFilename?.(tab?.state.root.text||'mappa')||'mappa')+'-glauka-copy.json';
    app.io.triggerDownload(new Blob([sealed],{type:'application/json;charset=utf-8'}),name);
    status.textContent=tr('File salvato in locale. Puoi inviarlo a telefono, PC o altre persone.','File saved locally. You can send it to phone, PC or others.');
   }catch{status.textContent=tr('Esportazione non riuscita.','Export did not work.');}
   finally{exportBtn.disabled=false;}
  });
  encBtn.addEventListener('click',async()=>{
   encBtn.disabled=true;
   try{
    const {tab,copy}=await buildCopy();
    const locked=await Transfer.sealPasswordFile(copy.handoff,passInput.value);
    const name=(app.io?.sanitizeFilename?.(tab?.state.root.text||'mappa')||'mappa')+'-glauka-protetto.glk';
    app.io.triggerDownload(new Blob([locked],{type:'application/json;charset=utf-8'}),name);
    passInput.value='';
    status.textContent=tr('Copia cifrata con password AES-256 salvata (.glk).','Password-encrypted copy saved (.glk).');
   }catch(err){status.textContent=String(err.message||err);}
   finally{encBtn.disabled=false;}
  });
  htmlShareBtn.addEventListener('click',async()=>{
   await closeModal();
   if(app._nmShare73?.open){app._nmShare73.open();return;}
   const deskBtn=document.getElementById('nm-share-export-open');
   if(deskBtn){deskBtn.click();return;}
   if(root.NeuroMapAndroid74?.show){root.NeuroMapAndroid74.open?.();root.NeuroMapAndroid74.show('share');return;}
   if(root.NeuroMapShareHTML?.render&&app.io){
    const tab=selected();
    if(tab?.state?.root){
     const html=root.NeuroMapShareHTML.render(tab.state.root,{notes:false,links:false});
     const name=(app.io.sanitizeFilename?.(tab.state.root.text||'mappa')||'mappa')+'.html';
     app.io.triggerDownload(new Blob([html],{type:'text/html;charset=utf-8'}),name);
    }
   }
  });
  device.addEventListener('click',()=>{
   showStage('device');status.textContent='';
   if(isMobile())paintDevice();
   else startDesktopLan(lanState.role||'send');
  });
  sync.addEventListener('click',()=>{stopLanSession(true);showStage('sync');status.textContent='';});
  openDevices.addEventListener('click',async()=>{
   await closeModal();
   if(isMobile()){
    if(root.NeuroMapLifecycle?.androidOpenProject)await root.NeuroMapLifecycle.androidOpenProject(null);
    else document.getElementById('btn-import-files-new-tabs')?.click();
    return;
   }
   (document.getElementById('gl-cloud-open')||document.getElementById('gl-cloud-quick'))?.click();
  });
  compareQuick.addEventListener('click',async()=>{
   await closeModal();
   const deskEx=document.getElementById('nm-exchange-open');
   if(deskEx){deskEx.click();return;}
   if(root.NeuroMapAndroid74?.show){root.NeuroMapAndroid74.open?.();root.NeuroMapAndroid74.show('exchange');}
  });
  file.addEventListener('change',async()=>{
   const chosen=file.files?.[0];if(!chosen)return;
   const ext=(chosen.name.split('.').pop()||'').toLowerCase();
   decryptBox.hidden=true;
   try{
    if(ext==='json'||ext==='glk'){
     const text=await chosen.text();
     if(Transfer.isPasswordFile(text)){
      pendingEncryptedRaw=text;pendingEncryptedName=chosen.name;
      decPass.value='';decryptBox.hidden=false;decPass.focus();
      status.textContent=tr('Inserisci la password per aprire il file cifrato.','Enter password to unlock encrypted file.');
      return;
     }
     try{
      const verified=await Transfer.openFile(text,sha256);
      await openVerifiedCopy(verified);
      status.textContent=chosen.name+' · '+tr('aperta in una nuova scheda ✓','opened in a new tab ✓');
      return;
     }catch(_notHandoff){}
    }
    if(typeof app.importFile==='function'){
     const count=await app.importFile(chosen,{newTab:true});
     const openedTab=app.tabs.find(item=>item.id===app.activeTabId);
     if(openedTab&&count>0){
      openedTab.fileName=chosen.name;
      root.NeuroMapLifecycle?.recordAndroidRecent?.({name:chosen.name,docId:null,writable:false,persistent:false});
     }
     status.textContent=chosen.name+' · '+count+' '+tr('nodi aperti in una nuova scheda.','nodes opened in a new tab.');
    }
   }catch(error){status.textContent=String(error.message||error);}
  });
  decOpen.addEventListener('click',async()=>{
   try{
    const verified=await Transfer.openPasswordFile(pendingEncryptedRaw,decPass.value,sha256);
    await openVerifiedCopy(verified);
    decryptBox.hidden=true;decPass.value='';pendingEncryptedRaw='';
    status.textContent=pendingEncryptedName+' · '+tr('sbloccata e aperta in una nuova scheda ✓','unlocked and opened in a new tab ✓');
   }catch(err){status.textContent=String(err.message||err);}
  });
  app._nmMapShare={open:()=>launch.click(),openStage:name=>{launch.click();if(stages[name])showStage(name);},inbox:store};
 }
 function boot(){
  if(typeof NeuroMapApp==='undefined')return false;
  install(NeuroMapApp);return true;
 }
 if(!boot()){
  const timer=setInterval(()=>{if(boot())clearInterval(timer);},50);
  setTimeout(()=>clearInterval(timer),10000);
 }
})(globalThis);
