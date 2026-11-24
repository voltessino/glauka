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
      return sel==='script[data-neuromap-studio-tools]'?scripts[0]||null:null;
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
    fs.readFileSync(path.join(__dirname,'../studio-tools-ensure.js'),'utf8'),
    {globalThis:root,document:doc,Error});
  return {root,scripts};
}

test('Studio tools ensure injects one Android script and reuses readiness',async()=>{
  const {root,scripts}=load(true);
  const pending=root.NeuroMapStudioToolsEnsure.ensure();
  assert.equal(scripts.length,1);
  assert.equal(scripts[0].src,'/assets/studio-tools.js');
  root.NeuroMapWikiUI={};
  root.NeuroMapKnowledgeDBUI={};
  root.NeuroMapDashboardUI82={};
  scripts[0].listeners.load();
  assert.equal(await pending,true);
  assert.equal(await root.NeuroMapStudioToolsEnsure.ensure(),true);
  assert.equal(scripts.length,1);
});
