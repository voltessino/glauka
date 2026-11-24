const {test}=require('node:test');
const assert=require('node:assert/strict');
const nav=require('../navigation-core');
const tree=()=>({id:'r',text:'Knowledge',children:[
  {id:'l',text:'Left',color:'#6366f1',children:[{id:'deep',text:'Details',children:[]}]},
  {id:'right',text:'Right',color:'#ef4444',children:[{id:'small',text:'Notes',children:[]}]}
]});
test('overview retains top-level IDs, counts and original data',()=>{
  const root=tree(),before=JSON.stringify(root),result=nav.overview(root);
  assert.deepEqual(result.groups.map(g=>[g.id,g.count]),[['l',2],['right',2]]);
  assert.equal(result.total,5);
  assert.equal(JSON.stringify(root),before);
});
test('focus includes ancestors and active descendants, excluding unrelated siblings',()=>{
  const root=tree(),detail=nav.focusPath(root,'deep');
  assert.equal(detail.targetId,'deep');
  assert.equal(detail.ids.has('r'),true);
  assert.equal(detail.ids.has('l'),true);
  assert.equal(detail.ids.has('right'),false);
  assert.equal(nav.focusPath(root,'absent'),null);
  assert.equal(nav.focusPath(root,'l').ids.has('deep'),true);
});
test('semantic zoom thresholds are stable and optional',()=>{
  assert.equal(nav.semanticTier(.1),0);
  assert.equal(nav.semanticTier(.35),1);
  assert.equal(nav.semanticTier(.7),2);
  assert.equal(nav.semanticTier(.1,false),2);
  assert.equal(nav.semanticTier(Number.NaN),2);
});
test('minimap projects nodes and viewport without changing source positions',()=>{
  const entries=[
    {id:'r',x:0,y:0,width:100,height:36,color:'#fff'},
    {id:'l',parentId:'r',x:-200,y:90,width:80,height:24},
    {id:'right',parentId:'r',x:300,y:60,width:100,height:26}
  ];
  const original=JSON.stringify(entries),camera={x:450,y:280,zoom:1};
  const p=nav.minimap(entries,camera,{width:900,height:560},{width:190,height:120});
  assert.equal(p.nodes.length,3);
  assert.equal(p.edges.length,2);
  assert.ok(p.nodes.every(x=>x.x>=0&&x.x<=190&&x.y>=0&&x.y<=120));
  const spot=nav.minimapToWorld(p,p.nodes[0].x,p.nodes[0].y);
  assert.ok(Math.abs(spot.x)<1e-9&&Math.abs(spot.y)<1e-9);
  assert.equal(JSON.stringify(entries),original);
  assert.deepEqual(camera,{x:450,y:280,zoom:1});
  assert.equal(nav.minimapToWorld(p,-5,10),null);
});
test('collapsed groups and cycles do not crash navigation or produce infinite loops',()=>{
  const root=tree();root.children[0].collapsed=true;
  assert.equal(nav.scan(root,{visibleOnly:true}).length,4);
  root.children[0].children.push(root);
  assert.equal(nav.scan(root).length,5);
  assert.throws(()=>nav.scan(root,{limit:2}),/limit/i);
});

test('exact ID wins over earlier matching logical alias',()=>{
 const root={id:'r',children:[{id:'alias',logicalId:'target',children:[]},{id:'target',children:[]}]};
 assert.equal(nav.focusPath(root,'target').targetId,'target');
});

test('logical alias remains focusable when no exact visual ID exists',()=>{
 const root={id:'r',children:[{id:'alias',logicalId:'target',children:[]}]};
 assert.equal(nav.focusPath(root,'target').targetId,'alias');
});

