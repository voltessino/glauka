/* NeuroMap Orbit: pure UI preferences and command discovery for desktop/Web.
 * Command registry targets EXISTING editor controls; no document writes or invented actions.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NeuroMapOrbitCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='nm_orbit_desktop_ui_v1';
  const accents=Object.freeze(['auto','cyan','violet','amber']);
  const densities=Object.freeze(['comfortable','compact']);
  const COMMANDS=Object.freeze([
    ['btn-new-tab','file','Nuova mappa','New map','crea scheda project'],
    ['btn-import-files-new-tabs','file','Apri mappa','Open map','import xmind neuromap'],
    ['menu-save-file','file','Salva','Save','backup ctrl s'],
    ['menu-save-file-as','file','Salva con nome','Save as','export path'],
    ['btn-duplicate-tab','file','Duplica scheda','Duplicate tab','copy map'],
    ['menu-undo','edit','Annulla','Undo','undo ctrl z'],
    ['menu-redo','edit','Ripeti','Redo','redo ctrl y'],
    ['menu-copy','edit','Copia','Copy','clipboard'],
    ['menu-paste','edit','Incolla','Paste','clipboard'],
    ['menu-select-all','edit','Seleziona tutto','Select all','tutti i nodi'],
    ['menu-edit-node','edit','Rinomina nodo','Rename node','testo cambia'],
    ['menu-add-child','insert','Aggiungi figlio','Add child','nodo ramo tab'],
    ['menu-add-sibling-cw','insert','Aggiungi ramo','Add sibling','fratello'],
    ['menu-add-image','insert','Aggiungi immagine','Add image','photo media'],
    ['btn-spotlight','navigate','Ricerca globale','Global search','spotlight trova ctrl f'],
    ['menu-center-map','navigate','Centra mappa','Center map','zoom fit center'],
    ['menu-reset-zoom','navigate','Zoom 100%','Reset zoom','scala'],
    ['btn-toggle-inspector','navigate','Pannello Stile','Style inspector','pannello personalizza'],
    ['btn-shortcuts','navigate','Scorciatoie','Shortcuts','keyboard help'],
    ['nm-view-split','navigate','Vista affiancata','Split view','organigramma timeline'],
    ['btn-flashcards','study','Flashcard','Flashcards','studio ripasso'],
    ['nm62-toolbar-assets','study','Simboli e libreria','Symbols and library','icone assets'],
    ['btn-ai-settings','study','Impostazioni AI','AI settings','model provider'],
    ['nm616-nav-focus','study','Focus sul ramo','Focus branch','concentrazione'],
    ['nm616-zen-switch','study','Modalità Zen','Zen mode','immersivo pulizia'],
    ['nm616-compare-open','study','Confronta concetti','Compare concepts','analisi differenze'],
    ['nm-map-share-open','file','Condividi mappa…','Share map…','share condividi handoff qr f11 pacchetto'],
    ['nm-capture-open','insert','Quick Capture · raccogli appunti…','Quick Capture · collect notes…','capture appunti rapidi note inbox'],
    ['nm-exchange-open','file','Scambio sicuro · confronta copie…','Safe exchange · compare copies…','confronta versioni copie scambio sicuro sha256']
  ].map(([id,group,it,en,keywords])=>Object.freeze({id,group,it,en,keywords})));
  const GROUPS=Object.freeze({
    it:Object.freeze({file:'File',edit:'Modifica',insert:'Inserisci',navigate:'Navigazione',study:'Studio'}),
    en:Object.freeze({file:'File',edit:'Edit',insert:'Insert',navigate:'Navigation',study:'Study'})
  });
  function read(raw){
    let data={};
    try{data=typeof raw==='string'?JSON.parse(raw):raw||{}}catch{data={}}
    if(!data||typeof data!=='object'||Array.isArray(data))data={};
    return {enabled:data.enabled===true,accent:accents.includes(data.accent)?data.accent:'auto',
      density:densities.includes(data.density)?data.density:'comfortable'};
  }
  function fold(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().trim().replace(/\s+/g,' ');
  }
  function search(query,language='it',available=()=>true){
    const lang=language==='en'?'en':'it',tokens=fold(query).split(' ').filter(Boolean);
    return COMMANDS.filter(command=>{
      if(!available(command.id))return false;
      const searchable=fold([
        command.it,command.en,command.keywords,
        GROUPS.it[command.group],GROUPS.en[command.group]
      ].join(' '));
      return tokens.every(token=>searchable.includes(token));
    });
  }
  function hasCommand(id){return COMMANDS.some(action=>action.id===id)}
  return Object.freeze({STORAGE_KEY,accents,densities,COMMANDS,GROUPS,read,fold,search,hasCommand});
});
