'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const composeContinuation=require('./helpers/compose-continuation-layout.cjs');
const src=composeContinuation();
class Element {
 constructor(tag='div'){this.tag=tag;this.id='';this.parent=null;this.children=[];
 this.listeners={};this.style={};this.attributes={};this.textContent='';this.nodeValue='';
 this.value='';this.checked=false;this.hidden=false;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 after(child){if(!this.parent)throw Error('parent missing');
  const index=this.parent.children.indexOf(this);child.parent=this.parent;
  this.parent.children.splice(index+1,0,child);}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 get lastChild(){return this.children.at(-1);}
 get firstChild(){return this.children[0];}
 get lastElementChild(){return this.children.at(-1);}
}
function fixture(){
 const hud=new Element('div'),last=new Element('button');hud.append(last);
 const document={documentElement:{lang:'it'},activeElement:null,createElement:tag=>new Element(tag),
  createTextNode:text=>Object.assign(new Element('#text'),{nodeValue:text}),
  querySelector:s=>s==='.hud-bottom-left'?hud:null,
  getElementById(id){const todo=[hud];while(todo.length){const el=todo.pop();
    if(el.id===id)return el;todo.push(...el.children);}return null;}};
 const ctx={document,performance:{now:()=>10},setTimeout:()=>0,clearTimeout:()=>{},
  MutationObserver:class{observe(){}},innerWidth:1200,innerHeight:800,
  addEventListener(){},NeuroMapCore:{continuationSettings:value=>value||{},ADAPTIVE_LIMIT_MAX:8000}};
 vm.runInNewContext(src,ctx);
 class State{
  constructor(){this.root={id:'root',layoutMode:'clockwise',layoutDistribution:{
   enabled:true,height:960,minimumHeight:480,overflowMode:'expand'},children:[]};
   this.selectedNodeId='root';this.branchStyle='xmind8';this.balanceBias=50;this.history=0;}
  pushHistory(){this.history++;}
  addChildNode(){}
  addSiblingNode(){}
  findNode(){return this.root;}
 }
 class Layout{constructor(){
  this.adaptiveLimit={effective:1000,configured:960,blocked:false};
  this.continuationPlan={logicalLeafCount:5,pages:[
   {side:'right',units:['a','b'],height:750},
   {side:'left',units:['c'],height:320}]};
  this.predictCount=0;
 }
  computeLayout(){}getLayout(){}measureNode(){}
  predictContinuation(){this.predictCount++;return {side:'left',sector:2,blocked:false};}
 }
 class Renderer{render(){}drawThresholdGuides(){}}
 class App{
  constructor(){this.state=new State();this.layout=new Layout();
   this.renderer=new Renderer();this.renderer.layout=this.layout;this.renderer.state=this.state;
   this.renderCount=0;}
  bindUI(){}updateStatus(){}markChanged(){this.updateStatus();}
  requestRender(){this.renderCount++;}
  nm611MoveSelection(){}nm612Bounds(){}findHit(){}selectNode(){}
 }
 ctx.NeuroMapContinuation.install(App,Layout,Renderer);
 const app=new App();app.bindUI();
 return {app,document,ctx};
}
test('layout forecast UI mounts next to existing slider without replacing it',()=>{
 const {app,document}=fixture();
 assert.ok(document.getElementById('nm-distribution-height'));
 assert.ok(document.getElementById('nm620-layout-forecast'));
 assert.match(document.getElementById('nm620-forecast-summary').textContent,/Un solo centro/);
 assert.match(document.getElementById('nm620-forecast-right').textContent,/Destra/);
 assert.equal(document.getElementById('nm620-forecast-right-bar').style.width,'75%');
 assert.equal(app.layout.predictCount,1);
});
test('preview next child predicts placement without touching map history or structure',()=>{
 const {app,document}=fixture();
 const before=JSON.stringify(app.state.root),history=app.state.history;
 const button=document.getElementById('nm620-preview-next');
 const start=app.layout.predictCount;
 button.listeners.click[0]();
 assert.equal(app.layout.predictCount,start+1);
 assert.match(document.getElementById('nm620-forecast-next').textContent,/Sottoramo di.*a sinistra/);
 assert.equal(app.state.history,history);assert.equal(JSON.stringify(app.state.root),before);
 assert.ok(app.renderCount>=1);
});

test('mouse slider uses a nearby 1200 px window even when the planner allows 100,000 px',()=>{
 const {app,document}=fixture();
 const range=document.getElementById('nm-distribution-height');
 assert.equal(Number(range.max)-Number(range.min),1200);
 assert.ok(Number(range.min)<=960&&Number(range.max)>=960);
 assert.equal(range.step,'20');
 app.state.root.layoutDistribution.height=6000;
 app.updateStatus();
 assert.equal(Number(range.max)-Number(range.min),1200);
 assert.ok(Number(range.min)<=6000&&Number(range.max)>=6000);
 const exact=document.getElementById('nm-distribution-exact');
 assert.equal(exact.value,'6000');
 assert.equal(Number(exact.max),8000); // fixture technical ceiling
});
test('fine buttons and exact number are saved once each and keep the preset',()=>{
 const {app,document}=fixture();
 const less=document.getElementById('nm-distribution-less');
 const more=document.getElementById('nm-distribution-more');
 const exact=document.getElementById('nm-distribution-exact');
 assert.ok(less&&more&&exact);
 const old=app.state.history;
 more.listeners.click[0]();
 assert.equal(app.state.root.layoutDistribution.height,1060);
 assert.equal(app.state.history-old,1);
 less.listeners.click[0]();
 assert.equal(app.state.root.layoutDistribution.height,960);
 assert.equal(app.state.history-old,2);
 exact.value='1245';
 exact.listeners.change[0]();
 assert.equal(app.state.root.layoutDistribution.height,1240);
 assert.equal(exact.value,'1240');
 assert.equal(app.state.history-old,3);
 exact.value='';
 exact.listeners.change[0]();
 assert.equal(app.state.root.layoutDistribution.height,1240,'an empty edit cannot reset the map');
 assert.equal(exact.value,'1240');
 assert.equal(app.state.history-old,3);
 assert.equal(app.state.root.layoutMode,'clockwise');
 assert.equal(app.state.root.layoutDistribution.overflowMode,'expand');
});
test('guide colors explain the chosen and applied heights without affecting map state',()=>{
 const {app,document}=fixture();
 app.updateStatus();
 const yellow=document.getElementById('nm-distribution-legend-chosen');
 const purple=document.getElementById('nm-distribution-legend-applied');
 const details=document.getElementById('nm-distribution-details');
 assert.ok(details);
 assert.equal(yellow.style.display,'inline-flex');
 assert.match(yellow.lastChild.textContent,/Giallo.*960 px/);
 assert.match(purple.lastChild.textContent,/Viola.*1000 px/);
 assert.match(document.getElementById('nm-distribution-actual').textContent,/40 px automatici/);
 const prior=JSON.stringify(app.state.root),hist=app.state.history;
 document.getElementById('nm620-show-guides').listeners.click[0]();
 assert.equal(JSON.stringify(app.state.root),prior);
 assert.equal(app.state.history,hist);
 app.layout.adaptiveLimit.effective=960;
 app.updateStatus();
 assert.equal(yellow.style.display,'none','no amber line when nothing was expanded');
 assert.match(purple.lastChild.textContent,/960 px/);
});
test('slider pointer drag remains one undo entry after multiple changes',()=>{
 const {app,document}=fixture(),range=document.getElementById('nm-distribution-height');
 const previous=app.state.history;
 range.listeners.pointerdown[0]();
 range.value='1040';range.listeners.input[0]();
 range.value='1140';range.listeners.input[0]();
 range.listeners.change[0]();
 assert.equal(app.state.history,previous+1);
 assert.equal(app.state.root.layoutDistribution.height,1140);
 assert.ok(Number(range.max)-Number(range.min)<=1200);
});


test('exact height can reach the technical maximum and clamps safely',()=>{
 const {app,document}=fixture();
 const input=document.getElementById('nm-distribution-exact');
 input.value='999999';
 input.listeners.change[0]();
 assert.equal(app.state.root.layoutDistribution.height,8000);
 assert.equal(input.value,'8000');
 let range=document.getElementById('nm-distribution-height');
 assert.ok(Number(range.max)-Number(range.min)<=1200);
 assert.equal(Number(range.max),8000);
 input.value='-1';
 input.listeners.change[0]();
 assert.equal(app.state.root.layoutDistribution.height,480);
 assert.equal(input.value,'480');
 const before=app.state.history;
 document.getElementById('nm-distribution-less').listeners.click[0]();
 assert.equal(app.state.history,before,'no undo operation for an unchanged value');
});
test('labels stay understandable in English and the technical explanation is opt-in',()=>{
 const {app,document}=fixture();
 const panel=document.getElementById('nm-distribution-controls');
 const details=document.getElementById('nm-distribution-details');
 assert.ok(details&&details.tag==='details');
 document.documentElement.lang='en';
 panel._localize();
 assert.equal(document.getElementById('nm620-show-guides').textContent,'Show guides');
 assert.equal(document.getElementById('nm620-preview-next').textContent,'Predict side');
 assert.match(document.getElementById('nm-distribution-actual').textContent,/Applied by Glauka/);
 assert.match(document.getElementById('nm-distribution-legend-applied').lastChild.textContent,/Purple: applied/);
});

test('layout controls only mount once across repeated binds',()=>{
 const {app,document}=fixture();
 app.bindUI();assert.ok(document.getElementById('nm620-show-guides'));
 const found=[];const todo=[document.querySelector('.hud-bottom-left')];
 while(todo.length){const el=todo.pop();if(el.id==='nm620-layout-forecast')found.push(el);
  todo.push(...el.children);}
 assert.equal(found.length,1);
});
