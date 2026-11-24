'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');
const root=path.join(__dirname,'../../..');
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
const files=[
 'apps/desktop-shared/editor/study-interactions.js',
 'apps/android/editor/study-interactions.js',
 'apps/desktop-shared/editor/learn-ui-session.js',
 'apps/desktop-shared/editor/ai-client.js',
 'apps/android/editor/ai-client.js'
];
test('study generation asks for Pro before every request',()=>{
 for(const rel of files){
  const src=read(rel);
  assert.equal(src.includes('prototype?.chat'),false,rel);
  assert.equal(src.includes('realChat'),false,rel);
  assert.match(src,/nmProduct\?\.guard&&!/,rel);
 }
 const workflows=read('packages/editor-ui/ai-workflows.js');
 assert.match(workflows,/if\(!product\.guard\(\)\)throw/);
 assert.match(workflows,/async function providerChat[\s\S]{0,220}nmProduct\?\.guard&&!/);
 assert.match(workflows,/Client\.prototype\.chat=function[\s\S]{0,180}nmProduct\?\.guard&&!/);
 const shell=read('apps/desktop-shared/editor/shell-product-locale.js');
 assert.match(shell,/async aiRequest[\s\S]{0,80}if\(!this\.guard\(\)\)throw/);
});
