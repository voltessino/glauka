const {test}=require('node:test');
const assert=require('node:assert/strict');
const network=require('../concept-network');
const view=require('../view-core');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const sample=()=>({id:'root',text:'Topic',children:[
 {id:'a',text:'Cause',children:[{id:'c',text:'Detail',children:[]}]},
 {id:'b',text:'Effect',children:[]}
]});
test('free network preserves all source nodes and draws parent and semantic relationships',()=>{
 const root=sample(),before=JSON.stringify(root);
 const relations=[{id:'r1',fromId:'a',toId:'b',label:'causes'},{id:'r2',fromId:'b',toId:'c',kind:'yes',label:'confirmed'}];
 const graph=network.project(root,relations);
 assert.deepEqual(graph.nodes.map(n=>n.id),['root','a','b','c']);
 assert.equal(graph.edges.filter(e=>e.type==='hierarchy').length,3);
 assert.deepEqual(graph.edges.filter(e=>e.type==='relation').map(e=>e.label),['causes','confirmed']);
 assert.equal(graph.nodes.some(n=>n.manual),false);
 assert.equal(JSON.stringify(root),before);
 assert.equal(view.mode('concept-network'),'concept-network');
 assert.throws(()=>view.project(root,'concept-network'),/dedicated semantic projector/);
});
test('saved manual positions override deterministic defaults without mutating the original tree',()=>{
 const root=sample();
 root.children[0].networkPosition={x:880,y:470};
 const before=JSON.stringify(root);
 const first=network.project(root,[]),again=network.project(root,[]);
 assert.deepEqual(first,again);
 assert.deepEqual({x:first.nodes[1].x,y:first.nodes[1].y}, {x:880,y:470});
 assert.equal(first.nodes[1].manual,true);
 assert.ok(first.width>880&&first.height>470);
 assert.equal(network.path(first.nodes[0],first.nodes[1]).startsWith('M'),true);
 assert.ok(network.labelPoint(first.nodes[0],first.nodes[1]).x>0);
 assert.equal(JSON.stringify(root),before,'the projection must not mutate manually placed nodes');
});
test('invalid positions fall back, dangling references and duplicate IDs are ignored',()=>{
 const root=sample();
 root.children[0].networkPosition={x:Infinity,y:100};
 root.children[1].networkPosition={x:20,y:30};
 const g=network.project(root,[
  {id:'r1',fromId:'a',toId:'ghost',label:'bad'},
  {id:'r2',fromId:'a',toId:'a',label:'bad'},
  {id:'r3',fromId:'a',toId:'b',label:'valid'},
  {id:'r3',fromId:'a',toId:'b',label:'duplicate'}
 ]);
 assert.equal(g.nodes.some(n=>n.manual),false);
 assert.equal(g.edges.filter(e=>e.type==='relation').length,1);
 assert.equal(network.position({x:115.3,y:65.7}).x,115);
 assert.equal(network.position({x:115.3,y:65.7}).y,66);
 assert.equal(network.position({x:20001,y:75}),null);
});
test('cycles, repeated identifiers and safety limits are rejected',()=>{
 const cycle={id:'cycle',children:[]};cycle.children.push(cycle);
 assert.throws(()=>network.project(cycle),/Invalid concept graph/);
 assert.throws(()=>network.project({id:'one',children:[{id:'one',children:[]}]}),/Invalid concept graph/);
 assert.throws(()=>network.project(sample(),[],{maxNodes:2}),/safe display limit/);
});
test('concept node and relationship content remains plain strings for safe DOM rendering',()=>{
 const root=sample();root.children[0].text='<img src=x onerror=alert(1)>';
 const edges=[{id:'x',fromId:'root',toId:'a',label:'<script>alert(1)</script>'}];
 const original=JSON.stringify([root,edges]);
 const g=network.project(root,edges);
 assert.equal(g.nodes[1].text,root.children[0].text);
 assert.equal(g.edges.find(e=>e.id==='x').label,edges[0].label);
 assert.equal(JSON.stringify([root,edges]),original);
});

