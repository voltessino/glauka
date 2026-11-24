function nm6InjectShell(){
 const style=document.createElement('style');style.textContent=`
 .nm6-actions{display:flex;align-items:center;gap:5px;flex-shrink:0}
 .nm6-mini{border:1px solid var(--nm-skin-stroke,#d7d0eb);background:var(--nm-skin-top,#f5f2ff);color:var(--nm-skin-ink,#221c3d);padding:6px 10px;border-radius:10px;font:700 11px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
 .nm6-mini:hover{border-color:var(--nm-theme-focus,#6441df);background:var(--nm-ui-hover,#ebe4ff)}.nm6-mini.nm6-pro{color:var(--nm-theme-on-action,#fff);background:var(--nm-theme-action,#6441df);border-color:var(--nm-theme-action,#6441df)}
 .nm6-shade{position:fixed;inset:0;background:rgba(18,14,34,.46);backdrop-filter:blur(8px);z-index:260;display:grid;place-items:center;padding:18px}
 .nm6-shade.hidden{display:none}.nm6-modal{color:var(--nm-skin-ink,#1d1836);width:min(720px,100%);max-height:min(93vh,830px);overflow:auto;border:1px solid var(--nm-skin-stroke,#d9d2ec);background:var(--nm-skin-surface,#ffffff);border-radius:22px;padding:24px;box-shadow:0 24px 72px rgba(28,20,56,.2);font:400 14px/1.55 Inter,system-ui,sans-serif}.nm6-modal details{margin-top:12px}.nm6-modal summary{cursor:pointer;font-weight:700;color:var(--nm-skin-ink,#1d1836)}
 .nm6-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.nm6-eyebrow{font:800 10px system-ui;letter-spacing:.17em;text-transform:uppercase;color:var(--nm-theme-action,#6441df)}.nm6-title{font:800 clamp(21px,3vw,27px)/1.2 system-ui;color:var(--nm-skin-ink,#1d1836);margin:6px 0 4px}.nm6-desc{color:var(--nm-skin-muted,#5d5775);margin:4px 0 16px;font-size:13px}
 .nm6-close{width:34px;height:34px;flex:none;background:var(--nm-skin-top,#f5f2ff);border:1px solid var(--nm-skin-stroke,#d7d0eb);border-radius:10px;color:var(--nm-skin-ink,#1d1836);cursor:pointer;font-size:20px;display:grid;place-items:center}
 .nm6-plans{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0 16px}.nm6-card{border-radius:16px;border:1px solid var(--nm-skin-stroke,#d7d0eb);background:var(--nm-skin-top,#f7f5fc);padding:16px 17px;min-height:132px;display:flex;flex-direction:column;gap:6px}.nm6-card.pro{background:color-mix(in srgb,var(--nm-theme-action,#6441df) 7%,var(--nm-skin-surface,#ffffff));border:1.5px solid color-mix(in srgb,var(--nm-theme-action,#6441df) 46%,var(--nm-skin-stroke,#d7d0eb));box-shadow:0 6px 20px color-mix(in srgb,var(--nm-theme-action,#6441df) 10%,transparent)}.nm6-card h3{margin:0;color:var(--nm-skin-ink,#1d1836);font-size:17px;font-weight:800;display:flex;align-items:center;gap:6px}.nm6-card.pro h3{color:var(--nm-theme-action,#6441df)}.nm6-card p{margin:0;color:var(--nm-skin-muted,#4c4666);font-size:12.5px;line-height:1.55}.nm6-planline{font-size:12px;color:var(--nm-theme-action,#6441df);margin-top:10px}
 .nm64-developer .nm6-form{background:linear-gradient(120deg,rgba(24,81,72,.45),rgba(49,35,106,.48));border-color:rgba(66,211,172,.56)}
 #nm6-plan-modal [hidden]{display:none!important}
 #glauka-license-management{margin-top:16px;border-top:1px solid var(--nm-ui-line,#64748b);padding-top:12px}
 #glauka-license-management summary{cursor:pointer;font-weight:700}
 #glauka-license-management p{font-size:12px;line-height:1.6}
 .nm64-developer .nm6-plans{display:none!important}
 .nm64-developer .nm6-form #nm6-license-label,.nm64-developer .nm6-form .nm6-fieldrow,.nm64-developer .nm6-form #nm6-plan-hint{display:none!important}
 .nm64-developer #nm6-plan-current{font-size:15px;font-weight:800;color:#64f3bf;margin:0;min-height:24px}
 .nm6-form{background:var(--nm-skin-top,#f7f5fc);border:1px solid var(--nm-skin-stroke,#d7d0eb);padding:14px 16px;border-radius:15px}.nm6-form label{display:block;margin-bottom:8px;color:var(--nm-skin-ink,#1d1836);font-weight:700;font-size:13px}.nm6-fieldrow{display:flex;gap:8px}.nm6-fieldrow input{min-width:0;flex:1;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#cfc7e6);color:var(--nm-skin-ink,#1d1836);padding:10px 12px;border-radius:10px;font-size:12.5px}.nm6-cta{background:var(--nm-theme-action,#6441df);border:none;color:var(--nm-theme-on-action,#ffffff);border-radius:10px;padding:10px 15px;font-weight:750;cursor:pointer;white-space:nowrap}.nm6-cta:hover{filter:brightness(1.06)}.nm6-status{min-height:18px;margin:8px 0 0;color:var(--nm-skin-muted,#5d5775);font-size:12px;font-weight:600}.nm6-ghost{cursor:pointer;border:1px solid var(--nm-skin-stroke,#d7d0eb);background:var(--nm-skin-top,#f5f2ff);color:var(--nm-skin-ink,#221c3d);border-radius:10px;padding:9px 14px;font-weight:700;margin-top:10px}
 #nm6-welcome{display:flex;align-items:center;justify-content:center;overflow:auto;background:color-mix(in srgb,var(--nm-skin-top,#151b27) 72%,transparent);backdrop-filter:none;padding:20px;box-sizing:border-box}
 #nm6-welcome.hidden{display:none!important}
 #nm6-welcome .nm-home-screen{width:min(940px,100%);box-sizing:border-box;min-width:0;max-height:min(860px,calc(100dvh - 40px));overflow:auto;padding:18px 22px 16px;border:1px solid var(--nm-skin-stroke,#c9c2dc);border-radius:16px;background:var(--nm-skin-surface,#fff);color:var(--nm-skin-ink,#27213e);font:13px/1.45 Inter,system-ui,sans-serif;box-shadow:var(--nm-skin-shadow,0 18px 50px rgba(20,16,40,.16))}
 #nm6-welcome [hidden]{display:none!important}
 #nm6-welcome .nm-home-header{display:grid;grid-template-columns:36px minmax(0,1fr) 32px;align-items:start;gap:12px;margin-bottom:12px}
 #nm6-welcome .nm6-hero{width:36px;height:36px;box-sizing:border-box;padding:7px;border-radius:10px;box-shadow:none}
 #nm6-welcome .nm6-title{font-size:20px;line-height:1.25;margin:0 0 2px;color:inherit;font-weight:680}
 #nm6-welcome .nm6-desc{font-size:12px;line-height:1.45;margin:0;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-close{position:static;display:grid;place-items:center;width:32px;height:32px;min-height:32px;padding:0;border:1px solid var(--nm-skin-stroke,#c9c2dc);border-radius:8px;background:var(--nm-skin-top,#f5f2ff);color:inherit;cursor:pointer}
 #nm6-welcome .nm-home-close svg{display:block;width:18px;height:18px}
 #nm6-welcome button,#nm6-welcome input,#nm6-welcome select{box-sizing:border-box;font:inherit;min-width:0;color:inherit;border:1px solid var(--nm-skin-stroke,#c9c2dc);background:var(--nm-skin-top,#f5f2ff);border-radius:8px}
 #nm6-welcome button{cursor:pointer}
 #nm6-welcome button:hover{background:var(--nm-ui-hover,#eee8ff)}
 #nm6-welcome :is(button,input,select):focus-visible{outline:2px solid var(--nm-theme-focus,#6441df);outline-offset:2px}
 #nm6-welcome .nm-home-heading{margin:12px 0 6px;font-size:13px;color:inherit}
 #nm6-welcome .nm-home-setup{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 20px}
 #nm6-welcome :is(.nm-home-name-row,.nm-home-template-row){display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0;font-size:12px}
 #nm6-welcome .nm-home-name-row label{font-weight:600}
 #nm6-welcome .nm-home-name-row input{flex:1;width:100%;min-height:32px;padding:5px 8px}
 #nm6-welcome .nm-home-template-row select{min-height:32px;padding:5px 8px;flex:1}
 #nm6-welcome .nm-home-template-hint{flex-basis:100%;font-size:11px;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-categories{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 8px}
 #nm6-welcome .nm-home-categories button{padding:4px 9px;min-height:28px;border-radius:14px;font-size:12px}
 #nm6-welcome .nm-home-categories button[aria-pressed="true"]{background:var(--nm-theme-action,#6441df);color:var(--nm-theme-on-action,#fff);border-color:var(--nm-theme-focus,#6441df)}
 #nm6-welcome .nm-home-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0 12px}
 #nm6-welcome .nm-home-choice-wrap{display:flex;flex-direction:column;gap:4px;min-width:0}
 #nm6-welcome .nm-home-choice{display:flex;flex-direction:row;align-items:center;gap:8px;min-width:0;min-height:78px;padding:8px;text-align:start;flex:1}
 #nm6-welcome .nm-home-choice .nm-home-choice-preview{display:block;flex:0 0 36px;width:36px;height:42px;overflow:hidden;border:0;border-radius:4px}
 #nm6-welcome .nm-home-choice-body{display:flex;flex-direction:column;gap:3px;min-width:0}
 #nm6-welcome .nm-home-choice strong{font-size:12px;line-height:1.3}
 #nm6-welcome .nm-home-choice small{font-size:10px;line-height:1.3;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-choice svg{fill:var(--nm-skin-top,#f5f2ff);stroke:var(--nm-theme-focus,#6441df);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
 #nm6-welcome .nm-home-choice-wrap[data-selected="true"] .nm-home-choice{border-color:var(--nm-theme-focus,#6441df)}
 #nm6-welcome .nm-home-peek{align-self:flex-end;padding:3px 7px;min-height:26px;font-size:11px}
 #nm6-welcome .nm-home-preview-panel{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px;align-items:center;margin:8px 0 12px;padding:10px;border:1px solid var(--nm-skin-stroke,#c9c2dc);border-radius:10px}
 #nm6-welcome .nm-home-preview-art{display:block;width:100%;height:135px;border:1px solid var(--nm-skin-stroke,#c9c2dc);border-radius:8px}
 #nm6-welcome .nm-home-preview-info{min-width:0}
 #nm6-welcome .nm-home-preview-info strong{font-size:14px}
 #nm6-welcome .nm-home-preview-info p{margin:5px 0;font-size:12px}
 #nm6-welcome .nm-home-preview-note{display:block;margin-bottom:7px;font-size:11px;line-height:1.4;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-preview-info button{padding:6px 10px;min-height:32px}
 #nm6-welcome .nm-home-search{display:flex;align-items:center;gap:8px;margin:10px 0 8px}
 #nm6-welcome .nm-home-search label{font-size:12px;font-weight:600;white-space:nowrap}
 #nm6-welcome .nm-home-search input{flex:1;min-height:32px;padding:5px 9px}
 #nm6-welcome .nm-home-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 8px}
 #nm6-welcome .nm-home-actions .nm6-cta{background:var(--nm-theme-action,#6441df);color:var(--nm-theme-on-action,#fff);border-color:transparent;min-height:38px;padding:8px 14px;font-weight:680}
 #nm6-welcome .nm-home-actions .nm6-ghost{background:var(--nm-skin-surface,#fff);color:var(--nm-skin-ink,#27213e);min-height:38px;padding:8px 12px}
 #nm6-welcome .nm-home-back{margin:0 0 8px;min-height:32px;padding:4px 8px;background:transparent;border-color:transparent}
 #nm6-welcome .nm-home-recent-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
 #nm6-welcome .nm-home-recent-head button{min-height:30px;padding:4px 8px;background:transparent;font-size:12px}
 #nm6-welcome .nm-home-recent{display:flex;flex-direction:column;gap:4px;margin:6px 0 10px}
 #nm6-welcome .nm-home-recent-item{display:grid;grid-template-columns:22px minmax(0,1fr) auto 36px;align-items:center;gap:8px;min-width:0;min-height:50px;border:1px solid var(--nm-skin-stroke,#c9c2dc);border-radius:10px;background:var(--nm-skin-top,#f5f2ff);padding:0 4px 0 10px}
 #nm6-welcome .nm-home-recent-item:hover{background:var(--nm-ui-hover,#eee8ff)}
 #nm6-welcome .nm-home-file-icon{display:grid;place-items:center;color:var(--nm-theme-focus,#6441df)}
 #nm6-welcome .nm-home-file-icon svg{width:18px;height:18px;display:block}
 #nm6-welcome .nm-home-recent-item button{border:0;background:transparent;box-shadow:none}
 #nm6-welcome .nm-home-recent-item button[data-action="open"]{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:1px;min-width:0;min-height:48px;text-align:start;padding:4px 2px}
 #nm6-welcome .nm-home-recent-item strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:650}
 #nm6-welcome .nm-home-recent-item small,.nm6-welcome .nm-home-recent-when{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-recent-when{max-width:128px}
 #nm6-welcome .nm-home-recent-item button[data-action="pin"]{display:grid;place-items:center;width:36px;height:36px;padding:0;font-size:16px}
 #nm6-welcome .nm-home-recent-item button[data-action="pin"][aria-pressed="true"]{color:var(--nm-theme-focus,#6441df)}
 #nm6-welcome .nm-home-open{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
 #nm6-welcome .nm-home-open button{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 9px;min-height:30px;font-size:12px}
 #nm6-welcome .nm-home-empty{font-size:12px;margin:6px 0;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-intro{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;border:1px solid var(--nm-skin-stroke,#c9c2dc);padding:8px 10px;border-radius:9px;margin:8px 0 10px}
 #nm6-welcome .nm-home-intro strong{font-size:12px}
 #nm6-welcome .nm-home-intro ol{display:flex;flex-wrap:wrap;gap:3px 22px;padding-inline-start:16px;margin:4px 0 0;font-size:11px;line-height:1.4;color:var(--nm-skin-muted,#625b70)}
 #nm6-welcome .nm-home-intro button,#nm6-welcome .nm-home-tour-toggle{padding:4px 7px;min-height:28px;font-size:11px}
 #nm6-welcome .nm-home-tour-toggle{margin:0 0 4px}
 #nm6-welcome .nm6-welcome-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
 #nm6-welcome .nm6-welcome-actions button{min-height:34px;padding:7px 12px;font-size:12px;font-weight:650}
 #nm6-welcome .nm6-welcome-actions .nm6-cta{background:var(--nm-theme-action,#6441df);color:var(--nm-theme-on-action,#fff);border-color:var(--nm-theme-focus,#6441df)}
 #nm6-welcome .nm6-small{margin:8px 0 0;font-size:11px;line-height:1.45;color:var(--nm-skin-muted,#625b70)}
 @media(max-width:700px){#nm6-welcome{padding:10px}#nm6-welcome .nm-home-screen{padding:12px}#nm6-welcome .nm-home-setup{grid-template-columns:1fr}#nm6-welcome .nm6-title{font-size:19px}#nm6-welcome .nm-home-preview-panel{grid-template-columns:1fr}#nm6-welcome .nm-home-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}#nm6-welcome .nm-home-intro ol{display:block}}
 @media(pointer:coarse){#nm6-welcome .nm-home-screen :is(button,input,select){min-height:44px}#nm6-welcome .nm-home-actions :is(button,.nm6-cta,.nm6-ghost){min-height:44px}#nm6-welcome .nm-home-close,#nm6-welcome .nm-home-recent-item button[data-action="pin"]{width:44px;height:44px}#nm6-welcome .nm-home-header{grid-template-columns:36px minmax(0,1fr) 44px}#nm6-welcome .nm-home-recent-item{grid-template-columns:22px minmax(0,1fr) auto 44px;max-height:none}}
 @media(max-width:600px){.nm6-modal{padding:17px;border-radius:17px}.nm6-plans{grid-template-columns:1fr}.nm6-card{min-height:0}.nm6-fieldrow{flex-wrap:wrap}.nm6-fieldrow input{flex-basis:100%}}
 `;document.head.appendChild(style);
 const container=document.querySelector('.tabs-list')?.parentElement||document.querySelector('.topbar');
 if(container){const controls=document.createElement('div');controls.className='nm6-actions nm6-skiptranslate';controls.innerHTML='<button id="nm-home-open" type="button" class="nm6-mini" aria-label="Home">⌂ Home</button><button id="nm6-plan-button" type="button" class="nm6-mini nm6-pro">✦ PRO</button>';container.appendChild(controls)}
 const modal=document.createElement('div');modal.id='nm6-plan-modal';modal.className='nm6-shade hidden nm6-skiptranslate';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 modal.innerHTML=`<section class="nm6-modal" tabindex="0"><div class="nm6-head"><div><div class="nm6-eyebrow">GLAUKA</div><h2 id="nm6-plan-title" class="nm6-title"></h2><p id="nm6-plan-subtitle" class="nm6-desc"></p></div><button class="nm6-close" id="nm6-plan-close" aria-label="Close">×</button></div><div class="nm6-plans"><div class="nm6-card"><h3>✦ Free</h3><p id="nm6-plan-free"></p></div><div class="nm6-card pro"><h3>✦ Pro</h3><p id="nm6-plan-pro"></p></div></div><div class="nm6-form"><label for="nm6-license-input" id="nm6-license-label"></label><div class="nm6-fieldrow"><input id="nm6-license-input" autocomplete="off" spellcheck="false" placeholder="GLK1.…" maxlength="3072"/><button id="nm6-license-activate" class="nm6-cta"></button></div><div id="nm6-plan-current" class="nm6-status"></div></div><details class="nm6-form" id="nm6-plan-details"><summary id="nm6-plan-details-summary"></summary><p id="nm6-plan-hint" class="nm6-small"></p><p class="nm6-small" id="nm6-plan-buy"></p></details><button type="button" class="nm6-ghost" id="nm6-license-logout">Disattiva / Deactivate</button></section>`;
 const welcome=document.createElement('div');welcome.id='nm6-welcome';welcome.className='nm6-shade hidden nm6-skiptranslate';welcome.setAttribute('role','region');welcome.setAttribute('aria-label','Glauka Home');welcome.innerHTML=`<section class="nm-home-screen nm6-welcome"><header class="nm-home-header"><div class="nm6-hero">${window.GlaukaBrand?.svg||'✦'}</div><div class="nm-home-heading-copy"><h2 class="nm6-title" id="nm6-welcome-title"></h2><p class="nm6-desc" id="nm6-welcome-desc"></p><button type="button" class="nm-home-tour-toggle" id="nm-home-intro-show"></button></div><button type="button" id="nm-home-close" class="nm-home-close" aria-label="Chiudi schermata iniziale" title="Chiudi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="nm-home-intro" id="nm-home-intro"><div><strong id="nm-home-intro-title"></strong><ol id="nm-home-intro-steps"></ol></div><button type="button" id="nm-home-intro-hide"></button></div><div id="nm-home-landing"><div class="nm-home-actions"><button id="nm-home-new" class="nm6-cta" type="button"></button><button id="nm6-welcome-import" class="nm6-ghost" type="button"></button><button id="nm6-welcome-start" class="nm6-ghost" type="button"></button></div><div id="nm-home-open-area" hidden><h3 class="nm-home-heading" id="nm-home-open-title"></h3><div class="nm-home-open" id="nm-home-open-tabs"></div></div><div class="nm-home-search"><label for="nm-home-search" id="nm-home-search-label"></label><input id="nm-home-search" type="search" autocomplete="off" spellcheck="false" maxlength="150"></div><div id="nm-home-recent-area" hidden><div class="nm-home-recent-head"><h3 class="nm-home-heading" id="nm-home-recent-title"></h3><button type="button" id="nm-home-recent-more" hidden></button></div><div class="nm-home-recent" id="nm-home-recent"></div></div><p class="nm-home-empty" id="nm-home-empty" hidden></p></div><div id="nm-home-create" hidden><button type="button" id="nm-home-back" class="nm-home-back"></button><h3 class="nm-home-heading" id="nm-home-heading"></h3><div class="nm-home-setup"><div class="nm-home-name-row"><label id="nm-home-name-label" for="nm-home-project-name"></label><input id="nm-home-project-name" type="text" maxlength="80" autocomplete="off" spellcheck="false"></div><div class="nm-home-template-row"><label id="nm-home-template-label" for="nm-home-template"></label><select id="nm-home-template"><option value="blank"></option><option value="guided"></option></select><span class="nm-home-template-hint" id="nm-home-template-hint"></span></div></div><nav class="nm-home-categories" id="nm-home-categories" aria-label="Filtra visualizzazioni"></nav><div class="nm-home-gallery" id="nm-home-gallery" role="group"></div><section class="nm-home-preview-panel" id="nm-home-preview-panel" role="region" aria-labelledby="nm-home-preview-title" hidden><svg class="nm-home-preview-art" id="nm-home-preview-art" role="img" aria-label="Preview" viewBox="0 0 360 180"></svg><div class="nm-home-preview-info"><strong id="nm-home-preview-title"></strong><p id="nm-home-preview-description"></p><small class="nm-home-preview-note" id="nm-home-preview-note"></small><button type="button" id="nm-home-preview-create"></button></div></section></div><p role="note" class="nm6-small" id="nm6-welcome-privacy"></p></section>`;
 document.body.append(modal,welcome);
 window.GlaukaStoreUpdates?.mount?.();
 const labels={
  'nm6-plan-title':'title','nm6-plan-subtitle':'subtitle','nm6-plan-free':'freeDesc','nm6-plan-pro':'proDesc','nm6-license-label':'license','nm6-license-activate':'activate','nm6-plan-details-summary':'detailsTitle','nm6-plan-hint':'activationHint','nm6-plan-buy':'buy','nm6-license-logout':'logout',
  'nm6-welcome-title':'welcomeTitle','nm6-welcome-desc':'welcomeDesc','nm6-welcome-start':'welcomeGo','nm6-welcome-import':'welcomeImport','nm6-welcome-small':'welcomeSmall','nm6-welcome-privacy':'privacy'};
 window.nm6ApplyLanguage=()=>{
  document.documentElement.lang=nmLocale();for(const [id,key] of Object.entries(labels)){const element=document.getElementById(id);if(element)element.textContent=nmT(key)}
  document.getElementById('nm6-plan-close')?.setAttribute('aria-label',nmT('close'));
  document.documentElement.dir=nmLocale()==='ar'?'rtl':'ltr';nmProduct.syncBadge();nm6Translate();
  window.neuroMapApp?.nmFormatLocale?.();
  window.NeuroMapHome?.render?.();
  window.GlaukaI18n?.translateDOM();
 };
 window.GlaukaLanguageMenu?.mount();
 document.getElementById('nm6-plan-button')?.addEventListener('click',()=>nmProduct.open());
 document.getElementById('nm6-plan-close')?.addEventListener('click',()=>nmProduct.close());
 modal.addEventListener('pointerdown',e=>{if(e.target===modal)nmProduct.close()});
 document.getElementById('nm6-license-activate')?.addEventListener('click',async()=>{
  const status=document.getElementById('nm6-plan-current');const key=document.getElementById('nm6-license-input').value.trim();if(!key){status.textContent=nmT('enterKey');return}
  status.textContent='…';try{await nmProduct.activate(key);nmProduct.syncBadge();document.getElementById('nm6-license-input').value=''}catch(e){status.textContent=e.message}
 });
 document.getElementById('nm6-license-logout')?.addEventListener('click',async()=>{
  const pair=(it,en)=>window.GlaukaI18n?.pair(it,en)||(nmLocale()==='it'?it:en);
  const message=document.querySelector('#glauka-license-management p')?.textContent||nmT('logout');
  const ask=window.neuroMapApp?.nmAsk;
  const answer=ask?await ask.call(window.neuroMapApp,{title:pair('Disattivare la licenza?','Deactivate this license?'),message,choices:[{value:'cancel',text:pair('Annulla','Cancel')},{value:'deactivate',text:pair('Disattiva','Deactivate'),danger:true}]}):(window.confirm(message)?'deactivate':'cancel');
  if(answer!=='deactivate')return;
  try{await nmProduct.logout();document.getElementById('nm6-license-input')?.focus()}catch(e){document.getElementById('nm6-plan-current').textContent=e.message}
 });
/* @neuromap-shell-home */
 // Prevent click-through to AI actions while Free. The server independently enforces entitlement.
 document.addEventListener('click',e=>{
  const target=e.target.closest?.('#btn-ai-settings,#btn-ai-expand,#btn-ai-explain,#btn-ai-audit,#nm5-study-ai,#flash-ai-generate,#ai-test,#ai-models');
  if(target&&!nmProduct.isPro()){e.preventDefault();e.stopImmediatePropagation();nmProduct.open()}
 },true);
 // One incremental observer translates newly opened UI without touching authored content.
 window.GlaukaI18n?.observe();
}
// Install product chrome after NeuroMap constructor has completed its own boot.

