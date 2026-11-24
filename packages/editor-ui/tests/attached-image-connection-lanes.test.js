const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const file of ['apps/desktop-shared/editor/renderer.js','apps/android/editor/renderer.js']){
 function fixture(dir=1){
  const Renderer=vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../..',file),'utf8')+'\nOrganicCanvasRenderer',{});
  const parent={id:'parent',side:dir===1?'right':'left'},child={id:'image-child',side:parent.side};
  const p={depth:1,x:0,y:0,width:180,height:38,attachOutX:dir*90,attachOutY:17,_nmOccupiedLeft:90,_nmOccupiedRight:90};
  const c={x:dir*330,y:-130,width:200,height:38,attachInX:dir*230,attachInY:-113,attachOutX:dir*430,attachOutY:-113,depth:2};
  const renderer=Object.create(Renderer.prototype);renderer.state={branchStyle:'buzan',strokeScale:1.5};renderer.layout={levelGapX:30,getLayout:id=>id==='parent'?p:c};
  return {renderer,parent,child,p,c};
 }
 for(const dir of [-1,1])test(file+' keeps an image-displaced sibling curve outside neighbouring labels on side '+dir,()=>{
  const {renderer,parent,child,c}=fixture(dir),g=renderer.computeBranchGeometry(parent,child,0,5);
  assert.ok(dir*g.endX<120);assert.equal(g.underlineEndX,c.attachOutX);
  // All intermediate centre points stay in the clear corridor, even though
  // the destination label/image has been pushed 110 px beyond other siblings.
  for(let i=1;i<200;i++){const t=i/200,u=1-t,x=u*u*u*g.startX+3*u*u*t*g.cp1x+3*u*t*t*g.cp2x+t*t*t*g.endX;assert.ok(dir*x<=120.001);}
 });
 test(file+' preserves single-child and root fan curves and never mutates layout positions',()=>{
  const {renderer,parent,child,p,c}=fixture();const before=JSON.stringify({p,c});
  assert.equal(renderer.computeBranchGeometry(parent,child,0,1).endX,c.attachInX);
  parent.side='root';assert.equal(renderer.computeBranchGeometry(parent,child,0,5).endX,c.attachInX);
  assert.equal(JSON.stringify({p,c}),before);
 });
}

// Include the filled stroke, not just the curve centre: short vertical gaps
// and thick styles can still graze a neighbour even with aligned centre lines.
for(const file of ['apps/desktop-shared/editor/renderer.js','apps/android/editor/renderer.js'])test(file+' keeps thick strokes clear across varying picture footprints and spacing',()=>{
 const Renderer=vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../..',file),'utf8')+'\nOrganicCanvasRenderer',{});
 let cases=0;
 for(const dir of [-1,1])for(const gap of [30,60,150])for(const dy of [51,80,160,400])for(const scale of [.5,1,1.5,3])for(const style of ['neon','buzan','thickparents'])for(const pictureOverhang of [40,130,300,800]){
  const p={depth:1,x:0,y:0,width:180,height:38,attachOutX:dir*90,attachOutY:17,_nmOccupiedLeft:90,_nmOccupiedRight:90};
  const c={x:dir*(90+gap+pictureOverhang+100),y:-dy,width:200,height:38,attachInX:dir*(90+gap+pictureOverhang),attachInY:-dy+17,attachOutX:dir*(90+gap+pictureOverhang+200),attachOutY:-dy+17,depth:2};
  const r=Object.create(Renderer.prototype);r.state={branchStyle:style,strokeScale:scale};r.layout={levelGapX:gap,getLayout:id=>id==='p'?p:c};
  const g=r.computeBranchGeometry({id:'p',side:dir>0?'right':'left'},{id:'c',side:dir>0?'right':'left'},0,5);
  assert.ok(Number.isFinite(g.startWidth)&&Number.isFinite(g.endWidth));
  const frontier=90+gap;
  for(let i=1;i<160;i++){
   const t=i/160,u=1-t,x=dir*(u*u*u*g.startX+3*u*u*t*g.cp1x+3*u*t*t*g.cp2x+t*t*t*g.endX),y=u*u*u*g.startY+3*u*u*t*g.cp1y+3*u*t*t*g.cp2y+t*t*t*g.endY;
   const radius=(g.startWidth*(1-t)+g.endWidth*t)/2;
   assert.ok(!(x+radius>frontier&&y+radius>-19&&y-radius<19),`stroke crosses neighbour: ${JSON.stringify({dir,gap,dy,scale,style,t})}`);
  }
  cases++;
 }
 assert.equal(cases,1152);
});
