'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../../map-core');
globalThis.NeuroMapCore=Core;
globalThis.NeuroMapGraphics={bounds:()=>({})};
globalThis.document={documentElement:{lang:'it'},getElementById:()=>null,querySelector:()=>null};
require('node:vm').runInThisContext(require('./helpers/compose-continuation-layout.cjs')(),{filename:'continuation-layout.js'});

class FakeLayout {
 constructor(){
  this.branchStyle='xmind8';this.balanceBias=50;
  this.verticalGap=10;this.primaryGroupGap=10;
  this.nodeLayoutMap=new Map();this._nmImages=[];this._nmImageMap=new Map();
 }
 computeLayout(root){
  this.nodeLayoutMap=new Map();
  const pending=[{node:root,depth:0}];
  while(pending.length){
   const {node,depth}=pending.pop();
   // Deliberately mutates side, like the legacy measurement pipeline.
   node.side=node.side||'right';
   this.nodeLayoutMap.set(node.id,{x:depth*120,y:0,width:90,height:40});
   for(const child of node.children||[])pending.push({node:child,depth:depth+1});
  }
  return {H_R:0,H_L:0};
 }
 measureNode(){return {width:90,height:40}}
 getLayout(id){return this.nodeLayoutMap.get(id)}
 computeBoundingBox(){return {minX:-110,maxX:250,minY:-200,maxY:200}}
}
class FakeRenderer{render(){}drawThresholdGuides(){}}
class FakeApp{
 bindUI(){}updateStatus(){}nm611MoveSelection(){}
 nm612Bounds(){}findHit(){}selectNode(){}
 nmAsk(){return Promise.resolve('cancel')}
}
globalThis.NeuroMapContinuation.install(FakeApp,FakeLayout,FakeRenderer);

