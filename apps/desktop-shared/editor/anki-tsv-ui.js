/* Anki TSV exchange: manual approval, source-linked NeuroMap study cards.
 * .apkg and Anki scheduling are intentionally not represented here.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapAnkiTSV;if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const styleText=[
 '#nm-anki[hidden]{display:none!important}',
 '#nm-anki{position:fixed;inset:0;z-index:2150;display:grid;place-items:center;padding:15px;background:#020819c9}',
 '#nm-anki .nm-anki-box{display:grid;gap:12px;max-height:92dvh;overflow:auto;width:min(540px,100%);box-sizing:border-box;padding:18px;border-radius:17px;border:1px solid #4884d1;background:linear-gradient(130deg,#10285a,#08142a);color:#f4f8ff}',
 '#nm-anki .nm-anki-box input{width:100%;max-width:100%}',
 '#nm-anki .nm-anki-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
 '#nm-anki button{padding:9px;border-radius:9px;border:1px solid #4884d1;background:#16386a;color:#fff;cursor:pointer}',
 '#nm-anki button:disabled{opacity:.5;cursor:default}',
 '#nm-anki [role=status]{font:12px/1.5 system-ui;color:#b9d6fc;overflow-wrap:anywhere}',
 '#nm-anki :focus-visible{outline:2px solid #75d8ff;outline-offset:3px}'
 ].join('\n');
 function install(App){
  const original=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const v=original.apply(this,args);mount(this);return v;};
 }
 function mount(app){
  if(app._nmAnki)return;
  const tools=document.getElementById('dropdown-tools');if(!tools)return;
  if(!document.getElementById('nm-anki-css')){const style=el('style');style.id='nm-anki-css';style.textContent=styleText;document.head.append(style);}
  const open=el('button','dropdown-item',tr('Flashcard · Anki TSV…','Flashcards · Anki TSV…'));open.type='button';open.id='nm-tool-anki';tools.append(open);
  const shade=el('div');shade.id='nm-anki';shade.hidden=true;shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',tr('Interoperabilità Anki TSV','Anki TSV interchange'));
  const section=el('section','nm-anki-box'),heading=el('strong','',tr('Scambia con Anki · TSV','Exchange with Anki · TSV'));
  const note=el('small','',tr(
   'Scambia domande e risposte in TSV UTF-8 (Front/Back). Non è un file .apkg e non trasferisce i tempi di ripasso Anki.',
   'Exchange UTF-8 Front/Back TSV. This is not .apkg and Anki scheduling is not transferred.'));
  const picker=el('input');picker.type='file';picker.accept='.txt,.tsv,text/plain,text/tab-separated-values';picker.setAttribute('aria-label',tr('Seleziona file Anki TSV','Select Anki TSV'));
  const status=el('div');status.setAttribute('role','status');
  const actions=el('div','nm-anki-actions');
  const exportBtn=el('button','',tr('Esporta scheda attiva','Export active map'));
  const importBtn=el('button','',tr('Importa sul nodo selezionato','Import onto selected node'));
  const close=el('button','',tr('Chiudi','Close'));[exportBtn,importBtn,close].forEach(b=>b.type='button');
  importBtn.disabled=true;actions.append(exportBtn,importBtn,close);
  section.append(heading,note,picker,status,actions);shade.append(section);document.body.append(shade);
  let pending=null,owner=null,tabId='',nodeId='',token=0;
  const dismiss=()=>{shade.hidden=true;pending=null;token++;picker.value='';};
  const valid=()=>!shade.hidden&&owner===app.state&&tabId===app.activeTabId&&nodeId===app.state.selectedNodeId;
  open.addEventListener('click',()=>{
   app.hideMenus?.();pending=null;picker.value='';importBtn.disabled=true;
   owner=app.state;tabId=app.activeTabId;nodeId=app.state.selectedNodeId;
   shade.hidden=false;status.textContent=tr('Scegli un file TSV oppure esporta le flashcard della scheda.','Choose a TSV file or export the tab’s flashcards.');
   picker.focus();
  });
  close.addEventListener('click',dismiss);
  shade.addEventListener('click',e=>{if(e.target===shade)dismiss()});
  shade.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')dismiss()});
  exportBtn.addEventListener('click',()=>{
   if(!valid()){status.textContent=tr('La scheda è cambiata. Riapri il pannello.','Tab changed. Reopen panel.');return;}
   try{
    const data=Core.exportTSV((app.studyCards||[]).filter(c=>c.sourceTabId===tabId));
    const filename='neuromap-anki-'+String(owner.root?.text||'map').replace(/[^a-z0-9_-]/gi,'_').slice(0,45)+'.tsv';
    app.io.triggerDownload(new Blob([data],{type:'text/tab-separated-values;charset=utf-8'}),filename);
    status.textContent=tr('Esportazione pronta: usa Importa in Anki e scegli il TSV.','Export ready: use Import in Anki and choose the TSV.');
   }catch(e){status.textContent=String(e.message||e);}
  });
  picker.addEventListener('change',async()=>{
   const file=picker.files?.[0],version=++token;pending=null;importBtn.disabled=true;
   if(!file)return;
   if(file.size>Core.MAX_BYTES){status.textContent=tr('File troppo grande (max 2 MB).','File too large (max 2 MB).');return;}
   status.textContent=tr('Controllo delle carte in corso…','Checking cards…');
   try{
    const parsed=Core.parse(await file.text());if(version!==token||!valid())return;
    pending=parsed;importBtn.disabled=false;
    status.textContent=parsed.length+tr(' carte valide. Tutte saranno collegate al nodo selezionato; conferma per importarle.',
      ' valid cards. All will link to the selected node; confirm to import.');
   }catch(e){if(version===token)status.textContent=String(e.message||e);}
  });
  importBtn.addEventListener('click',()=>{
   if(!pending||!valid()||importBtn.disabled)return;
   const node=owner.findNode(nodeId);if(!node){status.textContent=tr('Nodo non trovato.','Node not found.');return;}
   const signature=app.v5Signature(node,owner);
   const current=app.studyCards||[];
   const seen=new Set(current.filter(c=>c.sourceTabId===tabId&&c.sourceNodeId===nodeId)
    .map(c=>c.question.toLocaleLowerCase()+'\0'+c.answer.toLocaleLowerCase()));
   let added=0;
   for(const card of pending){
    const key=card.question.toLocaleLowerCase()+'\0'+card.answer.toLocaleLowerCase();
    if(seen.has(key))continue;seen.add(key);
    current.push({id:'card_'+root.crypto.randomUUID().replace(/-/g,''),question:card.question,answer:card.answer,
     sourceTabId:tabId,sourceNodeId:nodeId,sourceSignature:signature,
     breadcrumb:String(node.text||'').slice(0,400),createdAt:Date.now(),srStatus:0,
     sr:{dueAt:0,lastReviewedAt:0,intervalDays:0,reviews:0,lapses:0}});added++;
   }
   app.studyCards=current;
   if(added)app.scheduleSave();
   app.showToast(added+tr(' flashcard importate',' flashcards imported'),'STUDIO');
   dismiss();
  });
  app._nmAnki={open:()=>open.click(),close:dismiss};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
