'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');
const composeUiSource=require('./helpers/compose-ui-source.cjs');
const src=name=>{
  if(name==='navigation-experience.js') return composeUiSource('navigation-experience');
  if(name==='workspace-layout.js') return composeUiSource('workspace-layout');
  return fs.readFileSync(path.join(base,name),'utf8').replace(/\r\n?/g,'\n');
};
const composeKnowledge=()=>{
  const dir=path.join(base,'../../apps/desktop-shared/editor');
  return fs.readFileSync(path.join(dir,'knowledge-ui.js'),'utf8').replace(/\r\n?/g,'\n')
    .replace('/* @neuromap-knowledge-ui-draw */\n',
      fs.readFileSync(path.join(dir,'knowledge-ui-draw.js'),'utf8').replace(/\r\n?/g,'\n'));
};
const core=require('../navigation-core');

test('hidden minimap defers geometry reads; visible minimap caches 6,001-node layout',()=>{
 const source=src('navigation-experience.js');
 const begin=source.indexOf(' function stateCache(app,force=false,includePoints=true){');
 const end=source.indexOf(' function enterFocus(app,id){',begin);
 assert.ok(begin>0&&end>begin);
 const cache=new WeakMap(),trailCache=new WeakMap();
 const module=new Function('core','cache','trailCache','console',
  source.slice(begin,end)+'\nreturn {stateCache,selectionTrail};'
 )(core,cache,trailCache,{warn(){}});
 const root={id:'root',text:'Anatomia',children:[]};
 for(let i=0;i<6000;i++)root.children.push({id:'n'+i,text:'Ramo '+i,children:[]});
 const state={root,selectedNodeId:'n5999'};
 let reads=0;
 const app={state,layout:{getLayout(id){
  reads++;
  const value=id==='root'?0:Number(id.slice(1))+1;
  return {x:value*8,y:value*2,width:50,height:20};
 }}};
 const original=JSON.stringify(root);
 const idle=module.stateCache(app,true,false);
 assert.equal(reads,0,'no geometry looked up while minimap is hidden');
 assert.equal(idle.overview.total,6001);
 assert.equal(idle.points.length,0);
 const active=module.stateCache(app,false,true);
 assert.equal(reads,6001);
 assert.equal(active.points.length,6001);
 for(let i=0;i<500;i++)module.stateCache(app,false,true);
 assert.equal(reads,6001,'camera movements reuse measured geometry');
 assert.deepEqual(module.selectionTrail(app).labels,['Anatomia','Ramo 5999']);
 assert.equal(module.selectionTrail(app).index,6000);
 assert.equal(module.selectionTrail(app).count,6000);
 assert.equal(JSON.stringify(root),original,'derived navigation never edits the tree');
});
test('Disposizione width/grip is independent of Aspetto and shared right tools',()=>{
  const source=src('workspace-layout.js');
  const start=source.indexOf('  function mountPanelResizeHandles(panels) {');
  const end=source.indexOf('  function mount(app) {',start);
  assert.ok(start>=0&&end>start);
  class Element {
    constructor(className=''){this.children=[];this.listeners={};this.attributes={};this.className=className;
      this.classList={contains:value=>className.split(/\s+/).includes(value)};this.style={setProperty(){}};}
    append(e){this.children.push(e)}
    prepend(e){this.children.unshift(e)}
    querySelector(s){return this.children.find(e=>s==='.nm-panel-resize-handle'&&e.className.split(/\s+/).includes('nm-panel-resize-handle'))||null}
    setAttribute(k,v){this.attributes[k]=String(v)}
    getAttribute(k){return this.attributes[k]||null}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  }
  const appearance=new Element('inspector-sidebar'),layout=new Element('hud-bottom-left'),insert=new Element('nm-insert-panel'),styles={},storage={},hosted=[];
  insert.id='nm-insert-panel';
  const document={body:{style:{setProperty:(key,value)=>{styles[key]=value}},append(node){hosted.push(node)}},
    createElement:()=>new Element(),
    querySelectorAll:()=>[...appearance.children,...hosted,...insert.children].filter(e=>e.className.split(/\s+/).includes('nm-panel-resize-handle'))
  };
  const viewportListeners={};
  const root={innerWidth:1200,addEventListener(type,fn){(viewportListeners[type]??=[]).push(fn)}};
  const localStorage={getItem:key=>storage[key]||null,setItem:(key,value)=>{storage[key]=value}};
  new Function('document','root','tr','localStorage',source.slice(start,end)+'\nreturn mountPanelResizeHandles;')(
    document,root,it=>it,localStorage
  )([appearance,layout,insert]);
  assert.equal(appearance.children.length,1);
  assert.equal(layout.children.length,0);
  assert.equal(hosted.length,1);
  assert.equal(insert.children.length,1);
  const rightGrip=appearance.children[0],layoutGrip=hosted[0],insertGrip=insert.children[0];
  assert.equal(rightGrip.attributes['data-nm-size-scope'],'inspector');
  assert.equal(layoutGrip.attributes['data-nm-size-scope'],'layout');
  assert.equal(insertGrip.attributes['data-nm-size-scope'],'insert');
  assert.equal(rightGrip.attributes['data-nm-grip-side'],'left');
  assert.equal(layoutGrip.attributes['data-nm-grip-side'],'right');
  const event=key=>({key,preventDefault(){},stopPropagation(){}});
  rightGrip.listeners.keydown[0](event('ArrowLeft'));
  assert.equal(styles['--nm-inspector-panel-width'],'380px');
  assert.equal(styles['--nm-layout-panel-width'],'400px');
  assert.equal(styles['--nm-insert-panel-width'],'400px');
  assert.equal(layoutGrip.attributes['aria-valuenow'],'400','Aspetto resize cannot modify Disposizione');
  assert.equal(insertGrip.attributes['aria-valuenow'],'400','Aspetto resize cannot modify Inserisci');
  layoutGrip.listeners.keydown[0](event('ArrowRight'));
  assert.equal(styles['--nm-layout-panel-width'],'420px');
  assert.equal(styles['--nm-inspector-panel-width'],'380px','Disposizione resize cannot modify Aspetto');
  rightGrip.listeners.keydown[0](event('Home'));
  assert.equal(styles['--nm-inspector-panel-width'],'340px');
  assert.equal(styles['--nm-layout-panel-width'],'420px');
  const inspectorBefore=storage['nm.workspace.inspectorWidth.v1'];
  insertGrip.listeners.keydown[0](event('ArrowLeft'));
  assert.equal(styles['--nm-insert-panel-width'],'420px');
  assert.equal(styles['--nm-inspector-panel-width'],'340px','Inserisci resize cannot modify Aspetto');
  layoutGrip.listeners.pointerdown[0]({button:0,pointerId:3,clientX:200,preventDefault(){},stopPropagation(){}});
  layoutGrip.listeners.pointermove[0]({pointerId:3,clientX:260});
  assert.equal(styles['--nm-layout-panel-width'],'480px','layout widens only itself on drag right');
  assert.equal(styles['--nm-inspector-panel-width'],'340px');
  assert.equal(styles['--nm-insert-panel-width'],'420px');
  layoutGrip.listeners.pointercancel[0]({pointerId:3,type:'pointercancel'});
  assert.equal(styles['--nm-layout-panel-width'],'420px');
  assert.equal(storage['nm.workspace.inspectorWidth.v1'],inspectorBefore);
  assert.equal(storage['nm.workspace.layoutPanelWidth.v1'],'420');
  assert.equal(storage['nm.workspace.insertWidth.v1'],'420');
  rightGrip.listeners.keydown[0](event('End'));
  assert.equal(styles['--nm-inspector-panel-width'],'560px');
  assert.equal(styles['--nm-layout-panel-width'],'420px');
  assert.equal(styles['--nm-insert-panel-width'],'420px');
  // A temporarily narrowed OS/window viewport must not overwrite a user's
  // stored desktop widths. The original values return on maximizing again.
  root.innerWidth=560;
  for(const onResize of viewportListeners.resize||[])onResize();
  assert.equal(styles['--nm-inspector-panel-width'],'380px');
  assert.equal(styles['--nm-layout-panel-width'],'380px');
  assert.equal(styles['--nm-insert-panel-width'],'380px');
  root.innerWidth=1200;
  for(const onResize of viewportListeners.resize||[])onResize();
  assert.equal(styles['--nm-inspector-panel-width'],'560px','restore the inspector width');
  assert.equal(styles['--nm-layout-panel-width'],'420px','restore Disposizione width');
  assert.equal(styles['--nm-insert-panel-width'],'420px','restore Inserisci width');
  assert.equal(storage['nm.workspace.inspectorWidth.v1'],'560');
  assert.equal(storage['nm.workspace.layoutPanelWidth.v1'],'420');
  assert.equal(storage['nm.workspace.insertWidth.v1'],'420');
});
test('Disposizione grip uses the measured panel instead of a fixed offset',()=>{
  const css=src('workspace-layout.css');
  const chrome=src('workspace-layout-lists-chrome.js');
  assert.equal(css.includes('top:128px'),false);
  assert.equal(css.includes('bottom:28px'),false);
  assert.match(chrome,/pinLayoutGrip/);
  assert.match(chrome,/getBoundingClientRect/);
  const source=src('workspace-layout.js');
  const start=source.indexOf('  function mountPanelResizeHandles(panels) {');
  const end=source.indexOf('  function mount(app) {',start);
  class Element {
    constructor(className=''){this.children=[];this.listeners={};this.attributes={};this.className=className;this.classList={contains:value=>className.split(/\s+/).includes(value)};this.style={setProperty:(name,value)=>{this.style[name]=value}};}
    append(e){this.children.push(e)}
    prepend(e){this.children.unshift(e)}
    querySelector(){return null}
    setAttribute(k,v){this.attributes[k]=String(v)}
    getAttribute(k){return this.attributes[k]||null}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
    getBoundingClientRect(){return {top:96,left:12,right:412,bottom:700,width:400,height:604}}
  }
  const layout=new Element('hud-bottom-left');
  const body={style:{setProperty(){}},children:[],append(node){this.children.push(node)}};
  const document={body,createElement:()=>new Element(),querySelectorAll:()=>body.children};
  new Function('document','root','tr','localStorage',source.slice(start,end)+'\nreturn mountPanelResizeHandles;')(
    document,{innerWidth:1200,addEventListener(){}},it=>it,{getItem:()=>null,setItem(){}}
  )([layout]);
  const grip=body.children[0];
  assert.equal(layout.children.length,0);
  assert.equal(grip.style.top,'96px');
  assert.equal(grip.style.height,'604px');
  assert.equal(grip.style.left,'410px');
  assert.equal(grip.style.width,'2px');
  layout.getBoundingClientRect=()=>({top:140,left:12,right:292,bottom:212,width:280,height:72});
  grip._nmPlaceLayoutGrip();
  assert.equal(grip.style.top,'140px');
  assert.equal(grip.style.height,'72px');
  assert.equal(grip.style.left,'290px');
  layout.className='hud-bottom-left nm-panel-compact';
  layout.classList={contains:value=>layout.className.split(/\s+/).includes(value)};
  grip._nmPlaceLayoutGrip();
  assert.equal(grip.style.display,'none');
});
test('task panels preserve user data, use theme tokens and avoid cloned operations',()=>{
 const nav=src('navigation-experience.js'),ui=src('workspace-layout.js'),
  layout=src('workspace-layout.css'),ai=src('ai-studio.js')
   .replace('/* @neuromap-ai-studio-open */\n',src('ai-studio-open.js'))
   .replace('/* @neuromap-ai-studio-mount */\n',src('ai-studio-mount.js').replace('/* @neuromap-ai-studio-mount-panel */\n',src('ai-studio-mount-panel.js').replace('/* @neuromap-ai-studio-mount-panel-form */\n',src('ai-studio-mount-panel-form.js')).replace('/* @neuromap-ai-studio-mount-panel-preview */\n',src('ai-studio-mount-panel-preview.js')).replace('/* @neuromap-ai-studio-mount-panel-tasks */\n',src('ai-studio-mount-panel-tasks.js'))).replace('/* @neuromap-ai-studio-mount-connections */\n',src('ai-studio-mount-connections.js')))
   .replace('/* @neuromap-ai-studio-methods */\n',src('ai-studio-methods.js').replace('/* @neuromap-ai-studio-methods-shell */\n',src('ai-studio-methods-shell.js')).replace('/* @neuromap-ai-studio-methods-run */\n',src('ai-studio-methods-run.js').replace('/* @neuromap-ai-studio-methods-run-sources */\n',src('ai-studio-methods-run-sources.js')).replace('/* @neuromap-ai-studio-methods-run-preview */\n',src('ai-studio-methods-run-preview.js'))).replace('/* @neuromap-ai-studio-methods-audio */\n',src('ai-studio-methods-audio.js'))),
  gallery=src('map-style-gallery.js');
 const learnDir=path.join(base,'../../apps/desktop-shared/editor');
 const learning=fs.readFileSync(path.join(learnDir,'learn-ui.js'),'utf8')
  .replace('/* @neuromap-learn-ui-session */\n',
   fs.readFileSync(path.join(learnDir,'learn-ui-session.js'),'utf8'));
 const knowledge=composeKnowledge();
 const chrome=src('workspace-chrome.js');
 assert.match(nav,/nm616-nav-trail/);
 assert.match(nav,/stateCache\(app,force,!shell.hidden\)/);
 assert.match(ui,/nm-insert-shortcuts/);
 assert.match(ui,/target\.click\(\)/,'recent actions delegate to existing handlers');
 assert.match(ui,/nm\.insert\.pinned\.v1/);
 assert.match(layout,/--nm-right-panel-width/);
 assert.match(layout,/\.hud-bottom-left\s*\{\s*--nm-panel-left:\s*12px;\s*--nm-panel-right:\s*auto;/);
 assert.match(layout,/data-nm-skin-readability="compact".*#inspector-sidebar/s);
 assert.match(layout,/#nm-insert-panel \.nm-insert-tool-grid\{display:grid;/);
 assert.match(layout,/#nm-insert-shortcuts>summary\s*\{/);
 assert.match(chrome,/nm-learn-panel/);
 assert.match(chrome,/nm-knowledge-panel/);
 assert.match(ai,/nm-ai-service-summary/);
 assert.match(ai,/configured/);
 assert.match(ai,/if \(this\.busy \|\| this\.recorder\.recording \|\| countdown\) this\.update\(\)/);
 assert.match(learning,/nm-learn-progress/);
 assert.match(knowledge,/nm\.knowledge\.guideSeen\.v1/);
 assert.match(gallery,/nm-map-scope/);
 assert.match(gallery,/data-nm-selected/);
 for(const text of [nav,ui,learning,knowledge,ai,gallery,chrome])
  assert.doesNotThrow(()=>new Function(text),'JS must parse before release');
});


test('enabled minimap is never parked or hidden when panels open',()=>{
 const source=src('workspace-chrome.js');
 assert.doesNotMatch(source,/visibility:hidden/);
 assert.doesNotMatch(source,/classList\.toggle\('nm-minimap-parked'/);
 assert.match(source,/nm-minimap-aside/);
 assert.match(source,/--nm-minimap-scale/);
 assert.match(source,/Never hide an enabled minimap/);
});

test('docked Cloud moves minimap by its real card width, not overlay width',()=>{
 const source=src('workspace-chrome.js');
 const start=source.indexOf(' const sidePanelIds='),end=source.indexOf(' function placeViews(){',start);
 assert.ok(start>=0&&end>start);
 const vars={},states=new Set();
 const card={
  offsetWidth:400,offsetHeight:610,
  classList:{contains:name=>name==='gl-cloud-card'},
  getBoundingClientRect:()=>({right:1128})
 };
 const overlay={
  id:'gl-cloud-dialog',hidden:false,offsetWidth:1200,offsetHeight:800,
  classList:{contains:name=>name==='gl-cloud-docked'},
  querySelector:()=>card
 };
 const document={body:{
  classList:{contains:name=>states.has(name),
   toggle(name,enabled){enabled?states.add(name):states.delete(name)}},
  style:{setProperty:(key,value)=>{vars[key]=value}}
 },getElementById:id=>id==='gl-cloud-dialog'?overlay:null};
 const placeRadar=new Function('document','root','getComputedStyle',
  source.slice(start,end)+'\nreturn placeRadar;')(
  document,{innerWidth:1200},()=>({right:'72px'})
 );
 placeRadar();
 assert.equal(vars['--nm-workspace-radar-right'],'484px');
 assert.equal(states.has('nm-workspace-inspector-open'),true);
 overlay.hidden=true;placeRadar();
 assert.equal(states.has('nm-workspace-inspector-open'),false);
});

test('a successful side-panel transition dismisses the detached list-format popover',()=>{
 const source=src('workspace-layout.js');
 const start=source.indexOf('  function claim(app, id) {');
 const end=source.indexOf('  const iconPaths =',start);
 assert.ok(start>=0&&end>start);
 const states=new WeakMap(),app={};
 let closes=0,allow=false;
 app._nmCloseListPicker=()=>closes++;
 states.set(app,{claim:()=>allow});
 const claim=new Function('states',source.slice(start,end)+'\nreturn claim;')(states);
 assert.equal(claim(app,'insert'),false,'protected editor cannot be forced closed');
 assert.equal(closes,0,'rejected switch must preserve current popup');
 allow=true;
 assert.equal(claim(app,'linked-view'),true);
 assert.equal(closes,1,'switching away from inspector dismisses body-mounted popup');
 assert.equal(claim(app,'inspector'),true);
 assert.equal(closes,1,'reselecting inspector does not dismiss its own popup');
});

test('Word-like text toolbar stays compact and alignment retains all three real actions',()=>{
 const css=src('workspace-layout.css'),js=src('workspace-layout.js');
 assert.match(js,/nm-text-alignment/);
 assert.match(js,/nm68-align-buttons/);
 for(const kind of ['left','center','right'])assert.match(js,new RegExp(kind+': \\['));
 assert.match(js,/nm-text-emphasis[\s\S]*?nm-list-picker/);
 const emphasis=css.match(/body\.nm-workspace-v2 #nm-text-emphasis > button:not\(\[hidden\]\)\s*\{([^}]+)\}/);
 assert.ok(emphasis,'toolbar button CSS exists');
 assert.match(emphasis[1],/flex:\s*0 0 (?:34|40|42|44)px/,
  'format icons must not expand into giant full-width boxes');
 assert.doesNotMatch(emphasis[1],/flex:\s*1\s*;/);
 assert.match(css,/#nm-shapes-picker #nm-insert-shapes \.nm-insert-shape-tile\{min-height:(?:48|50|52|54)px!important\}/);
 assert.match(css,/#nm-insert-shapes \.nm-insert-shape-preview\{[^}]*height:(?:22|24)px!important;min-height:(?:22|24)px!important/,
  'shape icon previews should not consume most of the compact tile height');
 assert.match(css,/#nm-text-highlight-picker \.nm-text-highlight-swatch[\s\S]*?min-height:(?:44|46|48|50)px!important/);
 assert.match(css,/#nm-text-highlight-picker \.nm-text-highlight-clear\{min-height:(?:44|46|48|50)px/);
 assert.match(js,/nm-text-alignment[\s\S]*?role["'],["']group/);
 assert.match(js,/app\._nmCloseListPicker = close/,
  'body-level list popup needs a direct coordinated close operation');
 assert.match(js,/new MutationObserver\([\s\S]*?inspector\.classList\.contains\("collapsed"\)/,
  'direct closing of inspector must also dismiss detached popup');
 assert.match(js,/if \(document\.getElementById\("nm-text-alignment"\)\) return/,
  'reinstalling panels must not duplicate alignment tools');
 assert.match(css,/#nm-list-menu\s*\{[^}]*max-height:\s*calc\(100dvh - 16px\)/,
  'detached popup must stay inside the viewport');
});

test('last CSS cascade rule keeps Word-like formatting controls at compact 34px cubes',()=>{
 const css=src('workspace-layout.css');
 const buttonRule=/body\.nm-workspace-v2 #nm-text-emphasis > button:not\(\[hidden\]\)\s*\{([^}]+)\}/g;
 const rules=[...css.matchAll(buttonRule)].map(match=>match[1]);
 assert.ok(rules.length>=2,'test all competing formatting CSS rules');
 const final=rules[rules.length-1];
 assert.match(final,/flex:\s*0 0 34px\s*;/);
 assert.match(final,/width:\s*34px\s*;/);
 assert.match(final,/min-width:\s*34px\s*;/);
 assert.match(final,/height:\s*34px\s*;/);
 assert.match(final,/min-height:\s*34px\s*;/);
 assert.match(final,/border-radius:\s*9px/);
 const list=css.match(/#nm-list-trigger\s*\{([^}]+)\}/);
 assert.ok(list);
 assert.match(list[1],/min-height:\s*34px\s*;/,
  'Elenchi in the same Word-like ribbon needs an equally clickable button');
});

test('final Insert shape tile cascade keeps 52px targets and list options remain reachable',()=>{
 const css=src('workspace-layout.css');
 const finalTile=css.match(/body\.nm-workspace-v2 #nm-insert-panel #nm-insert-shapes \.nm-insert-shape-tile\s*\{([^}]+)\}/);
 assert.ok(finalTile,'final Insert-specific tile rule is present');
 assert.match(finalTile[1],/min-height:\s*52px!important\s*;/,
  'Insert-specific selector must not shrink the 52px shape tiles to 48px');
 const list=css.match(/#nm-list-menu button\s*\{([^}]+)\}/);
 assert.ok(list);
 assert.match(list[1],/min-height:\s*40px\s*;/,
  'Word-style list choices should use the same accessible 40px minimum targets');
});

test('Radar clearance uses widest of concurrent Cloud and inspector cards',()=>{
 const source=src('workspace-chrome.js');
 const start=source.indexOf(' const sidePanelIds='),end=source.indexOf(' function placeViews(){',start);
 assert.ok(start>0&&end>start);
 const vars={},classes=new Set();
 const card={offsetWidth:460,offsetHeight:620,
   classList:{contains:name=>name==='gl-cloud-card'},
   getBoundingClientRect:()=>({right:1128})
 };
 const cloud={id:'gl-cloud-dialog',hidden:false,offsetWidth:1200,offsetHeight:800,
   classList:{contains:name=>name==='gl-cloud-docked'},
   querySelector:()=>card};
 const inspector={id:'inspector-sidebar',hidden:false,offsetWidth:340,offsetHeight:640,
   classList:{contains:()=>false}};
 const elements=new Map([['inspector-sidebar',inspector],['gl-cloud-dialog',cloud]]);
 const document={
  getElementById:id=>elements.get(id)||null,
  body:{classList:{contains:name=>classes.has(name),toggle(name,on){
    if(on)classes.add(name);else classes.delete(name);
  }},style:{setProperty:(key,value)=>{vars[key]=value}}}
 };
 const placeRadar=new Function('document','root','getComputedStyle',
   source.slice(start,end)+'\nreturn placeRadar;')(
     document,{innerWidth:1200},()=>({right:'72px'})
   );
 placeRadar();
 assert.equal(vars['--nm-workspace-radar-right'],'544px',
   'Cloud card must win over narrower inspector even if listed later');
 cloud.hidden=true;
 placeRadar();
 assert.equal(vars['--nm-workspace-radar-right'],'424px',
   'closing Cloud restores inspector-only radar clearance');
 inspector.hidden=true;
 placeRadar();
 assert.equal(classes.has('nm-workspace-inspector-open'),false);
});

test('Radar reserves actual painted bounds of translated or left-anchored inspector',()=>{
 const source=src('workspace-chrome.js');
 const start=source.indexOf(' const sidePanelIds='),end=source.indexOf(' function placeViews(){',start);
 assert.ok(start>0&&end>start);
 const vars={},states=new Set();
 const inspector={
  id:'inspector-sidebar',hidden:false,offsetWidth:400,offsetHeight:580,
  classList:{contains:()=>false},
  // The card has moved left after a responsive translateX or left anchor.
  // CSS computed `right:auto` is not a reliable painted boundary.
  getBoundingClientRect:()=>({left:590,right:990,width:400,height:580})
 };
 const doc={
  getElementById:id=>id==='inspector-sidebar'?inspector:null,
  body:{classList:{contains:name=>states.has(name),toggle(name,on){
   on?states.add(name):states.delete(name);
  }},style:{setProperty:(key,value)=>{vars[key]=value}}}
 };
 const radar=new Function('document','root','getComputedStyle',
   source.slice(start,end)+'\nreturn placeRadar;')(
   doc,{innerWidth:1200},()=>({right:'auto'})
 );
 radar();
 assert.equal(vars['--nm-workspace-radar-right'],'622px',
  'reserve viewport width minus real painted left boundary, plus gap');
 assert.equal(states.has('nm-workspace-inspector-open'),true);
 inspector.hidden=true;radar();
 assert.equal(states.has('nm-workspace-inspector-open'),false);
});

test('drawing toolbar reserves minimap clearance from its painted left edge',()=>{
 const source=src('workspace-chrome.js');
 const start=source.indexOf(' const sidePanelIds='),end=source.indexOf(' function placeViews(){',start);
 const vars={},states=new Set();
 const drawing={
  id:'nm-drawing-toolbar',hidden:false,offsetWidth:400,offsetHeight:726,
  classList:{contains:()=>false},
  getBoundingClientRect:()=>({left:808,right:1208,width:400,height:726})
 };
 const doc={
  getElementById:id=>id==='nm-drawing-toolbar'?drawing:null,
  body:{classList:{contains:name=>states.has(name),toggle(name,on){
   on?states.add(name):states.delete(name);
  }},style:{setProperty:(key,value)=>{vars[key]=value}}}
 };
 const radar=new Function('document','root','getComputedStyle',
  source.slice(start,end)+'\nreturn placeRadar;')(doc,{innerWidth:1280},()=>({right:'auto'}));
 radar();
 assert.equal(vars['--nm-workspace-radar-right'],'484px');
 assert.equal(states.has('nm-workspace-inspector-open'),true);
 drawing.hidden=true;radar();
 assert.equal(states.has('nm-workspace-inspector-open'),false);
});

test('layout panel reserves the minimap only when their resting boxes meet',()=>{
 const source=src('workspace-chrome.js');
 const start=source.indexOf(' const sidePanelIds='),end=source.indexOf(' function placeViews(){',start);
 const vars={},states=new Set();
 const layout={
  hidden:false,offsetWidth:298,offsetHeight:629,
  classList:{contains:()=>false},
  getBoundingClientRect:()=>({left:12,right:310,top:144,bottom:773,width:298,height:629})
 };
 const doc={
  getElementById:()=>null,
  querySelector:selector=>selector==='.hud-bottom-left'?layout:null,
  body:{classList:{contains:name=>states.has(name),toggle(name,on){
   on?states.add(name):states.delete(name);
  }},style:{setProperty:(key,value)=>{vars[key]=value}}}
 };
 const root={innerWidth:390,innerHeight:844};
 const radar=new Function('document','root','getComputedStyle',
  source.slice(start,end)+'\nreturn placeRadar;')(doc,root,()=>({right:'auto'}));
 radar();
 assert.equal(states.has('nm-workspace-inspector-open'),true);
 assert.equal(vars['--nm-workspace-radar-right'],'390px');
 root.innerWidth=1280;root.innerHeight=900;
 layout.offsetWidth=400;
 layout.getBoundingClientRect=()=>({left:12,right:412,top:103,bottom:829,width:400,height:726});
 radar();
 assert.equal(states.has('nm-workspace-inspector-open'),false);
});

test('panel interiors keep compact Formato/Esplora/Studio/AI controls',()=>{
 const layout=src('workspace-layout.css');
 const brand=src('glauka-brand.css');
 const theme=src('interface-theme.css');
 const tools=src('node-text-tools.js');
 const render=src('navigation-experience-render.js');
 const ai=src('ai-studio.css');
 assert.match(tools,/glauka-font-strike/);
 assert.match(tools,/glauka-text-actions/);
 assert.match(brand,/\.glauka-text-actions \.glauka-text-action[\s\S]*?min-height: 34px/);
 assert.match(brand,/#glauka-font-size \{\s*min-width: 4\.5rem;/);
 assert.match(layout,/#nm614-navigation-flyout[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(layout,/min-height:46px!important/);
 assert.match(theme,/#nm614-navigation-flyout #nm616-navigation[\s\S]*?#nm616-nav-focus[\s\S]*?background: transparent !important/);
 assert.match(render,/Isola ramo/);
 assert.match(render,/Nascondi minimappa/);
 assert.match(layout,/#nm-learn-panel \.nm-learn-tabs\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(layout,/#nm-learn-panel \.nm-learn-tabs button \{[\s\S]*?min-height:44px!important/);
 assert.match(ai,/\.nm-ai-task-group-grid > button[\s\S]*?min-height: 54px/);
 assert.match(ai,/\.nm-ai-task-group-grid > button strong,\n#nm-ai-studio \.nm-ai-more-grid > button strong \{[\s\S]*?text-overflow: clip;/);
 assert.doesNotMatch(ai,/\.nm-ai-task-group-grid > button strong,\n#nm-ai-studio \.nm-ai-more-grid > button strong \{[^}]*text-overflow:\s*ellipsis/);
});

test('panel shell stays clickable, framed with fixed headers, wheel-scrollable, height-capped, and leaves bottom-right zoom fixed',()=>{
 const layout=src('workspace-layout.css');
 const creative=src('creative-ui.js');
 const chrome=src('workspace-chrome.js');
 const ai=src('ai-studio.css');
 assert.doesNotMatch(creative,/panel\.style\.setProperty\(\s*['"]pointer-events['"],\s*['"]none['"]/);
 assert.match(creative,/FRAMED_SIDE_PANELS=new Set\(\[.*'inspector-sidebar'.*'nm-knowledge-panel'/);
 assert.match(layout,/body\.nm-workspace-v2\s*:is\(\s*#inspector-sidebar,\s*\.hud-bottom-left\s*\):not\(\.nm-panel-compact\)[^}]*padding:\s*0 !important;[\s\S]*?overflow:\s*hidden !important;/);
 assert.match(layout,/body\.nm-workspace-v2\s*:is\(#inspector-sidebar,\s*\.hud-bottom-left\)\s*>\s*\.nm-panel-body[^}]*overflow-y:\s*auto !important;/);
 assert.match(layout,/max-height:\s*min\(620px,\s*calc\(100dvh - var\(--nm-workspace-top,\s*96px\) - 72px\)\)\s*!important/);
 assert.match(chrome,/\.hud-bottom-right\{right:12px!important;bottom:12px!important\}/);
 assert.doesNotMatch(chrome,/style\.setProperty\(\s*['"]--nm-zoom-right['"]/);
 assert.match(ai,/body\.nm-workspace-v2 #nm-ai-studio>header\{[^}]*height:44px!important/);
 assert.match(ai,/\.nm-ai-body\{[^}]*overflow-y:auto!important;[^}]*padding:12px 14px 14px!important/);
});
