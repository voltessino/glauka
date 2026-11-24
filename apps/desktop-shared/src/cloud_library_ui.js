/* Desktop cloud library: a strictly manual, non-destructive import workflow.
 * The account panel mounts this only for an authenticated provider.
 * No automatic save, upload, cross-account queue, or token handling.
 */
(()=>{
 'use strict';
 const tr=(it,en)=>{
  if(window.GlaukaI18n)return window.GlaukaI18n.pair(it,en);
  try{return localStorage.getItem('nm6_locale')==='en'?en:it}
  catch(_){return document.documentElement.lang==='en'?en:it}
 };
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);
  if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
 let panel=null,reader=null,provider=null,entries=[],busy=false,epoch=0,visibleLimit=80;
 function reset(){
  epoch++;
  panel?.remove();panel=null;reader=null;provider=null;entries=[];busy=false;visibleLimit=80;
 }
 function getReader(){
  if(reader)return reader;
  const R=window.GlaukaCloudReader,P=window.GlaukaCloudProviders,
    C=window.GlaukaCloudCore,H=window.GlaukaCloudHash,
    transport=window.neuromapDesktop?.cloudTransport;
  if(!R||!P||!C||!H||!transport)throw Error('Cloud recovery module unavailable');
  reader=R.createReader({
   providers:{google:()=>P.google({transport}),dropbox:()=>P.dropbox({transport}),
    onedrive:()=>P.onedrive({transport})},
   hash:H.sha256,assertDocument:C.assertDocument,
   editor:()=>window.neuroMapApp,
   isAllowed:(()=>{const current=epoch;return ()=>current===epoch&&!!panel?.isConnected})()
  });
  return reader;
 }
 async function open(id,container,feedback){
  if(busy)return;
  if(id!=='google'&&id!=='dropbox'&&id!=='onedrive')return;
  reset();provider=id;busy=true;
  const openedAt=epoch;
  panel=el('section','gl-cloud-library');
  panel.setAttribute('aria-label',tr('Recupero mappe','Recover maps'));
  const title=el('h3','',tr('Mappe nel cloud','Cloud maps'));
  const info=el('p','gl-cloud-library-info',tr('Caricamento dell’elenco…','Loading map list…'));
  const search=el('input','gl-cloud-library-search');search.type='search';
  search.placeholder=tr('Cerca una mappa','Search maps');
  search.setAttribute('aria-label',search.placeholder);
  const items=el('div','gl-cloud-library-items');
  panel.append(title,info,search,items);container.append(panel);
  visibleLimit=80;
  function render(){
   items.replaceChildren();
   const filtered=entries.filter(x=>x.name.toLocaleLowerCase()
      .includes(search.value.trim().toLocaleLowerCase()));
   info.textContent=tr('Mappe disponibili: ','Available maps: ')+entries.length+
     tr(' · Visualizzate: ',' · Shown: ')+Math.min(filtered.length,visibleLimit);
   if(!filtered.length)items.append(el('p','gl-cloud-note',
     tr('Nessuna mappa trovata.','No maps found.')));
   for(const documentInfo of filtered.slice(0,visibleLimit)){
    const row=el('div','gl-cloud-row gl-cloud-map-row'),
     meta=el('div','gl-cloud-map-detail');
    meta.setAttribute('data-glauka-user-content','');
    meta.append(el('strong','',documentInfo.name),
      el('small','',tr('Copia cloud · recupero in nuove schede','Cloud copy · restores into new tabs')));
    const pick=el('button','gl-cloud-restore',tr('Recupera copia','Restore copy'));
    pick.type='button';row.append(meta,pick);items.append(row);
    pick.addEventListener('click',()=>{
     if(busy)return;
     pick.hidden=true;
     const confirm=el('div','gl-cloud-restore-confirm');
     const question=el('small','',tr('Aprire questa mappa in una nuova scheda, senza sostituire le altre?',
      'Open this map in a new tab without replacing other maps?'));
     const accept=el('button','',tr('Conferma','Confirm')),
      cancel=el('button','gl-cloud-disconnect',tr('Annulla','Cancel'));
     accept.type=cancel.type='button';
     const dismiss=()=>{confirm.remove();pick.hidden=false};
     cancel.addEventListener('click',dismiss);
     accept.addEventListener('click',async()=>{
      if(busy)return;busy=true;accept.disabled=cancel.disabled=true;
      feedback.textContent=tr('Scaricamento, verifica e salvataggio locale…',
        'Downloading, verifying and saving locally…');
      try{
       const restored=await getReader().restore(id,documentInfo.id);
       feedback.textContent=tr('Copia aperta in una nuova scheda e salvata sul dispositivo.',
         'Copy opened in a new tab and saved on the device.')+
         ' ('+restored.count+' '+tr('nodi','nodes')+')';
       dismiss();
      }catch(error){
       feedback.textContent=/not confirmed/i.test(String(error?.message||''))
        ?tr('ATTENZIONE: la mappa è aperta ma non risulta salvata. Esporta subito un backup.',
           'WARNING: map is open but local save is unconfirmed. Export a backup now.')
        :tr('Importazione interrotta. Aggiorna l’elenco e riprova.',
           'Import stopped. Refresh the list and try again.');
      }finally{busy=false;accept.disabled=cancel.disabled=false}
     });
     confirm.append(question,accept,cancel);row.append(confirm);
    });
   }
   if(filtered.length>visibleLimit){
    const more=el('button','gl-cloud-library-more',
      tr('Mostra altre mappe (','Show more maps (')+
      Math.min(80,filtered.length-visibleLimit)+')');
    more.type='button';
    more.addEventListener('click',()=>{visibleLimit+=80;render()});
    items.append(more);
   }
  }
  search.addEventListener('input',()=>{visibleLimit=80;render()});
  try{
   entries=await getReader().discover(id);
   if(openedAt!==epoch)return;
   render();
   feedback.textContent=tr('Seleziona una mappa da recuperare. Nessun upload automatico.',
     'Select a map to restore. No automatic upload.');
  }catch(_){
   if(openedAt!==epoch)return;
   info.textContent=tr('Impossibile leggere le mappe: controlla connessione e permessi.',
    'Cannot list maps: check connection and permissions.');
   feedback.textContent=info.textContent;
  }finally{if(openedAt===epoch)busy=false}
 }
 window.GlaukaCloudLibrary=Object.freeze({open,reset});
})();
