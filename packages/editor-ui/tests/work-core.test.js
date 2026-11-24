const {test}=require('node:test');
const assert=require('node:assert/strict');
const work=require('../work-core');
const tree=()=>({id:'root',text:'Product',children:[
{id:'a',text:'Design',taskStatus:'todo',startDate:'2026-11-02',dueDate:'2026-11-05',children:[]},
{id:'b',text:'Build',taskStatus:'doing',dueDate:'2026-11-15',children:[]},
{id:'c',text:'Publish',taskStatus:'done',children:[]},
{id:'d',text:'Research',children:[]}
]});
test('all task IDs remain in Kanban; missing status is never filled automatically',()=>{
 const t=tree(),before=JSON.stringify(t),v=work.project(t,'kanban');
 assert.deepEqual(v.nodes.map(n=>n.id),['d','a','b','c']);
 assert.deepEqual(v.columns.map(c=>c.count),[1,1,1,1]);
 assert.equal(v.unassigned,1);
 assert.equal(JSON.stringify(t),before);
});
test('timeline only includes dated nodes and does not make up dates',()=>{
 const p=work.project(tree(),'timeline');
 assert.deepEqual(p.nodes.map(n=>n.id),['a','b']);
 assert.equal(p.missingDates,2);
 assert.equal(p.nodes[0].startDate,'2026-11-02');
 assert.equal(p.nodes[1].startDate,null);
 assert.equal(p.nodes[1].dueDate,'2026-11-15');
 assert.ok(p.nodes[0].x < p.nodes[1].x);
});
test('validates real calendar dates and leap years',()=>{
 assert.equal(work.parseDate('2028-02-29'),'2028-02-29');
 for(const bad of ['2027-02-29','2026-11-31','2026-13-01',' 2026-01-01','01/01/2026',null])assert.equal(work.parseDate(bad),null);
});
test('undated maps produce a helpful empty view, not a default timestamp',()=>{
 const p=work.project({id:'root',children:[{id:'a',text:'One',children:[]}]},'timeline');
 assert.equal(p.empty,true);assert.equal(p.nodes.length,0);assert.equal(p.missingDates,1);
});
test('malformed and cyclic trees are refused without mutation',()=>{
 assert.throws(()=>work.project({id:'root',children:[{id:'root',children:[]}]},'kanban'),/Invalid/);
 const root={id:'x',children:[]};root.children.push(root);
 assert.throws(()=>work.project(root,'timeline'),/Invalid/);
});
test('dates cannot create a timeline larger than the supported decade',()=>{
 const r={id:'root',children:[
 {id:'old',text:'Old',startDate:'1900-01-01',children:[]},
 {id:'new',text:'New',dueDate:'2200-12-31',children:[]}]};
 assert.throws(()=>work.project(r,'timeline'),/ten years/);
});
test('calendar ticks include both endpoints, remain bounded and equal-date tasks keep source order',()=>{
 const root={id:'r',children:[{id:'a',startDate:'2026-11-03',dueDate:'2026-11-08'},{id:'b',startDate:'2026-11-03'},{id:'c',startDate:'2026-11-03'}]};
 const p=work.project(root,'timeline');
 assert.deepEqual(p.nodes.map(n=>n.id),['a','b','c']);
 assert.equal(p.ticks[0].date,'2026-11-03');assert.equal(p.ticks.at(-1).date,'2026-11-08');
 assert.ok(p.ticks.every(t=>t.x>=0&&t.x<p.width));
 const single=work.project({id:'r',children:[{id:'a',dueDate:'2028-02-29'}]},'timeline');
 assert.equal(single.ticks.length,1);assert.equal(single.ticks[0].date,'2028-02-29');
});

