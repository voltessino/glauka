'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const recovery=require('../workspace-recovery');const today=require('../study-today');
const doc=()=>({tabs:[{id:'a',root:{id:'r',text:'Map',children:[{id:'n',text:'Child',children:[]}]},images:[],relationships:[]}],studyCards:[],learningPlans:[]});
test('recovery validates every tab before allowing a partial restore',()=>{
 const d=doc();assert.equal(recovery.decode(JSON.stringify(d)).tabs[0].root.text,'Map');
 for(const mutate of [x=>x.tabs.push({root:null}),x=>x.tabs[0].root.children.push({id:'n',text:'Duplicate'}),x=>x.tabs[0].images={},x=>x.studyCards={},x=>x.tabs.push({...x.tabs[0]})]){
  const bad=doc();mutate(bad);assert.throws(()=>recovery.validate(bad));
 }
});
test('native recovery accepts large valid workspaces beyond the import-file budget',()=>{
 const d=doc();d.tabs[0].root.children=Array.from({length:6000},(_,i)=>({id:'n'+i,text:'Node '+i,children:[]}));
 assert.equal(recovery.decode(JSON.stringify(d)).tabs[0].root.children.length,6000);
});
test('review summary uses actual due dates, local day and freshness without mutating cards',()=>{
 const now=new Date(2026,9,28,10,0).getTime(),start=new Date(2026,9,28).getTime();
 const cards=[{id:'new'},{id:'due',sr:{dueAt:now,lastReviewedAt:start}},{id:'future',sr:{dueAt:now+1,lastReviewedAt:now-1000}},{id:'stale'},{id:'old',sr:{dueAt:now+100,lastReviewedAt:start-1}},{id:'clock',sr:{dueAt:now+100,lastReviewedAt:now+100}}];
 const before=JSON.stringify(cards),app={studyCards:cards,v5Staleness:c=>c.id==='stale'?'stale':'fresh'};
 assert.deepEqual(today.summary(app,now),{due:2,stale:1,reviewed:2,total:6});assert.equal(JSON.stringify(cards),before);
});
test('recovered cameras never divide by zero, accept nonfinite values or escape map bounds',()=>{
 assert.equal(recovery.camera({x:NaN,y:0,zoom:1}),null);
 assert.equal(recovery.camera({x:0,y:0,zoom:'1'}),null);
 assert.deepEqual(recovery.camera({x:1e10,y:-1e10,zoom:0},.12),{x:1e8,y:-1e8,zoom:.12});
 assert.deepEqual(recovery.camera({x:15,y:25,zoom:2}),{x:15,y:25,zoom:2});
});
test('older supported WebViews use cryptographically random callback IDs without randomUUID',()=>{
 const crypto={getRandomValues(bytes){bytes.forEach((_,i)=>bytes[i]=i+1);return bytes;}};
 assert.equal(recovery.requestId(crypto),'01020304-0506-4708-890a-0b0c0d0e0f10');
 assert.throws(()=>recovery.requestId({}),/WebView/);
});
