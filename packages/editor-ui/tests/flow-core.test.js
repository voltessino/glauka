const {test}=require('node:test');
const assert=require('node:assert/strict');
const flow=require('../flow-core');
const nodes={id:'root',text:'Roadmap',children:[
 {id:'collect',text:'Collect data',children:[]},
 {id:'decision',text:'Ready?',children:[]},
 {id:'publish',text:'Publish',children:[]},
 {id:'revise',text:'Revise',children:[]}
]};
const edge=(fromId,toId,kind,id)=>({id:id||fromId+'-'+toId,fromId,toId,kind});
test('untyped existing cross-links never become process steps',()=>{
 const original=JSON.stringify(nodes);
 const view=flow.project(nodes,[edge('collect','decision',undefined)]);
 assert.equal(view.empty,true);assert.equal(view.edges.length,0);assert.equal(view.candidates.length,5);
 assert.equal(JSON.stringify(nodes),original);
});
test('explicit sequence and conditional edges preserve direction and labels',()=>{
 const p=flow.project(nodes,[edge('collect','decision','sequence'),edge('decision','publish','yes'),edge('decision','revise','no')]);
 assert.equal(p.edges.length,3);assert.equal(p.empty,false);assert.equal(p.hasCycles,false);
 assert.equal(p.nodes.some(n=>n.id==='root'),false,'top-level topic is not automatically a process');
 assert.equal(p.nodes.find(n=>n.id==='decision').decision,true);
 assert.equal(p.edges[1].label,'Sì');
 assert.ok(p.nodes.find(n=>n.id==='collect').depth < p.nodes.find(n=>n.id==='decision').depth);
 assert.ok(p.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
});
test('cycles are finite and represented, not silently deleted',()=>{
 const p=flow.project(nodes,[edge('collect','decision','sequence'),edge('decision','revise','yes'),edge('revise','decision','sequence')]);
 assert.equal(p.nodes.length,3);assert.equal(p.edges.length,3);assert.equal(p.hasCycles,true);
 assert.ok(p.edges.every(e=>p.nodes.some(n=>n.id===e.fromId)&&p.nodes.some(n=>n.id===e.toId)));
 assert.ok(flow.path(p.nodes[0],p.nodes[1]).startsWith('M'));
});
test('dangling, self and duplicate transitions never corrupt graph',()=>{
 const p=flow.project(nodes,[edge('collect','ghost','sequence'),edge('decision','decision','yes'),edge('collect','decision','yes','a'),edge('collect','decision','yes','b'),edge('collect','decision',undefined)]);
 assert.equal(p.edges.length,1);
 assert.equal(p.edges[0].id,'a');
});
test('flow ordering is deterministic and does not change the map',()=>{
 const transitions=[edge('collect','decision','sequence'),edge('decision','publish','yes')];
 const snapshot=JSON.stringify(nodes),first=flow.project(nodes,transitions),second=flow.project(nodes,transitions);
 assert.deepEqual(first,second);
 assert.equal(JSON.stringify(nodes),snapshot);
});
test('node names remain text; malformed and oversized maps are rejected',()=>{
 const weird={id:'x',text:'<script>alert(1)</script>',children:[]};
 assert.equal(flow.candidates(weird)[0].text,'<script>alert(1)</script>');
 const duplicate={id:'root',children:[{id:'root',children:[]}]};
 assert.throws(()=>flow.project(duplicate,[]),/Invalid node/);
 const cycle={id:'cycle',children:[]};cycle.children.push(cycle);
 assert.throws(()=>flow.project(cycle,[]),/Invalid node/);
 assert.throws(()=>flow.project(nodes,[],{maxCandidates:2}),/too large/);
});

test('explicit decision sources receive diamond geometry and tier spacing stays collision-safe',()=>{
 const edges=[edge('collect','decision','sequence'),edge('decision','publish','yes'),edge('decision','revise','no')];
 const before=JSON.stringify(nodes),p=flow.project(nodes,edges);
 const diamond=p.nodes.find(n=>n.id==='decision');
 assert.equal(diamond.decision,true);
 assert.equal(diamond.w,206);assert.equal(diamond.h,148);
 assert.equal(p.nodes.find(n=>n.id==='collect').decision,false);
 for(let i=0;i<p.nodes.length;i++)for(let j=i+1;j<p.nodes.length;j++){
  const a=p.nodes[i],b=p.nodes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
    Math.abs(a.y-b.y)>=(a.h+b.h)/2,'process node boxes must not overlap');
 }
 assert.ok(p.width>=diamond.x+diamond.w/2);
 assert.ok(p.height>=diamond.y+diamond.h/2);
 assert.equal(JSON.stringify(nodes),before);
});

