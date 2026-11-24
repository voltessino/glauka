'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const router=require('./where-to-edit.cjs');
const index=router.readMap();
test('all 18 areas point to existing canonical source and test paths',()=>{
 assert.equal(router.validate(index),18);
});
test('beginner queries lead to their intended owner',()=>{
 const pairs={fluida:'layout',autosave:'salvataggi',apk:'android',dmg:'macos',
  xmind:'file',svg:'immagini',ocr:'documenti',
  'spostare rami':'drag','finestra creativa':'interfaccia'};
 for(const [query,id] of Object.entries(pairs))
  assert.deepEqual(router.search(index,query).map(f=>f.id),[id],query);
});
test('accent-insensitive search and platform-specific file hints',()=>{
 assert.equal(router.normalized('Disposizióne'),router.normalized('disposizione'));
 const result=router.describe(router.search(index,'fluida')[0]);
 assert.match(result,/Windows \/ macOS/);
 assert.match(result,/Android/);
 assert.match(result,/Test/);
});
test('broken paths, duplicated aliases and traversal are rejected',()=>{
 const clone=()=>JSON.parse(JSON.stringify(index));
 const missing=clone();missing.features[0].desktop[0]='apps/does-not-exist.js';
 assert.throws(()=>router.validate(missing),/inesistente/);
 const dupe=clone();dupe.features[1].aliases.push(index.features[0].aliases[0]);
 assert.throws(()=>router.validate(dupe),/duplicato/);
 const traversal=clone();traversal.features[0].tests.push('../private');
 assert.throws(()=>router.validate(traversal),/non sicuro/);
});
test('root entry points link to the beginner guide',()=>{
 const root=path.resolve(__dirname,'../..');
 for(const name of ['README.md','AGENTS.md','docs/README.md'])
  assert.match(fs.readFileSync(path.join(root,name),'utf8'),/START_HERE\.md/);
});
