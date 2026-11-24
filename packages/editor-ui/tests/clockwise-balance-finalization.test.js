'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../map-core');
const composeContinuation=require('./helpers/compose-continuation-layout.cjs');
const src=composeContinuation();
const begin=src.indexOf(' const settings=node=>');
const finish=src.indexOf(' // Visual forecast',begin);
assert.ok(begin>=0&&finish>begin,'continuation settings are available');
const settings=new Function('root',src.slice(begin,finish)+'\nreturn settings;')({NeuroMapCore:Core});
const forecastBegin=src.indexOf(' function forecastSummary(');
const forecastEnd=src.indexOf(' function updateForecast(',forecastBegin);
const forecast=new Function(src.slice(forecastBegin,forecastEnd)+'\nreturn forecastSummary;')();

const makeTree=count=>({id:'root',text:'Fegato',side:'root',children:[
 {id:'fegato',text:'Fegato',children:[{id:'ittero',text:'Ittero',children:[
 {id:'chirurgico',text:'a) chirurgico',children:[{id:'quadro',text:'Quadro clinico',
 children:Array.from({length:count},(_,i)=>({id:'leaf-'+i,text:'Argomento '+i,children:[]}))}]}]}]}
]});
const opts=(height,bias=50,gap=14)=>({height,bias,gap,primaryGap:20});
const measure=n=>({height:n.id==='quadro'?50:42,top:21,bottom:21});

test('legacy distribution uses one centre without rewriting saved settings',()=>{
 const old={layoutDistribution:{enabled:true,height:640,minimumHeight:160,initialOrder:true}};
 const before=JSON.stringify(old),parsed=settings(old);
 assert.equal(parsed.enabled,true);
 assert.equal(parsed.height,640);
 assert.equal(parsed.initialOrder,false);
 assert.equal(parsed.overflowMode,'expand');
 assert.equal(JSON.stringify(old),before);
 const fresh=settings({layoutDistribution:{enabled:true,height:960,minimumHeight:480,overflowMode:'expand'}});
 assert.equal(fresh.overflowMode,'expand');
 assert.equal(fresh.initialOrder,false);
});
test('new clockwise layout starts on the right, with only visual deep ancestor copies',()=>{
 const map=makeTree(36),original=JSON.stringify(map);
 const planned=Core.planAdaptiveContinuation(map,measure,opts(480));
 assert.equal(planned.blocked,false);
 assert.deepEqual(planned.pages.map(p=>p.side),['right','left']);
 assert.deepEqual(planned.pages.flatMap(p=>p.units),Array.from({length:36},(_,i)=>'leaf-'+i));
 for(const page of planned.pages){
  assert.equal(page.roots.length,1);
  let n=page.roots[0];
  for(const id of ['fegato','ittero','chirurgico','quadro']){
   assert.equal(n.logicalId,id);
   if(id!=='quadro')n=n.children[0];
  }
  assert.ok(n.children.length>0);
 }
 assert.equal(JSON.stringify(map),original,'never duplicate saved logical nodes');
});
test('vertical limit and distribution percentage reflow deterministically',()=>{
 const map=makeTree(48),before=JSON.stringify(map);
 let checks=0;
 for(const bias of [20,35,50,65,80])for(const gap of [4,14,34]){
  const first=Core.planAdaptiveContinuation(map,measure,opts(480,bias,gap));
  const bigger=Core.planAdaptiveContinuation(map,measure,opts(1500,bias,gap));
  const again=Core.planAdaptiveContinuation(map,measure,opts(480,bias,gap));
  const signature=p=>JSON.stringify(p.pages.map(x=>[x.side,x.capacity,x.height,x.units]));
  assert.equal(signature(first),signature(again));checks++;
  assert.ok(bigger.effectiveHeight<=Math.max(first.effectiveHeight,1500));checks++;
  assert.ok(first.pages.length<=2&&first.pages[0].side==='right');checks++;
  assert.equal(new Set(first.pages.flatMap(p=>p.units)).size,48);checks++;
  assert.ok(first.pages.every(p=>p.height<=p.capacity+1e-7));checks++;
 }
 assert.equal(checks,75);
 assert.equal(JSON.stringify(map),before);
});
test('the forecast reports measured capacity and predicted sector, not a vague density label',()=>{
 const plan=Core.planAdaptiveContinuation(makeTree(36),measure,opts(480));
 const data=forecast(plan,{height:480},{effective:plan.effectiveHeight,blocked:plan.blocked},
  {side:plan.pages.at(-1).side,sector:plan.pages.length,blocked:false});
 assert.equal(data.next.sector,2);
 assert.equal(data.right.nodes+data.left.nodes,36);
 assert.ok(data.right.capacity>0&&data.left.capacity>0);
 assert.ok(data.right.occupied<=data.right.capacity);
 assert.ok(data.left.occupied<=data.left.capacity);
 assert.ok(data.right.percent>=0&&data.right.percent<=100);
});


