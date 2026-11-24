/* Shared Windows/macOS drop-down microcopy: preserve the existing command elements/handlers. */
(function(root){'use strict';
const dictionary={
'Salvataggio automatico: Off':'Auto-save: Off','Nuova scheda':'New tab','Apri file...':'Open file...','Apri file recenti':'Open recent files','Salva con nome...':'Save as...',
'Salva tutto il workspace':'Save entire workspace','Salvataggio automatico...':'Auto-save...',
'Importa':'Import','Importa e sovrascrivi...':'Import and replace...',
'Importa testo / Markdown...':'Import text / Markdown...','Dividi mappe oltre:':'Split maps above:',
'Limite nodi per mappa importata':'Node limit per imported map','Esporta scheda':'Export tab',
'Esporta workspace (tutte le schede)':'Export workspace (all tabs)',
'Tutto in JSON':'All as JSON','Tutto in Markdown':'All as Markdown',
'Esporta solo la scheda attiva':'Export active tab only','Esporta tutte le schede aperte':'Export all open tabs',
'Scheda attiva':'Active tab','Svuota mappa':'Clear map','Chiudi scheda':'Close tab',
'Seleziona tutto':'Select all','Rinomina nodo':'Rename node','Inverti sottorami':'Reverse sub-branches',
'Elimina ramo':'Delete branch','Aggiungi sottoramo':'Add child branch',
'Aggiungi ramo orario':'Add branch clockwise','Aggiungi ramo antiorario':'Add branch anticlockwise',
'Cerca illustrazione...':'Find illustration...','Illustra automaticamente...':'Illustrate automatically...',
'Inserisci immagine...':'Insert image...','Centra e adatta':'Center and fit',
'Ripristina zoom 100%':'Reset zoom to 100%','Mostra/nascondi layout':'Toggle layout panel',
'Distribuisci i rami':'Distribute branches','Stato salvataggio automatico':'Auto-save status',
'Esporta PNG 2x':'Export PNG 2x','Esporta SVG':'Export SVG','Esporta PDF A3':'Export PDF A3',
'Esporta Markdown':'Export Markdown','Esporta OPML':'Export OPML','Esporta JSON':'Export JSON',
'Esporta tutto in JSON':'Export all as JSON','Esporta tutto in Markdown':'Export all as Markdown',
'File recenti':'Recent files','Ordine: ultima modifica · max 10':'Sorted by last modified · max 10',
'Nessun file recente':'No recent files',
'Apri o salva una mappa (.gk, .xmind, .glk) per ritrovarla subito qui.':'Open or save a map (.gk, .xmind, .glk) to access it quickly here.',
'Sfoglia file dal computer…':'Browse files from computer…',
'Aperta':'Open','Oggi':'Today','Ieri':'Yesterday',
'File non trovato nel percorso originale.':'File not found at original path.',
'Progetto già aperto · ':'Project already open · '
};
const styles=`
.nm-ux-menu .nm-semantic-menu-icon{width:18px;height:18px;flex:0 0 18px;opacity:.92;color:var(--nm-ui-accent,#a5b4fc)}
.nm-ux-menu .dropdown-item:focus-visible .nm-semantic-menu-icon,.nm-ux-menu .dropdown-item:hover .nm-semantic-menu-icon{opacity:1}
.nm-ux-menu.dropdown-panel{width:350px!important;max-width:calc(100vw - 20px)!important;box-sizing:border-box}
.nm-ux-menu .dropdown-item{min-width:0;white-space:nowrap;gap:.35rem}
.nm-ux-menu .dropdown-item>span:not(.kbd-key):not(.counter-pill){min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto}
.nm-ux-menu .dropdown-item>.kbd-key,.nm-ux-menu .dropdown-item>.counter-pill{flex:none;white-space:nowrap}
#dropdown-file #menu-open-recent{white-space:nowrap!important}
.nm-ux-menu .nm-submenu-chevron{width:14px;height:14px;flex:0 0 14px;margin-left:auto;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.68}
html[dir="rtl"] .nm-ux-menu .nm-submenu-chevron{transform:scaleX(-1)}
.nm-ux-menu .dropdown-section-title{white-space:nowrap;letter-spacing:.055em}
.nm-ux-menu .export-subgrid{grid-template-columns:repeat(3,minmax(0,1fr))}
.nm-ux-menu .nm-ux-workspace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.3rem;padding:.25rem .4rem .35rem}
.nm-ux-menu .export-Format-chip{min-width:0;font-family:var(--font-sans);font-size:.72rem;white-space:nowrap;padding:.48rem .2rem}
.nm-ux-menu .nm613-import-control{min-width:0;white-space:nowrap;padding:.5rem .6rem}
.nm-ux-menu .nm613-import-control>span{white-space:nowrap}
.nm-ux-menu .nm613-import-control select{flex:0 0 105px;max-width:105px}
.nm-ux-menu .nm-ux-warning:hover,.nm-ux-menu .nm-ux-warning:focus-visible{background:rgba(245,158,11,.17)!important;color:#fbbf24!important}
.nm-ux-menu .nm-ux-danger{color:#fda4af}
.nm-ux-menu .nm-ux-danger:hover,.nm-ux-menu .nm-ux-danger:focus-visible{background:rgba(244,63,94,.16)!important;color:#fb7185!important}
.nm-ux-slider-label{display:flex;justify-content:space-between;gap:8px;font-size:.74rem;color:var(--text-secondary);white-space:nowrap}
.nm-ux-slider-label strong{font-family:var(--font-mono);color:#a5b4fc}
.nm-ux-menu [data-export]:focus-visible,.nm-ux-menu .dropdown-item:focus-visible{outline:2px solid #a5b4fc;outline-offset:-1px}
.nm-recent-submenu{position:fixed;z-index:2365;width:336px;max-width:calc(100vw - 24px);max-height:min(580px,calc(100vh - 24px));overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:6px;border-radius:12px;background:var(--nm-skin-surface,var(--nm-ui-surface,#101b31));color:var(--nm-ui-ink,#edf2fa);border:1px solid var(--nm-ui-line,#33445f);box-shadow:var(--nm-ui-shadow,0 16px 38px rgba(15,23,42,.34));font:13px/1.35 var(--font-sans,system-ui,-apple-system,sans-serif)}
.nm-recent-submenu.hidden{display:none!important}
.nm-recent-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px 6px;border-bottom:1px solid var(--nm-ui-line,rgba(148,163,184,.22));margin-bottom:4px;font-size:11px;font-weight:600;color:var(--nm-ui-muted,#94a3b8);letter-spacing:.02em}
.nm-recent-list{display:flex;flex-direction:column;gap:1px}
.nm-recent-item{display:flex;align-items:center;gap:9px;width:100%;padding:5.5px 8px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;transition:background .12s ease}
.nm-recent-item:hover,.nm-recent-item:focus-visible{background:var(--nm-ui-hover,rgba(99,102,241,.13));outline:none}
.nm-recent-item:focus-visible{box-shadow:inset 0 0 0 2px var(--nm-ui-accent,#6366f1)}
.nm-recent-ext{flex:0 0 auto;min-width:38px;padding:3px 5px;border-radius:6px;font:700 9.5px/1.1 var(--font-mono,ui-monospace,monospace);text-align:center;letter-spacing:.03em;text-transform:uppercase;background:rgba(99,102,241,.14);color:var(--nm-ui-accent,#6366f1);border:1px solid rgba(99,102,241,.22)}
.nm-recent-ext[data-ext="xmind"]{background:rgba(16,185,129,.14);color:#10b981;border-color:rgba(16,185,129,.25)}
.nm-recent-ext[data-ext="json"]{background:rgba(245,158,11,.14);color:#d97706;border-color:rgba(245,158,11,.25)}
.nm-recent-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.nm-recent-title-row{display:flex;align-items:center;gap:6px;min-width:0}
.nm-recent-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:12.5px}
.nm-recent-open-badge{flex:none;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;background:rgba(99,102,241,.15);color:var(--nm-ui-accent,#6366f1)}
.nm-recent-sub{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--nm-ui-muted,#94a3b8)}
.nm-recent-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-recent-time{flex:none;font-size:10.5px;opacity:.9;white-space:nowrap}
.nm-recent-empty{padding:12px 10px;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}
.nm-recent-empty strong{font-size:12.5px}
.nm-recent-empty p{margin:0;font-size:11.5px;color:var(--nm-ui-muted,#94a3b8);line-height:1.4}
.nm-recent-browse{margin-top:4px;padding:6px 12px;border-radius:8px;border:1px solid var(--nm-ui-line,#33445f);background:var(--nm-ui-hover,rgba(99,102,241,.1));color:inherit;font:600 12px/1.2 var(--font-sans,system-ui);cursor:pointer}
.nm-recent-browse:hover,.nm-recent-browse:focus-visible{border-color:var(--nm-ui-accent,#6366f1);outline:none}
`;

/* Menu icons: crisp uniform stroke SVGs across all File/Edit/View entries.
 * Distinct icons avoid visual collisions (e.g. Time Machine vs Autosave vs Recovery). */
const nmMenuIcons={
 filePlus:['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z','M14 3v5h5','M12 11v6','M9 14h6'],
 duplicateTab:['M8 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z','M16 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2'],
 folderOpen:['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5','M3 11h18l-1.8 7.5a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-2z'],
 recentFiles:['M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2','M4 10h8.5','M4 10v8a2 2 0 0 0 2 2h4.5','M16.5 12.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9','M16.5 14.8v2.2l1.6 1'],
 save:['M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z','M16 21v-7H8v7','M8 3v5h7V3'],
 saveAs:['M5 3h10l4 4v5','M5 3v16a2 2 0 0 0 2 2h5','M8 3v4h6','M14.5 20.5l5-5 2 2-5 5-2.5.5z'],
 saveAll:['M7 7h10l3 3v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z','M10 7v3.5h6V7','M9 21v-5.5h7V21','M3 14V5a2 2 0 0 1 2-2h9'],
 autosave:['M10 2h4','M12 13l3-3','M12 21a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z'],
 backupOk:['M12 3l7 3v5.5c0 4.6-3 8.7-7 10.5-4-1.8-7-5.9-7-10.5V6z','M9 12.2l2.1 2.1L15.2 10'],
 clock:['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18','M12 7v6l4 2'],
 import:['M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3','M12 3v12','M7 10l5 5 5-5'],
 export:['M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3','M12 16V3','M7 8l5-5 5 5'],
 clipboard:['M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z','M7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2','M9 12h6M9 16h4'],
 history:['M3 12a9 9 0 1 0 3-6.7L3 8','M3 3v5h5','M12 7v5l3 2'],
 clear:['M7 21h10','M5.5 16.5l8-8a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3l-8 8H6.5z'],
 close:['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z','M9.5 9.5l5 5M14.5 9.5l-5 5'],
 cloud:['M6.8 18.5h10.4a4.2 4.2 0 0 0 .5-8.4A5.8 5.8 0 0 0 6.3 11a3.8 3.8 0 0 0 .5 7.5z'],
 sync:['M4 8a8 8 0 0 1 13-3','M17 2v4h-4','M20 16a8 8 0 0 1-13 3','M7 22v-4h4'],
 camera:['M3 8h4l2-3h6l2 3h4v12H3z','M12 11a3 3 0 1 0 0 6a3 3 0 0 0 0-6'],
 share:['M14 4h6v6','M20 4l-9 9','M20 14v6H4V4h6'],
 undo:['M9 7L4 12l5 5','M4 12h10a6 6 0 0 1 0 12'],
 redo:['M15 7l5 5-5 5','M20 12H10a6 6 0 0 0 0 12'],
 scissors:['M8 8l9 9','M8 16l9-9','M6 5a2 2 0 1 0 0 4a2 2 0 0 0 0-4','M6 15a2 2 0 1 0 0 4a2 2 0 0 0 0-4'],
 copy:['M8 8h13v13H8z','M4 17H3V3h14v1'],
 paste:['M8 4h2a2 2 0 0 1 4 0h2v3H8z','M7 5H5v16h14V5h-2','M9 12h6'],
 select:['M5 3h4M3 5v4M19 5v4M15 3h4M3 15v4h4M17 19h3v-4','M9 10l6 3-4 1-1 4z'],
 duplicate:['M8 8h13v13H8z','M4 17H3V3h14v1','M14 13v5M11.5 15.5h5'],
 pencil:['M4 20l5-1 11-11-4-4L5 15z','M13 7l4 4'],
 reverse:['M3 7h17l-4-4M20 7l-4 4','M21 17H4l4-4M4 17l4 4'],
 delete:['M4 6h16M9 6V4h6v2M6 7l1 14h10l1-14','M10 10v7M14 10v7'],
 add:['M12 4v16M4 12h16'],
 image:['M3 4h18v16H3z','M3 16l5-5 4 4 3-3 6 6','M15 8h.01'],
 focus:['M4 9V4h5M15 4h5v5M4 15v5h5M20 15v5h-5','M12 9v6M9 12h6'],
 zoom:['M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14','M15 15l6 6','M7 10h6'],
 layout:['M3 4h18v16H3z','M3 10h18M10 10v10'],
 layers:['M12 3l9 5-9 5-9-5z','M3 12l9 5 9-5','M3 16l9 5 9-5'],
 eye:['M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6','M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6'],
 help:['M9 9a3 3 0 0 1 6 0c0 2-3 3-3 5','M12 18v.1','M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20'],
 node:['M4 11h5v5H4z','M15 4h5v5h-5z','M15 16h5v5h-5z','M9 14h3V6h3M12 14v5h3'],
 gear:['M12 9a3 3 0 1 0 .01 0','M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z']
};
Object.assign(nmMenuIcons,{
 links:['M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2','M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2'],
 database:['M3 6c0-5 18-5 18 0s-18 5-18 0v12c0 5 18 5 18 0V6','M3 12c0 5 18 5 18 0'],
 dashboard:['M3 3h8v7H3zM15 3h6v7h-6zM3 14h6v7H3z','M13 20v-5M17 20V10M21 20v-7'],
 quality:['M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z','m8 12 3 3 5-6'],
 journey:['M4 4h7v6H4zM13 14h7v6h-7z','M14 5h4v6M15 8l3 3 3-3M10 18H6v-5'],
 visual:['M3 3h18v18H3z','m4 17 5-5 4 4 3-3 4 4M8 7h.1M17 6v5M14.5 8.5h5'],
 anki:['M5 2h14v20H5z','M8 7h8l-2-2M16 15H8l2 2M8 10v-3M16 12v3'],
 compare:['M2 4h8v16H2zM14 4h8v16h-8z','M6 8h2M16 8h2M6 12h2M16 12h2M6 16h2M16 16h2'],
 notes:['M5 3h11l3 3v15H5z','M9 8h6M9 12h6M9 16h4'],
 scan:['M3 8V3h5M16 3h5v5M3 16v5h5M21 16v5h-5','M7 8h10M12 8v9M9 17h6'],
 book:['M12 5C8 2 4 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-2-10 1z','M12 5v16'],
 cards:['M3 4h14v15H3zM7 1h14v15','M8 9a2 2 0 0 1 4 0c0 2-2 1-2 3M10 15v.1'],
 calendar:['M3 5h18v16H3zM3 10h18M7 2v6M17 2v6','M7 14h3M14 14h3M7 18h3'],
 devicesPair:['M2 7h9v7H2z','M4.5 17h4','M6.5 14v3','M16 7h6v12h-6z','M18.5 16.5h1','M11.5 4.5h5','M15 3l1.5 1.5L15 6','M13 3 11.5 4.5 13 6','M12.5 12.5h2.5']
});
const nmCommandIcons={
 'menu-project-history':'history','nm-doc-import-open':'import','nm-ocr-launch':'scan',
 'nm-map-share-open':'devicesPair',
 'nm-tool-outline':'node','nm-tool-document':'notes','nm-tool-sources':'book',
 'nm-tool-links':'links','nm-tool-database':'database','nm-tool-dashboard':'dashboard','nm-tool-quality':'quality',
 'nm-tool-journey':'journey','nm-tool-visual-study':'visual','nm-tool-anki':'anki','nm616-compare-open':'compare','nm-tool-atlas':'zoom',
 'nm-tool-memory':'calendar','btn-flashcards':'cards','nm-learn-open':'book','nm-tool-studio-panel':'book',
 'nm-group-write':'notes','nm-group-study':'book','nm-group-organize':'node',
 'menu-new-tab':'filePlus','btn-import-files-new-tabs':'folderOpen','menu-open-recent':'recentFiles','btn-duplicate-tab':'duplicateTab',
 'menu-save-file':'save','menu-save-file-as':'saveAs','menu-save-all-tabs':'saveAll',
 'nm611-autosave-open':'autosave','nm-save-status':'backupOk','gl-cloud-open':'cloud','nm-capture-open':'notes','nm-exchange-open':'compare','btn-import-file-current':'import','btn-import-paste':'clipboard',
 'menu-new-map':'clear','menu-close-tab':'close','menu-export':'export',
 'menu-undo':'undo','menu-redo':'redo','menu-cut':'scissors','menu-copy':'copy',
 'menu-paste':'paste','menu-select-all':'select','menu-duplicate-selection':'duplicate',
 'menu-edit-node':'pencil','menu-invert-branch':'reverse','menu-delete-node':'delete',
 'menu-add-child':'node','menu-add-sibling-cw':'add','menu-add-sibling-ccw':'reverse',
 'menu-iconify-single':'image','menu-iconify-bulk':'image','menu-add-image':'image',
 'menu-center-map':'focus','menu-reset-zoom':'zoom','v6-toggle-layout':'layout',
 'nm616-zen-switch':'eye','nm6-show-help':'help','menu-settings':'gear'
};
function nmKind(id,label){
 if(nmCommandIcons[id])return nmCommandIcons[id];
 const t=String(label||'').toLocaleLowerCase();
 if(/cronolog|history|version/.test(t))return 'history';
 if(/cloud/.test(t))return 'cloud';
 if(/sincron|sync|scambio/.test(t))return 'sync';
 if(/quick capture|cattura|camera/.test(t))return 'camera';
 if(/condivid|share/.test(t))return 'share';
 if(/appunti|notes/.test(t))return 'notes';
 if(/scrivi|write/.test(t))return 'notes';
 if(/import|carica/.test(t))return 'import';
 if(/esport|export/.test(t))return 'export';
 if(/salva|save/.test(t))return 'save';
 if(/layout|disposizion|pannello/.test(t))return 'layout';
 if(/nascond|mostra|visualiz/.test(t))return 'eye';
 if(/zoom|ingrand/.test(t))return 'zoom';
 if(/copia|copy/.test(t))return 'copy';
 if(/aggiung|nuov|new/.test(t))return 'add';
 if(/impostaz|settings/.test(t))return 'gear';
 return 'focus';
}
function nmIcon(id,label){
 const shape=nmMenuIcons[nmKind(id,label)];if(!shape)return null;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [name,value]of Object.entries({'viewBox':'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(name,value);
 svg.classList.add('nm-semantic-menu-icon','nm-workspace-icon');
 for(const d of shape){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path)}
 return svg;
}
function nmIconize(menu){
 for(const button of menu.querySelectorAll('button.dropdown-item')){
  const label=button.querySelector('span');
  if(label?.textContent&&/^\s*☁\s*/.test(label.textContent))label.textContent=label.textContent.replace(/^\s*☁\s*/,'');
  if(button.querySelector(':scope>svg.nm-semantic-menu-icon'))continue;
  const svg=nmIcon(button.id,label?.textContent||button.textContent);if(!svg)continue;
  button.querySelectorAll(':scope>svg:not(.nm-semantic-menu-icon)').forEach(icon=>icon.remove());
  button.prepend(svg);button.dataset.nmSemanticIcon='1';
 }
}

const MAX_RECENT_FILES=10;
function currentLocale(){
 if(typeof root.GlaukaI18n?.locale==='function')return root.GlaukaI18n.locale()||'it';
 return document.documentElement?.lang==='en'?'en':'it';
}
function uiLabel(it,en){
 const pairEn=en||dictionary[it]||it;
 if(typeof root.GlaukaI18n?.pair==='function')return root.GlaukaI18n.pair(it,pairEn);
 return currentLocale()==='en'?pairEn:it;
}
function normalizeRecentPath(value){
 const clean=String(value||'').trim().replace(/\\/g,'/');
 if(!clean)return '';
 return (/^[a-z]:\//i.test(clean)||clean.startsWith('//'))?clean.toLowerCase():clean;
}
function baseName(value){
 const parts=String(value||'').split(/[\\/]/);
 return parts[parts.length-1]||'';
}
function folderName(value){
 const parts=String(value||'').replace(/[\\/]+$/,'').split(/[\\/]/);
 return parts.length>=2?parts[parts.length-2]:'';
}
function stripProjectExtension(filename){
 return String(filename||'').replace(/\.(xmind|neuromap|gk|glk|json|mm|md)$/i,'')||String(filename||'');
}
function fileExtBadge(filename){
 const match=String(filename||'').toLowerCase().match(/\.([a-z0-9]+)$/);
 return (match?match[1]:'gk').slice(0,5).toUpperCase();
}
function collectRecentFiles({app,nativeRecent,max=MAX_RECENT_FILES}={}){
 const limit=Math.max(1,Number(max)||MAX_RECENT_FILES);
 const byPath=new Map();
 const openTabsByPath=new Map();
 for(const tab of (app?.tabs||[])){
  const norm=normalizeRecentPath(tab?.filePath);
  if(!norm)continue;
  openTabsByPath.set(norm,{id:tab.id,title:String(tab?.state?.root?.text||tab?.title||'').trim()});
 }
 const archive=Array.isArray(app?._nmAtlasArchive)
  ?(typeof root.NeuroMapAtlasLibrary?.clean==='function'
    &&app._nmAtlasArchive.some(x=>Array.isArray(x?.nodes)&&x.nodes.length)
    ?root.NeuroMapAtlasLibrary.clean(app._nmAtlasArchive)
    :app._nmAtlasArchive)
  :[];
 const upsert=(raw)=>{
  const pathValue=String(raw?.path||'').trim();
  const norm=normalizeRecentPath(pathValue);
  if(!norm)return;
  const filename=String(raw?.filename||baseName(pathValue)||'Mappa.gk').trim();
  const dir=String(raw?.dir??folderName(pathValue)).trim();
  const updatedAt=Number(raw?.updatedAt);
  const ts=Number.isFinite(updatedAt)&&updatedAt>0?updatedAt:0;
  const prev=byPath.get(norm);
  const openTab=openTabsByPath.get(norm);
  if(!prev){
   byPath.set(norm,{
    path:pathValue,
    norm,
    filename,
    dir,
    title:String(openTab?.title||raw?.title||'').trim()||stripProjectExtension(filename),
    updatedAt:ts,
    size:Number(raw?.size)||0,
    nativeApproved:!!raw?.nativeApproved,
    isOpen:!!openTab,
    tabId:openTab?.id||null
   });
   return;
  }
  if(raw?.nativeApproved)prev.nativeApproved=true;
  if(pathValue&&prev.nativeApproved===!!raw?.nativeApproved)prev.path=pathValue;
  if(filename)prev.filename=filename;
  if(dir)prev.dir=dir;
  if(raw?.size)prev.size=Number(raw.size)||prev.size;
  if(ts>prev.updatedAt)prev.updatedAt=ts;
  if(openTab?.title)prev.title=openTab.title;
  else if(raw?.title&&String(raw.title).trim())prev.title=String(raw.title).trim();
  prev.isOpen=prev.isOpen||!!openTab;
  if(openTab?.id)prev.tabId=openTab.id;
 };
 for(const item of (Array.isArray(nativeRecent)?nativeRecent:[])){
  if(!item||typeof item!=='object')continue;
  upsert({
   path:item.path,
   filename:item.filename,
   dir:item.dir,
   updatedAt:item.modTimeMs??item.updatedAt,
   size:item.size,
   nativeApproved:true
  });
 }
 for(const rec of archive){
  if(!rec||typeof rec!=='object'||!rec.filePath)continue;
  upsert({
   path:rec.filePath,
   filename:baseName(rec.filePath),
   dir:folderName(rec.filePath),
   title:rec.title,
   updatedAt:rec.updatedAt,
   nativeApproved:false
  });
 }
 for(const tab of (app?.tabs||[])){
  if(!tab?.filePath)continue;
  upsert({
   path:tab.filePath,
   filename:tab.fileName||baseName(tab.filePath),
   dir:folderName(tab.filePath),
   title:tab?.state?.root?.text||tab?.title,
   updatedAt:tab._nmLastSavedAt||tab.updatedAt||0,
   nativeApproved:!!root.neuromapDesktop
  });
 }
 return [...byPath.values()]
  .sort((a,b)=>(b.updatedAt-a.updatedAt)||a.filename.localeCompare(b.filename))
  .slice(0,limit);
}
function formatRecentDate(timestampMs,locale){
 const ts=Number(timestampMs);
 if(!Number.isFinite(ts)||ts<=0)return '';
 const d=new Date(ts),now=new Date();
 const dayStart=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
 const diffDays=Math.round((dayStart(now)-dayStart(d))/86400000);
 const lang=String(locale||currentLocale()||'it');
 const tag=lang==='zh-CN'?'zh-CN':lang;
 try{
  const hm=new Intl.DateTimeFormat(tag,{hour:'2-digit',minute:'2-digit'}).format(d);
  if(diffDays===0)return uiLabel('Oggi','Today')+', '+hm;
  if(diffDays===1)return uiLabel('Ieri','Yesterday')+', '+hm;
  const sameYear=d.getFullYear()===now.getFullYear();
  return new Intl.DateTimeFormat(tag,sameYear?{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',year:'numeric'}).format(d);
 }catch(_){
  return d.toLocaleString();
 }
}
async function openRecentEntry(app,entry){
 if(!app||!entry?.path)return false;
 const targetNorm=normalizeRecentPath(entry.path);
 const existing=(app.tabs||[]).find(t=>t?.filePath&&normalizeRecentPath(t.filePath)===targetNorm);
 if(existing){
  app.activateTab?.(existing.id);
  app.showToast?.(uiLabel('Progetto già aperto · ','Project already open · ')+(existing.title||entry.title),'FILE');
  return true;
 }
 const desktop=root.neuromapDesktop;
 if(desktop?.openRecentProject){
  try{
   const payload=await desktop.openRecentProject(entry.path);
   if(payload?.bytes){
    if(typeof app.v6ImportNativeBatch==='function'){
     await app.v6ImportNativeBatch([payload]);
     return true;
    }
    if(typeof app.v6ImportNative==='function'){
     await app.v6ImportNative(payload,true);
     return true;
    }
   }
  }catch(error){
   if(error?.status===403&&desktop.openProject){
    const chosen=await desktop.openProject();
    if(!chosen||chosen.cancelled)return false;
    if(normalizeRecentPath(chosen.path)!==targetNorm){
     app.showToast?.(uiLabel('Il file scelto non corrisponde al progetto recente.','The selected file does not match this recent project.'),'FILE');
     return false;
    }
    await (app.v6ImportNativeBatch?app.v6ImportNativeBatch([chosen]):app.v6ImportNative?.(chosen,true));
    return true;
   }
   if(error?.status===404){
    app.showToast?.(uiLabel('File non trovato nel percorso originale.','File not found at original path.'),'FILE');
    return false;
   }
   app.showToast?.(error?.message||uiLabel('Apertura file non riuscita','Failed to open file'),'ERRORE');
   return false;
  }
 }
 document.getElementById('btn-import-files-new-tabs')?.click();
 return false;
}

function refresh(){
 const badge=document.getElementById('nm-ux-autosave-state');
 if(!badge||typeof NM611==='undefined')return;
 const minutes=NM611.preferences().minutes;
 badge.textContent=minutes>0?minutes+' min':(globalThis.GlaukaI18n?.pair('Disattivato','Off')??'Off');
 badge.setAttribute('aria-label',((globalThis.GlaukaI18n?.pair("Salvataggio automatico: ","Auto-save: ")??(typeof nmLocale==='function'&&nmLocale()==='en'?'Auto-save: ':'Salvataggio automatico: ')))+badge.textContent);
}
function install(){
 const menuNames=['file','edit','insert','view'];
 const menus=Object.fromEntries(menuNames.map(k=>[k,document.getElementById('dropdown-'+k)]));
 if(menuNames.some(k=>!menus[k])||menus.file.classList.contains('nm-ux-menu'))return;
 const e=id=>document.getElementById(id);
 const text=(id,value)=>{const span=e(id)?.querySelector('span');if(!span)throw Error('Missing NeuroMap menu entry '+id);span.textContent=value};
 const title=(name,i,value)=>{const el=menus[name].querySelectorAll('.dropdown-section-title')[i];if(!el)throw Error('Missing section '+name+':'+i);el.textContent=value;return el};
 for(const menu of Object.values(menus)){menu.classList.add('nm-ux-menu');menu.querySelectorAll('.counter-pill').forEach(el=>el.remove())}
 const file=menus.file,p=title('file',0,'Progetto');
 let recentBtn=e('menu-open-recent');
 if(!recentBtn){
  recentBtn=document.createElement('button');
  recentBtn.id='menu-open-recent';
  recentBtn.type='button';
  recentBtn.className='dropdown-item';
  recentBtn.setAttribute('aria-haspopup','menu');
  recentBtn.setAttribute('aria-expanded','false');
  recentBtn.setAttribute('aria-controls','nm-recent-submenu');
  const recentSpan=document.createElement('span');
  recentSpan.textContent='Apri file recenti';
  const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg');
  chevron.setAttribute('viewBox','0 0 24 24');
  chevron.setAttribute('aria-hidden','true');
  chevron.classList.add('nm-submenu-chevron');
  const cp=document.createElementNS(chevron.namespaceURI,'path');
  cp.setAttribute('d','M9 6l6 6-6 6');
  chevron.append(cp);
  recentBtn.append(recentSpan,chevron);
 }
 p.after(e('menu-new-tab'),e('btn-import-files-new-tabs'),recentBtn,e('menu-save-file'),e('menu-save-file-as'),e('menu-save-all-tabs'),e('nm611-autosave-open'));
 if(e('nm-save-status'))e('nm611-autosave-open').after(e('nm-save-status'));
 const labels={
 'menu-new-tab':'Nuova scheda','btn-import-files-new-tabs':'Apri file...','menu-open-recent':'Apri file recenti','menu-save-file':'Salva',
 'menu-save-file-as':'Salva con nome...','menu-save-all-tabs':'Salva tutto il workspace','nm611-autosave-open':'Salvataggio automatico...',
 'btn-import-file-current':'Importa e sovrascrivi...','btn-import-paste':'Importa testo / Markdown...',
 'menu-new-map':'Svuota mappa','menu-close-tab':'Chiudi scheda','menu-redo':'Ripeti',
 'menu-cut':'Taglia','menu-copy':'Copia','menu-paste':'Incolla','menu-select-all':'Seleziona tutto',
 'menu-duplicate-selection':'Duplica selezione','menu-edit-node':'Rinomina nodo','menu-invert-branch':'Inverti sottorami',
 'menu-delete-node':'Elimina ramo','menu-add-child':'Aggiungi sottoramo','menu-add-sibling-cw':'Aggiungi ramo orario',
 'menu-add-sibling-ccw':'Aggiungi ramo antiorario','menu-iconify-single':'Cerca illustrazione...',
 'menu-iconify-bulk':'Illustra automaticamente...','menu-add-image':'Inserisci immagine...',
 'menu-center-map':'Centra e adatta','menu-reset-zoom':'Ripristina zoom 100%','v6-toggle-layout':'Mostra/nascondi layout'};
 for(const [id,label]of Object.entries(labels))text(id,label);
 let submenu=e('nm-recent-submenu');
 if(!submenu){
  submenu=document.createElement('div');
  submenu.id='nm-recent-submenu';
  submenu.className='nm-recent-submenu nm6-skiptranslate hidden';
  submenu.setAttribute('role','menu');
  submenu.setAttribute('aria-labelledby','menu-open-recent');
  document.body.append(submenu);
 }
 let closeTimer=null,lastNativeRecent=[],fetchSeq=0;
 const cancelClose=()=>{if(closeTimer){clearTimeout(closeTimer);closeTimer=null;}};
 const hideSubmenu=()=>{
  cancelClose();
  submenu.classList.add('hidden');
  recentBtn.setAttribute('aria-expanded','false');
 };
 const scheduleClose=()=>{
  cancelClose();
  closeTimer=setTimeout(()=>hideSubmenu(),180);
 };
 const positionSubmenu=()=>{
  if(submenu.classList.contains('hidden'))return;
  const margin=12;
  const vw=root.innerWidth||document.documentElement.clientWidth||1024;
  const vh=root.innerHeight||document.documentElement.clientHeight||768;
  const width=Math.min(336,Math.max(230,vw-margin*2));
  submenu.style.width=width+'px';
  const r=recentBtn.getBoundingClientRect();
  const mr=file.getBoundingClientRect();
  let left=mr.right+6;
  if(left+width>vw-margin){
   if(mr.left-6-width>=margin)left=mr.left-6-width;
   else left=Math.max(margin,vw-width-margin);
  }
  const desiredTop=(left<mr.right&&left+width>mr.left)?r.bottom+4:(r.top-6);
  const maxTop=Math.max(margin,vh-Math.min(submenu.scrollHeight||280,580)-margin);
  const top=Math.max(margin,Math.min(desiredTop,maxTop));
  submenu.style.left=Math.round(left)+'px';
  submenu.style.top=Math.round(top)+'px';
  submenu.style.maxHeight=Math.max(160,Math.min(580,vh-top-margin))+'px';
 };
 const renderRecentList=(items)=>{
  const locale=currentLocale();
  submenu.replaceChildren();
  const header=document.createElement('div');
  header.className='nm-recent-header';
  const hLeft=document.createElement('span');
  hLeft.textContent=uiLabel('File recenti','Recent files')+(items.length?' ('+items.length+')':'');
  const hRight=document.createElement('span');
  hRight.textContent=uiLabel('Ordine: ultima modifica · max 10','Sorted by last modified · max 10');
  header.append(hLeft,hRight);
  submenu.append(header);
  if(!items.length){
   const empty=document.createElement('div');
   empty.className='nm-recent-empty';
   const strong=document.createElement('strong');
   strong.textContent=uiLabel('Nessun file recente','No recent files');
   const desc=document.createElement('p');
   desc.textContent=uiLabel('Apri o salva una mappa (.gk, .xmind, .glk) per ritrovarla subito qui.','Open or save a map (.gk, .xmind, .glk) to access it quickly here.');
   const browse=document.createElement('button');
   browse.type='button';
   browse.className='nm-recent-browse';
   browse.textContent=uiLabel('Sfoglia file dal computer…','Browse files from computer…');
   browse.addEventListener('click',ev=>{
    ev.stopPropagation();
    hideSubmenu();
    e('btn-import-files-new-tabs')?.click();
   });
   empty.append(strong,desc,browse);
   submenu.append(empty);
   positionSubmenu();
   return;
  }
  const list=document.createElement('div');
  list.className='nm-recent-list';
  for(const item of items){
   const row=document.createElement('button');
   row.type='button';
   row.className='nm-recent-item';
   row.setAttribute('role','menuitem');
   row.dataset.recentPath=item.path;
   row.title=item.path+(item.updatedAt?' · '+formatRecentDate(item.updatedAt,locale):'');
   const badge=document.createElement('span');
   const ext=fileExtBadge(item.filename);
   badge.className='nm-recent-ext';
   badge.dataset.ext=ext.toLowerCase();
   badge.textContent=ext;
   const meta=document.createElement('span');
   meta.className='nm-recent-meta';
   const titleRow=document.createElement('span');
   titleRow.className='nm-recent-title-row';
   const titleSpan=document.createElement('span');
   titleSpan.className='nm-recent-title';
   titleSpan.setAttribute('data-glauka-user-content','1');
   titleSpan.textContent=item.title;
   titleRow.append(titleSpan);
   if(item.isOpen){
    const openPill=document.createElement('span');
    openPill.className='nm-recent-open-badge';
    openPill.textContent=uiLabel('Aperta','Open');
    titleRow.append(openPill);
   }
   const sub=document.createElement('span');
   sub.className='nm-recent-sub';
   const pathSpan=document.createElement('span');
   pathSpan.className='nm-recent-path';
   pathSpan.setAttribute('data-glauka-user-content','1');
   pathSpan.textContent=item.dir?(item.dir+' / '+item.filename):item.filename;
   const timeSpan=document.createElement('span');
   timeSpan.className='nm-recent-time';
   timeSpan.textContent=formatRecentDate(item.updatedAt,locale);
   sub.append(pathSpan,timeSpan);
   meta.append(titleRow,sub);
   row.append(badge,meta);
   row.addEventListener('click',ev=>{
    ev.stopPropagation();
    hideSubmenu();
    root.neuroMapApp?.hideMenus?.();
    void openRecentEntry(root.neuroMapApp,item);
   });
   list.append(row);
  }
  submenu.append(list);
  positionSubmenu();
 };
 const openSubmenu=(focusFirst=false)=>{
  cancelClose();
  const app=root.neuroMapApp;
  const cached=collectRecentFiles({app,nativeRecent:lastNativeRecent,max:MAX_RECENT_FILES});
  submenu.classList.remove('hidden');
  recentBtn.setAttribute('aria-expanded','true');
  renderRecentList(cached);
  if(focusFirst)submenu.querySelector('.nm-recent-item, .nm-recent-browse')?.focus();
  if(root.neuromapDesktop?.listRecentProjects){
   const seq=++fetchSeq;
   Promise.resolve(root.neuromapDesktop.listRecentProjects()).then(rows=>{
    if(seq!==fetchSeq||!Array.isArray(rows))return;
    lastNativeRecent=rows;
    if(!submenu.classList.contains('hidden')){
     renderRecentList(collectRecentFiles({app:root.neuroMapApp,nativeRecent:rows,max:MAX_RECENT_FILES}));
    }
   }).catch(()=>{});
  }
 };
 recentBtn.addEventListener('mouseenter',()=>openSubmenu(false));
 recentBtn.addEventListener('focus',()=>openSubmenu(false));
 recentBtn.addEventListener('mouseleave',()=>scheduleClose());
 submenu.addEventListener('mouseenter',()=>cancelClose());
 submenu.addEventListener('mouseleave',()=>scheduleClose());
 submenu.addEventListener('click',ev=>{if(!ev.target.closest('button'))ev.stopPropagation();});
 recentBtn.addEventListener('click',ev=>{
  ev.preventDefault();
  ev.stopPropagation();
  const isOpen=!submenu.classList.contains('hidden');
  if(isOpen&&ev.detail>0)hideSubmenu();
  else openSubmenu(ev.detail===0);
 });
 recentBtn.addEventListener('keydown',ev=>{
  if(ev.key==='ArrowRight'){ev.preventDefault();ev.stopPropagation();openSubmenu(true);}
  else if(ev.key==='ArrowLeft'||ev.key==='Escape'){if(!submenu.classList.contains('hidden')){ev.preventDefault();ev.stopPropagation();hideSubmenu();}}
 });
 submenu.addEventListener('keydown',ev=>{
  const items=[...submenu.querySelectorAll('.nm-recent-item, .nm-recent-browse')];
  if(ev.key==='ArrowLeft'||ev.key==='Escape'){
   ev.preventDefault();ev.stopPropagation();hideSubmenu();recentBtn.focus();return;
  }
  if((ev.key==='ArrowDown'||ev.key==='ArrowUp')&&items.length){
   ev.preventDefault();
   const idx=items.indexOf(document.activeElement);
   const next=ev.key==='ArrowDown'?(idx+1)%items.length:(idx-1+items.length)%items.length;
   items[next]?.focus();
  }
 });
 file.addEventListener('pointerover',ev=>{
  const item=ev.target.closest('.dropdown-item,.nm613-import-control,.export-Format-chip');
  if(item&&item!==recentBtn)hideSubmenu();
 });
 file.addEventListener('focusin',ev=>{
  if(ev.target!==recentBtn&&!recentBtn.contains(ev.target))hideSubmenu();
 });
 if(typeof root.NeuroMapApp==='function'&&typeof root.NeuroMapApp.prototype.hideMenus==='function'){
  const prevHideMenus=root.NeuroMapApp.prototype.hideMenus;
  root.NeuroMapApp.prototype.hideMenus=function(...args){
   hideSubmenu();
   return prevHideMenus.apply(this,args);
  };
 }
 if(typeof root.MutationObserver==='function'){
  new root.MutationObserver(()=>{
   if(file.classList.contains('hidden'))hideSubmenu();
  }).observe(file,{attributes:true,attributeFilter:['class']});
 }
 root.addEventListener('resize',positionSubmenu);
 root.addEventListener('glauka:language-change',()=>{
  if(!submenu.classList.contains('hidden')){
   renderRecentList(collectRecentFiles({app:root.neuroMapApp,nativeRecent:lastNativeRecent,max:MAX_RECENT_FILES}));
  }
 });
 const badge=document.createElement('span');badge.id='nm-ux-autosave-state';badge.className='counter-pill nm6-skiptranslate';badge.textContent='Off';
 badge.setAttribute('aria-label','Stato salvataggio automatico');e('nm611-autosave-open').append(badge);
 const imp=title('file',1,'Importa');
 imp.after(e('btn-import-file-current'),e('btn-import-paste'),file.querySelector('.nm613-import-control'));
 const size=file.querySelector('.nm613-import-control');
 size.replaceChild(Object.assign(document.createElement('span'),{textContent:'Dividi mappe oltre:'}),size.firstChild);
 const select=e('nm613-import-size');select.setAttribute('aria-label','Limite nodi per mappa importata');
 for(const opt of select.options)opt.defaultSelected=opt.value==='125';
 title('file',2,'Esporta scheda');
 const grid=file.querySelector('.export-subgrid');grid.setAttribute('aria-label','Esporta solo la scheda attiva');
 const json=file.querySelector('[data-export="batch-workspace-json"]'),markdown=file.querySelector('[data-export="batch-md"]');
 const sep=document.createElement('div');sep.className='dropdown-divider';
 const heading=document.createElement('div');heading.className='dropdown-section-title';heading.textContent='Esporta workspace (tutte le schede)';
 const wg=document.createElement('div');wg.className='nm-ux-workspace-grid';wg.setAttribute('aria-label','Esporta tutte le schede aperte');
 for(const [control,label,t]of [[json,'Tutto in JSON','Esporta tutto in JSON'],[markdown,'Tutto in Markdown','Esporta tutto in Markdown']]){
  control.replaceChildren(document.createTextNode(label));control.className='export-Format-chip';control.removeAttribute('style');control.title=t;wg.append(control)
 }
 grid.after(sep,heading,wg);title('file',4,'Scheda attiva');
 e('menu-new-map').classList.add('nm-ux-warning');
 for(const id of ['menu-close-tab','menu-delete-node']){e(id).classList.add('nm-ux-danger');e(id).style.removeProperty('color')}
 e('menu-invert-branch').querySelector('kbd')?.remove();
 const slider=e('menu-threshold-slider'),row=slider?.previousElementSibling;
 if(row){row.classList.add('nm-ux-slider-label');row.removeAttribute('style');const span=row.querySelector('span');if(span)span.textContent='Distribuisci i rami'}
 slider?.removeAttribute('style');
 const style=document.createElement('style');style.id='nm-ux-menu-style';style.textContent=styles;document.head.append(style);
 if(typeof NM_DICT==='object')Object.assign(NM_DICT,dictionary);
 const previous=NeuroMapApp.prototype.nm611ConfigureAutosave;
 if(typeof previous==='function')NeuroMapApp.prototype.nm611ConfigureAutosave=function(...args){const r=previous.apply(this,args);refresh();return r};
 for(const menu of [menus.file,menus.edit,menus.view]){
   nmIconize(menu);
   // Later tools may append menu entries; decorate them without re-binding commands.
   const observer=new MutationObserver(()=>nmIconize(menu));
   observer.observe(menu,{childList:true,subtree:true});
 }
 root.addEventListener('glauka:language-change',refresh);
 e('btn-menu-file')?.addEventListener('click',refresh);
 refresh();
}
root.NeuroMapMenuUX=Object.freeze({
 install,
 refresh,
 dictionary,
 icon:nmIcon,
 recent:Object.freeze({
  MAX:MAX_RECENT_FILES,
  normalizePath:normalizeRecentPath,
  collect:collectRecentFiles,
  formatDate:formatRecentDate,
  openEntry:openRecentEntry
 })
});
})(globalThis);
