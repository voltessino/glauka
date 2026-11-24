'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const variants=[
  {name:'Windows/macOS shared',file:'apps/desktop-shared/editor/renderer.js',budget:36000000},
  {name:'Android WebView',file:'apps/android/editor/renderer.js',budget:8000000}
];
function createRenderer(variant,viewport={width:320,height:568,dpr:3}){
  const source=fs.readFileSync(path.resolve(__dirname,'../../../',variant.file),'utf8');
  const win={innerWidth:viewport.width,innerHeight:viewport.height,devicePixelRatio:viewport.dpr};
  const Renderer=vm.runInNewContext(source+'\nOrganicCanvasRenderer',{window:win});
  const renderer=Object.create(Renderer.prototype);
  let allocations=0;
  const canvas={_width:0,_height:0,
    get width(){return this._width},set width(v){allocations++;this._width=v},
    get height(){return this._height},set height(v){allocations++;this._height=v}};
  renderer.canvas=canvas;
  return {renderer,canvas,win,get allocations(){return allocations}};
}
test('desktop retains physical DPI on HiDPI Windows displays rather than stretching text',()=>{
  const variant=variants[0];
  for(const [width,height,dpr] of [
    [1920,1080,1.25],  // Windows 125%
    [1920,1080,1.5],   // Windows 150%
    [2560,1440,2],     // 1440p at 200%
    [2560,1440,2.5],   // 1440p at 250%
    [3840,2160,2]      // 4K at 200%: ~33.2M physical pixels
  ]){
    const {renderer,canvas}=createRenderer(variant,{width,height,dpr});
    renderer.resize();
    assert.equal(renderer.dpr,dpr,`Physical DPR lost for ${width}x${height}@${dpr}`);
    assert.equal(canvas.width,Math.floor(width*dpr));
    assert.equal(canvas.height,Math.floor(height*dpr));
  }
});
test('desktop falls back to bounded pixel budget on low-memory hardware',()=>{
  const variant=variants[0];
  const {renderer,canvas,win}=createRenderer(variant,{width:3840,height:2160,dpr:2});
  win.navigator={deviceMemory:4};
  renderer.resize();
  assert.ok(canvas.width*canvas.height<=24000000);
  assert.ok(renderer.dpr>1&&renderer.dpr<2);
  win.navigator.deviceMemory=16;
  renderer.resize();
  assert.equal(renderer.dpr,2);
  assert.equal(canvas.width,7680);
  assert.equal(canvas.height,4320);
});

for(const variant of variants){
  test(variant.name+' small screen and laptop preserve preferred DPR',()=>{
    const {renderer,canvas,win}=createRenderer(variant);
    renderer.resize();
    assert.equal(renderer.dpr,3);
    assert.equal(canvas.width,960);
    assert.equal(canvas.height,1704);
    win.innerWidth=1280;win.innerHeight=720;win.devicePixelRatio=1.25;
    renderer.resize();
    assert.equal(renderer.dpr,1.25);
    assert.equal(canvas.width,1600);
    assert.equal(canvas.height,900);
  });
  test(variant.name+' 8K/4K screen never exceeds pixel or texture budget',()=>{
    const {renderer,canvas,win}=createRenderer(variant,{width:7680,height:4320,dpr:4});
    renderer.resize();
    assert.ok(canvas.width*canvas.height<=variant.budget);
    assert.ok(canvas.width<=8192&&canvas.height<=8192);
    assert.ok(Number.isFinite(renderer.dpr)&&renderer.dpr>0&&renderer.dpr<=win.devicePixelRatio);
    assert.ok(canvas.width>0&&canvas.height>0);
    win.innerWidth=3840;win.innerHeight=2160;renderer.resize();
    assert.ok(canvas.width*canvas.height<=variant.budget);
    assert.ok(renderer.dpr<=win.devicePixelRatio);
  });
  test(variant.name+' resize is idempotent, but orientation and DPR changes reallocate',()=>{
    const context=createRenderer(variant,{width:390,height:844,dpr:3});
    const {renderer,canvas,win}=context;
    renderer.resize();const initial=context.allocations;
    for(let i=0;i<1000;i++)renderer.resize();
    assert.equal(context.allocations,initial,'no canvas context resets for same dimensions');
    win.innerWidth=844;win.innerHeight=390;renderer.resize();
    assert.equal(canvas.width,2532);assert.equal(canvas.height,1170);
    assert.ok(context.allocations>initial);
    const rotated=context.allocations;
    win.devicePixelRatio=1;renderer.resize();
    assert.equal(canvas.width,844);assert.equal(canvas.height,390);
    assert.ok(context.allocations>rotated);
    const changed=context.allocations;
    renderer.resize();assert.equal(context.allocations,changed);
  });
  test(variant.name+' invalid viewport and DPR never allocate zero or NaN',()=>{
    const {renderer,canvas,win}=createRenderer(variant,{width:0,height:0,dpr:NaN});
    renderer.resize();assert.equal(canvas.width,1);assert.equal(canvas.height,1);
    assert.equal(renderer.dpr,1);
    win.innerWidth=-300;win.innerHeight=Infinity;win.devicePixelRatio=-5;
    renderer.resize();assert.equal(canvas.width,1);assert.equal(canvas.height,1);
    assert.equal(renderer.dpr,1);
  });
  test(variant.name+' redraw uses effective backing DPR, not physical device DPR',()=>{
    const {renderer,canvas}=createRenderer(variant,{width:7680,height:4320,dpr:4});
    renderer.resize();
    const calls=[];
    const ctx={setTransform:(...a)=>calls.push(['reset',...a]),
      clearRect:(...a)=>calls.push(['clear',...a]),
      save:()=>calls.push(['save']),restore:()=>calls.push(['restore']),
      scale:(...a)=>calls.push(['scale',...a])};
    renderer.ctx=ctx;renderer.state={root:null};renderer.drawAmbientGrid=()=>{};
    renderer.render();
    assert.deepEqual(calls.filter(c=>c[0]==='scale'),[['scale',renderer.dpr,renderer.dpr]]);
    assert.deepEqual(calls.find(c=>c[0]==='clear'),['clear',0,0,canvas.width,canvas.height]);
  });
}

