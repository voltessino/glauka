// Time Machine is native-only: restores create a separate project file.
async function nm614OpenProjectHistory(app){
  return nm614OpenHistoryPanel(app);
}

// Dedicated, accessible native Time Machine browser. Existing File menu and
// clock open the same panel; nothing reads arbitrary paths or overwrites files.
async function nm614OpenHistoryPanel(app){
 const native=window.neuromapDesktop;
 const t=(it,en)=>window.GlaukaI18n?.pair(it,en)??(document.documentElement.lang==='en'?en:it);
 if(!app||!native?.listProjectHistory){
  app?.showToast(t("Cronologia versioni disponibile nell'app desktop installata.","Version history is available in the installed desktop app."),'TIME MACHINE');return;
 }
 const tab=app.tabs?.find(x=>x.id===app.activeTabId);
 if(!tab?.filePath){
  app.showToast(t('Salva il progetto su file per attivare la cronologia versioni.','Save this project to a file first to enable version history.'),'TIME MACHINE');return;
 }
 let curtain=document.getElementById('gl-history-dialog');
 if(!curtain){
  curtain=document.createElement('div');curtain.id='gl-history-dialog';
  curtain.hidden=true;curtain.setAttribute('role','dialog');curtain.setAttribute('aria-modal','true');
  curtain.setAttribute('aria-labelledby','gl-history-title');
  curtain.className='gl-history-curtain';
  const card=document.createElement('section');card.className='gl-history-card';
  const heading=document.createElement('header');heading.className='gl-history-header';
  const titleWrap=document.createElement('div');titleWrap.className='gl-history-title-wrap';
  const badge=document.createElement('div');badge.className='gl-history-badge';
  badge.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>';
  const titleCopy=document.createElement('div');titleCopy.className='gl-history-title-copy';
  const title=document.createElement('h2');title.id='gl-history-title';
  const fileBadge=document.createElement('span');fileBadge.id='gl-history-file';fileBadge.className='gl-history-file-pill';
  titleCopy.append(title,fileBadge);
  titleWrap.append(badge,titleCopy);
  const close=document.createElement('button');close.type='button';close.id='gl-history-close';
  close.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  close.setAttribute('aria-label',t('Chiudi cronologia','Close version history'));
  heading.append(titleWrap,close);
  const note=document.createElement('p');note.id='gl-history-description';
  const content=document.createElement('div');content.className='gl-history-layout';
  const versions=document.createElement('div');versions.id='gl-history-versions';
  versions.setAttribute('role','list');
  const details=document.createElement('section');details.id='gl-history-details';
  details.setAttribute('aria-live','polite');
  content.append(versions,details);
  const footer=document.createElement('footer');footer.className='gl-history-footer';
  const feedback=document.createElement('p');feedback.id='gl-history-feedback';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const actions=document.createElement('div');actions.className='gl-history-actions';
  const pin=document.createElement('button');pin.id='gl-history-pin';pin.type='button';
  const recover=document.createElement('button');recover.id='gl-history-recover';recover.type='button';
  actions.append(pin,recover);
  footer.append(feedback,actions);
  card.append(heading,note,content,footer);curtain.append(card);document.body.append(curtain);
  const css=document.createElement('style');css.id='gl-history-panel-style';
  css.textContent=`
.gl-history-curtain:not([hidden]){position:fixed;inset:0;z-index:9500;display:grid;place-items:center;background:rgba(15,23,42,.62);backdrop-filter:blur(6px);padding:16px;box-sizing:border-box}
.gl-history-curtain[hidden]{display:none!important}
.gl-history-card{
  background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#141926);
  border:1px solid var(--nm-skin-stroke,#d7deed);border-radius:18px;
  box-shadow:0 24px 68px rgba(15,23,42,.28);width:min(880px,100%);max-height:calc(100dvh - 32px);
  display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;
  font:13.5px/1.5 Inter,system-ui,-apple-system,sans-serif;
}
.gl-history-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--nm-skin-stroke,#d7deed)}
.gl-history-title-wrap{display:flex;align-items:center;gap:12px;min-width:0}
.gl-history-badge{width:38px;height:38px;flex:0 0 38px;border-radius:11px;display:grid;place-items:center;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 14%,transparent);color:var(--nm-theme-action,#5b3fd0);border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 26%,transparent)}
.gl-history-title-copy{display:grid;gap:2px;min-width:0}
.gl-history-header h2{margin:0;font-size:17px;font-weight:750;line-height:1.25}
.gl-history-file-pill{font-size:11.5px;color:var(--nm-skin-muted,#5c6680);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gl-history-card button{border:1px solid var(--nm-skin-stroke,#d7deed);border-radius:10px;background:var(--nm-skin-top,#f4f6fc);color:var(--nm-skin-ink,#141926);padding:8px 13px;cursor:pointer;font:inherit;font-weight:600;transition:border-color .15s,background-color .15s}
.gl-history-card button:hover:not(:disabled){border-color:var(--nm-theme-focus,#7c5ce7)}
.gl-history-card button:disabled{opacity:.48;cursor:default}
.gl-history-card button:focus-visible{outline:2px solid var(--nm-theme-focus,#5b3fd0);outline-offset:2px}
#gl-history-close{width:34px;height:34px;padding:0;display:grid;place-items:center;flex:none}
#gl-history-description{margin:0;padding:10px 20px 0;color:var(--nm-skin-muted,#5c6680);font-size:12.5px;line-height:1.5}
.gl-history-layout{display:grid;grid-template-columns:minmax(220px,.88fr) minmax(0,1.22fr);gap:14px;padding:12px 20px;flex:1 1 auto;min-height:0;overflow:hidden}
#gl-history-versions{display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto;padding-right:4px}
.gl-history-item{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px;width:100%;text-align:left;padding:10px 12px!important;border-radius:12px!important;position:relative}
.gl-history-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}
.gl-history-item-top strong{font-size:12.5px;font-weight:700}
.gl-history-item-meta{font-size:11.5px;color:var(--nm-skin-muted,#5c6680);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.gl-history-pin-tag{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,#f59e0b 16%,transparent);border:1px solid color-mix(in srgb,#f59e0b 45%,transparent);color:#b45309}
.gl-history-item[aria-pressed="true"]{border-color:var(--nm-theme-action,#5b3fd0)!important;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 10%,var(--nm-skin-surface,#ffffff))!important;box-shadow:inset 3px 0 0 var(--nm-theme-action,#5b3fd0)}
#gl-history-details{padding:14px 16px;border:1px solid var(--nm-skin-stroke,#d7deed);border-radius:14px;background:var(--nm-skin-top,#f4f6fc);display:flex;flex-direction:column;gap:11px;overflow-y:auto;max-height:380px}
.gl-history-detail-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.gl-history-detail-head h3{font-size:14.5px;font-weight:750;margin:0}
.gl-history-format-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 35%,transparent);background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 11%,transparent);color:var(--nm-theme-action,#5b3fd0)}
.gl-history-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.gl-history-kpi{padding:8px 9px;border-radius:10px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed);display:grid;gap:2px}
.gl-history-kpi strong{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
.gl-history-kpi span{font-size:10.5px;font-weight:600;color:var(--nm-skin-muted,#5c6680)}
.gl-history-kpi[data-tone="add"] strong{color:#059669}
.gl-history-kpi[data-tone="mod"] strong{color:#d97706}
.gl-history-kpi[data-tone="rem"] strong{color:#dc2626}
.gl-history-samples{display:grid;gap:6px;padding:9px 11px;border-radius:10px;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#d7deed)}
.gl-history-samples-title{font-size:11.5px;font-weight:700;color:var(--nm-skin-muted,#5c6680)}
.gl-history-chips{display:flex;flex-wrap:wrap;gap:5px}
.gl-history-chip{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--nm-skin-stroke,#d7deed);background:var(--nm-skin-top,#f4f6fc);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gl-history-chip[data-kind="add"]{border-color:color-mix(in srgb,#10b981 40%,transparent);color:#047857}
.gl-history-chip[data-kind="mod"]{border-color:color-mix(in srgb,#f59e0b 45%,transparent);color:#b45309}
.gl-history-chip[data-kind="rem"]{border-color:color-mix(in srgb,#ef4444 40%,transparent);color:#b91c1c}
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-pin-tag,
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-chip[data-kind="mod"],
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-kpi[data-tone="mod"] strong{color:#fbbf24}
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-chip[data-kind="add"],
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-kpi[data-tone="add"] strong{color:#34d399}
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-chip[data-kind="rem"],
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-kpi[data-tone="rem"] strong{color:#f87171}
body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .gl-history-format-badge{color:#c4b5fd;border-color:color-mix(in srgb,#a78bfa 45%,transparent);background:color-mix(in srgb,#8b5cf6 18%,transparent)}
#gl-history-preview-canvas{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--nm-skin-stroke,#d7deed)}
.gl-history-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 20px;border-top:1px solid var(--nm-skin-stroke,#d7deed);background:var(--nm-skin-top,#f4f6fc)}
#gl-history-feedback{margin:0;color:var(--nm-skin-muted,#5c6680);font-size:12px;flex:1 1 220px}
.gl-history-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
#gl-history-recover{background:var(--nm-theme-action,#5b3fd0)!important;border-color:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important}
#gl-history-recover:hover:not(:disabled){filter:brightness(1.06)}
@media(max-width:680px){
  .gl-history-layout{grid-template-columns:1fr;overflow:auto}
  #gl-history-versions{max-height:175px}
  #gl-history-details{max-height:none}
  .gl-history-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .gl-history-header,.gl-history-layout,.gl-history-footer{padding-inline:14px}
}
`;
  document.head.append(css);
  close.addEventListener('click',()=>curtain._close?.());
  curtain.addEventListener('click',e=>{if(e.target===curtain)curtain._close?.()});
  curtain.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();curtain._close?.()}
   if(e.key==='Tab'){
    const focusable=[...curtain.querySelectorAll('button:not(:disabled)')];
    const i=focusable.indexOf(document.activeElement);
    if(e.shiftKey&&i===0){e.preventDefault();focusable.at(-1)?.focus()}
    else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();focusable[0]?.focus()}
   }
  });
 }
 let selected=null,rows=[],epoch=0;
 const releasePreview=()=>{
  const canvas=curtain.querySelector('#gl-history-preview-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(ctx)ctx.clearRect(0,0,canvas.width,canvas.height);
  canvas.width=0;canvas.height=0;canvas.remove();
 };
 const caller=document.activeElement;
 curtain._close=()=>{epoch++;releasePreview();curtain.hidden=true;curtain._releasePreview=null;caller?.focus?.()};
 curtain.hidden=false;
 curtain.querySelector('#gl-history-title').textContent=t('Cronologia versioni','Version history');
 curtain.querySelector('#gl-history-file').textContent=tab.fileName||tab.filePath;
 curtain.querySelector('#gl-history-description').textContent=t(
  'Ogni salvataggio su file conserva automaticamente le ultime 12 versioni. Puoi confrontare cosa è cambiato, bloccare quelle importanti perché non si eliminino e aprirle come file separato.',
  'Each file save keeps the last 12 revisions locally. Review exact differences, protect important revisions from automatic cleanup, or open a separate copy safely.');
 const list=curtain.querySelector('#gl-history-versions'),detail=curtain.querySelector('#gl-history-details');
 const pin=curtain.querySelector('#gl-history-pin'),recover=curtain.querySelector('#gl-history-recover');
 const feedback=curtain.querySelector('#gl-history-feedback');
 const langLoc=document.documentElement.lang==='en'?'en-GB':'it-IT';
 const formatWhen=iso=>{
  const d=new Date(iso);
  const now=new Date();
  const sameDay=d.toDateString()===now.toDateString();
  const yest=new Date(now.getTime()-86400000).toDateString()===d.toDateString();
  const time=d.toLocaleTimeString(langLoc,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if(sameDay)return t('Oggi','Today')+' · '+time;
  if(yest)return t('Ieri','Yesterday')+' · '+time;
  return d.toLocaleDateString(langLoc)+' · '+time;
 };
 const formatSize=bytes=>bytes>=1048576?((bytes/1048576).toFixed(1)+' MB'):(Math.max(1,Math.round(bytes/1024))+' KB');
 const setButtons=()=>{
  pin.disabled=!selected||typeof native.pinProjectHistory!=='function';
  recover.disabled=!selected;
  pin.textContent=selected?.pinned
   ?t('★ Protetta · sblocca','★ Protected · unpin')
   :t('★ Proteggi dall’eliminazione auto','★ Protect from auto-cleanup');
  pin.title=t('Le versioni protette (max 5) restano sempre archiviate anche dopo molti salvataggi.','Protected versions (up to 5) are never deleted by rolling cleanup.');
  recover.textContent=t('Apri come copia separata','Open as separate copy');
  recover.title=t('Crea una copia indipendente accanto all’originale senza toccare il file attuale.','Saves a new independent file beside the original without touching your open project.');
 };
 async function select(v){
  selected=v;const myEpoch=++epoch;
  for(const b of list.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.id===v.id));
  setButtons();
  releasePreview();
  detail.replaceChildren();
  const head=document.createElement('div');head.className='gl-history-detail-head';
  const title=document.createElement('h3');title.textContent=formatWhen(v.savedAt);
  const badge=document.createElement('span');badge.className='gl-history-format-badge';badge.textContent=t('Analisi formato…','Checking format…');
  head.append(title,badge);
  const message=document.createElement('p');message.className='gl-history-samples-title';message.textContent=t('Confronto rispetto al file attualmente salvato…','Comparing against currently saved file…');
  detail.append(head,message);
  if(typeof native.describeProjectHistory!=='function'){badge.textContent='Info';message.textContent=t('Confronto non disponibile in questa versione.','Comparison unavailable in this version.');return}
  try{
   const diff=await native.describeProjectHistory(tab.filePath,v.id);
   if(epoch!==myEpoch||curtain.hidden)return;
   if(diff.supported){
    badge.textContent=diff.format||t('Mappa riconosciuta','Supported map');
    message.textContent=t(`Versione archiviata: ${diff.before} nodi · file attuale: ${diff.now} nodi`,
      `Archived revision: ${diff.before} nodes · current file: ${diff.now} nodes`);
    const kpis=document.createElement('div');kpis.className='gl-history-kpis';
    for(const [tone,val,lbl] of [
     ['add','+'+diff.added,t('Aggiunti oggi','Added since')],
     ['mod',String(diff.modified),t('Modificati','Modified')],
     ['rem','-'+diff.removed,t('Rimossi oggi','Removed since')],
     ['img',`${diff.imagesBefore} → ${diff.imagesNow}`,t('Immagini','Images')]
    ]){
     const card=document.createElement('div');card.className='gl-history-kpi';card.dataset.tone=tone;
     const num=document.createElement('strong');num.textContent=val;
     const cap=document.createElement('span');cap.textContent=lbl;
     card.append(num,cap);kpis.append(card);
    }
    detail.append(kpis);
    const hasSamples=(diff.addedNames?.length||diff.modifiedNames?.length||diff.removedNames?.length);
    if(hasSamples){
     const samplesBox=document.createElement('div');samplesBox.className='gl-history-samples';
     samplesBox.append(Object.assign(document.createElement('span'),{className:'gl-history-samples-title',textContent:t('Principali concetti cambiati da questa versione ad oggi','Key topics changed since this revision')}));
     const chips=document.createElement('div');chips.className='gl-history-chips';
     const pushChips=(items,kind,prefix)=>{
      for(const label of (items||[]).slice(0,4)){
       const ch=document.createElement('span');ch.className='gl-history-chip';ch.dataset.kind=kind;
       ch.textContent=prefix+' '+label;chips.append(ch);
      }
     };
     pushChips(diff.addedNames,'add','+');
     pushChips(diff.modifiedNames,'mod','~');
     pushChips(diff.removedNames,'rem','−');
     samplesBox.append(chips);detail.append(samplesBox);
    }else if(!diff.added&&!diff.modified&&!diff.removed){
     const same=document.createElement('p');same.className='gl-history-samples-title';
     same.textContent=t('Struttura dei nodi identica alla copia attualmente salvata.','Node tree matches the currently saved file.');
     detail.append(same);
    }
    paintHistoryPreview(detail,app,diff);
   }else{
    badge.textContent=t('Formato binario','Binary archive');
    message.textContent=diff.reason||t('Il contenuto interno non può essere confrontato nodo per nodo, ma puoi comunque aprire questa versione come file separato.','Contents could not be diffed node by node, but you can still recover this revision as a separate copy.');
   }
  }catch(_){if(epoch===myEpoch){badge.textContent='Info';message.textContent=t('Confronto non disponibile.','Comparison unavailable.')}}
 }
 function render(){
  list.replaceChildren();
  if(!rows.length){
   const p=document.createElement('p');p.className='gl-history-samples-title';
   p.textContent=t('Nessuna versione precedente ancora registrata. Verrà salvata automaticamente al prossimo Ctrl+S modificato.','No earlier versions recorded yet. Your first snapshot is created before the next modified save.');
   list.append(p);
  }
  for(const v of rows){
   const b=document.createElement('button');b.type='button';b.className='gl-history-item';b.dataset.id=v.id;
   b.setAttribute('aria-pressed',String(v===selected));
   const top=document.createElement('div');top.className='gl-history-item-top';
   const when=document.createElement('strong');when.textContent=formatWhen(v.savedAt);
   top.append(when);
   if(v.pinned){
    const tag=document.createElement('span');tag.className='gl-history-pin-tag';tag.textContent=t('★ Protetta','★ Protected');
    top.append(tag);
   }
   const meta=document.createElement('div');meta.className='gl-history-item-meta';
   meta.textContent=formatSize(v.size)+(v.pinned?' · '+t('Esclusa da pulizia','Kept permanently'):'');
   b.append(top,meta);
   b.addEventListener('click',()=>void select(v));
   list.append(b);
  }
  setButtons();
 }
 feedback.textContent=t('Caricamento versioni…','Loading versions…');pin.disabled=true;recover.disabled=true;
 try{
  const response=await native.listProjectHistory(tab.filePath);
  if(curtain.hidden)return;
  rows=response.versions||[];
  selected=null;render();
  feedback.textContent=t('Archivio locale: 12 revisioni automatiche + fino a 5 versioni protette.',
   'Local archive: 12 rolling revisions + up to 5 protected versions.');
  if(rows.length)await select(rows[0]);
 }catch(error){feedback.textContent=t('Cronologia non disponibile: ','Version history unavailable: ')+error.message;return}
 pin.onclick=async()=>{
  if(!selected)return;
  pin.disabled=true;
  try{
   const result=await native.pinProjectHistory(tab.filePath,selected.id,!selected.pinned);
   selected.pinned=!!result.pinned;render();
   feedback.textContent=selected.pinned
    ?t('Versione protetta: non verrà mai cancellata dalle pulizie automatiche.','Version protected: it will never be pruned by rolling cleanup.')
    :t('Protezione rimossa: segue la rotazione delle ultime 12 versioni.','Protection removed: follows the 12-version rolling history.');
  }catch(error){feedback.textContent=t('Impossibile proteggere la versione: ','Unable to protect version: ')+error.message}
  setButtons();
 };
 recover.onclick=async()=>{
  if(!selected)return;
  const version=selected;
  curtain.hidden=true;
  const choice=await app.nmAsk({title:t('Aprire questa versione come copia separata?','Open this revision as a separate copy?'),
   message:t('Verrà salvato un nuovo file accanto al progetto attuale. La mappa aperta ora e le eventuali modifiche non salvate resteranno intatte.',
    'A new sibling file will be created beside the original. Your open map and any unsaved changes remain completely untouched.'),
   choices:[{value:'cancel',text:t('Annulla','Cancel')},{value:'yes',text:t('Crea copia separata','Create separate copy'),primary:true}]});
  curtain.hidden=false;
  curtain.querySelector('#gl-history-close')?.focus();
  if(choice!=='yes')return;
  recover.disabled=true;
  try{
   const restored=await native.recoverProjectHistory(tab.filePath,version.id);
   feedback.textContent=t('Copia creata accanto all’originale: ','Separate copy saved: ')+restored.name;
   app.showToast(feedback.textContent,'TIME MACHINE');
  }catch(error){feedback.textContent=t('Recupero non riuscito: ','Recovery failed: ')+error.message}
  recover.disabled=false;
 };
 curtain.querySelector('#gl-history-close').focus();
}
window.GlaukaVersionHistory={open:nm614OpenHistoryPanel};