test('start and end capsules derive only from explicit connected graph topology',()=>{
 const before=JSON.stringify(nodes);
 const graph=flow.project(nodes,[
  edge('collect','decision','sequence'),
  edge('decision','publish','yes'),edge('decision','revise','no')
 ]);
 const by=id=>graph.nodes.find(n=>n.id===id);
 assert.equal(by('collect').shape,'start');
 assert.equal(by('collect').terminal,true);
 assert.equal(by('decision').shape,'decision');
 assert.equal(by('decision').decision,true);
 assert.equal(by('publish').shape,'end');
 assert.equal(by('revise').shape,'end');
 assert.ok(graph.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
 assert.equal(JSON.stringify(nodes),before);
 const empty=flow.project(nodes,[]);
 assert.equal(empty.nodes.length,0,'unconnected siblings do not become process steps');
});

test('explicit per-node flow shapes override automatic geometry without changing directed transitions',()=>{
 const project={id:'r',children:[
  {id:'a',text:'A',flowShape:'process'},
  {id:'b',text:'B',flowShape:'decision'},
  {id:'c',text:'C',flowShape:'end'},
  {id:'d',text:'D',flowShape:'not-a-real-shape'}
 ]};
 const before=JSON.stringify(project),p=flow.project(project,[
  edge('a','b','sequence'),edge('b','c','sequence'),edge('c','d','sequence')
 ]);
 const get=id=>p.nodes.find(n=>n.id===id);
 assert.equal(get('a').shape,'process');
 assert.equal(get('b').shape,'decision');
 assert.equal(get('b').decision,true);
 assert.equal(get('c').shape,'end');
 assert.equal(get('d').shape,'end','invalid manual role falls back to topology');
 assert.equal(flow.shape('__proto__'),'auto');
 assert.deepEqual(flow.SHAPES,['auto','start','end','process','decision','input','output']);
 assert.equal(JSON.stringify(project),before);
});

test('yes/no edges depart through separate diamond perimeter ports and labels are paired',()=>{
 const graph=flow.project(nodes,[
  edge('collect','decision','sequence'),
  edge('decision','publish','yes'),edge('decision','revise','no')
 ]);
 const find=id=>graph.nodes.find(n=>n.id===id),a=find('decision');
 const yes=flow.ports(a,find('publish'),'yes');
 const no=flow.ports(a,find('revise'),'no');
 assert.equal(yes.sx,no.sx);
 assert.ok(yes.sy<a.y&&no.sy>a.y);
 assert.ok(yes.sx>a.x&&yes.sx<a.x+a.w/2);
 assert.notEqual(flow.path(a,find('publish'),'yes'),flow.path(a,find('revise'),'no'));
 const yesLabel=flow.labelPoint(a,find('publish'),'yes');
 const noLabel=flow.labelPoint(a,find('revise'),'no');
 assert.ok(yesLabel.y<noLabel.y);
 assert.ok(yesLabel.x>yes.sx);
});

test('cycle return paths route outside both cards rather than through their interiors',()=>{
 const graph=flow.project(nodes,[
  edge('collect','decision','sequence'),edge('decision','revise','yes'),
  edge('revise','decision','sequence')
 ]);
 assert.equal(graph.hasCycles,true);
 const get=id=>graph.nodes.find(n=>n.id===id),revise=get('revise'),decision=get('decision');
 const backwards=flow.path(revise,decision,'sequence');
 assert.ok((backwards.match(/ H/g)||[]).length>=3,backwards);
 assert.ok(backwards.includes(' V'));
 const pos=flow.labelPoint(revise,decision,'sequence');
 assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.y));
});

