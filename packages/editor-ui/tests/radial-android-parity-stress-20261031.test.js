'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const load=platform=>fs.readFileSync(path.join(ROOT,'apps',platform,'editor/layout.js'),'utf8');
const needle='      layoutRadialOrganic(root) {',end='      layoutSideBranches(root,';
function radial(platform){
 const src=load(platform),start=src.indexOf(needle),stop=src.indexOf(end,start);
 assert.ok(start>=0&&stop>start,'radial layout missing for '+platform);
 const method=src.slice(start,stop);
 return new Function('return ({'+method+'}).layoutRadialOrganic')();
}
function specimen(depth,width){
 const root={id:'root',text:'Root',children:[]};let level=[root],nextId=0;
 for(let d=0;d<depth;d++){
  const next=[];
  for(const parent of level)for(let n=0;n<(d===0?width:1);n++){
   const node={id:'n'+(++nextId),text:'Node '+nextId,children:[]};
   parent.children.push(node);next.push(node);
  }
  level=next;
 }
 return root;
}
function layout(fn,root){
 const nodeLayoutMap=new Map();
 const pending=[{node:root,depth:0}];let position=0;
 while(pending.length){
  const {node,depth}=pending.pop();
  nodeLayoutMap.set(node.id,{x:0,y:0,
   width:depth?70+(position%4)*15:130,height:30+(position%3)*4,depth});
  position++;
  for(let i=(node.children||[]).length-1;i>=0;i--)
   pending.push({node:node.children[i],depth:depth+1});
 }
 const context={nodeLayoutMap};
 fn.call(context,root);
 return context;
}
test('Android radial placement matches desktop for wide and 4000-deep maps',()=>{
 const desktop=radial('desktop-shared'),android=radial('android');
 for(const [depth,width] of [[3,8],[8,25],[1000,1],[4000,1],[3,600]]){
  const d=layout(desktop,specimen(depth,width));
  const a=layout(android,specimen(depth,width));
  assert.equal(a.nodeLayoutMap.size,d.nodeLayoutMap.size);
  assert.equal(a._nmRadialCollisionChecks,d._nmRadialCollisionChecks);
  for(const [id,point] of a.nodeLayoutMap){
   const other=d.nodeLayoutMap.get(id);
   assert.ok(other,'missing desktop node '+id);
   assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y),'nonfinite node '+id);
   assert.ok(Math.abs(point.x-other.x)<1e-8,id+' x drift');
   assert.ok(Math.abs(point.y-other.y)<1e-8,id+' y drift');
  }
 }
});
test('Android spatial radial comparisons are bounded on thousands of nodes',()=>{
 const android=radial('android');
 const sample=layout(android,specimen(3,600)); // 1801 total nodes
 const size=sample.nodeLayoutMap.size;
 assert.equal(size,1801);
 assert.ok(Number.isInteger(sample._nmRadialCollisionChecks));
 assert.ok(sample._nmRadialCollisionChecks < size*15,
  'radial layout regressed to quadratic collision scans');
});
