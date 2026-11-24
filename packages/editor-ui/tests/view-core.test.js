const {test}=require('node:test');
const assert=require('node:assert/strict');
const views=require('../view-core');
function sample(){return {id:'root',text:'Company',children:[
{id:'eng',text:'Engineering',children:[{id:'backend',text:'Backend',children:[]},{id:'frontend',text:'Frontend',children:[]}]},
{id:'sales',text:'Sales',children:[{id:'regional',text:'Regional team',children:[]}]}]};}
test('view modes are explicit and old documents default to mind map',()=>{
 assert.equal(views.mode(undefined),'mindmap');
 assert.equal(views.mode('orgchart'),'orgchart');
 assert.equal(views.mode('concept-tree'),'concept-tree');
 assert.equal(views.mode('flowchart'),'flowchart');
 assert.throws(()=>views.project({id:'x',children:[]},'flowchart'),/dedicated semantic projector/);
});
test('linked projections keep stable IDs and exact original data',()=>{
 const root=sample(),copy=JSON.stringify(root);
 for(const type of ['orgchart','concept-tree']){
  const view=views.project(root,type);
  assert.deepEqual(view.nodes.map(n=>n.id),['root','eng','backend','frontend','sales','regional']);
  assert.deepEqual(view.edges.map(e=>[e.fromId,e.toId]),[['root','eng'],['eng','backend'],['eng','frontend'],['root','sales'],['sales','regional']]);
  assert.equal(new Set(view.nodes.map(n=>n.id)).size,view.nodes.length);
  assert.ok(view.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x-n.w/2>=0&&n.y-n.h/2>=0));
  assert.ok(view.width>0&&view.height>0);
  assert.ok(view.edges.every(e=>views.path(view.nodes.find(n=>n.id===e.fromId),view.nodes.find(n=>n.id===e.toId),type).startsWith('M')));
 }
 assert.equal(JSON.stringify(root),copy,'layout must not write coordinates into source tree');
});
test('organization uses top-down hierarchy and conceptual tree goes left-to-right',()=>{
 const a=views.project(sample(),'orgchart').nodes,b=views.project(sample(),'concept-tree').nodes;
 const pick=(arr,id)=>arr.find(n=>n.id===id);
 assert.ok(pick(a,'root').y<pick(a,'eng').y&&pick(a,'eng').y<pick(a,'backend').y);
 assert.ok(pick(b,'root').x<pick(b,'eng').x&&pick(b,'eng').x<pick(b,'backend').x);
 assert.ok(pick(a,'backend').x<pick(a,'frontend').x&&pick(a,'frontend').x<pick(a,'regional').x);
 assert.ok(pick(b,'backend').y<pick(b,'frontend').y&&pick(b,'frontend').y<pick(b,'regional').y);
});
test('collapsed branches remain in view without deleting descendants',()=>{
 const r=sample();r.children[0].collapsed=true;
 const p=views.project(r,'orgchart');
 assert.deepEqual(p.nodes.map(n=>n.id),['root','eng','sales','regional']);
 assert.equal(p.nodes.find(n=>n.id==='eng').hiddenChildren,2);
 assert.equal(r.children[0].children.length,2);
});
test('duplicate IDs, graph cycles and oversize trees are rejected',()=>{
 assert.throws(()=>views.project({id:'a',children:[{id:'a',children:[]}]},'orgchart'),/Invalid tree/);
 const cyclic={id:'a',children:[]};cyclic.children.push(cyclic);
 assert.throws(()=>views.project(cyclic,'orgchart'),/Invalid tree/);
 assert.throws(()=>views.project(sample(),'orgchart',{maxNodes:3}),/too many/);
});
test('empty and deeply nested maps have finite positions',()=>{
 const empty=views.project({id:'one',text:'Only',children:[]},'orgchart');
 assert.equal(empty.nodes.length,1);assert.equal(empty.edges.length,0);
 let root={id:'0',text:'0',children:[]},n=root;
 for(let i=1;i<=250;i++){let child={id:String(i),text:String(i),children:[]};n.children.push(child);n=child}
 for(const kind of ['orgchart','concept-tree']){
  const p=views.project(root,kind);assert.equal(p.nodes.length,251);
  assert.ok(p.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
 }
});
test('invalid source never becomes executable HTML content',()=>{
 const r={id:'x',text:'<img src=x onerror=alert(1)>',color:'red',children:[]};
 const p=views.project(r,'concept-tree');
 assert.equal(p.nodes[0].text,r.text);
 assert.equal(r.text,'<img src=x onerror=alert(1)>');
});

test('concept-tree projects stable top-level group identities without modifying saved nodes',()=>{
 const root=sample(),before=JSON.stringify(root);
 const view=views.project(root,'concept-tree');
 const ids=new Map(view.nodes.map(n=>[n.id,n]));
 assert.equal(ids.get('root').groupIndex,-1);
 assert.equal(ids.get('eng').groupIndex,0);
 assert.equal(ids.get('backend').groupIndex,0);
 assert.equal(ids.get('frontend').groupId,'eng');
 assert.equal(ids.get('sales').groupIndex,1);
 assert.equal(ids.get('regional').groupId,'sales');
 assert.deepEqual(views.project(root,'concept-tree'),view);
 assert.equal(JSON.stringify(root),before);
});

test('organization chart supports deterministic left-to-right orientation without changing default vertical layout',()=>{
 const root=sample(),unchanged=JSON.stringify(root);
 const vertical=views.project(root,'orgchart');
 const horizontal=views.project(root,'orgchart',{orientation:'horizontal'});
 assert.equal(vertical.orientation,'vertical');
 assert.equal(horizontal.orientation,'horizontal');
 assert.equal(horizontal.nodes.length,vertical.nodes.length);
 const byId=id=>horizontal.nodes.find(n=>n.id===id);
 assert.ok(byId('eng').x>byId('root').x);
 assert.ok(byId('backend').x>byId('eng').x);
 assert.ok(byId('eng').y<byId('sales').y);
 assert.ok(horizontal.nodes.every(n=>n.x-n.w/2>=0&&n.y-n.h/2>=0));
 assert.ok(horizontal.edges.every(e=>views.path(byId(e.fromId),byId(e.toId),'orgchart').includes(' H')));
 assert.deepEqual(views.project(root,'orgchart',{orientation:'horizontal'}),horizontal);
 assert.deepEqual(views.project(root,'orgchart'),vertical);
 assert.equal(JSON.stringify(root),unchanged);
});


test('concept tree separates first-level subtrees with deterministic gutters, unlike unchanged orgchart',()=>{
 const root={id:'root',text:'Topic',children:[
  {id:'one',text:'One',children:[{id:'one-a',text:'A',children:[]},{id:'one-b',text:'B',children:[]}]},
  {id:'two',text:'Two',children:[{id:'two-a',text:'A',children:[]},{id:'two-b',text:'B',children:[]}]}
 ]};
 const canonical=JSON.stringify(root);
 const tree=views.project(root,'concept-tree'),org=views.project(root,'orgchart');
 const byId=(graph,id)=>graph.nodes.find(n=>n.id===id);
 const within=byId(tree,'one-b').y-byId(tree,'one-a').y;
 const between=byId(tree,'two-a').y-byId(tree,'one-b').y;
 assert.equal(within,88);
 assert.equal(between,120,'an extra 32px visually separates two canonical categories');
 assert.equal(byId(org,'two-a').x-byId(org,'one-b').x,206,
  'orgchart must keep its existing geometric spacing');
 assert.deepEqual(views.project(root,'concept-tree'),tree);
 assert.equal(JSON.stringify(root),canonical);
});
test('concept tree with 500 leaves separates groups and avoids rectangular card collisions',()=>{
 const root={id:'root',text:'Subjects',children:[]};
 for(let group=0;group<25;group++){
  const category={id:'group-'+group,text:'Category '+group,children:[]};
  for(let leaf=0;leaf<20;leaf++)
   category.children.push({id:'leaf-'+group+'-'+leaf,text:'Concept '+leaf,children:[]});
  root.children.push(category);
 }
 const canonical=JSON.stringify(root),layout=views.project(root,'concept-tree');
 assert.equal(layout.nodes.length,526);
 assert.equal(layout.edges.length,525);
 assert.deepEqual(views.project(root,'concept-tree'),layout);
 const byId=new Map(layout.nodes.map(n=>[n.id,n]));
 for(let group=1;group<25;group++){
  const previous=byId.get('leaf-'+(group-1)+'-19');
  const current=byId.get('leaf-'+group+'-0');
  assert.ok(
    (current.x===previous.x&&current.y-previous.y>=120)||
    (current.x>previous.x&&current.y<previous.y),
    'clusters '+group+' need a vertical gutter or a new left-to-right column'
  );
 }
 for(let i=0;i<layout.nodes.length;i++){
  const a=layout.nodes[i];
  assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y),'finite position');
  for(let j=i+1;j<layout.nodes.length;j++){
   const b=layout.nodes[j];
   assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
     Math.abs(a.y-b.y)>=(a.h+b.h)/2,'card overlap '+a.id+' '+b.id);
  }
 }
 assert.equal(JSON.stringify(root),canonical);
 root.children[0].collapsed=true;
 const collapsed=views.project(root,'concept-tree');
 assert.equal(collapsed.nodes.length,506);
 assert.equal(collapsed.nodes.find(n=>n.id==='group-0').hiddenChildren,20);
 assert.equal(root.children[0].children.length,20);
});

