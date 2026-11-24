/* NeuroMap 6.19.0: Map Recall + offline Quiz. Canvas masking never edits
 * node.text, layouts, images, or the original .neuromap/.xmind contents.
 */
(function(root){
 'use strict';
 const K=root.NeuroMapLearningCore;
 if(!K)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? ((document.documentElement.lang||'it').toLowerCase().startsWith('en')?en:it));
 const el=(tag,cls='',label='')=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(label)n.textContent=label;
  return n;
 };
 const css=String.raw`
 #nm-learn-panel{position:fixed;z-index:2300;right:12px;top:var(--nm-workspace-chrome-bottom,96px);bottom:12px;
  width:min(390px,calc(100vw - 24px));max-height:none;
  box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;align-content:start;gap:0;
  background:var(--nm-skin-surface,#132139);color:var(--nm-skin-ink,#edf2fa);border:1px solid var(--nm-skin-stroke,#74869e);
  border-radius:16px;padding:0;box-shadow:0 16px 44px #0009;
  font:13px/1.45 system-ui,sans-serif}
 #nm-learn-panel[hidden]{display:none!important}
 #nm-learn-panel header{display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative;z-index:2;background:var(--nm-skin-surface,#132139)}
 #nm-learn-panel header strong{font-size:14px}
 #nm-learn-panel button,#nm-learn-panel select{border-radius:9px;
  padding:8px 10px;border:1px solid var(--nm-skin-stroke,#74869e);background:var(--nm-skin-top,#1f2d48);color:var(--nm-skin-ink,#edf2fa);font:inherit}
 #nm-learn-panel button{cursor:pointer}
 #nm-learn-panel button:hover:not(:disabled):not(.nm-learn-current){background:var(--nm-navigation-hover,var(--nm-skin-top,#1f2d48));border-color:var(--nm-theme-focus,#b5a6ff)}
 #nm-learn-panel button:disabled{opacity:.5;cursor:default}
 #nm-learn-panel button:focus-visible,#nm-learn-panel select:focus-visible{
  outline:2px solid var(--nm-theme-focus,#b5a6ff);outline-offset:2px}
 #nm-learn-panel .nm-learn-commands{display:grid;gap:8px;flex:0 0 auto}
 #nm-learn-panel .nm-learn-tabs,#nm-learn-panel .nm-learn-row{
  display:flex;flex-wrap:wrap;gap:7px}
 #nm-learn-panel .nm-learn-tabs{position:static;top:auto}
 #nm-learn-panel .v4-secondary{width:max-content}
 #nm-learn-panel button.v4-primary{font-weight:700}
 #nm-learn-panel .nm-learn-tabs button{flex:1}
 html body.nm-workspace-v2[data-nm-skin] #nm-learn-panel button.nm-learn-current{border-color:var(--nm-theme-focus,#5b3fd0)!important;background-color:var(--nm-theme-action,#5b3fd0)!important;color:#fff!important}
 #nm-learn-panel .nm-learn-muted{color:var(--nm-skin-muted,#b8c5d9);font-size:12px;overflow-wrap:anywhere}

 /* A native progress element always reflects the question currently on screen. */
 #nm-learn-panel .nm-learn-progress{
  appearance:none;display:block;width:100%;height:7px;margin:3px 0 8px;
  overflow:hidden;border:0;border-radius:99px;
  background:var(--nm-ui-line,var(--nm-skin-stroke,#526584));
 }
 #nm-learn-panel .nm-learn-progress::-webkit-progress-bar{
  background:var(--nm-ui-line,var(--nm-skin-stroke,#526584));border-radius:99px
 }
 #nm-learn-panel .nm-learn-progress::-webkit-progress-value{
  background:var(--nm-ui-accent,var(--nm-theme-focus,#9db2f8));border-radius:99px
 }
 #nm-learn-panel .nm-learn-progress::-moz-progress-bar{
  background:var(--nm-ui-accent,var(--nm-theme-focus,#9db2f8));border-radius:99px
 }

 #nm-learn-panel .nm-learn-quiz{display:grid;gap:9px}
 #nm-learn-panel .nm-learn-question{font-weight:650;font-size:15px;line-height:1.45}
 #nm-learn-panel .nm-learn-options{display:grid;gap:6px}
 #nm-learn-panel .nm-learn-answer{white-space:pre-wrap;overflow-wrap:anywhere;
  border:1px solid var(--nm-skin-stroke,#74869e);border-radius:9px;padding:11px;background:var(--nm-skin-top,#1f2d48)}
 #nm-learn-panel .nm-learn-explain{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
 #nm-learn-panel .nm-learn-draft{display:grid;gap:6px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:12px;padding:8px}
 #nm-learn-panel .nm-learn-draft textarea{min-height:64px;resize:vertical}
 @media(max-width:980px),(max-height:560px){
  #nm-learn-panel{top:64px;width:min(340px,calc(100vw - 16px));padding:10px;gap:8px}
  #nm-learn-panel .nm-learn-question{font-size:14px}
 }
 #nm-learn-panel .nm-learn-summary{background:var(--nm-skin-top,#1f2d48);border-radius:9px;
  padding:9px;color:var(--nm-skin-ink,#edf2fa)}
 /* Stable columns and a reserved scrollbar prevent the Exam view from
    resizing the navigation or wrapping Map Recall onto a second line. */
 #nm-learn-panel{overflow:hidden;
  background:var(--nm-ui-surface,var(--nm-skin-surface,#ffffff));color:var(--nm-ui-ink,var(--nm-skin-ink,#141926));
  border-color:var(--nm-ui-line,var(--nm-skin-stroke,#d7deed))}
 #nm-learn-panel>*{min-width:0;max-width:100%;box-sizing:border-box}
 #nm-learn-panel p{margin:0;line-height:1.55}
 #nm-learn-panel header strong{font-size:14px;line-height:20px;font-weight:700}
 #nm-learn-panel .nm-learn-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;background:transparent}
 #nm-learn-panel .nm-learn-tabs button{min-width:0;min-height:42px;padding:7px 6px;
  white-space:normal;font-size:12px;line-height:1.25;font-weight:650}
 #nm-learn-panel .nm-learn-field{display:grid;gap:5px;min-width:0;
  font-size:12px;line-height:1.45;color:var(--nm-ui-muted,var(--nm-skin-muted,#5c6680))}
 #nm-learn-panel :is(input,select){box-sizing:border-box;width:100%;min-width:0;
  min-height:38px;margin:0;padding:7px 10px;border:1px solid var(--nm-ui-line,var(--nm-skin-stroke,#d7deed));
  border-radius:9px;background:var(--nm-ui-top,var(--nm-skin-top,#f4f6fc));color:var(--nm-ui-ink,var(--nm-skin-ink,#141926));
  font:13px/1.4 system-ui;color-scheme:inherit}
 #nm-learn-panel :is(input,select,button):focus-visible{outline:2px solid var(--nm-theme-focus,#7c5ce7);outline-offset:2px}
 #nm-learn-panel input[type=checkbox],#nm-learn-panel input[type=radio]{width:auto;min-height:0}
 #nm-learn-panel button{min-width:0;max-width:100%;overflow-wrap:anywhere;line-height:1.4}
 #nm-learn-panel .nm-learn-row{gap:7px}
 #nm-learn-panel :is(.nm-learn-plan-form,.nm-learn-adaptive-list){display:grid;gap:10px;min-width:0}
 #nm-learn-panel .nm-learn-plan-form{grid-template-columns:repeat(2,minmax(0,1fr));align-items:end}
 #nm-learn-panel :is(.nm-learn-plan-day,.nm-learn-adaptive-row){display:grid;gap:7px;padding:11px;
  border:1px solid var(--nm-ui-line,var(--nm-skin-stroke,#d7deed));border-radius:11px;background:var(--nm-ui-top,var(--nm-skin-top,#f4f6fc));min-width:0}
 #nm-learn-panel .nm-learn-plan-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px}
 #nm-learn-panel .nm-learn-plan-heading time{font-weight:700;font-size:13px;color:var(--nm-ui-ink,var(--nm-skin-ink,#141926))}
 #nm-learn-panel .nm-learn-plan-count{font-size:11px;white-space:nowrap;color:var(--nm-ui-muted,var(--nm-skin-muted,#5c6680))}
 #nm-learn-panel .nm-learn-plan-topics{display:grid;gap:5px;margin:0;padding-left:16px;
  color:var(--nm-ui-muted,var(--nm-skin-muted,#5c6680));font-size:12px;line-height:1.5;overflow-wrap:anywhere}
 #nm-learn-panel .nm-learn-adaptive-row small{display:block;line-height:1.5}
 #nm-learn-panel .nm-learn-unified-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
 #nm-learn-panel .nm-learn-stat{display:grid;gap:2px;padding:9px 10px;border-radius:10px;
  border:1px solid var(--nm-ui-line,var(--nm-skin-stroke,#d7deed));background:var(--nm-ui-top,var(--nm-skin-top,#f4f6fc))}
 #nm-learn-panel .nm-learn-stat strong{font-size:16px;line-height:1.15;color:var(--nm-theme-action,#5b3fd0)}
 #nm-learn-panel .nm-learn-stat span{font-size:11px;color:var(--nm-ui-muted,var(--nm-skin-muted,#5c6680))}
 #nm-learn-panel .nm-learn-toolbox{display:grid;gap:8px;padding:11px;border-radius:12px;margin-top:4px;
  border:1px solid var(--nm-ui-line,var(--nm-skin-stroke,#d7deed));
  background:var(--nm-ui-top,var(--nm-skin-top,#f4f6fc))}
 #nm-learn-panel .nm-learn-toolbox>summary{cursor:pointer;font-weight:700;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;list-style:none}
 #nm-learn-panel .nm-learn-toolbox>summary::-webkit-details-marker{display:none}
 #nm-learn-panel .nm-learn-toolbox-note{font-size:11.5px;color:var(--nm-ui-muted,var(--nm-skin-muted,#5c6680));line-height:1.4}
 #nm-learn-panel .nm-learn-toolbox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
 #nm-learn-panel .nm-learn-tool-card{display:flex!important;align-items:flex-start!important;gap:8px;text-align:left!important;
  padding:9px!important;min-height:54px!important;border-radius:10px!important;
  background:var(--nm-ui-surface,var(--nm-skin-surface,#ffffff))!important;
  border:1px solid var(--nm-ui-line,var(--nm-skin-stroke,#d7deed))!important}
 #nm-learn-panel .nm-learn-tool-card:hover{border-color:var(--nm-theme-focus,#7c5ce7)!important}
 #nm-learn-panel .nm-learn-tool-icon{flex:0 0 22px;width:22px;height:22px;display:grid;place-items:center;
  border-radius:7px;color:var(--nm-theme-action,#5b3fd0);background:color-mix(in srgb,var(--nm-theme-action,#5b3fd0) 11%,transparent)}
 #nm-learn-panel .nm-learn-tool-icon svg{width:15px;height:15px}
 #nm-learn-panel .nm-learn-tool-copy{display:grid;gap:2px;min-width:0}
 #nm-learn-panel .nm-learn-tool-copy strong{font-size:12px;font-weight:700;line-height:1.25}
 #nm-learn-panel .nm-learn-tool-copy small{font-size:10.5px;line-height:1.3;color:var(--nm-ui-muted,var(--nm-skin-muted,#5c6680))}
 @media(max-width:420px){
  #nm-learn-panel{padding:12px;gap:10px}
  #nm-learn-panel .nm-learn-tabs button{font-size:11px}
  #nm-learn-panel .nm-learn-plan-form,#nm-learn-panel .nm-learn-toolbox-grid{grid-template-columns:minmax(0,1fr)}
 }
 body[data-nm-skin-readability="comfortable"] #nm-learn-panel :is(button,input,select){min-height:44px;font-size:14px}
 body[data-nm-skin-readability="comfortable"] #nm-learn-panel .nm-learn-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}
 #nm-learn-open{border-color:var(--nm-theme-focus,#b5a6ff)!important}
 @media(max-width:520px){#nm-learn-panel{top:76px;max-height:calc(100dvh - 87px)}}
 `;
 function install(App,Renderer){
  if(App.prototype._nmLearnInstalled)return;
  App.prototype._nmLearnInstalled=true;
  // Mask only the paint operation. The renderer still measures and lays out
  // original labels, and state snapshots remain byte-for-byte unchanged.
  const paint=Renderer.prototype.drawIllustratedLabel;
  Renderer.prototype.drawIllustratedLabel=function(ctx,node,m,offsetY){
   const mask=this._nmLearnRecall,id=node.logicalId||node.id;
   if(mask?.hiddenIds?.has(id)){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#7dd3fc';ctx.font='700 '+Math.max(12,Math.min(20,m.fontSize||15))+'px system-ui';
    const mark=this.devicePoint?this.devicePoint(m.x,m.y+(offsetY||0)):{x:m.x,y:m.y+(offsetY||0)};
    ctx.fillText('?',mark.x,mark.y);
    ctx.restore();return;
   }
   return paint.call(this,ctx,node,m,offsetY);
  };
  const bind=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const value=bind.apply(this,args);mount(this);return value};
  for(const name of ['activateTab','closeTab']){
   const old=App.prototype[name];
   App.prototype[name]=function(...args){
    // A different map cannot inherit another map's hidden-label set or quiz.
    if(name==='closeTab'&&this._nmLearning?.visible&&this._nmLearning.confirmLeaveSync?.()===false)return;
    if(this._nmLearning?.visible)this._nmLearning.stop();
    return old.apply(this,args);
   };
  }
 }
 function mount(app){
  if(app._nmLearning)return;
  const style=el('style');style.textContent=css;document.head.append(style);
  const trigger=el('button','v4-tool-btn');
  trigger.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15M6 8h3M6 12h3M15 8h3M15 12h3"/></svg>';
  trigger.id='nm-learn-open';trigger.type='button';
  trigger.setAttribute('aria-controls','nm-learn-panel');trigger.setAttribute('aria-expanded','false');
  const labelTrigger=()=>trigger.setAttribute('aria-label',tr('Studio e ripasso','Study and review'));
  labelTrigger();root.NeuroMapWorkspaceLocale?.watch(labelTrigger);
  const labelHelp=()=>{trigger.setAttribute('aria-description',tr('Studia la mappa: ripeti a memoria, fai un quiz e prepara l’esame.','Study the map: recall concepts, take a quiz and prepare for an exam.'));trigger.removeAttribute('title')};labelHelp();root.NeuroMapWorkspaceLocale?.watch(labelHelp);
  const dock=document.getElementById('nm614-right-dock')||
    document.querySelector('.v4-toolstrip')||document.body;
  dock.append(trigger);
  const panel=el('section');panel.id='nm-learn-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Studia con Glauka');
  const head=el('header'),title=el('strong','',tr('Studia la mappa','Study the map'));
  if(typeof document.createElementNS==='function'){
   const ns='http://www.w3.org/2000/svg',hIcon=document.createElementNS(ns,'svg');
   hIcon.setAttribute('viewBox','0 0 24 24');hIcon.setAttribute('width','18');hIcon.setAttribute('height','18');
   hIcon.setAttribute('fill','none');hIcon.setAttribute('stroke','currentColor');hIcon.setAttribute('stroke-width','1.85');
   hIcon.setAttribute('stroke-linecap','round');hIcon.setAttribute('stroke-linejoin','round');
   hIcon.setAttribute('aria-hidden','true');hIcon.classList.add('nm-workspace-icon');
   for(const d of ['M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z','M12 5v15','M6 8h3M6 12h3M15 8h3M15 12h3']){
    const p=document.createElementNS(ns,'path');p.setAttribute('d',d);hIcon.append(p);
   }
   head.append(hIcon);
  }
  const close=el('button','','×');close.id='nm-learn-close';close.type='button';close.title=tr('Chiudi','Close');close.setAttribute('aria-label',close.title);
  head.append(title,close);
  const tabs=el('div','nm-learn-tabs');
  const recallBtn=el('button','',tr('Ripeti a memoria','Recall concepts'));
  const quizBtn=el('button','',tr('Quiz','Quiz'));
  const radarBtn=el('button','',tr('Da ripassare','Review mistakes'));
  const plannerBtn=el('button','',tr('Esame','Exam'));
  recallBtn.type=quizBtn.type=radarBtn.type=plannerBtn.type='button';
  tabs.append(recallBtn,quizBtn,radarBtn,plannerBtn);
  const commands=el('div','nm-learn-commands nm-panel-fixed');
  const scopeLabel=el('label','nm-learn-muted nm-learn-field nm-learn-scope');
  const scopeCaption=el('span','',tr('Ambito dello studio','Study scope'));
  const scope=el('select');scope.setAttribute('aria-label',tr('Ambito','Scope'));
  for(const [key,it,en] of [['all','Mappa intera','Entire map'],['selected','Ramo selezionato','Selected branch'],['node','Nodo selezionato','Selected node']]){
   const opt=el('option','',tr(it,en));opt.value=key;scope.append(opt);
  }
  scopeLabel.append(scopeCaption,scope);
  commands.append(tabs,scopeLabel);
  function translateShell(){
   recallBtn.textContent=tr('Ripeti a memoria','Recall concepts');radarBtn.textContent=tr('Da ripassare','Review mistakes');title.textContent=tr('Studia la mappa','Study the map');
   plannerBtn.textContent=tr('Esame','Exam');
   scopeCaption.textContent=tr('Ambito dello studio','Study scope');
   scope.setAttribute('aria-label',tr('Ambito','Scope'));
   scope.children[0].textContent=tr('Mappa intera','Entire map');
   scope.children[1].textContent=tr('Ramo selezionato','Selected branch');
   scope.children[2].textContent=tr('Nodo selezionato','Selected node');
   close.title=tr('Chiudi','Close');close.setAttribute('aria-label',close.title);
   const question=body.querySelector('.nm-learn-question'),item=session.quiz?.items[session.quiz.index];
   if(question&&item)question.textContent=questionText(item);
  }
  root.NeuroMapWorkspaceLocale?.watch(translateShell);
  const offline=el('p','nm-learn-muted');
  const labelOffline=()=>offline.textContent=tr('Ripasso offline · Senza AI. Le domande si basano sui tuoi rami e appunti: controlla le risposte nelle fonti. Non è una verifica automatica dei contenuti.','Offline review · No AI. Questions use your branches and notes: check answers against your sources. This does not automatically verify the content.');
  labelOffline();root.NeuroMapWorkspaceLocale?.watch(labelOffline);
  const intro=el('p','nm-learn-muted'),status=el('p','nm-learn-summary');
  status.setAttribute('aria-live','polite');
  const controls=el('div','nm-learn-row'),body=el('div','nm-learn-quiz');
  const toolbox=el('details','nm-learn-toolbox');toolbox.open=true;
  const toolboxTitle=el('summary','',tr('Strumenti di studio collegati','Connected study tools'));
  const toolboxNote=el('p','nm-learn-toolbox-note',tr('Flashcard, punti sulle immagini e lettura sequenziale lavorano sui tuoi rami e aggiornano Da ripassare.','Flashcards, image hotspots, and guided reading work on your real branches and feed Review mistakes.'));
  const toolboxGrid=el('div','nm-learn-toolbox-grid');
  function toolIconSvg(paths){
   if(typeof document.createElementNS!=='function')return null;
   const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');
   s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');
   s.setAttribute('stroke-width','1.8');s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');
   s.setAttribute('aria-hidden','true');
   for(const d of paths){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p)}
   return s;
  }
  const connectedTools=[
   {id:'flash',paths:['M3 4h14v15H3zM7 1h14v15','M8 9a2 2 0 0 1 4 0c0 2-2 1-2 3'],it:'Domande e risposte',en:'Flashcards',hintIt:'Schede SM-2',hintEn:'SM-2 deck',run:()=>document.getElementById('btn-flashcards')?.click()},
   {id:'visual',paths:['M3 3h18v18H3z','M4 17l5-5 4 4 3-3 4 4'],it:'Ripassa su immagini',en:'Study with images',hintIt:'Quiz visivo hotspot',hintEn:'Hotspot quiz',run:()=>{if(app._nmVisualStudy?.open)app._nmVisualStudy.open();else document.getElementById('nm-tool-visual-study')?.click()}},
   {id:'schedule',paths:['M3 5h18v16H3zM3 10h18M7 2v6M17 2v6'],it:'Scadenze dei ripassi',en:'Review schedule',hintIt:'Radar completo SM-2',hintEn:'Full SM-2 radar',run:()=>app._nmKnowledge?.open?.('radar',{fromStudy:true})},
   {id:'journey',paths:['M4 4h7v6H4zM13 14h7v6h-7z','M11 7h5v7'],it:'Leggi passo passo',en:'Read step by step',hintIt:'Percorso guidato',hintEn:'Guided reading flow',run:()=>app._nmKnowledge?.open?.('journey',{fromStudy:true})},
   {id:'compare',paths:['M2 4h8v16H2zM14 4h8v16h-8z'],it:'Confronta due rami',en:'Compare branches',hintIt:'Analisi affiancata',hintEn:'Side-by-side diff',run:()=>document.getElementById('nm616-compare-open')?.click()},
   {id:'anki',paths:['M5 2h14v20H5z','M8 8h8M8 15h8'],it:'Scambia con Anki',en:'Exchange with Anki',hintIt:'Import / export TSV',hintEn:'TSV deck swap',run:()=>document.getElementById('nm-tool-anki')?.click()}
  ];
  toolboxGrid._items=[];
  for(const item of connectedTools){
   const b=el('button','nm-learn-tool-card');b.type='button';if(b.dataset)b.dataset.studioTool=item.id;
   const ic=el('span','nm-learn-tool-icon');
   const svg=toolIconSvg(item.paths);if(svg)ic.append(svg);
   const cp=el('span','nm-learn-tool-copy');
   const ttl=el('strong','',tr(item.it,item.en)),sub=el('small','',tr(item.hintIt,item.hintEn));
   cp.append(ttl,sub);b.append(ic,cp);
   b.addEventListener('click',item.run);
   toolboxGrid.append(b);
   toolboxGrid._items.push({item,ttl,sub});
  }
  toolbox.append(toolboxTitle,toolboxNote,toolboxGrid);
  const refreshToolboxText=()=>{
   toolboxTitle.textContent=tr('Strumenti di studio collegati','Connected study tools');
   toolboxNote.textContent=tr('Flashcard, punti sulle immagini e lettura sequenziale lavorano sui tuoi rami e aggiornano Da ripassare.','Flashcards, image hotspots, and guided reading work on your real branches and feed Review mistakes.');
   for(const row of toolboxGrid._items){
    row.ttl.textContent=tr(row.item.it,row.item.en);
    row.sub.textContent=tr(row.item.hintIt,row.item.hintEn);
   }
  };
  root.NeuroMapWorkspaceLocale?.watch(refreshToolboxText);
  panel.append(head,commands,offline,intro,controls,status,body,toolbox);
  document.body.append(panel);
  const session={visible:false,mode:'recall',mask:null,quiz:null,stop:()=>{
   resetRecallPointer();
   if(session.mask){
    app.renderer._nmLearnRecall=null;
    session.mask=null;app.requestRender?.();
   }
   if(session.inspectorClosed){
    document.getElementById('inspector-sidebar')?.classList.remove('collapsed');
    session.inspectorClosed=false;
   }
   session.quiz=null;
   root.NeuroMapAdaptiveUI?.clearBadges(app);
   session.visible=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');
  }};
  session.confirmLeaveSync=()=>{
   const busy=(session.quiz&&session.quiz.index<session.quiz.items.length)||!!session.mask;
   if(!busy)return true;
   const ask=root.confirm;
   if(typeof ask!=='function')return true;
   return ask(tr('C’è un ripasso aperto. Chiuderlo? Le carte già salvate restano.','A review is open. Close it? Saved cards stay.'))!==false;
  };
  app._nmLearning=session;
  function button(text,callback,parent=controls){
   const b=el('button','',text);b.type='button';b.addEventListener('click',callback);
   parent.append(b);return b;
  }
  function scopeId(){
   if(scope.value==='node'||scope.value==='selected')return app.state.selectedNodeId||app.state.root.id;
   return app.state.root.id;
  }
  function message(text){status.textContent=text}
  function valid(){
   return session.mask?.tabId===app.activeTabId&&session.mask.state===app.state;
  }
  function endRecall(){
   resetRecallPointer();
   if(session.mask){app.renderer._nmLearnRecall=null;session.mask=null;app.requestRender?.()}
   if(session.inspectorClosed){
    document.getElementById('inspector-sidebar')?.classList.remove('collapsed');
    session.inspectorClosed=false;
   }
  }
  function recallStatus(){
   const x=session.mask;if(!x)return;
   message(tr('Rivelati: ','Revealed: ')+(x.total-x.hiddenIds.size)+' / '+x.total+
    tr(' · clicca un nodo nascosto per scoprirlo.',' · click a hidden node to reveal it.'));
  }
