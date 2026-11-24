const CSS=`
#nm-view-switch{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 8px;margin:6px 0;color:#e2e8f0;background:#172238;border:1px solid #475569;border-radius:12px;font:12px system-ui;max-width:100%;box-sizing:border-box}
#nm-view-switch label{white-space:nowrap;color:#cbd5e1}
.nm-quick-views{display:flex;align-items:center;gap:5px;min-width:0;max-width:100%;padding:4px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}
.nm-quick-views button{flex:0 0 auto;min-height:32px;padding:6px 9px;border-radius:9px;border:1px solid #4f6483;background:#1c2a42;color:#dce7f8;white-space:nowrap;font:600 11px system-ui;cursor:pointer}
.nm-quick-views button[aria-pressed="true"]{background:#463b85;border-color:#ada7fb;color:#fff}
.nm-quick-views button:hover{border-color:#9dadf1;background:#334369}
.nm-quick-views button:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}
#nm-view-dock-main{flex:1 1 480px}
#nm-view-dock-overlay{padding:5px 12px;background:#141f32;border-bottom:1px solid #334155;flex-shrink:0}

#nm-view-split{padding:6px 10px;min-height:32px;border:1px solid #7184a0;border-radius:8px;background:#283e5d;color:#f1f5f9;cursor:pointer;font:12px system-ui}
#nm-view-split[aria-pressed=true]{background:#423882;border-color:#a5b4fc}
.nm-layout-workspace{display:flex;flex:1 1 500px;align-items:center;gap:6px;flex-wrap:wrap;min-width:260px;padding:4px 6px;border:1px solid #425474;border-radius:10px;background:#111e34}
.nm-layout-workspace label{font:600 11px system-ui;color:#bac9e7}
.nm-layout-workspace select,.nm-layout-workspace input[type=text]{min-height:29px;box-sizing:border-box;padding:5px 7px;border-radius:7px;border:1px solid #5b7292;background:#1b2d48;color:#e8efff;font:11px system-ui}
.nm-layout-workspace select{flex:1;min-width:170px;max-width:220px}
.nm-layout-workspace input[type=text]{width:125px;min-width:95px}
.nm-layout-workspace button{min-height:29px;border:1px solid #607795;border-radius:7px;background:#2c4160;color:#f1f5ff;padding:5px 9px;font:600 11px system-ui;cursor:pointer}
.nm-layout-workspace button:hover{background:#415780}
.nm-layout-workspace button:focus-visible,.nm-layout-workspace select:focus-visible,.nm-layout-workspace input:focus-visible{outline:2px solid #a5b4fc;outline-offset:2px}
.nm-layout-workspace input[type=range]{width:85px;accent-color:#a5b4fc}
.nm-layout-workspace [hidden]{display:none!important}
#nm-view-split:disabled{opacity:.45;cursor:default}
#nm-view-focus{padding:6px 10px;min-height:32px;border:1px solid #7184a0;border-radius:8px;background:#283e5d;color:#f1f5f9;cursor:pointer;font:12px system-ui;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nm-view-focus[aria-pressed=true]{background:#423882;border-color:#a5b4fc}
#nm-view-focus:focus-visible{outline:2px solid #a5b4fc;outline-offset:2px}
#nm-view-overlay.nm-side-panel{left:auto;right:72px;width:min(var(--nm-split-width,50vw),calc(100vw - 86px),850px);top:86px;bottom:14px}
#nm-view-overlay.nm-side-panel .nm-view-header{padding:10px 12px;gap:8px}
#nm-view-overlay.nm-side-panel .nm-view-header .nm-view-hint{min-width:120px}
#nm-view-picker{max-width:178px;min-width:0;background:#101b30;color:#e2e8f0;border:1px solid #64748b;border-radius:8px;padding:6px 8px;font:12px system-ui}
#nm-view-picker:focus-visible,#nm-view-overlay button:focus-visible,#nm-view-overlay input:focus-visible{outline:2px solid #a5b4fc;outline-offset:2px}
#nm-view-overlay{position:fixed;inset:86px 72px 14px 14px;z-index:64;display:flex;flex-direction:column;overflow:hidden;color:#e2e8f0;background:#0d1627;border:1px solid #516079;border-radius:18px;box-shadow:0 28px 90px #000b;font:13px system-ui}
#nm-view-overlay[hidden]{display:none!important}
#nm-view-overlay .nm-view-controls{flex-shrink:0;max-height:60%;overflow:auto;overscroll-behavior:contain}
#nm-view-overlay .nm-view-header{display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid #334155;flex-wrap:wrap;background:#141f32}
#nm-view-overlay .nm-view-header strong{font-size:15px}
#nm-view-overlay .nm-view-header .nm-view-hint{font-size:11px;color:var(--nm-skin-muted,var(--nm-view-muted,#5c6b82));flex:1;min-width:180px}
#nm-view-overlay .nm-view-header button{background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#16243d);border:1px solid var(--nm-skin-stroke,#c5ceda);border-radius:9px;padding:8px 11px;cursor:pointer;white-space:nowrap}
#nm-view-overlay .nm-view-header button:hover{background:color-mix(in srgb,var(--nm-skin-surface,#ffffff) 88%,var(--nm-skin-ink,#16243d))}
#nm-view-scroller{flex:1;min-height:100px;overflow:auto;overscroll-behavior:contain;touch-action:none;background:radial-gradient(#33415566 1px,transparent 1px);background-size:28px 28px;container-type:inline-size}
#nm-linked-panels{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}
#nm-linked-panels>#nm-view-scroller{min-width:0;flex:1 1 auto}
#nm-dual-pane{display:flex;flex:0 0 50%;min-width:0;flex-direction:column;border-left:2px solid #51627e;background:#101c30;overflow:hidden}
#nm-dual-pane[hidden]{display:none!important}
#nm-dual-pane .nm-dual-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;flex-shrink:0;padding:9px 11px;background:#17263c;border-bottom:1px solid #334155}
#nm-dual-pane .nm-dual-toolbar strong{font:600 12px system-ui;color:#c7d2fe}
#nm-dual-pane .nm-dual-toolbar select,#nm-dual-pane .nm-dual-toolbar button{min-height:31px;border-radius:8px;border:1px solid #62799a;background:#20314c;color:#f1f5f9;padding:5px 7px;font:12px system-ui}
#nm-dual-pane .nm-dual-toolbar select{min-width:125px;flex:1}
#nm-dual-scroller{flex:1;min-width:0;min-height:80px;overflow:auto;overscroll-behavior:contain;touch-action:none;background:radial-gradient(#46587744 1px,transparent 1px);background-size:28px 28px}
#nm-dual-frame{position:relative}
#nm-dual-stage{position:relative;isolation:isolate;transform-origin:0 0}
#nm-dual-stage .nm-dual-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#nm-dual-stage .nm-view-card{min-width:30px}
#nm-dual-stage .nm-view-title{white-space:normal}
#nm-dual-pane .nm-dual-message{color:#c4d2e9;padding:16px;font:12px/1.5 system-ui}
#nm-dual-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 10px;background:#152238;border-bottom:1px solid #3f536f}
#nm-dual-tools[hidden],#nm-dual-tools .nm-dual-tool-group[hidden]{display:none!important}
#nm-dual-tools input,#nm-dual-tools select,#nm-dual-tools button{min-height:31px;box-sizing:border-box;border:1px solid #647995;border-radius:8px;background:#1d304c;color:#ecf3ff;font:11px system-ui;padding:5px 7px}
#nm-dual-tools select{max-width:190px;min-width:110px}
#nm-dual-tools input[type=date]{width:130px}
#nm-dual-tools input[type=text]{width:155px}
#nm-dual-tools button{background:#3d5082;cursor:pointer}
#nm-dual-tools .nm-dual-tool-group{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
@media(max-width:750px){#nm-linked-panels.nm-dual-active{flex-direction:column}#nm-dual-pane{flex:0 0 50%!important;border-left:0;border-top:2px solid #51627e}}
#nm-view-frame{position:relative}
#nm-view-stage{position:relative;isolation:isolate;transform-origin:0 0}
#nm-view-zoom{display:flex;gap:4px;align-items:center;padding:3px;border:1px solid #475569;border-radius:9px}
#nm-view-zoom button{min-width:30px;padding:6px 8px}
#nm-view-zoom-status{min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
#nm-view-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.nm-view-card{position:absolute;transform:translate(-50%,-50%);border:1.5px solid #7487a6;border-left:4px solid #818cf8;border-radius:12px;background:#1b2a40;color:#eff6ff;box-sizing:border-box;padding:9px 11px;text-align:left;box-shadow:0 8px 16px #0003;display:flex;align-items:center;gap:7px;cursor:pointer}
.nm-view-card:focus-visible,.nm-view-card[aria-selected=true]{outline:2px solid #a5b4fc;outline-offset:2px;background:#283955}
.nm-view-card.is-root{background:#282c63;border-color:#818cf8;border-left-color:#c084fc;font-weight:700}
.nm-view-card .nm-view-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-clamp:2;overflow:hidden;overflow-wrap:anywhere;flex:1;font:12px/1.4 system-ui}
.nm-view-card .nm-view-title[title]{cursor:text}
.nm-view-card.is-decision{position:absolute;isolation:isolate;justify-content:center;padding:18px 43px;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible}
.nm-view-card.is-decision::before,.nm-view-card.is-decision::after{content:'';position:absolute;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);pointer-events:none}
.nm-view-card.is-decision::before{inset:0;background:var(--nm-flow-decision-border,#fbbf24);z-index:-2}
.nm-view-card.is-decision::after{inset:4px;background:var(--nm-flow-decision-surface,#322c43);z-index:-1}
.nm-view-card.is-decision[aria-selected=true]::before,.nm-view-card.is-decision:focus-visible::before{filter:brightness(1.35)}
.nm-view-card.is-decision .nm-view-title{max-width:114px;text-align:center;font-weight:650;position:relative;z-index:1}
.nm-view-card.is-decision .nm-view-add{position:absolute;right:7px;top:calc(50% - 12px);z-index:2}
.nm-view-card.is-decision:focus-visible{outline:2px dashed #c4b5fd;outline-offset:3px}
/* Shared flow Input/Output presentation: exact slant matches flows.ioPoints()
   in thumbnail and SVG/PDF/PNG. Keep text horizontal and focus visible. */
.nm-view-card.is-flow-io{position:absolute;isolation:isolate;justify-content:center;
  padding:13px 29px;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible}
.nm-view-card.is-flow-io::before,.nm-view-card.is-flow-io::after{
  content:'';position:absolute;clip-path:polygon(12% 0,100% 0,88% 100%,0 100%);pointer-events:none}
.nm-view-card.is-flow-io::before{inset:0;background:var(--nm-flow-io-border,#60a5fa);z-index:-2}
.nm-view-card.is-flow-io::after{inset:4px;background:var(--nm-flow-io-surface,#1b2a40);z-index:-1}
.nm-view-card.is-flow-io[aria-selected=true]::before,.nm-view-card.is-flow-io:focus-visible::before{filter:brightness(1.3)}
.nm-view-card.is-flow-io .nm-view-title{max-width:144px;text-align:center;font-weight:650;position:relative;z-index:1}
.nm-view-card.is-flow-io .nm-view-add{position:absolute;right:3px;top:calc(50% - 12px);z-index:2}
.nm-view-card.is-flow-io:focus-visible{outline:2px dashed #c4b5fd;outline-offset:3px}
.nm-view-card.is-flow-terminal{border-radius:999px!important;padding:10px 21px;justify-content:center}
.nm-view-card.is-flow-terminal .nm-view-title{text-align:center;font-weight:650;max-width:128px}
.nm-view-card .nm-flow-role-label{position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:var(--nm-view-control,#253952);color:var(--nm-view-control-ink,#fff);border:1px solid var(--nm-view-control-edge,#aabbd3);border-radius:5px;white-space:nowrap;font:700 10px/1.1 system-ui;padding:2px 5px;pointer-events:none}
.nm-view-card.is-flow-terminal:focus-visible{outline-offset:3px}
.nm-view-card.is-flow-role-conflict{border-color:#f59e0b!important}
.nm-flow-role-warning{position:absolute;right:-2px;top:-9px;background:#f59e0b;color:#231a09;
  border:1px solid #ffedb4;border-radius:999px;min-width:19px;height:19px;
  display:flex;align-items:center;justify-content:center;font:800 12px system-ui;pointer-events:none}
#nm-flow-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:10px 14px;border-bottom:1px solid #334155;background:#151f33}
#nm-flow-toolbar[hidden]{display:none!important}
#nm-flow-toolbar label{display:flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1}
#nm-flow-toolbar select{max-width:205px;min-width:110px;background:#17263c;border:1px solid #5b6a87;color:#e2e8f0;padding:7px;border-radius:8px}
#nm-flow-toolbar button{background:#424a80;border:1px solid #7488aa;border-radius:8px;padding:8px 12px;color:white;cursor:pointer}
#nm-flow-toolbar button:disabled{opacity:.45;cursor:default}
#nm-flow-guide{display:flex;gap:7px;flex-direction:column;flex-basis:100%;padding:9px 11px;border:1px solid #6b658a;background:#24243d;border-radius:12px;box-sizing:border-box}
#nm-flow-guide[hidden]{display:none!important}
#nm-flow-guide .nm-flow-guide-heading{font-weight:650;color:#f1e9ff}
#nm-flow-guide .nm-flow-guide-note{font-size:12px;color:#d6cee5;line-height:1.45}
#nm-flow-guide select{max-width:100%;width:min(400px,100%)}
#nm-flow-guide .nm-flow-guide-items{max-height:160px;overflow:auto;display:flex;flex-direction:column;gap:5px;padding:6px 0}
#nm-flow-guide .nm-flow-guide-item{display:flex;align-items:center;gap:9px;border-radius:8px;padding:6px 8px;background:#192337}
#nm-flow-guide .nm-flow-guide-item input{accent-color:#a78bfa;flex-shrink:0}
#nm-flow-guide .nm-flow-guide-item span{overflow-wrap:anywhere}
#nm-flow-guide .nm-flow-guide-actions{display:flex;gap:7px;flex-wrap:wrap}
#nm-flow-list{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex-basis:100%;max-height:106px;overflow:auto;padding-top:4px;border-top:1px solid #334155}
#nm-flow-list:empty{display:none}
.nm-flow-pill{display:flex;align-items:center;gap:5px;max-width:265px;padding:4px 5px 4px 9px;border-radius:20px;background:var(--nm-view-control,#26364c);color:var(--nm-view-control-ink,inherit);border:1px solid var(--nm-view-control-edge,#546881)}
.nm-flow-pill span{max-width:205px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
#nm-flow-toolbar .nm-flow-remove{padding:1px 6px;min-width:22px;border:0;background:transparent;border-radius:50%;color:#fda4af;font-size:16px}
#nm-flow-toolbar .nm-flow-remove:hover{background:#7f283c;color:#fff}
#nm-network-toolbar{display:flex;align-items:center;gap:9px;padding:10px 14px;background:#18253a;flex-wrap:wrap;border-bottom:1px solid #334155}
#nm-network-toolbar[hidden]{display:none!important}
#nm-network-toolbar button{border-radius:9px;border:1px solid #7286a5;background:#364d77;color:#f1f5f9;padding:7px 11px;cursor:pointer}
#nm-network-toolbar button[aria-pressed=true]{background:#4c3b83;border-color:#c4b5fd}
#nm-network-toolbar input{border-radius:8px;border:1px solid #64748b;background:#101b30;color:#f1f5f9;padding:7px 9px;width:min(240px,45vw)}
#nm-network-status{color:#cbd5e1;font-size:12px;min-width:170px}
#nm-network-list{display:flex;flex-basis:100%;gap:5px;flex-wrap:wrap;max-height:86px;overflow:auto}
.nm-network-link-item{display:flex;align-items:center;gap:5px;font-size:11px;padding:3px 6px;border-radius:9px;background:var(--nm-view-control,#26364d);color:var(--nm-view-control-ink,inherit);border:1px solid var(--nm-view-control-edge,#546881)}
#nm-network-list .nm-network-remove{padding:0 6px;background:#4e2939;color:#fecdd3}
.nm-kanban-card{position:absolute;overflow:hidden;box-shadow:0 4px 11px #0002}
.nm-kanban-card::before{content:'';position:absolute;top:0;left:0;right:0;height:5px;background:var(--nm-kanban-status,#94a3b8);pointer-events:none}
.nm-kanban-card .nm-kanban-date{position:absolute;left:10px;right:10px;bottom:7px;border-top:1px solid #94a3b844;padding-top:4px;box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 10px/1.2 system-ui;text-align:center;color:inherit;opacity:.87;pointer-events:none}
.nm-work-column[data-status]{border-bottom:2px solid var(--nm-kanban-status,#94a3b8)}
#nm-dual-pane .nm-kanban-card select{position:absolute;bottom:26px;left:10px;right:10px;max-width:calc(100% - 20px);font-size:10px}
#nm-dual-pane .nm-kanban-card .nm-view-title{align-self:flex-start;margin-top:18px}
/* Feature-10 — Professional org-chart cards. Typography and avatar stay within
   the existing measured card box; source nodes remain unmodified. */
#nm-view-overlay .nm-view-card.nm-orgchart-card{
  position:absolute;isolation:isolate;overflow:hidden;gap:0;
  border:1px solid color-mix(in srgb,var(--nm-orgchart-band,var(--nm-orgchart-accent,#7287af)) 55%,var(--nm-view-control-edge,#7287af));
  border-left:1px solid color-mix(in srgb,var(--nm-orgchart-band,var(--nm-orgchart-accent,#7287af)) 55%,var(--nm-view-control-edge,#7287af));
  border-radius:var(--gv-radius-sm,12px);
  box-shadow:var(--gv-shadow-card,0 8px 22px #0003,0 1px 2px #0002);
  transition:box-shadow var(--gv-motion-normal,180ms) var(--gv-ease-out,ease),border-color var(--gv-motion-normal,180ms) var(--gv-ease-out,ease),opacity var(--gv-motion-fast,120ms) linear;
}
#nm-view-overlay .nm-orgchart-card:hover,
#nm-view-overlay .nm-orgchart-card:focus-visible{
  box-shadow:var(--gv-shadow-hover,0 12px 26px #0005);
  border-color:var(--nm-orgchart-band,#60a5fa);
}
#nm-view-overlay .nm-orgchart-card[aria-selected=true]{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px;
  box-shadow:var(--gv-shadow-hover,0 12px 26px #0005);
}
.nm-orgchart-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0;
  background:var(--nm-orgchart-band,var(--nm-orgchart-accent,#60a5fa));
  pointer-events:none;
}
#nm-view-overlay .nm-orgchart-card .nm-orgchart-mark{
  position:absolute;left:9px;top:15px;
  width:32px;height:32px;border-radius:50%;box-sizing:border-box;
  border:1px solid var(--nm-orgchart-band,#60a5fa);
  background:color-mix(in srgb,var(--nm-orgchart-band,#60a5fa) 18%,transparent);
  display:flex;align-items:center;justify-content:center;
  color:inherit;font:750 11px/1 system-ui;letter-spacing:.01em;
  flex:none;pointer-events:none;overflow:hidden;
}
#nm-view-overlay .nm-orgchart-card img.nm-orgchart-mark{
  display:block;object-fit:cover;object-position:center;
}
#nm-view-overlay .nm-orgchart-card .nm-view-title{
  position:absolute;top:12px;left:48px;right:36px;
  display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden;min-width:0;
  font-weight:650;line-height:1.22;word-break:break-word;
  max-height:33px;pointer-events:none;
}
#nm-view-overlay .nm-orgchart-card .nm-view-title[data-org-large-font=true]{
  top:17px;-webkit-line-clamp:1;line-clamp:1;max-height:24px;
}
#nm-view-overlay .nm-orgchart-card .nm-orgchart-meta{
  position:absolute;bottom:7px;left:48px;right:58px;
  color:inherit;opacity:.78;overflow:hidden;
  white-space:nowrap;text-overflow:ellipsis;
  font:500 10px/1.2 system-ui;pointer-events:none;
}
#nm-view-overlay .nm-orgchart-card .nm-view-add{
  position:absolute;right:5px;top:11px;
  width:28px;min-width:28px;min-height:28px;
  height:28px;border-radius:var(--gv-radius-xs,8px);z-index:2;
}
#nm-view-overlay .nm-orgchart-card .nm-view-collapse{
  position:absolute;right:5px;bottom:5px;
  width:28px;min-width:28px;min-height:28px;height:28px;
  border-radius:var(--gv-radius-xs,8px);z-index:2;
  opacity:.55;transition:opacity var(--gv-motion-normal,180ms) var(--gv-ease-out,ease),background var(--gv-motion-fast,120ms) linear;
}
#nm-view-overlay .nm-orgchart-card .nm-view-collapse.is-collapsed-persistent,
#nm-view-overlay .nm-orgchart-card:hover .nm-view-collapse,
#nm-view-overlay .nm-orgchart-card:focus-within .nm-view-collapse,
#nm-view-overlay .nm-orgchart-card .nm-view-collapse:focus-visible{opacity:1}
#nm-view-overlay .nm-orgchart-card .nm-view-collapse-chevron{
  display:inline-block;transition:transform var(--gv-motion-normal,180ms) var(--gv-ease-out,ease);
}
#nm-view-overlay .nm-orgchart-card .nm-view-collapse.is-collapsed .nm-view-collapse-chevron{
  transform:rotate(-90deg);
}
#nm-view-overlay .nm-hierarchy-hidden-badge{
  position:absolute;right:36px;bottom:8px;z-index:2;
  min-width:22px;height:18px;padding:0 5px;box-sizing:border-box;
  border-radius:999px;border:1px solid color-mix(in srgb,var(--nm-orgchart-band,#60a5fa) 55%,transparent);
  background:color-mix(in srgb,var(--nm-view-bar,#ffffff) 82%,var(--nm-orgchart-band,#60a5fa));
  color:inherit;font:700 10px/16px system-ui;text-align:center;pointer-events:none;
}
#nm-view-overlay .nm-orgchart-card.nm-orgchart-dimmed{
  opacity:.22;filter:saturate(.55);
}
#nm-view-overlay .nm-orgchart-card.nm-orgchart-dimmed:is(:focus-visible,[aria-selected=true]){
  opacity:1;filter:none;
}
/* Semantic zoom: at distant zoom, keep the title prominent; secondary
   metadata and decorative badges disappear rather than becoming noise. */
#nm-view-stage[data-org-detail=overview] .nm-orgchart-card .nm-orgchart-mark,
#nm-view-stage[data-org-detail=overview] .nm-orgchart-card .nm-orgchart-meta,
#nm-view-stage[data-org-detail=overview] .nm-orgchart-card .nm-hierarchy-hidden-badge,
#nm-dual-stage[data-org-detail=overview] .nm-orgchart-card .nm-orgchart-mark,
#nm-dual-stage[data-org-detail=overview] .nm-orgchart-card .nm-orgchart-meta,
#nm-dual-stage[data-org-detail=overview] .nm-orgchart-card .nm-hierarchy-hidden-badge{
  visibility:hidden;
}
#nm-view-stage[data-org-detail=overview] .nm-orgchart-card .nm-view-title,
#nm-dual-stage[data-org-detail=overview] .nm-orgchart-card .nm-view-title{
  left:11px;right:35px;top:19px;max-height:34px;
}
#nm-view-stage[data-org-detail=overview] .nm-orgchart-card .nm-view-collapse,
#nm-dual-stage[data-org-detail=overview] .nm-orgchart-card .nm-view-collapse{opacity:1}
@media (pointer:coarse){
  #nm-view-overlay .nm-orgchart-card .nm-view-collapse,
  #nm-view-overlay .nm-tree-card .nm-view-collapse{opacity:1}
}
#nm-view-overlay #nm-orgchart-search{
  box-sizing:border-box;min-width:16rem;width:16rem;
  max-width:16rem;height:34px;flex:0 0 auto;
  border:1px solid #657899;border-radius:9px;
  background:var(--nm-ui-surface,#16253c);color:var(--nm-ui-ink,#f0f5ff);
  padding:6px 11px;font:12px system-ui;
}
#nm-view-overlay #nm-orgchart-search:focus-visible{
  outline:2px solid #b8a3ff;outline-offset:2px;
}
#nm-view-overlay #nm-orgchart-search[hidden]{display:none!important}
@media(prefers-reduced-motion:reduce){
  #nm-view-overlay .nm-orgchart-card{transition:none}
}
.nm-tree-card::before{content:'';position:absolute;top:-4px;left:14px;width:min(96px,50%);height:4px;border-radius:4px;background:var(--nm-tree-group);pointer-events:none}
.nm-tree-card::after{content:attr(data-depth);position:absolute;right:2px;top:-10px;width:20px;height:20px;border-radius:50%;background:var(--nm-tree-group);border:2px solid color-mix(in srgb,var(--nm-view-bar,#14213a) 80%,#000);color:#102136;font:700 10px/20px system-ui;text-align:center;box-sizing:content-box;pointer-events:none}
.nm-tree-card[data-depth-long=true]::after{font-size:8px}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card{
  border-radius:10px;box-shadow:var(--gv-shadow-card);overflow:hidden;
  transition:box-shadow var(--gv-motion-normal) var(--gv-ease-out),border-color var(--gv-motion-normal) var(--gv-ease-out)
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card[data-tree-tier="root"],
#nm-view-overlay[data-view-mode="concept-tree"] .nm-view-card.is-root.nm-tree-card{
  border-width:2px;font-weight:700;box-shadow:var(--gv-shadow-hover)
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card[data-tree-tier="branch"] .nm-view-title{font-weight:650}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card[data-tree-tier="leaf"]{
  box-shadow:0 1px 4px rgba(10,18,35,.06)
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-mark{
  position:absolute;left:8px;top:50%;transform:translateY(-50%);
  width:26px;height:26px;border-radius:50%;box-sizing:border-box;
  border:1px solid var(--nm-tree-group,#38bdf8);
  background:color-mix(in srgb,var(--nm-tree-group,#38bdf8) 18%,transparent);
  display:flex;align-items:center;justify-content:center;
  font:700 10px/1 system-ui;color:inherit;pointer-events:none;overflow:hidden
}
#nm-view-overlay[data-view-mode="concept-tree"] img.nm-tree-mark{
  display:block;object-fit:cover;object-position:center
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card .nm-view-title{
  padding-left:30px;font-weight:600;line-height:1.2;max-height:36px;
  display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card .nm-hierarchy-hidden-badge{
  right:34px;bottom:6px;border-color:color-mix(in srgb,var(--nm-tree-group,#38bdf8) 55%,transparent);
  background:color-mix(in srgb,var(--nm-view-bar,#ffffff) 82%,var(--nm-tree-group,#38bdf8))
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card .nm-view-collapse{
  opacity:.55;border-radius:var(--gv-radius-xs);width:28px;height:28px;min-width:28px;min-height:28px;
  transition:opacity var(--gv-motion-normal) var(--gv-ease-out)
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card .nm-view-collapse.is-collapsed-persistent,
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card:hover .nm-view-collapse,
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card:focus-within .nm-view-collapse,
#nm-view-overlay[data-view-mode="concept-tree"] .nm-tree-card .nm-view-collapse:focus-visible{opacity:1}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-view-collapse-chevron{
  display:inline-block;transition:transform var(--gv-motion-normal) var(--gv-ease-out)
}
#nm-view-overlay[data-view-mode="concept-tree"] .nm-view-collapse.is-collapsed .nm-view-collapse-chevron{transform:rotate(-90deg)}
#nm-view-overlay .nm-hierarchy-edge{
  stroke-width:1.65;opacity:.85;transition:stroke-opacity var(--gv-motion-fast) linear,stroke-width var(--gv-motion-fast) linear
}
#nm-view-overlay .nm-hierarchy-edge.is-hierarchy-active{
  stroke-width:2.2;stroke-opacity:1;opacity:1
}
.nm-network-card{touch-action:none;cursor:grab;transition:opacity var(--gv-motion-fast) linear,outline-color var(--gv-motion-fast) linear}
.nm-network-card[data-cluster]::before{content:'';position:absolute;left:-7px;top:10px;width:9px;height:9px;border-radius:50%;background:var(--nm-network-cluster);box-shadow:0 0 0 2px #11182799;pointer-events:none}
.nm-network-card:active{cursor:grabbing}
#nm-view-overlay .nm-network-card.nm-network-manual-overlap{outline:2px dashed #f59e0b;outline-offset:3px}
.nm-network-card.is-link-source{outline:3px solid #c4b5fd;outline-offset:2px}
.nm-network-card.is-relation-source{outline:3px solid var(--nm-network-focus-source,#38bdf8);outline-offset:3px}
.nm-network-card.is-relation-target{outline:3px solid var(--nm-network-focus-target,#34d399);outline-offset:3px}
.nm-network-edge{transition:stroke-width var(--gv-motion-fast) linear,opacity var(--gv-motion-fast) linear,filter var(--gv-motion-fast) linear}
.nm-network-edge.is-relation-focused{stroke-width:5!important;filter:drop-shadow(0 0 3px var(--nm-network-focus-source,#38bdf8))}
#nm-view-overlay .nm-network-neighborhood-active .nm-network-card.is-neighborhood-dimmed{opacity:.68}
#nm-view-overlay .nm-network-neighborhood-active .nm-network-card.is-neighborhood-active{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px
}
#nm-view-overlay .nm-network-neighborhood-active .nm-network-card.is-neighborhood-neighbor{
  outline:2px solid var(--nm-network-focus-target,#34d399);outline-offset:2px
}
#nm-view-overlay .nm-network-neighborhood-active .nm-network-edge.is-neighborhood-edge{
  stroke-width:3.25!important;filter:drop-shadow(0 0 4px var(--nm-network-focus-source,#38bdf8));opacity:1
}
#nm-view-overlay .nm-network-neighborhood-active .is-neighborhood-dimmed{opacity:.55}
#nm-view-overlay .nm-network-label.is-neighborhood-label,
#nm-view-overlay .nm-network-label-plate.is-neighborhood-label{opacity:1}
#nm-view-overlay.nm-network-large .nm-network-edge.is-neighborhood-edge,
#nm-view-overlay.nm-network-large .nm-network-edge.is-relation-focused{filter:none}
.nm-network-link-item:focus-visible{outline:2px solid var(--nm-network-focus-source,#38bdf8);outline-offset:2px}
.nm-network-label{font:600 12px system-ui;stroke:none;paint-order:normal}
.nm-network-label-plate{pointer-events:none}

#nm-work-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:9px 14px;background:#18263a;border-bottom:1px solid #3c5067}
#nm-work-toolbar[hidden]{display:none!important}
#nm-work-toolbar label{display:flex;align-items:center;gap:5px;font-size:12px;color:#cbd5e1}
#nm-work-toolbar select,#nm-work-toolbar input{max-width:210px;min-width:90px;padding:6px;border:1px solid #5d708c;border-radius:8px;background:#122136;color:white}
#nm-work-toolbar button{padding:8px 12px;background:#40558d;color:white;border:1px solid #8199bb;border-radius:8px;cursor:pointer}
#nm-work-details{flex:1 1 100%;min-width:0}
#nm-work-details>summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;min-height:34px;padding:6px 10px;border:1px solid #8199bb;border-radius:8px;background:#40558d;color:#fff;font:600 12px system-ui}
#nm-work-details>summary::-webkit-details-marker{display:none}
#nm-work-fields{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding-top:6px}
#nm-work-dependency-note{font-size:11px;color:#a9d1eb;max-width:300px;overflow-wrap:anywhere}
.nm-timeline-scale-control{display:flex;align-items:center;gap:6px;color:#e2e8f0;font:600 11px system-ui}
.nm-timeline-scale-control select,#nm-dual-time-scale{min-height:29px;border:1px solid #64748b;border-radius:7px;padding:4px;background:#172c43;color:#f8fafc}
.nm-timeline-scale-control[hidden]{display:none}
.nm-timeline-scale-hint{display:inline-flex;color:#fbbf24;font:500 10px/1.2 system-ui;max-width:180px}
.nm-timeline-scale-hint[hidden]{display:none}
.nm-kanban-dropzone{position:absolute;top:20px;border:1px solid #40516b;background:#18263b55;border-radius:14px;box-sizing:border-box;transition:background .16s,border-color .16s}
.nm-kanban-dropzone.is-over{background:#5369a04d;border-color:#a5b4fc}
.nm-work-card.is-dragging{opacity:.45}
.nm-work-card.is-drop-before{outline:2px dashed var(--nm-kanban-status,#94a3b8);outline-offset:2px}
.nm-work-card:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}
.nm-work-column{position:absolute;top:25px;width:214px;text-align:center;color:#cbd5e1;font-weight:650;border-bottom:1px solid #586780;padding:14px 0;box-sizing:border-box}
.nm-work-card{border-left-color:#38bdf8}
.nm-timeline-card{border-radius:7px;padding:2px;background:#5075b8;min-width:18px;box-shadow:0 4px 8px #0004}
.nm-timeline-card.is-milestone{clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);border-radius:0!important;min-width:28px}
.nm-timeline-card.is-milestone[aria-selected=true]{filter:brightness(1.25)}
.nm-timeline-title{position:absolute;left:18px;width:220px;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dae5f4;font-size:12px;pointer-events:none}
.nm-timeline-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650}
.nm-timeline-title .nm-timeline-date{font:10px/1.2 system-ui;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm-timeline-title .nm-timeline-concurrent{position:absolute;right:5px;top:0;border:1px solid currentColor;border-radius:6px;padding:1px 4px;font:600 10px system-ui;opacity:.85}
.nm-timeline-title:has(.nm-timeline-concurrent) span{max-width:170px}
.nm-work-blank{position:absolute;left:16px;top:85px;box-sizing:border-box;width:min(480px,calc(100cqi - 32px));max-width:min(480px,calc(100cqi - 32px));background:#182940;border:1px dashed #64748b;border-radius:12px;padding:18px;color:#cbd5e1}
#nm-view-scroller .nm-flow-empty{position:absolute;top:70px;left:16px;box-sizing:border-box;width:min(425px,calc(100cqi - 32px));max-width:min(425px,calc(100cqi - 32px));padding:22px;background:#19283c;border:1px dashed #8695af;border-radius:15px;color:#cbd5e1;font-size:14px;line-height:1.5}
.nm-view-card .nm-view-add{display:flex;align-items:center;justify-content:center;min-width:23px;height:23px;border:1px solid #556785;border-radius:7px;background:#33445b;color:#e2e8f0;cursor:pointer;font-size:16px}
.nm-view-card .nm-view-add:hover{background:#445d80}
.nm-view-card .nm-view-collapse{display:flex;align-items:center;justify-content:center;min-width:23px;height:23px;border:1px solid #546783;border-radius:7px;background:#28384e;color:#cbd5e1;cursor:pointer}
.nm-view-card .nm-view-collapse:hover{background:#3a4f6a}
.nm-view-card .nm-view-edit{min-width:0;width:100%;height:33px;border:1px solid #a5b4fc;background:#0c182a;color:white;border-radius:5px;padding:3px 7px;font:12px system-ui}
#nm-view-help{margin:0;padding:8px 16px;color:#94a3b8;background:#131e30;border-top:1px solid #334155;font-size:11px;max-height:25%;overflow:auto;flex-shrink:0}
#nm-view-context{position:fixed;z-index:80;min-width:180px;max-width:min(270px,80vw);padding:5px;border:1px solid #8190b7;background:#1c2c48;border-radius:12px;box-shadow:0 18px 48px #0009}
#nm-view-context[hidden]{display:none!important}
#nm-view-context button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:35px;padding:7px 10px;color:#f2f6ff;background:transparent;border:0;border-radius:8px;font:12px system-ui;text-align:left;cursor:pointer}
#nm-view-context button:hover,#nm-view-context button:focus-visible{background:#3b4c76;outline:2px solid #a5b4fc;outline-offset:-2px}
#nm-view-context button:disabled{opacity:.44;cursor:not-allowed}
#nm-view-context small{font:10px system-ui;color:#c4cee5;margin-left:12px}
#nm-view-action-status{flex-basis:100%;min-height:16px;color:#b7e4cd;font:11px/1.4 system-ui}
#nm-view-overlay :is(button,input,select,[role="button"]):focus-visible{outline:2px solid #b5adff;outline-offset:2px}
#nm-view-overlay :is(.nm-view-header,.nm-dual-toolbar,#nm-work-toolbar,#nm-flow-toolbar,#nm-network-toolbar,#nm-dual-tools) button{min-height:31px}
#nm-view-overlay button:disabled{opacity:.48;cursor:not-allowed}
#nm-view-overlay button[aria-pressed="true"]{border-color:#aba2fd;background:#493e82;color:#fff}
#nm-view-overlay button:active:not(:disabled){transform:translateY(1px)}
.nm-view-card .nm-view-sr-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

#nm-view-appearance{position:relative;min-width:136px;max-width:100%;border:1px solid #526684;border-radius:9px;background:#182a44}
#nm-view-appearance[hidden]{display:none!important}
#nm-view-appearance>summary{cursor:pointer;list-style:revert;padding:8px 10px;font:600 12px system-ui;color:#e3ecfd}
#nm-view-appearance .nm-appearance-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:7px;padding:8px;border-top:1px solid #475a76}
#nm-view-appearance .nm-appearance-group{min-width:0;border:1px solid #49607e;border-radius:9px;background:#172840}
#nm-view-appearance .nm-appearance-group[data-group=theme]{grid-column:1/-1}
#nm-view-appearance .nm-appearance-group>summary{cursor:pointer;padding:8px 10px;color:#e2edff;font:600 11px system-ui}
#nm-view-appearance .nm-appearance-group-content{display:flex;align-items:end;gap:7px;flex-wrap:wrap;padding:8px;border-top:1px solid #354c6a}
#nm-view-appearance .nm-appearance-group-content>label{flex:1 1 85px}
#nm-view-appearance .nm-appearance-group-content>.nm-appearance-presets{flex:1 1 100%}
#nm-view-appearance .nm-appearance-group-content>.nm-appearance-reset{flex:1 1 auto}
#nm-view-appearance .nm-appearance-help{grid-column:1/-1;margin:0;padding:4px 2px 6px;color:#c8d8ef;font:11px/1.45 system-ui}
#nm-view-appearance label{display:flex;flex-direction:column;gap:3px;font:11px system-ui;color:#dae4fa;min-width:76px}
#nm-view-appearance label.nm-appearance-scope{flex-direction:row;align-items:center;max-width:175px}
#nm-view-appearance select,#nm-view-appearance input:not([type=checkbox]){min-height:30px;max-width:130px;box-sizing:border-box;border-radius:7px;border:1px solid #647995;background:#10223a;color:#fff;padding:3px 5px}
#nm-view-appearance input[type=color]{width:46px;padding:2px}
#nm-view-appearance .nm-appearance-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:6px;width:100%;box-sizing:border-box}
#nm-view-appearance .nm-appearance-preset{display:flex;flex-direction:column;align-items:stretch;gap:6px;min-height:105px;text-align:left;padding:6px;background:#192b43;color:#e9f1ff;border:1px solid #566b88;border-radius:9px;cursor:pointer;font:600 11px system-ui;min-width:0}
#nm-view-appearance .nm-appearance-preset[aria-pressed=true]{border-color:#c4b5fd;outline:1px solid #a78bfa;background:#293e5d}
#nm-view-appearance .nm-appearance-preset:focus-visible{outline:2px solid #e9d5ff;outline-offset:2px}
#nm-view-appearance .nm-appearance-preset:disabled{opacity:.55;cursor:default}
#nm-view-appearance .nm-preset-swatch{display:block;width:100%;height:76px;border-radius:5px;border:1px solid #ffffff33;flex-shrink:0;box-sizing:border-box;overflow:hidden}
#nm-view-appearance .nm-preset-swatch svg{display:block;width:100%;height:100%}
#nm-view-appearance .nm-preset-chip{width:21px;height:13px;border-left:4px solid;border-radius:4px;box-shadow:0 1px 3px #0002;box-sizing:border-box}
#nm-view-appearance .nm-appearance-reset{align-self:end;padding:8px 10px;border:1px solid #6f819b;border-radius:8px;background:#233a56;color:#e9f1ff;font:600 11px system-ui;cursor:pointer}
#nm-view-appearance .nm-appearance-reset:disabled{opacity:.48;cursor:default}
#nm-view-appearance .nm-appearance-reset:focus-visible{outline:2px solid #e9d5ff;outline-offset:2px}
#nm-view-appearance .nm-appearance-property-reset{background:#1e3652;border-style:dashed}
/* Keep the linked-view controls accessible to keyboard and reduced-motion users. */
#nm-view-overlay select:focus-visible,
#nm-view-appearance summary:focus-visible,
#nm-view-overlay [tabindex]:focus-visible{outline:2px solid #e9d5ff;outline-offset:2px}

/* UX gate: the diagram keeps its space; settings/export do not grow the header. */
#nm-view-overlay .nm-view-controls{max-height:min(46vh,280px);overflow-y:auto;overflow-x:hidden}
#nm-view-overlay .nm-view-header{display:flex;flex-wrap:wrap;align-items:center;align-content:flex-start;gap:6px;padding:6px 10px;min-height:44px;box-sizing:border-box;overflow:visible}
#nm-view-overlay .nm-view-header>:is(button,select,details,.nm-view-trigger,#nm-view-zoom){flex:0 0 auto;min-width:max-content;max-width:none}
#nm-view-overlay .nm-view-header>strong{max-width:none;min-width:55px;flex:0 0 auto;overflow:visible;white-space:nowrap}
#nm-view-overlay .nm-view-header>#nm-view-heading,
#nm-view-overlay .nm-view-header .nm-view-hint,
#nm-view-overlay .nm-view-header #nm-view-action-status{position:absolute!important;inline-size:1px!important;block-size:1px!important;min-width:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}
#nm-view-overlay .nm-view-header>:is(#nm-view-appearance,#nm-view-export-menu,#nm-project-view-options){flex:0 0 auto;min-width:max-content}
#nm-view-overlay .nm-view-header :is(#nm-view-appearance,#nm-view-export-menu,#nm-project-view-options)>summary{overflow:visible;text-overflow:clip;max-width:none}
/* The view name stays as wide as its icon and label. The header scrolls
   instead of crushing the control below the 24px glyph. */
#nm-view-overlay .nm-view-trigger{flex:0 0 auto;width:auto;min-width:max-content;max-width:max-content}
#nm-view-overlay .nm-view-header button{min-height:34px;padding:5px 7px}
#nm-view-overlay #nm-view-overlay-picker{max-width:148px!important;min-width:80px!important;padding:5px!important;background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#16243d);border:1px solid var(--nm-skin-stroke,#c5ceda)}
#nm-view-overlay #nm-view-overlay-focus{max-width:none;min-width:34px;flex-shrink:0;overflow:visible;white-space:nowrap}
#nm-view-overlay #nm-view-zoom{flex-shrink:0;gap:2px;padding:2px}
#nm-view-overlay #nm-view-zoom button{min-width:29px;padding:5px}
#nm-view-overlay #nm-view-zoom-status{min-width:33px;font-size:11px}
#nm-view-overlay #nm-view-appearance,#nm-view-overlay #nm-view-export-menu{position:static;min-width:0;flex:0 0 auto;background:transparent;border-color:transparent}
#nm-view-overlay #nm-view-appearance>summary,#nm-view-overlay #nm-view-export-menu>summary{list-style:none;cursor:pointer;white-space:nowrap;min-height:34px;padding:8px 10px;box-sizing:border-box;border:1px solid var(--nm-view-control-edge,#c5ceda);border-radius:10px;background:var(--nm-view-control,#ffffff);color:var(--nm-view-control-ink,#16243d);font:600 12px/18px system-ui}
#nm-view-overlay #nm-view-appearance>summary::-webkit-details-marker,#nm-view-overlay #nm-view-export-menu>summary::-webkit-details-marker{display:none}
#nm-view-overlay #nm-view-appearance .nm-appearance-fields,#nm-view-overlay #nm-view-export-actions{position:absolute;right:12px;top:55px;z-index:90;box-sizing:border-box;max-height:calc(100% - 70px);overflow:auto;overscroll-behavior:contain;padding:8px;border:1px solid var(--nm-view-control-edge,#62799a);border-radius:12px;background:var(--nm-view-bar,#ffffff);color:var(--nm-view-control-ink,#16243d);box-shadow:0 15px 38px #0008}
#nm-view-overlay #nm-view-appearance .nm-appearance-fields{width:min(354px,calc(100% - 24px));grid-template-columns:minmax(0,1fr);gap:5px}
#nm-view-overlay #nm-view-appearance .nm-appearance-group,#nm-view-overlay #nm-view-appearance .nm-appearance-group[data-group=theme]{grid-column:1/-1}
#nm-view-overlay #nm-view-appearance .nm-appearance-group>summary{padding:7px 9px}
#nm-view-overlay #nm-view-appearance .nm-appearance-group-content{gap:5px;padding:7px}
#nm-view-overlay #nm-view-appearance .nm-appearance-presets{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
#nm-view-overlay #nm-view-appearance .nm-appearance-preset{min-height:68px;gap:3px;padding:5px}
#nm-view-overlay #nm-view-appearance .nm-preset-swatch{height:43px}
#nm-view-overlay #nm-view-appearance select,#nm-view-overlay #nm-view-appearance input:not([type=checkbox]){min-height:34px}
#nm-view-overlay #nm-view-export-actions{display:flex;flex-direction:column;gap:5px;min-width:170px}
#nm-view-overlay #nm-view-export-actions button{width:100%;text-align:left;min-height:36px}
/* Saved split layouts have their own compact flyout only in linked views.
   The Disposizione disclosure elsewhere remains full-width and independent. */
#nm-view-overlay #nm-project-view-options{position:static;flex:0 0 auto;width:auto;min-width:0;padding:0;background:transparent;border-color:transparent}
#nm-view-overlay #nm-project-view-options>summary{
  display:block;list-style:none;white-space:nowrap;cursor:pointer;box-sizing:border-box;
  min-height:34px;padding:8px 10px;border:1px solid var(--nm-view-control-edge,#c5ceda);border-radius:10px;
  background:var(--nm-view-control,#ffffff);color:var(--nm-view-control-ink,#16243d);font:600 12px/18px system-ui
}
#nm-view-overlay #nm-project-view-options>summary::-webkit-details-marker{display:none}
#nm-view-overlay #nm-project-view-options>.nm-layout-workspace{
  position:absolute;top:55px;right:12px;z-index:90;box-sizing:border-box;
  display:grid;grid-template-columns:minmax(0,1fr);gap:7px;
  width:min(354px,calc(100% - 24px));min-width:0;max-height:calc(100% - 70px);overflow:auto;
  overscroll-behavior:contain;padding:10px;border:1px solid var(--nm-view-control-edge,#62799a);border-radius:12px;
  background:var(--nm-view-bar,#ffffff);color:var(--nm-view-control-ink,#16243d);box-shadow:0 15px 38px #0008
}
#nm-view-overlay #nm-project-view-options>.nm-layout-workspace :is(select,input[type=text],button){width:100%;max-width:100%;min-width:0;border-radius:10px}
#nm-view-overlay #nm-project-view-options:not([open])>.nm-layout-workspace{display:none!important}

/* Explicit closed-state guard even when author display rules override UA defaults. */
#nm-view-overlay #nm-view-appearance:not([open]) .nm-appearance-fields,
#nm-view-overlay #nm-view-export-menu:not([open]) #nm-view-export-actions{display:none!important}
#nm-view-overlay #nm-view-help{max-height:none;white-space:normal;text-overflow:clip;overflow:visible;line-height:1.35;padding:6px var(--nm-view-corner-clear,12px) 8px 12px}
#nm-view-overlay .nm-view-add,#nm-view-overlay .nm-view-collapse{min-width:30px;min-height:30px;box-sizing:border-box;flex:0 0 auto}
#nm-view-overlay .nm-view-card{padding:7px 9px;gap:4px}
#nm-view-overlay .nm-view-card.is-decision{padding:18px 43px}
#nm-view-overlay .nm-view-card.is-flow-io{padding:13px 29px}
#nm-view-overlay .nm-view-card.is-flow-terminal{padding:10px 21px}
/* Split Kanban: label, add action, status selector and date footer must never
   share the same vertical lane when the card is only 100px high. */
#nm-view-overlay #nm-dual-pane .nm-kanban-card .nm-view-title{
  margin-top:0!important;max-width:calc(100% - 32px);align-self:flex-start;
  -webkit-line-clamp:1;line-clamp:1
}
#nm-view-overlay #nm-dual-pane .nm-kanban-card .nm-view-add{
  position:absolute;right:7px;top:6px;min-height:28px;min-width:28px
}
#nm-view-overlay #nm-flow-toolbar,#nm-view-overlay #nm-network-toolbar,#nm-view-overlay #nm-work-toolbar{gap:5px;padding:6px 9px}
#nm-view-overlay #nm-flow-guide{padding:7px 9px}
#nm-view-overlay #nm-dual-pane .nm-dual-toolbar{gap:4px;padding:6px}
#nm-view-overlay #nm-dual-tools{padding:5px 7px;gap:4px}
@media(max-width:960px){#nm-view-overlay .nm-view-header{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}#nm-view-overlay #nm-view-appearance .nm-appearance-fields,#nm-view-overlay #nm-view-export-actions,#nm-view-overlay #nm-project-view-options>.nm-layout-workspace{right:7px;max-height:calc(100% - 66px)}}
@media(max-height:480px){#nm-view-overlay .nm-view-controls{max-height:140px!important}}
/* Small split workspaces scroll as a pair instead of squeezing toolbars and
   canvases into two unusable 50%-height slots. No change to saved split width. */
@media(max-width:750px){
  #nm-view-overlay #nm-linked-panels.nm-dual-active{flex-direction:column;overflow-y:auto;overscroll-behavior:contain;min-height:0}
  #nm-view-overlay #nm-linked-panels.nm-dual-active>#nm-view-scroller{flex:0 0 240px!important;min-height:200px}
  #nm-view-overlay #nm-linked-panels.nm-dual-active>#nm-dual-pane{flex:0 0 285px!important;min-height:220px}
  #nm-view-overlay #nm-linked-panels.nm-dual-active #nm-dual-scroller{min-height:120px}
}
@media(max-width:750px){#nm-view-overlay .nm-view-controls{max-height:min(33vh,180px)}#nm-view-overlay .nm-view-header{min-height:42px;padding:5px 7px}#nm-view-overlay #nm-view-appearance .nm-appearance-fields{width:calc(100% - 14px)}}
@media(prefers-reduced-motion:reduce){
  #nm-view-overlay *,#nm-view-overlay *::before,#nm-view-overlay *::after,
  #nm-view-switch *,#nm-view-switch *::before,#nm-view-switch *::after{
    animation-duration:0.01ms!important;animation-iteration-count:1!important;
    transition-duration:0.01ms!important;scroll-behavior:auto!important
  }
}
@media(max-height:480px){#nm-view-overlay .nm-view-controls{max-height:45%}}
@media(max-width:750px){#nm-view-overlay{inset:70px 5px 5px;border-radius:12px}#nm-view-overlay.nm-side-panel{left:5px;right:5px;top:70px;bottom:5px;width:auto}#nm-view-switch label{display:none}#nm-view-picker{max-width:142px}#nm-view-overlay .nm-view-header{padding:8px}}
@media(max-width:750px){body.nm-workspace-v2:not(.glauka-mobile-app) #nm-view-overlay{right:58px}}
/* Android / mobile shell: one exclusive linked view above dock and sheets. */
body.glauka-mobile-app #nm-view-overlay,
body.glauka-mobile-app #nm-view-overlay.nm-side-panel,
body.glauka-mobile-app #nm-view-overlay.nm-dual-view{
  inset:max(58px,env(safe-area-inset-top,0px)) 0 0 0;
  left:0;right:0;width:auto;border-radius:0;border-left:0;border-right:0;border-bottom:0;z-index:2400
}
body.glauka-mobile-app #nm-view-split,
body.glauka-mobile-app #nm-project-view-options,
body.glauka-mobile-app #nm-dual-pane,
body.glauka-mobile-app #nm-view-focus{display:none!important}
/* Android uses Opzioni + the bottom Views chip; hide the header select. */
body.glauka-mobile-app #nm-view-switch{display:none!important}
body.glauka-mobile-app.nm-linked-view-open #glauka-app-dock,
body.glauka-mobile-app.nm-linked-view-open #glauka-app-sheet,
body.glauka-mobile-app.nm-linked-view-open #glauka-style-scrim{display:none!important}
body.glauka-mobile-app #nm-view-overlay .nm-view-header button,
body.glauka-mobile-app #nm-view-overlay .nm-view-header select,
body.glauka-mobile-app #nm-view-overlay .nm-view-trigger{min-height:44px;min-width:44px}
body.glauka-mobile-app #nm-view-overlay .nm-view-header{gap:8px;padding:10px 12px}
/* Bars and controls inside a view follow the canvas theme, not the UI skin. */
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,#nm-view-help,.nm-dual-toolbar,#nm-dual-tools,#nm-view-context){
  background:var(--nm-view-bar,#ffffff);color:var(--nm-view-control-ink,#16243d);
  border-color:var(--nm-view-control-edge,#c5ceda)
}
#nm-view-overlay .nm-view-header :is(button,select),
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) :is(button,select,input:not([type=color])),
#nm-view-overlay .nm-view-card :is(.nm-view-add,.nm-view-collapse,.nm-view-edit),
#nm-view-overlay #nm-view-context button{
  border-radius:10px;
  background:var(--nm-view-control,#ffffff);color:var(--nm-view-control-ink,#16243d);
  border-color:var(--nm-view-control-edge,#c5ceda)
}
#nm-view-overlay .nm-view-header :is(button,summary):hover:not(:disabled),
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) button:hover:not(:disabled){
  border-color:var(--nm-view-control-ink,#16243d);
  background:color-mix(in srgb,var(--nm-view-control-ink,#16243d) 8%,var(--nm-view-control,#ffffff));
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay .nm-view-header :is(button,summary):active:not(:disabled),
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) button:active:not(:disabled){
  background:color-mix(in srgb,var(--nm-view-control-ink,#16243d) 16%,var(--nm-view-control,#ffffff))
}
#nm-view-overlay #nm-view-appearance>summary:hover,
#nm-view-overlay #nm-view-export-menu>summary:hover,
#nm-view-overlay #nm-project-view-options>summary:hover{
  border-color:var(--nm-view-control-ink,#16243d);
  background:color-mix(in srgb,var(--nm-view-control-ink,#16243d) 8%,var(--nm-view-control,#ffffff));
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay #nm-view-appearance[open]>summary,
#nm-view-overlay #nm-view-export-menu[open]>summary,
#nm-view-overlay #nm-project-view-options[open]>summary{
  border-color:var(--nm-view-control-ink,#16243d);
  background:color-mix(in srgb,var(--nm-view-control-ink,#16243d) 16%,var(--nm-view-control,#ffffff));
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay .nm-view-header :is(button,summary):focus-visible,
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) :is(button,summary):focus-visible{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px
}
#nm-view-overlay :is(.nm-view-header,#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) :is(button,summary):is([aria-pressed="true"],[aria-expanded="true"]){
  border-color:var(--nm-theme-action,#6441df);
  background:color-mix(in srgb,var(--nm-theme-action,#6441df) 18%,var(--nm-view-control,#ffffff));
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay .nm-view-card :is(.nm-view-add,.nm-view-collapse):hover,
#nm-view-overlay #nm-view-context button:hover,
#nm-view-overlay #nm-view-context button:focus-visible{
  background:var(--nm-view-bar,#ffffff);color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay .nm-kanban-dropzone{
  border-color:var(--nm-view-control-edge,#40516b);
  background:color-mix(in srgb,var(--nm-view-control-ink,#18263b) 8%,transparent)
}
#nm-view-overlay .nm-kanban-dropzone.is-over{
  border-color:var(--nm-view-control-ink,#a5b4fc);
  background:color-mix(in srgb,var(--nm-view-control-ink,#18263b) 16%,transparent)
}
#nm-view-overlay .nm-work-column{border-bottom-color:var(--nm-view-control-edge,#586780);color:var(--nm-view-control-ink,#16243d)}
#nm-view-overlay .nm-timeline-title{color:var(--nm-view-control-ink,#16243d)}
#nm-view-overlay :is(.nm-work-blank,.nm-flow-empty){
  background:var(--nm-view-bar,#ffffff);color:var(--nm-view-control-ink,#16243d);
  border-color:var(--nm-view-control-edge,#c5ceda)
}
#nm-view-overlay .nm-layout-workspace,
#nm-view-overlay .nm-layout-workspace label{color:var(--nm-view-control-ink,#16243d)}
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,#nm-view-help,.nm-dual-toolbar,#nm-dual-tools) :is(label,.nm-timeline-scale-control,#nm-network-status,#nm-work-dependency-note){
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay .nm-dual-toolbar strong,
#nm-view-overlay .nm-dual-message{color:var(--nm-view-control-ink,#16243d)}
/* F10b / QA-025: consistent, compact control typography across all linked views.
   Restrict these rules to chrome: node text retains its per-view/user styling. */
#nm-view-overlay .nm-view-header strong{
  font-size:15px;line-height:1.35;font-weight:700;letter-spacing:-.01em
}
#nm-view-overlay .nm-view-header .nm-view-hint{
  font-size:12px;line-height:1.45;overflow-wrap:anywhere
}
#nm-view-overlay :is(#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) :is(label,button,select,input,summary){
  font-size:12px;line-height:1.35
}
#nm-view-overlay :is(#nm-network-status,#nm-work-dependency-note,.nm-timeline-scale-control){
  font-size:12px;line-height:1.45;overflow-wrap:anywhere
}
#nm-view-overlay :is(.nm-view-header,#nm-flow-toolbar,#nm-network-toolbar,#nm-work-toolbar,.nm-dual-toolbar,#nm-dual-tools) :is(button,select,input,summary):focus-visible{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px
}
@media (prefers-reduced-motion:reduce){
  #nm-view-overlay :is(button,summary,.nm-view-card){transition:none!important;animation:none!important}
}
/* F10b / QA-025: keyboard focus stays visible on card actions, Kanban controls
   and the context menu. These rules must live in this stylesheet: a rule after
   the string never reaches the page and stops the editor script from parsing. */
#nm-view-overlay .nm-view-card :is(.nm-view-add,.nm-view-collapse,.nm-view-edit):focus-visible,
#nm-view-overlay #nm-view-context :is(button,select,input):focus-visible,
#nm-view-overlay .nm-work-column :is(button,select,input):focus-visible,
#nm-view-overlay .nm-kanban-card :is(button,select,input):focus-visible{
  outline:2px solid var(--nm-view-control-ink,#16243d);
  outline-offset:2px
}

/* Premium view chrome. Tokens stay on the overlay and are not saved with the map.
   Geometry, transforms and user colors are left to the renderer. */
#nm-view-overlay{
  --gv-space-1:4px;--gv-space-2:8px;--gv-space-3:12px;--gv-space-4:16px;
  --gv-space-5:20px;--gv-space-6:24px;--gv-space-8:32px;
  --gv-radius-xs:8px;--gv-radius-sm:12px;--gv-radius-md:16px;--gv-radius-lg:20px;
  --gv-motion-fast:120ms;--gv-motion-normal:180ms;--gv-motion-slow:240ms;
  --gv-ease-standard:cubic-bezier(.2,.8,.2,1);--gv-ease-out:cubic-bezier(.16,1,.3,1);
  --gv-shadow-card:0 2px 8px rgba(10,18,35,.08),0 1px 2px rgba(10,18,35,.05);
  --gv-shadow-hover:0 10px 26px rgba(10,18,35,.15),0 3px 8px rgba(10,18,35,.08)
}
#nm-view-overlay .nm-view-header{
  background:color-mix(in srgb,var(--nm-view-bar,#ffffff) 90%,transparent);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  border-bottom:1px solid var(--nm-view-control-edge,#d5dbe6);
  box-shadow:0 1px 0 rgba(10,18,35,.04)
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  #nm-view-overlay .nm-view-header{background:var(--nm-view-bar,#ffffff)}
}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-dropzone{
  border-radius:14px;border:1px solid var(--nm-view-control-edge,#d5dbe8);
  background:color-mix(in srgb,var(--nm-view-bar,#ffffff) 90%,var(--nm-view-control-ink,#16243d) 10%);
  box-shadow:var(--gv-shadow-card)
}
#nm-view-overlay[data-view-mode="kanban"] .nm-work-column{
  box-sizing:border-box;font-weight:650;
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay[data-view-mode="kanban"] .nm-work-column[data-status]{
  border-bottom:3px solid var(--nm-kanban-status,#94a3b8)
}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-card{
  border-radius:var(--gv-radius-sm);
  border:1px solid color-mix(in srgb,var(--nm-view-control-edge,#7487a6) 75%,transparent);
  background:var(--nm-view-bar,#ffffff);
  color:var(--nm-view-control-ink,#16243d);
  box-shadow:var(--gv-shadow-card);
  transition:box-shadow var(--gv-motion-normal) var(--gv-ease-out),border-color var(--gv-motion-normal) var(--gv-ease-out),opacity var(--gv-motion-fast) linear
}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-card .nm-view-title{font-weight:600}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-card .nm-kanban-date{font-weight:500;opacity:.72}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-card:hover{
  border-color:var(--nm-view-control-ink,#334155);box-shadow:var(--gv-shadow-hover)
}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-card[aria-selected="true"]{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px
}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-card.is-dragging{opacity:.7;cursor:grabbing}
#nm-view-overlay[data-view-mode="kanban"] .nm-kanban-dropzone.is-over{
  background:color-mix(in srgb,var(--nm-kanban-status,#94a3b8) 16%,transparent)
}
#nm-view-overlay[data-view-mode="kanban"] .nm-work-card.is-drop-before{
  box-shadow:inset 0 3px 0 var(--nm-theme-action,#6441df)
}
#nm-view-overlay[data-view-mode="flowchart"] .nm-view-card:not(.is-decision):not(.is-flow-io):not(.is-flow-terminal){
  border-radius:11px;box-shadow:var(--gv-shadow-card);
  background:var(--nm-view-bar,#ffffff);
  color:var(--nm-view-control-ink,#16243d)
}
#nm-view-overlay[data-view-mode="flowchart"] .nm-view-card.is-decision,
#nm-view-overlay[data-view-mode="flowchart"] .nm-view-card.is-flow-io,
#nm-view-overlay[data-view-mode="flowchart"] .nm-view-card.is-flow-terminal{
  box-shadow:var(--gv-shadow-card)
}
#nm-view-overlay[data-view-mode="flowchart"] .nm-view-card[aria-selected="true"]{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px
}
#nm-view-overlay[data-view-mode="flowchart"] #nm-flow-toolbar{
  gap:var(--gv-space-2)
}
#nm-view-overlay[data-view-mode="flowchart"] #nm-flow-toolbar :is(button,select,input){
  min-height:34px;border-radius:var(--gv-radius-xs)
}
#nm-view-overlay[data-view-mode="flowchart"] .nm-flow-empty,
#nm-view-overlay[data-view-mode="timeline"] .nm-work-blank{
  border-radius:var(--gv-radius-sm);box-shadow:var(--gv-shadow-card)
}
#nm-view-overlay[data-view-mode="timeline"] .nm-timeline-card{
  border-radius:10px;box-shadow:var(--gv-shadow-card);
  transition:box-shadow var(--gv-motion-normal) var(--gv-ease-out),border-color var(--gv-motion-normal) var(--gv-ease-out)
}
#nm-view-overlay[data-view-mode="timeline"] .nm-timeline-card:hover{box-shadow:var(--gv-shadow-hover)}
#nm-view-overlay[data-view-mode="timeline"] .nm-timeline-card[aria-selected="true"]{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:2px
}
#nm-view-overlay[data-view-mode="timeline"] .nm-timeline-date{opacity:.75;font-weight:500}
@media (prefers-reduced-motion:reduce){
  #nm-view-overlay[data-view-mode] :is(.nm-kanban-card,.nm-timeline-card,.nm-view-card){
    transition:none!important;animation:none!important
  }
}
/* Cycle 4B — one calm surface language, seven different readings.
   Colors already chosen by the person stay in the renderer variables.
   These rules only change chrome: not positions, not saved maps. */
#nm-view-overlay .nm-view-header{
  -webkit-backdrop-filter:none;backdrop-filter:none;
  background:var(--nm-view-bar,#ffffff)
}
#nm-view-overlay #nm-view-scroller,
#nm-view-overlay #nm-dual-scroller{
  background-image:radial-gradient(color-mix(in srgb,var(--nm-view-control-ink,#334155) 14%,transparent) 1px,transparent 1px);
  background-size:28px 28px
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="orgchart"] .nm-orgchart-card[data-org-depth="0"]{
  box-shadow:var(--gv-shadow-hover,0 10px 26px rgba(10,18,35,.15))
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="orgchart"] .nm-orgchart-card[data-org-depth="0"]::before{height:4px}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="orgchart"] .nm-orgchart-card[data-org-depth]:not([data-org-depth="0"]) .nm-orgchart-meta{opacity:.82}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="concept-tree"] .nm-tree-card[data-tree-tier="branch"]{
  box-shadow:inset 3px 0 0 var(--nm-tree-group,#34d399),var(--gv-shadow-card,0 2px 8px rgba(10,18,35,.08))
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="concept-tree"] .nm-tree-card[data-tree-tier="leaf"]{
  box-shadow:inset 3px 0 0 color-mix(in srgb,var(--nm-tree-group,#34d399) 55%,transparent),0 1px 4px rgba(10,18,35,.06)
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="concept-network"] .nm-network-card{
  border-radius:16px;box-shadow:var(--gv-shadow-card,0 2px 8px rgba(10,18,35,.08))
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="concept-network"] .nm-network-card[data-cluster]::before{box-shadow:none}
#nm-view-overlay.nm-network-large .nm-network-edge{filter:none}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="flowchart"] .nm-flow-role-label{
  background:var(--nm-view-bar,#253952);color:var(--nm-view-control-ink,#fff);
  border-color:var(--nm-view-control-edge,#aabbd3);letter-spacing:.03em
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="kanban"] .nm-kanban-card::before{height:3px}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="kanban"] .nm-work-column{
  letter-spacing:.03em;font-size:12px
}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="timeline"] .nm-timeline-title span{font-weight:700}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="timeline"] .nm-timeline-date{font-weight:500;opacity:.78}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="timeline"] .nm-timeline-card.is-milestone{filter:none}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="timeline"] .nm-timeline-card.is-milestone[aria-selected=true]{
  outline:2px solid var(--nm-theme-action,#6441df);outline-offset:3px;filter:none
}
.nm-view-card.is-drop-target{outline:2px solid #c4b5fd;outline-offset:2px}
.nm-flow-empty-actions{display:flex;gap:8px;margin:8px 16px}
.nm-view-flow-actions{position:absolute;left:50%;bottom:calc(100% + 8px);top:auto;transform:translateX(-50%);display:flex;gap:4px;z-index:4}
:is(#nm-view-overlay,#nm-dual-pane)[data-view-mode="flowchart"] .nm-view-card{overflow:visible}
.nm-view-flow-step{flex:0 0 auto;min-width:2rem;min-height:28px;padding:4px 8px;border-radius:8px;font:700 12px system-ui}
.nm-timeline-title .nm-timeline-edit{display:flex;gap:4px;margin-top:2px;pointer-events:auto}
:is(#nm-view-overlay,#nm-dual-pane) .nm-timeline-title{overflow:visible}
.nm-timeline-field{width:108px;max-width:108px;font:11px system-ui;pointer-events:auto}
.nm-kanban-deps{display:block;margin-top:4px;color:inherit;font:700 12px/1.3 system-ui;opacity:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nm-view-overlay[data-view-mode="kanban"] .nm-work-column{font-weight:750}
.nm-timeline-field{background:#fff;color:#17243a}
@media(max-width:980px),(max-height:560px){
 #nm-view-overlay{inset:48px 8px 8px 8px}
 #nm-view-overlay .nm-view-header{overflow-x:auto}
 #nm-view-help{max-height:2.8em}
 #nm-view-overlay .nm-view-controls{max-height:38%}
}
@media (prefers-reduced-motion:reduce){
  :is(#nm-view-overlay,#nm-dual-pane)[data-view-mode] :is(.nm-view-card,.nm-kanban-card,.nm-timeline-card){
    transition:none!important;animation:none!important
  }
}
`;