window.addEventListener('DOMContentLoaded',()=>{NM614.mountDock();
  if(!document.getElementById('gl-quick-actions-style')){
    const sheet=document.createElement('style');sheet.id='gl-quick-actions-style';
    sheet.textContent='.gl-browser-add-tab{min-width:34px!important;width:34px!important;min-height:34px!important;height:34px!important;padding:0!important;display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;border-radius:10px!important;font:600 24px/1 system-ui!important}.gl-toolbar-utility{display:inline-flex;align-items:center;justify-content:center;flex:0 0 36px;min-width:36px;height:36px;border:1px solid var(--nm-skin-stroke,#7082aa);border-radius:10px;background:var(--nm-skin-surface,#17233e);color:var(--nm-skin-ink,#f4f6ff);font:650 24px/1 system-ui;cursor:pointer}.gl-toolbar-utility:focus-visible,.gl-browser-add-tab:focus-visible{outline:2px solid var(--nm-theme-focus,#a78bfa);outline-offset:2px}.tab-bar #gl-cloud-quick{margin-left:auto;font-size:22px}.tab-bar #gl-history-quick{font-size:24px}';
    document.head.append(sheet);
  }
  const tabBar=document.querySelector('.tab-bar');
  if(tabBar&&!document.getElementById('gl-history-quick')){
    const history=document.createElement('button');history.type='button';
    history.id='gl-history-quick';history.className='gl-toolbar-utility nm6-skiptranslate';
    history.textContent='◷';
    history.title='Cronologia versioni · Time Machine';
    history.setAttribute('aria-label','Cronologia delle versioni del progetto');
    history.addEventListener('click',()=>void nm614OpenHistoryPanel(window.neuroMapApp));
    const status=document.getElementById('glauka-save-indicator');
    if(status)status.after(history);else tabBar.append(history);
  }
  const historyAnchor=window.neuromapDesktop?document.getElementById('menu-save-file-as'):null;
  if(historyAnchor && !document.getElementById('menu-project-history')){
    const button=document.createElement('button');button.id='menu-project-history';
    button.type='button';button.className='dropdown-item';
    const labelSpan=document.createElement('span');
    button.append(labelSpan);
    if(window.NeuroMapWorkspaceLocale?.bind)window.NeuroMapWorkspaceLocale.bind(labelSpan,'Cronologia versioni…','Version history…');
    else labelSpan.textContent=(globalThis.GlaukaI18n?.pair("Cronologia versioni…","Version history…")??(document.documentElement.lang==='en'?'Version history…':'Cronologia versioni…'));
    historyAnchor.after(button);
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const app=window.neuroMapApp;app?.hideMenus?.();
      if(app)void nm614OpenHistoryPanel(app);
    });
  }
  const saveAllButton=document.getElementById('menu-save-all-tabs');
  saveAllButton?.addEventListener('click',()=>window.neuroMapApp?.saveAllTabs());
  document.getElementById('menu-save-file-as')?.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();window.neuroMapApp?.hideMenus?.();
    window.neuroMapApp?.saveActiveTabSafe(true);
  },true);
});
function paintHistoryPreview(host,app,diff){
 const canvas=document.createElement('canvas');
 canvas.id='gl-history-preview-canvas';
 canvas.width=360;canvas.height=165;
 canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return;
 const isDark=document.body?.dataset?.nmSkin==='graphite'||document.body?.dataset?.nmSkin==='slate';
 ctx.fillStyle=isDark?'#0f1728':'#f8fafc';
 ctx.fillRect(0,0,canvas.width,canvas.height);
 const added=new Set(Array.isArray(diff.addedIds)?diff.addedIds.slice(0,240):[]);
 const modified=new Set(Array.isArray(diff.modifiedIds)?diff.modifiedIds.slice(0,240):[]);
 const nodes=[];
 const map=app?.layout?.nodeLayoutMap;
 if(map){
  for(const [id,metric] of map){
   if(!metric||!Number.isFinite(metric.x)||!Number.isFinite(metric.y))continue;
   nodes.push({id,x:metric.x,y:metric.y});
   if(nodes.length>=480)break;
  }
 }
 if(!nodes.length){
  const dots=(count,color,y)=>{
   const n=Math.max(0,Math.min(24,Number(count)||0));
   ctx.fillStyle=color;
   for(let i=0;i<n;i++){ctx.beginPath();ctx.arc(18+i*13,y,4,0,Math.PI*2);ctx.fill();}
  };
  dots(diff.added,'#10b981',60);
  dots(diff.modified,'#f59e0b',105);
  host.append(canvas);
  return;
 }
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const node of nodes){
  minX=Math.min(minX,node.x);maxX=Math.max(maxX,node.x);
  minY=Math.min(minY,node.y);maxY=Math.max(maxY,node.y);
 }
 const pad=16,spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);
 const scale=Math.min((canvas.width-pad*2)/spanX,(canvas.height-pad*2)/spanY);
 for(const node of nodes){
  const marked=added.has(node.id)||modified.has(node.id);
  ctx.beginPath();
  ctx.fillStyle=added.has(node.id)?'#10b981':modified.has(node.id)?'#f59e0b':(isDark?'#64748b':'#94a3b8');
  ctx.arc(pad+(node.x-minX)*scale,pad+(node.y-minY)*scale,marked?4.2:2.4,0,Math.PI*2);
  ctx.fill();
 }
 host.append(canvas);
}
window.NM614=NM614;

window.addEventListener('DOMContentLoaded',async()=>{await window.GlaukaI18n?.ready;try{nm6InjectShell()}catch(err){console.warn('Product shell:',err)}try{nm70OrganizeControls();nm70InitLocalization()}catch(err){console.error('Inspector structure:',err)}});
