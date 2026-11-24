/* Manual, non-destructive portable exchange. Explicit open-as-NEW-tab only.
 * No network calls, background activity, file overwrites or conflict guessing.
 */
(function(root){
 'use strict';
 const Exchange=root.NeuroMapPortableExchange;if(!Exchange)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(name,cls,txt)=>{const e=document.createElement(name);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
 const CSS=[
 '#nm-exchange[hidden]{display:none!important}',
 '#nm-exchange{position:fixed;inset:0;z-index:2180;background:#030918d9;display:grid;place-items:center;padding:16px}',
 '#nm-exchange .nm-exchange-window{box-sizing:border-box;display:grid;gap:13px;width:min(620px,100%);max-height:93dvh;overflow:auto;border:1px solid #437dc4;border-radius:19px;background:linear-gradient(120deg,#102955,#071629);color:#f4f8ff;padding:20px;box-shadow:0 22px 65px #000b}',
 '#nm-exchange h2{margin:0;font-size:18px}',
 '#nm-exchange small,#nm-exchange [role=status]{color:#c1d6ee;font-size:12px;line-height:1.45;overflow-wrap:anywhere}',
 '#nm-exchange button,#nm-exchange input{border:1px solid #578ac3;background:#14345d;color:#fff;border-radius:9px;padding:9px;max-width:100%}',
 '#nm-exchange input{width:100%}',
 '#nm-exchange button{cursor:pointer}',
 '#nm-exchange button:disabled{opacity:.5;cursor:default}',
 '#nm-exchange .nm-exchange-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}',
 '#nm-exchange .nm-exchange-report{padding:11px;border-radius:11px;background:#102541;border:1px solid #3b6090;white-space:pre-wrap}',
 '#nm-exchange :focus-visible{outline:2px solid #6dd8fa;outline-offset:3px}'
 ].join('\n');
 function install(App){
  const bind=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=bind.apply(this,args);mount(this);return result};
 }
 function mount(app){
  if(app._nmExchange)return;
  const toolsMenu=document.getElementById('dropdown-tools')||document.getElementById('dropdown-file');if(!toolsMenu)return;
  if(!document.getElementById('nm-exchange-style')){const css=el('style');css.id='nm-exchange-style';css.textContent=CSS;document.head.append(css)}
  const launch=el('button','dropdown-item',tr('Scambio sicuro · confronta copie…','Safe exchange · compare copies…'));launch.type='button';launch.id='nm-exchange-open';toolsMenu.append(launch);
  const shade=el('div');shade.id='nm-exchange';shade.hidden=true;shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',tr('Confronto tra copie locali','Compare local project copies'));
  const box=el('section','nm-exchange-window'),h=el('h2','',tr('Scambio sicuro tra dispositivi','Safe exchange between devices'));
  const note=el('small','',tr('Esporta una copia .json, trasferiscila manualmente e confrontala con la mappa aperta. Nessuna sincronizzazione o sovrascrittura automatica. Il file contiene contenuti della mappa: proteggilo quando lo condividi.',
   'Export a .json copy, transfer it manually and compare with the open map. No automatic sync or overwrite. The file contains your map contents: handle it privately.'));
  const exportButton=el('button','',tr('Esporta copia verificabile','Export verified copy'));exportButton.type='button';
  const file=el('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label',tr('Scegli copia da confrontare','Choose copy to compare'));
  const report=el('div','nm-exchange-report'),status=el('p');status.setAttribute('role','status');
  const actions=el('div','nm-exchange-actions'),openCopy=el('button','',tr('Apri come nuova scheda','Open as new tab')),close=el('button','',tr('Chiudi','Close'));
  openCopy.type=close.type='button';openCopy.disabled=true;actions.append(openCopy,close);
  box.append(h,note,exportButton,file,report,status,actions);shade.append(box);document.body.append(shade);
  let originalState=null,originalTab='',incoming=null,stamp=0;
  const valid=()=>!shade.hidden&&app.state===originalState&&app.activeTabId===originalTab;
  const reset=()=>{incoming=null;stamp++;file.value='';report.textContent='';status.textContent='';openCopy.disabled=true};
  const dismiss=()=>{shade.hidden=true;reset()};
  launch.addEventListener('click',()=>{
   app.hideMenus?.();originalState=app.state;originalTab=app.activeTabId;reset();shade.hidden=false;file.focus();
  });
  close.addEventListener('click',dismiss);
  shade.addEventListener('click',e=>{if(e.target===shade)dismiss()});
  shade.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')dismiss()});
  exportButton.addEventListener('click',async()=>{
   if(!valid()){status.textContent=tr('Scheda cambiata. Riapri il confronto.','Tab changed. Reopen comparison.');return}
   exportButton.disabled=true;
   try{
    const packet=await Exchange.create(app.io.buildSerializedProjectPayload());
    if(!valid())return;
    const name=app.io.sanitizeFilename(packet.manifest.title).slice(0,60)+'-exchange.json';
    app.io.triggerDownload(new Blob([JSON.stringify(packet)],{type:'application/json;charset=utf-8'}),name);
    status.textContent=tr('Copia creata localmente; nessun dato inviato online.','Copy prepared locally; no data uploaded.');
   }catch(e){status.textContent=String(e.message||e)}
   finally{exportButton.disabled=false}
  });
  file.addEventListener('change',async()=>{
   const chosen=file.files?.[0],v=++stamp;incoming=null;openCopy.disabled=true;report.textContent='';
   if(!chosen)return;
   if(chosen.size>Exchange.MAX_BYTES){status.textContent=tr('Copia troppo grande (max 25 MB).','Copy too large (max 25 MB).');return}
   status.textContent=tr('Controllo integrità SHA-256…','Verifying SHA-256 integrity…');
   try{
    const raw=await chosen.text();
    if(v!==stamp||!valid())return;
    const checked=await Exchange.inspect(raw,app.io.buildSerializedProjectPayload());
    if(v!==stamp||!valid())return;
    incoming=checked;
    const name=checked.incoming.title,detail=checked.differences;
    const condition=checked.status==='identical'?tr('Contenuti identici','Identical contents'):
     checked.status==='divergent'?tr('Stesso progetto, modifiche divergenti','Same project, divergent edits'):
      tr('Un progetto differente','A different project');
    report.textContent=condition+'\n'+name+' · '+checked.incoming.nodes+tr(' nodi',' nodes')+
     (detail?'\n'+tr('Aggiunti: ','Added: ')+detail.added+tr(' · rimossi: ',' · removed: ')+detail.removed+
      tr(' · modificati: ',' · modified: ')+detail.modified:'');
    openCopy.disabled=checked.status==='identical';
    status.textContent=tr('Confronto verificato. Nessun dato è stato modificato. Le differenze non sono un merge automatico.',
      'Verified comparison. No data changed. Differences are not automatically merged.');
   }catch(e){if(v===stamp)status.textContent=tr('Copia non valida: ','Invalid copy: ')+String(e.message||e)}
  });
  openCopy.addEventListener('click',async()=>{
   if(!incoming||!valid()||openCopy.disabled)return;
   const packet=incoming,owner=originalState,tab=originalTab;
   const choice=await app.nmAsk({title:tr('Aprire una copia separata?','Open separate copy?'),
    message:tr('Verrà creata una nuova scheda non collegata al file originale. Le modifiche divergenti non saranno unite o sovrascritte.',
      'A new tab will be opened without linking to the original file. Divergent edits will not be merged or overwritten.'),
    choices:[{value:'cancel',text:tr('Annulla','Cancel')},
     {value:'yes',text:tr('Apri copia','Open copy'),primary:true}]});
   if(choice!=='yes'||owner!==app.state||tab!==app.activeTabId)return;
   openCopy.disabled=true;
   try{
    const serialized=JSON.stringify(packet.project);
    const name=app.io.sanitizeFilename(packet.incoming.title||'project').slice(0,65)+'.neuromap';
    await app.importFile(new File([serialized],name,{type:'application/json'}),{newTab:true});
    dismiss();
    app.showToast(tr('Copia aperta in nuova scheda; nessun file sovrascritto.',
     'Copy opened in new tab; no original file overwritten.'),'SCAMBIO');
   }catch(e){status.textContent=tr('Apertura fallita: ','Open failed: ')+String(e.message||e);
    openCopy.disabled=false;}
  });
  app._nmExchange={open:()=>launch.click(),close:dismiss};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
