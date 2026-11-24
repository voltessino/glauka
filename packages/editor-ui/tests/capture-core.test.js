'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../../../apps/desktop-shared/editor/capture-core.js');
test('local capture normalizes notes without running or fetching anything',()=>{
 const p=Core.propose({title:'  Kidney  ',text:' Evidence\n and references ',url:'https://example.org/papers?id=10'});
 assert.equal(p.title,'Kidney');assert.equal(p.notes,'Evidence\n and references');
 assert.equal(p.linkUrl,'https://example.org/papers?id=10');
 assert.equal(Object.isFrozen(p),true);
});
test('unsafe links fail closed, even with user content',()=>{
 for(const url of ['javascript:alert(1)','file:///secret','data:text/html,<svg>','https://a:b@site.example/'])
  assert.throws(()=>Core.propose({url,text:'hello'}),/HTTP/);
 assert.equal(Core.safeURL('http://example.org/'),'http://example.org/');
});
test('empty inputs rejected and long text bounded',()=>{
 assert.throws(()=>Core.propose({text:'  '}),/text or/);
 const p=Core.propose({text:'z'.repeat(Core.MAX_TEXT+50)});
 assert.equal(p.notes.length,Core.MAX_TEXT);assert.equal(p.truncated,true);
});
