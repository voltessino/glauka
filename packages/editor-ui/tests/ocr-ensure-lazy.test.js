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
      return sel==='script[data-neuromap-ocr-tools]'?scripts[0]||null:null;
    },
    createElement(){
      return {
        dataset:{},listeners:{},
        addEventListener(type,fn){this.listeners[type]=fn},
        set src(value){this._src=value},
        get src(){return this._src},
      };
    },
  };
  const root={document:doc,GlaukaMobile:!!mobile,GlaukaI18n:{pair:(it)=>it}};
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname,'../ocr-ensure.js'),'utf8'),
    {globalThis:root,document:doc,Error});
  return {root,scripts};
}

test('OCR ensure injects one Android script and reuses the ready UI',async()=>{
  const {root,scripts}=load(true);
  const pending=root.NeuroMapOCREnsure.ensure();
  assert.equal(scripts.length,1);
  assert.equal(scripts[0].src,'/assets/ocr-tools.js');
  root.NeuroMapOCR={analyze:async()=>{}};
  root.NeuroMapOCRUI={mount(){}};
  scripts[0].listeners.load();
  assert.equal(await pending,root.NeuroMapOCRUI);
  assert.equal(await root.NeuroMapOCREnsure.ensure(),root.NeuroMapOCRUI);
  assert.equal(scripts.length,1);
});

test('OCR ensure open mounts then opens the panel',async()=>{
  const {root,scripts}=load(false);
  let opened=0,mounted=0;
  const app={_nmOCR:null};
  const pending=root.NeuroMapOCREnsure.open(app);
  root.NeuroMapOCR={};
  root.NeuroMapOCRUI={mount(target){mounted++;target._nmOCR={open(){opened++}}}};
  scripts[0].listeners.load();
  await pending;
  assert.equal(scripts[0].src,'/ocr/ocr-tools.js');
  assert.equal(mounted,1);
  assert.equal(opened,1);
});