test('Kanban retains explicit date/status metadata and leaves room for readable card footers',()=>{
 const root=tree(),before=JSON.stringify(root);
 const layout=work.project(root,'kanban');
 const todo=layout.nodes.find(n=>n.id==='a'),doing=layout.nodes.find(n=>n.id==='b');
 assert.equal(todo.startDate,'2026-11-02');
 assert.equal(todo.dueDate,'2026-11-05');
 assert.equal(doing.startDate,null);
 assert.equal(doing.status,'doing');
 assert.equal(todo.h,100);
 assert.equal(doing.h,100);
 assert.ok(layout.nodes.every(n=>n.x-n.w/2>0&&n.y-n.h/2>78));
 const group={id:'root',children:[{id:'first',taskStatus:'todo'},{id:'second',taskStatus:'todo'}]};
 const crowded=work.project(group,'kanban');
 const [a,b]=crowded.nodes;
 assert.ok(b.y-a.y>(a.h+b.h)/2,'Kanban rows should not collide');
 assert.equal(JSON.stringify(root),before);
});

test('compact Kanban and Timeline rows stay separate without changing map data',()=>{
 const root={id:'root',children:Array.from({length:20},(_,i)=>({
   id:'task-'+i,text:'Task '+i,taskStatus:'todo',startDate:'2026-11-01',dueDate:'2026-11-03',children:[]
 }))};
 const before=JSON.stringify(root),board=work.project(root,'kanban');
 for(let i=1;i<board.nodes.length;i++)assert.ok(
   board.nodes[i].y-board.nodes[i-1].y>=(board.nodes[i].h+board.nodes[i-1].h)/2+12,
   'Kanban rows preserve at least 12px spacing');
 const timeline=work.project(root,'timeline');
 for(let i=1;i<timeline.nodes.length;i++)assert.ok(
   timeline.nodes[i].y-timeline.nodes[i-1].y>=64,'Timeline labels use stable compact rows');
 assert.equal(JSON.stringify(root),before,'no mutation of the source tree');
});
test('single-date events are milestones but dated ranges remain bars without inventing dates',()=>{
 const root={id:'root',children:[
  {id:'event',text:'Conference',dueDate:'2026-11-06',children:[]},
  {id:'range',text:'Prepare',startDate:'2026-11-02',dueDate:'2026-11-08',children:[]},
  {id:'unset',text:'Unscheduled',children:[]}
 ]};
 const original=JSON.stringify(root),a=work.project(root,'timeline');
 assert.equal(a.nodes.length,2);
 assert.equal(a.nodes.find(n=>n.id==='event').milestone,true);
 assert.ok(a.nodes.find(n=>n.id==='event').w>=28);
 assert.equal(a.nodes.find(n=>n.id==='range').milestone,false);
 assert.equal(a.missingDates,1);
 assert.deepEqual(a,work.project(root,'timeline'));
 assert.equal(JSON.stringify(root),original);
});

test('Kanban ordering is independent from map branch order and deterministic',()=>{
 const root={id:'root',children:[
  {id:'a',taskStatus:'todo',taskOrder:2},{id:'b',taskStatus:'todo',taskOrder:0},
  {id:'c',taskStatus:'todo',taskOrder:1},{id:'d',taskStatus:'doing'}
 ]},before=JSON.stringify(root);
 const view=work.project(root,'kanban');
 assert.deepEqual(view.nodes.map(n=>n.id),['b','c','a','d']);
 assert.deepEqual(root.children.map(n=>n.id),['a','b','c','d']);
 assert.deepEqual(work.project(root,'kanban'),view);
 assert.equal(JSON.stringify(root),before);
});

