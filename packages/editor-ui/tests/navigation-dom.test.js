const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../navigation-core');

function harness(){
  const ids=new Map(),frames=[],listeners={};
  const canvasContext=Object.fromEntries([
    'setTransform','clearRect','beginPath','moveTo','lineTo','bezierCurveTo','stroke','fill','arc',
    'fillRect','strokeRect','setLineDash','save','restore'
  ].map(name=>[name,()=>{}]));
  class Element{
    constructor(tag){
      this.tagName=tag;this.children=[];this.parentElement=null;this.hidden=false;
      this._listeners={};this._id='';this.style={setProperty:()=>{}};this.className='';
      this.textContent='';this.value='';this.dataset={};this.attributes={};this.width=190;this.height=122;
      this.classList={toggle:(name,active)=>{
        const set=new Set(this.className.split(/\s+/).filter(Boolean));
        if(active)set.add(name);else set.delete(name);
        this.className=[...set].join(' ');
      },contains:name=>this.className.split(/\s+/).includes(name)};
    }
    set id(value){this._id=value;ids.set(value,this)}
    get id(){return this._id}
    append(...elements){for(const c of elements){this.children.push(c);c.parentElement=this}}
    replaceChildren(...elements){this.children=[];this.append(...elements)}
    setAttribute(k,v){this.attributes[k]=String(v)}
    getAttribute(k){return this.attributes[k]}
    addEventListener(k,fn){(this._listeners[k]??=[]).push(fn)}
    dispatch(k,event={}){for(const fn of this._listeners[k]||[])fn(event)}
    querySelector(selector){
      if(selector[0]==='#')return ids.get(selector.slice(1))||null;
      const match=n=>selector[0]==='.'?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector;
      const stack=[...this.children];
      while(stack.length){const n=stack.shift();if(match(n))return n;stack.push(...n.children)}return null;
    }
    querySelectorAll(selector){
      const out=[],match=n=>selector[0]==='.'?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector;
      const stack=[...this.children];while(stack.length){const n=stack.shift();if(match(n))out.push(n);stack.push(...n.children)}return out;
    }
    getContext(){return canvasContext}
    getBoundingClientRect(){return {left:0,top:0,width:190,height:122}}
    setPointerCapture(){}
    hasPointerCapture(){return false}
    releasePointerCapture(){}
  }
  const document={
    head:new Element('head'),body:new Element('body'),documentElement:{lang:'it'},
    createElement:tag=>new Element(tag),
    getElementById:id=>ids.get(id)||null,
    addEventListener:(event,handler)=>(listeners[event]??=[]).push(handler)
  };
  const storage={},localStorage={
    getItem:key=>storage[key]||null,setItem:(key,value)=>{storage[key]=value}
  };
  const context={document,localStorage,NeuroMapNavigationCore:core,innerWidth:1200,innerHeight:800,
    devicePixelRatio:1,requestAnimationFrame:cb=>frames.push(cb),console,globalThis:null};
  context.globalThis=context;
  const composeUiSource=require('./helpers/compose-ui-source.cjs');
  const source=composeUiSource('navigation-experience');
  vm.runInNewContext(source,context,{filename:'navigation-experience.js'});
  const root={id:'root',text:'Knowledge',side:'root',children:[
    {id:'a',text:'Epithelia',side:'left',color:'#8855ee',children:[{id:'deep',text:'Cell type',children:[]}]},
    {id:'b',text:'Vessels',side:'right',color:'#ef4444',children:[]}
  ]};
  const all=[root,...root.children,root.children[0].children[0]];
  const state={root,undoStack:[],selectedNodeId:'root',findNode(id){return all.find(n=>n.id===id)||null}};
  const points={root:{x:0,y:0,width:130,height:45},a:{x:-320,y:80,width:120,height:35},
    deep:{x:-590,y:130,width:90,height:28},b:{x:320,y:80,width:110,height:30}};
  class App{
    bindUI(){}
    requestRender(){this.renderCalls=(this.renderCalls||0)+1}
    recalculateAndRender(){this.requestRender()}
    activateTab(id){this.activeTabId=id;this.requestRender()}
    updateStatus(){}
    selectNode(id){this.state.selectedNodeId=id}
    nm612Bounds(id){const m=points[id];return m?{minX:m.x-60,minY:m.y-50,maxX:m.x+60,maxY:m.y+50,width:120,height:100}:null}
    nm612FitBounds(box){this.renderer.camera.zoom=1.2;this.renderer.camera.x=700;this.renderer.camera.y=450}
    stopTeleport(){}
    fitWholeMap(){this.fitFull=(this.fitFull||0)+1}
  }
  context.NeuroMapNavigationInstall(App);
  const app=new App();app.state=state;app.activeTabId='first';
  app.renderer={camera:{x:610,y:380,zoom:.35},visualFocusIds:null,semanticZoomEnabled:true};
  app.layout={getLayout(id){return points[id]||null}};
  app.bindUI();
  let remaining=0;function flush(){let limit=35;while(frames.length&&limit--){frames.shift()(0);remaining++}assert.ok(limit>0,'navigation rAF converges')}
  flush();
  return {app,state,document,context,storage,flush,listeners};
}
test('low zoom keeps the minimap without unsolicited branch shortcuts or document edits',()=>{
  const {app,state,document}=harness(),snapshot=JSON.stringify(state.root);
  assert.equal(document.getElementById('nm616-navigation').hidden,false);
  assert.equal(document.getElementById('nm616-minimap-shell').hidden,false);
  const branches=document.getElementById('nm616-nav-branches');
  assert.equal(branches.children.length,0);
  assert.equal(branches.hidden,true);
  assert.equal(document.getElementById('nm616-nav-options').hidden,true);
  assert.equal(app.renderer.semanticZoomEnabled,false);
  assert.equal(JSON.stringify(state.root),snapshot);
  assert.equal(state.undoStack.length,0);
});
test('Focus fades unrelated branches and returns to previous camera without Undo',()=>{
  const {app,state,document,flush}=harness();
  const before={...app.renderer.camera},original=JSON.stringify(state.root);
  document.getElementById('nm616-nav-focus').dispatch('click');flush();
  assert.equal(app.renderer.visualFocusIds.has('a'),true);
  assert.equal(app.renderer.visualFocusIds.has('b'),false);
  assert.equal(app.renderer.camera.zoom,1.2);
  assert.equal(document.getElementById('nm616-nav-focus').getAttribute('aria-pressed'),'true');
  document.getElementById('nm616-nav-restore').dispatch('click');flush();
  assert.deepEqual(app.renderer.camera,before);
  assert.equal(app.renderer.visualFocusIds,null);
  assert.equal(state.undoStack.length,0);
  assert.equal(JSON.stringify(state.root),original);
});
test('semantic zoom and minimap are independent preferences',()=>{
  const {app,document,flush,storage}=harness();
  const button=document.getElementById('nm616-nav-semantic');
  button.dispatch('click');flush();
  assert.equal(app.renderer.semanticZoomEnabled,true);
  assert.equal(JSON.parse(storage['nm616-navigation-preferences']).semantic,true);
  document.getElementById('nm616-nav-map-toggle').dispatch('click');flush();
  assert.equal(document.getElementById('nm616-minimap-shell').hidden,true);
  assert.equal(JSON.parse(storage['nm616-navigation-preferences']).minimap,false);
});
test('minimap pointer interaction changes camera only, not logical nodes',()=>{
  const {app,state,document,flush}=harness();
  const before=JSON.stringify(state.root),map=document.getElementById('nm616-map');
  const previous=app.renderer.camera.x;
  map.dispatch('pointerdown',{button:0,pointerId:1,clientX:160,clientY:60});
  flush();
  assert.notEqual(app.renderer.camera.x,previous);
  assert.equal(JSON.stringify(state.root),before);
});

