/* NeuroMap 8.2 — read-only knowledge/project dashboard for desktop and Android. */
(function(root){
 'use strict';
 const Core=root.NeuroMapDashboard82;
 if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const make=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
 const css=[
 '.nm82-dashboard{font:13px/1.5 system-ui;color:#edf6ff;display:flex;flex-direction:column;gap:12px;min-width:0}',
 '.nm82-dashboard button,.nm82-dashboard input{box-sizing:border-box;min-height:44px;max-width:100%;border:1px solid #578fc1;border-radius:10px;background:#15345b;color:#fff;padding:9px;font:inherit}',
 '.nm82-dashboard button{cursor:pointer;text-align:left;overflow-wrap:anywhere}',
 '.nm82-dashboard button:focus-visible,.nm82-dashboard input:focus-visible{outline:3px solid #7be4fa;outline-offset:2px}',
 '.nm82-dashboard .nm82-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr));gap:8px}',
 '.nm82-dashboard .nm82-card{border:1px solid #3c6493;border-radius:12px;background:#0b294c;padding:12px;min-width:0}',
 '.nm82-dashboard .nm82-card strong{display:block;font-size:24px;font-variant-numeric:tabular-nums}',
 '.nm82-dashboard .nm82-card span{color:#bdd5ee;overflow-wrap:anywhere}',
 '.nm82-dashboard .nm82-list{display:flex;flex-direction:column;gap:5px;max-height:210px;overflow:auto;overscroll-behavior:contain}',
 '.nm82-dashboard .nm82-list button:disabled{opacity:.65;cursor:not-allowed}',
 '.nm82-dashboard .nm82-muted{color:#bdd5ee;margin:0;overflow-wrap:anywhere}',
 '.nm82-dashboard .nm82-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end}',
 '.nm82-dashboard .nm82-toolbar label{display:flex;flex-direction:column;gap:4px}',
 '#nm82-overlay[hidden]{display:none!important}',
 '#nm82-overlay{position:fixed;inset:0;z-index:2275;background:#030b1be0;display:grid;place-items:center;padding:12px}',
 '#nm82-overlay .nm82-dialog{box-sizing:border-box;width:min(850px,100%);max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #4e83b6;border-radius:18px;background:#081e39;padding:16px;color:#fff}',
 '#nm82-overlay .nm82-head{display:flex;align-items:center;justify-content:space-between;gap:10px}',
 '#nm82-overlay .nm82-head h2{font:700 19px system-ui;margin:0}',
 '#nm82-overlay .nm82-head button{min-height:44px;min-width:44px;background:#163d6a;color:#fff;border:1px solid #6197ca;border-radius:10px;cursor:pointer}',
 '@media(max-width:420px){#nm82-overlay{padding:5px}#nm82-overlay .nm82-dialog{padding:10px;max-height:calc(100dvh - 10px)}}',
 '@media(prefers-reduced-motion:reduce){.nm82-dashboard *,#nm82-overlay *{scroll-behavior:auto!important;transition:none!important}}'
 ].join('\n');
 function style(){
  if(document.getElementById('nm82-style'))return;
  const s=make('style');s.id='nm82-style';s.textContent=css;document.head.append(s);
 }
 function renderInto(host,app,{compact=false,onNavigate}={}){
  style();host.replaceChildren();
  const wrap=make('section','nm82-dashboard');
  const intro=make('p','nm82-muted',tr('Solo dati delle mappe aperte. Nessuna attività o percentuale stimata.',
   'Open-map data only. No estimated activity or completion percentages.'));
  const toolbar=make('div','nm82-toolbar'),dateLabel=make('label','',tr('Data di riferimento','Reference date'));
  const date=make('input');date.type='date';date.value=Core.localDay();
  dateLabel.append(date);
  const refresh=make('button','',tr('Aggiorna dati','Refresh data'));refresh.type='button';
  toolbar.append(dateLabel,refresh);
  const cards=make('div','nm82-cards'),sections=make('div'),status=make('p','nm82-muted');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  wrap.append(intro,toolbar,cards,sections,status);host.append(wrap);
  const card=(label,count)=>{
   const el=make('div','nm82-card');el.append(make('strong','',String(count)),make('span','',label));cards.append(el);
  };
  const block=(label,key,total,items)=>{
   const section=make('section'),heading=make('h3','',label+' · '+total);
   heading.style.font='700 15px system-ui';
   const list=make('div','nm82-list');
   for(const row of items){
    const caption=row.title||tr('(senza titolo)','(untitled)');
    const detail=[row.dueDate,row.dailyKey,row.taskStatus].filter(Boolean).join(' · ');
    const button=make('button','',caption+(detail?' — '+detail:''));
    button.type='button';button.disabled=!row.navigable;
    if(!row.navigable)button.title=tr('ID duplicato: navigazione disattivata','Duplicate ID: navigation disabled');
    button.addEventListener('click',()=>{
     const target=app.tabs?.find(x=>x.id===row.tabId);
     if(!target?.state?.findNode?.(row.nodeId)){status.textContent=tr('Nodo non più disponibile. Aggiorna.','Node no longer available. Refresh.');return}
     if(typeof onNavigate==='function')onNavigate();
     if(app.activeTabId!==row.tabId)app.activateTab(row.tabId);
     app.selectNode(row.nodeId);app.teleportToNode?.(row.nodeId,row.tabId);
    });
    list.append(button);
   }
   if(!items.length)list.append(make('p','nm82-muted',tr('Nessun elemento registrato.','No recorded entries.')));
   if(total>items.length)list.append(make('p','nm82-muted',tr('Visualizzazione limitata: ','Display capped: ')+items.length+'/'+total));
   section.append(heading,list);sections.append(section);
  };
  function draw(){
   try{
    const snap=Core.snapshot(app.tabs,{today:date.value,limit:compact?12000:40000,maxItems:compact?20:40});
    const s=snap.summary;cards.replaceChildren();sections.replaceChildren();
    card(tr('Mappe aperte','Open maps'),s.openMaps);
    card(tr('Nodi analizzati','Scanned nodes'),s.nodes);
    card(tr('Nodi con tag','Tagged nodes'),s.tagged);
    card(tr('Progetti taggati','Tagged projects'),s.projects);
    card(tr('Attività esplicite','Explicit tasks'),s.tasks);
    card(tr('Da fare','To do'),s.todo);card(tr('In corso','In progress'),s.doing);
    card(tr('Completate','Done'),s.done);card(tr('Senza scadenza','Undated'),s.undated);
    card(tr('Scadute','Overdue'),s.overdue);
    card(tr('Scadenza oggi','Due today'),s.today);
    card(tr('Prossimi 7 giorni','Next 7 days'),s.next7);
    card(tr('Diari datati','Dated daily notes'),s.dailyNotes);
    block(tr('Scadute','Overdue'),'overdue',s.overdue,snap.groups.overdue);
    block(tr('Oggi','Today'),'today',s.today,snap.groups.today);
    block(tr('Entro 7 giorni','Within 7 days'),'next7',s.next7,snap.groups.next7);
    block(tr('Progetti con tag','Tagged projects'),'projects',s.projects,snap.groups.projects);
    block(tr('Diari','Daily notes'),'dailyNotes',s.dailyNotes,snap.groups.dailyNotes);
    status.textContent=snap.partial?tr('Indice parziale: limite di scansione o struttura non valida. I conteggi non rappresentano tutte le mappe.',
     'Partial index: scan limit or invalid hierarchy. Counts do not cover every node.'):
     tr('Indice completo delle mappe aperte, non dei file chiusi.','Complete index of open maps, not closed files.');
    if(s.ambiguousReferences)status.textContent+=' '+s.ambiguousReferences+' '+tr('ID ambigui: navigazione bloccata.','ambiguous IDs: navigation disabled.');
   }catch(error){cards.replaceChildren();sections.replaceChildren();status.textContent=String(error.message||error)}
  }
  refresh.addEventListener('click',draw);date.addEventListener('change',draw);draw();
  return {hasUnsaved:()=>false,refresh:draw};
 }
 function mount(app){
  if(app._nmDashboard82)return;
  const menu=document.getElementById('dropdown-view');if(!menu)return;
  const launch=make('button','dropdown-item',tr('Riepilogo delle mappe…','Map overview…'));
  launch.type='button';launch.id='nm-tool-dashboard';menu.append(launch);
  const shade=make('div');shade.id='nm82-overlay';shade.hidden=true;shade.setAttribute('role','dialog');
  shade.setAttribute('aria-modal','true');shade.setAttribute('aria-labelledby','nm82-title');
  const panel=make('section','nm82-dialog'),head=make('div','nm82-head');
  const title=make('h2','',tr('Riepilogo delle mappe','Map overview'));title.id='nm82-title';
  const close=make('button','','×');close.type='button';close.setAttribute('aria-label',tr('Chiudi','Close'));
  const main=make('div');head.append(title,close);panel.append(head,main);shade.append(panel);document.body.append(shade);
  const shut=()=>{shade.hidden=true;launch.focus()};
  launch.addEventListener('click',()=>{app.hideMenus?.();app.closeEditor?.(true);shade.hidden=false;renderInto(main,app,{onNavigate:shut});close.focus()});
  close.addEventListener('click',shut);shade.addEventListener('click',event=>{if(event.target===shade)shut()});
  shade.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();shut()}});
  app._nmDashboard82={open:()=>launch.click(),close:shut};
 }
 if(typeof NeuroMapApp!=='undefined'){
  const previous=NeuroMapApp.prototype.bindUI;
  NeuroMapApp.prototype.bindUI=function(...args){const out=previous.apply(this,args);mount(this);return out};
 }
 root.NeuroMapDashboardUI82=Object.freeze({renderInto,style});
})(globalThis);