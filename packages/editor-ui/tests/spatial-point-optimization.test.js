'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/fast-canvas-spatial.js'),'utf8');
const output={};
vm.runInNewContext(source,{window:output});
const spatial=output.NeuroMapSpatialCanvas;

function scenario(total=10000){
 const nodes=Array.from({length:total},(_,i)=>({id:'n'+i,children:[]}));
 const root={id:'root',children:nodes},positions=new Map();
 // Include many overlapping nodes, negative coordinates, and one giant item
 // that is stored outside regular cells.
 for(let i=0;i<nodes.length;i++){
  const x=(i%125)*78-3000,y=Math.floor(i/125)*62-1200;
  positions.set(nodes[i].id,{x,y,width:i%37===0?100:84,height:i%23===0?90:48});
 }
 const giant={id:'giant',children:[]};
 root.children.push(giant);
 positions.set(giant.id,{x:100,y:200,width:18000,height:18000});
 const byId=new Map([[root.id,root],...root.children.map(n=>[n.id,n])]);
 let scans=0;
 const app={state:{root,findNode(id){scans++;return byId.get(id)||null}},
  layout:{nodeLayoutMap:positions,_nmSpatialVersion:1}};
 return {app,positions,scans:()=>scans};
}
function classic(app,x,y){
 let best=null;
 for(const [id,m] of app.layout.nodeLayoutMap){
  const w=Math.max(1,Number(m.width)||1),h=Math.max(1,Number(m.height)||1);
  if(x>=m.x-w/2&&x<=m.x+w/2&&y>=m.y-h/2&&y<=m.y+h/2)
   best=app.state.findNode(id);
 }
 return best?.id||null;
}

test('10k-node point selection exactly preserves classic last overlap and giant nodes',()=>{
 const f=scenario();
 const samples=[],seed=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 let state=151;
 for(let i=0;i<450;i++)samples.push([seed()*12000-4500,seed()*7500-2200]);
 const old=samples.map(([x,y])=>classic(f.app,x,y));
 const before=f.scans();
 const latest=samples.map(([x,y])=>spatial.hitNodeAt(f.app,x,y)?.id||null);
 assert.deepEqual(latest,old);
 assert.equal(f.scans(),before,'optimized pick may not invoke expensive state.findNode');
 assert.equal(f.app._nmSpatialHitIndex.table.items.length,10001);
});

test('missing logical IDs, shared cell overlap and cache version invalidation',()=>{
 const f=scenario(3);
 f.app.layout.nodeLayoutMap.set('ghost',{x:0,y:0,width:100,height:100});
 const a=spatial.hitNodeAt(f.app,0,0);
 assert.equal(a?.id,'giant');
 const first=f.app._nmSpatialHitIndex;
 const m=f.app.layout.nodeLayoutMap.get('n0');
 m.x=15000;
 f.app.layout._nmSpatialVersion++;
 assert.notStrictEqual(spatial.hitNodeAt(f.app,15000,-1200)?.id,'ghost');
 assert.notStrictEqual(f.app._nmSpatialHitIndex,first);
});