test('radar detail and expand change only visual settings and use matching projection size',()=>{
 const {app,state,document,flush,storage}=harness(),before=JSON.stringify(state.root);
 document.getElementById('nm616-map-expand').dispatch('click');flush();
 assert.equal(document.getElementById('nm616-minimap-shell').classList.contains('nm616-map-expanded'),true);
 assert.equal(document.getElementById('nm616-map')._nmProjection.width,310);
 assert.equal(document.getElementById('nm616-map')._nmProjection.height,205);
 document.getElementById('nm616-map-mode').dispatch('click');flush();
 assert.equal(document.getElementById('nm616-map-mode').getAttribute('aria-pressed'),'true');
 assert.equal(JSON.parse(storage['nm616-navigation-preferences']).detail,true);
 assert.equal(JSON.stringify(state.root),before);
 assert.equal(state.undoStack.length,0);
});
test('navigation tooltips explain branch focus, detail and the minimap in both languages',()=>{
  const {app,document,flush}=harness();
  const semantic=document.getElementById('nm616-nav-semantic');
  const focus=document.getElementById('nm616-nav-focus');
  const map=document.getElementById('nm616-map');
  const toggle=document.getElementById('nm616-nav-map-toggle');
  assert.equal(semantic.textContent,'Tutti i dettagli');
  assert.match(semantic.title,/ogni livello/);
  assert.equal(semantic.getAttribute('aria-label'),semantic.title);
  semantic.dispatch('click');flush();
  assert.equal(semantic.textContent,'Dettagli automatici');
  assert.match(semantic.title,/rami profondi/);
  assert.match(focus.title,/non viene modificata/);
  assert.equal(toggle.textContent,'Nascondi minimappa');
  assert.equal(toggle.title,toggle.textContent);
  assert.equal(toggle.getAttribute('aria-label'),toggle.title);
  assert.match(map.getAttribute('title'),/Clicca o trascina/);
  assert.equal(map.getAttribute('title'),map.getAttribute('aria-label'));
  document.documentElement.lang='en';
  app.requestRender();
  flush();
  assert.equal(semantic.textContent,'Automatic detail');
  assert.match(semantic.title,/deep branches/);
  assert.match(focus.title,/not modified/);
  assert.match(map.getAttribute('title'),/Click or drag/);
  assert.equal(toggle.textContent,'Hide minimap');
  assert.equal(toggle.title,toggle.textContent);
  assert.match(toggle.title,/minimap/);
  assert.equal(toggle.getAttribute('aria-label'),toggle.title);
});
test('minimap branch arrows step branches safely without creating undo history',()=>{
  const {app,state,document,flush}=harness(),before=JSON.stringify(state.root);
  const steps=[];app.nm67NavigateMain=(dir)=>{steps.push(dir);const ids=state.root.children.map(n=>n.id);const idx=ids.indexOf(state.selectedNodeId);app.selectNode(ids[(idx+(dir>0?1:0)+ids.length)%ids.length]);app.requestRender()};
  const prev=document.getElementById('nm616-map-prev'),next=document.getElementById('nm616-map-next');
  assert.ok(prev&&next);
  assert.equal(prev.getAttribute('aria-label'),'Ramo precedente');
  assert.equal(next.getAttribute('aria-label'),'Ramo successivo');
  next.dispatch('click');flush();
  prev.dispatch('click');flush();
  assert.deepEqual(steps,[1,-1]);
  assert.equal(JSON.stringify(state.root),before);
  assert.equal(state.undoStack.length,0);
  document.documentElement.lang='en';
  app.requestRender();flush();
  assert.equal(prev.getAttribute('aria-label'),'Previous branch');
  assert.equal(next.getAttribute('aria-label'),'Next branch');
});
