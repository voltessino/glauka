const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../../../apps/desktop-shared/editor/dashboard-core.js');
const node=(id,extra={})=>({id,text:id,children:[],...extra});
const tabs=(root,id='tab')=>[{id,state:{root}}];
const report=(tree,opts={})=>D.snapshot(tabs(tree),{today:'2026-10-24',...opts});
test('empty dashboard is explicit and read-only',()=>{
 const s=D.snapshot([],{today:'2026-10-24'});
 assert.equal(s.summary.openMaps,0);assert.equal(s.summary.nodes,0);
 assert.equal(s.summary.tasks,0);assert.equal(s.partial,false);
 assert.equal(s.source,'open-tabs-only');
});
test('central map topic never counts as a task even with imported status',()=>{
 const root=node('root',{taskStatus:'todo',dueDate:'2026-10-20',children:[node('task',{taskStatus:'todo'})]});
 const s=report(root);assert.equal(s.summary.nodes,2);assert.equal(s.summary.tasks,1);
 assert.equal(s.summary.overdue,0);assert.equal(s.summary.todo,1);
});
test('only recorded task status or valid due date creates an activity',()=>{
 const root=node('root',{children:[node('a'),node('b',{taskStatus:'unknown'}),
  node('c',{taskStatus:'todo'}),node('d',{dueDate:'2026-10-24'})]});
 const s=report(root);
 assert.equal(s.summary.nodes,5);assert.equal(s.summary.tasks,2);
 assert.equal(s.summary.todo,1);assert.equal(s.summary.undated,1);
 assert.equal(s.summary.today,1);
});
test('overdue today upcoming seven days and done are mutually exclusive',()=>{
 const root=node('root',{children:[
  node('late',{dueDate:'2026-10-23',taskStatus:'doing'}),
  node('now',{dueDate:'2026-10-24',taskStatus:'todo'}),
  node('week',{dueDate:'2026-10-31'}),
  node('later',{dueDate:'2026-11-01'}),
  node('done',{dueDate:'2026-10-20',taskStatus:'done'})]});
 const s=report(root);
 assert.deepEqual([s.summary.overdue,s.summary.today,s.summary.next7,s.summary.done],[1,1,1,1]);
 assert.deepEqual(s.groups.overdue.map(x=>x.nodeId),['late']);
 assert.deepEqual(s.groups.next7.map(x=>x.nodeId),['week']);
});
test('project tags and dated daily notes are explicit, never inferred',()=>{
 const root=node('root',{children:[
  node('a',{knowledge:{tags:['Progetto']}}),
  node('b',{knowledge:{tags:['PROJECT']}}),
  node('c',{knowledge:{tags:['Project']},taskStatus:'done'}),
  node('d',{knowledge:{dailyKey:'2026-10-24'}}),
  node('e',{text:'Progetto finto',notes:'2026-10-24'})]});
 const s=report(root);assert.equal(s.summary.projects,3);
 assert.equal(s.summary.dailyNotes,1);assert.equal(s.summary.tagged,3);
});
test('snapshot never mutates maps or metadata',()=>{
 const root=node('root',{children:[node('a',{knowledge:{tags:['Progetto'],fields:{x:{type:'text',value:'keep'}}},
  dueDate:'2026-10-24'})]});
 const before=JSON.stringify(root);report(root);report(root);
 assert.equal(JSON.stringify(root),before);
});
test('stable ordering and tab-specific navigation references',()=>{
 const a=node('r1',{children:[node('x',{dueDate:'2026-10-24'})]});
 const b=node('r2',{children:[node('x',{dueDate:'2026-10-24'})]});
 const input=[{id:'z',state:{root:a}},{id:'a',state:{root:b}}];
 const s=D.snapshot(input,{today:'2026-10-24'});
 assert.deepEqual(s.groups.today.map(x=>x.tabId),['a','z']);
 assert.ok(s.groups.today.every(x=>x.navigable));
 assert.deepEqual(s,D.snapshot(input,{today:'2026-10-24'}));
});
test('reject invalid and impossible reference dates',()=>{
 for(const value of ['',null,'2026-02-30','2026-13-01','2026-1-01','1800-01-01','2201-01-01']){
  assert.throws(()=>D.snapshot([],{today:value}));
 }
 assert.equal(D.validDay('2028-02-29'),true);
 assert.equal(D.validDay('2027-02-29'),false);
});
test('local date and week boundary are calendar-based',()=>{
 const d=new Date(2026,9,24,23,50,0);
 assert.equal(D.localDay(d),'2026-10-24');
 assert.equal(D.plusDays('2026-12-28',7),'2027-01-04');
 assert.throws(()=>D.localDay(new Date(NaN)));
});
test('wide 40k-node map is bounded and deterministic',()=>{
 const root=node('root');
 for(let i=0;i<39999;i++)root.children.push(node('n'+i,{dueDate:i%2?'2026-10-20':'2026-10-27'}));
 const s=report(root,{limit:40000,maxItems:12});
 assert.equal(s.summary.nodes,40000);
 assert.equal(s.summary.overdue,19999);
 assert.equal(s.summary.next7,20000);
 assert.equal(s.groups.overdue.length,12);
 assert.equal(s.partial,false);
});
test('deep 3500-node hierarchy is iterative',()=>{
 const root=node('root');let cursor=root;
 for(let i=0;i<3499;i++){const child=node('n'+i);cursor.children=[child];cursor=child}
 const s=report(root);assert.equal(s.summary.nodes,3500);assert.equal(s.partial,false);
});
test('truncated scan marks totals partial without inventing completeness',()=>{
 const root=node('root');
 for(let i=0;i<300;i++)root.children.push(node('n'+i,{taskStatus:'todo'}));
 const s=report(root,{limit:100});
 assert.equal(s.summary.nodes,100);assert.equal(s.partial,true);
 assert.equal(s.summary.openMaps,1);
});
test('duplicate logical IDs disable navigation to ambiguous targets',()=>{
 const root=node('root',{children:[node('dup',{dueDate:'2026-10-24'}),node('dup',{dueDate:'2026-10-24'})]});
 const s=report(root);
 assert.equal(s.summary.ambiguousReferences,1);
 assert.equal(s.groups.today.length,2);
 assert.ok(s.groups.today.every(x=>x.navigable===false));
});
test('more than 100 open tabs is explicitly partial',()=>{
 const input=Array.from({length:102},(_,i)=>({id:'t'+i,state:{root:node('r'+i)}}));
 const s=D.snapshot(input,{today:'2026-10-24'});
 assert.equal(s.summary.openMaps,102);assert.equal(s.summary.nodes,100);
 assert.equal(s.partial,true);
});
test('cyclic hierarchy marks partial rather than hanging',()=>{
 const root=node('root');root.children=[root];
 const s=report(root);assert.equal(s.summary.nodes,1);assert.equal(s.partial,true);
});
test('unsafe node references are not clickable',()=>{
 const root=node('root',{children:[node('',{dueDate:'2026-10-24'})]});
 const s=report(root);assert.equal(s.groups.today[0].navigable,false);
});
test('display cap and malformed limit remain bounded',()=>{
 const root=node('root');for(let i=0;i<150;i++)root.children.push(node('n'+i,{dueDate:'2026-10-24'}));
 const s=report(root,{maxItems:100000,limit:Infinity});
 assert.equal(s.groups.today.length,D.MAX_ITEMS);
 assert.equal(s.summary.today,150);
 assert.equal(s.partial,false);
});
test('randomized fixtures preserve due partition and do not mutate',()=>{
 let seed=42;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let round=0;round<500;round++){
  const root=node('root');let expected=[0,0,0];
  for(let j=0;j<30;j++){
   const choice=Math.floor(rand()*5);
   const due=['2026-10-20','2026-10-24','2026-10-29','2026-11-02',''][choice];
   root.children.push(node('n'+j,{dueDate:due}));
   if(choice<3)expected[choice]++;
  }
  const before=JSON.stringify(root),s=report(root);
  assert.deepEqual([s.summary.overdue,s.summary.today,s.summary.next7],expected);
  assert.equal(JSON.stringify(root),before);
 }
});