'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../../../apps/desktop-shared/editor/share-html-core.js');
function tree(){
 return {id:'root',text:'My <Project>',notes:'PRIVATE ROOT',children:[
  {id:'a',text:'Alpha </script><script>alert(1)</script>',notes:'SECRET DETAILS',
   linkUrl:'https://example.org/course?x=1&y=2',children:[
    {id:'b',text:'Child \u2028 text',notes:'internal',children:[]}]},
  {id:'c',text:'Next',linkUrl:'javascript:alert(9)',children:[]}
 ]};
}
test('HTML sharing excludes sensitive notes and links by default',()=>{
 const original=tree(),before=JSON.stringify(original);
 const html=S.render(original);
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/Search concepts/);
 assert.doesNotMatch(html,/SECRET DETAILS|PRIVATE ROOT|https:\/\/example.org/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/\\u003c\/script\\u003e/);
 assert.equal(JSON.stringify(original),before);
});
test('HTML sharing includes only explicitly opted-in notes and HTTP(S) links',()=>{
 const html=S.render(tree(),{notes:true,links:true});
 assert.match(html,/SECRET DETAILS/);
 assert.match(html,/https:\/\/example.org\/course/);
 assert.doesNotMatch(html,/javascript:alert/);
 assert.doesNotMatch(html,/data-neuromap-build/);
});
test('throws on oversized, duplicate and cyclic graphs without silently truncating nodes',()=>{
 const original=tree();original.children.push({id:'a',text:'collision',children:[]});
 assert.throws(()=>S.project(original),/duplicate/);
 const self={id:'self',text:'self',children:[]};self.children.push(self);
 assert.throws(()=>S.render(self),/Cyclic/);
 const huge={id:'r',text:'r',children:Array.from({length:S.MAX_NODES},(_,i)=>({id:'n'+i,text:'item',children:[]}))};
 assert.throws(()=>S.render(huge),/3,500/);
});
test('link sanitizer rejects credentials and untrusted schemes',()=>{
 assert.equal(S.safeLink('javascript:alert(1)'),'');
 assert.equal(S.safeLink('file:///tmp/secret'),'');
 assert.equal(S.safeLink('https://user:pass@example.com'),'');
 assert.equal(S.safeLink('https://example.com/'),'https://example.com/');
});