test('cluster bands group siblings without inventing relationships or touching source data',()=>{
 const root={id:'root',text:'Knowledge',children:[
  {id:'anatomy',text:'Anatomy',children:[{id:'bones',text:'Bones',children:[]},{id:'organs',text:'Organs',children:[]}]},
  {id:'math',text:'Mathematics',children:[{id:'algebra',text:'Algebra',children:[]}]}
 ]};
 const before=JSON.stringify(root);
 const a=network.project(root),b=network.project(root);
 assert.deepEqual(a,b,'layout is deterministic for identical canonical data');
 const find=id=>a.nodes.find(n=>n.id===id);
 assert.equal(find('anatomy').clusterId,'anatomy');
 assert.equal(find('organs').clusterIndex,find('bones').clusterIndex);
 assert.notEqual(find('math').clusterIndex,find('anatomy').clusterIndex);
 assert.ok(find('math').y>find('anatomy').y,'top-level groups occupy separate vertical bands');
 assert.equal(a.edges.filter(e=>e.type==='relation').length,0,'layout does not manufacture semantic relationships');
 assert.equal(JSON.stringify(root),before);
});

test('automatic nodes avoid manual node rectangles while manual positions remain exact',()=>{
 const root=sample();root.children[0].networkPosition={x:692,y:110};
 const before=JSON.stringify(root),a=network.project(root),manual=a.nodes.find(n=>n.id==='a');
 assert.deepEqual([manual.x,manual.y],[692,110]);
 assert.equal(manual.manual,true);
 for(const card of a.nodes.filter(n=>!n.manual)){
  const collide=Math.abs(card.x-manual.x)<(card.w+manual.w)/2+18&&
    Math.abs(card.y-manual.y)<(card.h+manual.h)/2+22;
  assert.equal(collide,false,'auto card '+card.id+' overlaps manually placed node');
 }
 assert.equal(JSON.stringify(root),before);
});

test('large cluster projection keeps finite positions and bounded unique cards',()=>{
 const root={id:'root',text:'Big map',children:[]};
 for(let i=0;i<100;i++)root.children.push({id:'group-'+i,text:'Topic '+i,children:[
  {id:'detail-'+i,text:'Detail '+i,children:[]}]});
 const result=network.project(root);
 assert.equal(result.nodes.length,201);
 assert.equal(new Set(result.nodes.map(n=>n.id)).size,201);
 assert.ok(result.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=115&&n.y>=65));
 assert.equal(result.width>0&&result.height>0,true);
});

test('long relationship labels are visually bounded but keep their full semantic value',()=>{
 const full='This relationship is longer than a readable on-canvas label';
 const shown=network.displayLabel(full);
 assert.ok(shown.endsWith('…'));
 assert.ok(shown.length<=22);
 assert.equal(network.displayLabel('causes'),'causes');
 const g=network.project(sample(),[{id:'relation-x',fromId:'a',toId:'b',label:full}]);
 assert.equal(g.edges.find(e=>e.id==='relation-x').label,full);
 const first=g.nodes[1],second=g.nodes[2],point=network.labelPoint(first,second);
 assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
});

test('network density changes automatic spacing but never shifts manually pinned nodes',()=>{
 const root=sample();root.children[0].networkPosition={x:692,y:240};
 const original=JSON.stringify(root);
 const normal=network.project(root,[],{density:1});
 const compact=network.project(root,[],{density:.85});
 const spacious=network.project(root,[],{density:1.4});
 for(const layout of [normal,compact,spacious]){
  const pinned=layout.nodes.find(n=>n.id==='a');
  assert.equal(pinned.x,692);
  assert.equal(pinned.y,240);
  assert.equal(pinned.manual,true);
 }
 assert.ok(spacious.nodes.find(n=>n.id==='b').y>=compact.nodes.find(n=>n.id==='b').y);
 assert.equal(JSON.stringify(root),original);
});

test('a thousand grouped concepts fit a bounded grid rather than a giant vertical strip',()=>{
 const root={id:'root',text:'Learning topics',children:[]};
 for(let i=0;i<100;i++){
  const node={id:'group-'+i,text:'Group '+i,children:[]};
  for(let j=0;j<9;j++)node.children.push({id:'detail-'+i+'-'+j,text:'Detail',children:[]});
  root.children.push(node);
 }
 const original=JSON.stringify(root),a=network.project(root,[],{density:1.4});
 assert.equal(a.nodes.length,1001);
 assert.ok(a.width>2500,'many clusters should occupy several horizontal lanes');
 assert.ok(a.height<30000,'the view must avoid the previous 160k-pixel vertical strip');
 assert.deepEqual(network.project(root,[],{density:1.4}),a);
 assert.equal(JSON.stringify(root),original);
});