test('Kanban reorder planner supports atomic move within and across columns',()=>{
 const root={id:'root',children:[
  {id:'a',taskStatus:'todo'}, {id:'b',taskStatus:'todo'},
  {id:'c',taskStatus:'doing'}, {id:'d',taskStatus:'doing'}
 ]},before=JSON.stringify(root);
 const reorder=work.planKanbanMove(root,'b','todo','a');
 assert.deepEqual(reorder.orderedIds,['b','a']);
 assert.deepEqual(reorder.changes,[
  {id:'b',taskOrder:0},{id:'a',taskOrder:1}]);
 const moved=work.planKanbanMove(root,'a','doing','d');
 assert.deepEqual(moved.orderedIds,['c','a','d']);
 assert.deepEqual(moved.changes,[
  {id:'c',taskOrder:0},{id:'a',taskStatus:'doing',taskOrder:1},
  {id:'d',taskOrder:2}]);
 assert.equal(work.planKanbanMove(root,'a','todo','b'),null,'unchanged order has no history');
 assert.equal(JSON.stringify(root),before);
});

test('invalid Kanban moves are rejected without mutation and legacy order remains stable',()=>{
 const root={id:'r',children:[
  {id:'a',taskStatus:'todo',taskOrder:-1},
  {id:'b',taskStatus:'todo',taskOrder:9999},
  {id:'c',taskStatus:'todo',taskOrder:'10'},
  {id:'d',taskStatus:'doing'}
 ]};
 const before=JSON.stringify(root);
 assert.deepEqual(work.project(root,'kanban').nodes.map(n=>n.id),['a','b','c','d']);
 for(const args of [
  ['wrong','todo',null],['a','invalid',null],['r','todo',null],
  ['a','doing','b'],['a','todo','a'],['a','todo','ghost']
 ])assert.equal(work.planKanbanMove(root,...args),null);
 assert.equal(work.taskOrder(null),null);
 assert.equal(work.taskOrder(0),0);
 assert.equal(work.taskOrder(2000),null);
 assert.equal(JSON.stringify(root),before);
});

test('1,000 Kanban tasks can be re-ranked without affecting canonical hierarchy',()=>{
 const statuses=['todo','doing','done',''];
 const root={id:'root',children:Array.from({length:1000},(_,i)=>({
  id:'task-'+i,taskStatus:statuses[i%4]||undefined,children:[]
 }))};
 const before=JSON.stringify(root);
 const plan=work.planKanbanMove(root,'task-999','todo','task-0');
 assert.ok(plan);
 assert.equal(plan.orderedIds[0],'task-999');
 assert.equal(plan.orderedIds.length,251);
 assert.equal(JSON.stringify(root),before);
 const index=new Map(root.children.map(n=>[n.id,n]));
 for(const change of plan.changes){
  const n=index.get(change.id);
  if(Object.prototype.hasOwnProperty.call(change,'taskStatus'))
   n.taskStatus=change.taskStatus==='unassigned'?undefined:change.taskStatus;
  n.taskOrder=change.taskOrder;
 }
 const layout=work.project(root,'kanban');
 assert.equal(layout.nodes.length,1000);
 assert.equal(layout.columns.reduce((sum,c)=>sum+c.count,0),1000);
 assert.equal(layout.nodes.find(n=>n.status==='todo').id,'task-999');
 assert.deepEqual(root.children.map(n=>n.id),Array.from({length:1000},(_,i)=>'task-'+i));
 const selected=layout.nodes.filter(n=>n.status==='todo');
 assert.equal(new Set(selected.map(n=>n.taskOrder)).size,selected.length);
});

test('timeline supports calendar day/week/month scales with proportional date geometry',()=>{
 const tree={id:'r',children:[
  {id:'first',text:'First',startDate:'2026-11-01'},
  {id:'middle',text:'Middle',startDate:'2026-11-15',dueDate:'2026-11-22'},
  {id:'last',text:'Last',dueDate:'2026-12-30'}
 ]};
 const before=JSON.stringify(tree),projections={};
 for(const timeScale of work.TIMELINE_SCALES){
  const layout=work.project(tree,'timeline',{timeScale});
  projections[timeScale]=layout;
  assert.equal(layout.timeScale,timeScale);
  assert.equal(layout.nodes.length,3);
  assert.equal(layout.ticks[0].date,'2026-11-01');
  assert.equal(layout.ticks.at(-1).date,'2026-12-30');
  assert.ok(layout.ticks.every(t=>Number.isFinite(t.x)&&t.x>=300&&t.x<layout.width));
  const start=layout.nodes.find(n=>n.id==='first'),last=layout.nodes.find(n=>n.id==='last');
  assert.ok(start.x<last.x);
  assert.ok(layout.width<=19000,'canvas should remain bounded');
 }
 assert.ok(projections.days.width>projections.weeks.width);
 assert.ok(projections.weeks.width>projections.months.width);
 assert.deepEqual(work.project(tree,'timeline',{timeScale:'untrusted'}),projections.auto);
 assert.equal(JSON.stringify(tree),before);
});

