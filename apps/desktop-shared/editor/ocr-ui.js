/* Shared, explicit review/import UI. No map writes until the final action. */
(function(root){
'use strict';
const C=root.NeuroMapOCRCore,Q=root.NeuroMapOCRQuality,S=root.NeuroMapOCRStructure,t=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
const e=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const NS='http://www.w3.org/2000/svg';
function svgIcon(paths,size=18){
 const s=document.createElementNS(NS,'svg');
 s.setAttribute('viewBox','0 0 24 24');s.setAttribute('width',String(size));s.setAttribute('height',String(size));
 s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','1.85');
 s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');
 s.setAttribute('aria-hidden','true');
 for(const d of paths){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);s.append(p)}
 return s;
}
function formatBytes(bytes){
 if(!Number.isFinite(bytes)||bytes<=0)return '0 B';
 if(bytes<1024*1024)return Math.max(1,Math.round(bytes/1024))+' KB';
 return (bytes/(1024*1024)).toFixed(bytes>=100*1024*1024?0:1)+' MB';
}
function countWords(text){
 const m=String(text||'').trim().match(/\S+/g);
 return m?m.length:0;
}
function meanConfidence(lines){
 if(!Array.isArray(lines)||!lines.length)return null;
 let sum=0,n=0;
 for(const l of lines){
  if(Number.isFinite(l?.confidence)){sum+=l.confidence;n++;}
 }
 return n?Math.round((sum/n)*100):null;
}
const css=`
#nm-ocr[hidden]{display:none!important}
#nm-ocr{
  position:fixed;inset:0;z-index:6000;display:grid;place-items:center;padding:14px;
  background:rgba(15,23,42,.62);backdrop-filter:blur(7px);box-sizing:border-box;
  color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));
}
#nm-ocr *{box-sizing:border-box;min-width:0}
#nm-ocr .ocr-window{
  width:min(1180px,100%);height:min(860px,94dvh);max-height:94dvh;overflow:hidden;
  display:flex;flex-direction:column;border-radius:18px;
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
  color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));
  box-shadow:0 26px 72px rgba(15,23,42,.30);
  font:13.5px/1.5 var(--font-sans,Inter,system-ui,-apple-system,sans-serif);
}
#nm-ocr .ocr-head{
  flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  padding:12px 20px;
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
  border-bottom:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-head-brand{display:flex;align-items:center;gap:12px;flex:1 1 240px;min-width:0}
#nm-ocr .ocr-head-badge{
  width:38px;height:38px;flex:0 0 38px;border-radius:11px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 14%,transparent);
  color:var(--nm-theme-action,#5b3fd0);
  border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 28%,transparent);
}
#nm-ocr .ocr-head-copy{display:grid;gap:1px;min-width:0}
#nm-ocr .ocr-head strong{font-size:16.5px;line-height:1.25;font-weight:750;letter-spacing:-.01em}
#nm-ocr .ocr-head-sub{font-size:12px;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}
#nm-ocr .ocr-head-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#nm-ocr .ocr-dest-pill{
  display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;
  font-size:12px;font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));
}
#nm-ocr .ocr-close-btn{min-height:34px!important;padding:5px 12px!important;border-radius:10px!important;font-weight:650}
#nm-ocr .ocr-workspace{
  flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  display:flex;flex-direction:column;gap:12px;padding:14px 20px 18px;
}
#nm-ocr button,#nm-ocr select,#nm-ocr input:not([type=file]),#nm-ocr textarea{
  font:inherit;color:inherit;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  border-radius:10px;padding:7px 11px;max-width:100%;min-height:36px;
}
#nm-ocr button{cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:600;transition:border-color .15s,background-color .15s}
#nm-ocr button:hover:not(:disabled){border-color:var(--nm-theme-focus,#7c5ce7)}
#nm-ocr button:disabled{opacity:.48;cursor:default}
#nm-ocr button[aria-pressed="true"]{
  background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 14%,var(--nm-skin-surface,#ffffff))!important;
  border-color:var(--nm-theme-action,#5b3fd0)!important;
  color:var(--nm-theme-action,#5b3fd0)!important;
}
#nm-ocr label{display:grid;gap:6px}
#nm-ocr .ocr-check{display:flex;gap:9px;align-items:center;cursor:pointer}
#nm-ocr input[type=checkbox]{width:17px;height:17px;min-height:17px;flex:0 0 17px;accent-color:var(--nm-theme-action,#5b3fd0);margin:0}
#nm-ocr .ocr-hint{margin:0;font-size:12px;line-height:1.45;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}
#nm-ocr .ocr-primary{
  background:var(--nm-theme-action,#5b3fd0)!important;
  color:var(--nm-theme-on-action,#ffffff)!important;
  border-color:var(--nm-theme-action,#5b3fd0)!important;
  font-weight:700;padding:8px 16px;border-radius:11px;
  box-shadow:0 6px 18px color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 24%,transparent);
}
#nm-ocr .ocr-primary:hover:not(:disabled){filter:brightness(1.06)}

/* Collapsible Setup Drawer (keeps 90% workspace height for document review!) */
#nm-ocr .ocr-setup-details{
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  border-radius:14px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));padding:10px 14px;
}
#nm-ocr .ocr-setup-details>summary{
  list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;
  min-height:28px;font-weight:700;font-size:13px;cursor:pointer;
}
#nm-ocr .ocr-setup-details>summary::-webkit-details-marker{display:none}
#nm-ocr .ocr-setup-body{display:grid;gap:12px;margin-top:12px}
#nm-ocr .ocr-dropzone{
  position:relative;display:flex!important;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  padding:13px 15px;border-radius:13px;cursor:pointer;
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
  border:1.5px dashed color-mix(in srgb,var(--nm-theme-focus,#5b3fd0) 45%,var(--nm-skin-stroke,#cbd5e1));
  transition:border-color .15s,background-color .15s;
}
#nm-ocr .ocr-dropzone.ocr-dropzone-ready{border-style:solid;border-color:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 55%,var(--nm-skin-stroke,#cbd5e1))}
#nm-ocr .ocr-dropzone.ocr-drag{border-style:solid;border-color:var(--nm-theme-action,#5b3fd0);background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 10%,var(--nm-skin-top,#f4f6fc))}
#nm-ocr .ocr-file-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;margin:0;padding:0;border:0}
#nm-ocr .ocr-drop-left{display:flex;align-items:center;gap:12px;flex:1 1 240px;min-width:0;pointer-events:none}
#nm-ocr .ocr-drop-icon{
  width:40px;height:40px;flex:0 0 40px;border-radius:11px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 12%,var(--nm-skin-surface,#fff));
  color:var(--nm-theme-action,#5b3fd0);
  border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 25%,transparent);
}
#nm-ocr .ocr-drop-copy{display:grid;gap:2px;min-width:0}
#nm-ocr .ocr-drop-title{font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nm-ocr .ocr-drop-meta{font-size:12px;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));overflow-wrap:anywhere}
#nm-ocr .ocr-drop-btn-visual{
  pointer-events:none;flex:none;padding:7px 13px;border-radius:10px;font-size:12.5px;font-weight:650;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-setup-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#nm-ocr .ocr-card{
  display:grid;gap:10px;align-content:start;padding:13px;border-radius:13px;
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-card-title{font-size:12.5px;font-weight:750}
#nm-ocr .ocr-field-label{font-size:12px;font-weight:650}
#nm-ocr .ocr-presets{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#nm-ocr .ocr-presets button{min-height:29px!important;padding:3px 10px!important;font-size:11.5px;border-radius:999px!important}
#nm-ocr .ocr-bookmarks{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-top:2px}
#nm-ocr .ocr-toggle-card{
  display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border-radius:10px;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-toggle-copy{display:grid;gap:2px}
#nm-ocr .ocr-toggle-copy strong{font-size:12.5px;font-weight:650;line-height:1.3}
#nm-ocr .ocr-toggle-copy small{font-size:11.5px;line-height:1.35;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}

#nm-ocr .ocr-run-bar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 14px;border-radius:13px;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-run-buttons{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#nm-ocr .ocr-status-stack{flex:1 1 220px;display:grid;gap:5px;min-width:0}
#nm-ocr [role=status]{min-height:18px;font-size:12.5px;font-weight:600;overflow-wrap:anywhere}
#nm-ocr [role=status][data-error="true"]{color:#dc2626}
#nm-ocr progress{
  appearance:none;-webkit-appearance:none;width:100%;height:7px;border:0;border-radius:999px;overflow:hidden;
  background:color-mix(in srgb,var(--nm-skin-stroke,#cbd5e1) 60%,transparent);
  accent-color:var(--nm-theme-action,#5b3fd0);
}
#nm-ocr progress::-webkit-progress-bar{background:color-mix(in srgb,var(--nm-skin-stroke,#cbd5e1) 55%,transparent);border-radius:999px}
#nm-ocr progress::-webkit-progress-value{background:var(--nm-theme-action,#5b3fd0);border-radius:999px}

/* Document Navigator & Flagship Split Studio */
#nm-ocr .ocr-page-bar{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;border-radius:12px;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-page-bar[hidden]{display:none!important}
#nm-ocr .ocr-page-bar select{flex:1 1 200px;min-height:34px;background:var(--nm-skin-surface,#fff)}
#nm-ocr .ocr-page-bar button{min-height:34px;padding:5px 10px;background:var(--nm-skin-surface,#fff)}
#nm-ocr .ocr-metric-pill{
  font-size:11.5px;font-weight:650;padding:4px 9px;border-radius:999px;
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
  color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));white-space:nowrap;
}
#nm-ocr .ocr-metric-pill[data-tone="good"]{border-color:color-mix(in srgb,#10b981 45%,transparent);color:#047857}
#nm-ocr .ocr-metric-pill[data-tone="warn"]{border-color:color-mix(in srgb,#f59e0b 55%,transparent);color:#b45309}
#nm-ocr .ocr-review{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(0,.94fr);gap:14px;align-items:start}
#nm-ocr .ocr-pane{
  display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:14px;
  background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
}
#nm-ocr .ocr-pane-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
#nm-ocr .ocr-pane-head strong{font-size:13.5px;font-weight:750}
#nm-ocr .ocr-inspector-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}
#nm-ocr .ocr-tool-group{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}
#nm-ocr .ocr-tool-group button{min-height:31px!important;padding:4px 9px!important;font-size:12px!important;border-radius:8px!important;background:var(--nm-skin-surface,var(--nm-ui-surface,#fff))}
#nm-ocr .ocr-source-scroll{
  overflow:auto;height:440px;max-height:54dvh;overscroll-behavior:contain;touch-action:pan-x pan-y;
  border-radius:11px;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  background:repeating-conic-gradient(rgba(148,163,184,.08) 0% 25%,transparent 0% 50%) 50% / 16px 16px;
  padding:10px;display:flex;justify-content:center;align-items:flex-start;
}
#nm-ocr .ocr-image{position:relative;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.18);width:100%;flex:none;transform-origin:center center}
#nm-ocr img{display:block;width:100%;height:auto}
#nm-ocr .ocr-boxes{position:absolute;inset:0;pointer-events:none}
#nm-ocr .ocr-boxes button{position:absolute;pointer-events:auto;background:rgba(16,185,129,.12);border:1px solid rgba(5,150,105,.65);border-radius:3px;min-height:0!important;padding:0!important}
#nm-ocr .ocr-boxes button[data-conf="low"]{background:rgba(245,158,11,.18);border-color:#d97706}
#nm-ocr .ocr-boxes button:hover,#nm-ocr .ocr-boxes button:focus-visible{background:rgba(91,63,208,.24);outline:2px solid var(--nm-theme-action,#5b3fd0)}
#nm-ocr .ocr-selection{position:absolute;border:2px solid #0284c7;background:rgba(14,165,233,.18);box-shadow:0 0 0 9999px rgba(15,23,42,.22);pointer-events:none}
#nm-ocr .ocr-image.ocr-selecting{touch-action:none;cursor:crosshair}

/* Right Studio Controls & Utility Bar */
#nm-ocr .ocr-meta-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.9fr);gap:8px}
#nm-ocr .ocr-text-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}
#nm-ocr .ocr-text-toolbar button{min-height:30px!important;padding:3px 9px!important;font-size:11.5px!important;border-radius:8px!important;background:var(--nm-skin-surface,var(--nm-ui-surface,#fff))}
#nm-ocr textarea{width:100%;min-height:240px;resize:vertical;line-height:1.62;background:var(--nm-skin-surface,var(--nm-ui-surface,#fff))!important;font-size:13.5px}
#nm-ocr .ocr-warning{
  padding:9px 11px;border:1px solid color-mix(in srgb,#f59e0b 50%,var(--nm-skin-stroke,#cbd5e1));
  border-left:4px solid #f59e0b!important;border-radius:10px;font-size:12px;line-height:1.45;overflow-wrap:anywhere;
  background:color-mix(in srgb,#f59e0b 7%,var(--nm-skin-surface,#ffffff));
}
#nm-ocr .ocr-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#nm-ocr .ocr-actions button{min-height:28px!important;padding:3px 9px!important;font-size:11.5px;border-radius:999px!important}
#nm-ocr .ocr-region-tools,#nm-ocr .ocr-structure,#nm-ocr #nm-ocr-original-text{
  border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  border-radius:11px;padding:9px 12px;
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
}
#nm-ocr details>summary{cursor:pointer;font-weight:650;font-size:12.5px;min-height:28px;display:flex;align-items:center;gap:6px}
#nm-ocr .ocr-region-tools textarea{min-height:92px;margin-top:8px}
#nm-ocr .ocr-region-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}
#nm-ocr .ocr-structure{display:grid;gap:8px}
#nm-ocr .ocr-block{display:grid;grid-template-columns:126px 64px minmax(0,1fr);gap:6px}
#nm-ocr .ocr-block input,#nm-ocr .ocr-block select{padding:5px 8px;font-size:12.5px;min-height:34px}
#nm-ocr pre{white-space:pre-wrap;max-height:170px;overflow:auto;font-size:12px;line-height:1.5;margin:8px 0 0;padding:8px;border-radius:8px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc))}

/* Docked Non-Overlapping Bottom Footer */
#nm-ocr .ocr-footer{
  flex:0 0 auto;display:grid;gap:8px;padding:11px 20px;
  background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));
  border-top:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
  box-shadow:0 -4px 16px rgba(15,23,42,.06);
}
#nm-ocr .ocr-footer[hidden]{display:none!important}
#nm-ocr .ocr-footer-checks{display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center}
#nm-ocr .ocr-footer-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
#nm-ocr :focus-visible{outline:2px solid var(--nm-theme-focus,#5b3fd0);outline-offset:2px}
@media(max-width:860px){
  #nm-ocr .ocr-setup-grid,#nm-ocr .ocr-review,#nm-ocr .ocr-meta-row{grid-template-columns:minmax(0,1fr)}
  #nm-ocr .ocr-source-scroll{height:320px}
}
@media(max-width:650px){
  #nm-ocr{padding:6px}
  #nm-ocr .ocr-window{height:98dvh;max-height:98dvh;border-radius:14px}
  #nm-ocr .ocr-head{padding:10px 12px}
  #nm-ocr .ocr-workspace{padding:10px 12px 14px}
  #nm-ocr .ocr-footer{padding:9px 12px}
  #nm-ocr .ocr-head-sub{display:none}
  #nm-ocr .ocr-dest-pill{max-width:130px;padding:4px 8px;font-size:11px}
  #nm-ocr .ocr-block{grid-template-columns:minmax(0,1fr) 64px}
  #nm-ocr .ocr-block input:last-child{grid-column:1/-1}
  #nm-ocr textarea{min-height:180px}
}
`;
function localizeError(error){
 if(error?.code==='batch')return t('Numero di pagine non valido per una singola operazione.','Invalid page selection count for one run.');
 if(error?.code==='pages')return t('Intervallo non valido. Usa numeri o intervalli entro le pagine del PDF (es. 1-5, 8).','Invalid pages. Use page numbers or ranges within the PDF (e.g. 1-5, 8).');
 const msg=String(error?.message||error||'');
 if(/exceeds 10,000 pages|more than 10,000 pages/i.test(msg))return t('Il PDF supera 10.000 pagine: dividi prima il documento in sezioni più brevi.','The PDF exceeds 10,000 pages: split the document into smaller parts first.');
 if(/up to 512 MB/i.test(msg))return t('Il file PDF supera 512 MB.','The PDF file exceeds 512 MB.');
 if(/Password/i.test(msg))return t('Questo PDF è protetto da password: rimuovila prima di aprirlo.','This PDF is password-protected: unlock it before opening.');
 if(/Invalid PDF/i.test(msg))return t('Il file scelto non è un PDF valido.','The selected file is not a valid PDF.');
 if(/previews exceed session limit/i.test(msg))return t('Le anteprime in memoria hanno superato il limite di sicurezza: leggi meno pagine per blocco e importale man mano.','In-memory page previews reached the safety budget: read fewer pages per batch and import as you go.');
 return msg;
}
function mount(app){
 if(!app||app._nmOCR)return;
 const menu=document.getElementById('dropdown-file');
 if(!menu&&!root.GlaukaMobile)return;
 const style=e('style');style.textContent=css;document.head.append(style);
 const launch=e('button','dropdown-item',t('Leggi testo dalle scansioni…','Read text from scans…'));launch.type='button';launch.id='nm-ocr-launch';
 if(menu)menu.append(launch);
 const shade=e('div');shade.id='nm-ocr';shade.hidden=true;shade.className='nm6-skiptranslate';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label',t('Testo dalle scansioni','Text from scans'));
 const pane=e('section','ocr-window');shade.append(pane);document.body.append(shade);
 let controller=null,peekController=null,peekTimer=0,epoch=0,file=null,meta=null,results=[],source=null,dirty=false,cache=new Map(),owner,tab,parent,closeFocus;
 const live=()=>app.state===owner&&app.activeTabId===tab&&owner.findNode(parent.id)===parent&&owner.selectedNodeId===parent.id;
 const askDiscard=async()=>!(dirty||controller)||await app.nmAsk({title:t('Anteprima non importata','Preview not imported'),message:t('Scartare il testo e le correzioni di questa anteprima?','Discard this preview and its edits?'),choices:[{value:'cancel',text:t('Continua a modificare','Continue editing')},{value:'discard',text:t('Scarta','Discard'),danger:true}]})==='discard';
 const close=async()=>{if(!await askDiscard())return false;epoch++;if(peekTimer){clearTimeout(peekTimer);peekTimer=0}peekController?.abort();peekController=null;controller?.abort();controller=null;shade.hidden=true;results=[];cache.clear();file=null;meta=null;dirty=false;pane.replaceChildren();closeFocus?.focus?.();return true};
 root.NeuroMapLifecycle?.registerDraft?.({hasPending:()=>!shade.hidden&&!!(dirty||controller),confirmClose:close});
 function open(){
  if(!shade.hidden){shade.focus();return}
  app.hideMenus?.();app.closeEditor?.(true);owner=app.state;tab=app.activeTabId;parent=owner.findNode(owner.selectedNodeId)||owner.root;if(!parent)return;
  closeFocus=document.activeElement;shade.hidden=false;results=[];source=null;dirty=false;file=null;meta=null;render();
  void root.NeuroMapPdfJs?.warmup?.();
 }
 function render(){
  pane.replaceChildren();
  const button=(name,fn,cls='')=>{const b=e('button',cls,name);b.type='button';b.addEventListener('click',fn);return b};
  const field=(name,type)=>{const label=e('label'),input=e('input');input.type=type;label.append(e('span','ocr-field-label',name),input);return {label,input}};

  // Band 1: Docked Non-Scrolling Header
  const head=e('div','ocr-head');
  const brand=e('div','ocr-head-brand'),badge=e('div','ocr-head-badge');
  badge.append(svgIcon(['M4 8V4h4','M16 4h4v4','M4 16v4h4','M20 16v4h-4','M7 10h10','M7 14h6'],20));
  const copy=e('div','ocr-head-copy');
  copy.append(
   e('strong','',t('OCR Studio · Testo da PDF & Scansioni','OCR Studio · Text from PDFs & Scans')),
   e('span','ocr-head-sub',t('Elaborazione locale offline · anteprima visiva sincronizzata · selezione interattiva di zona','Offline local engine · synced visual preview · interactive area selection'))
  );
  brand.append(badge,copy);
  const headRight=e('div','ocr-head-right');
  const destPill=e('span','ocr-dest-pill',t('Destinazione: ','Destination: ')+String(parent.text||''));
  destPill.title=destPill.textContent;
  const closeButton=button(t('Chiudi','Close'),close,'ocr-close-btn');
  headRight.append(destPill,closeButton);
  head.append(brand,headRight);

  // Band 2: Scrollable Workspace Body
  const workspace=e('div','ocr-workspace');

  // Setup Drawer (auto-collapses once pages are scanned to maximize split workspace)
  const setupDetails=e('details','ocr-setup-details');setupDetails.open=true;
  const setupSummary=e('summary','',t('1 · Documento PDF, pagine e opzioni di lettura','1 · PDF file, page range & recognition options'));
  const setupStatusPill=e('span','ocr-metric-pill',t('Nessun PDF selezionato','No PDF selected'));
  setupSummary.append(setupStatusPill);
  const setupBody=e('div','ocr-setup-body');

  const dropzone=e('label','ocr-dropzone');
  dropzone.setAttribute('for','nm-ocr-file');
  const fileInput=e('input','ocr-file-input');
  fileInput.type='file';fileInput.accept='.pdf,application/pdf';fileInput.id='nm-ocr-file';
  fileInput.setAttribute('aria-label',t('Documento PDF','PDF document'));
  const dropLeft=e('div','ocr-drop-left'),dropIcon=e('div','ocr-drop-icon');
  dropIcon.append(svgIcon(['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M9 13h6','M9 17h4'],20));
  const dropCopy=e('div','ocr-drop-copy');
  const dropTitle=e('span','ocr-drop-title',t('Carica un PDF dal dispositivo o trascinalo qui','Choose a PDF from this device or drop it here'));
  const dropMeta=e('span','ocr-drop-meta',t('Supporta libri ed estratti lunghi fino a 512 MB · il testo selezionabile originale viene conservato','Supports long books up to 512 MB · existing selectable text is preserved'));
  dropCopy.append(dropTitle,dropMeta);
  dropLeft.append(dropIcon,dropCopy);
  const dropBtnVisual=e('span','ocr-drop-btn-visual',t('Scegli PDF…','Choose PDF…'));
  dropzone.append(fileInput,dropLeft,dropBtnVisual);

  dropzone.addEventListener('dragover',ev=>{ev.preventDefault();dropzone.classList.add('ocr-drag')});
  dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('ocr-drag'));
  dropzone.addEventListener('drop',ev=>{
   ev.preventDefault();dropzone.classList.remove('ocr-drag');
   const dropped=ev.dataTransfer?.files?.[0];
   if(dropped&&typeof DataTransfer==='function'){
    const dt=new DataTransfer();dt.items.add(dropped);fileInput.files=dt.files;
    fileInput.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });

  const setupGrid=e('div','ocr-setup-grid');
  const pageCard=e('section','ocr-card');
  pageCard.append(e('div','ocr-card-title',t('Selezione pagine','Page selection')));
  const range=field(t('Intervallo · es. 1-10, 15, 22-30','Range · e.g. 1-10, 15, 22-30'),'text');
  range.input.value='1';range.input.id='nm-ocr-pages';range.input.maxLength=240;
  const presets=e('div','ocr-presets');
  const presetButtons=[
   ['1-5',t('Prime 5','First 5')],
   ['1-20',t('Prime 20','First 20')],
   ['1-50',t('1–50','1–50')],
   ['all',t('Tutte','All pages')]
  ];
  const presetRefs=[];
  for(const [val,lbl] of presetButtons){
   const pb=button(lbl,()=>{
    if(val==='all'){range.input.value=meta?.totalPages?'1-'+meta.totalPages:'1-20'}
    else{const m=val.match(/^1-(\d+)$/),maxPage=meta?.totalPages?Math.min(Number(m[1]),meta.totalPages):Number(m[1]);range.input.value='1-'+maxPage}
   });
   presetRefs.push([val,pb]);presets.append(pb);
  }
  const bookmarksRow=e('div','ocr-bookmarks');bookmarksRow.hidden=true;
  pageCard.append(range.label,presets,bookmarksRow);

  const optCard=e('section','ocr-card');
  optCard.append(e('div','ocr-card-title',t('Qualità e modalità di lettura','Recognition mode & quality')));
  const makeToggle=(id,titleText,descText)=>{
   const lbl=e('label','ocr-check ocr-toggle-card'),inp=e('input'),copyBox=e('span','ocr-toggle-copy');
   inp.type='checkbox';inp.id=id;
   copyBox.append(e('strong','',titleText),e('small','',descText));
   lbl.append(inp,copyBox);
   return {label:lbl,input:inp};
  };
  const force=makeToggle('nm-ocr-force',
   t('Rileggi anche il testo selezionabile','Recognize selectable text too'),
   t('Utile se il PDF ha testo copiabile rovinato, colonne fuse o simboli errati.','Useful when the PDF has broken text layers, merged columns, or garbled symbols.'));
  const enhance=makeToggle('nm-ocr-enhance',
   t('Raddrizza e migliora contrasto','Straighten and improve contrast'),
   t('Corregge pagine storte, foto scure e scansioni sbiadite prima dell’OCR.','Corrects skewed scans, shadows, and low-contrast pages before OCR.'));
  enhance.input.checked=true;
  optCard.append(force.label,enhance.label);
  setupGrid.append(pageCard,optCard);
  setupBody.append(dropzone,setupGrid);
  setupDetails.append(setupSummary,setupBody);

  // Action & Progress Bar
  const runBar=e('div','ocr-run-bar');
  const runBtns=e('div','ocr-run-buttons');
  const run=button(t('Leggi le pagine','Read pages'),start,'ocr-primary');run.id='nm-ocr-run';run.disabled=true;
  const cancel=button(t('Interrompi','Stop'),()=>controller?.abort());cancel.id='nm-ocr-stop';cancel.disabled=true;
  runBtns.append(run,cancel);
  const statusStack=e('div','ocr-status-stack');
  const status=e('div','',t('Seleziona un PDF sopra per iniziare.','Select a PDF above to begin.'));
  status.setAttribute('role','status');status.id='nm-ocr-status';
  const progress=e('progress');progress.id='nm-ocr-progress';progress.max=1;progress.value=0;progress.hidden=true;
  statusStack.append(status,progress);
  runBar.append(runBtns,statusStack);

  // Navigator Bar
  const pageBar=e('div','ocr-page-bar');pageBar.hidden=true;
  const prevPageBtn=button('◀',()=>{const idx=Number(select.value);if(idx>0){select.value=String(idx-1);showPage()}});
  prevPageBtn.setAttribute('aria-label',t('Pagina precedente','Previous page'));
  const select=e('select');select.id='nm-ocr-review-page';select.setAttribute('aria-label',t('Pagina da confrontare','Page to compare'));
  const nextPageBtn=button('▶',()=>{const idx=Number(select.value);if(idx<results.length-1){select.value=String(idx+1);showPage()}});
  nextPageBtn.setAttribute('aria-label',t('Pagina successiva','Next page'));
  const pageMetrics=e('span','ocr-metric-pill','');
  const includeAllBtn=button(t('Includi tutte','Include all'),()=>{for(const r of results)if(r.edited.trim())r.include=true;changed();showPage()});
  pageBar.append(prevPageBtn,select,nextPageBtn,pageMetrics,includeAllBtn);

  const review=e('div','ocr-review');
  workspace.append(setupDetails,runBar,pageBar,review);

  // Band 3: Docked Non-Overlapping Bottom Footer
  const footer=e('div','ocr-footer');
  const footerChecks=e('div','ocr-footer-checks');
  const structured={input:e('input'),label:e('label','ocr-check')};
  structured.input.type='checkbox';structured.input.id='nm-ocr-use-structure';
  structured.label.append(structured.input,document.createTextNode(t('Importa anche la struttura proposta e verificata','Also import the proposed and reviewed structure')));
  structured.input.addEventListener('change',()=>{dirty=true;consent.input.checked=false;update()});
  const consent={input:e('input'),label:e('label','ocr-check')};
  consent.input.type='checkbox';consent.input.id='nm-ocr-consent';
  consent.label.append(consent.input,document.createTextNode(t('Ho confrontato le pagine incluse e verificato numeri, simboli e unità.','I compared the included pages and checked numbers, symbols and units.')));
  footerChecks.append(structured.label,consent.label);
  const footerBar=e('div','ocr-footer-bar');
  const footerStats=e('p','ocr-hint',t('Destinazione: ','Destination: ')+String(parent.text||''));
  const apply=button(t('Aggiungi alla mappa · un solo Annulla','Add to map · one Undo'),commit,'ocr-primary');apply.id='nm-ocr-apply';apply.disabled=true;
  footerBar.append(footerStats,apply);
  footer.append(footerChecks,footerBar);

  pane.append(head,workspace,footer);
  fileInput.focus();

  let syncReview=()=>{};
  function update(){
   syncReview();
   const cur=Number(select.value);
   prevPageBtn.disabled=cur<=0||!results.length;
   nextPageBtn.disabled=cur>=results.length-1||!results.length;
   const included=results.filter(r=>r.include);
   const totalWords=included.reduce((n,r)=>n+countWords(r.edited),0);
   footerStats.textContent=results.length
    ?`${included.length}/${results.length} ${t('pagine pronte','pages ready')} · ~${totalWords} ${t('parole','words')} · ${t('Destinazione: ','Destination: ')}${String(parent.text||'')}`
    :(t('Destinazione: ','Destination: ')+String(parent.text||''));
   apply.disabled=!!controller||!consent.input.checked||!included.length||included.some(r=>!r.edited.trim()||r.edited.length>C.MAX_TEXT)||!live()||(structured.input.checked&&included.some(r=>{try{S.validate(r.structure,r.edited);return false}catch{return true}}));
  }
  function changed(){dirty=true;consent.input.checked=false;update()}
  consent.input.addEventListener('change',update);

  function showPage(){
   review.replaceChildren();const row=results[Number(select.value)];if(!row)return;
   const left=e('div','ocr-pane'),right=e('div','ocr-pane');

   const wordsNum=countWords(row.edited);
   const conf=row.method==='native'?100:meanConfidence(row.lines);
   pageMetrics.textContent=row.blank
    ?t('Pagina vuota o senza ink rilevato','Blank / no visible ink')
    :(conf!==null?`${conf}% ${t('affidabilità','confidence')} · `:'')+`${wordsNum} ${t('parole','words')}`;
   pageMetrics.dataset.tone=row.blank||wordsNum===0?'warn':(conf===null||conf>=86?'good':'warn');

   const viewport=e('div','ocr-source-scroll'),picture=e('div','ocr-image'),img=e('img');
   img.src=row.preview;img.alt=t('Pagina originale ','Original page ')+row.page;
   picture.append(img);
   const boxes=e('div','ocr-boxes');boxes.hidden=true;picture.append(boxes);
   viewport.append(picture);

   let zoomed=false,zoomFactor=1,rotateDeg=0;
   const applyScale=()=>{
    if(zoomed){
     const targetW=Math.round(Math.max(img.naturalWidth||1100,(viewport.clientWidth-24)*1.4)*zoomFactor);
     picture.style.width=Math.max(300,targetW)+'px';
    }else{
     picture.style.width=zoomFactor!==1?(zoomFactor*100)+'%':'100%';
    }
    img.style.transform=rotateDeg?`rotate(${rotateDeg}deg)`:'';
   };
   const zoom=button(t('Ingrandisci originale','Enlarge original'),()=>{
    zoomed=!zoomed;zoomFactor=1;
    applyScale();
    zoom.textContent=zoomed?t('Adatta originale','Fit original'):t('Ingrandisci originale','Enlarge original');
    zoom.setAttribute('aria-pressed',String(zoomed));
   });
   zoom.setAttribute('aria-pressed','false');
   const zoomOut=button('−',()=>{zoomFactor=Math.max(.7,zoomFactor-.25);applyScale()});
   zoomOut.setAttribute('aria-label',t('Riduci zoom','Zoom out'));
   const zoomIn=button('+',()=>{zoomed=true;zoom.textContent=t('Adatta originale','Fit original');zoom.setAttribute('aria-pressed','true');zoomFactor=Math.min(2.5,zoomFactor+.25);applyScale()});
   zoomIn.setAttribute('aria-label',t('Aumenta zoom','Zoom in'));
   const rotBtn=button('↻',()=>{rotateDeg=(rotateDeg+90)%360;applyScale()});
   rotBtn.title=t('Ruota anteprima di 90°','Rotate preview 90°');rotBtn.setAttribute('aria-label',rotBtn.title);

   const overlay={input:e('input'),label:e('label','ocr-check')};
   overlay.input.type='checkbox';overlay.label.append(overlay.input,document.createTextNode(t('Evidenzia righe','Show lines')));
   overlay.input.addEventListener('change',()=>boxes.hidden=!overlay.input.checked);

   const text=e('textarea');text.id='nm-ocr-text';text.setAttribute('aria-label',t('Testo da controllare e correggere','Text to review and correct'));text.maxLength=C.MAX_TEXT;text.value=row.edited;
   for(const line of row.lines.slice(0,200)){
    const b=button(line.text,()=>{text.focus();const at=text.value.indexOf(line.text);if(at>=0)text.setSelectionRange(at,at+line.text.length);useRegion(line.box)});
    b.textContent='';b.title=line.text+(Number.isFinite(line.confidence)?` (${Math.round(line.confidence*100)}%)`:'');
    b.setAttribute('aria-label',line.text);
    if(Number.isFinite(line.confidence)&&line.confidence<.86)b.dataset.conf='low';
    const [x,y,w,h]=line.box;Object.assign(b.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});boxes.append(b);
   }

   const include={input:e('input'),label:e('label','ocr-check')};
   include.input.type='checkbox';include.input.checked=row.include;include.input.id='nm-ocr-include';
   include.label.append(include.input,document.createTextNode(t('Includi questa pagina','Include this page')));
   include.input.addEventListener('change',()=>{row.include=include.input.checked;changed()});

   const alertActions=e('div','ocr-actions');alertActions.id='nm-ocr-scientific-alerts';
   const warning=e('div','ocr-warning');warning.setAttribute('role','note');
   function warn(){
    const w=C.warnings({text:row.edited,lines:row.lines}),n=Q.numericReview(row.edited,row.nativeText),parts=[];
    if(row.blank)parts.push(t('L’immagine della pagina risulta completamente bianca (nessun testo visibile).','The rendered page looks completely blank (no visible ink detected).'));
    if(w.empty)parts.push(t('Nessun testo riconosciuto: trascrivilo o escludi la pagina.','No readable text: transcribe it or exclude the page.'));
    if(w.units.length)parts.push(t('Verifica le unità: ','Check units: ')+w.units.join(' · '));
    const names={ 'ambiguous-digit':t('Cifre ambigue','Ambiguous digits'),'decimal-separator':t('Separatore decimale da verificare','Check decimal separator'),'dose-unit':t('Dose o unità','Dose or unit'),'ambiguous-unit':t('Simbolo ambiguo','Ambiguous symbol'),'scientific-symbol':t('Simbolo o formula da verificare','Check scientific symbol or formula'),'differs-from-source':t('Diverso dal testo selezionabile originale','Differs from original selectable text')};
    for(const kind of Object.keys(names)){const values=[...new Set(n.alerts.filter(a=>a.kind===kind).map(a=>a.value))];if(values.length)parts.push(names[kind]+': '+values.slice(0,8).join(' · '))}
    if(n.partial)parts.push(t('Elenco numerico parziale: controlla tutta la fonte.','Numeric list is partial: check the entire source.'));
    if(w.lowConfidence)parts.push(t('Alcune righe richiedono particolare attenzione.','Some lines need closer attention.'));
    if(row.processing?.orientationHint?.axis==='vertical')parts.push(t('Possibile testo ruotato: confronta l’originale e rileggi una zona se necessario.','Text may be rotated: compare the original and reread an area if needed.'));
    if(row.orderPartial)parts.push(t('Pagina complessa: ordine del motore mantenuto. Prova una zona più piccola.','Complex page: engine order retained. Try a smaller area.'));
    else if(row.orderAmbiguous)parts.push(t('Ordine ambiguo: prova Due colonne o Righe e tabella confrontando l’originale.','Ambiguous order: compare Two columns or Rows and table with the original.'));
    parts.push(t('Nessun numero viene corretto automaticamente.','Numbers are never corrected automatically.'));warning.textContent=parts.join(' · ');alertActions.replaceChildren();const indexes=new Set();for(const a of n.alerts){if(indexes.has(a.index)||a.kind==='differs-from-source'||indexes.size>=6||text.value.slice(a.index,a.index+a.value.length)!==a.value)continue;indexes.add(a.index);alertActions.append(button(t('Controlla: ','Review: ')+a.value,()=>{text.focus();text.setSelectionRange(a.index,a.index+a.value.length)}))}
   }
   text.addEventListener('input',()=>{row.edited=text.value;row.structure=null;drawStructure();changed();warn()});warn();

   const leftHead=e('div','ocr-pane-head');
   leftHead.append(e('strong','',t('Originale · pagina ','Original · page ')+row.page),zoom);
   const leftTools=e('div','ocr-inspector-toolbar'),leftGroup=e('div','ocr-tool-group'),rightGroup=e('div','ocr-tool-group');
   const quickDrawBtn=button(t('Seleziona zona','Select area'),()=>{regional.open=true;drawButton.click()});
   leftGroup.append(zoomOut,zoomIn,rotBtn,quickDrawBtn);
   rightGroup.append(overlay.label);
   leftTools.append(leftGroup,rightGroup);
   left.append(leftHead,leftTools,viewport);

   const layout=e('label','ocr-layout-control'),layoutSelect=e('select');layoutSelect.id='nm-ocr-order';
   for(const [value,it,en] of [['auto','Automatico · prudente','Automatic · conservative'],['engine','Ordine del motore','Engine order'],['columns','Due colonne','Two columns'],['rows','Righe e tabella','Rows and table']]){const o=e('option','',t(it,en));o.value=value;layoutSelect.append(o)}
   layout.append(e('span','ocr-field-label',t('Ordine del testo','Text reading order')),layoutSelect);layoutSelect.value=row.readingChoice||'auto';layoutSelect.disabled=!!controller;
   layoutSelect.addEventListener('change',async()=>{
    const selected=layoutSelect.value,old=row.readingChoice||'auto';
    if(row.edited!==(row.projectedText??row.text)){
     const answer=await app.nmAsk({title:t('Ricalcolare l’ordine?','Recalculate reading order?'),message:t('Il nuovo ordine sostituirà le correzioni manuali di questa pagina.','The new order will replace manual edits on this page.'),choices:[{value:'cancel',text:t('Mantieni correzioni','Keep edits')},{value:'apply',text:t('Applica nuovo ordine','Apply new order')}]});
     if(answer!=='apply'){layoutSelect.value=old;return}
    }
    try{const out=Q.readingOrder(row.lines,{mode:selected});row.readingChoice=selected;row.orderAmbiguous=out.ambiguous;row.orderPartial=!!out.partial;row.orderMode=out.mode;row.projectedText=out.text;row.edited=out.text;row.orderedLines=out.lines;row.structure=S.analyze(out.text,out.lines);text.value=out.text;drawStructure();changed();warn()}catch(error){layoutSelect.value=old;status.textContent=localizeError(error)}
   });
   const title=field(t('Titolo del ramo · modificabile','Branch title · editable'),'text');title.input.id='nm-ocr-title';title.input.maxLength=100;title.input.value=row.title;title.input.addEventListener('input',()=>{row.title=title.input.value;changed()});
   const metaRow=e('div','ocr-meta-row');metaRow.append(title.label,layout);
   const rightHead=e('div','ocr-pane-head');
   rightHead.append(e('strong','',row.method==='native'?t('Testo selezionabile conservato','Preserved selectable text'):t('Testo riconosciuto · modificabile','Recognized text · editable')),include.label);

   // Adobe-class explicit text cleanup & export helpers (user-initiated only)
   const textBar=e('div','ocr-text-toolbar'),textBtns=e('div','ocr-tool-group');
   const cleanWrapBtn=button(t('Unisci sillabazioni e a capo','Clean line breaks'),()=>{
    const cleaned=text.value.replace(/([\p{L}])-\r?\n([\p{L}])/gu,'$1$2').replace(/([^\n.!?:\u2022])\r?\n([^\n\u2022\-*0-9])/gu,'$1 $2');
    text.value=cleaned;row.edited=cleaned;row.structure=null;drawStructure();changed();warn();
   });
   const copyBtn=button(t('Copia testo','Copy text'),async()=>{
    try{await navigator.clipboard?.writeText?.(text.value);copyBtn.textContent=t('Copiato ✓','Copied ✓');setTimeout(()=>{copyBtn.textContent=t('Copia testo','Copy text')},1500)}catch(_){}
   });
   const dlTxtBtn=button(t('Esporta .txt','Save .txt'),()=>{
    const blob=new Blob([text.value],{type:'text/plain;charset=utf-8'});
    if(app.io?.triggerDownload)app.io.triggerDownload(blob,`pagina-${row.page}.txt`);
   });
   textBtns.append(cleanWrapBtn,copyBtn,dlTxtBtn);
   const charInfo=e('span','ocr-hint',`${text.value.length} ch`);
   textBar.append(textBtns,charInfo);

   right.append(rightHead,metaRow,warning,alertActions,textBar,text);
   if(row.nativeText&&row.method==='ocr'){const d=e('details'),pre=e('pre','',row.nativeText);d.append(e('summary','',t('Confronta il testo selezionabile originale','Compare original selectable text')),pre);right.append(d)}
   const original=e('details'),raw=e('pre','',row.rawText??row.text);original.id='nm-ocr-original-text';original.append(e('summary','',t('Testo originale non modificato','Unmodified original text')),raw);right.append(original);
   const structure=e('details','ocr-structure');structure.id='nm-ocr-structure';const structureSummary=e('summary','',t('Struttura del documento · proposta modificabile','Document structure · editable proposal')),structureBody=e('div'),rebuild=button(t('Ricalcola proposta dal testo corrente','Rebuild proposal from current text'),()=>{row.structure=S.analyze(row.edited,row.orderedLines||row.lines);drawStructure();changed()});rebuild.id='nm-ocr-structure-build';structure.append(structureSummary,e('p','ocr-hint',t('Titoli, livelli, paragrafi ed elenchi: controlla la proposta prima di includerla nella mappa. Le formule restano testo da verificare.','Headings, levels, paragraphs and lists: review before including in the map. Formulas remain text requiring review.')),rebuild,structureBody);right.append(structure);
   function drawStructure(){
    charInfo.textContent=`${countWords(text.value)} w · ${text.value.length} ch`;
    structureBody.replaceChildren();const proposal=row.structure;
    if(!proposal||proposal.text!==row.edited){structureBody.append(e('p','ocr-warning',t('Testo modificato: ricalcola e ricontrolla la struttura.','Text changed: rebuild and review the structure.')));return}
    if(proposal.partial){structureBody.append(e('p','ocr-warning',t('Struttura troppo complessa: importa il testo della pagina senza struttura.','Structure is too complex: import page text without structure.')));return}
    if(!proposal.geometry)structureBody.append(e('p','ocr-hint',t('Geometria non allineata al testo: solo regole testuali, nessuna gerarchia tipografica presunta.','Geometry does not align with text: text-only rules, no assumed typographic hierarchy.')));
    for(const b of proposal.blocks){const box=e('div','ocr-block'),role=e('select'),level=e('input'),label=e('input');role.setAttribute('aria-label',t('Tipo di blocco','Block type'));for(const [v,it,en]of [['heading','Titolo','Heading'],['paragraph','Paragrafo','Paragraph'],['list','Elenco','List'],['table','Tabella · testo','Table · text']]){const o=e('option','',t(it,en));o.value=v;role.append(o)}role.value=b.role;level.type='number';level.min='1';level.max='3';level.value=b.level||'';level.placeholder='—';level.disabled=b.role!=='heading';level.setAttribute('aria-label',t('Livello del titolo','Heading level'));label.value=b.title;label.maxLength=100;label.setAttribute('aria-label',t('Titolo del ramo proposto','Proposed branch title'));label.title=b.text;
     role.addEventListener('change',()=>{b.role=role.value;b.level=b.role==='heading'?1:0;level.disabled=b.role!=='heading';level.value=b.level||'';changed()});level.addEventListener('change',()=>{const n=Number(level.value);if(!Number.isInteger(n)||n<1||n>3){level.value=b.level||'';return}b.level=n;changed()});label.addEventListener('input',()=>{b.title=label.value;changed()});box.append(role,level,label);structureBody.append(box)}
   }
   drawStructure();
   const regional=e('details','ocr-region-tools');regional.id='nm-ocr-region';
   const summary=e('summary','',t('Rileggi una zona difficile','Reread a difficult area')),instructions=e('p','ocr-hint',t('Premi Seleziona zona e trascina sull’originale, oppure indica le percentuali. La nuova lettura resta separata finché scegli di usarla sul testo selezionato.','Press Select area and drag on the original, or enter percentages. The new reading stays separate until you choose to use it on selected text.'));
   const fields=e('div','ocr-region-fields'),inputs=[];let crop=[0,0,1,1],drawing=null,candidate=null,validCrop=true,drawMode=false;
   const selection=e('div','ocr-selection');selection.hidden=true;picture.append(selection);
   const regionStatus=e('p','ocr-hint'),result=e('textarea');result.readOnly=true;result.id='nm-ocr-region-result';result.hidden=true;result.setAttribute('aria-label',t('Nuova lettura della zona','New area reading'));
   const replace=button(t('Usa sul testo selezionato','Use on selected text'),()=>{
    const start=text.selectionStart,end=text.selectionEnd;
    if(!candidate||text.value!==candidate.before||start===end){regionStatus.textContent=t('Seleziona le parole da sostituire; se il testo è cambiato, rileggi la zona.','Select the words to replace; if the text changed, reread the area.');return}
    const next=text.value.slice(0,start)+candidate.text+text.value.slice(end);if(next.length>C.MAX_TEXT){regionStatus.textContent=t('Il risultato supera il limite della pagina.','The result exceeds the page limit.');return}
    text.setRangeText(candidate.text,start,end,'select');row.edited=text.value;row.structure=null;drawStructure();row.regionEdits=(row.regionEdits||0)+1;candidate=null;replace.disabled=true;changed();warn();regionStatus.textContent=t('Inserito nel testo. Controlla la pagina prima di importare.','Inserted into the text. Review the page before importing.');
   });replace.id='nm-ocr-region-use';replace.disabled=true;
   const drawButton=button(t('Seleziona zona sull’originale','Select area on original'),()=>{drawMode=!drawMode;picture.classList.toggle('ocr-selecting',drawMode);drawButton.setAttribute('aria-pressed',String(drawMode));quickDrawBtn.setAttribute('aria-pressed',String(drawMode))});drawButton.id='nm-ocr-region-draw';drawButton.setAttribute('aria-pressed','false');
   const reread=button(t('Rileggi questa zona','Reread this area'),readRegion,'ocr-primary');reread.id='nm-ocr-region-read';reread.disabled=!!controller;
   function selectedText(){replace.disabled=!!controller||!candidate||text.value!==candidate.before||text.selectionStart===text.selectionEnd}
   text.addEventListener('select',selectedText);text.addEventListener('input',selectedText);
   function drawCrop(invalidate=true){
    if(invalidate){candidate=null;replace.disabled=true;result.hidden=true;}
    try{crop=Q.region(inputs.map(n=>Number(n.value)/100));validCrop=true;selection.hidden=false;Object.assign(selection.style,{left:crop[0]*100+'%',top:crop[1]*100+'%',width:crop[2]*100+'%',height:crop[3]*100+'%'});reread.disabled=!!controller;regionStatus.textContent=''}catch{validCrop=false;reread.disabled=true;regionStatus.textContent=t('La zona deve rientrare nella pagina e avere dimensioni positive.','The area must fit inside the page and have positive dimensions.')}
   }
   for(const [index,it,en] of [[0,'Da sinistra (%)','From left (%)'],[1,'Dall’alto (%)','From top (%)'],[2,'Larghezza (%)','Width (%)'],[3,'Altezza (%)','Height (%)']]){
    const box=field(t(it,en),'number');box.input.min=index<2?'0':'.5';box.input.max='100';box.input.step='.1';box.input.value=String(crop[index]*100);box.input.id='nm-ocr-crop-'+index;box.input.addEventListener('input',drawCrop);inputs.push(box.input);fields.append(box.label);
   }
   regional.append(summary,instructions,drawButton,fields,reread,regionStatus,result,replace);left.append(regional);
   syncReview=()=>{drawButton.disabled=!!controller;reread.disabled=!!controller||!validCrop;layoutSelect.disabled=!!controller;rebuild.disabled=!!controller;structureBody.querySelectorAll('input,select').forEach(n=>n.disabled=!!controller||(n.type==='number'&&n.parentElement.querySelector('select').value!=='heading'));for(const input of inputs)input.disabled=!!controller;selectedText()};
   function useRegion(b){const x=Math.max(0,b[0]-.008),y=Math.max(0,b[1]-.008),next=[x,y,Math.min(1-x,b[2]+.016),Math.min(1-y,b[3]+.016)];next.forEach((v,i)=>inputs[i].value=String(Math.round(v*10000)/100));regional.open=true;drawCrop()}
   syncReview();
   regional.addEventListener('toggle',()=>{if(!regional.open){drawMode=false;drawButton.setAttribute('aria-pressed','false');quickDrawBtn.setAttribute('aria-pressed','false')}picture.classList.toggle('ocr-selecting',regional.open&&drawMode);selection.hidden=!regional.open;if(regional.open)drawCrop(false)});
   const point=event=>{const rect=img.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))]};
   picture.addEventListener('pointerdown',event=>{if(!regional.open||!drawMode||controller||event.button!==0||event.target.closest('button'))return;event.preventDefault();drawing=point(event);picture.setPointerCapture(event.pointerId)});
   picture.addEventListener('pointermove',event=>{if(!drawing)return;const end=point(event),next=[Math.min(drawing[0],end[0]),Math.min(drawing[1],end[1]),Math.abs(end[0]-drawing[0]),Math.abs(end[1]-drawing[1])];next.forEach((v,i)=>inputs[i].value=String(Math.round(v*10000)/100));drawCrop()});
   const endDraw=()=>{drawing=null;drawMode=false;picture.classList.remove('ocr-selecting');drawButton.setAttribute('aria-pressed','false');quickDrawBtn.setAttribute('aria-pressed','false')};picture.addEventListener('pointerup',endDraw);picture.addEventListener('pointercancel',endDraw);
   async function readRegion(){
    if(controller||reread.disabled||!file)return;const token=++epoch,before=text.value;controller=new AbortController();const signal=controller.signal;
    consent.input.checked=false;candidate=null;replace.disabled=true;result.hidden=true;
    fileInput.disabled=range.input.disabled=force.input.disabled=enhance.input.disabled=run.disabled=select.disabled=reread.disabled=layoutSelect.disabled=true;cancel.disabled=false;text.readOnly=true;progress.hidden=false;progress.value=0;delete status.dataset.error;update();
    status.textContent=t('Rileggo la zona sul dispositivo…','Rereading the area on this device…');
    try{
     const out=await root.NeuroMapOCR.reread(file,row.page,crop,{signal,enhance:enhance.input.checked,onProgress:p=>{if(token===epoch)progress.value=Math.max(0,Math.min(1,Number(p.progress)||0))}});
     if(token!==epoch)return;if(out.source.sha256!==source.sha256)throw Error('Source changed');
     candidate=out.text.trim()?{before,text:out.text}:null;result.value=out.text;result.hidden=false;regionStatus.textContent=out.text?t('Confronta la nuova lettura. Seleziona nel testo il passaggio da sostituire.','Compare the new reading. Select the passage to replace in the text.'):t('Nessun testo leggibile nella zona.','No readable text in this area.');
     const checks=Q.numericReview(out.text).alerts;if(checks.length)regionStatus.textContent+=' '+t('Controlla numeri e unità: ','Check numbers and units: ')+[...new Set(checks.map(a=>a.value))].slice(0,6).join(' · ');
     status.textContent=t('Zona riletta: nessuna sostituzione automatica.','Area reread: no automatic replacement.');progress.value=1;
    }catch(error){if(token===epoch){status.dataset.error='true';status.textContent=signal.aborted?t('Rilettura interrotta. Il testo è invariato.','Rereading stopped. Text is unchanged.'):t('Rilettura non riuscita: ','Rereading failed: ')+localizeError(error)}}
    finally{if(token===epoch){controller=null;fileInput.disabled=range.input.disabled=force.input.disabled=enhance.input.disabled=run.disabled=select.disabled=reread.disabled=false;layoutSelect.disabled=!!controller;cancel.disabled=true;text.readOnly=false;update();selectedText()}}
   }
   if(row.processing?.angle||row.processing?.contrast)right.append(e('small','ocr-hint',t('OCR su copia ottimizzata; l’originale mostrato è invariato.','OCR used an optimized copy; the displayed original is unchanged.')));
   review.append(left,right);
   update();
  }
  select.addEventListener('change',showPage);
  fileInput.addEventListener('change',async()=>{
   const selected=fileInput.files?.[0];if(!selected)return;if(!await askDiscard()){fileInput.value='';return}
   epoch++;const pickToken=epoch;if(peekTimer){clearTimeout(peekTimer);peekTimer=0}peekController?.abort();peekController=null;controller?.abort();controller=null;file=selected;meta=null;results=[];source=null;dirty=false;cache.clear();
   review.replaceChildren();select.replaceChildren();pageBar.hidden=true;consent.input.checked=false;progress.hidden=true;delete status.dataset.error;setupDetails.open=true;
   dropzone.classList.add('ocr-dropzone-ready');
   dropTitle.textContent=file.name;
   setupStatusPill.textContent=file.name;
   dropMeta.textContent=formatBytes(file.size)+' · '+t('Lettura info PDF…','Reading PDF details…');
   dropBtnVisual.textContent=t('Cambia PDF','Change PDF');
   bookmarksRow.hidden=true;bookmarksRow.replaceChildren();
   status.textContent=file.name+' ('+formatBytes(file.size)+')';run.disabled=false;cancel.disabled=true;update();
   if(typeof root.NeuroMapPdfJs?.peek==='function'){
    peekTimer=setTimeout(async()=>{
     peekTimer=0;
     if(pickToken!==epoch||file!==selected||controller)return;
     peekController=new AbortController();
     try{
      const info=await root.NeuroMapPdfJs.peek(file,{signal:peekController.signal});
      if(pickToken!==epoch||file!==selected)return;
      meta=info;
      setupStatusPill.textContent=`${file.name} · ${info.totalPages} p.`;
      dropMeta.textContent=`${formatBytes(file.size)} · ${info.totalPages} ${t('pagine rilevate','pages detected')} · ${t('pronto','ready')}`;
      const allBtn=presetRefs.find(([k])=>k==='all')?.[1];
      if(allBtn)allBtn.textContent=t('Tutte','All')+' ('+info.totalPages+')';
      if(Array.isArray(info.outline)&&info.outline.length){
       bookmarksRow.hidden=false;
       bookmarksRow.append(e('span','ocr-hint',t('Indice PDF:','Bookmarks:')));
       info.outline.slice(0,5).forEach((mark,idx)=>{
        const nextMark=info.outline[idx+1];
        const endPage=nextMark&&nextMark.page>mark.page?Math.min(info.totalPages,nextMark.page-1):mark.page;
        const rangeStr=endPage>mark.page?(mark.page+'-'+endPage):String(mark.page);
        const chip=button(mark.title.slice(0,26)+(mark.title.length>26?'…':'')+' ('+rangeStr+')',()=>{range.input.value=rangeStr});
        bookmarksRow.append(chip);
       });
      }
     }catch(_){
      if(pickToken===epoch&&file===selected)dropMeta.textContent=formatBytes(file.size)+' · '+t('pronto per la lettura','ready to read');
     }finally{if(pickToken===epoch)peekController=null}
    },120);
   }
  });
  async function start(){
   if(!file||controller)return;
   if(!await askDiscard())return;
   if(peekTimer){clearTimeout(peekTimer);peekTimer=0}
   peekController?.abort();peekController=null;
   const token=++epoch;controller=new AbortController();const signal=controller.signal;results=[];select.replaceChildren();pageBar.hidden=true;review.replaceChildren();dirty=false;consent.input.checked=false;delete status.dataset.error;
   fileInput.disabled=range.input.disabled=force.input.disabled=enhance.input.disabled=run.disabled=true;cancel.disabled=false;progress.hidden=false;progress.value=0;update();
   try{
    const out=await root.NeuroMapOCR.analyze(file,range.input.value,{force:force.input.checked,enhance:enhance.input.checked,signal,cache,
     onProgress:p=>{if(token!==epoch)return;progress.value=((p.index-1)+(p.phase==='ocr'?Math.min(.95,Number(p.progress)||0):0))/p.total;status.textContent=t('Lettura pagina ','Reading page ')+p.page+' · '+p.index+'/'+p.total;},
     onPage:(item,src)=>{if(token!==epoch)return;source=src;const row={...item,structure:item.structure?JSON.parse(JSON.stringify(item.structure)):null,edited:item.text,projectedText:item.text,readingChoice:'auto',title:C.suggestedTitle(item.text,item.page,t('Pagina','Page')),include:!!item.text.trim()};results.push(row);dirty=true;const option=e('option','',t('Pagina ','Page ')+item.page+' · '+(item.method==='ocr'?'OCR':t('testo esistente','existing text')));option.value=results.length-1;select.append(option);pageBar.hidden=false;if(results.length===1){setupDetails.open=false;select.value='0';showPage()}else update()}
    });
    if(token!==epoch)return;source=out.source;if(out?.source)meta=out.source;progress.value=1;
    status.textContent=t('Lettura completata. Confronta e correggi prima di importare.','Reading complete. Compare and correct before importing.');
   }catch(error){
    if(token!==epoch)return;
    status.dataset.error='true';
    status.textContent=signal.aborted
     ?t('Interrotto. Le pagine completate restano da verificare.','Stopped. Completed pages remain available for review.')
     :t('Lettura non riuscita: ','Reading failed: ')+localizeError(error);
   }finally{if(token===epoch){controller=null;fileInput.disabled=range.input.disabled=force.input.disabled=enhance.input.disabled=run.disabled=false;cancel.disabled=true;update()}}
  }
  function commit(){
   if(apply.disabled||!live())return;
   try{
    const included=results.filter(r=>r.include),rootNode=C.outline(included,source,consent.input.checked,{pageLabel:t('Pagina','Page'),title:t('Testo da ','Text from ')+source.fileName});
    if(structured.input.checked)rootNode.children.forEach((page,i)=>page.children=S.children(included[i].structure,included[i].edited,page));
    const all=[],todo=[rootNode];while(todo.length){const node=todo.pop();all.push(node);todo.push(...node.children)}
    if((owner.getNodeCountIncludingCollapsed?owner.getNodeCountIncludingCollapsed():owner.getAllNodesIncludingCollapsed().length)+all.length>3500)throw Error(t('Limite di 3500 nodi raggiunto per questa mappa: importa meno pagine o crea una nuova scheda.','3500-node limit reached for this map: import fewer pages or open a new tab.'));
    let id=0;const styleKeys=['color','colorIndex','fontSize','fontWeight','fontItalic','labelAlign','labelWrapChars'];
    for(const n of all){n.id='ocr-preview-'+(++id);n.side=parent.side==='left'?'left':'right';for(const key of styleKeys)if(parent[key]!==undefined)n[key]=parent[key]}
    app.pasteSelection({kind:'nodes',nodes:[rootNode],images:[],relationships:[]});dirty=false;void close();
   }catch(error){status.dataset.error='true';status.textContent=t('Importazione non riuscita: ','Import failed: ')+String(error.message||error)}
  }
 }
 if(menu)launch.addEventListener('click',open);
 shade.addEventListener('click',event=>{if(event.target===shade)void close()});
 shade.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();void close()}if(event.key==='Tab'){
  const items=[...pane.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])')].filter(n=>n.getClientRects().length),first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }});
 app._nmOCR={open,close};
}
if(!root.GlaukaMobile){
 if(typeof NeuroMapApp!=='undefined'){const previous=NeuroMapApp.prototype.bindUI;NeuroMapApp.prototype.bindUI=function(...args){const r=previous.apply(this,args);mount(this);return r}}
 if(document.readyState==='complete')mount(root.neuroMapApp);else root.addEventListener('load',()=>mount(root.neuroMapApp),{once:true});
}
root.NeuroMapOCRUI=Object.freeze({mount});
})(globalThis);
