const {test}=require('node:test');
const assert=require('node:assert/strict');
new Function(require('./helpers/compose-graphics.cjs')())();
const geometry=()=>({startX:20,startY:20,cp1x:32,cp1y:20,cp2x:38,cp2y:820,endX:50,endY:820,startWidth:18,endWidth:4});
test('adaptive round ribbon retains steep curves without unbounded tessellation',()=>{
 const d=NeuroMapGraphics.ribbonPath(geometry());assert.ok(!/NaN|Infinity/.test(d));assert.ok(d.includes(' A '));assert.ok(d.length<16000,'Long straight portions must not generate hundreds of redundant sections');
});
test('a straight taper has constant complexity regardless of length',()=>{
 for(const endX of [40,400,40000]){const g={...geometry(),endX,endY:20,cp1x:endX*.4,cp2x:endX*.6,cp1y:20,cp2y:20};assert.ok(NeuroMapGraphics.ribbonPath(g).length<800);}
});
test('cached canvas geometry is reused and invalidated by width or control-point changes',()=>{
 global.Path2D=class{constructor(path){this.path=path;}};
 const g=geometry(),node={},first=NeuroMapGraphics.ribbonShape(g,node);assert.equal(NeuroMapGraphics.ribbonShape({...g},node),first);
 g.endWidth=7;const wider=NeuroMapGraphics.ribbonShape(g,node);assert.notEqual(wider,first);assert.notEqual(wider.path,first.path);
 g.cp1x+=4;assert.notEqual(NeuroMapGraphics.ribbonShape(g,node),wider);
});