test('large flat organigram wraps direct reports without inventing managers',()=>{
 const root={id:'root',text:'Direzione',children:[]};
 for(let i=0;i<100;i++)root.children.push({id:'member-'+i,text:'Collaboratore '+i,children:[]});
 const before=JSON.stringify(root);
 for(const orientation of ['vertical','horizontal']){
  const layout=views.project(root,'orgchart',{orientation});
  const by=new Map(layout.nodes.map(n=>[n.id,n]));
  assert.equal(layout.nodes.length,101);
  assert.equal(layout.edges.length,100);
  assert.ok(layout.width<5000&&layout.height<5000,
   orientation+' needs a bounded, readable overview');
  assert.ok(layout.nodes.every(n=>n.w>=172&&n.h===72),
   'do not shrink cards to make layout fit');
  assert.ok(layout.nodes.slice(1).every(n=>n.parentId==='root'&&n.depth===1),
   'wrapping never inserts or infers a manager');
  for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
   const a=layout.nodes[i],b=layout.nodes[j];
   assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
     Math.abs(a.y-b.y)>=(a.h+b.h)/2,'org chart overlap: '+a.id+' '+b.id);
  }
  const distant=views.path(by.get('root'),by.get('member-99'),'orgchart');
  assert.ok(distant.includes(' H')&&distant.includes(' V'),
   'long links remain connected with structured SVG routing');
  assert.deepEqual(views.project(root,'orgchart',{orientation}),layout);
 }
 assert.equal(JSON.stringify(root),before,'saved structure must remain unmodified');
});

