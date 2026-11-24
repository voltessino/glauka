'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../../map-core');
globalThis.NeuroMapCore=Core;
globalThis.NeuroMapGraphics={bounds:()=>({})};
class Element {
 constructor(tag){this.tag=tag;this.id='';this.children=[];this.listeners={};this.style={};
  this.attributes={};this.type='';this.checked=false;this.value='';this.min='';this.max='';
  this.disabled=false;this.parent=null;this.textContent='';this.nodeValue=''}
 append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 after(item){if(!this.parent)throw Error('missing parent');item.parent=this.parent;
  this.parent.children.splice(this.parent.children.indexOf(this)+1,0,item)}
 setAttribute(key,value){this.attributes[key]=value}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
 get lastChild(){return this.children.at(-1)}
 get firstChild(){return this.children[0]}
 get lastElementChild(){return this.children.filter(x=>x instanceof Element).at(-1)}
}
const hud=new Element('hud'),last=new Element('button');hud.append(last);
globalThis.document={documentElement:new Element('html'),activeElement:null,
 createElement:tag=>new Element(tag),
 createTextNode:text=>Object.assign(new Element('#text'),{nodeValue:text}),
 querySelector:selector=>selector==='.hud-bottom-left'?hud:null,
 getElementById:id=>{
  const stack=[hud];while(stack.length){const e=stack.pop();if(e.id===id)return e;stack.push(...e.children)}
  return null
 }};
globalThis.MutationObserver=class{observe(){}};
globalThis.addEventListener=()=>{};
const origSetTimeout=globalThis.setTimeout;
const origClearTimeout=globalThis.clearTimeout;
globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
require('node:vm').runInThisContext(require('./helpers/compose-continuation-layout.cjs')(),{filename:'continuation-layout.js'});
class State {
 constructor(){this.root={id:'root',layoutMode:'clockwise',
  layoutDistribution:{enabled:true,height:780,minimumHeight:480,overflowMode:'expand'},
  children:[]};this.branchStyle='xmind8';this.selectedNodeId='root';this.history=[]}
 pushHistory(){this.history.push(JSON.stringify(this.root))}
 addChildNode(){}addSiblingNode(){}
}
class Layout {
 constructor(){this.continuationPlan=null;this.adaptiveLimit={configured:780,effective:900,blocked:false}}
}
class Renderer{drawThresholdGuides(){}render(){}}
class App{
 bindUI(){}updateStatus(){}nm611MoveSelection(){}nm612Bounds(){}
 findHit(){}selectNode(){}markChanged(){}requestRender(){}
}
globalThis.NeuroMapContinuation.install(App,Layout,Renderer);
const app=new App();app.state=new State();app.layout=new Layout();app.renderer={};app.bindUI();

test('1000 exact height adjustments preserve the selected preset and its enabled state',()=>{
 try{
  const exact=document.getElementById('nm-distribution-exact');
  assert.ok(exact);assert.equal(document.getElementById('nm-continuation-enabled'),null);
  for(let i=0;i<1000;i++){
   const height=480+(i%21)*100;
   app.state.root.layoutDistribution={enabled:true,height:600,minimumHeight:480,overflowMode:'expand'};
   exact.value=String(height);exact.listeners.change[0]();
   assert.equal(app.state.root.layoutMode,'clockwise');
   assert.equal(app.state.root.layoutDistribution.enabled,true);
   assert.equal(app.state.root.layoutDistribution.height,height);
  }
 }finally{globalThis.setTimeout=origSetTimeout;globalThis.clearTimeout=origClearTimeout}
});
test('a slider drag is one history transaction, and never persists derived size',()=>{
 globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
 try{
  const slider=document.getElementById('nm-distribution-height');
  app.state.root.layoutDistribution={enabled:true,height:600,minimumHeight:480,overflowMode:'expand'};
  app.updateStatus(); // Reframe the precision slider around the current height.
  const before=app.state.history.length;
  slider.listeners.pointerdown[0]();
  slider.value='720';slider.listeners.input[0]();
  slider.value='860';slider.listeners.input[0]();
  slider.listeners.change[0]();
  assert.equal(app.state.history.length-before,1);
  assert.equal(app.state.root.layoutDistribution.height,860);
  assert.equal(app.state.root.layoutDistribution.overflowMode,'expand');
  assert.equal(JSON.parse(app.state.history.at(-1)).layoutDistribution.height,600);
 }finally{globalThis.setTimeout=origSetTimeout;globalThis.clearTimeout=origClearTimeout}
});


test('R12 panel shows exact configured and automatically expanded thresholds',()=>{
 const original=app.state.root.layoutDistribution,oldAdaptive=app.layout.adaptiveLimit;
 try{
  app.state.root.layoutDistribution={enabled:true,height:780,minimumHeight:480,overflowMode:'expand'};
  app.state.balanceBias=50;
  app.layout.adaptiveLimit={configured:780,effective:900,blocked:false};
  app.updateStatus();
  const label=document.getElementById('nm-distribution-limit-value');
  assert.equal(label.textContent,'780 px → 900 px (adattato)');
  assert.equal(document.getElementById('nm-distribution-height').attributes['aria-valuetext'],label.textContent);
  assert.match(document.getElementById('nm-distribution-explanation').textContent,/900 px/);
  app.layout.adaptiveLimit={configured:780,effective:780,blocked:false};
  app.updateStatus();
  assert.equal(label.textContent,'780 px');
 }finally{
  app.state.root.layoutDistribution=original;app.layout.adaptiveLimit=oldAdaptive;
 }
});