test('R14 dashed guides distinguish configured height from adaptive safe boundary',()=>{
 const host={NeuroMapCore:Core},doc={documentElement:{lang:'it'}};
 new Function('globalThis','document','performance',src)(host,doc,{now:()=>0});
 class Layout{
  computeLayout(){}getLayout(){}measureNode(){}
 }
 class Renderer{
  render(){}drawThresholdGuides(){}
 }
 class App{
  bindUI(){}updateStatus(){}nm611MoveSelection(){}nm612Bounds(){}
  findHit(){}selectNode(){}
 }
 host.NeuroMapContinuation.install(App,Layout,Renderer);
 const draws=[];
 const ctx={style:'',dash:[],save(){},restore(){},setLineDash(d){this.dash=d},
  beginPath(){},moveTo(x,y){this.y=y},lineTo(){},
  stroke(){draws.push({color:this.strokeStyle,y:this.y})}};
 const renderer=new Renderer();
 renderer.state={branchStyle:'xmind8',balanceBias:50,root:{
  layoutDistribution:{enabled:true,height:600,minimumHeight:480,overflowMode:'expand'}}};
 renderer.layout={logicalRoot:renderer.state.root,adaptiveLimit:{effective:900},
  continuationPlan:{pages:[{side:'right',height:500},{side:'left',height:400}]},
  continuationGroups:[{x:0,bounds:{minX:-500,maxX:500}}]};
 renderer.ctx=ctx;renderer.camera={zoom:1};renderer._distributionGuidesUntil=1000;renderer._distributionGuideState=renderer.state;
 renderer.drawThresholdGuides();
 assert.equal(draws.filter(d=>d.color.includes('251,191,36')).length,4);
 assert.equal(draws.filter(d=>d.color.includes('129,140,248')).length,4);
 assert.ok(draws.some(d=>d.color.includes('251,191,36')&&d.y===-300));
 assert.ok(draws.some(d=>d.color.includes('129,140,248')&&d.y===-450));
 const count=draws.length;renderer._distributionGuideState={};renderer.drawThresholdGuides();assert.equal(draws.length,count,'guides cannot leak into another document state');renderer._distributionGuideState=renderer.state;
 draws.length=0;renderer.layout.adaptiveLimit.effective=600;
 renderer.drawThresholdGuides();
 assert.equal(draws.filter(d=>d.color.includes('251,191,36')).length,0);
 assert.equal(draws.length,4);
});

test('manual side pins do not falsify the reported clockwise cut position',()=>{
 const nodes=Array.from({length:4},(_,i)=>({id:'n'+i,sidePinned:i===0?'left':i===1?'right':null}));
 const before=JSON.stringify(nodes);
 const metrics=Core.splitClockwise(nodes,[40,40,40,40],12,50);
 assert.equal(metrics.splitIndex,2,'true original-order cut');
 assert.equal(metrics.rightCount,1,'only one actually placed on right');
 assert.deepEqual(metrics.rightIds,['n1']);
 assert.deepEqual(metrics.leftIds,['n0','n2','n3']);
 assert.equal(JSON.stringify(nodes),before);
});

test('hiding inactive layout guides does not redraw the entire map for every text key',()=>{
 const host={NeuroMapCore:Core};new Function('globalThis','document','performance',src)(host,{documentElement:{lang:'it'}},{now:()=>0});
 let renders=0;const app={renderer:{_distributionGuidesUntil:0},requestRender(){renders++}};
 for(let i=0;i<1000;i++)host.NeuroMapContinuation.hideGuides(app);
 assert.equal(renders,0);
 app.renderer._distributionGuidesUntil=Infinity;app._distributionGuideHeld=true;host.NeuroMapContinuation.hideGuides(app);
 assert.equal(renders,1);assert.equal(app._distributionGuideHeld,false);assert.equal(app.renderer._distributionGuidesUntil,0);
});
