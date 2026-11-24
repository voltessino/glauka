'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../../map-core');
const composeContinuation=require('./helpers/compose-continuation-layout.cjs');
const script=composeContinuation();
const context={NeuroMapCore:Core,document:{documentElement:{lang:'it'}}};
vm.runInNewContext(script,context);
const Forecast=context.NeuroMapContinuation.forecastSummary;
test('140 adaptive planner maps yield forecast counts matching actual planner units',()=>{
 let total=0;
 for(let k=0;k<140;k++){
  const leafCount=4+k%31;
  const root={id:'root',side:'root',children:[{id:'main',text:'Anatomy',side:'right',
   children:Array.from({length:leafCount},(_,i)=>({id:'n'+i,text:'Node'+i,side:'right',children:[]}))}]};
  const original=JSON.stringify(root),height=480+k%50*40;
  const config={height,minimumHeight:480,overflowMode:'expand',enabled:true};
  const plan=Core.planAdaptiveContinuation(root,()=>({height:40,top:20,bottom:20}),{
   ...config,gap:14,primaryGap:20,bias:50});
  const result=Forecast(plan,config,{effective:plan.effectiveHeight,blocked:plan.blocked},null);
  assert.equal(result.right.nodes+result.left.nodes,plan.logicalLeafCount);
  assert.ok(result.right.percent<=100&&result.left.percent<=100);
  assert.equal(JSON.stringify(root),original);
  total+=plan.logicalLeafCount;
 }
 assert.equal(total,2540);
});

test('occupancy percentages use each side capacity for asymmetric distribution',()=>{
 const result=Forecast({pages:[{side:'right',height:900,capacity:1200,units:[]},{side:'left',height:300,capacity:400,units:[]}]},{height:800},{effective:800},null);
 assert.equal(result.right.percent,75);assert.equal(result.left.percent,75);
});