test('minimap preserves relative node dimensions and anchors connections at topic edges',()=>{
 const points=[{id:'root',x:0,y:0,width:120,height:36,depth:0},
  {id:'left',parentId:'root',x:-300,y:-80,width:100,height:28,depth:1},
  {id:'right',parentId:'root',x:300,y:80,width:100,height:28,depth:1}];
 const result=nav.minimap(points,{x:250,y:200,zoom:1},{width:1200,height:900},{width:310,height:205});
 assert.equal(result.width,310);assert.equal(result.height,205);
 assert.ok(result.nodes.every(n=>n.w>0&&n.h>0));
 const root=result.nodes[0],right=result.nodes[2],edge=result.edges[1];
 assert.ok(edge.x1>root.x&&edge.x1<right.x);
 assert.ok(edge.x2<right.x&&edge.x2>root.x);
 assert.equal(edge.depth,1);
 for(const [x,y] of [[0,0],[154,89],[309,204]]){
  const spot=nav.minimapToWorld(result,x,y);
  assert.ok(Number.isFinite(spot.x)&&Number.isFinite(spot.y));
 }
});
test('radar viewport never becomes negative when camera is beyond map boundaries',()=>{
 const nodes=[{id:'root',x:0,y:0,width:70,height:30}];
 for(const camera of [{x:-1e6,y:-1e6,zoom:1},{x:1e6,y:1e6,zoom:1},
  {x:-300,y:400,zoom:.08}]){
  const x=nav.minimap(nodes,camera,{width:1280,height:900},{width:190,height:122});
  assert.ok(x.viewport.width>=0&&x.viewport.height>=0);
  assert.ok(x.viewport.x+x.viewport.width<=190+1e-8);
  assert.ok(x.viewport.y+x.viewport.height<=122+1e-8);
 }
});

test('layout points preserve visual copies on both sides without changing the logical tree',()=>{
 const tree={id:'root',text:'Root',children:[{id:'branch',text:'Shared branch',children:[]}]};
 const visual={id:'vr',logicalId:'root',children:[{id:'right',logicalId:'branch',children:[]},{id:'vr2',logicalId:'root',isFloating:true,children:[{id:'left',logicalId:'branch',children:[]}]}]};
 const before=JSON.stringify(tree),positions=new Map([['vr',{x:0,y:0}],['right',{x:100,y:20}],['vr2',{x:-150,y:0}],['left',{x:-250,y:20}]]);
 const points=nav.layoutPoints(tree,{presentationRoot:visual,nodeLayoutMap:positions});
 assert.deepEqual(points.filter(p=>p.logicalId==='branch').map(p=>p.x),[100,-250]);
 assert.equal(points.find(p=>p.id==='vr2').parentId,null);
 assert.equal(points.find(p=>p.id==='left').depth,1);
 assert.equal(JSON.stringify(tree),before);
});

test('radar remains finite with malformed node dimensions',()=>{
 const points=[
  {id:'root',x:0,y:0,width:Infinity,height:Infinity},
  {id:'child',parentId:'root',x:240,y:100,width:-Infinity,height:1e300}
 ];
 const before=JSON.stringify(points),camera={x:40,y:20,zoom:.45};
 const result=nav.minimap(points,camera,{width:1200,height:800},{width:310,height:205});
 assert.equal(result.nodes.length,2);
 assert.equal(result.edges.length,1);
 assert.ok(Number.isFinite(result.world.scale)&&result.world.scale>0);
 assert.ok(result.nodes.every(n=>[n.x,n.y,n.w,n.h,n.r].every(Number.isFinite)));
 assert.ok(Object.values(result.viewport).every(Number.isFinite));
 assert.equal(JSON.stringify(points),before);
});

test('Radar guards invalid camera and widget geometry while preserving valid nodes',()=>{
 const ordinary={id:'valid',x:200,y:250,width:100,height:50};
 const invalid={id:'invalid',x:1e308,y:-1e308,width:10,height:10};
 const before=JSON.stringify([ordinary,invalid]);
 const result=nav.minimap([ordinary,invalid],{x:Infinity,y:NaN,zoom:Infinity},
   {width:1200,height:800},{width:NaN,height:Infinity,padding:NaN});
 assert.equal(result.nodes.length,1);
 assert.equal(result.nodes[0].id,'valid');
 assert.equal(result.width,190);
 assert.equal(result.height,122);
 assert.ok(Number.isFinite(result.world.scale)&&result.world.scale>0);
 assert.ok(result.nodes.every(n=>[n.x,n.y,n.w,n.h,n.r].every(Number.isFinite)));
 assert.ok(result.viewport&&Object.values(result.viewport).every(Number.isFinite));
 assert.equal(JSON.stringify([ordinary,invalid]),before);
 const extremes=nav.minimap([{id:'a',x:1e308,y:1e308},{id:'b',x:-1e308,y:-1e308}],
   {x:0,y:0,zoom:1},{width:1200,height:800});
 assert.deepEqual(extremes.nodes,[]);
 assert.equal(extremes.viewport,null);
});
