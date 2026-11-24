'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const composeContinuation=require('./helpers/compose-continuation-layout.cjs');
const src=composeContinuation();
function fixture(lang='it'){
 const nodes=new Map();
 for(const id of ['nm620-layout-forecast','nm620-forecast-summary','nm620-forecast-right',
 'nm620-forecast-left','nm620-forecast-right-bar','nm620-forecast-left-bar','nm620-forecast-next']){
  nodes.set(id,{style:{},textContent:'',hidden:false});
 }
 const document={documentElement:{lang},getElementById:id=>nodes.get(id)||null};
 const root={NeuroMapCore:{continuationSettings:value=>value},document};
 const core=vm.runInNewContext(src+'\n;globalThis.NeuroMapContinuation',root);
 return {core,nodes,document};
}
function plan(){return {pages:[
 {side:'right',height:540,units:['a','b','c']},
 {side:'right',height:780,units:['d']},
 {side:'left',height:300,units:['e','f']}
 ],logicalLeafCount:6};}
test('forecast summarizes real sectors without changing the layout plan',()=>{
 const {core}=fixture(),p=plan(),saved=JSON.stringify(p);
 const out=core.forecastSummary(p,{height:960},{effective:1000},
 {side:'left',sector:3,blocked:false});
 assert.equal(out.sectors,3);assert.equal(out.right.pages,2);
 assert.equal(out.right.nodes,4);assert.equal(out.right.occupied,780);
 assert.equal(out.right.percent,78);assert.equal(out.left.percent,30);
 assert.equal(out.next.side,'left');assert.equal(out.next.sector,3);
 assert.equal(JSON.stringify(p),saved);
});
test('forecast gives explicit warnings when expansion is blocked',()=>{
 const {core,nodes}=fixture('it');
 const app={state:{root:{layoutDistribution:{enabled:true,height:960}},
  branchStyle:'neon'},layout:{continuationPlan:plan(),adaptiveLimit:{effective:1000,blocked:true}}};
 core.updateForecast(app,{side:null,blocked:true});
 assert.match(nodes.get('nm620-forecast-next').textContent,/Limite tecnico/);
 assert.equal(nodes.get('nm620-forecast-right-bar').style.width,'78%');
 assert.equal(nodes.get('nm620-forecast-left-bar').style.width,'30%');
});
test('forecast is hidden when continuation is off and when radial is selected',()=>{
 const {core,nodes}=fixture('en');
 const app={state:{root:{layoutDistribution:{enabled:false,height:960}},branchStyle:'neon'},
 layout:{continuationPlan:plan(),adaptiveLimit:{effective:1000}}};
 core.updateForecast(app,null);
 assert.equal(nodes.get('nm620-layout-forecast').hidden,true);
 app.state.root.layoutDistribution.enabled=true;
 app.state.branchStyle='radial';core.updateForecast(app,null);
 assert.equal(nodes.get('nm620-layout-forecast').hidden,true);
 app.state.branchStyle='neon';core.updateForecast(app,{side:'right',sector:2,blocked:false});
 assert.equal(nodes.get('nm620-layout-forecast').hidden,false);
 assert.match(nodes.get('nm620-forecast-next').textContent,/Sub-branch of.*on the right/);
});
test('many user slider configurations keep forecast between 0 and 100%',()=>{
 const {core}=fixture();let count=0;
 for(let i=0;i<10000;i++){
  const height=480+(i%160)*20,left=(i*17)%3200,right=(i*97)%3200;
  const out=core.forecastSummary({pages:[{side:'left',height:left,units:['a']},
   {side:'right',height:right,units:['b']}]},{height},{effective:Math.max(height,left,right)},null);
  assert.ok(out.left.percent>=0&&out.left.percent<=100);
  assert.ok(out.right.percent>=0&&out.right.percent<=100);count++;
 }
 assert.equal(count,10000);
});
