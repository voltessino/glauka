/* One settings window. Each control writes the store that already owns that preference. */
(function (root) {
  "use strict";
  const tr = (it, en) => (globalThis.GlaukaI18n?.pair(it, en) ?? (document.documentElement.lang === "en" ? en : it));
  const CSS = `
#gl-settings-shade{position:fixed;inset:0;z-index:1200;background:rgba(8,12,24,.46);display:flex;align-items:center;justify-content:center;padding:16px}
#gl-settings-center{width:min(960px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px));display:flex;flex-direction:column;background:var(--nm-skin-surface,#f7f8fb);color:var(--nm-skin-ink,#16243d);border:1px solid var(--nm-skin-stroke,#d5dbe6);border-radius:16px;box-shadow:0 24px 70px rgba(8,12,24,.28);overflow:hidden}
#gl-settings-center header{display:flex;align-items:center;gap:12px;min-height:58px;box-sizing:border-box;padding:0 16px;border-bottom:1px solid var(--nm-skin-stroke,#d5dbe6);background:var(--nm-skin-top,#fff)}
#gl-settings-title{margin:0;font:700 18px/1.2 system-ui;flex:0 0 auto}
#gl-settings-search{flex:1;min-width:0;min-height:36px;border-radius:10px;border:1px solid var(--nm-skin-stroke,#c5ceda);background:var(--nm-skin-canvas,#fff);color:inherit;padding:0 12px;font:14px system-ui}
#gl-settings-close,#gl-settings-back{min-width:36px;min-height:36px;border-radius:10px;border:1px solid transparent;background:transparent;color:inherit;font:20px/1 system-ui;cursor:pointer}
#gl-settings-close:hover,#gl-settings-back:hover{background:color-mix(in srgb,var(--nm-skin-ink,#16243d) 8%,transparent)}
#gl-settings-close:focus-visible,#gl-settings-back:focus-visible,#gl-settings-search:focus-visible,#gl-settings-nav button:focus-visible,#gl-settings-body :is(button,select,input):focus-visible{outline:2px solid var(--nm-theme-focus,#7c6ad6);outline-offset:2px}
#gl-settings-layout{display:flex;min-height:0;flex:1;min-width:0;overflow:hidden}
#gl-settings-nav{width:220px;flex:0 0 220px;overflow:auto;padding:12px 10px;border-right:1px solid var(--nm-skin-stroke,#d5dbe6);display:flex;flex-direction:column;gap:2px;background:color-mix(in srgb,var(--nm-skin-top,#f6f3ff) 70%,var(--nm-skin-surface,#fff));box-sizing:border-box}
#gl-settings-nav-items{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-height:0}
#gl-settings-nav button{display:flex;align-items:center;gap:9px;min-height:36px;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:600 13px/1.2 system-ui}
#gl-settings-nav button svg{flex:0 0 15px;opacity:.78}
#gl-settings-nav button[aria-current="true"]{background:color-mix(in srgb,var(--nm-theme-action,#6441df) 14%,transparent);box-shadow:inset 2px 0 var(--nm-theme-action,#6441df);color:var(--nm-theme-action,#6441df)}
#gl-settings-nav button[aria-current="true"] svg{opacity:1}
#gl-settings-nav button[hidden],#gl-settings-center .gl-settings-row[hidden]{display:none}
#gl-settings-nav-meta{margin-top:auto;padding:12px 10px 4px;border-top:1px solid var(--nm-skin-stroke,#d5dbe6);display:flex;flex-direction:column;gap:2px;color:var(--nm-skin-muted,#625e70);font:500 11px/1.35 system-ui}
#gl-settings-nav-meta strong{font:650 12px/1.3 system-ui;color:var(--nm-skin-ink,#16243d)}
#gl-settings-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
#gl-settings-main-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:20px 24px 0;flex:0 0 auto}
#gl-settings-main-head h3{margin:0;font:700 20px/1.25 system-ui}
#gl-settings-body{flex:1;min-width:0;overflow:auto;padding:12px 24px 24px;display:flex;flex-direction:column;gap:0;scrollbar-gutter:stable;scrollbar-width:thin}
#gl-settings-body.gl-settings-more{box-shadow:inset 0 -28px 16px -12px color-mix(in srgb,var(--nm-skin-ink,#16243d) 28%,transparent)}
#gl-settings-body.gl-settings-more::after{content:attr(data-more);position:sticky;bottom:0;display:block;margin-top:8px;padding:8px 0 2px;text-align:center;font:600 12px/1.3 system-ui;color:var(--nm-skin-muted,#625e70);background:linear-gradient(transparent,var(--nm-skin-surface,#f7f8fb) 45%)}
#gl-settings-body h3{margin:0 0 8px;font:700 18px/1.3 system-ui}
#gl-settings-body h4{margin:28px 0 8px;font:600 12px/1.3 system-ui;letter-spacing:0;text-transform:none;color:var(--nm-skin-muted,#625e70)}
#gl-settings-body h4:first-child,#gl-settings-center .gl-settings-group h4{margin-top:0}
#gl-settings-center .gl-settings-group{display:flex;flex-direction:column}
#gl-settings-center .gl-settings-group+.gl-settings-group{margin-top:28px}
#gl-settings-center .gl-settings-row{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:16px;min-height:64px;box-sizing:border-box;padding:14px 0;border:0;border-bottom:1px solid color-mix(in srgb,var(--nm-skin-stroke,#d5dbe6) 85%,transparent);border-radius:0;background:transparent}
#gl-settings-center .gl-settings-row:last-child{border-bottom:0}
#gl-settings-center .gl-settings-copy{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
#gl-settings-center .gl-settings-name{font:600 14px/1.3 system-ui}
#gl-settings-center .gl-settings-copy p{margin:0;font:400 13px/1.45 system-ui;color:var(--nm-skin-muted,#625e70);opacity:1}
#gl-settings-center .gl-settings-control{flex:0 0 220px;display:flex;align-items:center;justify-content:flex-end;gap:8px;width:220px;max-width:240px}
@media(max-width:760px){#gl-settings-layout{flex-direction:column;overflow:auto}#gl-settings-nav{width:100%;flex:0 0 auto;flex-direction:column;overflow:visible;border-right:0;border-bottom:1px solid var(--nm-skin-stroke,#d5dbe6)}#gl-settings-nav-items{flex-direction:row;overflow:auto}#gl-settings-nav-meta{border-top:0;padding-top:8px}#gl-settings-center .gl-settings-row{flex-direction:column;align-items:stretch;min-height:0}#gl-settings-center .gl-settings-control{min-width:0;width:100%;max-width:none;flex-basis:auto;justify-content:stretch}#gl-settings-center .gl-settings-control select,#gl-settings-center .gl-settings-control button{width:100%;max-width:100%}#gl-settings-body,#gl-settings-main-head{padding-left:16px;padding-right:16px}#gl-settings-body{padding-top:8px;padding-bottom:16px}}
#gl-settings-center .gl-settings-control select,#gl-settings-center .gl-settings-control button,#gl-settings-center .gl-settings-control input[type="text"]{min-height:36px;padding:0 12px;border-radius:9px;border:1px solid var(--nm-skin-stroke,#c5ceda);background:var(--nm-skin-canvas,#fff);color:inherit;font:600 13px system-ui;box-sizing:border-box}
#gl-settings-center .gl-settings-control select,#gl-settings-center .gl-settings-control button{cursor:pointer}
#gl-settings-center .gl-settings-control input[type="text"]{width:100%;font-weight:500}
#gl-settings-center .gl-settings-chip{display:inline-flex;align-items:center;margin-left:6px;padding:2px 7px;border-radius:999px;font:600 11px/1.3 system-ui;background:color-mix(in srgb,var(--nm-theme-action,#6441df) 12%,transparent);color:var(--nm-theme-action,#6441df);vertical-align:middle}
#gl-settings-center .gl-settings-quiet{min-height:32px;padding:0 8px;border:0;background:transparent;color:var(--nm-skin-muted,#625e70);font:600 12px system-ui}
#gl-settings-center .gl-settings-slider{display:flex;align-items:center;justify-content:flex-end;gap:8px;width:100%}
#gl-settings-center .gl-settings-control input[type="range"]{width:168px;min-width:160px;height:36px;accent-color:var(--nm-theme-action,#6441df)}
#gl-settings-center .gl-settings-value{min-width:58px;font:650 13px/1 ui-monospace,monospace;text-align:right;white-space:nowrap}
#gl-settings-center .gl-settings-switch{position:relative;display:inline-flex;width:44px;height:26px;flex:0 0 auto}
#gl-settings-center .gl-settings-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
#gl-settings-center .gl-settings-switch span{width:44px;height:26px;border-radius:99px;background:#c5ceda;display:block;transition:background .15s}
#gl-settings-center .gl-settings-switch span::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s}
#gl-settings-center .gl-settings-switch input:checked+span{background:var(--nm-theme-action,#6441df)}
#gl-settings-center .gl-settings-switch input:checked+span::after{transform:translateX(18px)}
#gl-settings-center .gl-settings-themes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#gl-settings-center .gl-settings-theme{display:flex;flex-direction:column;gap:6px;min-height:0;padding:8px;border-radius:12px;border:1px solid var(--nm-skin-stroke,#d5dbe6);background:var(--nm-skin-canvas,#fff)!important;color:var(--nm-skin-ink,#16243d)!important;text-align:left;cursor:pointer}
#gl-settings-center .gl-settings-theme[aria-pressed="true"]{border-color:var(--nm-theme-action,#6441df)!important;box-shadow:inset 0 0 0 2px var(--nm-theme-action,#6441df)!important}
#gl-settings-center .gl-settings-preview{display:grid;grid-template-columns:18px 1fr;grid-template-rows:14px 1fr;height:78px;border-radius:8px;overflow:hidden;border:1px solid color-mix(in srgb,#000 12%,transparent);background:var(--preview-canvas,#fff)!important}
#gl-settings-center .gl-settings-preview-bar{grid-column:1/-1;display:flex;align-items:center;gap:3px;padding:0 6px}
#gl-settings-center .gl-settings-preview-bar i{width:5px;height:5px;border-radius:50%}
#gl-settings-center .gl-settings-preview-stage{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:7px 8px}
#gl-settings-center .gl-settings-preview-stage i{display:block;border-radius:4px}
#gl-settings-center .gl-settings-preview-stage i:first-child{height:16px}
#gl-settings-center .gl-settings-preview-stage i:last-child{width:36px;height:8px;border-radius:99px}
#gl-settings-center .gl-settings-theme strong{font:650 13px/1.2 system-ui}
#gl-settings-center .gl-settings-more{margin-top:4px}
#gl-settings-center .gl-settings-more>summary{min-height:32px;display:flex;align-items:center;cursor:pointer;font:600 13px/1.3 system-ui;list-style:none}
#gl-settings-center .gl-settings-more>summary::-webkit-details-marker{display:none}
#gl-settings-center .gl-settings-note{margin:2px 2px 0;font:12px/1.4 system-ui;color:var(--nm-skin-muted,#625e70)}
#gl-settings-center .gl-settings-info{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;margin:0;font:13px/1.4 system-ui}
#gl-settings-center .gl-settings-info dt{color:var(--nm-skin-muted,#625e70)}
#gl-settings-center .gl-settings-info dd{margin:0}
#gl-format-map-canvas,#gl-settings-center #gl-format-map-canvas{margin:28px 0 0;padding:0;display:flex;flex-direction:column;gap:16px;border:0!important;border-top:0!important;background:transparent}
#gl-settings-center #gl-format-map-canvas .gl-format-map-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
#gl-settings-center #gl-format-map-canvas .gl-format-map-head-text{display:flex;flex-direction:column;gap:4px}
#gl-settings-center #gl-format-map-canvas .gl-format-map-head .inspector-section-label{margin:0;font-size:18px!important;font-weight:700!important;line-height:1.25;letter-spacing:0;text-transform:none!important;color:var(--nm-skin-ink,#16243d)}
#gl-format-map-canvas .gl-format-map-note{margin:0;font:400 13px/1.45 system-ui;color:var(--nm-skin-muted,#625e70)}
#gl-settings-center #gl-format-map-canvas .nm-theme-picker{margin:0;padding:0;border:0!important;border-radius:0;background:transparent!important;color:inherit!important;box-shadow:none!important}
#gl-settings-center #gl-format-map-canvas .nm-theme-heading{display:none}
#gl-settings-center #gl-format-map-canvas .nm-theme-disclosure>summary{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);border:0}
#gl-settings-center #gl-format-map-canvas .nm-theme-disclosure>.nm-theme-options,#gl-settings-center #gl-format-map-canvas .nm-theme-disclosure:not([open])>.nm-theme-options{display:grid!important;max-height:none;overflow:visible;padding:0;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px}
#gl-settings-center #gl-format-map-canvas .nm-theme-group{font:600 12px/1.3 system-ui;color:var(--nm-skin-muted,#625e70)!important;margin:16px 0 8px}
#gl-settings-center #gl-format-map-canvas .nm-theme-group:first-child{margin-top:0}
#gl-settings-center .gl-swatch-more{min-height:32px;padding:0 12px;border-radius:8px;border:1px solid color-mix(in srgb,var(--gl-set-accent,#5b3df5) 28%,var(--nm-skin-stroke,#c5ceda));background:color-mix(in srgb,var(--gl-set-accent,#5b3df5) 8%,transparent);color:var(--gl-set-accent,#5b3df5);font:600 12.5px/1 system-ui;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease}
#gl-settings-center .gl-swatch-more:hover{background:color-mix(in srgb,var(--gl-set-accent,#5b3df5) 14%,transparent)}
#gl-settings-center #gl-format-map-canvas .nm-theme-picker .nm-theme-option{min-height:72px;background:transparent!important;color:var(--nm-skin-ink,#16243d)!important;border:2px solid transparent!important}
#gl-settings-center #gl-format-map-canvas .nm-theme-option[hidden]{display:none!important}
#gl-settings-center #gl-format-map-canvas .nm-theme-picker .nm-theme-option[aria-checked="true"]{background:transparent!important;color:var(--nm-skin-ink,#16243d)!important;border-color:#fff!important;box-shadow:0 0 0 3px var(--nm-theme-action,#6441df)!important}
#gl-settings-center #gl-format-map-canvas .nm-theme-option[aria-checked="true"] .nm-theme-check{background:#fff;color:#2a1b6e;box-shadow:0 0 0 2px var(--nm-theme-action,#6441df)}
#gl-settings-center #gl-format-map-canvas .nm-theme-preview{height:40px;border-radius:10px}
#gl-settings-center #gl-format-map-canvas .nm-theme-preview>svg{display:none}
#gl-settings-center #gl-format-map-canvas .nm-theme-name{color:inherit!important;font:600 11px/1.25 system-ui}
#gl-settings-center #nm-map-refinements{margin:8px 0 0;padding:0;border:0;border-radius:0;background:transparent;color:inherit}
#gl-settings-center #nm-map-refinements h3{margin:28px 0 0;font:650 16px/1.3 system-ui;letter-spacing:0;text-transform:none;color:var(--nm-skin-ink,#16243d)}
#gl-settings-center #nm-map-refinements label{min-height:68px;margin:0;padding:12px 0;font:600 14px/1.3 system-ui;color:inherit}
#gl-settings-center #nm-map-refinements output{min-width:48px;text-align:right;font:650 13px/1 ui-monospace,monospace}
#gl-settings-center #nm-map-refinements select{width:min(240px,100%);max-width:100%;min-height:36px;background:var(--nm-skin-canvas,#fff);color:inherit;border-color:var(--nm-skin-stroke,#c5ceda)}
#gl-settings-center #nm-map-refinements input[type="range"]{width:168px;min-width:160px}
#gl-settings-center #nm-map-refinements p{margin:0;font:400 13px/1.45 system-ui;color:var(--nm-skin-muted,#625e70)}
#gl-settings-center #gl-settings-branches{margin:28px 0 0;display:flex;flex-direction:column;gap:12px}
#gl-settings-center #gl-settings-branches h4{margin:0;font:700 18px/1.25 system-ui;color:var(--nm-skin-ink,#16243d)}
#gl-settings-center #gl-settings-branches .gl-branches-subtitle{margin:0 0 4px;font:400 13px/1.45 system-ui;color:var(--nm-skin-muted,#625e70)}
#gl-settings-center #gl-branches-control{display:flex;flex-direction:column;gap:10px}
#gl-settings-center #gl-branches-control #nm54-branch-picker{margin:0}
#gl-settings-center #gl-branches-control #nm54-branch-picker>summary{background:var(--nm-skin-surface,#fff)!important;color:var(--nm-skin-ink,#16243d)!important;border:1px solid var(--nm-skin-stroke,#c5ceda)!important;min-height:42px}
#gl-settings-center #gl-branches-control #nm54-style-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(146px,1fr))!important;gap:9px!important;max-height:none!important;overflow:visible!important;padding:10px!important;background:var(--nm-skin-top,#f4f5f9)!important;border:1px solid var(--nm-skin-stroke,#c5ceda)!important;box-shadow:none!important;border-radius:12px}
#gl-settings-center #gl-branches-control #nm54-style-grid .nm54-style{min-height:84px!important;padding:8px 6px!important;border-radius:11px!important;background:var(--nm-skin-surface,#fff)!important;color:var(--nm-skin-ink,#16243d)!important;border:1px solid var(--nm-skin-stroke,#c5ceda)!important;gap:6px}
#gl-settings-center #gl-branches-control #nm54-style-grid .nm54-style .nm54-style-caption{color:var(--nm-skin-ink,#16243d)!important}
#gl-settings-center #gl-branches-control #nm54-style-grid .nm54-style:hover{border-color:var(--nm-theme-action,#6441df)!important;background:color-mix(in srgb,var(--nm-theme-action,#6441df) 9%,var(--nm-skin-surface,#fff))!important}
#gl-settings-center #gl-branches-control #nm54-style-grid .nm54-style[aria-pressed="true"]{border-color:var(--nm-theme-action,#6441df)!important;background:color-mix(in srgb,var(--nm-theme-action,#6441df) 16%,var(--nm-skin-surface,#fff))!important;box-shadow:inset 0 0 0 1.5px var(--nm-theme-action,#6441df)!important;color:var(--nm-skin-ink,#16243d)!important}
#gl-settings-center #gl-branches-control #nm54-style-grid .nm54-style[aria-pressed="true"] .nm54-style-caption{color:var(--nm-skin-ink,#16243d)!important;font-weight:700!important}
#gl-settings-center #gl-branches-control #nm54-style-grid .nm54-preview{width:128px!important;max-width:100%!important;height:46px!important}
#gl-settings-center #gl-branches-control .nm54-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;margin-top:4px;font:600 13.5px/1.3 system-ui;color:var(--nm-skin-ink,#16243d)}
#gl-settings-center #gl-branches-control .nm54-row output{font:650 13px/1 ui-monospace,monospace;color:var(--nm-skin-ink,#16243d)}
#gl-settings-center #gl-branches-control input[type="range"]{width:100%;accent-color:var(--nm-theme-action,#6441df)}
#gl-settings-center #gl-branches-control .gl-root-gap-toggle-row input[type="checkbox"]{width:20px;height:20px;accent-color:var(--nm-theme-action,#6441df);cursor:pointer}
#gl-settings-center #gl-branches-control .nm54-hint{margin:2px 0;font:400 12.5px/1.45 system-ui;color:var(--nm-skin-muted,#625e70)}
#gl-settings-back{display:none}
#gl-settings-quick{min-width:32px;min-height:32px}
body.glauka-mobile-app #gl-settings-quick,
body.glauka-mobile-app #gl-settings-nav button,
body.glauka-mobile-app #gl-settings-body button{min-width:44px;min-height:44px}
body.glauka-mobile-app #gl-settings-shade{padding:0}
body.glauka-mobile-app #gl-settings-center{width:100%;height:100%;max-width:none;border-radius:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);--nm-skin-surface:var(--glauka-app-paper,#fff);--nm-skin-top:var(--glauka-app-soft,#f7f5fc);--nm-skin-canvas:var(--glauka-app-paper,#fff);--nm-skin-ink:var(--glauka-app-ink,#20233f);--nm-skin-muted:var(--glauka-app-muted,#625871);--nm-skin-stroke:var(--glauka-app-line,#dcd6e8);--nm-theme-action:var(--glauka-app-accent,#6441df)}
body.glauka-mobile-app #gl-settings-layout{flex-direction:column}
body.glauka-mobile-app #gl-settings-nav{width:100%;flex-basis:auto;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--nm-skin-stroke,#d5dbe6)}
body.glauka-mobile-app #gl-settings-nav-items{flex-direction:row;gap:4px}
body.glauka-mobile-app #gl-settings-nav button{flex:0 0 auto;white-space:nowrap;border:1px solid transparent}
body.glauka-mobile-app #gl-settings-nav button[aria-current="true"]{box-shadow:none;border-color:var(--nm-theme-action,#6441df)}
body.glauka-mobile-app #gl-settings-nav-meta{display:none}
body.glauka-mobile-app #gl-settings-back{display:inline-flex;align-items:center;justify-content:center}
`;
  const categories = [
    ["general", "Generali", "General", "lingua language salvataggio autosave dispositivo device home benvenuto comandi"],
    ["appearance", "Aspetto", "Appearance", "tema theme contrasto contrast dimensione size accento accent spaziatura spacing pannelli animazioni sfondo background trama texture tipografia font rami collegamenti spessore distacco nodo centrale branch branches stroke gap"],
    ["navigation", "Navigazione e zoom", "Navigation and zoom", "zoom velocità speed minimappa minimap cursore ingrandimento modifica autofocus viste zen focus schermo"],
    ["editor", "Editor e mappe", "Editor and maps", "compattezza spaziatura spacing animazioni rami comparsa durata prestazioni disegno importazione suddivisione nodi wrap a capo libreria creativa qualità"],
    ["study", "Studio e strumenti", "Study and tools", "studio flashcard ripasso quiz ocr pdf scansioni appunti immagini hotspot dashboard riepilogo"],
    ["ai", "AI e API", "AI and API", "provider modello voce chiave key studio assistente illustra audit coerenza"],
    ["cloud", "Cloud e dispositivi", "Cloud and devices", "drive dropbox onedrive condividi trasferisci qr dispositivi device confronta copie"],
    ["files", "Importazione ed esportazione", "Import and export", "import export nodi suddivisione json gk html xmind opml markdown"],
    ["privacy", "Privacy e dati", "Privacy and data", "privacy backup recupero telemetria chiavi esportazione salvataggio cronologia versioni recenti"],
    ["about", "Informazioni", "About", "versione version edizione motore piano sito licenza free pro guida"]
  ];
  const NAV_ICONS = {
    general: [["circle", { cx: "12", cy: "12", r: "3" }], ["path", { d: "M12 2v2m0 16v2m10-10h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m0-14.2 1.4 1.4m11.4 11.4 1.4 1.4" }]],
    appearance: [["circle", { cx: "13.5", cy: "6.5", r: ".5" }], ["circle", { cx: "17.5", cy: "10.5", r: ".5" }], ["circle", { cx: "8.5", cy: "7.5", r: ".5" }], ["circle", { cx: "6.5", cy: "12.5", r: ".5" }], ["path", { d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C22 6.01 17.5 2 12 2Z" }]],
    navigation: [["circle", { cx: "11", cy: "11", r: "7" }], ["path", { d: "m21 21-4.3-4.3" }]],
    editor: [["rect", { x: "3", y: "4", width: "7", height: "6", rx: "1.5" }], ["rect", { x: "14", y: "3", width: "7", height: "6", rx: "1.5" }], ["rect", { x: "14", y: "15", width: "7", height: "6", rx: "1.5" }], ["path", { d: "M10 7h4M10 7c2 0 2 11 4 11" }]],
    study: [["path", { d: "M2 6a2 2 0 0 1 2-2h5l3 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" }], ["path", { d: "m9.5 14 2 2 3.5-4" }]],
    ai: [["path", { d: "m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" }]],
    cloud: [["path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }]],
    files: [["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }], ["path", { d: "M14 2v6h6" }]],
    privacy: [["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }]],
    about: [["circle", { cx: "12", cy: "12", r: "9" }], ["path", { d: "M12 16v-4" }], ["path", { d: "M12 8h.01" }]]
  };
  function navIcon(id) {
    if (typeof document.createElementNS !== "function") return null;
    const shapes = NAV_ICONS[id];
    if (!shapes) return null;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of shapes) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.append(node);
    }
    return svg;
  }
  let shade = null;
  let lastFocus = null;
  let current = "general";

  function prefs() { return root.NeuroMapAppSettings; }
  function readSpacing() {
    try {
      const data = JSON.parse(localStorage.getItem("neuromap.editor.spacing.defaults.v1") || "null");
      if (data && Number.isFinite(data.compactness) && Number.isFinite(data.branchGapX)) return data;
    } catch { /* use the built-in starting values */ }
    return { compactness: 55, branchGapX: 30 };
  }
  function writeSpacing(compactness, branchGapX) {
    const next = root.NeuroMapMediaCore?.spacing?.({ compactness, branchGapX }) || { compactness, branchGapX };
    try {
      localStorage.setItem("neuromap.editor.spacing.defaults.v1", JSON.stringify(next));
      localStorage.setItem("neuromap.default.branchGapX.v6.11", String(next.branchGapX));
    } catch { /* the sliders still show the chosen values */ }
    root.neuromapDesktop?.writeEditorPreferences?.(JSON.stringify(next));
    return next;
  }
  function click(id) {
    const node = document.getElementById(id);
    if (node) node.click();
    close();
  }
  function SettingsRow(title, hint, control) {
    const box = document.createElement("section");
    box.className = "gl-settings-row";
    box.dataset.search = (title + " " + hint).toLocaleLowerCase();
    const copy = document.createElement("div");
    copy.className = "gl-settings-copy";
    const name = document.createElement("span");
    name.className = "gl-settings-name";
    name.textContent = title;
    const note = document.createElement("p");
    note.textContent = hint;
    copy.append(name, note);
    const slot = document.createElement("div");
    slot.className = "gl-settings-control";
    if (control) slot.append(control);
    box.append(copy, slot);
    return box;
  }
  function heading(text) {
    const title = document.createElement("h4");
    title.textContent = text;
    return title;
  }
  function SettingsSwitch(checked, onChange, id) {
    const wrap = document.createElement("label");
    wrap.className = "gl-settings-switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    if (id) input.id = id;
    input.checked = !!checked;
    input.addEventListener("change", () => onChange(input.checked));
    const face = document.createElement("span");
    wrap.append(input, face);
    return wrap;
  }
  function paint(node, color) {
    if (node.style.setProperty) node.style.setProperty("background-color", color, "important");
    else node.style.backgroundColor = color;
  }
  function SettingsSection(title, ...nodes) {
    const box = document.createElement("section");
    box.className = "gl-settings-group";
    box.append(heading(title), ...nodes);
    return box;
  }
  function SettingsControl(control) { return control; }
  function SettingsSlider(input, value, reset) {
    const slot = document.createElement("span");
    slot.className = "gl-settings-slider";
    if (input) slot.append(input);
    if (value) slot.append(value);
    if (reset) {
      reset.classList.add("gl-settings-quiet");
      slot.append(reset);
    }
    return slot;
  }
  function choice(id, pairs, value, label, onChange) {
    const select = document.createElement("select");
    select.id = id;
    for (const [itemValue, it, en] of pairs) {
      const option = document.createElement("option");
      option.value = itemValue;
      option.textContent = tr(it, en);
      select.append(option);
    }
    select.value = value;
    select.setAttribute("aria-label", label);
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }
  function actionButton(text, onClick, id) {
    const b = document.createElement("button");
    b.type = "button";
    if (id) b.id = id;
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }
  function lsGet(key) {
    try { return globalThis.localStorage?.getItem?.(key) ?? null; } catch { return null; }
  }
  function lsSet(key, val) {
    try { globalThis.localStorage?.setItem?.(key, String(val)); return true; } catch { return false; }
  }
  function lsRemove(key) {
    try { globalThis.localStorage?.removeItem?.(key); return true; } catch { return false; }
  }
  function readAndroidTheme() {
    if (root.GlaukaAndroidStylePanel?.prefs) return root.GlaukaAndroidStylePanel.prefs();
    try {
      const parsed = JSON.parse(lsGet("gl_android_theme_finishes_v1") || "null");
      return {
        theme: ["light", "dark"].includes(parsed?.theme) ? parsed.theme : "light",
        accent: ["violet", "cyan", "amber"].includes(parsed?.accent) ? parsed.accent : "violet",
        density: ["comfortable", "compact"].includes(parsed?.density) ? parsed.density : "comfortable"
      };
    } catch { return { theme: "light", accent: "violet", density: "comfortable" }; }
  }
  function writeAndroidTheme(partial) {
    const next = { ...readAndroidTheme(), ...partial };
    lsSet("gl_android_theme_finishes_v1", JSON.stringify(next));
    if (document.body?.dataset) {
      document.body.dataset.glAndroidTheme = next.theme;
      document.body.dataset.glAndroidAccent = next.accent;
      document.body.dataset.glAndroidDensity = next.density;
    }
    return next;
  }
  function openToolsSection(section) {
    close();
    if (root.NeuroMapAndroid74?.open) {
      root.NeuroMapAndroid74.open();
      if (section) root.NeuroMapAndroid74.show?.(section);
      return;
    }
    if (section === "cards") click("btn-flashcards");
  }
  function openSharePanel(stage) {
    close();
    const share = root.neuroMapApp?._nmMapShare;
    if (stage && share?.openStage) share.openStage(stage);
    else share?.open?.();
  }
  async function chooseLanguage(select) {
    const locale = root.GlaukaI18n;
    if (!locale?.setLanguage) return;
    const previous = locale.locale?.() || select.value;
    select.disabled = true;
    try { await locale.setLanguage(select.value); }
    catch {
      select.value = previous;
      root.neuroMapApp?.showToast?.(tr(
        "Impossibile caricare la lingua. La lingua precedente è stata mantenuta.",
        "Could not load the language. Your previous language was kept."
      ));
    } finally {
      select.disabled = false;
      if (locale.locale) select.value = locale.locale();
    }
  }
  function pages() {
    const zoom = prefs().zoom();
    const skin = root.NeuroMapUISkin?.get?.() || { theme: "prisma", contrast: "normal", readability: "standard" };
    const nav = root.NeuroMapNavigationPrefs?.get?.() || { semantic: false, minimap: true };
    const general = document.createElement("div");
    const language = document.createElement("select");
    language.id = "gl-settings-language";
    language.className = "nm6-skiptranslate";
    const languages = root.GlaukaI18n?.languages || [{ code: document.documentElement.lang || "it", name: "Italiano" }];
    for (const languageInfo of languages) {
      const option = document.createElement("option");
      option.value = languageInfo.code;
      option.className = "nm6-skiptranslate";
      option.textContent = languageInfo.name;
      language.append(option);
    }
    language.value = root.GlaukaI18n?.locale?.() || language.value;
    language.setAttribute("aria-label", tr("Lingua dell'interfaccia", "Interface language"));
    language.addEventListener("change", () => chooseLanguage(language));
    const autosave = document.createElement("select");
    autosave.id = "gl-settings-autosave-minutes";
    const autosaveChoices = [
      ["0", "Solo copia di recupero continua (predefinito)", "Continuous recovery backup only (default)"],
      ["1", "Ogni minuto (su file già salvato)", "Every minute (on saved file)"],
      ["3", "Ogni 3 minuti", "Every 3 minutes"],
      ["5", "Ogni 5 minuti", "Every 5 minutes"],
      ["10", "Ogni 10 minuti", "Every 10 minutes"],
      ["15", "Ogni 15 minuti", "Every 15 minutes"],
      ["30", "Ogni 30 minuti", "Every 30 minutes"]
    ];
    for (const [itemValue, it, en] of autosaveChoices) {
      const option = document.createElement("option");
      option.value = itemValue;
      option.textContent = tr(it, en);
      autosave.append(option);
    }
    const autosaveMinutes = Number(root.NM611?.preferences?.().minutes || 0);
    autosave.value = String(autosaveChoices.some((item) => item[0] === String(autosaveMinutes)) ? autosaveMinutes : 0);
    autosave.setAttribute("aria-label", tr("Salvataggio automatico", "Automatic save"));
    autosave.addEventListener("change", () => {
      const minutes = Number(autosave.value);
      const period = document.getElementById("nm611-autosave-period");
      if (period) period.value = String(minutes);
      const badge = document.getElementById("nm-ux-autosave-state");
      const paintBadge = () => {
        if (!badge) return;
        badge.textContent = minutes > 0 ? minutes + " min" : tr("Disattivato", "Off");
        badge.setAttribute("aria-label", tr("Salvataggio automatico: ", "Auto-save: ") + badge.textContent);
      };
      paintBadge();
      try { root.neuroMapApp?.nm611ConfigureAutosave?.(minutes); }
      catch { /* a missing status line must not block the choice already shown */ }
      paintBadge();
    });
    const deviceNameInput = document.createElement("input");
    deviceNameInput.type = "text";
    deviceNameInput.id = "gl-settings-device-name";
    deviceNameInput.maxLength = 40;
    deviceNameInput.placeholder = tr("Es. PC Studio, MacBook, Telefono", "e.g. Studio PC, MacBook, Phone");
    deviceNameInput.value = lsGet("glauka.f11.deviceName") || "";
    deviceNameInput.setAttribute("aria-label", tr("Nome di questo dispositivo", "This device name"));
    deviceNameInput.addEventListener("input", () => lsSet("glauka.f11.deviceName", deviceNameInput.value.trim().slice(0, 40)));
    const isAndroidApp = Boolean(root.GlaukaMobile || document.body?.classList?.contains?.("glauka-mobile-app"));
    const openHomeBtn = actionButton(
      isAndroidApp ? tr("Mostra guida iniziale", "Show welcome guide") : tr("Apri Home", "Open Home"),
      () => {
        if (document.getElementById("nm-home-open")) click("nm-home-open");
        else {
          lsRemove("nm6_welcome_seen");
          close();
          document.querySelector(".nm6-shade")?.classList?.remove?.("hidden");
        }
      },
      "gl-settings-open-home"
    );
    const openCommandsBtn = actionButton(
      isAndroidApp ? tr("Tutti i comandi", "All commands") : tr("Comandi e scorciatoie", "Commands & shortcuts"),
      () => {
        if (document.getElementById("nm-android-command-open")) click("nm-android-command-open");
        else if (document.getElementById("nm-orbit-command-trigger")) click("nm-orbit-command-trigger");
        else click("btn-shortcuts");
      },
      "gl-settings-open-commands"
    );
    general.append(
      heading(tr("Interfaccia", "Interface")),
      SettingsRow(tr("Lingua dell'interfaccia", "Interface language"), tr("Vale per i comandi, non per il testo delle mappe.", "Applies to the controls, not to the text of your maps."), language),
      SettingsRow(tr("Nome di questo dispositivo", "Device name"), tr("Identifica questo dispositivo durante l'invio e la condivisione delle mappe.", "Identifies this device when sending and sharing maps."), deviceNameInput),
      SettingsRow(tr("Schermata iniziale e guida", "Home screen & guide"), tr("Torna ai progetti recenti o rivedi i passaggi principali.", "Return to recent projects or review the quick introduction."), openHomeBtn),
      SettingsRow(tr("Ricerca rapida comandi", "Quick command finder"), tr("Cerca qualsiasi funzione o azione dell'app in un elenco unico.", "Find any app feature or action from one searchable list."), openCommandsBtn),
      heading(tr("Salvataggio", "Saving")),
      SettingsRow(
        tr("Salvataggio automatico", "Automatic save"),
        isAndroidApp
          ? tr("Su Android il recupero continuo resta attivo e i file Drive si salvano direttamente dal menu Progetti.", "On Android continuous recovery stays active and Drive files save directly from Projects.")
          : tr("Solo per un file che ha già un percorso.", "Only for a file that already has a path."),
        autosave
      )
    );
    const androidFinish = (!root.NeuroMapUISkin && root.GlaukaAndroidStylePanel) ? readAndroidTheme() : null;
    const activeThemeId = androidFinish ? (androidFinish.theme === "dark" ? "slate" : "prisma") : skin.theme;
    const appearance = document.createElement("div");
    const themes = document.createElement("div");
    themes.className = "gl-settings-themes";
    themes.setAttribute("role", "group");
    themes.setAttribute("aria-label", tr("Tema dell'interfaccia", "Interface theme"));
    const samples = [
      ["prisma", "White — Prisma Vivo", { canvas: "#f6f3ff", bar: "#ffffff", side: "#ece7ff", card: "#ffffff", accent: "#6441df", dots: ["#ff5f57", "#febc2e", "#28c840"] }],
      ["slate", "Dark — Deep Slate", { canvas: "#0f1422", bar: "#151b27", side: "#1a2233", card: "#243044", accent: "#8b7fd6", dots: ["#ff5f57", "#febc2e", "#28c840"] }]
    ];
    for (const [id, label, colors] of samples) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "gl-settings-theme-" + id;
      button.className = "gl-settings-theme";
      button.setAttribute("aria-pressed", String(activeThemeId === id));
      button.setAttribute("aria-label", label);
      const frame = document.createElement("span");
      frame.className = "gl-settings-preview";
      frame.setAttribute("aria-hidden", "true");
      paint(frame, colors.canvas);
      const bar = document.createElement("span");
      bar.className = "gl-settings-preview-bar";
      paint(bar, colors.bar);
      for (const dotColor of colors.dots) {
        const dot = document.createElement("i");
        paint(dot, dotColor);
        bar.append(dot);
      }
      const side = document.createElement("span");
      side.className = "gl-settings-preview-side";
      paint(side, colors.side);
      const stage = document.createElement("span");
      stage.className = "gl-settings-preview-stage";
      const card = document.createElement("i");
      paint(card, colors.card);
      const pill = document.createElement("i");
      paint(pill, colors.accent);
      stage.append(card, pill);
      frame.append(bar, side, stage);
      const name = document.createElement("strong");
      name.textContent = label;
      button.append(frame, name);
      button.addEventListener("click", () => {
        if (root.NeuroMapUISkin?.set) root.NeuroMapUISkin.set({ theme: id });
        else if (root.GlaukaAndroidStylePanel) writeAndroidTheme({ theme: id === "slate" ? "dark" : "light" });
        render("appearance");
      });
      themes.append(button);
    }
    const others = root.NeuroMapUISkin ? (root.NeuroMapUISkinCore?.THEMES || []).filter((item) => item.id !== "prisma" && item.id !== "slate") : [];
    const themeChoices = [["", "Nessun tema aggiuntivo", "No additional theme"]];
    for (const item of others) themeChoices.push([item.id, item.it, item.en]);
    const theme = choice("gl-settings-theme-extra", themeChoices, others.some((item) => item.id === skin.theme) ? skin.theme : "", tr("Altri temi", "Other themes"), (value) => {
      root.NeuroMapUISkin?.set?.({ theme: value || "prisma" });
      render("appearance");
    });
    const more = document.createElement("details");
    more.className = "gl-settings-more";
    more.id = "gl-settings-more-themes";
    if (skin.theme !== "prisma" && skin.theme !== "slate") more.open = true;
    const moreTitle = document.createElement("summary");
    moreTitle.textContent = tr("Altri temi", "Other themes");
    more.append(moreTitle, SettingsRow(tr("Tema aggiuntivo", "Additional theme"), tr("Sostituisce il tema chiaro o scuro. Solo i comandi.", "Replaces the light or dark theme. Controls only."), theme));
    const contrast = choice("gl-settings-contrast", [["normal", "Standard", "Standard"], ["high", "Alto", "High"]], skin.contrast, tr("Contrasto", "Contrast"), (value) => root.NeuroMapUISkin?.set?.({ contrast: value }));
    const readability = choice("gl-settings-control-size", [["standard", "Standard", "Standard"], ["comfortable", "Comandi grandi", "Larger controls"]], skin.readability || "standard", tr("Dimensione dei comandi", "Control size"), (value) => root.NeuroMapUISkin?.set?.({ readability: value }));
    const orbit = root.NeuroMapOrbit?.get?.() || null;
    const personal = [];
    if (orbit) {
      personal.push(SettingsRow(
        tr("Colore dei comandi", "Control color"),
        tr("Non ricolora la mappa.", "It does not recolor the map."),
        choice("gl-settings-accent", [["auto", "Come il tema", "Match the theme"], ["cyan", "Ciano", "Cyan"], ["violet", "Viola", "Violet"], ["amber", "Ambra", "Amber"]], orbit.accent || "auto", tr("Colore dei comandi", "Control color"), (value) => root.NeuroMapOrbit.set({ accent: value }))
      ));
      personal.push(SettingsRow(
        tr("Spaziatura dei pannelli", "Panel spacing"),
        tr("Avvicina o allarga i pannelli.", "Pulls panels closer or gives them more room."),
        choice("gl-settings-panel-spacing", [["comfortable", "Spaziosa", "Comfortable"], ["compact", "Compatta", "Compact"]], orbit.density || "comfortable", tr("Spaziatura dei pannelli", "Panel spacing"), (value) => root.NeuroMapOrbit.set({ density: value }))
      ));
    } else if (androidFinish) {
      personal.push(SettingsRow(
        tr("Colore dei comandi", "Control color"),
        tr("Non ricolora la mappa.", "It does not recolor the map."),
        choice("gl-settings-accent", [["violet", "Viola", "Violet"], ["cyan", "Ciano", "Cyan"], ["amber", "Ambra", "Amber"]], androidFinish.accent || "violet", tr("Colore dei comandi", "Control color"), (value) => writeAndroidTheme({ accent: value }))
      ));
      personal.push(SettingsRow(
        tr("Spazio dei comandi", "Control spacing"),
        tr("Regola l'altezza e la distanza dei tasti su smartphone.", "Adjusts touch spacing and button height on mobile."),
        choice("gl-settings-panel-spacing", [["comfortable", "Comodo", "Comfortable"], ["compact", "Compatto", "Compact"]], androidFinish.density || "comfortable", tr("Spazio dei comandi", "Control spacing"), (value) => writeAndroidTheme({ density: value }))
      ));
    }
    const motion = root.NeuroMapMotion?.get?.() || null;
    const interfaceMotion = motion ? SettingsSwitch(motion.interface !== false, (checked) => root.NeuroMapMotion.set({ interface: checked }), "gl-settings-motion-interface") : null;
    const savedFontPreset = lsGet("neuromap.typography.default.v6") || "uniform";
    const fontPreset = choice("gl-settings-font-preset", [
      ["uniform", "Uniforme · stessa grandezza", "Uniform · same size"],
      ["balanced", "Graduale · gerarchia leggibile", "Gradual · readable hierarchy"],
      ["pyramid", "Piramide · centro grande", "Pyramid · large root"],
      ["branches", "Rami protagonisti", "Featured branches"],
      ["compact", "Compatto · mappe dense", "Compact · dense maps"]
    ], ["uniform", "balanced", "pyramid", "branches", "compact"].includes(savedFontPreset) ? savedFontPreset : "uniform", tr("Dimensioni del testo predefinite", "Default text hierarchy"), (value) => {
      lsSet("neuromap.typography.default.v6", value);
      const sel = document.getElementById("v5-font-preset");
      if (sel) sel.value = value;
    });
    const styleShortcut = (androidFinish || document.getElementById("glauka-style-open") || document.getElementById("btn-toggle-inspector"))
      ? actionButton(
          tr("Apri Stile e sfondo mappa", "Open Map style & background"),
          () => click(document.getElementById("glauka-style-open") ? "glauka-style-open" : "btn-toggle-inspector"),
          "gl-settings-open-style"
        )
      : null;
    appearance.append(
      SettingsSection(tr("Tema dell'interfaccia", "Interface theme"), themes, ...(others.length ? [more] : [])),
      ...(!androidFinish ? [SettingsSection(tr("Leggibilità", "Readability"),
        SettingsRow(tr("Contrasto", "Contrast"), tr("Rende i bordi dei comandi più netti.", "Makes the control borders easier to see."), contrast),
        SettingsRow(tr("Dimensione dei comandi", "Control size"), tr("Ingrandisce pulsanti e menu.", "Enlarges buttons and menus."), readability))] : []),
      ...(personal.length ? [SettingsSection(tr("Personalizzazione", "Customization"), ...personal)] : []),
      SettingsSection(tr("Tipografia e stili mappa", "Typography & map styles"),
        SettingsRow(tr("Profilo testo per nuove mappe", "Default text sizing for new maps"), tr("Imposta il formato iniziale applicato ai nuovi documenti.", "Sets the starting text sizing applied to new documents."), fontPreset),
        ...(styleShortcut ? [SettingsRow(tr("Sfondo, colori e preset della mappa", "Map background, colors and presets"), tr("Personalizza la mappa attiva, le forme e la trama di sfondo.", "Customize the active map, shapes and background pattern."), styleShortcut)] : [])),
      ...(interfaceMotion ? [SettingsSection(tr("Animazioni dell'interfaccia", "Interface animations"),
        SettingsRow(tr("Pannelli e pulsanti", "Panels and buttons"), tr("Breve dissolvenza. Se il sistema chiede meno movimento, resta fermo.", "A short fade. If the system asks for less motion, it stays still."), interfaceMotion))] : [])
    );
    const navigation = document.createElement("div");
    const speed = document.createElement("input");
    speed.type = "range";
    speed.min = "0.5";
    speed.max = "3";
    speed.step = "0.1";
    speed.value = String(zoom.speed);
    speed.id = "gl-settings-zoom-speed";
    speed.setAttribute("aria-label", tr("Velocità zoom", "Zoom speed"));
    const speedValue = document.createElement("span");
    speedValue.className = "gl-settings-value";
    speedValue.textContent = Number(zoom.speed).toFixed(1) + "×";
    speed.addEventListener("input", () => {
      const next = prefs().write({ speed: Number(speed.value) });
      speedValue.textContent = next.speed.toFixed(1) + "×";
    });
    const resetZoom = document.createElement("button");
    resetZoom.type = "button";
    resetZoom.textContent = tr("Ripristina", "Reset");
    resetZoom.addEventListener("click", () => {
      const next = prefs().write({ speed: 2 });
      speed.value = String(next.speed);
      speedValue.textContent = next.speed.toFixed(1) + "×";
    });
    const speedLabel = SettingsSlider(speed, speedValue, resetZoom);
    const animate = SettingsSwitch(zoom.animate, (checked) => prefs().write({ animate: checked }));
    const cursor = SettingsSwitch(zoom.cursor, (checked) => prefs().write({ cursor: checked }));
    const minimap = SettingsSwitch(nav.minimap !== false, (checked) => {
      root.NeuroMapNavigationPrefs?.set?.({ minimap: checked });
      root.NeuroMapNavigation?.refresh?.(root.neuroMapApp);
    });
    const semantic = SettingsSwitch(!!nav.semantic, (checked) => {
      root.NeuroMapNavigationPrefs?.set?.({ semantic: checked });
      const app = root.neuroMapApp;
      if (app?.renderer) app.renderer.semanticZoomEnabled = checked;
      root.NeuroMapNavigation?.refresh?.(app);
    });
    let autofocusOn = false;
    try { autofocusOn = localStorage.getItem("glauka.edit.autofocus.v1") === "1"; } catch { autofocusOn = false; }
    const autofocus = SettingsSwitch(autofocusOn, (checked) => {
      try { localStorage.setItem("glauka.edit.autofocus.v1", checked ? "1" : "0"); } catch { /* keep the switch as shown */ }
      const existing = document.getElementById("gl-edit-auto-zoom");
      if (existing) existing.checked = checked;
    }, "gl-settings-edit-zoom");
    const navViewSelect = root.NeuroMapLinkedViews?.setMode
      ? choice("gl-settings-view-mode", [
          ["mindmap", "Mappa mentale", "Mind map"],
          ["outline", "Struttura gerarchica", "Outline"],
          ["list", "Elenco rapido", "List"],
          ["presentation", "Presentazione passo-passo", "Step presentation"],
          ["kanban", "Schede Kanban", "Kanban boards"]
        ], String(root.neuroMapApp?.state?.root?.viewMode || "mindmap"), tr("Vista mappa attiva", "Active map view"), (value) => {
          const currentApp = root.neuroMapApp;
          if (currentApp) root.NeuroMapLinkedViews.setMode(currentApp, value);
        })
      : null;
    const fitMapBtn = actionButton(tr("Centra mappa", "Fit map"), () => { close(); root.neuroMapApp?.fitToScreen?.(); }, "gl-settings-fit-map");
    const zenBtn = document.getElementById("nm616-zen-switch")
      ? actionButton(tr("Attiva / Disattiva Concentrazione", "Toggle Focus mode"), () => click("nm616-zen-switch"), "gl-settings-toggle-zen")
      : null;
    navigation.append(
      heading(tr("Comportamento zoom", "Zoom behavior")),
      SettingsRow(tr("Velocità zoom", "Zoom speed"), tr("Da 0,5× a 3×, solo su questo dispositivo.", "From 0.5× to 3×, on this device only."), speedLabel),
      SettingsRow(tr("Animazione dello zoom", "Zoom animation"), tr("Se la disattivi, lo zoom arriva subito al punto scelto.", "When off, zoom jumps straight to the chosen size."), animate),
      SettingsRow(tr("Zoom sul cursore", "Zoom toward the pointer"), tr("Lo scorrimento ordinario della mappa resta com'è.", "Ordinary map scrolling stays as it is."), cursor),
      SettingsRow(tr("Ingrandimento durante la modifica", "Zoom while editing"), tr("Facoltativo. Il testo resta sul nodo.", "Optional. The text stays on the topic."), autofocus),
      heading(tr("Navigazione e viste", "Navigation and views")),
      SettingsRow(tr("Minimappa", "Minimap"), tr("Una mappa piccola per spostarti senza perdere il punto in cui sei.", "A small map so you can move without losing your place."), minimap),
      SettingsRow(tr("Zoom semantico", "Semantic zoom"), tr("Da vicino compaiono i dettagli. Da lontano resta la struttura.", "Up close, the details appear. From far away, the structure remains."), semantic),
      ...(navViewSelect ? [SettingsRow(tr("Vista della mappa corrente", "Current map view"), tr("Passa tra Mappa mentale, Struttura, Elenco, Presentazione o Kanban.", "Switch between Mind map, Outline, List, Presentation or Kanban."), navViewSelect)] : []),
      ...(zenBtn ? [SettingsRow(tr("Modalità lettura e Concentrazione (Zen)", "Focus reading mode (Zen)"), tr("Nasconde le barre per leggere e studiare la mappa senza distrazioni.", "Hides chrome so you can read and study without distractions."), zenBtn)] : []),
      SettingsRow(tr("Centra tutta la mappa nello schermo", "Fit full map on screen"), tr("Inquadra tutti i rami visibili al centro dell'area di lavoro.", "Frames every visible branch in the center of the workspace."), fitMapBtn)
    );
    const editor = document.createElement("div");
    const spacing = root.NeuroMapMedia?.currentDefaults?.() || readSpacing();
    const compact = document.createElement("input");
    compact.type = "range"; compact.id = "gl-settings-new-map-compactness"; compact.min = "55"; compact.max = "145"; compact.step = "5"; compact.value = String(spacing.compactness);
    compact.setAttribute("aria-label", tr("Compattezza delle nuove mappe", "Compactness for new maps"));
    const gap = document.createElement("input");
    gap.type = "range"; gap.id = "gl-settings-new-map-gap"; gap.min = "30"; gap.max = "220"; gap.step = "5"; gap.value = String(spacing.branchGapX);
    gap.setAttribute("aria-label", tr("Spazio tra i rami", "Space between branches"));
    const compactValue = document.createElement("span");
    compactValue.className = "gl-settings-value";
    compactValue.id = "gl-settings-compactness-value";
    const gapValue = document.createElement("span");
    gapValue.className = "gl-settings-value";
    gapValue.id = "gl-settings-gap-value";
    const showSpacing = () => {
      compactValue.textContent = compact.value + "%";
      gapValue.textContent = gap.value + " px";
    };
    const applySpacing = () => {
      const next = root.NeuroMapMedia?.setDefaults?.({ compactness: Number(compact.value), branchGapX: Number(gap.value) }) || writeSpacing(Number(compact.value), Number(gap.value));
      compact.value = String(next.compactness);
      gap.value = String(next.branchGapX);
      showSpacing();
    };
    showSpacing();
    compact.addEventListener("input", applySpacing);
    gap.addEventListener("input", applySpacing);
    const compactReset = document.createElement("button");
    compactReset.type = "button";
    compactReset.textContent = tr("Ripristina", "Reset");
    compactReset.addEventListener("click", () => { compact.value = "55"; applySpacing(); });
    const gapReset = document.createElement("button");
    gapReset.type = "button";
    gapReset.textContent = tr("Ripristina", "Reset");
    gapReset.addEventListener("click", () => { gap.value = "30"; applySpacing(); });
    const compactControl = SettingsSlider(compact, compactValue, compactReset);
    const gapControl = SettingsSlider(gap, gapValue, gapReset);
    const livePerformance = document.getElementById("nm-fast-canvas-toggle");
    const performance = SettingsSwitch(!!livePerformance?.checked, (checked) => {
      if (!livePerformance || livePerformance.checked === checked) return;
      livePerformance.checked = checked;
      livePerformance.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const mapMotion = root.NeuroMapMotion?.get?.() || null;
    const editorRows = [
      heading(tr("Nuove mappe", "New maps")),
      SettingsRow(tr("Compattezza delle nuove mappe", "Compactness for new maps"), tr("Solo per le mappe nuove. Quella aperta si regola in Formato.", "Only for new maps. The open map is adjusted in Format."), compactControl),
      SettingsRow(tr("Spazio tra i rami", "Space between branches"), tr("Solo per le mappe nuove. Quella aperta si regola in Formato.", "Only for new maps. The open map is adjusted in Format."), gapControl)
    ];
    if (mapMotion) {
      const branchDuration = document.createElement("input");
      branchDuration.type = "range";
      branchDuration.id = "gl-settings-branch-duration";
      branchDuration.min = "120";
      branchDuration.max = "1000";
      branchDuration.step = "20";
      branchDuration.value = String(mapMotion.duration || 360);
      branchDuration.disabled = mapMotion.branches === false;
      const branchDurationValue = document.createElement("span");
      branchDurationValue.className = "gl-settings-value";
      branchDurationValue.textContent = branchDuration.value + " ms";
      branchDuration.addEventListener("input", () => {
        const next = root.NeuroMapMotion.set({ duration: Number(branchDuration.value) });
        branchDurationValue.textContent = next.duration + " ms";
      });
      const branchDurationControl = SettingsSlider(branchDuration, branchDurationValue);
      editorRows.push(
        heading(tr("Animazioni della mappa", "Map animations")),
        SettingsRow(tr("Comparsa dei nuovi rami", "New branches appear gently"), tr("I rami nuovi entrano in dissolvenza.", "New branches fade in."), SettingsSwitch(mapMotion.branches !== false, (checked) => {
          root.NeuroMapMotion.set({ branches: checked });
          branchDuration.disabled = !checked;
        }, "gl-settings-branch-motion")),
        SettingsRow(tr("Durata della comparsa", "Appearance duration"), tr("Solo per i nuovi rami.", "Only for new branches."), branchDurationControl)
      );
    }
    editorRows.push(
      heading(tr("Prestazioni", "Performance")),
      SettingsRow(tr("Disegno rapido per mappe grandi", "Fast rendering for large maps"), tr("Prima i rami visibili. Nodi ed esportazioni restano completi.", "On-screen branches first. Nodes and exports stay complete."), performance)
    );
    const importSplit = () => {
      const limit = document.createElement("select");
      limit.id = "gl-settings-import-size";
      for (const value of [80, 100, 125, 150, 200]) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = value + " " + tr("nodi", "nodes");
        limit.append(option);
      }
      const stored = root.NM613?.capacity?.() || 125;
      limit.value = String([80, 100, 125, 150, 200].includes(Number(stored)) ? stored : 125);
      limit.setAttribute("aria-label", tr("Suddivisione automatica all'importazione", "Automatic split on import"));
      limit.addEventListener("change", () => {
        try { localStorage.setItem("neuromap.import.nodesPerMap.v613", limit.value); } catch { /* keep the choice on screen */ }
        const menu = document.getElementById("nm613-import-size");
        if (menu) menu.value = limit.value;
      });
      return SettingsRow(
        tr("Suddivisione automatica all'importazione", "Automatic split on import"),
        tr("Schede da al massimo questo numero di nodi.", "Tabs of at most this many nodes."),
        limit
      );
    };
    editorRows.push(
      heading(tr("Importazione di mappe grandi", "Importing large maps")),
      importSplit()
    );
    const savedWrapChars = Number(lsGet("nm64_default_wrap_chars") || 0);
    const wrapSelect = choice("gl-settings-wrap-chars", [
      ["0", "Automatico", "Automatic"],
      ["28", "Compatto (28 caratteri)", "Compact (28 chars)"],
      ["36", "Bilanciato (36 caratteri)", "Balanced (36 chars)"],
      ["48", "Ampio (48 caratteri)", "Wide (48 chars)"],
      ["64", "Esteso (64 caratteri)", "Extended (64 chars)"]
    ], [0, 28, 36, 48, 64].includes(savedWrapChars) ? String(savedWrapChars) : "0", tr("A capo automatico", "Line wrapping"), (value) => {
      lsSet("nm64_default_wrap_chars", value);
      const wrapInput = document.getElementById("nm64-default-wrap");
      if (wrapInput) wrapInput.value = value;
    });
    const openLibBtn = actionButton(
      tr("Apri Libreria creativa", "Open Creative library"),
      () => { close(); root.neuroMapApp?.nm62OpenAssets?.(); },
      "gl-settings-open-library"
    );
    const openQualityBtn = actionButton(
      tr("Controlla qualità mappa", "Check map quality"),
      () => {
        if (document.getElementById("nm-quality-open")) click("nm-quality-open");
        else if (root.NeuroMapQualityUI?.open) { close(); root.NeuroMapQualityUI.open(root.neuroMapApp); }
        else openToolsSection("quality");
      },
      "gl-settings-open-quality"
    );
    editorRows.push(
      heading(tr("Testo, grafica e verifica", "Text, graphics & check")),
      SettingsRow(tr("A capo automatico nei nuovi rami", "Automatic line wrapping for new topics"), tr("Imposta la larghezza massima consigliata per le etichette dei nuovi nodi.", "Sets the recommended max line width for newly created topics."), wrapSelect),
      SettingsRow(tr("Libreria creativa (Simboli, Forme, Icone)", "Creative library (Symbols, Shapes, Icons)"), tr("Apri simboli, frecce, icone vettoriali, illustrazioni ed elementi salvati.", "Open markers, shapes, vector icons, illustrations and saved items."), openLibBtn),
      SettingsRow(tr("Verifica qualità e collegamenti", "Check map quality & links"), tr("Individua nodi orfani, collegamenti incompleti o campi vuoti.", "Finds orphan topics, broken links or incomplete fields."), openQualityBtn)
    );
    editor.append(...editorRows);

    const study = document.createElement("div");
    const cardCount = Array.isArray(root.neuroMapApp?.studyCards) ? root.neuroMapApp.studyCards.length : 0;
    const flashBtn = actionButton(
      tr("Apri Flashcard e Quiz", "Open Flashcards & Quiz"),
      () => {
        if (document.getElementById("btn-flashcards")) click("btn-flashcards");
        else openToolsSection("cards");
      },
      "gl-settings-open-flashcards"
    );
    const learnBtn = actionButton(
      tr("Apri Studia la mappa", "Open Study map"),
      () => {
        if (document.getElementById("nm-learn-toggle")) click("nm-learn-toggle");
        else openToolsSection("cards");
      },
      "gl-settings-open-learn"
    );
    const imageStudyBtn = actionButton(
      tr("Ripassa su immagini", "Visual image study"),
      () => {
        if (document.getElementById("nm-visual-study-open")) click("nm-visual-study-open");
        else openToolsSection("image");
      },
      "gl-settings-open-visual-study"
    );
    const ocrBtn = actionButton(
      tr("Apri OCR e PDF", "Open OCR & PDF"),
      () => {
        if (root.neuroMapApp?._nmOCR?.open) { close(); root.neuroMapApp._nmOCR.open(); }
        else openToolsSection("documents");
      },
      "gl-settings-open-ocr"
    );
    const notesSourcesBtn = actionButton(
      tr("Appunti, wiki e fonti PDF", "Notes, wiki & PDF sources"),
      () => {
        if (document.getElementById("nm-knowledge-toggle")) click("nm-knowledge-toggle");
        else openToolsSection("capture");
      },
      "gl-settings-open-knowledge"
    );
    const dashBtn = actionButton(
      tr("Riepilogo e Dashboard mappe", "Map overview & Dashboard"),
      () => {
        if (document.getElementById("nm82-open")) click("nm82-open");
        else openToolsSection("dashboard");
      },
      "gl-settings-open-dashboard"
    );
    study.append(
      heading(tr("Studio attivo e ripasso", "Active study & review")),
      SettingsRow(
        tr("Flashcard e Quiz offline", "Offline Flashcards & Quiz"),
        cardCount
          ? tr("Carte salvate nel workspace: ", "Saved cards in workspace: ") + cardCount + "."
          : tr("Crea domande dai rami o importa mazzi TSV Anki per studiare senza rete.", "Generate branch questions or import Anki TSV decks offline."),
        flashBtn
      ),
      SettingsRow(tr("Studia la mappa e scadenze SRS", "Study map & review schedule"), tr("Ripeti a memoria, consulta le scadenze dei ripassi e il piano d'esame.", "Recall from memory, track review deadlines and exam schedule."), learnBtn),
      SettingsRow(tr("Ripasso visivo su immagini (Hotspot)", "Visual hotspot image study"), tr("Nascondi etichette su schemi anatomici, grafici e immagini della mappa.", "Practice recall on hidden hotspots in diagrams and images."), imageStudyBtn),
      heading(tr("Documenti, OCR e appunti", "Documents, OCR & notes")),
      SettingsRow(tr("OCR · Testo da PDF e scansioni", "OCR · Text from PDFs & scans"), tr("Riconosci testo locale sul dispositivo da PDF o immagini senza inviarli in rete.", "Extract text locally on device from scanned PDFs and photos."), ocrBtn),
      SettingsRow(tr("Appunti rapidi, wiki e citazioni PDF", "Quick notes, wiki & PDF citations"), tr("Collega note, database personalizzati e riferimenti puntuali alle pagine PDF.", "Link rich notes, structured fields and exact PDF page references."), notesSourcesBtn),
      SettingsRow(tr("Riepilogo delle mappe aperte", "Open maps overview"), tr("Panoramica su nodi, attività, risorse e avanzamento di studio.", "Overview of topics, tasks, resources and study progress."), dashBtn)
    );

    const ai = document.createElement("div");
    let aiSummary = tr("Nessun provider AI configurato in questa sessione. ", "No AI provider configured in this session. ");
    try {
      const cfg = JSON.parse(lsGet("neuromap.ai.settings.v4") || "{}");
      const voiceCfg = JSON.parse(lsGet("neuromap.ai.voice.v1") || "{}");
      const bits = [];
      if (cfg?.provider) bits.push(String(cfg.provider) + (cfg.model ? " · " + String(cfg.model) : ""));
      if (voiceCfg?.provider) bits.push(tr("Voce: ", "Voice: ") + String(voiceCfg.provider));
      if (bits.length) aiSummary = tr("Attivo: ", "Active: ") + bits.join(" · ") + ". ";
    } catch { /* keep neutral summary */ }
    const openAi = document.createElement("button");
    openAi.type = "button";
    openAi.textContent = tr("Apri configurazione", "Open configuration");
    openAi.addEventListener("click", () => {
      if (document.getElementById("btn-ai-settings")) click("btn-ai-settings");
      else {
        close();
        const modal = document.getElementById("ai-settings-modal");
        if (modal) modal.classList?.remove?.("hidden");
        else root.neuroMapApp?.openAIStudio?.();
      }
    });
    const openAiStudioBtn = actionButton(
      tr("Apri Assistente AI", "Open AI Assistant"),
      () => { close(); root.neuroMapApp?.openAIStudio?.(); },
      "gl-settings-open-ai-studio"
    );
    const openAiIllustrateBtn = actionButton(
      tr("Illustra rami · PRO", "Illustrate with AI · PRO"),
      () => { close(); if (root.GlaukaIllustrations?.open) root.GlaukaIllustrations.open(root.neuroMapApp); else click("menu-iconify-bulk"); },
      "gl-settings-open-ai-illustrate"
    );
    ai.append(
      SettingsSection(
        tr("Connessione e modelli", "Connection & models"),
        SettingsRow(tr("Provider, modello e voce", "Provider, model and voice"), aiSummary + tr("La chiave resta in memoria e non viene scritta nella mappa.", "The key stays in memory and is not written into the map."), openAi)
      ),
      SettingsSection(
        tr("Strumenti AI collegati", "Connected AI tools"),
        SettingsRow(tr("Assistente AI (Studio)", "AI Studio Assistant"), tr("Espandi rami, riassumi documenti, genera flashcard o trascrivi note vocali.", "Expand branches, summarize files, generate flashcards or transcribe audio."), openAiStudioBtn),
        SettingsRow(tr("Illustra automaticamente con AI · PRO", "Auto-illustrate with AI · PRO"), tr("Assegna icone vettoriali coerenti ai concetti principali della mappa.", "Assign matching vector icons to your key map concepts."), openAiIllustrateBtn),
        ...(root.neuroMapApp?.nm611AuditOpen
          ? [SettingsRow(tr("Verifica coerenza e fonti con AI", "AI consistency & source audit"), tr("Controlla lacune logiche e collegamenti senza modificare la mappa automaticamente.", "Checks logical gaps and links without modifying your map automatically."), actionButton(tr("Avvia verifica AI", "Open AI audit"), () => { close(); root.neuroMapApp?.nm611AuditOpen?.(); }, "gl-settings-open-ai-audit"))]
          : [])
      )
    );

    const cloud = document.createElement("div");
    const openCloud = document.createElement("button");
    openCloud.type = "button";
    openCloud.textContent = isAndroidApp
      ? tr("Apri da Google Drive / File…", "Open from Google Drive / Files…")
      : tr("Gestisci connessioni", "Manage connections");
    openCloud.addEventListener("click", () => {
      if (!isAndroidApp && document.getElementById("gl-cloud-quick")) {
        click("gl-cloud-quick");
      } else if (root.NeuroMapLifecycle?.androidOpenProject) {
        close();
        root.NeuroMapLifecycle.androidOpenProject(null);
      } else {
        click("gl-cloud-quick");
      }
    });
    const activeTabObj = root.neuroMapApp?.tabs?.find?.((t) => t.id === root.neuroMapApp?.activeTabId);
    const linkedDriveInfo = activeTabObj?.androidDocWritable
      ? tr("Collegato su Drive/File: ", "Linked on Drive/Files: ") + String(activeTabObj.fileName || "")
      : tr("Lo stato vero è nel pannello Cloud.", "The real status is in the Cloud panel.");
    const openShareDeviceBtn = actionButton(
      tr("Apri Condividi o trasferisci", "Open Share or transfer"),
      () => openSharePanel("device"),
      "gl-settings-open-share"
    );
    const openCompareBtn = actionButton(
      tr("Confronta copie (.json / .gk)", "Compare copies (.json / .gk)"),
      () => {
        if (document.getElementById("nm-exchange-open")) click("nm-exchange-open");
        else openToolsSection("exchange");
      },
      "gl-settings-open-compare"
    );
    const cloudDeviceName = document.createElement("input");
    cloudDeviceName.type = "text";
    cloudDeviceName.id = "gl-settings-cloud-device-name";
    cloudDeviceName.maxLength = 40;
    cloudDeviceName.placeholder = tr("Es. PC Studio, MacBook, Telefono", "e.g. Studio PC, MacBook, Phone");
    cloudDeviceName.value = lsGet("glauka.f11.deviceName") || "";
    cloudDeviceName.setAttribute("aria-label", tr("Nome dispositivo per Cloud e trasferimenti", "Device name for Cloud and transfers"));
    cloudDeviceName.addEventListener("input", () => {
      lsSet("glauka.f11.deviceName", cloudDeviceName.value.trim().slice(0, 40));
      const mirror = document.getElementById("gl-settings-device-name");
      if (mirror) mirror.value = cloudDeviceName.value;
    });
    cloud.append(
      SettingsSection(
        tr("Archiviazione Cloud e Google Drive", "Cloud Storage & Google Drive"),
        SettingsRow(tr("Google Drive, Dropbox e OneDrive", "Google Drive, Dropbox and OneDrive"), linkedDriveInfo, openCloud),
        ...(activeTabObj?.androidDocWritable
          ? [SettingsRow(tr("Aggiorna file collegato su Drive", "Update linked Drive file"), tr("Sovrascrive direttamente il file aperto mantenendo lo stesso percorso su Drive.", "Overwrites the open file directly while preserving its Drive path."), actionButton(tr("Salva su Drive / File collegato", "Save to linked Drive / File"), () => { close(); root.neuroMapApp?.saveToFile?.(); }, "gl-settings-drive-save"))]
          : [])
      ),
      SettingsSection(
        tr("Trasferimento PC ↔ Mac ↔ Telefono", "PC ↔ Mac ↔ Phone Transfer"),
        SettingsRow(tr("Condividi o trasferisci mappa", "Share or transfer map"), tr("Invia via codice QR, esporta pacchetti .json/.gk o apri una mappa ricevuta.", "Send via QR code, export .json/.gk bundles or open a received map."), openShareDeviceBtn),
        SettingsRow(tr("Confronta due versioni o copie", "Compare two versions or copies"), tr("Esamina differenze tra rami senza modificare il documento aperto.", "Inspect branch differences without modifying the open document."), openCompareBtn),
        SettingsRow(tr("Nome di questo dispositivo", "This device name"), tr("Mostrato nei trasferimenti tra computer e smartphone.", "Shown during transfers between computer and phone."), cloudDeviceName)
      )
    );

    const files = document.createElement("div");
    files.append(
      heading(tr("Importazione di mappe grandi", "Importing large maps")),
      importSplit(),
      heading(tr("Pacchetti ed esportazione", "Bundles & export")),
      SettingsRow(tr("Importa o esporta copia completa", "Import or export full copy"), tr("Formati supportati: .gk, .json, .xmind, Markdown (.md), OPML e HTML.", "Supported formats: .gk, .json, .xmind, Markdown (.md), OPML and HTML."), actionButton(tr("Apri Esporta / Importa", "Open Export / Import"), () => openSharePanel("save"), "gl-settings-open-export"))
    );
    const privacy = document.createElement("div");
    const backup = document.createElement("button");
    backup.type = "button";
    backup.id = "gl-settings-export-backup";
    backup.textContent = tr("Esporta backup del workspace", "Export workspace backup");
    backup.addEventListener("click", () => {
      if (document.getElementById("menu-save-all-tabs")) click("menu-save-all-tabs");
      else root.neuroMapApp?.exportData?.();
    });
    const recovery = document.createElement("button");
    recovery.type = "button";
    recovery.id = "gl-settings-open-recovery";
    recovery.textContent = tr("Stato salvataggio e recupero", "Save and recovery status");
    recovery.addEventListener("click", () => {
      if (document.getElementById("nm-save-status")) click("nm-save-status");
      else root.neuroMapApp?.openSaveStatus?.();
    });
    const reset = document.createElement("button");
    reset.type = "button";
    reset.id = "gl-settings-reset-ui-prefs";
    reset.textContent = tr("Ripristina preferenze interfaccia", "Reset interface preferences");
    reset.addEventListener("click", async () => {
      const app = root.neuroMapApp;
      let allowed = false;
      if (app?.nmAsk) {
        allowed = await app.nmAsk({
          title: tr("Ripristinare le preferenze dell'interfaccia?", "Reset interface preferences?"),
          message: tr("Tornano il tema Prisma, il contrasto standard, i comandi standard, il colore dei comandi e la spaziatura comoda, insieme alla velocità di zoom 2×. Le mappe e le copie di recupero non vengono toccate.", "This returns the Prisma theme, standard contrast, standard controls, the theme color and comfortable spacing, plus 2× zoom speed. Maps and recovery copies are not touched."),
          choices: [{ value: "cancel", text: tr("Annulla", "Cancel") }, { value: "reset", text: tr("Ripristina", "Reset"), primary: true }]
        }) === "reset";
      }
      if (!allowed) return;
      prefs().reset();
      root.NeuroMapUISkin?.set?.({ theme: "prisma", contrast: "normal", readability: "standard" });
      root.NeuroMapOrbit?.set?.({ accent: "auto", density: "comfortable" });
      if (root.GlaukaAndroidStylePanel) writeAndroidTheme({ theme: "light", accent: "violet", density: "comfortable" });
      render("privacy");
    });
    const recentList = root.NeuroMapLifecycle?.recentAndroidFiles?.() || [];
    const privacyExtra = [];
    if (document.getElementById("gl-history-quick")) {
      privacyExtra.push(SettingsRow(
        tr("Cronologia versioni locali", "Local version history"),
        tr("Esamina salvataggi automatici, conserva versioni protette o recupera una copia.", "Browse automatic saves, keep protected snapshots or restore a copy."),
        actionButton(tr("Apri cronologia versioni", "Open version history"), () => click("gl-history-quick"), "gl-settings-open-history")
      ));
    }
    if (isAndroidApp || recentList.length > 0) {
      privacyExtra.push(SettingsRow(
        tr("Cronologia file recenti", "Recent files history"),
        recentList.length
          ? tr("File memorizzati in elenco rapido: ", "Files tracked in quick list: ") + recentList.length + "."
          : tr("Nessun file recente memorizzato su questo dispositivo.", "No recent files saved on this device."),
        actionButton(tr("Svuota elenco recenti", "Clear recent list"), () => { lsRemove("glauka.android.recentFiles.v1"); render("privacy"); }, "gl-settings-clear-recents")
      ));
    }
    privacy.append(
      SettingsRow(tr("Archiviazione locale e copie di recupero", "Local storage and recovery copies"), tr("Solo su questo dispositivo.", "Only on this device."), backup),
      SettingsRow(tr("Verifica integrità e recupero", "Integrity check and recovery"), tr("Controlla l'ultimo salvataggio.", "Checks the latest save."), recovery),
      ...privacyExtra,
      SettingsRow(tr("Esporta pacchetto o copia HTML", "Export full package or HTML copy"), tr("Crea una copia completa (.json) oppure una pagina web offline di sola lettura.", "Creates a complete bundle (.json) or a read-only offline webpage."), actionButton(tr("Esporta copia", "Export copy"), () => openSharePanel("save"), "gl-settings-privacy-export")),
      SettingsRow(tr("Telemetria e chiavi API", "Telemetry and API keys"), tr("Nessuna telemetria. Le chiavi non finiscono nei file.", "No telemetry. Keys are not written into files."), reset)
    );
    const about = document.createElement("div");
    const facts = document.createElement("dl");
    facts.className = "gl-settings-info";
    const stamp = document.documentElement.dataset.neuromapVersion || "";
    const versionText = typeof NM_PRODUCT_VERSION === "string" && NM_PRODUCT_VERSION ? NM_PRODUCT_VERSION : (stamp || tr("Non disponibile", "Not available"));
    const platform = root.navigator?.userAgentData?.platform || root.navigator?.platform || "";
    const fact = (name, value, id) => {
      const term = document.createElement("dt");
      term.textContent = name;
      const detail = document.createElement("dd");
      if (id) detail.id = id;
      detail.textContent = value;
      facts.append(term, detail);
      return detail;
    };
    fact(tr("Prodotto", "Product"), "Glauka");
    fact(tr("Versione applicazione", "Application version"), versionText, "gl-settings-edition");
    fact(tr("Motore condiviso", "Shared engine"), "7.4.0-rc.1 (SingleTab-v6)");
    fact(tr("Piattaforma", "Platform"), platform || tr("Questo computer", "This computer"));
    const edition = fact(tr("Piano attivo", "Active plan"), tr("Free", "Free"), "gl-settings-plan");
    fact(tr("Sito ufficiale", "Official site"), "glauka.it");
    about.append(
      facts,
      heading(tr("Licenza e risorse", "License & resources")),
      ...(document.getElementById("nm6-plan-button")
        ? [SettingsRow(tr("Piano Free / Pro e licenza", "Free / Pro plan & license"), tr("Verifica il piano attivo, confronta le funzioni o inserisci una chiave Pro.", "Check your active plan, compare features or activate a Pro key."), actionButton(tr("Gestisci piano Free / Pro", "Manage Free / Pro plan"), () => click("nm6-plan-button"), "gl-settings-open-plan"))]
        : []),
      SettingsRow(tr("Guida rapida e comandi", "Quick guide & commands"), tr("Consulta le istruzioni e tutti i comandi disponibili.", "Browse documentation and available commands."), actionButton(tr("Apri guida e comandi", "Open guide & commands"), () => {
        if (document.getElementById("nm7-guide-open")) click("nm7-guide-open");
        else if (document.getElementById("btn-shortcuts")) click("btn-shortcuts");
        else click("nm-android-command-open");
      }, "gl-settings-open-guide"))
    );
    const showPlan = (status) => {
      const raw = String(status?.plan || status?.edition || "").toLowerCase();
      if (!edition.isConnected) return;
      if (raw === "pro") edition.textContent = tr("Pro", "Pro");
      else if (raw === "free") edition.textContent = tr("Free", "Free");
      else edition.textContent = tr("Non disponibile", "Not available");
    };
    const statusCall = root.neuromapDesktop?.productStatus?.();
    if (statusCall?.then) statusCall.then(showPlan).catch(() => showPlan(null));
    return { general, appearance, navigation, editor, study, ai, cloud, files, privacy, about };
  }
  function legacyPark() {
    let park = document.getElementById("gl-appearance-park");
    if (!park) {
      park = document.createElement("div");
      park.id = "gl-appearance-park";
      park.hidden = true;
      document.body.append(park);
    }
    for (const id of ["nm-ui-skin-settings", "nm-orbit-desktop-settings", "nm-motion-settings", "gl-edit-interaction-preferences", "gl-branches-control"]) {
      const section = document.getElementById(id);
      if (section && section.parentElement !== park) park.append(section);
    }
    return park;
  }
  function branchesHost() {
    let host = document.getElementById("gl-settings-branches");
    if (!host) {
      host = document.createElement("section");
      host.id = "gl-settings-branches";
      host.className = "nm6-skiptranslate";
      const heading = document.createElement("h4");
      const sub = document.createElement("p");
      sub.className = "gl-branches-subtitle";
      const labelBranches = () => {
        heading.textContent = tr("Rami e collegamenti", "Branches & connections");
        sub.textContent = tr(
          "Scegli lo stile visivo dei collegamenti, il distacco dal nodo centrale e lo spessore.",
          "Choose connector geometry, center node separation and line thickness.",
        );
      };
      labelBranches();
      root.NeuroMapWorkspaceLocale?.watch(labelBranches);
      host.append(heading, sub);
    }
    if (!host.isConnected) legacyPark().append(host);
    return host;
  }
  function formatHost() {
    if (globalThis.GlaukaMobile || document.querySelector(".glauka-map-background")) return null;
    let host = document.getElementById("gl-format-map-canvas");
    if (!host) {
      host = document.createElement("section");
      host.id = "gl-format-map-canvas";
      host.className = "inspector-section nm6-skiptranslate";
      const title = document.createElement("h3");
      title.className = "inspector-section-label";
      title.id = "gl-format-map-canvas-title";
      const note = document.createElement("p");
      note.className = "gl-format-map-note";
      const labelHost = () => {
        title.textContent = tr("Sfondo della mappa", "Map background");
        note.textContent = tr("Solo su questo computer.", "Only on this computer.");
      };
      labelHost();
      root.NeuroMapWorkspaceLocale?.watch(labelHost);
      host.append(title, note);
    }
    if (!host.querySelector(".gl-format-map-head")) {
      const head = document.createElement("div");
      head.className = "gl-format-map-head";
      const headText = document.createElement("div");
      headText.className = "gl-format-map-head-text";
      const title = host.querySelector("#gl-format-map-canvas-title, .inspector-section-label");
      const note = host.querySelector(".gl-format-map-note");
      if (title) headText.append(title);
      if (note) headText.append(note);
      head.append(headText);
      if (typeof host.prepend === "function") host.prepend(head);
      else if (typeof host.insertBefore === "function") host.insertBefore(head, host.firstChild || null);
      else host.append(head);
    }
    if (!host.isConnected) legacyPark().append(host);
    return host;
  }
  function collapseSwatches(host) {
    const options = host.querySelector(".nm-theme-options");
    if (!options || host.querySelector(".gl-swatch-more")) return;
    const buttons = [...options.querySelectorAll(".nm-theme-option")];
    const more = document.createElement("button");
    more.type = "button";
    more.className = "gl-swatch-more";
    let expanded = false;
    const apply = () => {
      buttons.forEach((button, index) => {
        const preview = index < 5 || (index >= 12 && index < 17);
        const selected = button.getAttribute("aria-checked") === "true";
        button.hidden = !expanded && !preview && !selected;
      });
      more.textContent = expanded ? tr("Mostra meno", "Show fewer") : tr("Mostra tutti", "Show all");
      more.setAttribute("aria-expanded", String(expanded));
    };
    more.addEventListener("click", () => { expanded = !expanded; apply(); });
    new MutationObserver(apply).observe(options, { subtree: true, attributes: true, attributeFilter: ["aria-checked"] });
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    const head = host.querySelector(".gl-format-map-head");
    if (head) head.append(more);
    else options.after(more);
    apply();
  }
  function placeMapTools() {
    legacyPark();
    const branchesBox = branchesHost();
    const branchesControl = document.getElementById("gl-branches-control") || document.getElementById("nm54-style-grid")?.closest(".nm54-control");
    if (branchesControl && branchesBox) {
      branchesControl.id = branchesControl.id || "gl-branches-control";
      if (branchesControl.parentElement !== branchesBox) branchesBox.append(branchesControl);
      const picker = document.getElementById("nm54-branch-picker");
      if (picker) picker.open = true;
    }
    if (globalThis.GlaukaMobile || document.querySelector(".glauka-map-background")) return;
    const host = formatHost();
    if (!host) return;
    const sidebar = document.getElementById("inspector-sidebar");
    if (sidebar && sidebar.contains(host)) legacyPark().append(host);
    const picker = document.querySelector(".nm-theme-picker");
    if (picker && !picker.closest(".glauka-map-background") && !host.contains(picker)) host.append(picker);
    const disclosure = host.querySelector(".nm-theme-disclosure");
    if (disclosure) disclosure.open = true;
    collapseSwatches(host);
    const texture = document.getElementById("nm-map-refinements");
    if (texture && !texture.closest(".glauka-map-background") && texture.parentElement !== host) host.append(texture);
    const gallery = document.getElementById("nm-map-presets");
    if (gallery && sidebar && !sidebar.contains(gallery)) {
      const header = sidebar.querySelector(".inspector-header");
      if (header) header.after(gallery);
      else sidebar.prepend(gallery);
    }
  }
  function render(id) {
    current = id;
    const parkedBranches = document.getElementById("gl-settings-branches");
    if (parkedBranches) legacyPark().append(parkedBranches);
    if (!globalThis.GlaukaMobile && !document.querySelector(".glauka-map-background")) {
      const parked = document.getElementById("gl-format-map-canvas");
      if (parked) legacyPark().append(parked);
    }
    placeMapTools();
    const body = document.getElementById("gl-settings-body");
    const nav = document.getElementById("gl-settings-nav");
    const headTitle = document.getElementById("gl-settings-section-title");
    if (!body || !nav) return;
    body.replaceChildren();
    const built = pages();
    const found = categories.find((item) => item[0] === id) || categories[0];
    if (headTitle) headTitle.textContent = tr(found[1], found[2]);
    else {
      const title = document.createElement("h3");
      title.textContent = tr(found[1], found[2]);
      body.append(title);
    }
    const page = built[found[0]];
    body.append(page);
    if (found[0] === "appearance") {
      const branchesHostEl = document.getElementById("gl-settings-branches");
      if (branchesHostEl) page.append(branchesHostEl);
      if (!globalThis.GlaukaMobile && !document.querySelector(".glauka-map-background")) {
        const host = document.getElementById("gl-format-map-canvas");
        if (host) page.append(host);
      }
    }
    const query = (document.getElementById("gl-settings-search")?.value || "").trim().toLocaleLowerCase();
    if (query) {
      for (const box of body.querySelectorAll(".gl-settings-row")) {
        box.hidden = !box.dataset.search.includes(query);
      }
    }
    for (const button of nav.querySelectorAll("button")) {
      if (!button.dataset?.category) continue;
      button.setAttribute("aria-current", String(button.dataset.category === found[0]));
    }
    const paintMore = () => {
      if (typeof body.classList?.toggle !== "function") return;
      if (body.dataset) body.dataset.more = tr("Scorri per vedere il resto", "Scroll for the rest");
      body.classList.toggle("gl-settings-more", body.scrollHeight - body.clientHeight - body.scrollTop > 24);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(paintMore);
    else paintMore();
  }
  function searchAll(query) {
    const needle = query.trim().toLocaleLowerCase();
    const nav = document.getElementById("gl-settings-nav");
    if (!nav) return;
    let first = "";
    for (const button of nav.querySelectorAll("button")) {
      if (!button.dataset?.category) continue;
      const label = (button.textContent + " " + button.dataset.words).toLocaleLowerCase();
      button.hidden = button.dataset.category === "files" ? !needle || !label.includes(needle) : !!needle && !label.includes(needle);
      if (!button.hidden && !first) first = button.dataset.category;
    }
    if (first && document.getElementById("gl-settings-nav")?.querySelector('[data-category="' + current + '"]')?.hidden) current = first;
    render(current);
  }
  function close() {
    if (!globalThis.GlaukaMobile && !document.querySelector(".glauka-map-background")) {
      const host = document.getElementById("gl-format-map-canvas");
      if (host) legacyPark().append(host);
    }
    shade?.remove();
    shade = null;
    lastFocus = null;
    document.getElementById("gl-settings-quick")?.focus?.();
  }
  function trap(event) {
    if (event.key !== "Tab" || !shade) return;
    const items = [...shade.querySelectorAll("button,input,select")].filter((node) => !node.hidden && node.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function open(from) {
    if (shade) { close(); return; }
    lastFocus = from || document.activeElement;
    if (!document.getElementById("gl-settings-css")) {
      const style = document.createElement("style");
      style.id = "gl-settings-css";
      style.textContent = CSS;
      document.head.append(style);
    }
    shade = document.createElement("div");
    shade.id = "gl-settings-shade";
    const dialog = document.createElement("section");
    dialog.id = "gl-settings-center";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "gl-settings-title");
    const header = document.createElement("header");
    const back = document.createElement("button");
    back.type = "button";
    back.id = "gl-settings-back";
    back.textContent = "←";
    back.setAttribute("aria-label", tr("Indietro", "Back"));
    back.addEventListener("click", close);
    const title = document.createElement("h2");
    title.id = "gl-settings-title";
    title.textContent = tr("Impostazioni", "Settings");
    const search = document.createElement("input");
    search.id = "gl-settings-search";
    search.type = "search";
    search.placeholder = tr("Cerca un'impostazione", "Search settings");
    search.setAttribute("aria-label", search.placeholder);
    search.addEventListener("input", () => searchAll(search.value));
    const closer = document.createElement("button");
    closer.type = "button";
    closer.id = "gl-settings-close";
    closer.textContent = "×";
    closer.setAttribute("aria-label", tr("Chiudi impostazioni", "Close settings"));
    closer.addEventListener("click", close);
    header.append(back, title, search, closer);
    const layout = document.createElement("div");
    layout.id = "gl-settings-layout";
    const nav = document.createElement("nav");
    nav.id = "gl-settings-nav";
    nav.setAttribute("aria-label", tr("Categorie", "Categories"));
    const navItems = document.createElement("div");
    navItems.id = "gl-settings-nav-items";
    for (const [id, it, en, extra] of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.category = id;
      button.dataset.words = (it + " " + en + " " + extra).toLocaleLowerCase();
      const icon = navIcon(id);
      if (icon) button.append(icon);
      const label = document.createElement("span");
      label.textContent = tr(it, en);
      button.append(label);
      if (id === "files") button.hidden = true;
      button.addEventListener("click", () => render(id));
      navItems.append(button);
    }
    const meta = document.createElement("div");
    meta.id = "gl-settings-nav-meta";
    const metaProduct = document.createElement("strong");
    metaProduct.textContent = "Glauka";
    const metaVersion = document.createElement("span");
    metaVersion.id = "gl-settings-nav-version";
    const stamp = document.documentElement.dataset.neuromapVersion || "";
    const versionText = typeof NM_PRODUCT_VERSION === "string" && NM_PRODUCT_VERSION ? NM_PRODUCT_VERSION : (stamp || "1.0.4");
    metaVersion.textContent = tr("Versione", "Version") + " " + versionText;
    const metaPlan = document.createElement("span");
    metaPlan.id = "gl-settings-nav-plan";
    metaPlan.textContent = tr("Piano Free", "Free plan");
    meta.append(metaProduct, metaVersion, metaPlan);
    const statusCall = root.neuromapDesktop?.productStatus?.();
    const applyPlan = (status) => {
      if (!metaPlan.isConnected) return;
      const raw = String(status?.plan || status?.edition || "").toLowerCase();
      if (raw === "pro") metaPlan.textContent = tr("Piano Pro", "Pro plan");
      else if (raw === "free") metaPlan.textContent = tr("Piano Free", "Free plan");
      else metaPlan.textContent = tr("Licenza", "License");
    };
    if (statusCall?.then) statusCall.then(applyPlan).catch(() => applyPlan(null));
    nav.append(navItems, meta);
    const main = document.createElement("div");
    main.id = "gl-settings-main";
    const mainHead = document.createElement("div");
    mainHead.id = "gl-settings-main-head";
    const sectionTitle = document.createElement("h3");
    sectionTitle.id = "gl-settings-section-title";
    mainHead.append(sectionTitle);
    const body = document.createElement("div");
    body.id = "gl-settings-body";
    const watchScroll = () => body.classList.toggle("gl-settings-more", body.scrollHeight - body.clientHeight - body.scrollTop > 24);
    body.addEventListener("scroll", watchScroll, { passive: true });
    if (typeof ResizeObserver === "function") new ResizeObserver(watchScroll).observe(body);
    main.append(mainHead, body);
    layout.append(nav, main);
    dialog.append(header, layout);
    shade.append(dialog);
    shade.addEventListener("mousedown", (event) => { if (event.target === shade) close(); });
    document.body.append(shade);
    render(current);
    search.focus();
  }
  function ensureButton() {
    let button = document.getElementById("gl-settings-quick");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "gl-settings-quick";
      button.className = "gl-chrome-icon-btn";
      const bar = document.querySelector(".tab-bar") || document.body;
      bar.append(button);
    }
    button.title = tr("Impostazioni", "Settings");
    button.setAttribute("aria-label", button.title);
    if (!button.dataset.bound) {
      button.dataset.bound = "1";
      button.addEventListener("click", () => open(button));
    }
    const menu = document.getElementById("dropdown-file");
    if (menu && !document.getElementById("menu-settings")) {
      const item = document.createElement("button");
      item.type = "button";
      item.id = "menu-settings";
      item.className = "dropdown-item";
      const label = document.createElement("span");
      label.textContent = tr("Impostazioni…", "Settings…");
      const keys = document.createElement("kbd");
      keys.className = "kbd-key";
      keys.textContent = /Mac/i.test(root.navigator?.platform || "") ? "\u2318" + "," : "Ctrl" + "+,";
      item.append(label, keys);
      item.addEventListener("click", () => open(item));
      const anchor = document.getElementById("nm-save-status") || document.getElementById("nm611-autosave-open");
      if (anchor && anchor.parentElement === menu) anchor.after(item);
      else menu.append(item);
    }
    root.NeuroMapTopbarCuration?.curate?.();
  }
  function onKey(event) {
    const ask = document.getElementById("nm-decision-overlay");
    if (shade && (event.key === "Escape" || event.key === "Back" || event.keyCode === 4) && !(ask && !ask.classList.contains("hidden"))) {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (shade) trap(event);
    const typing = event.target && (event.target.closest?.("input,textarea,select,[contenteditable='true']"));
    if (!shade && !typing && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === ",") {
      event.preventDefault();
      open(document.getElementById("gl-settings-quick"));
    }
  }
  function install() {
    ensureButton();
    if (!root.__glSettingsKeys) {
      root.__glSettingsKeys = true;
      document.addEventListener("keydown", onKey, true);
    }
  }
  root.NeuroMapSettingsCenter = Object.freeze({ install, open, close });
})(typeof globalThis === "object" ? globalThis : this);
