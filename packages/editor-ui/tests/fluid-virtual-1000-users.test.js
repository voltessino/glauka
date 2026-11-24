'use strict';
const composeUiSource=require('./helpers/compose-ui-source.cjs');

// Deterministic virtual-user stress. Real layout and drag source are loaded
// without the browser shell; GUI/OS acceptance remains a separate release gate.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../../map-core/index.js');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const dragContext={};
vm.runInNewContext(require('./helpers/compose-drag-preview.cjs')(),{globalThis:dragContext});
const drag=dragContext.NeuroMapDrag;
const ui=composeUiSource('creative-tools');
const first=ui.indexOf('    const split = Layout.prototype.computeDynamicClockwiseSplit;');
const last=ui.indexOf('    const side = Layout.prototype.layoutSideBranches;',first);
assert.ok(first>=0&&last>first);
const installSplit=new Function('Layout','root',ui.slice(first,last));
const graphicContext={};
vm.runInNewContext(require('./helpers/compose-graphics.cjs')(),{globalThis:graphicContext});
// The manual-offset implementation is in the first, contiguous v5 source slice.
const offsets=read('apps/desktop-shared/editor/study-canvas-interactions.js');
const offFirst=offsets.indexOf('    OrganicLayoutEngine.prototype.applyManualOffsets=function(root){');
const offLast=offsets.indexOf('    NeuroMapApp.prototype.getStudyCardsForTab',offFirst);
assert.ok(offFirst>=0&&offLast>offFirst);
function realEngine(platform){
 const src=read('apps/'+platform+'/editor/layout.js'),context={
  NeuroMapCore:core,nm68ClampGap:x=>Math.max(30,Math.min(220,x||150)),
  document:{createElement:()=>({getContext:()=>({measureText:value=>({width:String(value).length*8})})})}
 };
 vm.runInNewContext(src+'\nthis.Engine=OrganicLayoutEngine;',context);
 const Engine=context.Engine;
 installSplit(Engine,{NeuroMapCore:core});
 new Function('OrganicLayoutEngine',offsets.slice(offFirst,offLast))(Engine);
 const original=Engine.prototype.applyManualOffsets;
 Engine.prototype.applyManualOffsets=function(root){
  original.call(this,root);
  graphicContext.NeuroMapGraphics.separateSubtrees(this,root);
 };
 return Engine;
}
const Engines=[realEngine('desktop-shared'),realEngine('android')];
function rng(seed){
 let x=seed>>>0;
 return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
}
test('1000 virtual users × 35 mixed drag operations preserve UX and state invariants',t=>{
 const modes=['fluid','balanced','clockwise','right','left','columns'];
 const zooms=[.3,.5,1,1.8,2.2];
 let trials=0,moved=0,unmodified=0,historyProofs=0,collisions=0,snaps=0,unexpectedNests=0;
 for(let tester=0;tester<1000;tester++){
  const random=rng((tester+1)*7919+0xbadf00d);
  const pick=list=>list[Math.floor(random()*list.length)];
  const layoutMode=pick(modes),zoom=pick(zooms);
  const root={id:'root-'+tester,text:'Central',side:'root',layoutMode,layoutBalanceMode:'geometry',children:[]};
  const nodes=new Map([[root.id,root]]);
  const size=4+Math.floor(random()*16);
  for(let i=0;i<size;i++){
   const parent=i>4&&random()<.25?pick(root.children):root;
   const id='topic-'+tester+'-'+i,node={id,parentId:parent.id,side:'right',text:'Topic '+i,children:[]};
   parent.children.push(node);nodes.set(id,node);
  }
  const state={root,images:[],undoStack:[],selectedNodeId:null,selectedNodeIds:[],
   findNode:id=>nodes.get(id),getAllNodes:()=>[...nodes.values()],
   pushHistory(){this.undoStack.push(JSON.stringify(root));},
   normalizeChildrenOrder:p=>p.children.forEach((node,index)=>{node.customOrder=index;})
  };
  const layout=new Engines[tester%2]();
  Object.assign(layout,{branchStyle:'xmind8',branchGapX:150,compactness:100,balanceBias:50});
  const camera={zoom,x:550,y:450},renderer={camera,
   worldToScreen:(x,y)=>({x:x*zoom+camera.x,y:y*zoom+camera.y}),
   screenToWorld:(x,y)=>({x:(x-camera.x)/zoom,y:(y-camera.y)/zoom})
  };
  const app={state,layout,renderer,v5SubtreeColors(){},findHit(x,y){
   const p=renderer.screenToWorld(x,y);let hit=null;
   for(const [id,m] of layout.nodeLayoutMap)if(
    Math.abs(m.x-p.x)<m.width/2&&Math.abs(m.y-p.y)<m.height/2)hit=nodes.get(id);
   return hit?{type:'node',item:hit}:null;
  }};
  const verify=()=>{
   const seen=new Set(),todo=[root];
   while(todo.length){
    const node=todo.pop();
    assert.ok(!seen.has(node.id),'cycle / duplicate');
    seen.add(node.id);
    for(const child of node.children){assert.equal(child.parentId,node.id);todo.push(child);}
   }
   assert.equal(seen.size,nodes.size,'lost a canonical node');
  };
  for(let step=0;step<35;step++){
   layout.computeLayout(root,50);
   const candidates=[...nodes.values()].filter(n=>n!==root&&!n.isFloating);
   if(!candidates.length)break;
   const source=pick(candidates),action=Math.floor(random()*10);
   let wx=-650+1300*random(),wy=-650+1300*random();
   if(action===0)wx=-400;
   if(action===1)wx=400;
   if(action===2)wx=-900;
   if(action===3)wx=900;
   if(action===4)wx=0,wy=0;
   if(action===5)wx=layout.getLayout(source.id)?.x||200;
   let childIntent=false,altKey=false;
   if(action>=6&&action<=8){
    const possible=action===7?nodes.get(source.parentId)?.children.filter(n=>n!==source):[...nodes.values()].filter(n=>n!==source);
    if(possible?.length){
     const target=pick(possible),p=layout.getLayout(target.id);
     if(p){wx=p.x;wy=p.y;childIntent=action===8;altKey=action===7&&random()<.5;}
    }
   }
   const where=renderer.worldToScreen(wx,wy),before=JSON.stringify(root),oldCount=state.undoStack.length;
   const intent=drag.resolve(app,source.id,where.x,where.y,{childIntent,altKey});
   if(intent?.kind==='child'&&!childIntent&&!altKey)unexpectedNests++;
   const done=intent&&drag.apply(app,state,source.id,intent,{x:wx,y:wy},true);
   trials++;
   if(done){
    moved++;verify();
    assert.equal(state.undoStack.length,oldCount+1,'must have exactly one Undo checkpoint');
    assert.equal(state.undoStack.at(-1),before,'Undo must recover exact previous tree');
    historyProofs++;
    const json=JSON.stringify(root);assert.equal(JSON.parse(json).id,root.id);
    layout.computeLayout(root,50);
    const updated=nodes.get(source.id);
    if(updated.parentId===root.id&&updated.sidePinned)
     assert.equal(updated.side,updated.sidePinned,'manual pin survives relayout');
    if(intent.kind==='place'&&updated.parentId===root.id&&updated.manualOffset){
     const m=layout.getLayout(source.id);
     if(m&&Math.abs(m.y-wy)>150)snaps++;
    }
    const main=root.children.filter(n=>!n.isFloating);
    for(let i=0;i<main.length;i++)for(let j=i+1;j<main.length;j++){
     const a=layout.getLayout(main[i].id),b=layout.getLayout(main[j].id);
     if(a&&b&&Math.abs(a.x-b.x)<(a.width+b.width)/2-2&&
       Math.abs(a.y-b.y)<(a.height+b.height)/2-2)collisions++;
    }
   }else{
    unmodified++;
    assert.equal(state.undoStack.length,oldCount,'rejected attempt must not push Undo');
    assert.equal(JSON.stringify(root),before,'rejected attempt must not mutate tree');
   }
  }
 }
 assert.equal(trials,35000,'all planned actions must run');
 assert.equal(unexpectedNests,0,'no unintentional reparenting');
 assert.equal(collisions,0,'no overlapping root topic boxes');
 t.diagnostic(JSON.stringify({virtualUsers:1000,actions:trials,moved,unmodified,historyProofs,
   overlappingMainTopics:collisions,unexpectedNests,snapsFartherThan150px:snaps}));
});