test('relation labels use deterministic non-overlapping placements without mutating geometry',()=>{
 const root=sample(),edges=[
  {id:'rel-a',fromId:'a',toId:'b',label:'depends on'},
  {id:'rel-b',fromId:'a',toId:'c',label:'supports evidence'},
  {id:'rel-c',fromId:'b',toId:'c',label:'explains detail'}
 ];
 const graph=network.project(root,edges),before=JSON.stringify(graph);
 const first=network.placeLabels(graph),second=network.placeLabels(graph);
 assert.deepEqual([...first],[...second]);
 const visible=[...first.values()].filter(p=>!p.hidden);
 for(const label of visible){
  assert.ok(Number.isFinite(label.x)&&Number.isFinite(label.y));
  for(const card of graph.nodes){
   assert.ok(Math.abs(label.x-card.x)>=(label.w+card.w)/2+8||
     Math.abs(label.y-card.y)>=(label.h+card.h)/2+8,'label must not obscure '+card.id);
  }
 }
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
  const a=visible[i],b=visible[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2+8||
    Math.abs(a.y-b.y)>=(a.h+b.h)/2+8,'semantic labels must not overlap');
 }
 assert.equal(JSON.stringify(graph),before);
});

test('crowded relation labels can be hidden without losing canonical text or links',()=>{
 const graph={width:800,height:420,nodes:[
  {id:'source',x:180,y:210,w:184,h:68},
  {id:'target',x:600,y:210,w:184,h:68},
  {id:'obstacle',x:400,y:210,w:700,h:370}
 ],edges:[{id:'relationship',fromId:'source',toId:'target',type:'relation',label:'test obstruction'}]};
 const placement=network.placeLabels(graph).get('relationship');
 assert.ok(placement);
 assert.equal(placement.hidden,true);
 assert.equal(graph.edges[0].label,'test obstruction');
 assert.equal(network.placeLabels(graph,{maxLabels:0}).size,0);
});

test('spatial collision queries preserve first-obstacle placement of the linear oracle',()=>{
 for(const density of [.85,1,1.4]){
  const root={id:'root',text:'Root',children:[]};
  for(let i=1;i<=150;i++){const node={id:'n'+i,text:'Node '+i,children:[]};if(i<=8)root.children.push(node);else root.children[(i-9)%8].children.push(node)}
  const initial=network.project(root,[],{density}),base=new Map(initial.nodes.map(n=>[n.id,n]));
  const pending=[root],manual=[];
  while(pending.length){const n=pending.pop();if(Number(n.id.slice(1))%9===0){n.networkPosition={x:436+(Number(n.id.slice(1))%4)*256,y:110+(Number(n.id.slice(1))%7)*120};manual.push({id:n.id,...n.networkPosition,w:184,h:68})}pending.push(...n.children)}
  // Native traversal is preorder; manual obstacles precede all automatic cards.
  const order=[],stack=[root];while(stack.length){const n=stack.pop();order.push(n.id);for(let i=n.children.length-1;i>=0;i--)stack.push(n.children[i])}
  const occupied=manual.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)),result=network.project(root,[],{density});
  for(const node of result.nodes){
   if(node.manual)continue;
   const first=base.get(node.id);let y=first.y;
   for(let attempt=0;attempt<=occupied.length;attempt++){
    const hit=occupied.find(n=>Math.abs(first.x-n.x)<202&&Math.abs(y-n.y)<90);
    if(!hit)break;y=Math.ceil(hit.y+90);
   }
   assert.equal(node.x,first.x);assert.equal(node.y,y);occupied.push({x:node.x,y,w:184,h:68});
  }
 }
});


