'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/fast-canvas.js'),'utf8');

function fixture(root,positions,stored='false'){
  const saved={value:stored},nodes=[],branches=[];
  const toggle={checked:false,events:{},addEventListener(type,cb){this.events[type]=cb;}};
  const stats={hidden:true,textContent:''};
  const window={
    innerWidth:1000,innerHeight:800,performance:{now:()=>42},
    localStorage:{getItem(){return saved.value;},setItem(k,v){saved.value=v;}},
    document:{getElementById(id){return id==='nm-fast-canvas-toggle'?toggle:
      id==='nm-fast-canvas-stats'?stats:null;}}
  };
  vm.runInNewContext(source,{window});
  class Renderer{
    constructor(){
      this.canvas={clientWidth:1000,clientHeight:800};
      this.camera={x:500,y:400,zoom:1};
      this.state={root,branchStyle:'neon'};
      this.layout={getLayout:id=>({x:positions[id]??0,y:0,width:80,height:30})};
    }
    drawNode(node){nodes.push(node.id);if(!node.collapsed)for(const child of node.children||[])this.drawNode(child);}
    drawTaperingBranch(parent,child){
      branches.push(child.id);
      if(!child.collapsed)for(const grandchild of child.children||[])this.drawTaperingBranch(child,grandchild);
    }
    render(){this.drawNode(root);for(const n of root.children||[])this.drawTaperingBranch(root,n);}
  }
  class App{
    constructor(){this.renderer=new Renderer();this.renders=0;this.saves=0;}
    bindUI(){}
    requestRender(){this.renders++;nodes.length=0;branches.length=0;this.renderer.render();}
  }
  window.NeuroMapFastCanvas.install(App,Renderer);
  const app=new App();app.bindUI();
  return {app,toggle,stats,saved,nodes,branches,change(value){
    toggle.checked=value;toggle.events.change();
  }};
}
test('mode is off by default, opt-in persists per device and never saves the map',()=>{
  const f=fixture({id:'root',children:[]},{root:0});
  assert.equal(f.app.renderer.highPerformanceCanvas,false);
  assert.equal(f.stats.hidden,true);
  f.change(true);
  assert.equal(f.saved.value,'true');
  assert.equal(f.stats.hidden,false);
  assert.equal(f.app.saves,0);
  f.change(false);
  assert.equal(f.saved.value,'false');
  assert.equal(f.app.renderer.highPerformanceCanvas,false);
});
test('viewport culling preserves on-screen descendants of off-screen ancestors',()=>{
  const root={id:'root',children:[{id:'off',children:[{id:'off2',children:[{id:'near',children:[]}]}]}]};
  const f=fixture(root,{root:0,off:5000,off2:5100,near:60});
  assert.equal(f.nodes.join(','),'root,off,off2,near');
  f.change(true);
  assert.equal(f.nodes.join(','),'root,near');
  assert.equal(f.branches.join(','),'off,near');
  assert.equal(f.app.renderer.fastCanvasStats.visited,4);
  assert.equal(f.app.renderer.fastCanvasStats.painted,2);
  assert.match(f.stats.textContent,/2\/4 nodi/);
  f.nodes.length=0;
  f.app.renderer.render({});
  assert.equal(f.nodes.join(','),'root,off,off2,near','exports always draw full map');
});
test('large offscreen forest is evaluated but not painted',()=>{
  const root={id:'root',children:Array.from({length:10000},(_,i)=>({id:'n'+i,children:[]}))};
  const positions={root:0};
  root.children.forEach((n,i)=>{positions[n.id]=i%100===0?50:5000;});
  const f=fixture(root,positions);
  f.change(true);
  assert.equal(f.app.renderer.fastCanvasStats.visited,10001);
  assert.equal(f.app.renderer.fastCanvasStats.painted,101);
  f.change(false);
  assert.equal(f.nodes.length,10001);
});

test('large-map auto mode respects explicit preferences and leaves export rendering complete',()=>{
 const f=fixture({id:'root',children:[]},{root:0},null);
 f.app.renderer.layout.nodeLayoutMap=new Map(Array.from({length:301},(_,i)=>[i,{}]));
 f.app.renderer.render();assert.equal(f.app.renderer.highPerformanceCanvas,true);assert.equal(f.app.renderer._nmFastToggle.checked,true);
 f.change(false);f.app.renderer.render();assert.equal(f.app.renderer.highPerformanceCanvas,false);assert.equal(f.saved.value,'false');
 const small=fixture({id:'root',children:[]},{root:0},null);small.app.renderer.layout.nodeLayoutMap=new Map([[1,{}]]);small.app.renderer.render();assert.equal(small.app.renderer.highPerformanceCanvas,false);
});

test('auto mode includes image-heavy workspaces and still respects a saved opt-out',()=>{
 const f=fixture({id:'root',children:[]},{root:0},null);f.app.renderer.state.images=new Array(301).fill({});
 f.app.renderer.render();assert.equal(f.app.renderer.highPerformanceCanvas,true);
 f.change(false);f.app.renderer.render();assert.equal(f.app.renderer.highPerformanceCanvas,false);
});
