/* 7.3 Export Studio — user-triggered HTML and ICS exports only.
 * Never uploads documents; sharing a downloaded file is the user's action.
 */
(function(root){
 'use strict';
 const Share=root.NeuroMapShareHTML,Calendar=root.NeuroMapTaskCalendar;
 if(!Share||!Calendar)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const css=[
 '#nm-v73-share[hidden]{display:none!important}',
 '#nm-v73-share{position:fixed;inset:0;z-index:2150;display:grid;place-items:center;background:#010817d8;padding:14px}',
 '#nm-v73-share .nm-v73-window{box-sizing:border-box;display:grid;gap:14px;width:min(620px,100%);max-height:94dvh;overflow:auto;padding:22px;color:#f0f8ff;background:linear-gradient(135deg,#0e2754,#07142c);border:1px solid #428cd9;border-radius:20px;box-shadow:0 22px 70px #000b}',
 '#nm-v73-share .nm-v73-head{display:flex;justify-content:space-between;gap:10px;align-items:center}',
 '#nm-v73-share .nm-v73-head strong{font-size:18px}',
 '#nm-v73-share .nm-v73-group{display:grid;gap:9px;padding:12px;border:1px solid #315984;border-radius:12px;background:#0a1c37}',
 '#nm-v73-share .nm-v73-group label{display:flex;align-items:center;gap:8px;font-size:13px}',
 '#nm-v73-share small,#nm-v73-share [role=status]{color:#b5d2f4;font:12px/1.5 system-ui;overflow-wrap:anywhere}',
 '#nm-v73-share .nm-v73-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
 '#nm-v73-share button{cursor:pointer;padding:9px 12px;border-radius:9px;border:1px solid #428cd9;color:#fff;background:#123a75}',
 '#nm-v73-share button.primary{background:linear-gradient(115deg,#086ece,#563fbd);font-weight:700}',
 '#nm-v73-share button:focus-visible,#nm-v73-share input:focus-visible{outline:2px solid #65dbff;outline-offset:3px}',
 '#nm-v73-share button:disabled{opacity:.55;cursor:default}'
 ].join('\n');
 function install(App){
  const prior=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const outcome=prior.apply(this,args);mount(this);return outcome};
 }
 function mount(app){
  if(app._nmShare73)return;
  const menu=document.getElementById('dropdown-file');if(!menu)return;
  if(!document.getElementById('nm-v73-share-css')){
   const style=el('style');style.id='nm-v73-share-css';style.textContent=css;document.head.append(style);
  }
  const launch=el('button','dropdown-item',tr('Condividi · HTML / Calendario…','Share · HTML / Calendar…'));
  launch.type='button';launch.id='nm-share-export-open';
  const expBtn=document.getElementById('nm-export-launch')||menu.querySelector('.export-subgrid');
  if(expBtn&&expBtn.parentElement===menu)expBtn.after(launch);else menu.append(launch);
  const overlay=el('div');overlay.id='nm-v73-share';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label',tr('Esportazioni portatili','Portable exports'));
  const panel=el('section','nm-v73-window'),top=el('div','nm-v73-head');
  const title=el('strong','',tr('NeuroMap · Condivisione offline','NeuroMap · Offline sharing'));
  const close=el('button','','×');close.type='button';close.setAttribute('aria-label',tr('Chiudi','Close'));top.append(title,close);
  const help=el('small','',tr('Esporta soltanto la mappa della scheda attiva. Nessuna pubblicazione online o sincronizzazione automatica.',
   'Exports the active tab only. No online publishing or automatic synchronization.'));
  const html=el('section','nm-v73-group'),htmlTitle=el('strong','',tr('HTML interattivo · sola lettura','Interactive HTML · read-only'));
  const notesLabel=el('label'),notes=el('input');notes.type='checkbox';
  notesLabel.append(notes,document.createTextNode(tr(' Includi le note dei nodi',' Include node notes')));
  const linksLabel=el('label'),links=el('input');links.type='checkbox';
  linksLabel.append(links,document.createTextNode(tr(' Includi link esterni HTTP(S)',' Include external HTTP(S) links')));
  const privacy=el('small','',tr('Per sicurezza, note e link sono esclusi in partenza. Non esporta immagini, PDF, hash delle fonti o dati di studio.',
   'Notes and links are excluded by default. No pictures, PDFs, source hashes or study data are exported.'));
  const htmlAction=el('button','primary',tr('Esporta HTML navigabile','Export navigable HTML'));
  htmlAction.type='button';html.append(htmlTitle,notesLabel,linksLabel,privacy,htmlAction);
  const calendar=el('section','nm-v73-group'),calendarTitle=el('strong','',tr('Attività · Calendario .ics','Tasks · .ics Calendar'));
  const calendarHelp=el('small','',tr('Esporta solo attività con date esplicite come eventi giornalieri. Nessuna notifica automatica; scadenze invalide vengono escluse e segnalate.',
   'Only explicitly dated tasks become all-day events. No automatic reminders; invalid dates are excluded and reported.'));
  const report=el('small',''),icsAction=el('button','',tr('Esporta calendario .ics','Export .ics Calendar'));
  icsAction.type='button';calendar.append(calendarTitle,calendarHelp,report,icsAction);
  const status=el('p');status.setAttribute('role','status');
  panel.append(top,help,html,calendar,status);overlay.append(panel);document.body.append(overlay);
  let currentState=null,currentTab='';
  const live=()=>!overlay.hidden&&currentState===app.state&&currentTab===app.activeTabId;
  const end=()=>{overlay.hidden=true;currentState=null};
  const open=()=>{
   app.hideMenus?.();currentState=app.state;currentTab=app.activeTabId;
   notes.checked=false;links.checked=false;status.textContent='';overlay.hidden=false;
   try{
    const info=Calendar.inspect(currentState.root);
    report.textContent=tr('Attività con data: ','Dated tasks: ')+info.entries.length+
     tr(' · senza date: ',' · undated: ')+info.issues.undated+
     tr(' · date invertite: ',' · inverted dates: ')+info.issues.inverted;
    icsAction.disabled=!info.entries.length;
   }catch(e){report.textContent=String(e.message||e);icsAction.disabled=true}
   htmlAction.disabled=!currentState?.root;
   htmlAction.focus();
  };
  launch.addEventListener('click',open);close.addEventListener('click',end);
  overlay.addEventListener('click',e=>{if(e.target===overlay)end()});
  overlay.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')end()});
  const base=()=>app.io.sanitizeFilename(currentState.root.text||'map').slice(0,70);
  htmlAction.addEventListener('click',()=>{
   if(!live()){status.textContent=tr('La scheda è cambiata. Riapri la finestra.','Tab changed. Reopen dialog.');return}
   try{
    const output=Share.render(currentState.root,{notes:notes.checked,links:links.checked});
    app.io.triggerDownload(new Blob([output],{type:'text/html;charset=utf-8'}),base()+'.html');
    status.textContent=tr('File HTML creato localmente. Condividi il file solo se vuoi renderne visibili i contenuti.',
     'HTML created locally. Share it only if you want others to see its contents.');
   }catch(e){status.textContent=tr('Impossibile esportare: ','Export failed: ')+String(e.message||e)}
  });
  icsAction.addEventListener('click',()=>{
   if(!live()){status.textContent=tr('La scheda è cambiata. Riapri la finestra.','Tab changed. Reopen dialog.');return}
   try{
    const output=Calendar.render(currentState.root);
    app.io.triggerDownload(new Blob([output.content],{type:'text/calendar;charset=utf-8'}),base()+'.ics');
    status.textContent=tr('Esportate ','Exported ')+output.count+
     tr(' attività. Senza data: ',' tasks. Undated: ')+output.issues.undated+
     tr('; date invertite: ','; inverted dates: ')+output.issues.inverted;
   }catch(e){status.textContent=tr('Impossibile esportare: ','Export failed: ')+String(e.message||e)}
  });
  app._nmShare73={open,close:end};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