test('Unicode network labels never cut a grapheme cluster and reserve width for wide glyphs',()=>{
 const emoji='👩🏽‍🔬',accents='e\u0301',cjk='漢字';
 const longEmoji=emoji.repeat(40),longAccents=accents.repeat(40),longCjk=cjk.repeat(30);
 // Emoji ZWJ sequences and combining accents are *single* graphemes.
 for(const [original,unit] of [[longEmoji,emoji],[longAccents,accents]]){
  const shown=network.displayLabel(original);
  assert.ok(shown.endsWith('…'), 'long label must truncate');
  const retained=shown.slice(0,-1);
  assert.equal(retained.replaceAll(unit,''),'','never show half a grapheme');
  assert.equal(shown.includes('\ufffd'),false);
  assert.ok(network.displayLabel(original).length<original.length);
 }
 // CJK ideographs are distinct graphemes: truncating after 漢 is valid even
 // when the source repeats the two-character word 漢字.
 const shownCjk=network.displayLabel(longCjk);
 assert.ok(shownCjk.endsWith('…'));
 assert.ok(Array.from(shownCjk).length<22,'wide ideographs need fewer glyphs per plate');
 assert.equal(shownCjk.includes('\ufffd'),false);
 const latin=network.displayLabel('constrains the next scientific experiment');
 assert.ok(latin.length<=22);
 assert.equal(network.displayLabel('teaches'),'teaches');
 const manual={width:1000,height:900,nodes:[
  {id:'one',x:140,y:250,w:184,h:68},
  {id:'two',x:830,y:250,w:184,h:68}
 ],edges:[{id:'wide',fromId:'one',toId:'two',type:'relation',label:longCjk}]};
 const untouched=JSON.stringify(manual);
 const first=network.placeLabels(manual).get('wide'),second=network.placeLabels(manual).get('wide');
 assert.deepEqual(first,second);
 assert.equal(first.text,network.displayLabel(longCjk));
 assert.ok(first.w<=185&&first.w>=44);
 assert.equal(first.hidden,false);
 assert.equal(JSON.stringify(manual),untouched);
});


test('older WebViews without Intl.Segmenter keep whole emoji flags and combining graphemes',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','concept-network.js'),'utf8');
 const sandbox={module:{exports:{}},Intl:{}};
 vm.runInNewContext(source,sandbox,{filename:'concept-network.js'});
 const fallback=sandbox.module.exports;
 for(const unit of ['👩🏽‍🔬','e\u0301','🇮🇹','1️⃣']){
  const original=unit.repeat(40);
  const shown=fallback.displayLabel(original);
  assert.equal(shown,network.displayLabel(original));
  assert.equal(shown.slice(0,-1).replaceAll(unit,''),'');
  assert.ok(shown.endsWith('…'));
 }
});

test("arrangeRelated keeps manual positions immutable and is deterministic",()=>{
 const root=sample();
 root.children[0].networkPosition={x:900,y:420};
 const before=JSON.stringify(root);
 const graph=network.project(root,[{id:"r1",fromId:"a",toId:"b",label:"causes"}]);
 const first=network.arrangeRelated(graph,"a",{maxNodes:36,gap:24});
 const second=network.arrangeRelated(graph,"a",{maxNodes:36,gap:24});
 assert.equal(first.changed,true);
 assert.deepEqual(first.moved,second.moved);
 const manual=first.nodes.get("a");
 assert.equal(manual.x,900);assert.equal(manual.y,420);
 const moved=first.nodes.get("b");
 assert.ok(Number.isFinite(moved.x)&&Number.isFinite(moved.y));
 assert.equal(JSON.stringify(root),before);
 assert.equal(graph.nodes.find(n=>n.id==="a").x,900);
});
test("arrangeRelated does nothing when every neighbor is manual",()=>{
 const root={id:"root",text:"Topic",networkPosition:{x:400,y:200},children:[
  {id:"a",text:"Cause",networkPosition:{x:700,y:300},children:[]},
  {id:"b",text:"Effect",networkPosition:{x:980,y:360},children:[]}
 ]};
 const graph=network.project(root,[{id:"r1",fromId:"a",toId:"b",label:"link"}]);
 const result=network.arrangeRelated(graph,"a");
 assert.equal(result.changed,false);
 assert.deepEqual(result.moved,[]);
});