function specimen(n,height=480){
 return {id:'root',side:'root',text:'Study',
  layoutDistribution:{enabled:true,height,minimumHeight:480,overflowMode:'expand'},
  children:[{id:'p',side:'right',text:'Anatomia',
   children:Array.from({length:n},(_,i)=>({
    id:'leaf-'+i,side:'right',text:'Topic '+i,notes:i%9?'':'real note',children:[]
   }))}]};
}
const geometry=layout=>layout.continuationPlan?.pages.map(p=>({
 side:p.side,logicalLeaves:[...p.units],occupied:p.height
}));
test('1000 independent real-layout-wrapper projections remain reversible and do not alter persisted nodes',()=>{
 let assertions=0;
 for(let user=0;user<1000;user++){
  const root=specimen(4+user%39);
  const layout=new FakeLayout();
  layout.verticalGap=user%3===0?70:user%3===1?10:0;
  layout.balanceBias=[25,50,75][user%3];
  const original=JSON.stringify(root);
  layout.computeLayout(root);
  const first=JSON.stringify(geometry(layout)),effective=layout.adaptiveLimit.effective;
  assert.equal(root.layoutDistribution.height,480);assertions++;
  assert.ok(layout.adaptiveLimit.effective>=480);assertions++;
  root.layoutDistribution.height=1200;
  layout.computeLayout(root);
  assert.equal(root.layoutDistribution.height,1200);assertions++;
  root.layoutDistribution.height=480;
  layout.computeLayout(root);
  assert.equal(JSON.stringify(geometry(layout)),first);assertions++;
  assert.equal(layout.adaptiveLimit.effective,effective);assertions++;
  const prediction=layout.predictContinuation('p');
  assert.equal(prediction.blocked,false);assertions++;
  assert.equal(JSON.stringify(root),original);assertions++;
 }
 assert.equal(assertions,7000);
});
test('technical overflow never paints extra islands, changes IDs, or changes saved settings',()=>{
 const root=specimen(4200),original=JSON.stringify(root);
 const layout=new FakeLayout();layout.computeLayout(root);
 assert.equal(layout.adaptiveLimit.blocked,true);
 assert.equal(layout.presentationRoot,null);
 assert.equal(root.layoutDistribution.height,480);
 const preview=layout.predictContinuation('p');
 assert.equal(preview.blocked,true);
 assert.equal(JSON.stringify(root),original);
});
test('insertion guard refuses overflowing new child before history or mutation',()=>{
 const root=specimen(4200),layout=new FakeLayout();
 layout.computeLayout(root);
 class FakeState {
  constructor(root){this.root=root;this.undoStack=[]}
  findNode(id){const q=[this.root];while(q.length){const n=q.pop();if(n.id===id)return n;q.push(...(n.children||[]))}return null}
  pushHistory(){this.undoStack.push(JSON.stringify(this.root))}
  addChildNode(parentId){this.pushHistory();const parent=this.findNode(parentId);
   if(!parent)return null;const newNode={id:'unsafe',side:'right',children:[]};parent.children.push(newNode);return newNode}
  addSiblingNode(id){this.pushHistory();return {id:'unsafe-sibling'}}
 }
 const app=new FakeApp();app.layout=layout;app.state=new FakeState(root);app.bindUI();
 const before=JSON.stringify(root);
 assert.equal(app.state.addChildNode('p'),null);
 assert.equal(app.state.addSiblingNode('leaf-0'),null);
 assert.equal(JSON.stringify(root),before);
 assert.equal(app.state.undoStack.length,0);
});
test('manual limit edits and Undo/Redo snapshots retain the configured limit',()=>{
 const root=specimen(32),layout=new FakeLayout(),undo=[],redo=[];
 const save=()=>undo.push(JSON.stringify(root));
 const frame=()=>{
  layout.computeLayout(root);
  return JSON.stringify(geometry(layout));
 };
 const original=frame();
 save();root.layoutDistribution.height=1200;
 const taller=frame();assert.notEqual(taller,original);
 const previous=undo.pop();redo.push(JSON.stringify(root));
 Object.assign(root,JSON.parse(previous));
 assert.equal(frame(),original);
 Object.assign(root,JSON.parse(redo.pop()));
 assert.equal(frame(),taller);
});
test('old maps remain in the legacy projection without adding new metadata',()=>{
 const root=specimen(8);delete root.layoutDistribution.overflowMode;
 root.layoutDistribution.enabled=false;
 const before=JSON.stringify(root),layout=new FakeLayout();
 layout.computeLayout(root);
 assert.equal(layout.presentationRoot,null);
 assert.equal(layout.continuationPlan,null);
 assert.equal(JSON.stringify(root),before);
});
test('asymmetric attached-node images are included without touching original attachments',()=>{
 const root=specimen(32),layout=new FakeLayout(),small=new FakeLayout();
 const image={mode:'attached',attachedNodeId:'leaf-0',height:460,width:360,offset:{dy:-180}};
 layout._nmImages=[image];
 layout.computeLayout(root);
 small.computeLayout(root);
 assert.ok(layout.adaptiveLimit.effective>=small.adaptiveLimit.effective);
 assert.equal(image.height,460);
 assert.equal(root.layoutDistribution.height,480);
});

test('legacy enabled maps never create another central view at any tested spacing',()=>{
 for(const height of [180,480,1200])for(const count of [8,32,75])for(const gap of [0,24,70])for(const bias of [0,25,50,75,100]){
  const tree=specimen(count);tree.layoutDistribution={enabled:true,height};const original=JSON.stringify(tree);const layout=new FakeLayout();layout.verticalGap=gap;layout.balanceBias=bias;layout.computeLayout(tree);
  assert.equal(JSON.stringify(tree),original,'legacy file data changed');
  assert.equal([...layout.viewNodes.values()].filter(n=>n.logicalId===tree.id).length,1);
  assert.equal(layout.continuationGroups.length,1);
  assert.ok(layout.continuationPlan.pages.length<=2);
  assert.equal(new Set(layout.continuationPlan.pages.map(p=>p.side)).size,layout.continuationPlan.pages.length);
 }
});
test('invalid multi-page planner output falls back to one logical tree before drawing islands',()=>{
 const originalCore=globalThis.NeuroMapCore;
 try{
  globalThis.NeuroMapCore={...Core,planAdaptiveContinuation:()=>({pages:[{side:'right',units:[]},{side:'left',units:[]},{side:'right',units:[]}],blocked:false})};
  const tree=specimen(12),before=JSON.stringify(tree),layout=new FakeLayout();layout.computeLayout(tree);
  assert.equal(layout.presentationRoot,null);assert.equal(layout.continuationGroups.length,0);assert.equal(layout.adaptiveLimit.blocked,true);assert.equal(JSON.stringify(tree),before);
 }finally{globalThis.NeuroMapCore=originalCore}
});
