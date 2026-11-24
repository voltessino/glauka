 const styles=`
#nm616-navigation{position:fixed;left:14px;top:154px;z-index:60;max-width:min(72vw,780px);font:12px/1.4 system-ui;color:var(--nm-skin-ink,#edf2fa);pointer-events:auto}
#nm616-navigation[hidden],#nm616-minimap-shell[hidden]{display:none!important}
#nm616-navigation .nm616-nav-card{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--nm-skin-stroke,#74869e);background:var(--nm-skin-surface,#132139);border-radius:13px;box-shadow:0 12px 36px rgba(0,0,0,.3);backdrop-filter:blur(16px);flex-wrap:wrap}
#nm616-navigation button,#nm616-minimap-shell button{border:1px solid var(--nm-skin-stroke,#74869e);border-radius:8px;background:var(--nm-skin-top,#1f2d48);color:var(--nm-skin-ink,#edf2fa);padding:5px 9px;font:inherit;cursor:pointer;transition:background .14s,border-color .14s}
#nm616-navigation button:hover,#nm616-minimap-shell button:hover{background:var(--nm-ui-hover,var(--nm-skin-top,#1f2d48));border-color:var(--nm-theme-focus,#b5a6ff)}
#nm616-navigation button:focus-visible,#nm616-minimap-shell button:focus-visible,#nm616-map:focus-visible{outline:2px solid var(--nm-theme-focus,#b5a6ff);outline-offset:2px}
#nm616-nav-focus{background:var(--nm-theme-action,#6654ca)!important;color:var(--nm-theme-on-action,#fff)!important;border-color:var(--nm-theme-focus,#b5a6ff)!important;font-weight:700!important}
#nm616-nav-focus[aria-pressed=true]{background:var(--nm-theme-action,#6654ca)!important;color:var(--nm-theme-on-action,#fff)!important;box-shadow:inset 3px 0 var(--nm-theme-focus,#b5a6ff)}
#nm616-nav-caption{font-size:11px;font-weight:750;letter-spacing:.04em;color:var(--nm-skin-muted,#b8c5d9);white-space:nowrap}
#nm616-nav-trail{display:grid;flex:1 0 100%;width:100%;box-sizing:border-box;gap:5px;min-width:0;padding:10px 11px;border-radius:11px;border:1px solid var(--nm-ui-line,var(--nm-skin-stroke,#7387a5));background:var(--nm-ui-top,var(--nm-skin-top,#192840))}
#nm616-nav-trail-label{font:750 10px/1.3 system-ui;letter-spacing:.05em;text-transform:uppercase;color:var(--nm-ui-muted,var(--nm-skin-muted,#bdcbe0))}
#nm616-nav-trail-path{font:650 12px/1.5 system-ui;color:var(--nm-ui-ink,var(--nm-skin-ink,#eaf1fb));overflow-wrap:anywhere}
#nm616-nav-trail-meta{font:550 11px/1.4 system-ui;color:var(--nm-ui-muted,var(--nm-skin-muted,#b8c5d9))}
#nm616-nav-status{font-size:11px;color:var(--nm-skin-muted,#b8c5d9);white-space:nowrap}
#nm616-nav-branches{flex-basis:100%;display:flex;flex-wrap:wrap;gap:5px;max-height:124px;overflow:auto}
#nm616-nav-branches[hidden]{display:none!important}
#nm616-nav-branches button{display:flex;align-items:center;max-width:205px;gap:6px;min-width:0;background:var(--nm-skin-top,#1f2d48);font-weight:550}
#nm616-nav-branches .nm616-color-dot{width:6px;height:13px;border-radius:99px;flex:0 0 auto;background:var(--nm-nav-dot,#9381ff)}
#nm616-nav-branches .nm616-branch-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nm616-nav-branches .nm616-branch-count{color:var(--nm-skin-muted,#b8c5d9);font-size:10px}
#nm616-nav-semantic[aria-pressed=false]{color:var(--nm-skin-muted,#b8c5d9)}
#nm616-nav-restore{background:var(--nm-skin-top,#1f2d48)!important;color:var(--nm-skin-ink,#edf2fa)!important;border-color:var(--nm-skin-stroke,#74869e)!important}
#nm616-minimap-shell{position:fixed;right:88px;bottom:72px;z-index:59;width:224px;padding:8px;border-radius:16px;border:1px solid var(--nm-skin-stroke,#74869e);background:var(--nm-skin-surface,#132139);color:var(--nm-skin-ink,#edf2fa);box-shadow:0 12px 35px #0006;backdrop-filter:blur(14px);box-sizing:border-box}
#nm616-minimap-shell header{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:5px;font:700 10px system-ui;letter-spacing:.09em;color:var(--nm-skin-muted,#b8c5d9);text-transform:uppercase}
#nm616-minimap-shell header button{padding:2px 5px;min-width:27px;min-height:30px;font-size:13px}
#nm616-minimap-shell.nm616-map-expanded{width:328px}
#nm616-minimap-shell.nm616-map-expanded #nm616-map{width:310px;height:205px}
#nm616-map-mode[aria-pressed=true]{color:var(--nm-theme-focus,#ad91ff)!important;border-color:var(--nm-theme-focus,#ad91ff)!important}
#nm616-map{display:block;width:190px;height:122px;border-radius:10px;cursor:crosshair;touch-action:none;background:radial-gradient(circle at 30% 20%,#182540,#0b1425)}
#nm616-minimap-shell footer{display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--nm-skin-muted,#b8c5d9);font-size:10px;padding:6px 2px 0}
#nm616-minimap-shell .nm616-map-nav{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto}
#nm616-minimap-shell .nm616-map-nav button{box-sizing:border-box;min-width:26px;height:24px;padding:0 6px;font-size:15px;line-height:1;font-weight:700;display:inline-grid;place-items:center;border-radius:7px}
#nm616-map-ratio{flex:1 1 auto;min-width:0;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#nm616-nav-map-toggle{font-weight:650!important}
@media(max-width:800px){#nm616-navigation{top:140px;left:8px;max-width:calc(100vw - 80px)}#nm616-nav-branches{max-height:90px}#nm616-minimap-shell{right:65px;bottom:64px;transform:scale(.83);transform-origin:bottom right}}
@media(max-width:560px){#nm616-navigation{max-width:calc(100vw - 25px)}#nm616-minimap-shell{right:50px;bottom:61px;transform:scale(.70)}}
#nm614-navigation-flyout #nm616-navigation{position:static;left:auto;top:auto;max-width:none;font:12px/1.4 system-ui}
#nm614-navigation-flyout #nm616-nav-disclosure>.nm616-nav-card{display:flex;position:static;flex-direction:column;align-items:stretch;padding:0;border:0;background:none;box-shadow:none;backdrop-filter:none}
#nm614-navigation-flyout #nm616-nav-disclosure>summary[hidden],#nm614-navigation-flyout .nm616-nav-heading[hidden]{display:none!important}
#nm614-navigation-flyout #nm616-nav-options{padding:8px 0;border-top:1px solid var(--nm-skin-stroke,#74869e)}
#nm614-navigation-flyout #nm616-nav-options>summary{cursor:pointer;font-size:11px;padding:6px 0}
#nm614-navigation-flyout #nm616-nav-options button{width:100%;margin-top:8px}
#nm614-navigation-flyout{box-sizing:border-box;max-height:calc(100dvh - var(--nm614-dock-top,102px) - 12px);overflow-y:auto;overscroll-behavior:contain}
#nm616-minimap-shell header{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,28px);gap:4px;min-width:0}
#nm616-minimap-shell header>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#nm616-minimap-shell header button{box-sizing:border-box;width:28px;min-width:28px;height:30px;padding:2px;}
@media(prefers-reduced-motion:reduce){#nm616-navigation button,#nm616-minimap-shell button{transition:none}}
`;