test('explicit process shapes appear before connecting edges while unmarked siblings stay hidden',()=>{
 const tree={id:'root',text:'Study',children:[
  {id:'start',text:'Start',flowShape:'start',children:[]},
  {id:'end',text:'End',flowShape:'end',children:[]},
  {id:'unmarked',text:'Unmarked',children:[]}
 ]};
 const original=JSON.stringify(tree);
 const view=flow.project(tree,[]);
 assert.equal(view.empty,false);
 assert.equal(view.edges.length,0);
 assert.deepEqual(view.nodes.map(n=>n.id),['start','end']);
 assert.deepEqual(view.nodes.map(n=>n.shape),['start','end']);
 assert.ok(view.nodes.every(n=>n.terminal===true));
 assert.equal(JSON.stringify(tree),original);
});

test('Yes branch is visually above No even when source map listed No first',()=>{
 const tree={id:'root',text:'Process',children:[
  {id:'choose',text:'Choose'},{id:'reject',text:'Reject'},{id:'approve',text:'Approve'}
 ]};
 const links=[edge('choose','reject','no'),edge('choose','approve','yes')];
 const snapshot=JSON.stringify({tree,links}),graph=flow.project(tree,links);
 assert.ok(graph.nodes.find(n=>n.id==='approve').y<graph.nodes.find(n=>n.id==='reject').y);
 assert.equal(graph.nodes.find(n=>n.id==='choose').shape,'decision');
 assert.equal(JSON.stringify({tree,links}),snapshot);
 assert.deepEqual(flow.project(tree,links),graph);
});

test('manual start/end contradictions are flagged without altering true links',()=>{
 const root={id:'root',children:[
  {id:'a',text:'First',flowShape:'end'},
  {id:'b',text:'Second',flowShape:'start'},
  {id:'c',text:'Third'}
 ]};
 const original=JSON.stringify(root);
 const g=flow.project(root,[edge('a','b','sequence'),edge('b','c','sequence')]);
 const by=id=>g.nodes.find(n=>n.id===id);
 assert.equal(by('a').roleConflict,true,'End with outgoing arrows is contradictory');
 assert.equal(by('b').roleConflict,true,'Start with incoming arrows is contradictory');
 assert.equal(by('c').roleConflict,false);
 assert.equal(g.edges.length,2);
 assert.equal(JSON.stringify(root),original);
});


test('explicit Input and Output project as parallelograms with correct boundary ports',()=>{
 const root={id:'root',text:'Project',children:[
  {id:'capture',text:'Acquire samples',flowShape:'input',children:[]},
  {id:'measure',text:'Analyze',children:[]},
  {id:'report',text:'Export report',flowShape:'output',children:[]},
  {id:'spare',text:'Unconnected sibling',children:[]}
 ]};
 const canonical=JSON.stringify(root);
 const rels=[{id:'r1',fromId:'capture',toId:'measure',kind:'sequence'},
   {id:'r2',fromId:'measure',toId:'report',kind:'sequence'}];
 const g=flow.project(root,rels),lookup=id=>g.nodes.find(n=>n.id===id);
 assert.equal(g.nodes.length,3,'unrelated sibling is not inferred');
 const input=lookup('capture'),output=lookup('report'),normal=lookup('measure');
 assert.equal(input.shape,'input');
 assert.equal(output.shape,'output');
 assert.equal(input.io,true);
 assert.equal(output.io,true);
 assert.equal(input.decision,false);
 assert.equal(output.terminal,false);
 assert.equal(normal.io,false);
 assert.deepEqual([input.w,input.h],[200,82]);
 assert.deepEqual(flow.ioPoints(input),[
  [input.x-input.w/2+input.w*.12,input.y-input.h/2],
  [input.x+input.w/2,input.y-input.h/2],
  [input.x+input.w/2-input.w*.12,input.y+input.h/2],
  [input.x-input.w/2,input.y+input.h/2]]);
 const from=flow.ports(input,normal,'sequence');
 const to=flow.ports(normal,output,'sequence');
 assert.equal(from.sx,input.x+input.w/2-input.w*.06);
 assert.equal(to.ex,output.x-output.w/2+output.w*.06);
 assert.ok(flow.path(input,normal).startsWith('M'));
 assert.ok(flow.path(normal,output).startsWith('M'));
 assert.equal(JSON.stringify(root),canonical,'no canonical map writes');
 assert.equal(JSON.stringify(rels),JSON.stringify([
  {id:'r1',fromId:'capture',toId:'measure',kind:'sequence'},
  {id:'r2',fromId:'measure',toId:'report',kind:'sequence'}]));
});

