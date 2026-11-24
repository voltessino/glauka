'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const files=['apps/desktop-shared/editor/study-interactions.js',
 'apps/android/editor/study-interactions.js'];
const NOW=Date.UTC(2026,9,24,3),DAY=86400000;
function harness(file,filter='due'){
 const source=fs.readFileSync(path.join(__dirname,'../../..',file),'utf8');
 const section=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Expected real study methods: '+file);
  return source.slice(a,b);
 };
 const methods=[
  section('NeuroMapApp.prototype.v5Deck=function','NeuroMapApp.prototype.v5CurrentCard=function'),
  section('NeuroMapApp.prototype.v5CurrentCard=function','NeuroMapApp.prototype.v5CardStatus=function'),
  section('NeuroMapApp.prototype.restartFlashcards=function','NeuroMapApp.prototype.renderFlashcard=function'),
  section('NeuroMapApp.prototype.rateFlashcard=function','NeuroMapApp.prototype.v5DeleteCard=function')
 ].join('\n');
 function App(){}
 // Evaluate only these four trusted source methods; no DOM, provider, or network.
 new Function('NeuroMapApp','$v5','Date',methods)(
  App,()=>({value:filter}),{now:()=>NOW});
 const app=new App();
 app.activeTabId='t';app.studyCards=[];
 app.v5Staleness=()=> 'fresh';
 app.renderFlashcard=()=>{};app.revealFlashcard=()=>{};
 app.scheduleSave=()=>{app.saves=(app.saves||0)+1};
 app.showToast=()=>{app.toasts=(app.toasts||0)+1};
 return app;
}
for(const file of files){
 test(file+': due ordering stable, read-only and future cards excluded',()=>{
  const app=harness(file);
  app.studyCards=[
   {id:'b',sourceTabId:'t',sr:{dueAt:0}},
   {id:'a',sourceTabId:'t',sr:{dueAt:0}},
   {id:'future',sourceTabId:'t',sr:{dueAt:NOW+DAY}},
   {id:'invalid',sourceTabId:'t',sr:{dueAt:NaN}}
  ];
  const snapshot=app.studyCards.map(x=>x.id);
  assert.deepEqual(app.v5Deck().map(x=>x.id),['a','b','invalid']);
  assert.deepEqual(app.studyCards.map(x=>x.id),snapshot);
 });
 test(file+': valid ratings preserve counters and due dates',()=>{
  const app=harness(file),c={id:'a',sr:{intervalDays:2,reviews:4,lapses:1}};
  app.studyCards=[c];app.restartFlashcards();app._flashShowAnswer=true;
  app.rateFlashcard(3);
  assert.equal(c.sr.intervalDays,5);
  assert.equal(c.sr.dueAt,NOW+5*DAY);
  assert.equal(c.sr.reviews,5);assert.equal(c.sr.lapses,1);
  assert.equal(app.saves,1);
 });
 test(file+': again schedules 4 hours and resets session requeue',()=>{
  const app=harness(file),c={id:'a',sr:{intervalDays:7,reviews:2,lapses:0}};
  app.studyCards=[c];app.restartFlashcards();app._flashShowAnswer=true;
  app.rateFlashcard(1);
  assert.equal(c.sr.dueAt,NOW+4*3600000);
  assert.equal(c.sr.intervalDays,0);assert.equal(c.sr.lapses,1);
  assert.ok(app._v5Requeued.has('a'));
  app.restartFlashcards();assert.equal(app._v5Requeued.size,0);
 });
 test(file+': invalid ratings and stale cards never write progress',()=>{
  const app=harness(file),c={id:'a',sr:{intervalDays:7,reviews:2,lapses:0}};
  app.studyCards=[c];app.restartFlashcards();app._flashShowAnswer=true;
  const before=JSON.stringify(c);
  for(const bad of [0,4,-1,NaN,Infinity,'3',null]){
   app.rateFlashcard(bad);
   assert.equal(JSON.stringify(c),before);
  }
  app.v5Staleness=()=> 'stale';app.rateFlashcard(3);
  assert.equal(JSON.stringify(c),before);assert.equal(app.saves||0,0);
 });
 test(file+': corrupt imported SRS counters bounded without data loss',()=>{
  const app=harness(file),c={id:'a',sr:{intervalDays:Infinity,reviews:'bad',lapses:-7}};
  app.studyCards=[c];app.restartFlashcards();app._flashShowAnswer=true;
  app.rateFlashcard(2);
  assert.equal(c.sr.intervalDays,1);
  assert.equal(c.sr.reviews,1);assert.equal(c.sr.lapses,0);
  assert.equal(c.sr.dueAt,NOW+DAY);
 });
 test(file+': 1000-card forecast deterministic without mutating saved cards',()=>{
  const app=harness(file);
  app.studyCards=Array.from({length:1000},(_,i)=>({
   id:'card'+i,sourceTabId:'t',sr:{dueAt:i%3?NOW+DAY:NOW-DAY,
    reviews:i,lapses:0}
  }));
  const snapshot=JSON.stringify(app.studyCards);
  const expected=app.v5Deck().map(x=>x.id);
  for(let i=0;i<30;i++)assert.deepEqual(app.v5Deck().map(x=>x.id),expected);
  assert.equal(expected.length,334);
  assert.equal(JSON.stringify(app.studyCards),snapshot);
 });
}
