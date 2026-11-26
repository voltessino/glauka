const NM_I18N={
 it:{upgrade:'Passa a Pro',title:'Glauka · Licenza',subtitle:'Una sola app. Due modi per creare.',freeDesc:'Gratuita per sempre. Sette viste, mappe senza un limite, OCR sul dispositivo, strumenti locali, flashcard e quiz preparati a mano.',proDesc:'In preparazione. Non è ancora in vendita.',license:'Hai già una licenza Pro?',activate:'Attiva licenza',activationHint:'Se hai già un codice, inseriscilo qui.',noPlan:'Licenza non attiva',enterKey:'Inserisci una chiave di licenza valida.',logout:'Disattiva su questo browser',notConfigured:'Attivazione online non configurata: serve un server licenze pubblicato.',needPro:'Questa funzione richiede Glauka Pro.',close:'Chiudi',welcomeTitle:'Idee, studio e progetti',welcomeDesc:'Benvenuto in Glauka',welcomeGo:'Continua nell’editor',welcomeImport:'Apri un progetto',welcomeSmall:'Free senza registrazione · AI solo con Pro',local:'Progetti locali e backup esportabili',privacy:'La versione web conserva i progetti su questo browser. Esporta periodicamente un backup; non è ancora una sincronizzazione cloud.',detailsTitle:'Il codice vale fino alla data scritta dentro',buy:'Non è per sempre. La proposta per l’Italia, non ancora acquistabile, è 39 € in lancio e poi 59 € IVA inclusa. Il costo del fornitore è a parte.'},
 en:{upgrade:'Go Pro',title:'Glauka · License',subtitle:'One app. Two ways to create.',freeDesc:'Free forever. Seven views, maps without a cap, on-device text recognition, local tools, and flashcards and quizzes you write yourself.',proDesc:'In preparation. It is not for sale yet.',license:'Already have a Pro license?',activate:'Activate license',activationHint:'If you already have a code, enter it here.',noPlan:'No active license',enterKey:'Enter a valid license key.',logout:'Deactivate in this browser',notConfigured:'Online activation is not configured. The license server must be deployed.',needPro:'This feature requires Glauka Pro.',close:'Close',welcomeTitle:'Ideas, study and projects',welcomeDesc:'Welcome to Glauka',welcomeGo:'Continue to editor',welcomeImport:'Open a project',welcomeSmall:'Free without registration · Pro unlocks AI',local:'Local projects and exportable backups',privacy:'The web version saves projects in this browser. Export backups regularly; cloud synchronization is not available yet.',detailsTitle:'A code lasts until the date written inside it',buy:'It is not forever. The proposed price in Italy, not yet for sale, is €39 at launch and then €59 including VAT. The provider cost is separate.'}
};
Object.assign(NM_DICT,NeuroMapLocale.messages);
const nmLocale=()=>window.GlaukaI18n?.normalize(localStorage.getItem('nm6_locale'))||(localStorage.getItem('nm6_locale')==='en'?'en':'it');
const nmT=key=>{const text=(NM_I18N[nmLocale()]||NM_I18N.en)[key]||key;return window.GlaukaI18n?.translate(text)||text;};
const nmAPI=async(route,data)=>{
 const opts={method:'POST',headers:{'Content-Type':'application/json','X-NeuroMap-Client':'architect'},credentials:'same-origin',body:JSON.stringify(data||{})};
 const result=await fetch('/api/'+route,opts);const body=await result.json().catch(()=>({}));
 if(!result.ok)throw Error(body.message||'License service unavailable');return body;
};
const nativeProduct=window.NMAndroidAI?.productStatus?{
 productStatus:()=>JSON.parse(window.NMAndroidAI.productStatus()),
 productActivate:key=>JSON.parse(window.NMAndroidAI.productActivate(key)),
 productLogout:()=>JSON.parse(window.NMAndroidAI.productLogout()),
 productPreviewMode:mode=>JSON.parse(window.NMAndroidAI.productPreviewMode(mode))
}:window.neuromapDesktop;
let nmProductState={plan:'free'};
const nmProduct={
 async status(){return {plan:'open'};},
 async activate(){throw Error('Glauka Open Source edition');},
 async logout(){return {plan:'open'};},
 async preview(){return {plan:'open'};},
 isPro(){return false;},
 guard(){return false;},
 open(){},
 close(){},
 syncBadge(){
  const btn=document.getElementById('nm6-plan-button');
  if(btn){btn.hidden=true;btn.style.display='none';}
 },
 async aiRequest(){throw Error('AI features belong to Glauka Pro (https://glauka.it).');}
};
window.nmProduct=nmProduct;
const nm6Exclude='#glauka-startup,.nm-export-shade,[data-glauka-user-content],script,style,textarea,code,pre,.tab-item,.tabs-list,.ctx-header-node,#status-selected-node,.nm6-skiptranslate,.v4-explain-text,#nm67-notes-preview,.flash-heading,.spotlight-main,.spotlight-path,.spotlight-tab,.nm-android-preview-card strong';
const nm6Original=new WeakMap();
function nm6TranslatedText(raw,locale){return NeuroMapLocale.translate(raw,locale,NM_DICT);}
function nm6Translate(root=document){
 const locale=nmLocale();
 for(const [id,label] of Object.entries(NeuroMapLocale.rangeLabels)){
  const el=root.id===id?root:root.querySelector?.('#'+id);
  if(el){el.setAttribute('data-nm6-aria-label',label);el.setAttribute('aria-label',nm6TranslatedText(label,locale));}
 }
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),list=[];
 while(walk.nextNode())list.push(walk.currentNode);
 for(const node of list){
  if(!node.parentElement||node.parentElement.closest(nm6Exclude))continue;
  let raw=nm6Original.get(node);const current=node.nodeValue||'';
  if(raw===undefined || (current!==raw&&current!==nm6TranslatedText(raw,locale)&&current!==nm6TranslatedText(raw,'en')&&current!==nm6TranslatedText(raw,'it'))){raw=current;nm6Original.set(node,raw);}
  // Undo and Cancel share the Italian word Annulla, but are different actions.
  const out=node.parentElement.closest('[data-nm6-context="undo"]')
    ?raw.replace(raw.trim(),(globalThis.GlaukaI18n?.pair("Annulla","Undo")??(locale==='en'?'Undo':'Annulla'))):nm6TranslatedText(raw,locale);
  if(out!==current)node.nodeValue=out;
 }
 // Textarea contents belong to the user; their placeholder and accessible name
 // belong to the UI and must still follow the selected language.
 const attrExclude=nm6Exclude.replace('textarea,','');
 const selector='[placeholder],[title],[aria-label]';
 const elements=[...(root.matches?.(selector)?[root]:[]),...(root.querySelectorAll?.(selector)||[])];
 for(const el of elements){
  if(el.closest(attrExclude))continue;
  for(const attr of ['placeholder','title','aria-label']){
   const current=el.getAttribute(attr);if(current===null)continue;
   let raw=el.getAttribute('data-nm6-'+attr);
   if(raw===null||(current!==raw&&current!==nm6TranslatedText(raw,locale)&&current!==nm6TranslatedText(raw,'en')&&current!==nm6TranslatedText(raw,'it'))){raw=current;el.setAttribute('data-nm6-'+attr,raw);}
   const out=nm6TranslatedText(raw,locale);if(out!==current)el.setAttribute(attr,out);
  }
 }
}
window.GlaukaStoreUpdates={
 async refresh(){
  const box=document.getElementById('glauka-updates');if(!box)return;
  const pair=(it,en)=>window.GlaukaI18n?.pair(it,en)||(nmLocale()==='it'?it:en);
  let info=null;
  try{info=await window.neuromapDesktop?.distributionStatus?.();}catch{info=null}
  const version=info?.version||(typeof NM_PRODUCT_VERSION!=='undefined'?NM_PRODUCT_VERSION:'');
  box.querySelector('summary').textContent=pair('Aggiornamenti','Updates');
  const store=typeof info?.storeListingUrl==='string'&&info.storeListingUrl.startsWith('https://apps.microsoft.com/')?info.storeListingUrl:'';
  const channel=info?.channel==='microsoft-store'?pair('Microsoft Store','Microsoft Store'):pair('Installazione diretta, non firmata dallo Store','Direct install, not signed by the Store');
  box.querySelector('[data-version]').textContent=pair('Versione attuale: ','Current version: ')+(version||pair('non disponibile','unavailable'));
  box.querySelector('[data-channel]').textContent=pair('Canale: ','Channel: ')+channel;
  box.querySelector('[data-notes]').textContent=info?.releaseNotes||pair('Questa copia arriva dal sito. Il file di avvio Microsoft non sostituisce questo programma.','This copy comes from the website. The Microsoft launcher does not replace this program.');
  box.querySelector('[data-migration]').textContent=info?.rollback||pair('Il passaggio allo Store non cancella mappe, preferenze o licenza.','Moving to the Store does not delete maps, preferences or the license.');
  const button=box.querySelector('button');
  button.disabled=!store;
  button.textContent=store?pair('Apri la pagina nello Store','Open the Store page'):pair('Si apre dall’app installata','Opens from the installed app');
  button.onclick=()=>{if(!store)return;if(window.webkit?.messageHandlers?.neuromapOpenURL?.postMessage)window.webkit.messageHandlers.neuromapOpenURL.postMessage(store);else window.open(store,'_blank','noopener');};
 },
 mount(){
  const modal=document.querySelector('#nm6-plan-modal .nm6-modal');
  if(!modal||document.getElementById('glauka-updates'))return;
  const box=document.createElement('details');
  box.id='glauka-updates';
  box.className='nm6-form';
  const title=document.createElement('summary');title.textContent='Aggiornamenti';
  const version=document.createElement('p');version.dataset.version='';version.className='nm6-small';
  const channel=document.createElement('p');channel.dataset.channel='';channel.className='nm6-small';
  const notes=document.createElement('p');notes.dataset.notes='';notes.className='nm6-small';
  const migration=document.createElement('p');migration.dataset.migration='';migration.className='nm6-small';
  const button=document.createElement('button');button.type='button';button.className='nm6-ghost';button.disabled=true;
  box.append(title,version,channel,notes,migration,button);
  modal.append(box);
  this.refresh();
 }
};
