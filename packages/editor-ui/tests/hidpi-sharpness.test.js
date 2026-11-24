'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../../..');
const renderers=[
  'apps/desktop-shared/editor/renderer.js',
  'apps/android/editor/renderer.js'
];

function loadRenderer(file){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const Renderer=vm.runInNewContext(source+'\nOrganicCanvasRenderer',{
    window:{innerWidth:1280,innerHeight:800,devicePixelRatio:1.5}
  });
  const renderer=Object.create(Renderer.prototype);
  renderer.camera={x:10.4,y:-3.2,zoom:1.5};
  renderer.dpr=1.5;
  return renderer;
}

test('live glyphs snap to device pixels and leave camera and authored points alone',()=>{
  for(const file of renderers){
    const renderer=loadRenderer(file);
    const camera={...renderer.camera};
    const idle=renderer.devicePoint(100.2,40.7);
    assert.equal(idle.x,100.2);
    assert.equal(idle.y,40.7);
    renderer._nmSnapGlyphs=true;
    const point=renderer.devicePoint(100.2,40.7);
    const zoom=renderer.camera.zoom,dpr=renderer.dpr;
    const deviceX=(point.x*zoom+renderer.camera.x)*dpr;
    const deviceY=(point.y*zoom+renderer.camera.y)*dpr;
    assert.ok(Math.abs(deviceX-Math.round(deviceX))<1e-6,file);
    assert.ok(Math.abs(deviceY-Math.round(deviceY))<1e-6,file);
    assert.ok(Math.abs(point.x-100.2)<=0.5/(zoom*dpr)+1e-9);
    assert.ok(Math.abs(point.y-40.7)<=0.5/(zoom*dpr)+1e-9);
    assert.deepEqual(renderer.camera,camera);
    const world=renderer.screenToWorld(renderer.worldToScreen(80,24).x,renderer.worldToScreen(80,24).y);
    assert.ok(Math.abs(world.x-80)<1e-9&&Math.abs(world.y-24)<1e-9);
    renderer._nmSnapGlyphs=false;
  }
});

test('label indent stays exact unless the live camera frame is snapping',()=>{
  for(const file of renderers){
    const renderer=loadRenderer(file);
    const calls=[];
    const ctx={
      fillText(text,x){calls.push(x);},
      measureText(text){return {width:String(text).length*8};},
      save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}
    };
    const node={text:'prima\nseconda',fontUnderline:true,labelAlign:'left',labelIndent:24};
    const metrics={lines:['prima','seconda'],x:100,y:50,textWidth:80,fontSize:16,lineHeight:20};
    renderer.drawIllustratedLabel(ctx,node,metrics);
    assert.equal(calls[1]-calls[0],24,file);
    renderer._nmSnapGlyphs=true;
    calls.length=0;
    renderer.drawIllustratedLabel(ctx,node,metrics);
    const zoom=renderer.camera.zoom,dpr=renderer.dpr;
    for(const x of calls){
      const device=(x*zoom+renderer.camera.x)*dpr;
      assert.ok(Math.abs(device-Math.round(device))<1e-6,file);
    }
  }
});

test('illustration bitmaps are rasterized from the viewBox, not the stored SVG',()=>{
  const media=fs.readFileSync(path.join(root,'packages/editor-ui/editor-shared/media-icon-core.js'),'utf8');
  const start=media.indexOf('function nm54SharpSvg(');
  const end=media.indexOf('function nm54IconUri(');
  const nm54SharpSvg=vm.runInNewContext(media.slice(start,end)+'\nnm54SharpSvg');
  const source='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0"/></svg>';
  const sharp=nm54SharpSvg(source);
  assert.match(sharp,/width="256"/);
  assert.match(sharp,/height="256"/);
  assert.match(sharp,/viewBox="0 0 24 24"/);
  assert.doesNotMatch(sharp,/width="24"/);
  assert.equal(source.includes('width="24"'),true);
  const bare='<svg width="24" height="24"><rect width="24" height="24"/></svg>';
  assert.equal(nm54SharpSvg(bare),bare);
  assert.match(media,/nm54SharpSvg\(nm54SanitizeSvg\(illustration\.svg\)\)/);
  assert.doesNotMatch(media,/encodeURIComponent\(illustration\.svg\)/);
});

test('minimap backing scale matches its bitmap at fractional density',()=>{
  const paint=fs.readFileSync(path.join(root,'packages/editor-ui/navigation-experience-render.js'),'utf8');
  assert.match(paint,/ctx\.setTransform\(bufferW\/width,0,0,bufferH\/height,0,0\)/);
  assert.match(paint,/imageSmoothingQuality='high'/);
  for(const file of renderers){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(source,/imageSmoothingQuality='high'/);
    assert.match(source,/this\._nmSnapGlyphs=!customCtx && !customTransform/);
  }
});