/* @neuromap-learn-ui-session */
  function resetRecallPointer(){
   if(recallDrag&&app.canvas.hasPointerCapture?.(recallDrag.pointerId))
    app.canvas.releasePointerCapture(recallDrag.pointerId);
   recallDrag=null;
   app.canvas.style.cursor='grab';
  }
  const captureRecall=e=>session.visible&&valid()&&
    (e.type==='pointerdown'||recallDrag?.pointerId===e.pointerId||
     ['click','dblclick','contextmenu'].includes(e.type));
  for(const name of ['pointerdown','pointermove','pointerup','pointercancel','click','dblclick','contextmenu']){
   app.canvas.addEventListener(name,e=>{
    if(!captureRecall(e))return;
    if(name==='pointerdown'){
     if(e.button!==0&&e.button!==1)return;
     const hit=app.findHit?.(e.clientX,e.clientY);
     recallDrag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,
       cameraX:app.renderer.camera.x,cameraY:app.renderer.camera.y,moved:false,
       revealId:e.button===0&&hit?.type==='node'?(hit.item.logicalId||hit.item.id):null};
     try{app.canvas.setPointerCapture?.(e.pointerId);}catch{ /* synthetic test or lost pointer */ }
     app.canvas.style.cursor='grabbing';
    }else if(name==='pointermove'&&recallDrag?.pointerId===e.pointerId){
     const dx=e.clientX-recallDrag.startX,dy=e.clientY-recallDrag.startY;
     if(Math.hypot(dx,dy)>6)recallDrag.moved=true;
     if(recallDrag.moved){
      app.renderer.camera.x=recallDrag.cameraX+dx;
      app.renderer.camera.y=recallDrag.cameraY+dy;
      app.requestRender?.();
     }
    }else if((name==='pointerup'||name==='pointercancel')&&recallDrag?.pointerId===e.pointerId){
     const drag=recallDrag;recallDrag=null;
     if(app.canvas.hasPointerCapture?.(e.pointerId))app.canvas.releasePointerCapture(e.pointerId);
     app.canvas.style.cursor='grab';
     if(name==='pointerup'&&!drag.moved&&drag.revealId&&session.mask.hiddenIds.delete(drag.revealId)){
      app.requestRender?.();recallStatus();
     }
    }
    e.preventDefault();e.stopImmediatePropagation();
   },true);
  }
  document.addEventListener('keydown',e=>{
   if(!session.visible)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePanel();return}
   if(session.mask && !panel.contains(e.target)){
    // Disabled editing is temporary; the map is not changed by study controls.
    if(!['Tab','Shift','Control','Alt','Meta'].includes(e.key)){
     e.preventDefault();e.stopImmediatePropagation();
    }
   }
  },true);
  panel.addEventListener('keydown',e=>e.stopPropagation());
  root.addEventListener?.('pagehide',()=>session.stop());
 }
 root.NeuroMapLearningUI=Object.freeze({install});
})(typeof globalThis!=='undefined'?globalThis:this);
