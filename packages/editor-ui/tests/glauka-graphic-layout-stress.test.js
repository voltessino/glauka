'use strict';
// Repeatable stress tests, runnable locally with node --test. No GitHub Actions.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Core=require('../../map-core');
const Graphics=require('./helpers/compose-creative-core.cjs')();
const root=path.resolve(__dirname,'../../..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const document={
 documentElement:{lang:'it'},
 createElement:()=>({getContext:()=>({measureText:text=>({width:String(text).length*8})})}),
 getElementById:()=>null
};
const sandbox=vm.createContext({document,NeuroMapCore:Core,nm68ClampGap:value=>Number.isFinite(+value)?Math.max(30,Math.min(220,+value)):150});
const Layout=vm.runInContext(source('apps/desktop-shared/editor/layout.js')+'\nOrganicLayoutEngine;',sandbox);
vm.runInContext(source('packages/editor-ui/continuation-layout.js').replace(
  '/* @neuromap-continuation-layout-mount */\n',
  source('packages/editor-ui/continuation-layout-mount.js')),sandbox);
sandbox.NeuroMapContinuation.install(function MockApp(){},Layout,function MockRenderer(){});
function tree(primaries,children,depth=2){
 const root={id:'root',text:'Centro',side:'root',layoutMode:'clockwise',
  layoutDistribution:{enabled:true,height:960,minimumHeight:480,overflowMode:'expand'},children:[]};
 for(let i=0;i<primaries;i++){
  const a={id:'branch'+i,text:'Ramo '+i,side:'right',parentId:'root',children:[]};
  root.children.push(a);
  for(let j=0;j<children;j++){
   const b={id:'leaf'+i+':'+j,text:'Argomento '+j,side:'right',parentId:a.id,children:[]};
   a.children.push(b);
   if(depth>2)b.children.push({id:'deep'+i+':'+j,text:'Dettaglio',side:'right',parentId:b.id,children:[]});
  }
 }
 return root;
}
const layout=()=>Object.assign(new Layout(),{branchStyle:'neon',balanceBias:50,compactness:100,branchGapX:150,
 defaultLabelWrapChars:24,typographyPreset:'uniform',typographyScale:1,_nmImages:[]});
const positions=l=>new Map([...l.nodeLayoutMap].map(([id,v])=>[id,[v.x,v.y]]));
const displacement=(before,l)=>{
 let max=0,moved=0;
 for(const [id,[x,y]] of before){const n=l.nodeLayoutMap.get(id);if(!n)continue;
  const delta=Math.hypot(n.x-x,n.y-y);if(delta>1e-6){moved++;max=Math.max(max,delta)}}
 return {moved,max};
};
test('adding creative overlays does not move map branches, including a 12k+ node map',()=>{
 for(const [p,c,d] of [[4,2,2],[12,4,3],[30,15,2],[50,20,3],[80,40,3]]){
  const logical=tree(p,c,d),engine=layout();
  engine.computeLayout(logical);
  const before=positions(engine),count=before.size;
  const kinds=['chart','wordart','shape','formula','group'];
  engine._nmImages=Array.from({length:200},(_,i)=>({
   id:'object'+i,graphic:{kind:kinds[i%kinds.length]},
   mode:'attached',
   attachedNodeId:logical.children[i%p].children[i%c].id,
   offset:{dx:(i%2?30:-30),dy:-200},width:640,height:390
  }));
  engine.computeLayout(logical);
  assert.equal(displacement(before,engine).moved,0,'unexpected node movement for '+count+' nodes');
  engine._nmImages=[];
  engine.computeLayout(logical);
  assert.equal(displacement(before,engine).moved,0,'undo must restore original positions');
 }
});
test('ordinary node-attached pictures still participate in continuation planning',()=>{
 const logical=tree(12,4,3),engine=layout();
 engine.computeLayout(logical);
 const baseline=positions(engine);
 engine._nmImages=[{id:'photo',mode:'attached',attachedNodeId:logical.children[6].children[0].id,
  offset:{dx:0,dy:-235},width:640,height:390}];
 engine.computeLayout(logical);
 assert.ok(displacement(baseline,engine).moved>0,'existing photo avoidance logic should remain intact');
});


test('collision-aware placement avoids covering node text across varied map sizes',()=>{
 const intersections=(r,b)=>r.x<b.x+b.w&&r.x+r.w>b.x&&r.y<b.y+b.h&&r.y+r.h>b.y;
 for(const [primaries,children,depth] of [[4,2,2],[12,4,3],[30,15,2],[50,20,3],[80,40,3]]){
  const logical=tree(primaries,children,depth),engine=layout();
  engine.computeLayout(logical);
  const obstacles=[...engine.nodeLayoutMap.values()].map(m=>({
   x:m.x-m.width/2,y:m.y-m.height/2,w:m.width,h:m.height
  }));
  for(let i=0;i<Math.min(150,primaries*children);i++){
   const branch=logical.children[i%primaries].children[i%children];
   const m=engine.getLayout(branch.id);
   if(!m)continue;
   const width=i%2?640:480,height=i%2?390:142;
   const position=CorePlacement({
    anchor:{x:m.x,y:m.y,width:m.width,height:m.height,side:branch.side},
    width,height,obstacles
   });
   assert.equal(position.collisions,0,'placement collision at map size '+obstacles.length);
   const graphic={x:position.x-width/2-24,y:position.y-height/2-24,w:width+48,h:height+48};
   assert.ok(obstacles.every(b=>!intersections(graphic,b)),'overlapping label after placement');
  }
 }
});
function CorePlacement(spec){return Graphics.suggestGraphicPlacement(spec)}