test('manual Input or Output is visible without transitions and never inferred from text',()=>{
 const root={id:'root',text:'Root',children:[
  {id:'marked',text:'Input',flowShape:'input',children:[]},
  {id:'out',text:'Output',flowShape:'output',children:[]},
  {id:'keyword',text:'Input',children:[]},
  {id:'invalid',text:'A',flowShape:'__proto__',children:[]}
 ]};
 const g=flow.project(root,[]);
 assert.deepEqual(g.nodes.map(node=>node.id),['marked','out']);
 assert.deepEqual(g.nodes.map(node=>node.shape),['input','output']);
 assert.equal(g.edges.length,0);
 assert.equal(flow.isIOShape('input'),true);
 assert.equal(flow.isIOShape('output'),true);
 assert.equal(flow.isIOShape('start'),false);
 assert.equal(flow.shape('INPUT'),'auto');
 assert.equal(flow.shape('__proto__'),'auto');
});

test('large explicit workflow tiers wrap into readable columns without dropping transitions',()=>{
 const root={id:'root',text:'Study',children:[{id:'begin',text:'Begin',flowShape:'start',children:[]}]};
 const transitions=[];
 for(let i=0;i<100;i++){
  const id='task-'+i;
  root.children.push({id,text:'Task '+i,children:[]});
  transitions.push(edge('begin',id,'sequence','link-'+i));
 }
 const canonical=JSON.stringify({root,transitions});
 const graph=flow.project(root,transitions);
 assert.equal(graph.nodes.length,101);
 assert.equal(graph.edges.length,100);
 assert.equal(graph.hasCycles,false);
 assert.ok(graph.height<5000,'a wide task tier must not require 18,000px vertical scrolling');
 const tasks=graph.nodes.filter(n=>n.id.startsWith('task-'));
 assert.ok(new Set(tasks.map(n=>n.x)).size>1,'a dense tier must use multiple readable columns');
 assert.ok(tasks.every(n=>n.depth===1),'visual wrapping must preserve logical process depth');
 const ids=new Set(graph.nodes.map(n=>n.id));
 assert.ok(graph.edges.every(e=>ids.has(e.fromId)&&ids.has(e.toId)));
 for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
  const a=graph.nodes[i],b=graph.nodes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
    Math.abs(a.y-b.y)>=(a.h+b.h)/2,'cards collide: '+a.id+' '+b.id);
 }
 assert.deepEqual(flow.project(root,transitions),graph,'stable presentation coordinates');
 assert.equal(JSON.stringify({root,transitions}),canonical,'saved input remains unchanged');
});

test('five hundred manually defined workflow cards stay bounded with no invented arrows',()=>{
 const root={id:'root',text:'Process inventory',children:[]};
 for(let i=0;i<500;i++)root.children.push({
  id:'step-'+i,text:'Explicit process '+i,flowShape:'process',children:[]
 });
 const saved=JSON.stringify(root);
 const graph=flow.project(root,[],{maxCandidates:1200});
 assert.equal(graph.nodes.length,500);
 assert.equal(graph.edges.length,0,'no semantic transitions inferred from sibling order');
 assert.ok(graph.height<5000,'500 independent steps must not render as a 92,000px list');
 assert.ok(graph.width<15000,'wrapping must not create an absurdly wide canvas');
 assert.ok(graph.nodes.every(n=>n.w>=190&&n.h>=76),'never shrink node text/card size to fit');
 assert.ok(graph.nodes.every(n=>n.depth===0),'logical process depth remains truthful');
 assert.deepEqual(flow.project(root,[],{maxCandidates:1200}),graph);
 assert.equal(JSON.stringify(root),saved);
});

