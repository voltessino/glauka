/* NeuroMap 7.5 Knowledge Links UI. Shared by desktop and Android tools.
 * Note content never enters innerHTML; preview uses textContent-only DOM.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapWikiLinks;if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const css=[
 '.nm75-panel{display:flex;flex-direction:column;gap:11px;min-width:0;max-width:100%;font:13px/1.5 system-ui;color:#eaf4ff}',
 '.nm75-panel label{display:flex;flex-direction:column;gap:5px;min-width:0}',
 '.nm75-panel textarea,.nm75-panel input{box-sizing:border-box;display:block;width:100%;max-width:100%;background:#071b38;color:#f5fbff;border:1px solid #507fba;border-radius:10px;padding:10px;font:inherit}',
 '.nm75-panel textarea{min-height:170px;resize:vertical;user-select:text}',
 '.nm75-panel button{min-height:40px;padding:7px 10px;border-radius:9px;border:1px solid #527da9;color:#f4f9ff;background:#173d70;cursor:pointer;white-space:normal;overflow-wrap:anywhere}',
 '.nm75-panel button:focus-visible,.nm75-panel textarea:focus-visible,.nm75-panel input:focus-visible{outline:2px solid #82e8ff;outline-offset:2px}',
 '.nm75-panel button[disabled]{opacity:.5;cursor:default}',
 '.nm75-panel .nm75-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
 '.nm75-panel .nm75-col{display:flex;flex-direction:column;gap:8px;min-width:0}',
 '.nm75-panel .nm75-actions,.nm75-panel .nm75-hits{display:flex;flex-wrap:wrap;gap:7px}',
 '.nm75-panel .nm75-scroll{max-height:210px;overflow-y:auto;overscroll-behavior:contain;border:1px solid #345d8c;padding:8px;border-radius:11px}',
 '.nm75-panel .nm75-preview{min-height:100px;max-height:300px;background:#081b33;overflow-y:auto;overflow-wrap:anywhere;white-space:normal}',
 '.nm75-panel .nm75-preview>*{margin:4px 0 9px}',
 '.nm75-panel .nm75-preview pre{white-space:pre-wrap;word-break:break-word;background:#0b2e51;padding:7px;border-radius:7px}',
 '.nm75-panel .nm75-preview code{background:#13395e;padding:2px 4px;border-radius:4px}',
 '.nm75-panel .nm75-preview button{display:inline;min-height:25px;padding:1px 4px;color:#95f0fc;background:#112e4d;border:0;border-bottom:1px dashed #5abcca}',
 '.nm75-panel .nm75-preview a{color:#8ceadf;word-break:break-all}',
 '.nm75-panel .nm75-muted{font-size:12px;color:#b3cee9;overflow-wrap:anywhere}',
 '.nm75-panel .nm75-status{font-size:12px;color:#a9e8fb;min-height:18px}',
 '.nm75-panel .nm75-bad{color:#ffc5b9}',
 '#nm75-overlay[hidden]{display:none!important}',
 '#nm75-overlay{position:fixed;inset:0;z-index:2250;background:#030a19dd;display:grid;place-items:center;padding:14px}',
 '#nm75-overlay .nm75-dialog{box-sizing:border-box;width:min(920px,100%);height:min(770px,92dvh);overflow-y:auto;overscroll-behavior:contain;padding:18px;display:flex;flex-direction:column;gap:13px;background:linear-gradient(145deg,#102f5b,#09162d);color:#f2f9ff;border:1px solid #438aca;border-radius:18px;box-shadow:0 25px 80px #000b}',
 '#nm75-overlay .nm75-head{display:flex;justify-content:space-between;gap:8px;align-items:center}',
 '#nm75-overlay .nm75-head h2{font:700 18px system-ui;margin:0}',
 '#nm75-overlay .nm75-head button{min-width:45px;min-height:45px;background:#153e79;border:1px solid #558bd0;border-radius:10px;color:#fff;cursor:pointer}',
 '@media(max-width:700px){.nm75-panel .nm75-columns{grid-template-columns:minmax(0,1fr)}#nm75-overlay{padding:5px}#nm75-overlay .nm75-dialog{max-height:calc(100dvh - 12px);height:auto;padding:12px}}'
 ].join('\n');
 function styles(){
  if(document.getElementById('nm75-css'))return;
  const e=make('style');e.id='nm75-css';e.textContent=css;document.head.append(e);
 }
 function renderInto(host,app,{onNavigate,compact=false}={}){
  styles();host.replaceChildren();
  const owner=app.state,ownerTab=app.activeTabId,nodeId=owner?.selectedNodeId||owner?.root?.id;
  const node=owner?.findNode?.(nodeId);
  const box=make('div','nm75-panel');
  host.append(box);
  if(!node){box.append(make('p','nm75-muted',tr('Seleziona un nodo.','Select a node.')));return}
  const live=()=>app.state===owner&&app.activeTabId===ownerTab&&owner.findNode(nodeId)===node;
  const title=make('strong','',tr('Note e collegamenti · ','Notes and links · ')+String(node.text||''));
  const description=make('p','nm75-muted',tr('Markdown locale, wiki-link per ID stabile e backlink dalle mappe aperte. Le modifiche si salvano solo con conferma.','Local Markdown, stable-ID wiki links and backlinks from open maps. Changes save only after confirmation.'));
  const area=make('textarea');area.maxLength=Core.MAX_NOTE;area.value=String(node.notes||'');
  area.setAttribute('aria-label',tr('Nota Markdown del nodo','Node Markdown note'));
  area.rows=11;
  const status=make('p','nm75-status');status.setAttribute('role','status');
  const indexNow=()=>Core.index(app.tabs,compact?{maxNodes:12000,maxText:2000000}:{});
  let model=indexNow(),dirty=false;
  if(area.value.length>Core.MAX_NOTE)status.textContent=tr('Nota legacy oltre 50.000 caratteri: il contenuto non sarà troncato; riducila prima di salvare.','Legacy note above 50,000 characters: not truncated; shorten before saving.');
  const toolbar=make('div','nm75-actions');
  const save=make('button','',tr('Salva nota · Undo','Save note · Undo'));save.type='button';
  const reload=make('button','',tr('Annulla modifiche','Discard edits'));reload.type='button';
  toolbar.append(save,reload);
  const cols=make('div','nm75-columns'),left=make('div','nm75-col'),right=make('div','nm75-col');
  const preview=make('div','nm75-scroll nm75-preview');preview.setAttribute('aria-label',tr('Anteprima Markdown sicura','Safe Markdown preview'));
  const search=make('input');search.type='search';search.placeholder=tr('Collega un altro concetto per nome…','Link another concept by name…');
  search.setAttribute('aria-label',tr('Trova nodo da collegare','Find node to link'));
  const suggestions=make('div','nm75-scroll nm75-hits'),outbound=make('div','nm75-scroll'),backlinks=make('div','nm75-scroll');
  const safeJump=ref=>{
   if(dirty){status.textContent=tr('Salva o annulla le modifiche prima di seguire un link.','Save or discard edits before following a link.');return}
   if(!ref||!app.tabs.some(t=>t.id===ref.tabId&&t.state?.findNode?.(ref.nodeId)))return;
   if(typeof onNavigate==='function')onNavigate();
   if(ref.tabId!==app.activeTabId)app.activateTab(ref.tabId);
   app.selectNode(ref.nodeId);
   app.teleportToNode?.(ref.nodeId,ref.tabId);
  };
  function appendInline(parent,line){
   for(const token of Core.inline(line)){
    const item=token.kind==='strong'?'strong':token.kind==='em'?'em':token.kind==='code'?'code':null;
    if(item){parent.append(make(item,'',token.value));continue}
    if(token.kind==='url'){
     const link=make('a','',token.value);link.href=token.url;
     link.rel='noopener noreferrer';link.target='_blank';parent.append(link);continue;
    }
    if(token.kind==='wiki'){
     const resolved=model.resolve(token.ref),name=token.ref.label||token.value;
     if(!resolved.target){const broken=make('span','nm75-bad',name+' ('+resolved.status+')');parent.append(broken);continue}
     const b=make('button','',name);b.type='button';b.title=resolved.target.title;
     b.addEventListener('click',()=>safeJump(resolved.target));parent.append(b);continue;
    }
    parent.append(document.createTextNode(token.value));
   }
  }
  function paint(){
   preview.replaceChildren();const lines=area.value.replace(/\r\n?/g,'\n').split('\n').slice(0,1200);
   let fence='',code=null;
   for(const line of lines){
    const marker=/^\s{0,3}(\x60{3,}|~{3,})/.exec(line);
    if(marker){
     if(!fence){fence=marker[1][0];code=make('pre');code.dataset.glaukaUserContent='';preview.append(code)}
     else if(marker[1][0]===fence){fence='';code=null}
     continue;
    }
    if(fence){if(code)code.textContent+=(code.textContent?'\n':'')+line;continue}
    const match=/^(#{1,4})\s+(.+)$/.exec(line);
    const li=/^\s{0,3}[-*+]\s+(.+)$/.exec(line);
    const block=make(match?'h'+Math.min(6,match[1].length+2):li?'p':'p');
    block.dataset.glaukaUserContent='';
    appendInline(block,match?match[2]:li?'• '+li[1]:line);
    preview.append(block);
   }
   if(area.value.split('\n').length>1200)preview.append(make('p','nm75-muted',tr('Anteprima limitata alle prime 1.200 righe. La nota completa resta conservata.','Preview limited to first 1,200 lines; full note remains stored.')));
  }
  function showLinks(){
   outbound.replaceChildren();backlinks.replaceChildren();
   model=indexNow();
   const forward=model.forward(ownerTab,nodeId).slice(0,120),incoming=model.backlinks(ownerTab,nodeId).slice(0,120);
   const button=(container,text,target)=>{
    const row=make('button','',text);row.type='button';
    if(target)row.addEventListener('click',()=>safeJump(target));
    else row.disabled=true;container.append(row);
   };
   for(const link of forward)button(outbound,(link.label||link.raw)+' · '+link.status,link.target);
   for(const link of incoming)button(backlinks,link.source.title+' → '+(link.label||link.raw),link.source);
   if(!forward.length)outbound.append(make('p','nm75-muted',tr('Nessun collegamento in uscita.','No outgoing links.')));
   if(!incoming.length)backlinks.append(make('p','nm75-muted',tr('Nessun backlink nelle mappe aperte.','No backlinks in open maps.')));
   if(model.partial)status.textContent=tr('Indice parziale: troppi nodi o note.','Partial index: too many nodes or notes.');
  }
  function suggest(){
   suggestions.replaceChildren();if(!search.value.trim())return;
   const found=model.search(search.value,15);
   for(const target of found){
    const btn=make('button','',target.title+' · '+target.tabId);btn.type='button';btn.dataset.glaukaUserContent='';
    btn.addEventListener('click',()=>{
     if(!live()){status.textContent=tr('Scheda cambiata: modifica annullata.','Tab changed; edit blocked.');return}
     const rechecked=indexNow().resolve({kind:'id',rootId:target.rootId,nodeId:target.nodeId});
     if(rechecked.status!=='resolved'){status.textContent=tr('Destinazione ambigua o non disponibile.','Target ambiguous or unavailable.');return}
     const value=Core.format(target);
     const at=area.selectionStart??area.value.length,fin=area.selectionEnd??at;
     area.setRangeText(value,at,fin,'end');dirty=true;paint();area.focus();
     status.textContent=tr('Collegamento inserito. Salva la nota per renderlo persistente.','Link inserted. Save the note to persist it.');
    });suggestions.append(btn);
   }
   if(!found.length)suggestions.append(make('p','nm75-muted',tr('Nessun concetto trovato.','No matching concept.')));
  }
  save.addEventListener('click',()=>{
   if(!live()){status.textContent=tr('Scheda o nodo cambiato: nessuna modifica salvata.','Tab/node changed; nothing saved.');return}
   try{
    const changed=Core.saveNote(owner,nodeId,area.value);
    if(changed){app.markChanged();app.scheduleSave?.();}
    dirty=false;showLinks();paint();
    status.textContent=changed?(globalThis.GlaukaTouchGuidance?.message('noteSaved')??tr('Nota salvata. Ctrl+Z per annullare.','Note saved. Ctrl+Z to undo.')):
      tr('Nessuna modifica da salvare.','No changes to save.');
   }catch(e){status.textContent=String(e.message||e)}
  });
  reload.addEventListener('click',()=>{
   if(!live())return;area.value=String(node.notes||'');dirty=false;paint();
   status.textContent=tr('Modifiche non salvate scartate.','Unsaved edits discarded.');
  });
  area.addEventListener('input',()=>{dirty=true;paint();status.textContent=tr('Modifiche non salvate','Unsaved changes')});
  search.addEventListener('input',suggest);
  left.append(make('strong','',tr('Nota Markdown','Markdown note')),area,toolbar,
   make('strong','',tr('Anteprima sicura','Safe preview')),preview);
  right.append(make('strong','',tr('Inserisci collegamento [[...]]','Insert [[...]] link')),search,suggestions,
   make('strong','',tr('Collegamenti uscenti','Outgoing links')),outbound,
   make('strong','',tr('Backlink da altre note','Backlinks from notes')),backlinks);
  cols.append(left,right);box.append(title,description,cols,status);
  showLinks();paint();
  return Object.freeze({hasUnsaved:()=>dirty});
 }
 function install(App){
  const previous=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const value=previous.apply(this,args);mount(this);return value};
 }
 function mount(app){
  if(app._nmWiki75)return;
  const menu=document.getElementById('dropdown-view');if(!menu)return;
  styles();
  const launch=make('button','dropdown-item',tr('Collega note e concetti…','Link notes and concepts…'));
  launch.type='button';launch.id='nm-tool-links';menu.append(launch);
  const shade=make('div');shade.id='nm75-overlay';shade.hidden=true;
  shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label','Knowledge Links');
  const dialog=make('section','nm75-dialog'),heading=make('div','nm75-head');
  const h=make('h2','',tr('Collega note e concetti','Link notes and concepts'));
  const closeButton=make('button','','×');closeButton.type='button';closeButton.setAttribute('aria-label',tr('Chiudi','Close'));
  heading.append(h,closeButton);const area=make('div');
  dialog.append(heading,area);shade.append(dialog);document.body.append(shade);
  let session=null;
  const finish=()=>{shade.hidden=true;session=null};
  const close=async()=>{
   if(session?.hasUnsaved?.()){
    const answer=await app.nmAsk({title:tr('Nota non salvata','Unsaved Markdown note'),
     message:tr('Vuoi scartare le modifiche a questa nota?','Discard the changes to this note?'),
     choices:[{value:'cancel',text:tr('Continua a modificare','Continue editing')},
      {value:'discard',text:tr('Scarta','Discard'),danger:true}]});
    if(answer!=='discard')return;
   }
   finish();
  };
  const open=()=>{app.hideMenus?.();app.closeEditor?.(true);shade.hidden=false;session=renderInto(area,app);closeButton.focus()};
  launch.addEventListener('click',open);closeButton.addEventListener('click',close);
  shade.addEventListener('click',e=>{if(e.target===shade)close()});
  shade.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close()}});
  app._nmWiki75={open,close};
 }
 root.NeuroMapWikiUI=Object.freeze({renderInto,styles});
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
