/* Outline ↔ canvas and Atlas of OPEN tabs. All structural edits use
 * NeuroMap's existing state machine and undo path, never a shadow tree. */
(function(root){
 'use strict';
 const K=root.NeuroMapKnowledgeCore,D=root.NeuroMapDocumentView;
 if(!K)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const glyphShapes={
  outline:['M8 6h13','M8 12h13','M8 18h13','M3 6h1','M3 12h1','M3 18h1'],
  atlas:['M4 4h6v16H4z','M10 4h6v16h-6z','M16 4h4v16h-4z'],
  journey:['M4 5h5v5h6v5h5','M4 5v3','M20 15v4','M16 19h4'],
  radar:['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20','M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12','M12 10v4','M10 12h4'],
  sources:['M10 13a5 5 0 0 0 7 .3l2-2a5 5 0 0 0-7-7l-1.1 1.1','M14 11a5 5 0 0 0-7-.3l-2 2a5 5 0 0 0 7 7l1.1-1.1'],
  document:['M6 3h9l4 4v14H6z','M14 3v5h5','M9 12h7','M9 16h7']
 };
 function glyph(mode){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  for(const d of glyphShapes[mode]||glyphShapes.outline){
   const p=document.createElementNS(ns,'path');p.setAttribute('d',d);svg.append(p);
  }
  return svg;
 }
 const css=`
 #nm-knowledge-panel{position:fixed;left:12px;top:108px;bottom:18px;width:min(420px,calc(100vw - 24px));z-index:450;
 display:flex;flex-direction:column;gap:9px;padding:12px;color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));
 background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
 box-shadow:var(--nm-ui-shadow,0 18px 48px rgba(15,23,42,.2));border-radius:16px;font:13px var(--font-sans,Inter,system-ui,sans-serif);overscroll-behavior:contain;overflow:hidden}
 #nm-knowledge-panel:not(.nm-panel-frame):not(.nm-panel-compact){overflow-y:auto;scrollbar-gutter:stable}
 #nm-knowledge-panel[hidden]{display:none!important}
 #nm-knowledge-panel *,#nm-knowledge-panel *::before,#nm-knowledge-panel *::after{box-sizing:border-box}
 #nm-knowledge-panel button{cursor:pointer;color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));
 border-radius:9px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));min-height:32px;padding:6px 9px;min-width:0;max-width:100%;overflow-wrap:anywhere;white-space:normal;line-height:1.35;font-weight:600}
 #nm-knowledge-panel button:hover{border-color:var(--nm-theme-focus,#7c5ce7)}
 #nm-knowledge-panel button:focus-visible,#nm-knowledge-panel input:focus-visible{outline:2px solid var(--nm-theme-focus,#7c5ce7);outline-offset:2px}
 .nm-kn-header,.nm-kn-tools,.nm-kn-tabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
 .nm-kn-header{min-height:44px}
 .nm-kn-header-icon{display:grid;place-items:center;width:18px;height:18px;flex:0 0 18px;color:var(--nm-ui-accent,var(--nm-theme-action,#5b3fd0))}
 .nm-kn-header-icon svg{width:18px;height:18px}
 .nm-kn-header strong{font-weight:700;flex:1;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .nm-kn-back-bar{display:flex;align-items:center;gap:6px;flex:none}
 .nm-kn-back-bar[hidden]{display:none!important}
 #nm-knowledge-panel .nm-kn-back-study{display:inline-flex;align-items:center;gap:6px;width:100%;justify-content:flex-start;min-height:34px!important;padding:5px 10px!important;border-radius:10px!important;font-size:12px!important;font-weight:700!important;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 10%,var(--nm-skin-top,#f4f6fc))!important;border-color:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 28%,var(--nm-skin-stroke,#d7deed))!important;color:var(--nm-theme-action,#5b3fd0)!important}
 .nm-kn-picker{flex:none}
 .nm-kn-picker>summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 11px;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));border-radius:10px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));font-size:12px;font-weight:650}
 .nm-kn-picker[open]{padding:9px;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));border-radius:12px;background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff))}
 .nm-kn-picker[open]>summary{margin-bottom:8px}
 .nm-kn-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 .nm-kn-tab-copy{display:grid;gap:1px;min-width:0;text-align:left;flex:1}
 .nm-kn-tab-hint{display:block;font-size:10.5px;line-height:1.25;font-weight:450;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .nm-kn-tabs button{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:8px;
 min-height:42px!important;padding:7px 8px!important;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed))!important;
 border-radius:10px!important;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc))!important;
 font-size:12px;font-weight:650;transition:background .15s,border-color .15s}
 .nm-kn-tabs button .nm-kn-tab-icon{width:24px;height:24px;flex:0 0 24px;border-radius:7px;display:grid;place-items:center;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 11%,transparent);color:var(--nm-theme-action,#5b3fd0)}
 .nm-kn-tabs button svg{width:14px;height:14px;display:block}
 .nm-kn-tab-label{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;line-height:1.2}
 .nm-kn-intro-example{font-size:11px!important;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))!important;border-top:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));padding-top:6px!important;margin-top:6px!important}
 #nm-knowledge-panel>.nm-kn-intro,#nm-knowledge-panel>.nm-kn-header,#nm-knowledge-panel>.nm-kn-tools,#nm-knowledge-panel>.nm-kn-query{flex-shrink:0}
 .nm-kn-picker>summary:focus-visible{outline:2px solid var(--nm-theme-focus,#7c5ce7);outline-offset:2px}
 .nm-kn-tabs button[aria-selected="true"]{background:var(--nm-theme-action,#5b3fd0)!important;
 border-color:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important}
 .nm-kn-tabs button[aria-selected="true"] .nm-kn-tab-icon{background:rgba(255,255,255,.18)!important;color:#fff!important}
 .nm-kn-tabs button[aria-selected="true"] svg,.nm-kn-tabs button[aria-selected="true"] .nm-kn-tab-hint,.nm-kn-tabs button[aria-selected="true"] .nm-kn-tab-label{color:var(--nm-theme-on-action,#ffffff)!important;opacity:.96}
 .nm-kn-tabs button:hover:not([aria-selected="true"]){background:var(--nm-navigation-hover,color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 10%,var(--nm-skin-top,#f4f6fc)))!important}
 .nm-kn-picker-extra{margin-top:8px;padding-top:8px;border-top:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));display:grid;gap:5px}
 .nm-kn-picker-extra-title{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}
 .nm-kn-picker-extra-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 .nm-kn-picker-extra-grid button{font-size:11.5px;min-height:34px;padding:6px 8px;text-align:left}
 #nm-knowledge-panel .nm-kn-help-toggle{flex:0 0 32px;width:32px;height:32px;min-height:32px;
 border-radius:9px;border-color:var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));font-size:14px;font-weight:800;color:var(--nm-theme-action,#5b3fd0)}
 #nm-knowledge-panel .nm-kn-help-toggle[aria-expanded="true"]{background:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important}
 .nm-kn-intro{display:flex;gap:10px;align-items:flex-start;padding:10px 11px;border-radius:12px;
 border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 24%,var(--nm-skin-stroke,#d7deed));
 background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 7%,var(--nm-skin-top,#f4f6fc))}
 .nm-kn-intro-icon{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:10px;
 color:var(--nm-theme-action,#5b3fd0);background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 12%,var(--nm-skin-surface,#fff));
 border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 24%,transparent)}
 .nm-kn-intro-icon svg{width:20px;height:20px}
 .nm-kn-intro-copy{flex:1;min-width:0}
 .nm-kn-intro-copy strong{font-size:12px;display:block;color:var(--nm-skin-ink,var(--nm-ui-ink,#141926))}
 .nm-kn-intro-copy p{font-size:11.5px;line-height:1.45;margin:3px 0 0;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));overflow-wrap:anywhere}
 .nm-kn-guide{display:grid;gap:5px;min-width:0;max-height:160px;overflow-y:auto;padding:11px 12px;
 border-radius:11px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed))}
 .nm-kn-guide[hidden]{display:none!important}
 .nm-kn-guide p{margin:0;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));font-size:12px;line-height:1.5}
 .nm-kn-guide strong{font-size:12px;color:var(--nm-skin-ink,var(--nm-ui-ink,#141926))}
 .nm-kn-section-label{display:block;color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));font-weight:700;font-size:12px;margin:4px 0 0}
 .nm-kn-chapters{display:grid;gap:5px;min-width:0}
 #nm-knowledge-panel .nm-kn-chapter{display:block;width:100%;max-width:100%;text-align:left;
 overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;padding:9px 11px;
 border-radius:9px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc))}
 #nm-knowledge-panel .nm-kn-chapter[aria-pressed="true"]{border-color:var(--nm-theme-action,#5b3fd0)!important;background:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important}
 .nm-kn-doc-count{font-size:11px;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}
 .nm-kn-document-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 #nm-knowledge-panel .nm-kn-document-actions button{min-height:39px;padding:8px 6px}
 #nm-knowledge-panel .nm-kn-document-actions button:first-child{background:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important;border-color:var(--nm-theme-action,#5b3fd0)!important}
 #nm-knowledge-panel .nm-kn-document-actions button:last-child{grid-column:1 / -1}
 @media(max-width:370px){.nm-kn-tabs,.nm-kn-picker-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

 .nm-kn-query{box-sizing:border-box;width:100%;min-height:36px;border-radius:10px;padding:7px 11px;
 color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed))}
 .nm-kn-scroll{min-height:260px;flex:1 1 auto;overflow:auto;overscroll-behavior:contain;border-radius:11px;
 border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));position:relative}
 .nm-radar-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
 .nm-radar-head strong{font-size:12.5px;font-weight:750}
 .nm-radar-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
 .nm-radar-kpi{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px;min-height:0!important;padding:7px 8px!important;border-radius:10px!important;background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff))!important;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed))!important;text-align:left!important;transition:border-color .15s,background .15s}
 .nm-radar-kpi strong{font-size:15px;line-height:1.1;font-variant-numeric:tabular-nums;font-weight:800}
 .nm-radar-kpi span{font-size:10.5px;line-height:1.2;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));font-weight:600}
 .nm-radar-kpi[data-tone="due"] strong{color:#d97706!important}
 .nm-radar-kpi[data-tone="scheduled"] strong{color:var(--nm-theme-action,#5b3fd0)!important}
 .nm-radar-kpi[data-tone="reviewed"] strong{color:#059669!important}
 .nm-radar-kpi[data-active="true"]{border-color:var(--nm-theme-action,#5b3fd0)!important;box-shadow:0 0 0 1px var(--nm-theme-action,#5b3fd0)!important;background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 8%,var(--nm-skin-surface,#ffffff))!important}
 .nm-radar-strip{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 24%,var(--nm-skin-stroke,#d7deed))}
 .nm-radar-strip-copy{min-width:0;flex:1 1 130px;display:grid;gap:1px}
 .nm-radar-strip-copy strong{font-size:11.5px;font-weight:700}
 .nm-radar-strip-copy small{font-size:11px;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));line-height:1.3}
 .nm-radar-strip-actions{display:flex;gap:6px;flex-wrap:wrap}
 .nm-radar-strip-actions button{min-height:29px!important;padding:4px 9px!important;font-size:11.5px!important;border-radius:8px!important}
 .nm-radar-list{display:grid;gap:6px}
 .nm-radar-card{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px;width:100%;min-height:0!important;padding:8px 10px!important;border-radius:10px!important;background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff))!important;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed))!important;text-align:left!important}
 .nm-radar-card:hover{border-color:var(--nm-theme-focus,#7c5ce7)!important}
 .nm-radar-card-main{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
 .nm-radar-dot{width:8px;height:8px;flex:0 0 8px;border-radius:999px;background:var(--nm-skin-muted,#94a3b8)}
 .nm-radar-card[data-status="due"] .nm-radar-dot{background:#d97706}
 .nm-radar-card[data-status="scheduled"] .nm-radar-dot{background:var(--nm-theme-action,#5b3fd0)}
 .nm-radar-card[data-status="reviewed"] .nm-radar-dot{background:#059669}
 .nm-radar-card-text{display:grid;gap:1px;min-width:0}
 .nm-radar-card-text strong{font-size:12.5px;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .nm-radar-card-text small{font-size:11px;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));line-height:1.25}
 .nm-radar-badge{flex:none;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}
 .nm-radar-card[data-status="due"] .nm-radar-badge{background:color-mix(in srgb,#f59e0b 14%,transparent);border-color:color-mix(in srgb,#f59e0b 45%,transparent);color:#b45309!important}
 .nm-radar-card[data-status="scheduled"] .nm-radar-badge{background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 12%,transparent);border-color:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 35%,transparent);color:var(--nm-theme-action,#5b3fd0)!important}
 .nm-radar-card[data-status="reviewed"] .nm-radar-badge{background:color-mix(in srgb,#10b981 12%,transparent);border-color:color-mix(in srgb,#10b981 35%,transparent);color:#047857!important}
 body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .nm-radar-kpi[data-tone="due"] strong,
 body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .nm-radar-card[data-status="due"] .nm-radar-badge{color:#fbbf24!important}
 body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .nm-radar-kpi[data-tone="scheduled"] strong,
 body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .nm-radar-card[data-status="scheduled"] .nm-radar-badge{color:#a78bfa!important}
 body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .nm-radar-kpi[data-tone="reviewed"] strong,
 body:is([data-nm-skin="slate"],[data-nm-skin="graphite"],[data-nm-skin="midnight"],[data-nm-skin="cobalt"]) .nm-radar-card[data-status="reviewed"] .nm-radar-badge{color:#34d399!important}
 @media(max-width:390px){.nm-radar-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 .nm-kn-row{position:absolute;left:0;right:0;height:36px;display:flex;align-items:center;gap:3px;
 white-space:nowrap;box-sizing:border-box;border-bottom:1px solid color-mix(in srgb,var(--nm-skin-stroke,#d7deed) 55%,transparent);padding-right:5px}
 .nm-kn-row[data-active="true"]{background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 14%,transparent)}
 .nm-kn-row .nm-kn-text{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
 border:0!important;background:transparent!important}
 .nm-kn-row .nm-kn-disclose{width:28px;flex:none;border:0!important;background:transparent!important;padding:0!important}
 .nm-kn-row .nm-kn-edit{width:100%;min-width:10px;color:inherit;background:var(--nm-skin-surface,#fff);border:1px solid var(--nm-theme-focus,#7c5ce7);border-radius:6px;padding:6px}
 .nm-kn-results{display:flex;flex-direction:column;gap:7px;padding:10px}
 .nm-kn-bridge{display:grid;gap:7px;padding:10px;border-radius:10px;
 background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));border:1px solid color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 26%,var(--nm-skin-stroke,#d7deed))}
 .nm-kn-bridge-actions{display:flex;flex-wrap:wrap;gap:6px}
 .nm-kn-bridge-primary{background:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important;border-color:var(--nm-theme-action,#5b3fd0)!important}
 .nm-kn-hit{display:flex;gap:6px;align-items:center;padding:6px 4px;border-bottom:1px solid color-mix(in srgb,var(--nm-skin-stroke,#d7deed) 55%,transparent)}
 .nm-kn-hit .nm-kn-name{flex:1;min-width:0;text-align:left}
 .nm-kn-hit small{display:block;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));font-size:11px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
 .nm-kn-muted{font-size:11.5px;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680));margin:2px 0;padding:0 2px}
 @media(max-width:700px){#nm-knowledge-panel{left:5px;right:5px;top:72px;bottom:5px;width:auto;border-radius:12px}}
 @media(prefers-reduced-motion:reduce){#nm-knowledge-panel *{transition:none!important;animation:none!important}}
 `;
 function install(App){
  const prior=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=prior.apply(this,args);mount(this);return result};
  const closeTab=App.prototype.closeTab;
  App.prototype.closeTab=async function(id=this.activeTabId,...args){
   if(this._nmKnowledge?.ownsDraft(id)&&!await this._nmKnowledge.confirmDraft())return false;
   return closeTab.call(this,id,...args);
  };
  for(const name of ['markChanged','selectNode','activateTab','undo','redo','renderTabBar']){
   const original=App.prototype[name];if(typeof original!=='function')continue;
   App.prototype[name]=function(...args){const value=original.apply(this,args);if(this._nmKnowledge?.visible)this._nmKnowledge.request();return value};
  }
 }
 function mount(app){
  if(app._nmKnowledge)return;
  const style=create('style');style.textContent=css;document.head.append(style);
  const host=create('section');host.id='nm-knowledge-panel';host.hidden=true;
  host.setAttribute('role','complementary');host.classList.add('nm6-skiptranslate');
  const catalog=root.NeuroMapWorkspaceTools?.labels||{};
  const header=create('div','nm-kn-header'),headerIcon=create('span','nm-kn-header-icon'),heading=create('strong','','Glauka');
  headerIcon.setAttribute('aria-hidden','true');headerIcon.append(glyph('outline'));
  const close=create('button','', '×');close.type='button';close.title=tr('Chiudi pannello','Close panel');
  close.setAttribute('aria-label',tr('Chiudi pannello','Close panel'));
  const helpToggle=create('button','nm-kn-help-toggle','?');helpToggle.type='button';
  helpToggle.title=tr('Guida a questi strumenti','Guide to these tools');
  helpToggle.setAttribute('aria-label',tr('Mostra o nascondi la guida','Show or hide help'));
  helpToggle.setAttribute('aria-expanded','false');
  header.append(headerIcon,heading,helpToggle,close);
  const backBar=create('div','nm-kn-back-bar');backBar.hidden=true;
  const backBtn=create('button','nm-kn-back-study',tr('← Torna a Studia la mappa','← Back to Study the map'));
  backBtn.type='button';backBtn.id='nm-kn-back-study';
  backBar.append(backBtn);
  const picker=create('details','nm-kn-picker'),pickerLabel=create('summary');picker.id='nm-kn-tool-picker';pickerLabel.id='nm-kn-picker-label';
  const tabs=create('div','nm-kn-tabs');
  const extra=create('div','nm-kn-picker-extra');
  const extraTitle=create('span','nm-kn-picker-extra-title',tr('Studio rapido','Quick study'));
  const extraGrid=create('div','nm-kn-picker-extra-grid');
  const extraActions=[
   ['Studia la mappa','Study the map',()=>{closePanel();app._nmLearning?.open?.()}],
   ['Ripassa su immagini','Study with images',()=>{closePanel();app._nmVisualStudy?.open?.()}]
  ];
  const extraButtons=extraActions.map(([it,en,fn])=>{
   const b=create('button','',tr(it,en));b.type='button';
   b.addEventListener('click',()=>{picker.open=false;fn()});
   extraGrid.append(b);return {b,it,en};
  });
  extra.append(extraTitle,extraGrid);
  picker.append(pickerLabel,tabs,extra);
  const outlineBtn=create('button','','Outline'),atlasBtn=create('button','','Atlas'),
   journeyBtn=create('button','','Journey'),radarBtn=create('button','','Radar'),
   sourcesBtn=create('button','','Sources'),documentBtn=create('button','','Document');
  tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',tr('Strumenti per le mappe','Map tools'));
  const tabDetails=[
   [outlineBtn,'outline','#59c7f7','Modifica nodi e struttura','Edit nodes and map structure'],
   [atlasBtn,'atlas','#ae94f7','Cerca collegamenti tra mappe','Discover links across maps'],
   [journeyBtn,'journey','#71dba4','Leggi i concetti in sequenza','Read concepts in sequence'],
   [radarBtn,'radar','#ffba6b','Controlla i ripassi registrati','Inspect recorded reviews'],
   [sourcesBtn,'sources','#73d1e7','Consulta fonti e riferimenti','Inspect sources and references'],
   [documentBtn,'document','#8eabff','Scrivi capitoli sincronizzati con i nodi','Edit chapters synced with nodes']
  ];
  for(const [b,key,color,it,en] of tabDetails){
   const label=b.textContent;b.type='button';b.setAttribute('role','tab');
   b.setAttribute('aria-label',label);b.title=tr(it,en);b.dataset.mode=key;
   b.style.setProperty('--tab-accent',color);
   const copy=create('span','nm-kn-tab-copy');copy.append(create('span','nm-kn-tab-label',label),create('span','nm-kn-tab-hint'));
   const iconBadge=create('span','nm-kn-tab-icon');iconBadge.setAttribute('aria-hidden','true');iconBadge.append(glyph(key));
   b.replaceChildren(iconBadge,copy);tabs.append(b);
  }
  const intro=create('div','nm-kn-intro'),introIcon=create('span','nm-kn-intro-icon'),
   introCopy=create('div','nm-kn-intro-copy'),introTitle=create('strong'),
   introText=create('p'),introExample=create('p','nm-kn-intro-example'),helpContent=create('div','nm-kn-guide');
  const example=create('details','nm-kn-example'),exampleLabel=create('summary');example.append(exampleLabel,introExample);
  introCopy.append(introTitle,introText,example);intro.append(introIcon,introCopy);
  helpContent.id='nm-kn-mode-guide';helpContent.hidden=true;
  helpToggle.setAttribute('aria-controls',helpContent.id);
  const tools=create('div','nm-kn-tools'),query=create('input','nm-kn-query'),scroll=create('div','nm-kn-scroll');
  query.type='search';query.autocomplete='off';query.placeholder=tr('Cerca nodi, anche nei rami chiusi…','Find nodes, including collapsed…');
  const status=create('div','nm-kn-muted');status.setAttribute('aria-live','polite');
  host.append(header,backBar,picker,intro,helpContent,query,tools,scroll,status);document.body.append(host);
  let mode='outline',rows=[],activeFilter='',radarStatusFilter='all',frame=0,editing=null,selectedSource=null,atlasIndex=null,atlasResults=[],semanticKind='correlato',helpOpen=false,documentSearch='',fromStudySession=false;
  backBtn.addEventListener('click',()=>{closePanel();app._nmLearning?.open?.()});
  let draftActions=null;
  const hasDraft=()=>!!editing&&!!draftActions?.changed();
  const notifyOwner=(owner,tab)=>{if(app.state===owner&&app.activeTabId===tab)app.markChanged();else{owner.isDirty=true;app._desktopUserEdited=true;app.scheduleSave?.();app.renderTabBar?.();}};
  const confirmDraft=async()=>{
   if(!hasDraft())return true;
   const answer=await app.nmAsk({title:tr('Modifiche non salvate','Unsaved changes'),message:tr('Salvare le modifiche prima di uscire?','Save changes before quitting?'),choices:[{value:'save',text:tr('Salva','Save'),primary:true},{value:'discard',text:tr('Scarta','Discard'),danger:true},{value:'cancel',text:tr('Continua a modificare','Continue editing')}]});
   if(answer==='save')return draftActions.save()===true;
   if(answer==='discard'){draftActions.discard();return true;}
   host.hidden=false;state.visible=true;editing?.focus();return false;
  };
  // Preserve the first-run explanation, but free list space on future visits.
  // The existing ? button can always reveal both the summary and full guide.
  const guideKey='nm.knowledge.guideSeen.v1';
  let guideSeen=false;
  try { guideSeen=localStorage.getItem(guideKey)==='1'; } catch (_) {}
  const modeGuides={
   outline:['Organizza la mappa','Organize your map',
    'Crea, rinomina e riordina i rami senza perdere il collegamento con la mappa.',
    'Add, rename and rearrange branches while staying synced with the map.',
    'Seleziona un ramo, poi usa + Sottoramo, + Stesso livello o Rinomina. Doppio clic per modificare il testo.',
    'Select a branch, then use + Sub-branch, + Same level or Rename. Double-click to edit.',
    'La selezione e le modifiche agiscono sui nodi originali; Ctrl+Z annulla le operazioni.',
    'Selection and edits use original nodes; Ctrl+Z undoes changes.'],
   atlas:['Collega idee tra mappe','Connect ideas across maps',
    'Trova nodi nelle tue schede e nei documenti già indicizzati.',
    'Find nodes across tabs and previously indexed documents.',
    'Cerca un termine, apri un risultato o scegli Collega per creare un riferimento.',
    'Search a term, open a result or choose Link to create a reference.',
    'I documenti chiusi sono istantanee: riapri l’originale per verificare le modifiche.',
    'Closed documents are snapshots: reopen the original to check updates.'],
   journey:['Leggi senza distrazioni','Read without distractions',
    'Trasforma i rami in un percorso di lettura, un concetto alla volta.',
    'Read your branches as a sequence, one concept at a time.',
    'Usa le frecce per avanzare, poi Vai al nodo originale per tornare sulla mappa.',
    'Use the arrows to advance, then Go to original node to return to the map.',
    'L’avanzamento viene salvato localmente, senza duplicare i contenuti.',
    'Progress is saved locally; content is never duplicated.'],
   radar:['Capisci cosa ripassare','Know what to review',
    'Visualizza i ripassi realmente registrati e i concetti senza dati.',
    'See actual recorded reviews and concepts without review data.',
    'Controlla Da ripassare e Programmate; scegli un concetto per tornare al nodo.',
    'Check Due and Scheduled, then select a concept to return to its node.',
    'Il radar non inventa percentuali di apprendimento: si basa sulle sessioni registrate.',
    'Radar does not invent mastery percentages; it uses recorded study sessions.'],
   sources:['Ritrova le tue fonti','Find your sources',
    'Consulta documenti e riferimenti utili a verificare ciò che studi.',
    'Inspect documents and references to verify what you study.',
    'Seleziona un nodo con un riferimento e apri la pagina del documento originale.',
    'Select a node with a reference and open the original document page.',
    'Controlla sempre la fonte originale prima di considerare corretta un’informazione.',
    'Always check the original source before trusting extracted information.'],
   document:['Scrivi sulla tua mappa','Write on your map',
    'Ogni capitolo corrisponde a un nodo reale: non si creano copie.',
    'Each chapter is a real map node: no duplicate document is created.',
    'Cerca un capitolo, modifica Titolo o Testo / Markdown e premi Salva capitolo.',
    'Find a chapter, edit Title or Text / Markdown and choose Save chapter.',
    'Salvataggio atomico; puoi annullare con Ctrl+Z. Esporta JSONL è solo testo, non un backup .neuromap.',
    'Atomic save with Ctrl+Z undo. JSONL export is text only, not a .neuromap backup.']
  };
  function renderGuide(){
   const g=modeGuides[mode];if(!g)return;
   introIcon.replaceChildren(glyph(mode));
   const entry=catalog[mode];
   introTitle.textContent=tr('Quando ti serve','When to use it');introText.textContent=entry?tr(entry[3],entry[4]):tr(g[2],g[3]);
   introExample.textContent=entry?tr(entry[5],entry[6]):'';introExample.hidden=!introExample.textContent;
   exampleLabel.textContent=tr('Mostra un esempio','Show an example');
   pickerLabel.textContent=tr('Cambia strumento','Change tool');
   backBtn.textContent=tr('← Torna a Studia la mappa','← Back to Study the map');
   backBar.hidden=!fromStudySession;
   extraTitle.textContent=tr('Studio rapido','Quick study');
   for(const item of extraButtons)item.b.textContent=tr(item.it,item.en);
   for(const [button,key] of tabDetails){const item=catalog[key];if(!item)continue;
    const name=tr(item[1],item[2]);button.querySelector('.nm-kn-tab-label').textContent=name;
    button.querySelector('.nm-kn-tab-hint').textContent=tr(item[3],item[4]);button.setAttribute('aria-label',name);button.title=tr(item[3],item[4]);
   }
   helpContent.replaceChildren(create('strong','',tr('Come si usa','How to use')),
     create('p','',tr(g[4],g[5])),create('p','',tr(g[6],g[7])));
   helpContent.hidden=!helpOpen;intro.hidden=guideSeen&&!helpOpen;
   helpToggle.setAttribute('aria-expanded',String(helpOpen));
  }
  helpToggle.addEventListener('click',()=>{helpOpen=!helpOpen;renderGuide()});
  const state=app._nmKnowledge={visible:false,request(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(state.visible)refresh()})}};
  root.NeuroMapLifecycle?.registerDraft?.({hasPending:hasDraft,confirmClose:confirmDraft});
  function isEditing(){return hasDraft()}
  function setMode(next){if(isEditing()){status.textContent=tr('Salva o annulla le modifiche prima di cambiare strumento.','Save or discard edits before changing tools.');return false}mode=next;query.value='';activeFilter='';scroll.scrollTop=0;picker.open=false;refresh();return true}
  function open(next='outline',opts={}){
   fromStudySession=Boolean(opts&&opts.fromStudy);
   if(hasDraft()){if(root.NeuroMapWorkspaceLayout?.claim(app,'knowledge')===false)return;host.hidden=false;state.visible=true;host._nmExpandPanel?.();status.textContent=tr('Salva o annulla le modifiche prima di cambiare strumento.','Save or discard edits before changing tools.');editing.focus();return}
   editing=null;
   if(root.NeuroMapWorkspaceLayout?.claim(app,'knowledge')===false)return;
   host.hidden=false;state.visible=true;setMode(next);
   (query.hidden?pickerLabel:query)?.focus({preventScroll:true});
  }
  function closePanel(){
   fromStudySession=false;
   if(!hasDraft()){editing=null;draftActions=null;}
   state.visible=false;host.hidden=true;
   if(!guideSeen){
    guideSeen=true;
    try { localStorage.setItem(guideKey,'1'); } catch (_) {}
   }
  }
  close.addEventListener('click',closePanel);
  outlineBtn.addEventListener('click',()=>setMode('outline'));atlasBtn.addEventListener('click',()=>setMode('atlas'));
  journeyBtn.addEventListener('click',()=>setMode('journey'));radarBtn.addEventListener('click',()=>setMode('radar'));
  sourcesBtn.addEventListener('click',()=>setMode('sources'));
  documentBtn.addEventListener('click',()=>setMode('document'));
  query.addEventListener('input',()=>{activeFilter=query.value;scroll.scrollTop=0;state.request()});
  host.addEventListener('keydown',e=>{if(e.key==='Escape'&&!editing){e.stopPropagation();closePanel()}});
  // Do not allow editor shortcuts (Delete, typing, Tab, Space) to affect underlying nodes.
  host.addEventListener('keydown',e=>e.stopPropagation());
  const viewMenu=document.getElementById('dropdown-view');
  if(viewMenu){
   const o=create('button','dropdown-item',tr('Outline bidirezionale…','Two-way Outline…'));
   const a=create('button','dropdown-item',tr('Atlas · biblioteca persistente…','Atlas · persistent library…'));
   const lens=create('button','dropdown-item',tr('Source Lens · fonti…','Source Lens · sources…'));
   const j=create('button','dropdown-item',tr('Knowledge Journey…','Knowledge Journey…'));
   const m=create('button','dropdown-item',tr('Memory Radar…','Memory Radar…'));
   const d=create('button','dropdown-item',tr('Documento sincronizzato…','Synced document…'));
   o.id='nm-tool-outline';a.id='nm-tool-atlas';j.id='nm-tool-journey';m.id='nm-tool-memory';lens.id='nm-tool-sources';d.id='nm-tool-document';
   o.type=a.type=j.type=m.type=lens.type=d.type='button';viewMenu.append(o,a,j,m,lens,d);
   lens.addEventListener('click',e=>{e.stopPropagation();app.hideMenus?.();open('sources')});
   j.addEventListener('click',e=>{e.stopPropagation();app.hideMenus?.();open('journey')});
   m.addEventListener('click',e=>{e.stopPropagation();app.hideMenus?.();open('radar')});
   d.addEventListener('click',e=>{e.stopPropagation();app.hideMenus?.();open('document')});
   o.addEventListener('click',e=>{e.stopPropagation();app.hideMenus?.();open('outline')});
   a.addEventListener('click',e=>{e.stopPropagation();app.hideMenus?.();open('atlas')});
   root.NeuroMapWorkspaceLocale?.bind?.(o,'Outline bidirezionale…','Two-way Outline…');
   root.NeuroMapWorkspaceLocale?.bind?.(a,'Atlas · biblioteca persistente…','Atlas · persistent library…');
   root.NeuroMapWorkspaceLocale?.bind?.(lens,'Source Lens · fonti…','Source Lens · sources…');
   root.NeuroMapWorkspaceLocale?.bind?.(j,'Knowledge Journey…','Knowledge Journey…');
   root.NeuroMapWorkspaceLocale?.bind?.(m,'Memory Radar…','Memory Radar…');
   root.NeuroMapWorkspaceLocale?.bind?.(d,'Documento sincronizzato…','Synced document…');
  }
  tabs.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();const buttons=tabDetails.map(([b])=>b),index=buttons.indexOf(document.activeElement);
   const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+buttons.length)%buttons.length;
   buttons[next].focus();
  });
  root.NeuroMapWorkspaceLocale?.watch(()=>{if(state.visible)state.request()});
  const tool=(label,fn)=>{const b=create('button','',label);b.type='button';b.addEventListener('click',fn);tools.append(b);return b};
  function select(id){app.selectNode(id);state.request()}
  function beginEdit(row,button){
   if(editing)return;
   const ownerState=app.state,ownerTabId=app.activeTabId,outlineBody=button.closest?.('.nm-kn-virtual');
   const input=create('input','nm-kn-edit');input.type='text';input.maxLength=10000;input.value=row.text;
   button.replaceWith(input);editing=input;let done=false;
   const finish=save=>{if(done)return;done=true;editing=null;draftActions=null;
    // A tab switch can fire blur AFTER another document became active.
    // Resolve the original state by identity: IDs may be shared across files.
    const sourceStillOpen=app.tabs.some(t=>t.id===ownerTabId&&t.state===ownerState);
    if(save && sourceStillOpen && input.value.trim() &&
      ownerState.updateNodeText(row.id,input.value.trim())){
      if(app.state===ownerState && app.activeTabId===ownerTabId)app.markChanged();
      else{ownerState.isDirty=true;app._desktopUserEdited=true;app.scheduleSave?.();}
      app.renderTabBar?.();
    }
    if(outlineBody)outlineBody._nmOutlineSignature=null;
    state.request();
   };
   draftActions={tab:ownerTabId,owner:ownerState,changed:()=>input.value.trim()!==row.text,save:()=>{finish(true);return true},discard:()=>finish(false)};
   input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(true)}
    else if(e.key==='Escape'){e.preventDefault();finish(false)}});
   input.addEventListener('blur',()=>finish(true));input.focus();input.select();
  }
  function editSelected(){const id=app.state.selectedNodeId,r=rows.find(x=>x.id===id);
   if(!r)return;const button=scroll.querySelector('.nm-kn-row[data-node-id="'+CSS.escape(id)+'"] .nm-kn-text');
   if(button)beginEdit(r,button);
   else{const n=app.state.findNode(id);if(n){app.editSelected();}}
  }
  function addChild(){
   if(mode!=='outline')return;
   app.closeEditor(true);
   const parent=app.state.selectedNodeId||app.state.root.id;
   const node=app.state.addChildNode(parent,app.layout);
   if(node){app.markChanged();app.selectNode(node.id);state.request();app.showToast(tr('Sottoramo aggiunto · doppio clic per rinominare','Child added · double-click to rename'),'OUTLINE')}
  }
  function addSibling(){
   if(mode!=='outline')return;
   app.closeEditor(true);
   const node=app.state.addSiblingNode(app.state.selectedNodeId||app.state.root.id,app.layout);
   if(node){app.markChanged();app.selectNode(node.id);state.request()}
  }
  function editNotes(){
   if(mode!=='outline'||editing)return;
   const owner=app.state,tab=app.activeTabId,id=owner.selectedNodeId,node=owner.findNode(id);
   if(!node)return;
   const wrap=create('div','nm-kn-results'),field=create('textarea','nm-kn-query');
   field.rows=12;field.style.resize='vertical';field.style.minHeight='150px';field.value=node.notes||'';const originalNotes=field.value;
   const buttons=create('div','nm-kn-tools'),save=create('button','',tr('Salva note','Save notes')),
    cancel=create('button','',tr('Annulla','Cancel'));
   const discard=()=>{editing=null;draftActions=null;state.request()};
   const saveCurrent=()=>{
    if(!app.tabs.some(t=>t.id===tab&&t.state===owner))return false;
    const live=owner.findNode(id);if(!live)return false;
    const next=field.value.slice(0,50000);
    if(String(live.notes||'')!==originalNotes&&next!==String(live.notes||'')){status.textContent=tr('Il nodo è cambiato. Le modifiche agli appunti sono conservate.','The topic changed. Your note edits are preserved.');return false}
    editing=null;draftActions=null;
    if(next!==String(live.notes||'')){owner.pushHistory();live.notes=next;notifyOwner(owner,tab);}
    state.request();return true;
   };
   save.addEventListener('click',saveCurrent);
   draftActions={tab,owner,changed:()=>field.value!==originalNotes,save:saveCurrent,discard};
   cancel.addEventListener('click',discard);
   field.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();discard()}
   });
   buttons.append(save,cancel);
   wrap.append(create('strong','',tr('Note · nodo originale','Notes · original node')),field,buttons);
   scroll.replaceChildren(wrap);editing=field;field.focus();
  }
  async function removeSelected(){
   if(mode!=='outline')return;
   const id=app.state.selectedNodeId;
   if(!id||id===app.state.root.id)return;
   const ok=await app.nmAsk({title:tr('Eliminare il ramo?','Delete branch?'),
    message:tr('Elimina il ramo e i discendenti con immagini e relazioni. Ctrl+Z per annullare.','Delete branch and descendants with attachments. Undo with Ctrl+Z.'),
    choices:[{value:'no',text:tr('Annulla','Cancel')},{value:'yes',text:tr('Elimina','Delete'),danger:true}]});
   if(ok==='yes'){app.deleteSelected();state.request()}
  }
  async function jump(tabId,nodeId){
   const A=root.NeuroMapAtlasLibrary;
   let openTab=app.tabs.find(t=>t.id===tabId||(A&&A.idFor(t)===tabId));
   if(!openTab){
     const archived=(app._nmAtlasArchive||[]).find(x=>x.key===tabId);
     const native=root.neuromapDesktop;
     if(!archived||!native?.openProject){
       app.showToast(tr('Apri il progetto originale per visitare il nodo.','Open the original project to visit this node.'),'ATLAS');return;
     }
     const action=await app.nmAsk({title:'Atlas · '+tr('Documento chiuso','Closed document'),
       message:archived.title+' · '+archived.filePath+'\n'+tr(
         'Seleziona manualmente questo file per riaprirlo. Il contenuto indicizzato può essere precedente alle modifiche esterne.',
         'Select this file to reopen it. Indexed contents may be older than external edits.'),
       choices:[{value:'cancel',text:tr('Annulla','Cancel')},{value:'open',text:tr('Scegli file…','Choose file…'),primary:true}]});
     if(action!=='open')return;
     try{
       const payload=await native.openProject();
       if(payload?.cancelled)return;
       if(A.normalizedPath(payload?.path)!==A.normalizedPath(archived.filePath))
        throw Error(tr('Hai scelto un file differente dal documento indicizzato.',
                       'You selected a file different from this indexed document.'));
       await app.v6ImportNative(payload,true);
       openTab=app.tabs.find(t=>A.idFor(t)===tabId);
       if(!openTab)throw Error(tr('Impossibile associare la scheda al file.',
                                  'Could not match the reopened tab to the file.'));
     }catch(error){app.showToast(String(error.message||error),'ATLAS');return;}
   }
   if(!openTab.state?.findNode?.(nodeId)){
     app.showToast(tr('Il documento è stato modificato e il nodo non è più disponibile.',
                      'The document changed and the original node ID is no longer present.'),'ATLAS');
     return;
   }
   if(openTab.id!==app.activeTabId)app.activateTab(openTab.id);
   app.selectNode(nodeId);
   const loc=app.layout?.getLayout?.(nodeId);
   if(loc && app.renderer?.camera){
    // Camera uses CSS viewport units, not device-pixel canvas backing dimensions.
    app.renderer.camera.x=(app.canvas.clientWidth||innerWidth)/2-loc.x*app.renderer.camera.zoom;
    app.renderer.camera.y=(app.canvas.clientHeight||innerHeight)/2-loc.y*app.renderer.camera.zoom;
    app.requestRender();
   }
  }
