'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const composeUiSource=require('./helpers/compose-ui-source.cjs');

// Repeatable tests of production state/layout/drag/zoom sources.
// Virtual commands are not physical keypresses or a GUI/device certification.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../map-core');
const ROOT=path.resolve(__dirname,'../../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const dragHost={};
new Function('globalThis',require('./helpers/compose-drag-preview.cjs')())(dragHost);
const drag=dragHost.NeuroMapDrag;
assert.ok(drag?.resolve&&drag?.apply);
const creative=composeUiSource('creative-tools');
const begin=creative.indexOf('    const split = Layout.prototype.computeDynamicClockwiseSplit;');
const end=creative.indexOf('    const side = Layout.prototype.layoutSideBranches;',begin);
assert.ok(begin>=0&&end>begin,'Shared layout override not found');

function engine(platform){
 const document={createElement:()=>({getContext:()=>({font:'',
  measureText:value=>({width:String(value).length*8})})})};
 const Layout=new Function('document','NeuroMapCore','nm68ClampGap','globalThis',
  read('apps/'+platform+'/editor/layout.js')+'\nreturn OrganicLayoutEngine;')(
   document,Core,value=>Math.max(30,Math.min(220,value||150)),{});
 new Function('Layout','root',creative.slice(begin,end))(Layout,{NeuroMapCore:Core});
 return Layout;
}
function stateClass(platform){
 const palette=['#dd5555','#66dd66','#8888ff','#11ccdd'];
 return new Function('NeuroMapCore','nm70PreferredGap','localStorage',
  'HARMONIC_PALETTE','ColorUtils','THEME_PALETTES','globalThis',
  composeStateSource(platform)+'\nreturn MindMapStateMachine;')(
   Core,()=>150,{getItem:()=>null},palette,{lighten:hex=>hex},{default:palette},{});
}
const randomFor=seed=>{
 let x=seed>>>0;
 return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
};
const modes=['clockwise','balanced','fluid','columns','right','left'];

test('8000 mixed node commands keep canonical trees valid across desktop and Android',t=>{
 const counters={actions:0,drags:0,undo:0,redo:0,modeSwitches:0,layouts:0};
 for(const platform of ['desktop-shared','android']){
  const State=stateClass(platform),Engine=engine(platform);
  for(let seed=1;seed<=50;seed++){
   const rnd=randomFor(seed*7919+(platform==='android'?31:0));
   const pick=arr=>arr[Math.floor(rnd()*arr.length)];
   const state=new State();
   state.initStarterTree('Chaos '+seed);
   let sequence=0;
   state.generateId=(prefix='node')=>prefix+'-'+seed+'-'+(++sequence);
   const layout=new Engine();
   Object.assign(layout,{branchStyle:'xmind8',branchGapX:150,compactness:100,
    balanceBias:50,defaultLabelWrapChars:18,typographyPreset:'uniform',typographyScale:1});
   const camera={x:500,y:350,zoom:1};
   const renderer={camera,
    worldToScreen:(x,y)=>({x:x*camera.zoom+camera.x,y:y*camera.zoom+camera.y}),
    screenToWorld:(x,y)=>({x:(x-camera.x)/camera.zoom,y:(y-camera.y)/camera.zoom})};
   const app={state,layout,renderer,v5SubtreeColors(){},
    findHit(x,y){
     const p=renderer.screenToWorld(x,y);let hit=null;
     for(const [id,m] of layout.nodeLayoutMap)
      if(Math.abs(m.x-p.x)<m.width/2&&Math.abs(m.y-p.y)<m.height/2)
       hit=state.findNode(id);
     return hit?{type:'node',item:hit}:null;
    }};
   for(let step=0;step<80;step++){
    const nodes=state.getAllNodesIncludingCollapsed(),root=state.root;
    const others=nodes.filter(n=>n.id!==root.id);
    const n=others.length?pick(others):root,r=rnd();
    if(r<.14&&nodes.length<90)state.addChildNode(n.id,layout,'Child '+step);
    else if(r<.25&&others.length&&nodes.length<90)state.addSiblingNode(n.id,layout,rnd()<.5);
    else if(r<.34&&others.length>2)state.deleteNode(n.id);
    else if(r<.43&&others.length)state.updateNodeText(n.id,'edited-'+seed+'-'+step);
    else if(r<.52&&others.length)state.toggleCollapse(n.id);
    else if(r<.58&&others.length)state.invertBranchAndSubbranches(n.id);
    else if(r<.64&&others.length)state.updateNodeColorWithPropagation(n.id,'#abcdef');
    else if(r<.70&&others.length)state.updateNodeFontSize(n.id,9+Math.floor(rnd()*42),true);
    else if(r<.76){
     state.pushHistory();
     root.layoutMode=pick(modes);
     if(root.layoutMode==='balanced')root.layoutBalanceMode='geometry';
     counters.modeSwitches++;
    } else if(r<.83){
     camera.zoom=[.25,.6,1,1.8,2.4][Math.floor(rnd()*5)];
     camera.x=200+rnd()*500;camera.y=100+rnd()*500;
    }else if(r<.89){if(state.undo())counters.undo++;}
    else if(r<.93){if(state.redo())counters.redo++;}
    else if(others.length){
     layout.computeLayout(root,50);
     const wx=(rnd()-.5)*1000,wy=(rnd()-.5)*1000;
     const where=renderer.worldToScreen(wx,wy);
     const intent=drag.resolve(app,n.id,where.x,where.y,
      {altKey:rnd()<.2,childIntent:rnd()<.2});
     if(intent&&drag.apply(app,state,n.id,intent,{x:wx,y:wy},true))
      counters.drags++;
    }
    const logical=state.getAllNodesIncludingCollapsed(),ids=new Set();
    for(const node of logical){
     assert.ok(!ids.has(node.id),'duplicate ID '+node.id+' '+platform+' seed='+seed);
     ids.add(node.id);
     for(const child of node.children||[])assert.equal(child.parentId,node.id,
      'broken parent '+platform+' seed='+seed);
    }
    assert.ok(logical.length<=1000,'unbounded structure');
    if(step%8===0){
     const result=layout.computeLayout(state.root,50);
     assert.ok(result&&layout.nodeLayoutMap.size>=1);
     for(const m of layout.nodeLayoutMap.values())
      assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y),'nonfinite geometry');
     counters.layouts++;
    }
    counters.actions++;
   }
  }
 }
 assert.equal(counters.actions,8000);
 assert.ok(counters.drags>100);
 assert.ok(counters.modeSwitches>100);
 assert.ok(counters.undo>100);
 assert.ok(counters.layouts===1000);
 t.diagnostic(JSON.stringify(counters));
});

