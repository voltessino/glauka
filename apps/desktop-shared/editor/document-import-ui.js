/* Preview-first local document importer. Uses the existing paste/Undo pipeline.
 * The user explicitly approves a deterministic outline; no AI or silent writes.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapDocumentImport;if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const elem=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const css=[
 '#nm-doc-import{position:fixed;inset:0;z-index:2100;background:#020814ca;display:grid;place-items:center;padding:16px;box-sizing:border-box}',
 '#nm-doc-import[hidden]{display:none!important}',
 '#nm-doc-import .nm-di-window{width:min(640px,100%);max-height:min(760px,94dvh);box-sizing:border-box;overflow:auto;display:grid;gap:12px;padding:19px;border:1px solid #3979c8;border-radius:18px;background:linear-gradient(130deg,#0d2651,#061127 70%,#0d2651);color:#f4f7ff;box-shadow:0 22px 70px #0009}',
 '#nm-doc-import .nm-di-header{display:flex;align-items:center;justify-content:space-between;gap:8px}',
 '#nm-doc-import .nm-di-header strong{font-size:17px}',
 '#nm-doc-import small{color:#b5cef3;line-height:1.5}',
 '#nm-doc-import input[type=file]{width:100%;max-width:100%;min-width:0;color:#e7f5ff}',
 '#nm-doc-import .nm-di-preview{max-height:280px;min-height:90px;overflow:auto;border:1px solid #356095;border-radius:10px;background:#06182d;padding:8px}',
 '#nm-doc-import .nm-di-item{padding:5px 7px;border-bottom:1px solid #294064;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
 '#nm-doc-import .nm-di-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}',
 '#nm-doc-import button{min-height:36px;padding:7px 12px;border-radius:10px;border:1px solid #3979c8;background:#153764;color:#fff;cursor:pointer}',
 '#nm-doc-import button.nm-di-apply{background:linear-gradient(120deg,#117ce1,#5245c9);font-weight:700}',
 '#nm-doc-import button:disabled{opacity:.45;cursor:default}',
 '#nm-doc-import [role=status]{min-height:18px;font-size:12px;color:#ccdef7;overflow-wrap:anywhere}',
 '#nm-doc-import :is(button,input):focus-visible{outline:2px solid #70d9ff;outline-offset:3px}'
 ].join('\n');
 function install(App){
  const previous=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const v=previous.apply(this,args);mount(this);return v;};
 }
 function mount(app){
  if(app._nmDocumentImport)return;
  const menu=document.getElementById('dropdown-file');if(!menu)return;
  const style=elem('style');style.id='nm-doc-import-css';style.textContent=css;document.head.append(style);
  const launch=elem('button','dropdown-item',tr('Importazione intelligente…','Intelligent document import…'));
  launch.type='button';launch.id='nm-doc-import-open';launch.title=tr('PDF, DOCX, Markdown e TXT · anteprima prima di applicare','PDF, DOCX, Markdown and TXT · preview before applying');
  const pasteBtn=document.getElementById('btn-import-paste');
  if(pasteBtn&&pasteBtn.parentElement===menu)pasteBtn.after(launch);else menu.append(launch);
  const shade=elem('div');shade.id='nm-doc-import';shade.hidden=true;
  shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',tr('Importazione intelligente di documenti','Intelligent document import'));
  const window=elem('section','nm-di-window');
  const header=elem('div','nm-di-header'),heading=elem('strong','',tr('Importazione intelligente','Intelligent import'));
  const close=elem('button','','×');close.type='button';close.setAttribute('aria-label',tr('Chiudi','Close'));
  header.append(heading,close);
  const info=elem('small','',tr(
   'PDF, DOCX, Markdown e TXT. La proposta è locale e modificabile dopo l’inserimento. Nessun documento viene inviato online.',
   'PDF, DOCX, Markdown and TXT. Preview locally and edit after insertion. Documents are never uploaded.'));
  const picker=elem('input');picker.type='file';picker.accept='.pdf,.docx,.md,.markdown,.txt';
  picker.setAttribute('aria-label',tr('Scegli documento','Choose document'));
  const caption=elem('strong','',tr('Anteprima della struttura','Outline preview'));
  const preview=elem('div','nm-di-preview'),status=elem('div');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const consent=elem('label'),verify=elem('input');verify.type='checkbox';
  consent.append(verify,document.createTextNode(' '+tr(
   'Ho controllato l’estrazione PDF rispetto al documento originale.',
   'I checked extracted PDF text against the original document.')));
  consent.hidden=true;
  const actions=elem('div','nm-di-actions');
  const cancel=elem('button','',tr('Annulla','Cancel'));
  const apply=elem('button','nm-di-apply',tr('Aggiungi alla mappa','Add to map'));
  for(const b of [cancel,apply])b.type='button';apply.disabled=true;
  actions.append(cancel,apply);
  window.append(header,info,picker,caption,preview,consent,status,actions);
  shade.append(window);document.body.append(shade);
  let proposal=null,stamp=0,originalState=null,originalTab=null,originalSelection=null;
  const reset=()=>{
   proposal=null;stamp++;picker.value='';preview.replaceChildren();verify.checked=false;
   consent.hidden=true;apply.disabled=true;status.textContent='';
  };
  const end=()=>{shade.hidden=true;reset();};
  const check=()=>{apply.disabled=!proposal||(proposal.kind==='pdf'&&!verify.checked)};
  verify.addEventListener('change',check);
  close.addEventListener('click',end);cancel.addEventListener('click',end);
  shade.addEventListener('click',event=>{if(event.target===shade)end()});
  shade.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape')end()});
  launch.addEventListener('click',()=>{
   app.hideMenus?.();reset();shade.hidden=false;originalState=app.state;
   originalTab=app.activeTabId;originalSelection=app.state.selectedNodeId;picker.focus();
  });
  function render(result){
   preview.replaceChildren();
   const stack=[{item:result.root,depth:0}];let shown=0;
   while(stack.length&&shown<80){
    const {item,depth}=stack.pop(),row=elem('div','nm-di-item',item.text);
    row.style.paddingLeft=(8+Math.min(depth,8)*13)+'px';
    row.dataset.glaukaUserContent='';row.title=item.text;preview.append(row);shown++;
    for(let j=(item.children||[]).length-1;j>=0;j--)
     stack.push({item:item.children[j],depth:depth+1});
   }
   if(stack.length)preview.append(elem('small','',tr('Altri nodi presenti nella proposta.','More nodes included in the proposal.')));
   caption.textContent=tr('Anteprima: ','Preview: ')+result.title+' · '+result.count+tr(' nodi',' nodes');
   status.textContent=result.warnings.length?result.warnings.join(' '):
    tr('Controlla struttura e destinazione prima di applicare.','Review the structure and destination before applying.');
   consent.hidden=result.kind!=='pdf';check();
  }
  picker.addEventListener('change',async()=>{
   const file=picker.files?.[0],id=++stamp;proposal=null;apply.disabled=true;
   verify.checked=false;preview.replaceChildren();if(!file)return;
   status.textContent=tr('Analisi locale del documento…','Analyzing document locally…');
   try{
    const value=await Core.preview(file);
    if(id!==stamp||shade.hidden)return;
    proposal=value;render(value);
   }catch(e){if(id===stamp)status.textContent=tr('Importazione non disponibile: ','Import unavailable: ')+String(e.message||e);}
  });
  apply.addEventListener('click',()=>{
   if(!proposal||apply.disabled)return;
   if(app.state!==originalState||app.activeTabId!==originalTab||
      app.state.selectedNodeId!==originalSelection){
    status.textContent=tr('La scheda o la selezione è cambiata. Riapri l’importazione.','The tab or selection changed. Reopen the importer.');return;
   }
   const existing=app.state.getAllNodesIncludingCollapsed().length;
   if(existing+proposal.count>3500){
    status.textContent=tr('Il numero di nodi supera il limite sicuro della mappa.','The new nodes exceed the map safety limit.');return;
   }
   let counter=0,stack=[proposal.root];
   while(stack.length){
    const item=stack.pop();item.id='preview-import-'+(++counter);
    item.side='right';item.parentId=null;item.color='#56bfe7';
    for(const child of item.children||[])stack.push(child);
   }
   // pasteSelection generates final IDs, preserves sourceRefs and records one Undo.
   app.pasteSelection({kind:'nodes',nodes:[proposal.root],images:[],relationships:[]});
   end();
  });
  app._nmDocumentImport={open:()=>{launch.click()},close:end};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
