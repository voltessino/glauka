/* NeuroMap 7.6 Knowledge Database — shared desktop/mobile UI.
 * Uses semantic DOM and textContent. No HTML injection, network or shadow store.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapKnowledgeDB;if(!Core)return;
 const t=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const e=(name,cls,value)=>{const n=document.createElement(name);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
 const css=[
 '.nm76-panel{display:flex;flex-direction:column;gap:12px;min-width:0;max-width:100%;color:#edf6ff;font:13px/1.5 system-ui}',
 '.nm76-panel button,.nm76-panel input,.nm76-panel select{box-sizing:border-box;max-width:100%;border:1px solid #5486b4;border-radius:10px;color:#f5faff;background:#112e52;font:inherit;min-height:44px;padding:9px;overflow-wrap:anywhere}',
 '.nm76-panel button{cursor:pointer}.nm76-panel button[disabled]{opacity:.5}',
 '.nm76-panel button:focus-visible,.nm76-panel input:focus-visible,.nm76-panel select:focus-visible{outline:3px solid #7be4fa;outline-offset:2px}',
 '.nm76-panel label{display:flex;flex-direction:column;gap:5px;min-width:0}',
 '.nm76-panel .nm76-line{display:flex;gap:9px;flex-wrap:wrap;align-items:center}',
 '.nm76-panel .nm76-line>*{flex:1 1 125px;min-width:0}',
 '.nm76-panel .nm76-list{display:flex;flex-direction:column;gap:6px;min-height:25px;max-height:330px;overflow-y:auto;overscroll-behavior:contain}',
 '.nm76-panel .nm76-row{display:flex;gap:8px;align-items:center;padding:7px;border:1px solid #2d5585;border-radius:11px;background:#0a2445}',
 '.nm76-panel .nm76-row button{flex:1;text-align:left;white-space:normal;min-width:0}',
 '.nm76-panel .nm76-row small{color:#bad5ee;font-size:11px;min-width:0;overflow-wrap:anywhere}',
 '.nm76-panel .nm76-muted{color:#b8d2eb;margin:0;overflow-wrap:anywhere}',
 '.nm76-panel .nm76-status{color:#91e1f9;min-height:22px;overflow-wrap:anywhere}',
 '.nm76-panel .nm76-meta{padding:9px;border-radius:10px;background:#0a274a;border:1px solid #356397;white-space:pre-wrap;overflow-wrap:anywhere}',
 '#nm76-overlay[hidden]{display:none!important}',
 '#nm76-overlay{position:fixed;inset:0;z-index:2270;background:#030b1bde;display:grid;place-items:center;padding:12px}',
 '#nm76-overlay .nm76-dialog{box-sizing:border-box;width:min(860px,100%);max-height:calc(100dvh - 24px);overflow-y:auto;padding:16px;border-radius:20px;background:linear-gradient(135deg,#10345f,#07172e);border:1px solid #4586c4;box-shadow:0 24px 75px #000c;color:#f1f8ff}',
 '#nm76-overlay .nm76-head{display:flex;justify-content:space-between;gap:10px;align-items:center}',
 '#nm76-overlay .nm76-head h2{font:700 19px system-ui;margin:0}',
 '#nm76-overlay .nm76-close{min-height:44px;min-width:44px;border-radius:10px;border:1px solid #528bd5;color:#fff;background:#143c74;font-size:20px;cursor:pointer}',
 '@media(max-width:420px){#nm76-overlay{padding:5px}#nm76-overlay .nm76-dialog{padding:10px;max-height:calc(100dvh - 10px)}}'
 ].join('\n');
 function style(){
  if(document.getElementById('nm76-style'))return;
  const n=e('style');n.id='nm76-style';n.textContent=css;document.head.append(n);
 }
 const localToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function renderInto(host,app,{compact=false,onNavigate}={}){
  style();host.replaceChildren();
  const owner=app.state,tabId=app.activeTabId,selectedId=owner?.selectedNodeId||owner?.root?.id;
  const node=owner?.findNode?.(selectedId);
  const wrap=e('section','nm76-panel'),status=e('div','nm76-status');
  status.setAttribute('role','status');host.append(wrap);
  if(!node){wrap.append(e('p','nm76-muted',t('Seleziona un nodo.','Select a node.')));return {hasUnsaved:()=>false}}
  let dirty=false;
  const requireSaved=()=>{
   if(!dirty)return true;
   status.textContent=t('Salva o annulla prima le modifiche alle proprietà.','Save or discard property edits first.');return false;
  };
  const live=()=>app.activeTabId===tabId&&app.state===owner&&owner.findNode(selectedId)===node;
  const btn=(name,fn)=>{const b=e('button','',name);b.type='button';b.addEventListener('click',fn);return b};
  const field=(label,type='text')=>{
   const box=e('label'),span=e('span','',label),input=e('input');input.type=type;
   box.append(span,input);return {box,input};
  };
  const refresh=()=>{if(app.activeTabId===tabId)app.markChanged();else{owner.isDirty=true;app.scheduleSave?.()}};
  const head=e('strong','',t('Tag e proprietà · nodo: ','Tags and properties · node: ')+String(node.text||''));
  wrap.append(head,e('p','nm76-muted',(globalThis.GlaukaTouchGuidance?.message('props')??t('Proprietà associate al nodo, senza duplicazioni. Salva per confermare; Ctrl+Z per annullare.','Typed properties attached to this node, without duplication. Save to confirm; Undo supported.'))));
  const tags=field(t('Tag (separati da virgole)','Tags (comma separated)'));
  tags.input.placeholder='Anatomia, Ripasso, Esame';tags.input.maxLength=850;
  tags.input.value=Core.normalize(node.knowledge).tags.join(', ');
  const properties=e('div','nm76-meta');
  const name=field(t('Nuova proprietà','New property')),type=e('select'),val=field(t('Valore','Value'));
  for(const typ of ['text','number','date','boolean']){const o=e('option','',typ);o.value=typ;type.append(o)}
  name.input.placeholder='es. materia';name.input.maxLength=40;val.input.maxLength=240;
  const save=btn(t('Salva proprietà','Save properties'),()=>{
   if(!live()){status.textContent=t('Scheda cambiata: modifica annullata.','Tab changed: update blocked.');return}
   const next=Core.normalize(node.knowledge);
   next.tags=Core.tags(tags.input.value);
   if(name.input.value.trim()){
    const k=Core.key(name.input.value);if(!k){status.textContent=t('Nome proprietà non valido.','Invalid property name.');return}
    if(!Object.prototype.hasOwnProperty.call(next.fields,k)&&Object.keys(next.fields).length>=Core.MAX_FIELDS){
     status.textContent=t('Massimo 20 proprietà per nodo.','Maximum 20 properties per node.');return}
    const typed=Core.typed(type.value,val.input.value);
    if(!typed){status.textContent=t('Valore non valido per il tipo scelto.','Value is invalid for the selected type.');return}
    next.fields[k]=typed;
   }
   const normalized=Core.normalize(next);
   const changed=Core.update(owner,selectedId,normalized);
   if(changed)refresh();
   dirty=false;name.input.value='';val.input.value='';tags.input.value=normalized.tags.join(', ');
   paintMeta();refreshList();status.textContent=changed?t('Proprietà salvate. Undo disponibile.','Properties saved. Undo available.'):t('Nessuna modifica.','No changes.');
  });
  const removeName=field(t('Rimuovi proprietà','Remove property'));
  const remove=btn(t('Rimuovi campo','Remove field'),()=>{
   if(!live()||!requireSaved())return;
   const next=Core.normalize(node.knowledge),k=Core.key(removeName.input.value);
   if(!k||!Object.prototype.hasOwnProperty.call(next.fields,k)){
    status.textContent=t('Campo non trovato.','Field not found.');return
   }
   delete next.fields[k];
   if(Core.update(owner,selectedId,next))refresh();
   dirty=false;removeName.input.value='';paintMeta();refreshList();
   status.textContent=t('Campo rimosso. Annullabile con Undo.','Field removed. Undo available.');
  });
  const propsRow=e('div','nm76-line'),removeRow=e('div','nm76-line');
  const typeBox=e('label');typeBox.append(e('span','',t('Tipo','Type')),type);
  propsRow.append(name.box,typeBox,val.box);
  removeRow.append(removeName.box,remove);
  function paintMeta(){
   const metadata=Core.normalize(node.knowledge),fields=Object.entries(metadata.fields)
     .map(([k,v])=>k+': '+String(v.value)+' ('+v.type+')');
   properties.textContent=t('Tag: ','Tags: ')+(metadata.tags.join(', ')||'—')+'\n'+
    (fields.length?fields.join('\n'):t('Nessuna proprietà personalizzata.','No custom properties.'));
  }
  paintMeta();
  wrap.append(tags.box,propsRow,save,removeRow,properties);
  tags.input.addEventListener('input',()=>{dirty=true});name.input.addEventListener('input',()=>{dirty=true});
  val.input.addEventListener('input',()=>{dirty=true});
  type.addEventListener('change',()=>{dirty=true});
  wrap.append(e('strong','',t('Template e note giornaliere','Templates and daily notes')));
  const templates=e('select');for(const entry of Core.templates()){const o=e('option','',entry.label);o.value=entry.id;templates.append(o)}
  const templateRow=e('div','nm76-line');templateRow.append(templates,btn(t('Applica template','Apply template'),()=>{
   if(!live()||!requireSaved())return;
   try{const changed=Core.applyTemplate(owner,selectedId,templates.value,{today:localToday()});
    if(changed)refresh();tags.input.value=Core.normalize(node.knowledge).tags.join(', ');paintMeta();refreshList();
    status.textContent=changed?t('Template applicato; le note esistenti non sono state sovrascritte.','Template applied; existing notes were not overwritten.'):
      t('Template già applicato.','Template already applied.');
   }catch(error){status.textContent=error.message}
  }));wrap.append(templateRow);
  const dailyInput=field(t('Data del diario','Daily note date'),'date');dailyInput.input.value=localToday();
  const dailyRow=e('div','nm76-line');dailyRow.append(dailyInput.box,btn(t('Apri / crea diario','Open / create daily note'),()=>{
   if(!live())return;
   if(dirty){status.textContent=t('Salva o annulla prima le modifiche alle proprietà.','Save or discard property edits first.');return}
   try{
    const out=Core.createDaily(owner,app.layout,dailyInput.input.value);
    if(out.created)refresh();
    if(typeof onNavigate==='function')onNavigate();
    app.selectNode(out.node.id);
    app.teleportToNode?.(out.node.id,tabId);
    status.textContent=out.created?t('Diario creato.','Daily note created.'):t('Diario esistente aperto.','Existing daily note opened.');
   }catch(error){status.textContent=error.message}
  }));wrap.append(dailyRow);
  wrap.append(e('strong','',t('Organizza tutte le mappe aperte','Organize all open maps')));
  const filters=e('div','nm76-line'),query=field(t('Cerca','Search')),tag=field('Tag'),key=field(t('Proprietà','Property')),value=field(t('Valore','Value'));
  const order=e('select');for(const [v,title]of [['title',t('Titolo','Title')],['due',t('Scadenza','Due date')],['daily',t('Diario','Daily')]]){const o=e('option','',title);o.value=v;order.append(o)}
  filters.append(query.box,tag.box,key.box,value.box,order);wrap.append(filters);
  const info=e('p','nm76-muted'),list=e('div','nm76-list');wrap.append(info,list,status);
  let index=Core.rows(app.tabs,{limit:compact?12000:40000});
  const refreshList=()=>{index=Core.rows(app.tabs,{limit:compact?12000:40000});listRows()};
  function listRows(){
   const result=Core.filter(index,{query:query.input.value,tag:tag.input.value,field:key.input.value,value:value.input.value,order:order.value,max:compact?125:250});
   list.replaceChildren();
   info.textContent=result.total+t(' risultati · ',' results · ')+(result.partial?t('vista parziale (limite di sicurezza).','partial view (safety limit).'):t('vista completa.','complete view.'));
   for(const item of result.items){
    const row=e('div','nm76-row'),text=btn(item.title+' · '+item.tabId,()=>{
     if(dirty){status.textContent=t('Salva o annulla le modifiche prima di cambiare nodo.','Save or discard edits before navigating.');return}
     const target=app.tabs.find(x=>x.id===item.tabId);
     if(!target?.state?.findNode?.(item.nodeId))return;
     if(typeof onNavigate==='function')onNavigate();
     if(item.tabId!==app.activeTabId)app.activateTab(item.tabId);
     app.selectNode(item.nodeId);app.teleportToNode?.(item.nodeId,item.tabId);
    });
    row.dataset.glaukaUserContent='';row.append(text,e('small','',item.tags.join(' · ')||item.dailyKey||''));list.append(row);
   }
  }
  for(const el of [query.input,tag.input,key.input,value.input])el.addEventListener('input',listRows);
  order.addEventListener('change',listRows);listRows();
  return {hasUnsaved:()=>dirty};
 }
 function install(App){
  const previous=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const value=previous.apply(this,args);mount(this);return value};
 }
 function mount(app){
  if(app._nmKnowledgeDB76)return;
  const menu=document.getElementById('dropdown-view');if(!menu)return;
  style();
  const launch=e('button','dropdown-item',t('Organizza con tag e campi…','Organize with tags and fields…'));
  launch.type='button';launch.id='nm-tool-database';menu.append(launch);
  const shade=e('div');shade.id='nm76-overlay';shade.hidden=true;shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  const panel=e('section','nm76-dialog'),head=e('div','nm76-head'),title=e('h2','',t('Organizza con tag e campi','Organize with tags and fields')),close=e('button','nm76-close','×');
  close.type='button';close.setAttribute('aria-label',t('Chiudi','Close'));
  head.append(title,close);const main=e('div');panel.append(head,main);shade.append(panel);document.body.append(shade);
  let session=null;
  const shut=async()=>{
   if(session?.hasUnsaved?.()){
    const action=await app.nmAsk({title:t('Proprietà non salvate','Unsaved properties'),message:t('Scartare le modifiche?','Discard changes?'),
      choices:[{value:'cancel',text:t('Continua','Continue')},{value:'discard',text:t('Scarta','Discard'),danger:true}]});
    if(action!=='discard')return;
   }
   shade.hidden=true;session=null;
  };
  const open=()=>{app.hideMenus?.();app.closeEditor?.(true);shade.hidden=false;session=renderInto(main,app);close.focus()};
  launch.addEventListener('click',open);close.addEventListener('click',shut);
  shade.addEventListener('click',event=>{if(event.target===shade)shut()});
  shade.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();shut()}});
  app._nmKnowledgeDB76={open,close:shut};
 }
 root.NeuroMapKnowledgeDBUI=Object.freeze({renderInto,style});
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
