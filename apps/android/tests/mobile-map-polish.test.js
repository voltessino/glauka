'use strict';
const composeStateSource=require('../../../packages/editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const Core=require('../../../packages/editor-ui/map-style-core');

function model(){
 const context={NeuroMapCore:{continuationSettings:v=>v},console};
 vm.runInNewContext(read('apps/android/editor/state.js')+
  '\nthis.AndroidState=MindMapStateMachine;',context);
 return context.AndroidState;
}
function fixture(){
 const State=model(),state=new State();
 state.root={id:'root',text:'Anatomia',side:'root',color:'#7454ea',
  children:[{id:'branch',parentId:'root',side:'right',text:'Cuore',
   nodeShape:'card',color:'#a855f7',children:[
    {id:'leaf',parentId:'branch',side:'right',text:'Atrio',color:'#c084fc',children:[]}]}]};
 state.selectedNodeId='branch';state.selectedNodeIds=['branch'];
 const app={state,activeTabId:'tab_one',changed:0,saved:0,
  markChanged(){this.changed++},scheduleSave(){this.saved++}};
 return {State,state,app};
}
class Element{
 constructor(name){this.tagName=name;this.children=[];this.dataset={};
  this.attrs={};this.listeners={};this.style={};this.hidden=false;
  this.isConnected=true;this.textContent='';this.value='';}
 get parentElement(){return this.parent||null;}
 append(...children){for(const child of children){if(child.parent)child.parent.children=child.parent.children.filter(c=>c!==child);this.children.push(child);child.parent=this;}}
 setAttribute(k,v){this.attrs[k]=String(v)}
 addEventListener(k,fn){this.listeners[k]=fn}
 focus(){this.focused=true}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);
  this.isConnected=false;}
 find(pred){if(pred(this))return this;for(const c of this.children){
  const hit=c.find?.(pred);if(hit)return hit;}return null}
 all(pred,into=[]){if(pred(this))into.push(this);for(const c of this.children)c.all?.(pred,into);return into}
 querySelectorAll(selector){
  if(selector==='input[type=color]')return this.all(e=>e.tagName==='input'&&e.type==='color');
  if(selector==='button,select')return this.all(e=>['button','select'].includes(e.tagName));
  return [];
 }
 fire(type,evt={}){this.listeners[type]?.({target:this,preventDefault(){},...evt})}
}
function setup(){
 const {state,app}=fixture(),storage=new Map();
 const doc={readyState:'complete',body:new Element('body'),
  documentElement:{lang:'it'},activeElement:null,
  listeners:{},
  createElement:t=>new Element(t),
  createElementNS:(ns,t)=>new Element(t),
  getElementById(){return null},
  addEventListener(t,fn){this.listeners[t]=fn}
 };
 doc.body.dataset={};
 const sandbox={document:doc,neuroMapApp:app,NeuroMapMapStyleCore:Core,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  console};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(read('apps/android/native/app/src/main/assets/assets/mobile-map-polish.js'),
  sandbox);
 return {app,state,doc,sandbox,storage,panel:sandbox.GlaukaAndroidStylePanel};
}
test('Android node clone stores explicit shapes and filters invalid values',()=>{
 const State=model();
 for(const shape of Core.SHAPES){
  const clone=State.cloneTree({id:'a',text:'a',color:'#112233',nodeShape:shape,children:[]});
  assert.equal(clone.nodeShape,shape);
 }
 const evil=State.cloneTree({id:'a',text:'a',nodeShape:'<script>',children:[]});
 assert.equal(evil.nodeShape,undefined);
});
test('Android Undo/Redo restores exact outline and other node metadata',()=>{
 const {state}=fixture();
 state.pushHistory();
 state.root.children[0].nodeShape='hex';
 assert.equal(state.undo(),true);
 assert.equal(state.root.children[0].nodeShape,'card');
 assert.equal(state.redo(),true);
 assert.equal(state.root.children[0].nodeShape,'hex');
});
test('single-branch contour change has one Undo and preserves IDs, text and children',()=>{
 const {panel,state,app}=setup();
 const t={app,state,tab:app.activeTabId,nodes:[state.root.children[0]]};
 assert.equal(panel.shapeOne(t,'plain'),true);
 assert.equal(state.root.children[0].nodeShape,'plain');
 assert.equal(state.root.children[0].text,'Cuore');
 assert.equal(state.root.children[0].children[0].text,'Atrio');
 assert.equal(state.undoStack.length,1);
 assert.equal(app.changed,1);assert.equal(app.saved,1);
 state.undo();assert.equal(state.root.children[0].nodeShape,'card');
});
test('map style gallery applies one canonical desktop preset in one undo transaction',()=>{
 const {panel,state,app}=setup();
 const t={app,state,tab:app.activeTabId,nodes:[state.root.children[0]]};
 const p=Core.PRESETS.find(x=>x.id==='free');
 assert.ok(p);
 assert.equal(panel.mapPreset(t,p),true);
 assert.equal(state.root.children[0].nodeShape,'plain');
 assert.equal(state.root.children[0].children[0].nodeShape,'plain');
 assert.equal(state.root.nodeShape,undefined);
 assert.equal(state.branchStyle,p.branchStyle);
 assert.equal(state.undoStack.length,1);
 state.undo();assert.equal(state.root.children[0].nodeShape,'card');
});
test('stale tab or selected-node references must not mutate another document',()=>{
 const {panel,state,app}=setup();
 const t={app,state,tab:app.activeTabId,nodes:[state.root.children[0]]};
 app.activeTabId='tab_two';
 assert.equal(panel.shapeOne(t,'outline'),false);
 assert.equal(panel.mapPreset(t,Core.PRESETS[0]),false);
 assert.equal(state.undoStack.length,0);
});
test('phone accent and density change UI preferences only, without touching map data',()=>{
 const {panel,doc,app,state,storage}=setup();
 const before=JSON.stringify(state.root),saved=app.saved;
 assert.equal(panel.prefs().theme,'light');
 assert.equal(doc.body.dataset.glAndroidTheme,'light');
 assert.equal(panel.prefs().accent,'violet');
 assert.equal(doc.body.dataset.glAndroidAccent,'violet');
 assert.equal(doc.body.dataset.glAndroidDensity,'comfortable');
 assert.equal(before,JSON.stringify(state.root));
 assert.equal(saved,app.saved);
 assert.equal(state.undoStack.length,0);
 assert.ok(storage.has('gl_android_theme_finishes_v1'));
});
test('touch sheet exposes a real mini map for each preset, selectable contours and preferences',()=>{
 const {panel,doc}=setup();
 panel.open();
 const sheet=doc.body.find(e=>e.attrs.role==='dialog');
 assert.ok(sheet);
 assert.equal(sheet.attrs['aria-modal'],'true');
 const picker=sheet.find(e=>e.tagName==='details'&&e.id==='gl-android-map-style-picker');
 assert.ok(picker,'collapsed style picker is present');
 assert.equal(picker.open||false,false,'style picker is collapsed by default');
 assert.equal(picker.find(e=>e.tagName==='summary')!==null,true);
 const gallery=sheet.find(e=>e.className==='gl-android-style-gallery');
 assert.equal(gallery.children.length,Core.PRESETS.length);
 const preview=gallery.find(e=>e.tagName==='svg');
 assert.ok(preview);
 assert.equal(preview.all(e=>e.tagName==='text').length,3);
 assert.equal(sheet.find(e=>e.className==='gl-android-style-shapes'),null);
 assert.equal(sheet.all(e=>e.tagName==='select').length,0);
 panel.close();panel.openNode();
 const local=doc.body.find(e=>e.attrs.role==='dialog');
 assert.equal(local.find(e=>e.className==='gl-android-style-gallery'),null);
 assert.equal(local.find(e=>e.className==='gl-android-style-finishing'),null);
 assert.equal(local.find(e=>e.className==='gl-android-style-shapes').children.length,7);
 panel.close();panel.openInterface();
 const ui=doc.body.find(e=>e.attrs.role==='dialog');
 assert.equal(ui.find(e=>e.className==='gl-android-style-gallery'),null);
 assert.equal(ui.all(e=>e.tagName==='select').length,3);
 panel.close();assert.equal(doc.body.children.length,0);
});
test('Android canvas and SVG exports share the same borderless default',()=>{
 const renderer=read('apps/android/editor/renderer.js');
 const io=read('apps/android/editor/io.js');
 assert.match(renderer,/const shape=\['plain','none','card'/);
 assert.match(renderer,/if\(plain\)\{/);
 assert.match(renderer,/ctx\.moveTo\(x\+8,y\+m\.height-2\)/);
 assert.match(io,/if\(shape==='plain'\|\|shape==='none'\)return ''/);
 assert.match(io,/nmAndroidShapeSVG\(\)/);
});
test('Android inline editor obeys visualViewport when the software keyboard appears',()=>{
 // Lexical fragment after app.js split — keep the keyboard contract here.
 const app=read('apps/android/editor/app-inline-edit.js'),css=read(
  'apps/android/native/app/src/main/assets/assets/mobile-map-polish.css');
 assert.match(app,/window\.visualViewport/);
 assert.match(app,/viewportHeight-110/);
 assert.match(app,/this\.renderer\.camera\.y\+=dy/);
 assert.match(app,/this\.layout\.editingLabel=\{id:node\.id,text:/);
 assert.match(css,/font-size:16px!important/);
 assert.match(css,/backdrop-filter:blur\(8px\)/);
});
test('APK stages canonical map preset definitions and includes offline style assets',()=>{
 const html=read('apps/android/native/app/src/main/assets/app/index.html');
 const stage=read('scripts/release/prepare.py');
 const native=read('apps/android/native/app/src/main/assets/assets/map-style-core.js');
 assert.equal(native,read('packages/editor-ui/map-style-core.js'));
 assert.match(stage,/target \/ 'map-style-core\.js'/);
 for(const f of ['map-style-core.js','mobile-map-polish.js','mobile-map-polish.css']){
  assert.ok(html.includes('/assets/'+f),f);
 }
 assert.ok(html.indexOf('map-style-core.js')<html.indexOf('mobile-map-polish.js'));
 assert.match(read('apps/android/native/app/src/main/assets/assets/mobile-node-actions.js'),
  /GlaukaAndroidStylePanel\?\.open/);
});

test('map gallery is still available for root-only selection, outline controls are hidden',()=>{
 const {panel,doc,app,state}=setup();
 state.selectedNodeId=state.root.id;state.selectedNodeIds=[state.root.id];
 panel.open();
 const sheet=doc.body.find(e=>e.attrs.role==='dialog');
 assert.ok(sheet);
 assert.equal(sheet.find(e=>e.className==='gl-android-style-shapes'),null);
 assert.equal(sheet.find(e=>e.className==='gl-android-style-gallery').children.length,Core.PRESETS.length);
 const snapshot=JSON.stringify(state.root);
 const t={app,state,tab:app.activeTabId,nodes:[]};
 assert.equal(panel.shapeOne(t,'card'),false);
 assert.equal(JSON.stringify(state.root),snapshot);
 assert.equal(panel.mapPreset(t,Core.PRESETS.find(p=>p.id==='free')),true);
 panel.close();
});
test('Android Style inspector has a persistent touch shortcut to the map gallery',()=>{
 const ui=read('apps/android/native/app/src/main/assets/assets/mobile-map-polish.js');
 const css=read('apps/android/native/app/src/main/assets/assets/mobile-map-polish.css');
 assert.match(ui,/getElementById\('inspector-sidebar'\)/);
 assert.match(ui,/launcher\.addEventListener\('click',\(\)=>open\('map'\)\)/);
 assert.match(css,/#inspector-sidebar #gl-android-open-style/);
});
