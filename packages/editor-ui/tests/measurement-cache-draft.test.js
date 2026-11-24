'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(){
 let measured=0,fontLoaded;
 const env={document:{fonts:{addEventListener(name,fn){fontLoaded=fn}}}};env.globalThis=env;
 vm.runInNewContext(require('./helpers/compose-graphics.cjs')(),env);
 class Layout{
  getNodeTypography(){return{fontSize:18,fontWeight:400}}
  measureNode(node){measured++;const text=this.editingLabel?.id===node.id?this.editingLabel.text:node.text;return{width:text.length*5,height:20,lines:[text]}}
 }
 env.NeuroMapGraphics.installMeasurements(Layout);
 return{Layout,graphics:env.NeuroMapGraphics,measured:()=>measured,fontLoaded:()=>fontLoaded()};
}
test('measurement cache follows live draft text and restores canonical geometry on cancel',()=>{
 const {Layout,measured}=harness(),layout=new Layout(),node={id:'a',text:'Ciao'};
 assert.equal(layout.measureNode(node).width,20);
 layout.editingLabel={id:'a',text:'Long draft'};
 assert.equal(layout.measureNode(node).width,50);
 layout.editingLabel.text='Another draft';assert.equal(layout.measureNode(node).width,65);
 assert.equal(node.text,'Ciao');layout.editingLabel=null;
 assert.equal(layout.measureNode(node).width,20);assert.equal(measured(),4);
});
test('unrelated draft, returned-line mutation and completed font loads keep isolation',()=>{
 const {Layout,measured,fontLoaded}=harness(),layout=new Layout(),node={id:'a',text:'Ciao'};
 layout.measureNode(node);layout.editingLabel={id:'other',text:'Ignore'};
 const value=layout.measureNode(node);assert.equal(value.width,20);value.lines.push('Mutation');
 assert.deepEqual(Array.from(layout.measureNode(node).lines),['Ciao']);assert.equal(measured(),1);
 fontLoaded();layout.measureNode(node);assert.equal(measured(),2);
});
test('deep-copy metrics reuse immutable sizes, not node references or a live cache',()=>{
 const {Layout,graphics,measured}=harness(),live=new Layout(),source={id:'a',text:'Ciao',children:[]};
 live.measureNode(source,1);const copy={...source,children:[]},preview=new Layout();
 preview._nmMeasurements=graphics.copyMeasurements(live,source,copy);
 assert.notEqual(preview._nmMeasurements,live._nmMeasurements);
 assert.equal(preview._nmMeasurements.has(source),false);
 const value=preview.measureNode(copy,1);assert.equal(measured(),1);value.lines.push('Change');
 assert.deepEqual(Array.from(live.measureNode(source,1).lines),['Ciao']);
 copy.text='Changed';assert.equal(preview.measureNode(copy,1).width,35);assert.equal(source.text,'Ciao');
 assert.equal(measured(),2);
});
test('reused measurements invalidate for depth, wrapping, font load and active source draft',()=>{
 const {Layout,graphics,measured,fontLoaded}=harness(),live=new Layout(),source={id:'a',text:'Ciao',children:[]};
 live.measureNode(source,1);const copy={...source,children:[]},preview=new Layout();
 preview._nmMeasurements=graphics.copyMeasurements(live,source,copy);
 preview.measureNode(copy,2);assert.equal(measured(),2);
 copy.labelWrapChars=12;preview.measureNode(copy,2);assert.equal(measured(),3);
 fontLoaded();preview.measureNode(copy,2);assert.equal(measured(),4);
 live.editingLabel={id:'a',text:'Uncommitted'};live.measureNode(source,1);
 const another=new Layout(),canonical={...source,children:[]};another._nmMeasurements=graphics.copyMeasurements(live,source,canonical);
 assert.equal(another.measureNode(canonical,1).width,20);
 assert.equal(source.text,'Ciao');
});
test('uncached nodes and mismatched copies fall back without changing source entries',()=>{
 const {Layout,graphics}=harness(),live=new Layout(),source={id:'a',text:'Ciao',children:[]};
 assert.equal(graphics.copyMeasurements(live,source,{...source}),undefined);
 live.measureNode(source);
 assert.equal(graphics.copyMeasurements(live,source,{...source,id:'different'}),undefined);
 assert.equal(live._nmMeasurements.has(source),true);
});
