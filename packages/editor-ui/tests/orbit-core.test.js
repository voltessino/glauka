const {test}=require('node:test');
const assert=require('node:assert/strict');
const orbit=require('../orbit-core');

test('Orbit is opt-in and never mixes appearance with project data',()=>{
 const initial=orbit.read(null);
 assert.deepEqual(initial,{enabled:false,accent:'auto',density:'comfortable'});
 assert.equal(orbit.STORAGE_KEY,'nm_orbit_desktop_ui_v1');
 assert.deepEqual(orbit.read('{"enabled":true,"accent":"violet","density":"compact"}'),
   {enabled:true,accent:'violet',density:'compact'});
});
test('corrupted or malicious settings fail closed',()=>{
 for(const bad of ['{garbage','null','[]','"true"','{"enabled":"true","accent":"javascript:","density":"huge"}']){
   const p=orbit.read(bad);
   assert.equal(typeof p.enabled,'boolean');
   assert.ok(orbit.accents.includes(p.accent));
   assert.ok(orbit.densities.includes(p.density));
 }
 assert.equal(orbit.read('{"enabled":"true"}').enabled,false);
 assert.equal(orbit.read('{"accent":"invalid"}').accent,'auto');
});
test('search finds existing commands in Italian and English with accent folding',()=>{
 const all=orbit.search('', 'it');
 assert.ok(all.length>=20);
 assert.ok(orbit.search('salva').some(x=>x.id==='menu-save-file'));
 assert.ok(orbit.search('flàshcard').some(x=>x.id==='btn-flashcards'));
 assert.ok(orbit.search('search','en').some(x=>x.id==='btn-spotlight'));
 assert.ok(orbit.search('vìsta affiancata','it').some(x=>x.id==='nm-view-split'));
});
test('search returns only live approved commands and cannot run arbitrary IDs',()=>{
 const approved=new Set(['btn-spotlight','menu-save-file']);
 assert.deepEqual(orbit.search('', 'it',id=>approved.has(id)).map(x=>x.id).sort(),
   ['btn-spotlight','menu-save-file']);
 assert.equal(orbit.hasCommand('btn-spotlight'),true);
 assert.equal(orbit.hasCommand('nonexistent-private-api'),false);
 assert.equal(orbit.hasCommand('__proto__'),false);
});
test('search is literal case-insensitive and does not read or mutate source maps',()=>{
 const old=JSON.stringify(orbit.COMMANDS);
 assert.equal(orbit.fold('  À   Bè  '),'a be');
 assert.equal(orbit.search('<script>').length,0); // no command matches raw markup
 assert.equal(JSON.stringify(orbit.COMMANDS),old);
});
test('commands are unique, grouped and contain no privileged shell operations',()=>{
 const ids=orbit.COMMANDS.map(c=>c.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const c of orbit.COMMANDS){
   assert.ok(c.id.startsWith('menu-')||c.id.startsWith('btn-')||c.id.startsWith('nm'));
   assert.ok(orbit.GROUPS.it[c.group]);
   assert.ok(orbit.GROUPS.en[c.group]);
   assert.equal(typeof c.it,'string');
   assert.equal(typeof c.en,'string');
 }
});