test('grouped 500-leaf conceptual tree wraps sections into bounded readable columns',()=>{
 const root={id:'root',text:'Anatomia',children:[]};
 for(let group=0;group<25;group++){
  const node={id:'section-'+group,text:'Sezione '+group,children:[]};
  for(let leaf=0;leaf<20;leaf++)node.children.push({
   id:'term-'+group+'-'+leaf,text:'Concetto '+leaf,children:[]
  });
  root.children.push(node);
 }
 const saved=JSON.stringify(root),layout=views.project(root,'concept-tree');
 const by=new Map(layout.nodes.map(n=>[n.id,n]));
 assert.equal(layout.nodes.length,526);
 assert.equal(layout.edges.length,525);
 assert.ok(layout.width<5000&&layout.height<8000,
  'a 500-leaf tree should not be a 44,000px vertical strip');
 assert.ok(layout.width*layout.height<=24e6,
  'a typical 500-leaf overview must fit the 24MP 1x raster envelope');
 for(let g=0;g<25;g++){
  const parent=by.get('section-'+g),first=by.get('term-'+g+'-0');
  assert.ok(first.x>parent.x&&parent.x>by.get('root').x,
   'category and term keep the left-to-right tree hierarchy');
  assert.equal(first.parentId,parent.id);
  const link=views.path(by.get('root'),parent,'concept-tree');
  assert.ok(link.startsWith('M')&&link.includes(' H'),'root link still visible');
 }
 for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
  const a=layout.nodes[i],b=layout.nodes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||
    Math.abs(a.y-b.y)>=(a.h+b.h)/2,'concept card overlap '+a.id+' '+b.id);
 }
 assert.deepEqual(views.project(root,'concept-tree'),layout);
 assert.equal(JSON.stringify(root),saved);
});

test('packed hierarchy connector rails stay clear of unrelated node cards',()=>{
 const flat={id:'root',text:'Director',children:Array.from({length:100},(_,i)=>({
  id:'worker-'+i,text:'Worker '+i,children:[]
 }))};
 const grouped={id:'root',text:'Subjects',children:Array.from({length:25},(_,g)=>({
  id:'category-'+g,text:'Category '+g,
  children:Array.from({length:20},(_,i)=>({
   id:'item-'+g+'-'+i,text:'Item '+i,children:[]
  }))
 }))};
 const scenarios=[
  [flat,'orgchart',{}],
  [flat,'orgchart',{orientation:'horizontal'}],
  [grouped,'concept-tree',{}]
 ];
 const segments=path=>{
  const result=[],parts=path.matchAll(/([MHV])\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g);
  let x=0,y=0;
  for(const match of parts){
   const cmd=match[1],value=Number(match[2]);
   if(cmd==='M'){x=value;y=Number(match[3]);continue}
   const nextX=cmd==='H'?value:x,nextY=cmd==='V'?value:y;
   result.push([x,y,nextX,nextY]);x=nextX;y=nextY;
  }
  return result;
 };
 const intersects=(line,n)=>{
  const [x1,y1,x2,y2]=line;
  const left=n.x-n.w/2+1,right=n.x+n.w/2-1;
  const top=n.y-n.h/2+1,bottom=n.y+n.h/2-1;
  if(x1===x2)return x1>left&&x1<right&&
    Math.max(y1,y2)>top&&Math.min(y1,y2)<bottom;
  return y1>top&&y1<bottom&&
    Math.max(x1,x2)>left&&Math.min(x1,x2)<right;
 };
 for(const [root,kind,options] of scenarios){
  const layout=views.project(root,kind,options),by=new Map(layout.nodes.map(n=>[n.id,n]));
  for(const edge of layout.edges){
   const from=by.get(edge.fromId),to=by.get(edge.toId);
   const route=views.path(from,to,kind);
   const parts=segments(route);
   assert.ok(parts.length>0,'edge should have a nonempty SVG route');
   for(const line of parts){
    assert.ok(line.every(Number.isFinite),'finite routing coordinates');
    for(const n of layout.nodes){
     if(n===from||n===to)continue;
     assert.equal(intersects(line,n),false,
      'edge '+from.id+' → '+to.id+' crosses unrelated card '+n.id);
    }
   }
  }
 }
});
