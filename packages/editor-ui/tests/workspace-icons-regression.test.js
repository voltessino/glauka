'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const composeUiSource=require('./helpers/compose-ui-source.cjs');

test('icon mounting skips absent/previous buttons and keeps an accessible name',()=>{
 const source=composeUiSource('workspace-layout');
 const anchor='  function mountLists(app) {';
 assert.ok(source.includes(anchor),'workspace layout module changed');
 const withHook=source.replace(anchor,'  root.__testMountIcons=icons;\n'+anchor);
 const nodes=[];
 const button={
  dataset:{},title:'',textContent:'Flashcards',
  childNodes:[{nodeType:3,remove(){this.removed=true;}}],
  attrs:{},
  getAttribute(name){return this.attrs[name]||null;},
  setAttribute(name,value){this.attrs[name]=value;},
  querySelector(){return null;},
  prepend(svg){this.svg=svg;}
 };
 const document={
  // First toolbar control is intentionally missing.
  getElementById(id){return id==='btn-flashcards'?button:null;},
  createElementNS(uri,tag){
   const node={namespaceURI:uri,tag,attrs:{},classList:{add(){}},
    setAttribute(name,value){this.attrs[name]=value;},append(){}};
   nodes.push(node);return node;
  }
 };
 const root={};
 vm.runInNewContext(withHook,{globalThis:root,document});
 root.__testMountIcons();
 assert.equal(button.dataset.nmLineIcon,'1');
 assert.ok(button.svg);
 assert.equal(button.getAttribute('aria-label'),'Flashcards');
 const count=nodes.length;
 root.__testMountIcons();
 assert.equal(nodes.length,count,'mounting should be idempotent');
});
