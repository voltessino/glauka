'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../../../apps/desktop-shared/editor/learn-core');
const A=require('../../../apps/desktop-shared/editor/learn-adaptive-core');
const clone=x=>JSON.parse(JSON.stringify(x));
const NOW=Date.UTC(2026,9,22,12),DAY=86400000;
const sample=()=>({id:'r',text:'Anatomia',children:[
 {id:'heart',text:'Cuore',notes:'Sangue',children:[]},
 {id:'kidney',text:'Rene',children:[]},
 {id:'liver',text:'Fegato',children:[]},
 {id:'lung',text:'Polmone',children:[]}
]});
const attempt=(nodeId,correct,answeredAt=NOW-1000,tabId='a',sourceSignature='current')=>
 ({nodeId,correct,answeredAt,tabId,sourceSignature,itemId:'q:'+nodeId+':'+answeredAt,
 format:'choice'});
const report=(tree,attempts=[],cards=[],tabId='a',signature='current')=>A.radar(tree,{
 tabId,attempts,cards,signatureFor:()=>signature,
 freshCard:()=>true,now:NOW
});
test('1000 independent maps: mistakes are read-only and tied to tab+node ID',()=>{
 for(let i=0;i<1000;i++){
  const map=sample(),original=JSON.stringify(map);
  const attempts=[attempt('heart',false,NOW-3000,'a'),
   attempt('kidney',true,NOW-2000,'a'),
   attempt('heart',true,NOW-1000,'other')];
  const r=report(map,attempts);
  assert.equal(r.byId.get('heart').mistakes,1);
  assert.equal(r.byId.get('kidney').correct,1);
  assert.equal(r.totals.attempts,2);
  assert.equal(r.totals.needsReview,1);
  assert.equal(JSON.stringify(map),original);
 }
});
test('stale source signatures excluded from current mistakes and kept distinct',()=>{
 const r=report(sample(),[attempt('heart',false,NOW-3000,'a','old'),
  attempt('heart',true,NOW-1000,'a','current')]);
 assert.equal(r.byId.get('heart').mistakes,0);
 assert.equal(r.byId.get('heart').staleAttempts,1);
 assert.equal(r.totals.stale,1);
 assert.equal(r.byId.get('heart').status,'reviewed');
});
test('recovering status requires observed error and later correct response',()=>{
 const result=report(sample(),[attempt('heart',false,NOW-2e6),
  attempt('heart',true,NOW-1000)]);
 assert.equal(result.byId.get('heart').status,'recovering');
 assert.equal(result.byId.get('heart').mistakes,1);
 assert.equal(result.byId.get('heart').consecutiveCorrect,1);
});
test('due flashcards count only matching current map sources',()=>{
 const cards=[
  {sourceTabId:'a',sourceNodeId:'heart',sr:{dueAt:NOW-5000}},
  {sourceTabId:'a',sourceNodeId:'heart',sr:{dueAt:NOW+DAY}},
  {sourceTabId:'other',sourceNodeId:'heart',sr:{dueAt:NOW-4000}},
  {sourceTabId:'a',sourceNodeId:'nonexistent',sr:{dueAt:NOW-4000}}
 ];
 const r=report(sample(),[],cards);
 assert.equal(r.byId.get('heart').dueCards,1);
 assert.equal(r.totals.dueCards,1);
});
test('existing flashcards never mutated by adaptive evidence projections',()=>{
 const c={id:'card',sourceTabId:'a',sourceNodeId:'heart',
  sr:{dueAt:NOW-400,reviews:6,lapses:2}};
 const list=[c],old=JSON.stringify(list);
 const r=report(sample(),[attempt('heart',false)],list);
 assert.equal(r.totals.mistakes,1);
 assert.equal(JSON.stringify(list),old);
});
test('quiz prioritization puts actual errors first, stable ties, no source changes',()=>{
 const items=[{nodeId:'lung',id:'a'},{nodeId:'heart',id:'b'},
  {nodeId:'kidney',id:'c'}],copy=clone(items);
 const ranked=A.prioritizeQuiz(items,report(sample(),[attempt('heart',false)]));
 assert.equal(ranked[0].nodeId,'heart');
 assert.deepEqual(items,copy);
});
test('exam plan accepts real Gregorian dates, rejects invalid date and minute limits',()=>{
 assert.equal(A.validDay('2028-02-29'),'2028-02-29');
 assert.equal(A.validDay('2027-02-29'),'');
 assert.equal(A.validDay('2026-13-01'),'');
 assert.equal(A.validDay('2026-11-31'),'');
 assert.equal(A.validDay('2030-01-01'),'2030-01-01');
 assert.throws(()=>A.setPlan([],{tabId:'a',examDate:'2026-11-31',
  minutesPerDay:30},NOW));
 assert.throws(()=>A.setPlan([],{tabId:'a',examDate:'2026-12-15',
  minutesPerDay:5},NOW));
});
test('1000 plan updates keep one independent validated plan per tab',()=>{
 let plans=[];
 for(let i=0;i<1000;i++)plans=A.setPlan(plans,{
  tabId:'a',examDate:'2026-11-22',minutesPerDay:30+(i%7)*5},NOW+i);
 assert.equal(plans.length,1);assert.equal(plans[0].minutesPerDay,30+(999%7)*5);
 plans=A.setPlan(plans,{tabId:'b',examDate:'2026-12-01',minutesPerDay:35},NOW);
 assert.equal(plans.length,2);
 assert.equal(A.cleanPlans(clone(plans)).length,2);
});
test('exam planner never schedules dates after the actual exam',()=>{
 const p={examDate:'2026-10-25',minutesPerDay:35};
 const source=sample(),before=JSON.stringify(source);
 const r=report(source,[attempt('heart',false),attempt('liver',true)]);
 const out=A.schedule(r,p,NOW);
 assert.deepEqual(out.days.map(x=>x.date),[
  '2026-10-22','2026-10-23','2026-10-24','2026-10-25']);
 assert.ok(out.days.every(d=>d.items.length<=5));
 assert.equal(JSON.stringify(source),before);
});
test('planner rejects past exams and caps long schedules to 180 days',()=>{
 assert.throws(()=>A.schedule(report(sample()),{
  examDate:'2026-01-01',minutesPerDay:30},NOW),/passed/);
 const x=A.schedule(report(sample()),{
  examDate:'2027-10-22',minutesPerDay:180},NOW);
 assert.equal(x.days.length,180);assert.equal(x.truncated,true);
 assert.ok(x.days.every(d=>d.items.length<=20));
});
test('1000 deterministic planner sessions: no mutation, daily budget respected',()=>{
 const map=sample(),old=JSON.stringify(map);
 const r=report(map,[attempt('heart',false),attempt('liver',true)]);
 const plan={examDate:'2026-11-04',minutesPerDay:20};
 const original=A.schedule(r,plan,NOW);
 for(let i=0;i<1000;i++){
  const output=A.schedule(r,plan,NOW);
  assert.deepEqual(output,original);
  assert.ok(output.days.every(d=>d.estimatedMinutes<=20));
 }
 assert.equal(JSON.stringify(map),old);
});
test('plan serialization cleans garbage without execution or state mutation',()=>{
 const originals=[
  {tabId:'a',examDate:'2026-12-31',minutesPerDay:45,updatedAt:100},
  {tabId:'b',examDate:'bad',minutesPerDay:90},
  {tabId:'c',examDate:'2026-11-30',minutesPerDay:NaN},
  {tabId:'a',examDate:'2026-12-25',minutesPerDay:35,updatedAt:200}
 ];
 const saved=JSON.stringify(originals);
 const clean=A.cleanPlans(originals);
 assert.equal(clean.length,1);
 assert.equal(clean[0].examDate,'2026-12-25');
 assert.equal(JSON.stringify(originals),saved);
});

test('future real flashcard deadlines are scheduled on their day, never early',()=>{
 const due=Date.UTC(2026,9,24,12);
 const r=report(sample(),[],[{sourceTabId:'a',sourceNodeId:'heart',
  sr:{dueAt:due,reviews:2,lapses:1}}]);
 const s=A.schedule(r,{examDate:'2026-10-27',minutesPerDay:35},NOW);
 const before=s.days.filter(d=>d.date<'2026-10-24');
 assert.ok(before.every(d=>d.items.every(i=>i.reason!=='due-flashcard')));
 const day=s.days.find(d=>d.date==='2026-10-24');
 assert.ok(day.items.some(i=>i.nodeId==='heart'&&i.reason==='due-flashcard'));
 assert.equal(s.days.flatMap(d=>d.items).filter(i=>i.reason==='due-flashcard'&&i.nodeId==='heart').length,1);
});
