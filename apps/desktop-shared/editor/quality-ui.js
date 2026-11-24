/* 7.4 Quality Center: read-only, actionable integrity report across open maps.
 * Explicit exports only. Does not auto-repair, infer facts or send documents.
 */
(function(root){
 'use strict';
 const Audit=root.NeuroMapQualityCore;if(!Audit)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const css=[
 '#nm-quality74[hidden]{display:none!important}',
 '#nm-quality74{position:fixed;inset:0;z-index:2180;background:#030917d4;display:grid;place-items:center;padding:15px}',
 '#nm-quality74 .nm-quality-window{box-sizing:border-box;display:grid;gap:12px;width:min(820px,100%);max-height:94dvh;overflow:auto;padding:19px;border:1px solid #4788c6;border-radius:17px;background:linear-gradient(135deg,#102a54,#07162c);color:#f0f8ff;box-shadow:0 22px 80px #000b}',
 '#nm-quality74 .nm-quality-header,#nm-quality74 .nm-quality-actions{display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
 '#nm-quality74 h2{font-size:18px;margin:0}',
 '#nm-quality74 .nm-quality-summary{color:#cde6ff;font-size:13px}',
 '#nm-quality74 .nm-quality-controls{display:flex;gap:9px;flex-wrap:wrap}',
 '#nm-quality74 input[type=search]{flex:1;min-width:180px}',
 '#nm-quality74 button,#nm-quality74 select,#nm-quality74 input{min-height:36px;padding:7px 10px;background:#102c57;color:#fff;border:1px solid #4a7fbc;border-radius:9px}',
 '#nm-quality74 button{cursor:pointer}',
 '#nm-quality74 button:focus-visible,#nm-quality74 select:focus-visible,#nm-quality74 input:focus-visible{outline:2px solid #70e4ff;outline-offset:3px}',
 '#nm-quality74 .nm-quality-list{display:grid;gap:7px;max-height:49dvh;min-height:80px;overflow:auto}',
 '#nm-quality74 .nm-quality-entry{padding:10px;border:1px solid #345c8b;background:#10213d;border-radius:11px;display:flex;justify-content:space-between;align-items:center;gap:10px}',
 '#nm-quality74 .nm-quality-content{min-width:0;overflow-wrap:anywhere;display:grid;gap:3px}',
 '#nm-quality74 .nm-quality-entry strong{font-size:13px}',
 '#nm-quality74 .nm-quality-entry small{color:#b9d5ef;font-size:11px;line-height:1.45}',
 '#nm-quality74 .nm-quality-entry[data-level=error]{border-left:4px solid #fb7185}',
 '#nm-quality74 .nm-quality-entry[data-level=warning]{border-left:4px solid #fbbf24}',
 '#nm-quality74 .nm-quality-entry[data-level=info]{border-left:4px solid #39c5ce}',
 '#nm-quality74 [role=status]{font:12px/1.4 system-ui;color:#b6d2ed}'
 ].join('\n');
 function install(App){
  const original=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const value=original.apply(this,args);mount(this);return value};
 }
 function mount(app){
  if(app._nmQuality74)return;
  const tools=document.getElementById('dropdown-tools');if(!tools)return;
  if(!document.getElementById('nm-quality74-style')){
   const s=make('style');s.id='nm-quality74-style';s.textContent=css;document.head.append(s);
  }
  const launch=make('button','dropdown-item',tr('Controlla la mappa…','Check your map…'));
  launch.type='button';launch.id='nm-tool-quality';tools.append(launch);
  const shade=make('div');shade.id='nm-quality74';shade.hidden=true;shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',tr('NeuroMap Quality Center','NeuroMap Quality Center'));
  const panel=make('section','nm-quality-window'),header=make('div','nm-quality-header');
  const heading=make('h2','',tr('Controlla la mappa','Check your map'));
  const close=make('button','',tr('Chiudi','Close'));close.type='button';header.append(heading,close);
  const intro=make('small','',tr('Controlli offline basati soltanto sui dati esistenti. Nessuna informazione viene modificata o caricata online.',
   'Offline checks based only on existing data. No information is modified or uploaded.'));
  const summary=make('div','nm-quality-summary');
  const controls=make('div','nm-quality-controls'),search=make('input');
  search.type='search';search.placeholder=tr('Cerca nei risultati…','Search findings…');
  search.setAttribute('aria-label',search.placeholder);
  const severity=make('select');severity.setAttribute('aria-label',tr('Filtro gravità','Severity filter'));
  for(const [value,it,en]of [['all','Tutti','All'],['error','Errori','Errors'],['warning','Da verificare','Warnings'],['info','Suggerimenti','Suggestions']]){
   const option=make('option','',tr(it,en));option.value=value;severity.append(option);
  }
  controls.append(search,severity);
  const list=make('div','nm-quality-list'),status=make('div');status.setAttribute('role','status');
  const buttons=make('div','nm-quality-actions'),refresh=make('button','',tr('Rianalizza','Re-scan')),download=make('button','',tr('Esporta report JSON','Export JSON report'));
  const repair=make('button','',tr('Ripara prerequisiti mancanti (Undo)','Repair missing prerequisites (Undo)'));
  repair.type='button';
  for(const b of [refresh,download])b.type='button';buttons.append(refresh,repair,download);
  repair.addEventListener('click',async()=>{
   const state=app.state,owner=app.activeTabId;
   let plan;
   try{plan=Audit.missingPredecessorPlan(state.root);}
   catch(error){status.textContent=String(error.message||error);return;}
   if(!plan.length){status.textContent=tr('Nessun riferimento ai prerequisiti da correggere nella scheda attiva.','No missing predecessor references on the active tab.');return;}
   const decision=await app.nmAsk({title:tr('Riparazione prerequisiti','Repair predecessors'),
    message:tr('Nella scheda attiva saranno rimossi ','Only from the active tab, remove ')+
     plan.reduce((count,item)=>count+item.previous.length-item.next.length,0)+
     tr(' collegamenti verso nodi inesistenti o non validi. I nodi restano intatti. Operazione annullabile con Ctrl+Z.',
      ' missing/invalid predecessor links. Nodes remain intact. Undo with Ctrl+Z.'),
    choices:[{value:'no',text:tr('Annulla','Cancel')},
     {value:'yes',text:tr('Conferma rimozione','Confirm removal'),primary:true}]});
   if(decision!=='yes')return;
   if(app.state!==state||app.activeTabId!==owner){status.textContent=tr('Scheda cambiata: operazione annullata.','Tab changed: cancelled.');return;}
   const fresh=Audit.missingPredecessorPlan(state.root);
   if(JSON.stringify(fresh)!==JSON.stringify(plan)){status.textContent=tr('Mappa cambiata: riesegui la verifica.','Map changed: scan again.');return;}
   state.pushHistory();
   for(const item of plan){
    const node=state.findNode(item.nodeId);
    if(node)node.taskDependsOn=item.next.slice();
   }
   app.markChanged();rescan();
   status.textContent=tr('Prerequisiti riparati. Ctrl+Z per annullare.','Predecessors repaired. Ctrl+Z to undo.');
  });
  panel.append(header,intro,summary,controls,list,status,buttons);shade.append(panel);document.body.append(shade);
  let snapshot=null;
  const render=()=>{
   list.replaceChildren();if(!snapshot)return;
   const q=search.value.trim().normalize('NFKC').toLocaleLowerCase(),level=severity.value;
   const selected=snapshot.items.filter(item=>(level==='all'||item.severity===level)&&
    (!q||(item.label+' '+item.kind+' '+item.detail).normalize('NFKC').toLocaleLowerCase().includes(q)));
   for(const issue of selected.slice(0,250)){
    const line=make('div','nm-quality-entry');line.dataset.level=issue.severity;
    const body=make('div','nm-quality-content');
    const title=make('strong','',issue.label);
    const detail=make('small','',issue.kind.replace(/-/g,' ')+' · '+issue.detail);
    body.append(title,detail);line.append(body);
    if(issue.nodeId&&app.tabs.some(tab=>tab.id===issue.tabId&&tab.state.findNode(issue.nodeId))){
     const go=make('button','',tr('Vai al nodo','Go to node'));go.type='button';
     go.addEventListener('click',()=>{
      if(!app.tabs.some(t=>t.id===issue.tabId&&t.state.findNode(issue.nodeId)))return;
      shade.hidden=true;app.teleportToNode(issue.nodeId,issue.tabId);
     });line.append(go);
    }
    list.append(line);
   }
   if(!selected.length)list.append(make('small','',tr('Nessuna segnalazione per questo filtro.','No findings for this filter.')));
   status.textContent=selected.length+tr(' segnalazioni corrispondenti',' matching findings')+
    (selected.length>250?tr(' · mostrate le prime 250',' · showing first 250'):'');
  };
  const rescan=()=>{
   try{
    const today=new Date(),localDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
    snapshot=Audit.inspect({tabs:app.tabs,studyCards:app.studyCards||[],today:localDate,
     staleness:card=>app.v5Staleness?.(card)});
    const counts=Audit.summary(snapshot);
    summary.textContent=snapshot.scannedTabs+tr(' mappe · ',' maps · ')+snapshot.counts.nodes+
     tr(' nodi · ',' nodes · ')+counts.error+tr(' errori · ',' errors · ')+counts.warning+
     tr(' verifiche · ',' warnings · ')+counts.info+tr(' suggerimenti',' suggestions')+
     (snapshot.truncated?tr(' · limite raggiunto',' · result limit reached'):'');
    render();
   }catch(error){
    snapshot=null;list.replaceChildren();summary.textContent='';
    status.textContent=tr('Analisi non riuscita: ','Audit failed: ')+String(error.message||error);
   }
  };
  launch.addEventListener('click',()=>{
   app.hideMenus?.();shade.hidden=false;search.value='';severity.value='all';rescan();search.focus();
  });
  close.addEventListener('click',()=>{shade.hidden=true;snapshot=null});
  shade.addEventListener('click',e=>{if(e.target===shade){shade.hidden=true;snapshot=null}});
  shade.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){shade.hidden=true;snapshot=null}});
  search.addEventListener('input',render);severity.addEventListener('change',render);
  refresh.addEventListener('click',rescan);
  download.addEventListener('click',()=>{
   if(!snapshot)return;
   try{
    // Export includes node titles and finding details; explicit opt-in only.
    const output={format:'neuromap-quality-report-v1',createdAt:new Date().toISOString(),...snapshot};
    app.io.triggerDownload(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),
      'neuromap-quality-report.json');
    status.textContent=tr('Report creato. Contiene titoli e dettagli: condividilo solo se opportuno.',
     'Report created. It contains node titles and details: share it intentionally.');
   }catch(e){status.textContent=String(e.message||e);}
  });
  app._nmQuality74={open:()=>launch.click(),close:()=>{shade.hidden=true}};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
