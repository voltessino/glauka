'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/layout.js'),'utf8');
const Core=require('../../map-core');
const document={createElement:()=>({getContext:()=>({
  font:'',measureText:text=>({width:String(text).length*8})
})})};
const Layout=vm.runInNewContext(src+'\nOrganicLayoutEngine',
  {document,NeuroMapCore:Core,nm68ClampGap:v=>Number.isFinite(+v)?Math.max(30,Math.min(220,+v)):150});
function setup(){
 const layout=new Layout();
 layout.branchGapX=150;layout.compactness=55;layout.balanceBias=50;
 layout.branchStyle='xmind8';return layout;
}
function chain(depth){
 const root={id:'root',text:'Root',side:'root',children:[]};
 let parent=root;
 for(let i=0;i<depth;i++){
  const child={id:'node-'+i,text:'Node '+i,side:'right',children:[]};
  parent.children.push(child);parent=child;
 }
 return root;
}
function rect(metric){return [metric.x,metric.y,metric.width,metric.height,
 metric.subtreeHeight,metric.attachInX,metric.attachInY,metric.attachOutX,metric.attachOutY];}
test('18,000-deep clockwise subtree layouts avoid call stack overflow',()=>{
 const root=chain(18000),layout=setup();
 layout.computeLayout(root);
 assert.equal(layout.nodeLayoutMap.size,18001);
 assert.equal(layout.getLayout('node-17999').depth,18000);
 assert.ok(Number.isFinite(layout.getLayout('node-17999').x));
});
test('deep bounding rectangles support collapsed and expanded descendants',()=>{
 const root=chain(9000),layout=setup();
 layout.computeLayout(root);
 const full=layout.getSubtreeBoundingBox(root,true);
 assert.ok(full.width>10000);
 root.children[0].collapsed=true;
 const collapsed=layout.getSubtreeBoundingBox(root,false);
 assert.ok(collapsed.width<full.width);
 assert.equal(layout.getSubtreeBoundingBox(null),null);
});
test('classic left/right clockwise positioning preserves row order and non-overlap',()=>{
 const root={id:'root',text:'Root',side:'root',children:[
   {id:'a',text:'A',side:'right',children:Array.from({length:20},(_,i)=>
      ({id:'a'+i,text:'A '+i,side:'right',children:[]}))},
   {id:'b',text:'B',side:'left',children:Array.from({length:20},(_,i)=>
      ({id:'b'+i,text:'B '+i,side:'left',children:[]}))}
 ]};
 const layout=setup();layout.computeLayout(root);
 const centersA=root.children[0].children.map(x=>layout.getLayout(x.id).y);
 const centersB=root.children[1].children.map(x=>layout.getLayout(x.id).y);
 assert.deepEqual([...centersA].sort((a,b)=>a-b),centersA);
 assert.deepEqual([...centersB].sort((a,b)=>a-b),centersB);
 for(const side of root.children)for(let i=1;i<side.children.length;i++){
   const prior=layout.getLayout(side.children[i-1].id),next=layout.getLayout(side.children[i].id);
   assert.ok(next.y-next.height/2>=prior.y+prior.height/2);
 }
});
test('summary brackets follow target descendants when subtrees are repositioned',()=>{
 const target={id:'target',text:'Target',side:'right',children:[
  {id:'t1',text:'One',side:'right',children:[]}]};
 const summary={id:'summary',text:'Summary',side:'right',isSummary:true,
   summaryTargetIds:['target'],children:[]};
 const root={id:'root',text:'Root',side:'root',children:[
  {id:'main',text:'Main',side:'right',children:[target,summary]}]};
 const layout=setup();layout.computeLayout(root);
 const m=layout.getLayout('summary');
 assert.ok(m.bracketGeom);
 const bounds=layout.getSubtreeBoundingBox(target);
 assert.ok(m.x>bounds.maxX);
 assert.equal(m.bracketGeom.dir,1);
});
test('recomputeDescendantsLayout keeps parent coordinates fixed',()=>{
 const root={id:'root',text:'Root',side:'root',children:[
  {id:'branch',text:'Branch',side:'right',children:[
   {id:'leaf',text:'Leaf',side:'right',children:[]}
  ]}]};
 const layout=setup();layout.computeLayout(root);
 const prior=rect(layout.getLayout('branch'));
 layout.recomputeDescendantsLayout(root.children[0]);
 const next=rect(layout.getLayout('branch'));
 assert.deepEqual(next,prior);
});
