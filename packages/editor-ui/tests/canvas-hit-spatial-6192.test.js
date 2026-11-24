'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/fast-canvas-spatial.js'),'utf8');
function setup(nodes,positions,images=[],relations=[]) {
  const root={id:'root',text:'Root',children:nodes};
  const state={root,images,relationships:relations,findNode(id){
    return id==='root'?root:nodes.find(n=>n.id===id)||null;
  }};
  const metrics=new Map(positions);
  class Renderer {
    constructor() {
      this.state=state;this.highPerformanceCanvas=false;
      this.layout={nodeLayoutMap:metrics,getLayout:id=>metrics.get(id),
        computeLayout(){return true;},recomputeDescendantsLayout(){return true;}};
    }
    drawNode(){}drawTaperingBranch(){}render(){return true;}
    screenToWorld(x,y){return {x,y};}
    resolveImageWorldRect(image){return image.rect;}
  }
  class App {
    constructor(){this.renderer=new Renderer();this.state=state;this.layout=this.renderer.layout;}
    bindUI(){}imageHandleHit(){return this.handle||null;}
    v5RelationHit(){return relations.length?{type:'relationship',item:relations[0]}:null;}
    findHit(x,y){
      if(this.handle)return this.handle;
      for(let i=images.length-1;i>=0;i--){let a=images[i];if(a.zLayer==='back')continue;
        let b=a.rect;if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return{type:'image',item:a};}
      let hit=null;
      for(const [id,m] of metrics)if(x>=m.x-m.width/2&&x<=m.x+m.width/2&&
        y>=m.y-m.height/2&&y<=m.y+m.height/2)hit=state.findNode(id);
      if(hit)return{type:'node',item:hit};
      for(let i=images.length-1;i>=0;i--){let a=images[i];if(a.zLayer!=='back')continue;
        let b=a.rect;if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return{type:'image',item:a};}
      return this.v5RelationHit(x,y);
    }
  }
  const window={};vm.runInNewContext(script,{window});
  window.NeuroMapSpatialCanvas.install(App,Renderer);
  const app=new App();app.bindUI();
  return {app,spatial:window.NeuroMapSpatialCanvas};
}
test('default classic path is intact and indexed mode preserves overlapping last-hit ordering',()=>{
 const a={id:'a',children:[]},b={id:'b',children:[]};
 const f=setup([a,b],[['root',{x:-100,y:0,width:40,height:40}],['a',{x:10,y:10,width:80,height:80}],['b',{x:15,y:15,width:50,height:50}]]);
 assert.equal(f.app.findHit(20,20).item.id,'b');
 f.app.renderer.highPerformanceCanvas=true;
 assert.equal(f.app.findHit(20,20).item.id,'b');
 assert.equal(f.app.findHit(80,80),null);
});
test('front images, handles, background images and relationships preserve existing priority',()=>{
 const a={id:'a',children:[]};
 const front={id:'front',zLayer:'front',rect:{x:0,y:0,w:50,h:50}};
 const back={id:'back',zLayer:'back',rect:{x:0,y:0,w:50,h:50}};
 const relation={id:'rel'};
 const f=setup([a],[['a',{x:10,y:10,width:30,height:30}]],[back,front],[relation]);
 f.app.renderer.highPerformanceCanvas=true;
 assert.equal(f.app.findHit(10,10).item.id,'front');
 f.app.handle={type:'image-handle',item:front};
 assert.equal(f.app.findHit(10,10).type,'image-handle');
 f.app.handle=null;
 front.rect.x=100;
 assert.equal(f.app.findHit(10,10).item.id,'a');
 f.app.layout.nodeLayoutMap.get('a').x=100;
 f.app.layout.computeLayout();assert.equal(f.app.findHit(10,10).item.id,'back');
 back.rect.x=200;
 assert.equal(f.app.findHit(10,10).item.id,'rel');
});
test('cache reuses across pointer hits but invalidates on layout and subtree changes',()=>{
 const nodes=[{id:'a',children:[]},{id:'b',children:[]}];
 const f=setup(nodes,[['a',{x:100,y:100,width:40,height:40}],['b',{x:200,y:100,width:40,height:40}]]);
 f.app.renderer.highPerformanceCanvas=true;
 assert.equal(f.app.findHit(100,100).item.id,'a');
 const saved=f.app._nmSpatialHitIndex;
 f.app.findHit(200,100);assert.strictEqual(f.app._nmSpatialHitIndex,saved);
 f.app.layout.nodeLayoutMap.get('a').x=500;
 f.app.layout.recomputeDescendantsLayout();
 assert.equal(f.app.findHit(500,100).item.id,'a');
 assert.notStrictEqual(f.app._nmSpatialHitIndex,saved);
});
test('large map indexed hit exactly matches classic selection over randomized probes',()=>{
 const nodes=[],positions=[];
 for(let i=0;i<20000;i++){
  nodes.push({id:'n'+i,children:[]});
  positions.push(['n'+i,{x:(i%200)*120,y:Math.floor(i/200)*95,width:80,height:44}]);
 }
 const f=setup(nodes,positions);
 let seed=26;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const probes=Array.from({length:250},()=>[(random()*200)*120,(random()*100)*95]);
 const expected=probes.map(([x,y])=>f.app.findHit(x,y)?.item.id||null);
 f.app.renderer.highPerformanceCanvas=true;
 const result=probes.map(([x,y])=>f.app.findHit(x,y)?.item.id||null);
 assert.deepEqual(result,expected);
 assert.equal(f.app._nmSpatialHitIndex.table.items.length,20000);
});

test('pointer probes use the logical ID index, not a full tree search per hit',()=>{
 const nodes=Array.from({length:2500},(_,i)=>({id:'node-'+i,children:[]}));
 const positions=nodes.map((n,i)=>[n.id,{x:(i%100)*60,y:Math.floor(i/100)*55,width:40,height:30}]);
 const f=setup(nodes,positions);
 let slowFindCalls=0;
 const original=f.app.state.findNode;
 f.app.state.findNode=function(id){slowFindCalls++;return original.call(this,id)};
 f.app.renderer.highPerformanceCanvas=true;
 for(let i=0;i<100;i++){
  const selected=f.app.findHit((i%100)*60,Math.floor(i/100)*55);
  assert.equal(selected?.item?.id,'node-'+i);
 }
 assert.equal(slowFindCalls,0,'no O(n) tree searches during cached pointer hit testing');
 assert.equal(f.app._nmSpatialHitIndex.nodeById.size,2501);
});
test('continuation visual aliases always use the existing view-aware picker',()=>{
 const child={id:'a',side:'right',children:[]};
 const f=setup([child],[['a',{x:100,y:100,width:50,height:30}]]);
 f.app.layout.presentationRoot={id:'visual-root',children:[]};
 f.app.renderer.highPerformanceCanvas=true;
 assert.equal(f.app.findHit(100,100).item.id,'a');
 assert.equal(f.app._nmSpatialHitIndex,undefined,
   'continuation mode must not bypass the legacy alias-aware picker');
});
