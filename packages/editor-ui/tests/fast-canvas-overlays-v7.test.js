'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const directory=path.join(__dirname,'../../../apps/desktop-shared/editor');
const load=name=>fs.readFileSync(path.join(directory,name),'utf8');
const rendererSource=load('renderer.js'),fastSource=load('fast-canvas.js'),overlaySource=load('fast-canvas-overlays.js');
function fixture({images=[],relationships=[],zoom=1,enabled=true}={}){
 const calls=[],imageLoads=[];
 const ctx=new Proxy({font:'16px system-ui',globalAlpha:1,
  measureText(value){calls.push('measureText');return {width:String(value).length*9}}},
  {get(target,key){return key in target?target[key]:(...args)=>{calls.push(String(key));}},
   set(target,key,value){target[key]=value;return true}});
 const global={
  innerWidth:1000,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>100},document:{documentElement:{lang:'en'}},
  localStorage:{getItem:()=>null,setItem:()=>{}}
 };
 const Renderer=new Function('window','imageCache','ColorUtils',
   rendererSource+'\nreturn OrganicCanvasRenderer;')(global,new Map(),
   {rgba:color=>color});
 // Keep actual image+relationship drawing, but avoid unrelated grid and node
 // surfaces in these layer-specific assertions.
 for(const method of ['drawAmbientGrid','drawThresholdGuides',
  'drawBoundariesRecursive','drawTaperingBranch','drawSummariesRecursive','drawNode'])
  Renderer.prototype[method]=function(){};
 const overlay={window:global};
 vm.runInNewContext(fastSource,overlay);vm.runInNewContext(overlaySource,overlay);
 class App{bindUI(){}}
 global.NeuroMapFastCanvas.install(App,Renderer);
 global.NeuroMapFastOverlayCanvas.install(Renderer);
 const layout=new Map([['root',{x:0,y:0,width:100,height:40}]]);
 const state={root:{id:'root',children:[]},images,relationships,strokeScale:1,
  selectedImageId:null,hoveredImageId:null,selectedRelationshipId:null,
  hoveredRelationshipId:null};
 const canvas={clientWidth:1000,clientHeight:800,getContext:()=>ctx};
 const renderer=new Renderer(canvas,{getLayout:id=>layout.get(id)},state);
 renderer.camera={x:500,y:400,zoom};
 renderer.highPerformanceCanvas=enabled;
 renderer.fastCanvasStatus={textContent:''};
 renderer.getOrLoadImage=src=>{imageLoads.push(src);return {complete:true}};
 return {renderer,state,calls,ctx,layout,global,imageLoads};
}
function image(id,x,y,zLayer='front'){
 return {id,src:'local:'+id,mode:'free',zLayer,
  worldPos:{x,y},width:80,height:60,aspectLocked:true};
}
function relation(id,fromId,toId,label='rel'){
 return {id,fromId,toId,label,color:'#ff00ff'};
}
test('default classic mode draws every valid image and relation, even offscreen',()=>{
 const f=fixture({images:[image('near',0,0),image('far',15000,0)],
  relationships:[relation('outside','a','b')] ,enabled:false});
 f.layout.set('a',{x:10000,y:300});f.layout.set('b',{x:10500,y:310});
 f.renderer.render();
 assert.equal(f.calls.filter(x=>x==='drawImage').length,2);
 assert.equal(f.calls.filter(x=>x==='bezierCurveTo').length,1);
 assert.equal(f.renderer.fastCanvasOverlayStats,undefined);
});
test('opt-in Fast Canvas skips 9,950 offscreen images but paints all visible layers',()=>{
 const images=Array.from({length:10000},(_,i)=>
  image('im'+i,i%200===0?10:22000+i*20,0,i%3?'front':'back'));
 const f=fixture({images});
 f.renderer.render();
 assert.equal(f.renderer.fastCanvasOverlayStats.imagesEligible,10000);
 assert.equal(f.renderer.fastCanvasOverlayStats.imagesPainted,50);
 assert.equal(f.calls.filter(x=>x==='drawImage').length,50);
 assert.equal(f.imageLoads.length,50);
 assert.match(f.renderer.fastCanvasStatus.textContent,/50\/10000 images/);
});
test('offscreen relationships retain hit geometry but skip expensive paint',()=>{
 const links=Array.from({length:3500},(_,i)=>relation('rel'+i,'x'+i,'y'+i,'→ 标签 علاقة'));
 const f=fixture({relationships:links});
 for(let i=0;i<links.length;i++){
  const x=i%70===0?0:20000+i;
  f.layout.set('x'+i,{x,y:0});f.layout.set('y'+i,{x:x+35,y:40});
 }
 f.renderer.render();
 assert.equal(f.renderer.fastCanvasOverlayStats.relationshipsEligible,3500);
 assert.equal(f.renderer.fastCanvasOverlayStats.relationshipsPainted,50);
 assert.equal(f.calls.filter(x=>x==='bezierCurveTo').length,50);
 assert.ok(links.every(rel=>rel._runtimeCurve&&Number.isFinite(rel._runtimeCurve.labelX)));
 assert.match(f.renderer.fastCanvasStatus.textContent,/50\/3500 links/);
});
test('selected and hovered offscreen images and links never disappear',()=>{
 const f=fixture({images:[image('off-image',11000,100),image('hover-image',12000,100)],
  relationships:[relation('selected','a','b'),relation('hover','c','d')]});
 for(const id of ['a','b','c','d'])f.layout.set(id,{x:19000+(id.charCodeAt(0)-97)*45,y:200});
 f.state.selectedImageId='off-image';f.state.hoveredImageId='hover-image';
 f.state.selectedRelationshipId='selected';f.state.hoveredRelationshipId='hover';
 f.renderer.render();
 assert.equal(f.renderer.fastCanvasOverlayStats.imagesPainted,2);
 assert.equal(f.renderer.fastCanvasOverlayStats.relationshipsPainted,2);
 assert.equal(f.calls.filter(x=>x==='drawImage').length,2);
 assert.equal(f.calls.filter(x=>x==='bezierCurveTo').length,2);
});
test('export contexts and explicit export transforms never activate overlay culling',()=>{
 const f=fixture({images:[image('outside',10000,50)],
  relationships:[relation('outside-rel','a','b')]});
 f.layout.set('a',{x:18000,y:10});f.layout.set('b',{x:19000,y:10});
 f.renderer.render();
 assert.equal(f.renderer.fastCanvasOverlayStats.imagesPainted,0);
 const saved=f.renderer.fastCanvasOverlayStats;
 f.calls.length=0;
 f.renderer.render(f.ctx,{scale:1,tx:0,ty:0});
 assert.equal(f.calls.filter(x=>x==='drawImage').length,1);
 assert.equal(f.calls.filter(x=>x==='bezierCurveTo').length,1);
 f.calls.length=0;
 f.renderer.render(null,{scale:1,tx:0,ty:0});
 assert.equal(f.calls.filter(x=>x==='drawImage').length,1);
 assert.equal(f.calls.filter(x=>x==='bezierCurveTo').length,1);
 assert.deepEqual(f.renderer.fastCanvasOverlayStats,saved);
});
test('curved links and very wide offscreen labels are conservatively retained',()=>{
 const f=fixture({relationships:[relation('curve','a','b'),relation('wide','c','d','汉'.repeat(5000))]});
 f.layout.set('a',{x:-700,y:-250});f.layout.set('b',{x:700,y:-250});
 // The label is huge and reaches into the viewport even if every Bezier
 // control point is well to the left.
 f.layout.set('c',{x:-20000,y:0});f.layout.set('d',{x:-19000,y:0});
 f.renderer.render();
 assert.equal(f.renderer.fastCanvasOverlayStats.relationshipsPainted,2);
 assert.equal(f.calls.filter(x=>x==='bezierCurveTo').length,2);
});
test('enabled fast mode leaves map contents and image attachment coordinates intact',()=>{
 const images=[image('attached',10000,0)];
 images[0].mode='attached';images[0].attachedNodeId='root';
 images[0].offset={dx:8000,dy:0};
 const links=[relation('edge','root','other','日本語 – العربية')];
 const f=fixture({images,relationships:links});
 f.layout.set('other',{x:9000,y:0});
 const original=JSON.stringify({images:f.state.images,relationships:f.state.relationships});
 f.renderer.render();
 assert.equal(f.renderer.fastCanvasOverlayStats.imagesPainted,0);
 assert.equal(f.renderer.fastCanvasOverlayStats.relationshipsPainted,1,
  'a long connector crossing the visible area must remain');
 assert.equal(JSON.stringify({images:f.state.images,
  relationships:f.state.relationships.map(({_runtimeCurve,...r})=>r)}),original);
});

