 function mount(app){
  if(document.getElementById('nm-distribution-controls'))return;
  const hud=document.querySelector('.hud-bottom-left');if(!hud)return;hud.style.maxHeight='calc(100vh - 150px)';hud.style.overflowY='auto';
  const panel=document.createElement('section');panel.id='nm-distribution-controls';panel.className='nm6-skiptranslate';panel.style.cssText='display:grid;gap:10px;margin:10px 0;padding-top:12px;border-top:1px solid var(--nm-skin-stroke,rgba(148,163,184,.3))';
  const intro=document.createElement('div');intro.id='nm-distribution-intro';intro.style.cssText='display:grid;gap:3px';
  const heading=document.createElement('strong');heading.style.cssText='font:750 13px var(--font-sans);color:var(--text-primary)';
  const teaser=document.createElement('small');teaser.style.cssText='color:var(--text-secondary);line-height:1.45';
  intro.append(heading,teaser);
  const limitLabel=document.createElement('label'),limit=document.createElement('input');limit.id='nm-distribution-height';limit.type='range';limit.min='480';limit.max='1680';limit.step='20';limit.style.cssText='width:100%;min-height:30px;accent-color:var(--nm-theme-focus,#a78bfa);cursor:ew-resize;touch-action:pan-y';
  const output=document.createElement('output');output.id='nm-distribution-limit-value';limitLabel.append(document.createTextNode(''),output,limit);
  // Precise number entry keeps the full technical range available;
  // +/-100 buttons provide an easy alternative to pixel-perfect dragging.
  const controls=document.createElement('div');controls.id='nm-distribution-precise';
  controls.style.cssText='display:flex;align-items:center;gap:7px;flex-wrap:wrap';
  const less=document.createElement('button');less.type='button';less.id='nm-distribution-less';
  const more=document.createElement('button');more.type='button';more.id='nm-distribution-more';
  const exact=document.createElement('input');exact.type='number';exact.id='nm-distribution-exact';
  exact.step='20';exact.min='480';exact.max=String(root.NeuroMapCore.ADAPTIVE_LIMIT_MAX||100000);
  exact.setAttribute('inputmode','numeric');
  exact.style.cssText='box-sizing:border-box;width:94px;min-height:34px;padding:6px 8px;border:1px solid var(--nm-skin-stroke,#66748d);border-radius:9px;background:var(--nm-skin-top,#19233e);color:var(--nm-skin-ink,#eef3ff);font:650 12px var(--font-sans);color-scheme:inherit';
  const unit=document.createElement('span');unit.textContent='px';
  unit.style.cssText='font:600 11px var(--font-sans);color:var(--text-secondary)';
  for(const button of [less,more])
   button.style.cssText='min-height:34px;min-width:55px;padding:7px 9px;border:1px solid var(--nm-skin-stroke,#66748d);border-radius:9px;background:var(--nm-skin-top,#19233e);color:var(--nm-skin-ink,#eef3ff);font:700 12px var(--font-sans);cursor:pointer';
  controls.append(less,exact,unit,more);
  // Keep the existing precise controls/handlers and IDs for power users,
  // but put them away from the everyday height slider.
  const advanced=document.createElement('details');
  advanced.id='nm-distribution-advanced';
  const advancedTitle=document.createElement('summary');
  advancedTitle.id='nm-distribution-advanced-title';
  advanced.append(advancedTitle,controls);
  const used=document.createElement('small');used.id='nm-distribution-actual';
  used.style.cssText='color:var(--text-secondary);line-height:1.5;font-weight:600';
  used.setAttribute('aria-live','polite');
  const legend=document.createElement('div');legend.id='nm-distribution-legend';
  legend.style.cssText='display:flex;gap:7px 14px;flex-wrap:wrap;font-size:10.5px;color:var(--text-secondary)';
  const chosenGuide=document.createElement('span');chosenGuide.id='nm-distribution-legend-chosen';
  const appliedGuide=document.createElement('span');appliedGuide.id='nm-distribution-legend-applied';
  for(const [el,color] of [[chosenGuide,'#fbbf24'],[appliedGuide,'#818cf8']]){
   el.style.cssText='display:inline-flex;align-items:center;gap:5px';
   const dash=document.createElement('span');dash.setAttribute('aria-hidden','true');
   dash.style.cssText='display:inline-block;width:22px;height:0;border-top:2px dashed '+color;
   const description=document.createElement('span');el.append(dash,description);
  }
  legend.append(chosenGuide,appliedGuide);
  const note=document.createElement('small');note.id='nm-distribution-explanation';note.style.cssText='color:var(--text-secondary);line-height:1.5';note.setAttribute('aria-live','polite');
  const forecast=document.createElement('section');forecast.id='nm620-layout-forecast';
  forecast.className='nm6-skiptranslate';
  forecast.style.cssText='display:grid;gap:7px;padding:11px 0 0;border-top:1px solid var(--nm-skin-stroke,rgba(148,163,184,.30))';
  forecast.setAttribute('aria-label',tr('Anteprima layout orario','Clockwise layout preview'));
  const forecastTitle=document.createElement('strong');forecastTitle.id='nm620-forecast-summary';
  forecastTitle.style.cssText='font-size:11px;letter-spacing:.02em;line-height:1.45';
  const rightLabel=document.createElement('small');rightLabel.id='nm620-forecast-right';
  const rightTrack=document.createElement('div');rightTrack.style.cssText='height:5px;border-radius:5px;background:rgba(148,163,184,.2);overflow:hidden';
  const rightFill=document.createElement('div');rightFill.id='nm620-forecast-right-bar';
  rightFill.style.cssText='height:100%;width:0;background:#818cf8;border-radius:5px;transition:width .15s ease';rightTrack.append(rightFill);
  const leftLabel=document.createElement('small');leftLabel.id='nm620-forecast-left';
  const leftTrack=document.createElement('div');leftTrack.style.cssText='height:5px;border-radius:5px;background:rgba(148,163,184,.2);overflow:hidden';
  const leftFill=document.createElement('div');leftFill.id='nm620-forecast-left-bar';
  leftFill.style.cssText='height:100%;width:0;background:#34d399;border-radius:5px;transition:width .15s ease';leftTrack.append(leftFill);
  const next=document.createElement('output');next.id='nm620-forecast-next';
  next.style.cssText='font-size:11px;line-height:1.45;color:var(--text-secondary)';
  next.setAttribute('aria-live','polite');
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
  const preview=document.createElement('button');preview.type='button';preview.id='nm620-preview-next';
  const guidesButton=document.createElement('button');guidesButton.type='button';guidesButton.id='nm620-show-guides';
  for(const button of [preview,guidesButton]){
   button.style.cssText='font:650 11px var(--font-sans);min-height:33px;padding:7px 9px;border-radius:8px;border:1px solid var(--nm-skin-stroke,rgba(165,177,228,.45));color:var(--text-primary);background:var(--nm-skin-top,rgba(94,93,160,.20));cursor:pointer';
   actions.append(button);
  }
  preview.addEventListener('click',()=>{
   const id=app.state.selectedNodeId||app.state.root.id;
   const prediction=app.layout.predictContinuation?.(id)||null;
   updateForecast(app,prediction);showGuides(app,3000);
  });
  guidesButton.addEventListener('click',()=>showGuides(app,3000));
  const help=document.createElement('small');help.id='nm620-forecast-help';help.style.cssText='font-size:11px;line-height:1.45;color:var(--text-secondary)';
  preview.setAttribute('aria-describedby',help.id);guidesButton.setAttribute('aria-describedby',help.id);
  forecast.append(forecastTitle,rightLabel,rightTrack,leftLabel,leftTrack,next,actions,help);
  const details=document.createElement('details');details.id='nm-distribution-details';
  details.style.cssText='border-top:1px solid var(--nm-skin-stroke,rgba(148,163,184,.30));padding-top:8px';
  const summary=document.createElement('summary');summary.id='nm-distribution-details-title';
  summary.style.cssText='font:650 11px var(--font-sans);color:var(--text-secondary);min-height:25px;cursor:pointer';
  details.append(summary,note);
  panel.append(intro,limitLabel,used,forecast,legend,advanced,details);(document.querySelector('.nm67-balance-note')||hud.lastElementChild).after(panel);
  const setExact=(value,source='exact',saveHistory=true)=>{
   const raw=Number(value);
   if(String(value).trim()===''||!Number.isFinite(raw)){
    exact.value=String(settings(app.state.root).height);
    return updatePanel(app);
   }
   const config=settings(app.state.root);
   const lower=Math.max(480,Number(config.minimumHeight)||480);
   const upper=Math.max(lower,Number(root.NeuroMapCore.ADAPTIVE_LIMIT_MAX)||100000);
   const min=source==='slider'?Math.max(lower,Number(limit.min)||lower):lower;
   const height=Math.max(min,Math.min(upper,Math.round(raw/20)*20));
   if(height!==config.height){
    if(saveHistory)app.state.pushHistory();
    app.state.root.layoutDistribution={...config,height};
    app.markChanged();showGuides(app);
   }
   updatePanel(app);
   if(source==='exact')exact.value=String(height);
  };
  const change=()=>setExact(limit.value,'slider',false);
  exact.addEventListener('change',()=>setExact(exact.value));
  exact.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault?.();setExact(exact.value)}});
  less.addEventListener('click',()=>setExact(settings(app.state.root).height-100));
  more.addEventListener('click',()=>setExact(settings(app.state.root).height+100));
  let gesture=false;limit.addEventListener('pointerdown',()=>{app.state.pushHistory();gesture=true;panel._dragActive=true;});limit.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))app.state.pushHistory();});limit.addEventListener('input',()=>{if(!gesture&&document.activeElement!==limit){app.state.pushHistory();gesture=true;panel._dragActive=true;}change();});limit.addEventListener('change',()=>{gesture=false;panel._dragActive=false;updatePanel(app)});
  for(const id of ['threshold-slider','menu-threshold-slider','nm67-compact-slider'])for(const event of ['input','pointerdown','keydown'])document.getElementById(id)?.addEventListener(event,e=>{if(event==='keydown'&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))return;showGuides(app)});
  for(const slider of [limit,...['threshold-slider','menu-threshold-slider','nm67-compact-slider'].map(id=>document.getElementById(id))])slider?.addEventListener('pointerdown',()=>{app._distributionGuideHeld=true;showGuides(app);});
  root.addEventListener("pointerdown",e=>{if(!isGuideControl(e.target))hideGuides(app);},true);
  root.addEventListener("keydown",e=>{if(e.key==="Escape"||!isGuideControl(e.target))hideGuides(app);},true);
  const release=()=>{if(app._distributionGuideHeld){app._distributionGuideHeld=false;showGuides(app);}};root.addEventListener('pointerup',release);root.addEventListener('pointercancel',()=>hideGuides(app));root.addEventListener('blur',()=>hideGuides(app));
  panel._localize=()=>{
   limitLabel.firstChild.nodeValue=tr('Altezza scelta · ','Chosen height · ');
   less.textContent='−100';less.setAttribute('aria-label',tr('Diminuisci di 100 pixel','Decrease by 100 pixels'));
   more.textContent='+100';more.setAttribute('aria-label',tr('Aumenta di 100 pixel','Increase by 100 pixels'));
   exact.setAttribute('aria-label',tr('Inserisci altezza in pixel','Enter height in pixels'));
   exact.setAttribute('title',tr('Scrivi un valore esatto e premi Invio','Type an exact value and press Enter'));
   heading.textContent=tr('Spazio dei rami','Branch spacing');
   teaser.textContent=tr('Scegli quando i nuovi rami continuano sul lato opposto.','Choose when new branches continue on the opposite side.');
   summary.textContent=tr('Dettagli del cambio lato','Side-switch details');
   advancedTitle.textContent=tr('Regolazione precisa (+/−100 px)','Precise adjustment (+/−100 px)');
   preview.textContent=tr('Prevedi il lato','Predict side');guidesButton.textContent=tr('Mostra le guide','Show guides');
   help.textContent=tr('La previsione non crea rami. Le guide scompaiono dopo 3 secondi.','Prediction adds no branches. Guides disappear after 3 seconds.');
   limit.setAttribute('aria-label',tr('Altezza prima del cambio lato','Height before switching sides'));updatePanel(app);
  };
  new MutationObserver(()=>panel._localize()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});panel._localize();
 }
 function updatePanel(app){
  const panel=document.getElementById('nm-distribution-controls');if(!panel||!app.state?.root)return;
  const config=settings(app.state.root),limit=document.getElementById('nm-distribution-height'),plan=app.layout.continuationPlan,radial=app.state.branchStyle==='radial';
  panel.hidden=radial||!config.enabled;
  limit.disabled=radial||!config.enabled;
  const floor=Math.max(480,Number(config.minimumHeight)||480);
  const ceiling=Math.max(floor,Number(root.NeuroMapCore.ADAPTIVE_LIMIT_MAX)||100000);
  if(!panel._dragActive&&document.activeElement!==limit){
   const range=sliderWindow(Number(config.height),floor,ceiling);
   limit.min=String(range.start);limit.max=String(range.end);
   limit.value=String(config.height);
  }
  const exact=document.getElementById('nm-distribution-exact');
  exact.disabled=radial||!config.enabled;exact.min=String(floor);exact.max=String(ceiling);
  if(document.activeElement!==exact)exact.value=String(config.height);
  for(const id of ['nm-distribution-less','nm-distribution-more'])
   document.getElementById(id).disabled=radial||!config.enabled;
  const actual=app.layout.adaptiveLimit?.effective;
  // R12: expose the actual configured threshold and the derived safe capacity.
  // A qualitative word ("compact") concealed the side switch users set.
  const configured=Math.round(config.height);
  const effective=Number.isFinite(actual)?Math.round(actual):configured;
  const numeric=effective>configured?
    configured+' px → '+effective+' px '+tr('(adattato)','(expanded)'):
    configured+' px';
  document.getElementById('nm-distribution-limit-value').textContent=numeric;
  limit.setAttribute('aria-valuetext',numeric);
  document.getElementById('nm-distribution-actual').textContent=effective>configured?
   tr('Applicata da Glauka: ','Applied by Glauka: ')+effective+' px '+
    tr('(+'+(effective-configured)+' px automatici per evitare sovrapposizioni)',
       '(+'+(effective-configured)+' px automatically to prevent overlap)'):
   tr('Applicata: ','Applied: ')+configured+' px';
  const amber=document.getElementById('nm-distribution-legend-chosen');
  const purple=document.getElementById('nm-distribution-legend-applied');
  amber.style.display=effective>configured?'inline-flex':'none';
  amber.lastChild.textContent=tr('Giallo: impostata','Yellow: chosen')+' '+configured+' px';
  purple.lastChild.textContent=tr('Viola: applicata','Purple: applied')+' '+effective+' px';
  const note=document.getElementById('nm-distribution-explanation');
  if(radial){updateForecast(app,null);note.textContent=tr('La continuazione usa gli stili orizzontali. Scegli uno stile diverso da Radiale per attivarla.','Continuation uses horizontal styles. Choose a style other than Radial to enable it.');return;}
  if(!config.enabled){updateForecast(app,null);note.textContent=tr('Quando lo spazio finisce, i nuovi rami proseguono sul lato opposto. Il limite iniziale si adatta alla mappa attuale.','When space runs out, new branches continue on the opposite side. The initial limit fits the current map.');return;}
  // On very large maps the predictive layout is evaluated on insertion,
  // not repeatedly while painting the HUD or moving an unrelated slider.
  const prediction=plan?.logicalLeafCount>600?null:
    plan&&app.layout.predictContinuation?.(app.state.selectedNodeId||app.state.root.id);
  const sideThresholds=side=>{
    const raw=Number(app.state.balanceBias),bias=Math.max(0,Math.min(1,(Number.isFinite(raw)?raw:50)/100));
    return Math.round(effective*2*(side==='right'?bias:1-bias));
  };
  note.textContent=tr('Cambio lato indicativo: destra ','Approximate side switch: right ')+
    sideThresholds('right')+' px · '+tr('sinistra ','left ')+sideThresholds('left')+
    ' px. '+tr('Testi, immagini e sottorami possono spostare il limite. La mappa rimane unita.','Text, images and sub-branches can shift the boundary. The map stays connected.');
  if(app.layout.adaptiveLimit?.blocked)note.textContent+=tr(' Limite tecnico raggiunto: riduci le distanze o le dimensioni dei testi.','Technical limit reached: reduce spacing or text sizes.');
  else if(actual>config.height)note.textContent+=tr(' Se il limite è ampliato, Glauka evita di separare i rami.','If expanded, Glauka avoids disconnecting branches.');
  updateForecast(app,prediction);


 }