for(const variant of variants){
  test(variant.name+' 2,000 deterministic resize and DPR stress cases',()=>{
    const {renderer,canvas,win}=createRenderer(variant);
    let seed=0x78cafe;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    for(let i=0;i<2000;i++){
      win.innerWidth=320+Math.floor(random()*7361);
      win.innerHeight=320+Math.floor(random()*4001);
      win.devicePixelRatio=0.5+random()*4;
      renderer.resize();
      assert.ok(canvas.width>0&&canvas.height>0);
      assert.ok(canvas.width*canvas.height<=variant.budget);
      assert.ok(canvas.width<=8192&&canvas.height<=8192);
      assert.ok(renderer.dpr>0&&renderer.dpr<=win.devicePixelRatio);
    }
  });
}

test('fractional Windows scaling fills the bitmap on one device-pixel scale',()=>{
  for(const variant of variants){
    const {renderer,canvas}=createRenderer(variant,{width:390,height:844,dpr:1.25});
    renderer.camera={x:12,y:8,zoom:1};
    const camera={...renderer.camera};
    renderer.resize();
    assert.ok(renderer.dpr>0&&renderer.dpr<1.25,variant.name);
    assert.equal(canvas.width,Math.round(390*renderer.dpr));
    assert.equal(canvas.height,Math.round(844*renderer.dpr));
    assert.ok(Math.abs(canvas.width-390*renderer.dpr)<0.51);
    assert.ok(Math.abs(canvas.height-844*renderer.dpr)<0.51);
    assert.ok(canvas.width*canvas.height<=variant.budget);
    assert.deepEqual(renderer.camera,camera);
  }
});
test('desktop overview text uses bounded 2x backing and actual CSS canvas size without changing camera',()=>{
 const {renderer,canvas,win}=createRenderer(variants[0],{width:1440,height:900,dpr:1.25});
 renderer.camera={x:145,y:92,zoom:.43};const camera={...renderer.camera};
 canvas.clientWidth=900;canvas.clientHeight=600;
 renderer.resize();assert.equal(renderer.dpr,2);assert.equal(canvas.width,1800);assert.equal(canvas.height,1200);assert.deepEqual(renderer.camera,camera);
 canvas.clientWidth=1280;canvas.clientHeight=800;renderer.resize();assert.equal(canvas.width,2560);assert.equal(canvas.height,1600);assert.deepEqual(renderer.camera,camera);
 renderer.camera.zoom=1;renderer.resize();assert.equal(renderer.dpr,1.25);assert.equal(canvas.width,1600);
 renderer.camera.zoom=.43;canvas.clientWidth=7680;canvas.clientHeight=4320;renderer.resize();assert.ok(canvas.width*canvas.height<=variants[0].budget);
});