test('40000 real zoom operations preserve the pointer anchor and finite camera',()=>{
 const composeAppSource=require('./helpers/compose-app-source.cjs');
 for(const platform of ['desktop-shared','android']){
  const src=composeAppSource(platform);
  const begin=src.indexOf('      zoomAt(');
  const end=src.indexOf('\n      imageHandleHit(',begin);
  assert.ok(begin>=0&&end>begin);
  const zoom=new Function('return ({'+src.slice(begin,end)+'}).zoomAt')();
  const camera={zoom:1,x:310,y:210};
  const app={renderer:{camera},updateStatus(){},requestRender(){},positionEditor(){}};
  const rnd=randomFor(0xbeef+(platform==='android'?1:0));
  for(let step=0;step<20000;step++){
   const clientX=100+rnd()*1000,clientY=50+rnd()*700;
   const factor=rnd()<.5?1.16:1/1.16;
   const x=(clientX-camera.x)/camera.zoom,y=(clientY-camera.y)/camera.zoom;
   zoom.call(app,factor,clientX,clientY);
   assert.ok(Number.isFinite(camera.x)&&Number.isFinite(camera.y)&&
    Number.isFinite(camera.zoom)&&camera.zoom>0&&camera.zoom<=3.5);
   assert.ok(Math.abs((clientX-camera.x)/camera.zoom-x)<1e-4,'pointer x moved');
   assert.ok(Math.abs((clientY-camera.y)/camera.zoom-y)<1e-4,'pointer y moved');
  }
 }
});
