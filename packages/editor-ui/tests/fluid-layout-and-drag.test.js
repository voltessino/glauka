'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../../map-core/index.js');
const ctx={};const dragSource=require('./helpers/compose-drag-preview.cjs')();
vm.runInNewContext(dragSource,{globalThis:ctx});
const drag=ctx.NeuroMapDrag;
function fixture(){
 const root={id:'root',side:'root',layoutMode:'fluid',children:[]};
 const items=[['a','right',-80,220],['b','right',0,220],['c','left',80,-220]];
 for(const [id,side] of items)root.children.push({id,parentId:'root',side,children:[]});
 const positions=new Map([['root',[0,0]],...items.map(([id,,y,x])=>[id,[x,y]])]);
 const layout={camera:{zoom:1},presentationRoot:null,nodeLayoutMap:new Map(),viewNodes:new Map(),primaryGapX:150,
   getLayout(id){const p=positions.get(id);return p?{x:p[0],y:p[1],width:id==='root'?115:70,height:28}:null;}};
 const state={root,undoStack:[],selectedNodeId:null,selectedNodeIds:[],
   findNode(id){const stack=[this.root];while(stack.length){const n=stack.pop();if(n.id===id)return n;stack.push(...(n.children||[]));}return null;},
   pushHistory(){this.undoStack.push(JSON.stringify(this.root));},
   normalizeChildrenOrder(p){p.children.forEach((n,i)=>n.customOrder=i);}
 };
 const app={state,layout,
   renderer:{camera:{zoom:1},worldToScreen(x,y){return {x:x+400,y:y+300};},
     screenToWorld(x,y){return {x:x-400,y:y-300};}},
   findHit(){return null;}};
 return {app,state,root,positions};
}
function move(f,id,x,y,options){
 const intent=drag.resolve(f.app,id,x,y,options);
 if(intent?.kind==='keep')return {intent,result:false};
 const result=drag.apply(f.app,f.state,id,intent,f.app.renderer.screenToWorld(x,y),true);
 return {intent,result};
}
test('Fluid starts right, then fills left and respects manual pins',()=>{
 const sample=Array.from({length:6},(_,i)=>({id:'n'+i}));
 const split=core.splitFluid(sample,[50,50,50,50,50,50],10);
 assert.deepEqual(split.rightIds.slice(0,2),['n0','n1']);
 assert.equal(split.leftIds[0],'n2');
 assert.equal(split.rightCount+split.leftCount,6);
 sample[0].sidePinned='left';sample[3].sidePinned='right';
 const pinned=core.splitFluid(sample,[50,50,50,50,50,50],10);
 assert.ok(pinned.leftIds.includes('n0'));assert.ok(pinned.rightIds.includes('n3'));
});
test('Fluid is deterministic under 1500 seeded and pinned scenarios',()=>{
 let seed=0x9e3779b9;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let run=0;run<1500;run++){
  const n=2+Math.floor(rnd()*40);
  const nodes=Array.from({length:n},(_,i)=>({id:'n'+i,sidePinned:rnd()<.2?'left':rnd()<.25?'right':null}));
  const heights=nodes.map(()=>5+Math.floor(rnd()*200)),gap=10+Math.floor(rnd()*30);
  const a=core.splitFluid(nodes,heights,gap),b=core.splitFluid(nodes,heights,gap);
  assert.deepEqual(a,b);
  assert.equal(a.rightIds.length+a.leftIds.length,n);
  assert.equal(new Set([...a.rightIds,...a.leftIds]).size,n);
  assert.ok(a.H_R>=0&&a.H_L>=0);
  for(const node of nodes)if(node.sidePinned)assert.ok((node.sidePinned==='right'?a.rightIds:a.leftIds).includes(node.id));
 }
});
test('Cross-side drag is one atomic change and survives JSON roundtrip and undo',()=>{
 const f=fixture(),before=JSON.stringify(f.root);
 const {intent,result}=move(f,'a',150,215);
 assert.equal(intent.kind,'place');assert.equal(intent.side,'left');assert.equal(result,true);
 const moved=f.state.findNode('a');
 assert.equal(moved.sidePinned,'left');assert.equal(moved.parentId,'root');
 assert.equal(f.state.undoStack.length,1);
 const saved=JSON.parse(JSON.stringify(f.root));assert.equal(saved.layoutMode,'fluid');
 assert.equal(saved.children.find(n=>n.id==='a').sidePinned,'left');
 f.state.root=JSON.parse(f.state.undoStack.pop());assert.equal(JSON.stringify(f.state.root),before);
});
test('Empty-side landing remains attached to center and never detaches implicitly',()=>{
 const f=fixture();f.root.children=f.root.children.filter(n=>n.id!=='c');
 const {intent,result}=move(f,'a',160,350);
 assert.equal(intent.kind,'place');assert.equal(result,true);
 assert.equal(f.state.findNode('a').parentId,'root');
 assert.equal(f.state.findNode('a').isFloating,false);
});
test('Dropping into a gap reorders siblings without changing parent',()=>{
 const f=fixture();
 const {intent,result}=move(f,'b',620,193);
 assert.equal(intent.kind,'place');assert.equal(result,true);
 assert.ok(f.root.children.findIndex(n=>n.id==='b')<f.root.children.findIndex(n=>n.id==='a'));
 assert.equal(f.state.findNode('b').parentId,'root');
});
test('A sibling only becomes a child with an explicit intentional target',()=>{
 const f=fixture();f.app.findHit=()=>({type:'node',item:f.state.findNode('b')});
 const ordinary=drag.resolve(f.app,'a',620,300,{childIntent:false});
 assert.equal(ordinary.kind,'place');
 const deliberate=drag.resolve(f.app,'a',620,300,{childIntent:true});
 assert.equal(deliberate.kind,'child');assert.equal(deliberate.targetId,'b');
 assert.equal(drag.apply(f.app,f.state,'a',deliberate,{x:220,y:0},true),true);
 assert.equal(f.state.findNode('a').parentId,'b');assert.equal(f.state.findNode('b').children.length,1);
});
test('Self and descendant targets are inert and cannot corrupt the tree',()=>{
 const f=fixture(),a=f.state.findNode('a');
 a.children.push({id:'a1',parentId:'a',side:'right',children:[]});
 f.app.layout.nodeLayoutMap.set('a1',{x:360,y:-40,width:60,height:28});
 f.app.findHit=()=>({type:'node',item:f.state.findNode('a1')});
 assert.equal(drag.resolve(f.app,'a',760,260,{childIntent:true}).kind,'keep');
 assert.equal(drag.apply(f.app,f.state,'a',{kind:'child',targetId:'a1'},{x:360,y:-40},true),false);
 assert.equal(f.state.undoStack.length,0);assert.equal(a.parentId,'root');
});
test('No movement until commit; modified native pointer handlers are present',()=>{
 const f=fixture(),snapshot=JSON.stringify(f.root);
 const intent=drag.resolve(f.app,'b',170,150);
 assert.equal(JSON.stringify(f.root),snapshot);assert.equal(f.state.undoStack.length,0);
 assert.equal(intent.kind,'place');
 for(const dir of ['desktop-shared','android']){
  const code=fs.readFileSync(path.resolve(__dirname,'../../../apps',dir,'editor/study-interactions.js'),'utf8');
  assert.match(code,/childIntent/);assert.match(code,/nm612ResolveDrop\(d.nodeId,e.clientX,e.clientY/);
 }
});
test('ordinary geometric drag crosses sides at arbitrary destination depth and promotes back to root',()=>{
 for(const side of ['left','right']){
  const f=fixture(),sign=side==='left'?-1:1;
  const parent=f.state.findNode(side==='left'?'c':'b');
  const source=f.state.findNode('a');source.notes='Keep notes';
  const child={id:'level2',parentId:parent.id,side,children:[{id:'level3',parentId:'level2',side,children:[]}]};parent.children.push(child);
  f.positions.set(parent.id,[sign*220,0]);f.positions.set('level2',[sign*420,0]);f.positions.set('level3',[sign*620,0]);
  const before=JSON.stringify(f.root);
  const result=move(f,'a',400+sign*620,320);
  assert.equal(result.intent.parentId,'level2');assert.equal(result.result,true);
  assert.equal(source.parentId,'level2');assert.equal(source.side,side);assert.equal(source.notes,'Keep notes');
  assert.equal(f.state.undoStack.length,1);
  const promoted=move(f,'a',400-sign*220,380);
  assert.equal(promoted.intent.parentId,'root');assert.equal(promoted.result,true);
  assert.equal(source.parentId,'root');assert.equal(source.side,side==='left'?'right':'left');
  f.state.root=JSON.parse(f.state.undoStack[0]);assert.equal(JSON.stringify(f.state.root),before);
 }
});
test('spatial resolution uses the destination-side copy of repeated ancestors',()=>{
 const f=fixture(),p=f.state.findNode('c');
 p.children.push({id:'multi',parentId:'c',side:'right',children:[{id:'leaf',parentId:'multi',side:'right',children:[]}]});
 f.positions.set('multi-right',[420,0]);f.positions.set('multi-left',[-420,0]);
 f.positions.set('leaf-right',[620,0]);f.positions.set('leaf-left',[-620,0]);
 for(const id of ['multi','leaf'])for(const side of ['right','left'])f.app.layout.viewNodes.set(id+'-'+side,{logicalId:id,side});
 const intent=drag.resolve(f.app,'a',-220,320);
 assert.equal(intent.parentId,'multi');assert.equal(intent.side,'left');
});
test('zoomed-out destination lanes retain their level and allow the first child on either side',()=>{
 for(const zoom of [.15,.4,1,2])for(const side of ['left','right']){
  const f=fixture(),sign=side==='left'?-1:1,parent=f.state.findNode(side==='left'?'c':'b');
  const n={id:'nested',side,parentId:parent.id,children:[]};parent.children.push(n);f.positions.set('nested',[sign*420,0]);
  f.app.renderer.camera.zoom=zoom;
  f.app.renderer.worldToScreen=(x,y)=>({x:400+x*zoom,y:300+y*zoom});
  f.app.renderer.screenToWorld=(x,y)=>({x:(x-400)/zoom,y:(y-300)/zoom});
  const intent=drag.resolve(f.app,'a',400+sign*420*zoom,300+10*zoom);
  assert.equal(intent.parentId,parent.id,zoom+' '+side);
  const child=drag.resolve(f.app,'a',400+sign*550*zoom,300);
  assert.equal(child.parentId,n.id,zoom+' first child '+side);
 }
});