test('timeline month ticks use actual calendar boundaries and no overlapping month labels',()=>{
 const root={id:'r',children:[
  {id:'start',startDate:'2026-01-17'},
  {id:'end',dueDate:'2027-03-25'}
 ]};
 const p=work.project(root,'timeline',{timeScale:'months'});
 const inner=p.ticks.slice(1,-1);
 assert.ok(inner.length>=3,'monthly axis should have calendar ticks');
 for(const tick of inner){
  assert.equal(tick.date.slice(-2),'01','interior tick must be a month boundary');
  assert.equal(tick.label,tick.date.slice(0,7));
 }
 const x=p.ticks.map(t=>t.x);
 assert.ok(x.every((n,i)=>i===0||n-x[i-1]>=139),'tick label intervals should be readable');
});

test('timeline long-range detail is safely bounded without distorting relative dates',()=>{
 const root={id:'r',children:[
  {id:'first',startDate:'2025-01-01'},
  {id:'middle',startDate:'2029-01-01'},
  {id:'last',dueDate:'2034-12-29'}
 ]};
 const p=work.project(root,'timeline',{timeScale:'days'});
 assert.equal(p.timeScale,'days');
 assert.ok(p.width<=19000);
 assert.ok(p.pxPerDay>0);
 assert.ok(p.ticks.length<150);
 const n=p.nodes;
 const delta1=n[1].x-n[0].x,delta2=n[2].x-n[1].x;
 assert.ok(delta1>0&&delta2>0);
 assert.equal(n[0].startDate,'2025-01-01');
});

test('same-day events have unique group positions without fabricated dates',()=>{
 const root={id:'r',children:[
  {id:'one',startDate:'2026-11-03'},
  {id:'two',dueDate:'2026-11-03'},
  {id:'three',startDate:'2026-11-04'},
  {id:'four',startDate:'2026-11-03'},
  {id:'unknown'}
 ]},before=JSON.stringify(root);
 const p=work.project(root,'timeline',{timeScale:'days'});
 assert.deepEqual(p.nodes.filter(n=>n.startGroupCount===3)
  .map(n=>[n.id,n.startGroupIndex]),[['one',0],['two',1],['four',2]]);
 assert.equal(p.nodes.find(n=>n.id==='three').startGroupCount,1);
 assert.equal(p.missingDates,1);
 assert.ok(p.nodes.every(n=>n.y>0&&Number.isFinite(n.y)));
 assert.equal(JSON.stringify(root),before);
});

test('explicit milestone predecessors can flag chronology conflicts without making up due dates',()=>{
 const root={id:'r',children:[
  {id:'late',startDate:'2026-11-20'},
  {id:'early',startDate:'2026-11-03',taskDependsOn:['late']},
  {id:'after',dueDate:'2026-11-22',taskDependsOn:['late']},
  {id:'unknown',taskDependsOn:['late']}
 ]};
 const before=JSON.stringify(root),layout=work.project(root,'timeline');
 assert.equal(layout.edges.length,2);
 assert.equal(layout.edges.find(e=>e.toId==='early').conflict,true);
 assert.equal(layout.edges.find(e=>e.toId==='after').conflict,false);
 assert.equal(layout.missingDates,1);
 assert.equal(root.children[0].dueDate,undefined);
 assert.equal(JSON.stringify(root),before);
});
