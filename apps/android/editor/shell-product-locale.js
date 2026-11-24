const NM_I18N={
 it:{plan:'Piano Free',upgrade:'Passa a Pro',title:'Glauka · Licenza',subtitle:'Una sola app. Due modi per creare.',free:'Free',pro:'Pro',freeDesc:'Gratuita per sempre. Sette viste, mappe senza un limite, OCR sul dispositivo, strumenti locali, flashcard e quiz preparati a mano.',proDesc:'In preparazione. Non è ancora in vendita.',license:'Hai già una licenza Pro?',activate:'Attiva licenza',activationHint:'Se hai già un codice, inseriscilo qui.',noPlan:'Licenza non attiva',activated:'Licenza Pro attivata!',enterKey:'Inserisci una chiave di licenza valida.',logout:'Disattiva su questo browser',notConfigured:'Attivazione online non configurata: serve un server licenze pubblicato.',needPro:'Questa funzione richiede Glauka Pro.',close:'Chiudi',welcomeTitle:'Dai forma alle tue idee.',welcomeDesc:'Mappe mentali potenti, pensate per imparare e creare. Tutti i tuoi file rimangono sotto il tuo controllo.',welcomeGo:'Inizia a creare',welcomeImport:'Apri un progetto',welcomeSmall:'Free senza registrazione · AI solo con Pro',local:'Mappe locali e backup esportabili',privacy:'I progetti restano su questo dispositivo. Esporta regolarmente una copia di sicurezza.',detailsTitle:'Il codice vale fino alla data scritta dentro',buy:'Non è per sempre. La proposta per l’Italia, non ancora acquistabile, è 39 € in lancio e poi 59 € IVA inclusa. Il costo del fornitore è a parte.',yes:'Sì'},
 en:{plan:'Free plan',upgrade:'Go Pro',title:'Glauka · License',subtitle:'One app. Two ways to create.',free:'Free',pro:'Pro',freeDesc:'Free forever. Seven views, maps without a cap, on-device text recognition, local tools, and flashcards and quizzes you write yourself.',proDesc:'In preparation. It is not for sale yet.',license:'Already have a Pro license?',activate:'Activate license',activationHint:'If you already have a code, enter it here.',noPlan:'No active license',activated:'Pro license activated!',enterKey:'Enter a valid license key.',logout:'Deactivate in this browser',notConfigured:'Online activation is not configured. The license server must be deployed.',needPro:'This feature requires Glauka Pro.',close:'Close',welcomeTitle:'Give your ideas shape.',welcomeDesc:'A powerful mind-mapping workspace for learning and creating. Your files remain under your control.',welcomeGo:'Start creating',welcomeImport:'Open a project',welcomeSmall:'Free without registration · Pro unlocks AI',local:'Local projects and exportable backups',privacy:'Projects stay on this device. Export a backup regularly.',detailsTitle:'A code lasts until the date written inside it',buy:'It is not forever. The proposed price in Italy, not yet for sale, is €39 at launch and then €59 including VAT. The provider cost is separate.',yes:'Yes'}
};
Object.assign(NM_DICT,NeuroMapLocale.messages);
const nmLocale=()=>globalThis.GlaukaI18n?.locale()||(localStorage.getItem('nm6_locale')==='en'?'en':'it');
const nmT=key=>globalThis.GlaukaI18n?.pair(NM_I18N.it[key]||key,NM_I18N.en[key]||key)||(NM_I18N[nmLocale()]||NM_I18N.it)[key]||key;
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
const nm6Exclude='script,style,textarea,code,pre,.tab-item,.tabs-list,.ctx-header-node,#status-selected-node,.nm6-skiptranslate,.v4-explain-text,#nm67-notes-preview,.flash-heading,.spotlight-main,.spotlight-path,.spotlight-tab,.nm-android-preview-card strong';
const nm6Original=new WeakMap();
function nm6TranslatedText(raw,locale){return NeuroMapLocale.translate(raw,locale,NM_DICT);}
function nm6Translate(root=document){
 if(globalThis.GlaukaI18n){
  for(const [id,label] of Object.entries(NeuroMapLocale.rangeLabels)){
   const el=root.id===id?root:root.querySelector?.('#'+id);
   if(el){el.setAttribute('data-nm6-aria-label',label);el.setAttribute('aria-label',globalThis.GlaukaI18n.translate(label));}
  }
  globalThis.GlaukaI18n.translateDOM(root);return;
 }
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
  if(raw===undefined || (current!==raw&&current!==nm6TranslatedText(raw,'en')&&current!==nm6TranslatedText(raw,'it'))){raw=current;nm6Original.set(node,raw);}
  // Undo and Cancel share the Italian word Annulla, but are different actions.
  const out=node.parentElement.closest('[data-nm6-context="undo"]')
    ?raw.replace(raw.trim(),locale==='en'?'Undo':'Annulla'):nm6TranslatedText(raw,locale);
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
   if(raw===null||(current!==raw&&current!==nm6TranslatedText(raw,'en')&&current!==nm6TranslatedText(raw,'it'))){raw=current;el.setAttribute('data-nm6-'+attr,raw);}
   const out=nm6TranslatedText(raw,locale);if(out!==current)el.setAttribute(attr,out);
  }
 }
}