test('long links to wrapped stages travel above intermediate cards instead of through them',()=>{
 const root={id:'root',text:'Plan',children:[{id:'start',text:'Start',flowShape:'start',children:[]}]};
 const links=[];
 for(let i=0;i<100;i++){
  const id='stage-'+i;
  root.children.push({id,text:'Activity '+i,children:[]});
  links.push(edge('start',id,'sequence','e'+i));
 }
 const graph=flow.project(root,links);
 const by=new Map(graph.nodes.map(n=>[n.id,n]));
 const near=flow.path(by.get('start'),by.get('stage-0'));
 const far=flow.path(by.get('start'),by.get('stage-99'));
 assert.ok(near.includes(' C'),'adjacent stages retain their original curved connector');
 assert.ok(far.includes(' H')&&far.includes(' V'),
  'connector jumping across wrapped columns must use an obstacle-free rail');
 const rail=far.match(/ V(-?[0-9.]+) H/);
 assert.ok(rail,'the long connector needs a horizontal clear route');
 const top=Math.min(...graph.nodes.map(n=>n.y-n.h/2));
 assert.ok(Number(rail[1])<top,'the shared rail must stay above every process card');
 assert.equal(graph.edges.length,100);
});

test('wrapped dense Yes/No tier preserves source order, semantic depth and non-overlapping cards',()=>{
 const root={id:'root',text:'Branching process',children:[
  {id:'decision',text:'Ready?',flowShape:'decision',children:[]}
 ]};
 const transitions=[];
 for(let i=0;i<40;i++){
  const id='target-'+i,kind=i===24?'no':i===25?'yes':'sequence';
  root.children.push({id,text:'Option '+i,children:[]});
  transitions.push(edge('decision',id,kind,'fork-'+i));
 }
 const before=JSON.stringify({root,transitions});
 const graph=flow.project(root,transitions,{maxCandidates:1200});
 const yes=graph.nodes.find(n=>n.id==='target-25'),no=graph.nodes.find(n=>n.id==='target-24');
 assert.ok(yes.y<no.y,'Yes remains above No even across the column boundary');
 assert.equal(yes.depth,1);assert.equal(no.depth,1);
 assert.equal(graph.edges.length,40);
 for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
  const a=graph.nodes[i],b=graph.nodes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
    Math.abs(a.y-b.y)>=(a.h+b.h)/2,'cards collide: '+a.id+' '+b.id);
 }
 assert.equal(JSON.stringify({root,transitions}),before);
});

test('process-only dense tiers use compact gutters without exceeding 8192px',()=>{
 const root={id:'root',children:[]};
 for(let i=0;i<500;i++)root.children.push({
  id:'process-'+i,text:'Process '+i,flowShape:'process',children:[]
 });
 const source=JSON.stringify(root);
 const graph=flow.project(root,[],{maxCandidates:1200});
 assert.equal(graph.nodes.length,500);
 assert.ok(graph.width<=8192,'the 500-card 1x scene should avoid the 8192px raster-side ceiling');
 assert.ok(graph.height<2600,'unused vertical gaps should be reduced for short cards');
 assert.ok(graph.nodes.every(n=>n.w===190&&n.h===76));
 assert.equal(JSON.stringify(root),source);
});

test('adaptive tiers with decisions retain enough row clearance for tall diamond cards',()=>{
 const root={id:'root',children:[]};
 for(let i=0;i<65;i++)root.children.push({
  id:'branch-'+i,text:'Branch '+i,flowShape:i%7===0?'decision':'process',children:[]
 });
 const graph=flow.project(root,[],{maxCandidates:1200});
 assert.equal(graph.nodes.length,65);
 for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
  const a=graph.nodes[i],b=graph.nodes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
    Math.abs(a.y-b.y)>=(a.h+b.h)/2,'diamond card collision '+a.id+' '+b.id);
 }
});
