'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../index');
const tree=n=>({id:'root',children:[{id:'main',children:Array.from({length:n},(_,i)=>({id:'leaf'+i,text:'Leaf '+i,children:[]}))}]});
const opts=(height,bias=50,gap=10)=>({height,bias,gap,primaryGap:gap});
const run=(r,h,b=50,g=10)=>C.planAdaptiveContinuation(r,()=>40,opts(h,b,g));
const shape=p=>p.pages.map(x=>[x.side,x.height,[...x.units]]);
test('adaptive fits one right and one left sector at minimum safe height',()=>{
 const t=tree(24),r=run(t,480);
 assert.equal(r.effectiveHeight,600);assert.equal(r.pages.length,2);
 assert.deepEqual(r.pages.map(x=>x.side),['right','left']);
 assert.ok(r.pages.every(x=>x.height<=x.capacity));
 assert.ok(C.planContinuation(t,()=>40,opts(580)).pages.length>2);
});
test('larger limit repacks clockwise back to the right, deterministically',()=>{
 const t=tree(24),before=JSON.stringify(t);
 const n=[480,600,720,960,1280].map(h=>run(t,h).pages[0].units.length);
 assert.ok(n.every((v,i)=>i===0||v>=n[i-1]),String(n));assert.equal(n.at(-1),24);
 const sig=shape(run(t,960));run(t,480);assert.deepEqual(shape(run(t,960)),sig);
 assert.equal(JSON.stringify(t),before);
});
test('spacing and distribution limits cooperate',()=>{
 const t=tree(24);
 for(const bias of [0,25,50,75,100])for(const gap of [0,10,25,60]){
  const x=run(t,480,bias,gap);
  assert.ok(!x.blocked&&x.pages.length<=2);
  assert.ok(x.pages.every(p=>p.height<=p.capacity+1e-6));
  if(bias===0)assert.ok(x.pages.every(p=>p.side==='left'));
  if(bias===100)assert.ok(x.pages.every(p=>p.side==='right'));
 }
});
test('deep ancestor aliases never duplicate logical leaves',()=>{
 const t={id:'root',children:[{id:'fegato',children:[{id:'ittero',children:[{
  id:'chirurgico',children:[{id:'quadro',children:tree(45).children[0].children}]
 }]}]}]};
 const r=run(t,480);assert.ok(r.pages.length<=2);
 assert.equal(r.pages.flatMap(p=>p.units).length,45);
 assert.equal(new Set(r.pages.flatMap(p=>p.units)).size,45);
 assert.ok(r.pages.every(p=>p.roots[0].logicalId==='fegato'));
});
test('asymmetric attached image footprint affects required height',()=>{
 const t={id:'root',children:[{id:'image',children:tree(26).children[0].children}]};
 const plain=run(t,480),image=C.planAdaptiveContinuation(t,n=>n.id==='image'?{
  height:40,top:140,bottom:50
 }:40,opts(480));
 assert.ok(image.effectiveHeight>=plain.effectiveHeight);
});
test('legacy settings and legacy planner stay compatible',()=>{
 assert.equal(C.continuationSettings({enabled:true,height:180}).overflowMode,undefined);
 assert.equal(C.continuationSettings({enabled:true,height:960,overflowMode:'expand'}).overflowMode,'expand');
 assert.ok(C.planContinuation(tree(24),()=>40,opts(180)).pages.length>2);
});
test('1000 user-map simulations / 5000 reversible invariants',()=>{
 let checks=0;
 for(let user=0;user<1000;user++){
  const n=2+user%31,b=[0,25,50,75,100][user%5],g=user%4*9;
  const t=tree(n),saved=JSON.stringify(t),h=480+(user%6)*160;
  const a=run(t,h,b,g);run(t,480,b,g);const again=run(t,h,b,g);
  assert.deepEqual(shape(a),shape(again));checks++;
  assert.ok(!a.blocked&&a.pages.length<=2);checks++;
  assert.equal(JSON.stringify(t),saved);checks++;
  assert.equal(new Set(a.pages.flatMap(p=>p.units)).size,n);checks++;
  assert.ok(a.pages.every(p=>p.height<=p.capacity+1e-6));checks++;
 }
 assert.equal(checks,5000);
});

test('interleaved pinned primaries reuse two sectors without moving or duplicating logical leaves',()=>{
 const t={id:'root',children:Array.from({length:40},(_,i)=>({id:'p'+i,sidePinned:i%2?'right':'left',children:[{id:'leaf'+i,children:[]}]}))};
 const before=JSON.stringify(t);
 for(const height of [480,960,2000,480]){
  const plan=run(t,height);
  assert.ok(plan.pages.length<=2);
  const leaves=plan.pages.flatMap(p=>p.units);
  assert.equal(new Set(leaves).size,40);assert.equal(leaves.length,40);
  for(const p of plan.pages)for(const n of p.roots)assert.equal(p.side,t.children.find(source=>source.id===n.logicalId).sidePinned);
 }
 assert.equal(JSON.stringify(t),before);
});

test('extreme bias never blocks a small deliberately pinned opposite-side branch',()=>{
 const t={id:'r',children:[{id:'left',sidePinned:'left',children:[]},{id:'right',sidePinned:'right',children:[]}]};
 for(const bias of [0,100]){
  const plan=C.planAdaptiveContinuation(t,()=>40,{height:480,bias,gap:10,primaryGap:20});
  assert.equal(plan.blocked,false);assert.equal(plan.pages.length,2);
  assert.deepEqual(new Set(plan.pages.map(p=>p.side)),new Set(['left','right']));
 }
});
