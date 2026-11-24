'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../../../apps/desktop-shared/editor');
const fast=fs.readFileSync(path.join(base,'fast-canvas.js'),'utf8');
const spatial=fs.readFileSync(path.join(base,'fast-canvas-spatial.js'),'utf8');
function fixture(root,metrics) {
 const prefs={},toggle={checked:false,addEventListener(type,cb){this[type]=cb;}};
 const stats={hidden:true,textContent:''};
 const window={innerWidth:1000,innerHeight:800,performance:{now:()=>10},
   localStorage:{getItem:k=>prefs[k]??null,setItem:(k,v)=>{prefs[k]=v}},
   document:{getElementById:id=>id==='nm-fast-canvas-toggle'?toggle:
     id==='nm-fast-canvas-stats'?stats:null}};
 vm.runInNewContext(fast+'\n'+spatial,{window});
 class R {
   constructor() {
     this.camera={x:500,y:400,zoom:1};this.canvas={clientWidth:1000,clientHeight:800};
     this.state={root,branchStyle:'neon'};
     this.layout={getLayout:id=>metrics.get(id),computeLayout(){return true;}};
     this.nodes=[];this.edges=[];
   }
   drawNode(node) {
     this.nodes.push(node.id);
     if(!node.collapsed)for(const c of node.children||[])this.drawNode(c);
   }
   drawTaperingBranch(parent,child) {
     this.edges.push(child.id);
     if(!child.collapsed)for(const c of child.children||[])this.drawTaperingBranch(child,c);
   }
   render() {
     this.nodes=[];this.edges=[];
     const right=root.children.filter(n=>n.side==='right');
     right.forEach((n,i)=>this.drawTaperingBranch(root,n,i,right.length));
     this.drawNode(root);
   }
 }
 class App{constructor(){this.renderer=new R();this.layout=this.renderer.layout;}
   bindUI(){}requestRender(){this.renderer.render();}}
 window.NeuroMapFastCanvas.install(App,R);
 window.NeuroMapSpatialCanvas.install(App,R);
 const app=new App();app.bindUI();
 return {app,metrics,toggle,stats,enable(){toggle.checked=true;toggle.change();}};
}
test('spatial buckets paint only onscreen nodes in a 10k map',()=>{
 const root={id:'root',children:Array.from({length:10000},(_,i)=>({id:'n'+i,side:'right',children:[]}))};
 const metric=new Map([['root',{x:0,y:0,width:100,height:50}]]);
 root.children.forEach((n,i)=>metric.set(n.id,{x:i%100===0?50:8000,y:0,width:70,height:30}));
 const f=fixture(root,metric);f.enable();
 assert.equal(f.app.renderer._nmSpatialIndex.nodes.items.length,10001);
 assert.equal(f.app.renderer.fastCanvasStats.painted,101);
 assert.equal(f.app.renderer.fastCanvasStats.paintedEdges,10000, 'long connections crossing the viewport must remain visible');
 const indexed=f.app.renderer._nmSpatialIndex;
 f.app.renderer.camera.x=-8000+500;f.app.renderer.render();
 assert.strictEqual(f.app.renderer._nmSpatialIndex,indexed);
 assert.equal(f.app.renderer.fastCanvasStats.painted,9900);
 assert.equal(f.app.renderer.fastCanvasStats.paintedEdges,9900);
 f.metrics.set('n1',{x:50,y:0,width:70,height:30});
 f.app.renderer.layout.computeLayout();f.app.renderer.render();
 assert.notStrictEqual(f.app.renderer._nmSpatialIndex,indexed);
});
test('indexed paint preserves deep visible descendants and full native export',()=>{
 const child={id:'near',side:'right',children:[]};
 const off={id:'far',side:'right',children:[child]};
 const root={id:'root',children:[off]};
 const m=new Map([['root',{x:0,y:0,width:80,height:35}],
   ['far',{x:4500,y:0,width:80,height:35}],
   ['near',{x:60,y:0,width:80,height:35}]]);
 const f=fixture(root,m);f.enable();
 assert.equal(f.app.renderer.nodes.join(','),'root,near');
 f.app.renderer.render({});
 assert.equal(f.app.renderer.nodes.join(','),'root,far,near');
 f.toggle.checked=false;f.toggle.change();
 assert.equal(f.app.renderer.nodes.join(','),'root,far,near');
});

test('offscreen subtrees avoid scanning and drawing their local edges',()=>{
 const far={id:'far',side:'right',children:Array.from({length:10000},(_,i)=>({id:'leaf'+i,side:'right',children:[]}))};
 const root={id:'root',children:[far]};
 const metric=new Map([['root',{x:0,y:0,width:90,height:40}],
   ['far',{x:8000,y:6000,width:80,height:35}]]);
 far.children.forEach((n,i)=>metric.set(n.id,{x:8100+i%10,y:6100,width:70,height:25}));
 const f=fixture(root,metric);f.enable();
 assert.equal(f.app.renderer.fastCanvasStats.painted,1);
 assert.equal(f.app.renderer.fastCanvasStats.paintedEdges,1, 'root-to-distant-subtree connector remains visible');
 assert.equal(f.app.renderer._nmSpatialIndex.nodes.items.length,10002);
 f.app.renderer.camera.x=-8000+500;f.app.renderer.camera.y=-6000+400;
 f.app.renderer.render();
 assert.ok(f.app.renderer.fastCanvasStats.painted>1);
 assert.ok(f.app.renderer.fastCanvasStats.paintedEdges>1);
});

test('long visible underlines survive both spatial and final branch culling',()=>{
 const child={id:'wide',side:'right',children:[]},root={id:'root',children:[child]};
 const metrics=new Map([['root',{x:4000,y:0,width:80,height:32}],['wide',{x:7000,y:0,width:5000,height:32,attachInX:4500,attachOutX:9500,attachInY:14,attachOutY:14}]]);
 const f=fixture(root,metrics);f.app.renderer.camera.x=-9400;f.enable();
 assert.deepEqual(f.app.renderer.edges,['wide']);
});