/* @neuromap-knowledge-ui-draw */
  function refresh(){
   if(editing)return;
   const name=catalog[mode];heading.textContent=name?tr(name[1],name[2]):tr(modeGuides[mode][0],modeGuides[mode][1]);host.setAttribute('aria-label',heading.textContent);
   headerIcon.replaceChildren(glyph(mode));
   renderGuide();
   for(const [button,value] of [[outlineBtn,'outline'],[atlasBtn,'atlas'],[journeyBtn,'journey'],[radarBtn,'radar'],[sourcesBtn,'sources'],[documentBtn,'document']])
    button.setAttribute('aria-selected',String(mode===value));
   query.hidden=mode==='journey'||mode==='sources'||mode==='document';
   query.placeholder=mode==='atlas'?tr('Cerca in tutte le mappe indicizzate…','Search all indexed maps…'):mode==='radar'?tr('Cerca tra i concetti da ripassare…','Find concepts to review…'):tr('Cerca un ramo, anche se chiuso…','Find a branch, even if collapsed…');query.setAttribute('aria-label',query.placeholder);
   tools.replaceChildren();
   if(mode==='outline'){
    tool(tr('+ Sottoramo','+ Sub-branch'),addChild);tool(tr('+ Stesso livello','+ Same level'),addSibling);
    tool(tr('Rinomina','Rename'),editSelected);tool(tr('Note…','Notes…'),editNotes);
    tool('↑',()=>{app.nm69SwapSibling?.(-1);state.request()});
    tool('↓',()=>{app.nm69SwapSibling?.(1);state.request()});
    tool(tr('Elimina…','Delete…'),()=>void removeSelected());
    const before=rows.length;rows=K.outline(app.state.root,activeFilter);
    if(before!==rows.length)scroll.scrollTop=Math.min(scroll.scrollTop,Math.max(0,rows.length*36-scroll.clientHeight));
    drawOutline();
    status.textContent=rows.length+' '+tr('righe · selezione sincronizzata','rows · live selection')+(rows.length===K.MAX_NODES?' · '+tr('limite','limit'):'');
   }else if(mode==='document')drawDocument();
   else if(mode==='atlas'){
    atlasIndex=root.NeuroMapAtlasLibrary?root.NeuroMapAtlasLibrary.project(K,app.tabs,app._nmAtlasArchive):K.indexTabs(app.tabs);
    drawAtlas();
   }else if(mode==='journey')drawJourney();
   else if(mode==='radar')drawRadar();
   else if(mode==='sources')root.NeuroMapSourceUI?.draw?.({app,scroll,status,tools,request:state.request});
  }
  app._nmKnowledge.open=open;app._nmKnowledge.close=closePanel;app._nmKnowledge.hasDraft=hasDraft;app._nmKnowledge.confirmDraft=confirmDraft;app._nmKnowledge.ownsDraft=id=>hasDraft()&&draftActions?.tab===id;
 }
 root.NeuroMapKnowledgeUI=Object.freeze({install});
})(globalThis);