test('12,000 deterministic Bezier cases never cull a curve intersecting the viewport',()=>{
 const f=fixture();
 const check=f.global.NeuroMapFastOverlayCanvas.curveVisible;
 let seed=291712;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 let inside=0,discarded=0;
 for(let i=0;i<12000;i++){
  const curve={
   x1:rnd()*8000-4000,y1:rnd()*6500-3250,
   x2:rnd()*8000-4000,y2:rnd()*6500-3250,
   cp1x:rnd()*11000-5500,cp1y:rnd()*9000-4500,
   cp2x:rnd()*11000-5500,cp2y:rnd()*9000-4500,
   labelX:rnd()*8000-4000,labelY:rnd()*6500-3250
  };
  f.renderer._nmFastViewport={minX:-500,maxX:500,minY:-400,maxY:400};
  let touches=false;
  for(let j=0;j<=80;j++){
   const t=j/80,u=1-t;
   const x=u*u*u*curve.x1+3*u*u*t*curve.cp1x+
     3*u*t*t*curve.cp2x+t*t*t*curve.x2;
   const y=u*u*u*curve.y1+3*u*u*t*curve.cp1y+
     3*u*t*t*curve.cp2y+t*t*t*curve.y2;
   if(x>=-500&&x<=500&&y>=-400&&y<=400){touches=true;break;}
  }
  const paint=check(curve,{id:'rel'+i,label:'العربية · 中文'},f.renderer);
  if(touches){inside++;assert.equal(paint,true,'visible Bezier was discarded: '+i);}
  if(!paint)discarded++;
 }
 assert.ok(inside>1000);
 assert.ok(discarded>1500,'offscreen curves must actually be skipped');
});
test('10,000 sampled rectangles preserve every visible image at small and large zoom',()=>{
 const f=fixture(),check=f.global.NeuroMapFastOverlayCanvas.imageVisible;
 let seed=19812;
 const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const zoom of [.1,.25,1,2,4]){
  f.renderer.camera.zoom=zoom;
  f.renderer._nmFastViewport={minX:-500/zoom,maxX:500/zoom,
   minY:-400/zoom,maxY:400/zoom};
  let visible=0;
  for(let i=0;i<2000;i++){
   const rect={x:rnd()*16000-8000,y:rnd()*12000-6000,
     w:30+rnd()*400,h:20+rnd()*350};
   const overlap=rect.x<=f.renderer._nmFastViewport.maxX &&
    rect.x+rect.w>=f.renderer._nmFastViewport.minX &&
    rect.y<=f.renderer._nmFastViewport.maxY &&
    rect.y+rect.h>=f.renderer._nmFastViewport.minY;
   if(overlap){visible++;assert.equal(check(rect,{id:'x'+i},f.renderer),true);}
  }
  assert.ok(visible>0);
 }
});
test('main build manifest loads the optimizer once and installs after spatial culling',()=>{
 const startup=load('startup.js'),manifest=JSON.parse(load('sources.json'));
 assert.equal(manifest.filter(x=>x==='fast-canvas-overlays.js').length,1);
 assert.ok(manifest.indexOf('fast-canvas-spatial.js')<
  manifest.indexOf('fast-canvas-overlays.js'));
 assert.match(startup,/NeuroMapSpatialCanvas.install\(NeuroMapApp,OrganicCanvasRenderer\);\s*NeuroMapFastOverlayCanvas.install\(OrganicCanvasRenderer\)/);
 const renderer=load('renderer.js');
 assert.ok(renderer.includes('!this._nmFastAuxShouldPaintImage(rect,imgItem)'));
 assert.ok(renderer.includes('!this._nmFastAuxShouldPaintRelationship(curve,rel)'));
});
