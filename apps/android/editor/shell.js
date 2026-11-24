function nm6InjectShell(){
 const style=document.createElement('style');style.textContent=`
 #nm6-plan-modal [hidden]{display:none!important}
 #glauka-license-management{margin-top:16px;border-top:1px solid var(--nm-ui-line,#64748b);padding-top:12px}
 #glauka-license-management summary{cursor:pointer;font-weight:700}
 #glauka-license-management p{font-size:12px;line-height:1.6}
 .nm6-actions{display:flex;align-items:center;gap:5px;flex-shrink:0}
 .nm6-mini{border:1px solid var(--nm-skin-stroke,#d7d0eb);background:var(--nm-skin-top,#f5f2ff);color:var(--nm-skin-ink,#221c3d);padding:6px 10px;border-radius:10px;font:700 11px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
 .nm6-mini:hover{border-color:var(--nm-theme-focus,#6441df);background:var(--nm-ui-hover,#ebe4ff)}.nm6-mini.nm6-pro{color:var(--nm-theme-on-action,#fff);background:var(--nm-theme-action,#6441df);border-color:var(--nm-theme-action,#6441df)}
 .nm6-shade{position:fixed;inset:0;background:rgba(18,14,34,.46);backdrop-filter:blur(8px);z-index:260;display:grid;place-items:center;padding:18px}
 .nm6-shade.hidden{display:none}.nm6-modal{color:var(--nm-skin-ink,#1d1836);width:min(720px,100%);max-height:min(93vh,830px);overflow:auto;border:1px solid var(--nm-skin-stroke,#d9d2ec);background:var(--nm-skin-surface,#ffffff);border-radius:22px;padding:24px;box-shadow:0 24px 72px rgba(28,20,56,.2);font:400 14px/1.55 Inter,system-ui,sans-serif}.nm6-modal details{margin-top:12px}.nm6-modal summary{cursor:pointer;font-weight:700;color:var(--nm-skin-ink,#1d1836)}
 .nm6-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.nm6-eyebrow{font:800 10px system-ui;letter-spacing:.17em;text-transform:uppercase;color:var(--nm-theme-action,#6441df)}.nm6-title{font:800 clamp(21px,3vw,27px)/1.2 system-ui;color:var(--nm-skin-ink,#1d1836);margin:6px 0 4px}.nm6-desc{color:var(--nm-skin-muted,#5d5775);margin:4px 0 16px;font-size:13px}
 .nm6-close{width:34px;height:34px;flex:none;background:var(--nm-skin-top,#f5f2ff);border:1px solid var(--nm-skin-stroke,#d7d0eb);border-radius:10px;color:var(--nm-skin-ink,#1d1836);cursor:pointer;font-size:20px;display:grid;place-items:center}
 .nm6-plans{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0 16px}.nm6-card{border-radius:16px;border:1px solid var(--nm-skin-stroke,#d7d0eb);background:var(--nm-skin-top,#f7f5fc);padding:16px 17px;min-height:132px;display:flex;flex-direction:column;gap:6px}.nm6-card.pro{background:color-mix(in srgb,var(--nm-theme-action,#6441df) 7%,var(--nm-skin-surface,#ffffff));border:1.5px solid color-mix(in srgb,var(--nm-theme-action,#6441df) 46%,var(--nm-skin-stroke,#d7d0eb));box-shadow:0 6px 20px color-mix(in srgb,var(--nm-theme-action,#6441df) 10%,transparent)}.nm6-card h3{margin:0;color:var(--nm-skin-ink,#1d1836);font-size:17px;font-weight:800;display:flex;align-items:center;gap:6px}.nm6-card.pro h3{color:var(--nm-theme-action,#6441df)}.nm6-card p{margin:0;color:var(--nm-skin-muted,#4c4666);font-size:12.5px;line-height:1.55}.nm6-planline{font-size:12px;color:var(--nm-theme-action,#6441df);margin-top:10px}
 .nm6-form{background:var(--nm-skin-top,#f7f5fc);border:1px solid var(--nm-skin-stroke,#d7d0eb);padding:14px 16px;border-radius:15px}.nm6-form label{display:block;margin-bottom:8px;color:var(--nm-skin-ink,#1d1836);font-weight:700;font-size:13px}.nm6-fieldrow{display:flex;gap:8px}.nm6-fieldrow input{min-width:0;flex:1;background:var(--nm-skin-surface,#ffffff);border:1px solid var(--nm-skin-stroke,#cfc7e6);color:var(--nm-skin-ink,#1d1836);padding:10px 12px;border-radius:10px;font-size:12.5px}.nm6-cta{background:var(--nm-theme-action,#6441df);border:none;color:var(--nm-theme-on-action,#ffffff);border-radius:10px;padding:10px 15px;font-weight:750;cursor:pointer;white-space:nowrap}.nm6-cta:hover{filter:brightness(1.06)}.nm6-status{min-height:18px;margin:8px 0 0;color:var(--nm-skin-muted,#5d5775);font-size:12px;font-weight:600}.nm6-ghost{cursor:pointer;border:1px solid var(--nm-skin-stroke,#d7d0eb);background:var(--nm-skin-top,#f5f2ff);color:var(--nm-skin-ink,#221c3d);border-radius:10px;padding:9px 14px;font-weight:700;margin-top:10px}
 .nm6-welcome{max-width:660px}.nm6-welcome .nm6-hero{width:61px;height:61px;border-radius:19px;background:linear-gradient(135deg,#6441df,#8b5cf6);color:#fff;display:grid;place-items:center;font-size:30px;box-shadow:0 14px 40px rgba(100,65,223,.26)}.nm6-welcome-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.nm6-small{font-size:12px;color:var(--nm-skin-muted,#5d5775);margin:8px 0 0;line-height:1.5}
 body[data-gl-android-theme="dark"] .nm6-modal{--nm-skin-surface:#1c192b;--nm-skin-top:#242038;--nm-skin-stroke:#3b3559;--nm-skin-ink:#efeaff;--nm-skin-muted:#b5add1;--nm-theme-action:#8b6cf6}
 @media(max-width:600px){.nm6-modal{padding:17px;border-radius:17px}.nm6-plans{grid-template-columns:1fr}.nm6-card{min-height:0}.nm6-fieldrow{flex-wrap:wrap}.nm6-fieldrow input{flex-basis:100%}.nm6-fieldrow .nm6-cta{width:100%}}
 `;document.head.appendChild(style);
 const container=document.querySelector('.tabs-list')?.parentElement||document.querySelector('.topbar');
 if(container){const controls=document.createElement('div');controls.className='nm6-actions nm6-skiptranslate';controls.innerHTML='<button id="nm6-plan-button" type="button" class="nm6-mini nm6-pro">✦ PRO</button>';container.appendChild(controls)}
 const modal=document.createElement('div');modal.id='nm6-plan-modal';modal.className='nm6-shade hidden nm6-skiptranslate';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 modal.innerHTML=`<section class="nm6-modal" tabindex="0"><div class="nm6-head"><div><div class="nm6-eyebrow">GLAUKA</div><h2 id="nm6-plan-title" class="nm6-title"></h2><p id="nm6-plan-subtitle" class="nm6-desc"></p></div><button class="nm6-close" id="nm6-plan-close" aria-label="Close">×</button></div><div class="nm6-plans"><div class="nm6-card"><h3>✦ Free</h3><p id="nm6-plan-free"></p></div><div class="nm6-card pro"><h3>✦ Pro</h3><p id="nm6-plan-pro"></p></div></div><div class="nm6-form"><label for="nm6-license-input" id="nm6-license-label"></label><div class="nm6-fieldrow"><input id="nm6-license-input" autocomplete="off" spellcheck="false" placeholder="GLK1.…" maxlength="3072"/><button id="nm6-license-activate" class="nm6-cta"></button></div><div id="nm6-plan-current" class="nm6-status"></div></div><details class="nm6-form" id="nm6-plan-details"><summary id="nm6-plan-details-summary"></summary><p id="nm6-plan-hint" class="nm6-small"></p><p class="nm6-small" id="nm6-plan-buy"></p></details><button type="button" class="nm6-ghost" id="nm6-license-logout">Disattiva / Deactivate</button></section>`;
 const welcome=document.createElement('div');welcome.id='nm6-welcome';welcome.className='nm6-shade hidden nm6-skiptranslate';welcome.innerHTML=`<section class="nm6-modal nm6-welcome"><div class="nm6-hero">${globalThis.GlaukaBrand?.svg||"✦"}</div><h2 class="nm6-title" id="nm6-welcome-title"></h2><p class="nm6-desc" id="nm6-welcome-desc"></p><div class="nm6-welcome-actions"><button id="nm6-welcome-start" class="nm6-cta"></button><button id="nm6-welcome-import" class="nm6-ghost"></button></div><p class="nm6-small" id="nm6-welcome-privacy"></p></section>`;
 document.body.append(modal,welcome);
 const labels={
  'nm6-plan-title':'title','nm6-plan-subtitle':'subtitle','nm6-plan-free':'freeDesc','nm6-plan-pro':'proDesc','nm6-license-label':'license','nm6-license-activate':'activate','nm6-plan-details-summary':'detailsTitle','nm6-plan-hint':'activationHint','nm6-plan-buy':'buy','nm6-license-logout':'logout',
  'nm6-welcome-title':'welcomeTitle','nm6-welcome-desc':'welcomeDesc','nm6-welcome-start':'welcomeGo','nm6-welcome-import':'welcomeImport','nm6-welcome-small':'welcomeSmall','nm6-welcome-privacy':'privacy'};
 window.nm6ApplyLanguage=()=>{
  document.documentElement.lang=nmLocale();for(const [id,key] of Object.entries(labels)){const element=document.getElementById(id);if(element)element.textContent=nmT(key)}
  document.getElementById('nm6-plan-close')?.setAttribute('aria-label',nmT('close'));
  nmProduct.syncBadge();nm6Translate();window.neuroMapApp?.nmFormatLocale?.();
 };

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
 const finish=()=>{welcome.classList.add('hidden');localStorage.setItem('nm6_welcome_seen','1')};
 document.getElementById('nm6-welcome-start').addEventListener('click',finish);
 document.getElementById('nm6-welcome-import').addEventListener('click',()=>{finish();const app=window.neuroMapApp;app?.openProject?.()||document.getElementById('menu-import-file')?.click()});
 window.nm6ApplyLanguage();nmProduct.status();
 if(!localStorage.getItem('nm6_welcome_seen'))welcome.classList.remove('hidden');
 // Prevent click-through to AI actions while Free. The server independently enforces entitlement.
 document.addEventListener('click',e=>{
  const target=e.target.closest?.('#btn-ai-settings,#btn-ai-expand,#btn-ai-explain,#btn-ai-audit,#nm5-study-ai,#flash-ai-generate,#ai-test,#ai-models');
  if(target&&!nmProduct.isPro()){e.preventDefault();e.stopImmediatePropagation();nmProduct.open()}
 },true);
 // Translation applied incrementally to newly opened menus/modals.
 let translationScheduled=false;
 if(globalThis.GlaukaI18n){globalThis.GlaukaI18n.observe();globalThis.GlaukaAndroidLanguages?.mount();return;}
 const observer=new MutationObserver(records=>{if(translationScheduled||nmLocale()!=='en')return;if(records.some(x=>x.type==='childList'||x.type==='characterData')){
  translationScheduled=true;requestAnimationFrame(()=>{translationScheduled=false;nm6Translate()})}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}
// Install product chrome after NeuroMap constructor has completed its own boot.

