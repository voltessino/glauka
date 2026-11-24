'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');
const root=path.resolve(__dirname,'../../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function painter(file){
 const source=read(file);
 const start=source.indexOf('      drawTaperingBranch(parent');
 const end=source.indexOf('      drawBoundariesRecursive(node)',start);
 assert.ok(start>=0&&end>start,file);
 return new Function('return class Probe{'+source.slice(start,end)+'}')();
}

function colors(file){
 const source=read(file);
 const start=source.indexOf('const childColor = child.color');
 const finish=source.indexOf('\n',source.indexOf('const baseColor',start));
 assert.ok(start>=0&&finish>start,file);
 return new Function('parent','child',source.slice(start,finish)+'\nreturn {childColor,baseColor};');
}

function context(){
 const stops=[];
 return {
  stops,
  globalAlpha:1,
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  fill(){},stroke(){},bezierCurveTo(){},quadraticCurveTo(){},setLineDash(){},
  createLinearGradient(){return {addColorStop(offset,color){
   if(typeof color!=='string'||color==='undefined')throw new TypeError('addColorStop '+color);
   stops.push(color);
  }}}
 };
}

function draw(file,style,parent,child){
 const Probe=painter(file);
 const ctx=context();
 const renderer=new Probe();
 renderer.state={branchStyle:style,strokeScale:1};
 renderer.ctx=ctx;
 renderer.navOpacity=()=>1;
 renderer.radialRibbon=()=>({points:[{x:0,y:0},{x:4,y:6}],start:{x:0,y:0},end:{x:12,y:8}});
 renderer.computeBranchGeometry=()=>({
  startX:10,startY:10,endX:40,endY:24,underlineEndX:48,underlineEndY:24,
  dir:1,startWidth:4,endWidth:2,cp1x:16,cp1y:10,cp2x:30,cp2y:24
 });
 renderer.drawTaperingBranch(parent,child,0,1);
 return ctx.stops;
}

for(const file of ['apps/desktop-shared/editor/renderer.js','apps/android/editor/renderer.js']){
 test(file+' draws a branch when the node color is missing',()=>{
  const blank={side:'root'};
  const child={id:'n',collapsed:true,children:[]};
  for(const style of ['radial','xmind8','elbow']){
   const stops=draw(file,style,blank,child);
   assert.deepEqual(stops,['#6366f1','#6366f1'],style);
  }
  const inherited=draw(file,'radial',{side:'left',color:'#112233'},{collapsed:true,children:[]});
  assert.deepEqual(inherited,['#112233','#112233']);
  const own=draw(file,'xmind8',{side:'left'},{color:'#00aa88',collapsed:true,children:[]});
  assert.deepEqual(own,['#00aa88','#00aa88']);
 });
}

for(const file of ['apps/desktop-shared/editor/io.js','apps/android/editor/io.js']){
 test(file+' never writes an undefined SVG branch color',()=>{
  const source=read(file);
  assert.match(source,/stop-color="\$\{escapeXml\(baseColor\)\}"/);
  assert.match(source,/stop-color="\$\{escapeXml\(childColor\)\}"/);
  assert.doesNotMatch(source,/stop-color="\$\{child\.color\}"/);
  const resolve=colors(file);
  const missing=resolve({side:'root'},{});
  assert.deepEqual(missing,{childColor:'#6366f1',baseColor:'#6366f1'});
  const fromParent=resolve({side:'left',color:'#112233'},{});
  assert.equal(fromParent.childColor,'#112233');
  assert.equal(fromParent.baseColor,'#112233');
  const svg='<stop offset="0%" stop-color="'+missing.baseColor+'" /><stop offset="100%" stop-color="'+missing.childColor+'" />';
  assert.equal(svg.includes('undefined'),false);
 });
}
