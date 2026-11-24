'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(mobile){
 const scripts=[];
 const doc={
  head:{append(node){scripts.push(node)}},
  querySelector(sel){
   return sel==='script[data-neuromap-mathjax]'?scripts[0]||null:null;
  },
  createElement(){
   return {
    dataset:{},listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn;},
    set src(value){this._src=value;},
    get src(){return this._src;}
   };
  }
 };
 const root={
  NeuroMapCreativeModules:{ui:{
   tr:(it)=>it,data:s=>s,button(){return {};},field(){return {input:{},label:{}};},
   dialog(){return {panel:{append(){}},valid:()=>true,close(){}};},addGraphic(){}
  }},
  document:doc,
  GlaukaMobile:!!mobile
 };
 vm.runInNewContext(
  fs.readFileSync(path.join(__dirname,'../creative-formulas.js'),'utf8'),
  {globalThis:root,document:doc,Error});
 return {root,scripts,doc};
}

test('ensureMathJax injects one desktop script and reuses the ready engine',async()=>{
 const {root,scripts}=load(false);
 const pending=root.NeuroMapCreativeModules.formulas.ensureMathJax();
 assert.equal(scripts.length,1);
 assert.equal(scripts[0].src,'/mathjax/mathjax.js');
 assert.equal(scripts[0].dataset.neuromapMathjax,'1');
 root.MathJax={startup:{promise:Promise.resolve('booted')},tex2svgPromise:async()=>({})};
 scripts[0].listeners.load();
 assert.equal(await pending,'booted');
 assert.equal(await root.NeuroMapCreativeModules.formulas.ensureMathJax(),'booted');
 assert.equal(scripts.length,1);
});

test('Android formula loader requests the staged assets path',async()=>{
 const {root,scripts}=load(true);
 const pending=root.NeuroMapCreativeModules.formulas.ensureMathJax();
 root.MathJax={startup:{promise:Promise.resolve(true)},tex2svgPromise:async()=>({})};
 scripts[0].listeners.load();
 await pending;
 assert.equal(scripts[0].src,'/assets/mathjax.js');
});
