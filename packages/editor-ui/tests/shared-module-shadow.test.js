'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const list=dir=>fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.js'));
test('shared editor-ui modules are never simultaneously shadowed in Android and desktop directories',()=>{
 const shared=new Set(list('packages/editor-ui'));
 const android=new Set(list('apps/android/editor'));
 const desktop=new Set(list('apps/desktop-shared/editor'));
 const shadowed=[...shared].filter(file=>android.has(file)&&desktop.has(file));
 assert.deepEqual(shadowed,[],
  'Move duplicated shared modules into packages/editor-ui and update the build manifest');
});
test('platform-specific editor files remain explicit until refactored with parity tests',()=>{
 const android=new Set(list('apps/android/editor'));
 const desktop=new Set(list('apps/desktop-shared/editor'));
 for(const name of ['ai-client.js','io.js','state.js'])
  assert.ok(android.has(name)&&desktop.has(name),
   name+' must not be removed before cross-platform regression coverage exists');
});
