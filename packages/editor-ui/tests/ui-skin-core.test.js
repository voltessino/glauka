'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../ui-skin-core');
test('main light and dark themes stay first, and every theme is reversible',()=>{
 assert.equal(C.THEMES[0].id,'prisma');
 assert.equal(C.THEMES[1].id,'slate');
 assert.equal(C.THEMES.length,10);
 assert.equal(new Set(C.THEMES.map(t=>t.id)).size,10);
 for(const item of C.THEMES){
  const prefs=C.read(JSON.stringify({theme:item.id,contrast:'high'}));
  assert.equal(prefs.theme,item.id);assert.equal(prefs.contrast,'high');
  assert.equal(C.visible(prefs,false),'prisma');
  assert.equal(C.visible(prefs,true),item.id);
 }
});
test('invalid storage never injects arbitrary CSS tokens or user content',()=>{
 for(const value of ['{}','{malformed','[]','{"theme":"__proto__"}','{"theme":"<script>","contrast":"evil"}']){
  const v=C.read(value);
  assert.equal(v.theme,'prisma');assert.equal(v.contrast,'normal');
 }
 assert.equal(C.STORAGE_KEY,'nm_ui_skin_v1');
 assert.equal(C.THEMES.find(t=>t.id==='prisma').it,'White — Prisma Vivo');
 assert.equal(C.THEMES.find(t=>t.id==='slate').it,'Dark — Deep Slate');
 assert.equal(C.read({theme:'slate'}).theme,'slate');
 assert.equal(C.THEMES.some(t=>t.id==='classic'),false);
 assert.equal(C.read({theme:'classic'}).theme,'orbit');
});
test('UI theme model contains no map, node, branch or license operations',()=>{
 assert.equal(typeof C.read,'function');
 assert.deepEqual(Object.keys(C.read(null)).sort(),['contrast','readability','theme']);
 assert.equal(C.read({theme:'graphite'}).theme,'graphite');
});

test('readability is strictly opt-in and no map or branch schema is modified',()=>{
 assert.deepEqual(C.READABILITY,['standard','comfortable']);
 assert.equal(C.read(null).readability,'standard');
 assert.equal(C.read('{broken').readability,'standard');
 assert.equal(C.read({readability:'comfortable'}).readability,'comfortable');
 for(const invalid of ['<script>',{},null,42,'superlarge','__proto__']){
  assert.equal(C.read({readability:invalid}).readability,'standard');
 }
 assert.deepEqual(C.read({theme:'minimal',contrast:'high',readability:'comfortable'}),{
  theme:'minimal',contrast:'high',readability:'comfortable'
 });
});
test('all supported theme x contrast x readability settings remain independent',()=>{
 for(const theme of C.THEMES)for(const contrast of C.CONTRASTS)
  for(const readability of C.READABILITY){
   const preferences=C.read({theme:theme.id,contrast,readability});
   assert.equal(preferences.theme,theme.id);
   assert.equal(preferences.contrast,contrast);
   assert.equal(preferences.readability,readability);
   assert.equal(C.visible(preferences,false),'prisma');
  }
});
