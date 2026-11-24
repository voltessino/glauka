'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../../map-core');
const src=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/layout.js'),'utf8');
const document={createElement:()=>({getContext:()=>({
  measureText:value=>({width:String(value).length*8})
})})};
const Layout=vm.runInNewContext(src+'\nOrganicLayoutEngine',{
 document,NeuroMapCore:Core,nm68ClampGap:v=>Number.isFinite(+v)?Math.max(30,Math.min(220,+v)):150
});
function layout(root,style='radial'){
 const engine=new Layout();
 engine.branchGapX=150;engine.balanceBias=50;engine.compactness=55;engine.branchStyle=style;
 engine.computeLayout(root);return engine;
}
function star(n){
 return {id:'root',text:'Root',side:'root',children:Array.from({length:n},(_,i)=>({
  id:'n'+i,text:'Node '+i,side:'right',children:[]
 }))};
}
function chain(n){
 const root={id:'root',text:'Root',side:'root',children:[]};let node=root;
 for(let i=0;i<n;i++){
  const next={id:'n'+i,text:'Deep '+i,side:'right',children:[]};
  node.children.push(next);node=next;
 }
 return root;
}
test('10,000 radial sibling nodes use a bounded candidate set instead of all-pairs',()=>{
 const result=layout(star(10000));
 assert.equal(result.nodeLayoutMap.size,10001);
 assert.ok(result._nmRadialCollisionChecks<200000,
  'radial collision candidates must be far below 50 million possible pairs');
 for(const m of result.nodeLayoutMap.values()){
  assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));
 }
});
test('12,000 nested radial descendants are positioned iteratively',()=>{
 const result=layout(chain(12000));
 assert.equal(result.nodeLayoutMap.size,12001);
 const deepest=result.getLayout('n11999');
 assert.equal(deepest.depth,12000);
 assert.ok(Number.isFinite(deepest.x)&&Number.isFinite(deepest.y));
});
test('radial summary nodes stay adjacent to their parent and do not reflow saved data',()=>{
 const source={id:'root',text:'R',side:'root',children:[{
  id:'parent',text:'P',side:'right',children:[
    {id:'child',text:'C',side:'right',children:[]},
    {id:'summary',text:'S',side:'right',isSummary:true,
     summaryTargetIds:['child'],children:[]}
  ]}]};
 const snapshot=JSON.stringify(source);
 const result=layout(source);
 const p=result.getLayout('parent'),s=result.getLayout('summary');
 assert.equal(s.x,p.x+36);assert.equal(s.y,p.y-42);
 assert.equal(s.bracketGeom,null);
 assert.equal(JSON.stringify(source),snapshot);
});
test('radial and horizontal modes produce finite geometry without clobbering the original node tree',()=>{
 const source=star(90),before=JSON.stringify(source);
 const radial=layout(source),horizontal=layout(source,'xmind8');
 assert.equal(radial.nodeLayoutMap.size,horizontal.nodeLayoutMap.size);
 assert.ok(radial._nmRadialCollisionChecks>=0);
 assert.ok([...horizontal.nodeLayoutMap.values()].every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
 // Legacy clockwise layout may update the visual side on the source tree;
 // the topology and node count must never change.
 assert.equal(source.children.length,90);
 assert.equal(JSON.parse(before).children.length,source.children.length);
});
