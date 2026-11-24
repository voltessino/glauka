'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const letters='abcdefghijklmnopqrstu'.split('');
const parts=letters.flatMap(letter=>require('../object-gallery-parts-lucide-'+letter+'.js'));
const catalogue=require('../object-gallery-healthicons.js');
const Module=require('node:module');
const loadCreativeCore=()=>{
  const dir=path.join(__dirname,'..');
  const filename=path.join(dir,'creative-core.js');
  const source=fs.readFileSync(filename,'utf8').replace(
    '/* @neuromap-creative-core-objects */\n',
    fs.readFileSync(path.join(dir,'creative-core-objects.js'),'utf8'));
  const mod=new Module(filename);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(dir);
  mod._compile(source,filename);
  return mod.exports;
};
const core=loadCreativeCore();
const root=path.resolve(__dirname,'../../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

test('335 additional distinct offline Lucide SVGs extend the gallery to 636',()=>{
  assert.equal(parts.length,335);
  const ids=parts.map(x=>x.id);
  assert.equal(new Set(ids).size,335,'duplicate pack ID');
  assert.ok(ids.every(id=>/^lc-[a-z0-9-]+$/.test(id)));
  assert.equal(catalogue.ITEMS.filter(x=>x.id.startsWith('lc-')).length,335);
  assert.equal(catalogue.ITEMS.length,628);
  assert.equal(core.OBJECTS.length,636);
  assert.equal(new Set(core.OBJECTS.map(x=>x.id)).size,636);
  assert.equal(core.OBJECTS.filter(x=>x.id.startsWith('gl-')).length,80);
});

test('all new drawings stay bounded pure vectors, with safe data-only persistence',()=>{
  const safe=/<(?:path|rect|circle|line|polyline|polygon|ellipse|g)\b/;
  const banned=/<script|<image|<foreignObject|onload=|javascript:|https?:\/\//i;
  for(const item of parts){
    assert.ok(item.it&&item.en&&item.source==='lucide/'+item.id.slice(3));
    assert.match(item.body,safe);
    assert.doesNotMatch(item.body,banned);
    assert.ok(item.body.length<3000,item.id+' body is too large');
    assert.match(core.objectSVG(item.id),/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.deepEqual(core.objectArt({id:item.id,size:9999}),{id:item.id,size:220});
    assert.ok(JSON.stringify({objectArt:{id:item.id,size:90}}).length<80);
  }
});

test('small source, offline staging in all platforms, searchable UI and retained notices',()=>{
  const size=letters.reduce((sum,letter)=>sum+Buffer.byteLength(read('packages/editor-ui/object-gallery-parts-lucide-'+letter+'.js')),0);
  assert.ok(size<230*1024,'Lucide source grew unexpectedly: '+size+' bytes');
  const prepare=read('scripts/release/prepare.py');
  const pack=read('packages/editor-ui/object-gallery-healthicons.js');
  const ui=read('packages/editor-ui/creative-tools-object-dialog.js');
  for(const letter of letters){
    assert.ok(prepare.includes("'lucide-"+letter+"'"));
    assert.ok(pack.includes("'lucide-"+letter+"'"));
  }
  assert.ok(ui.includes("asset.id.startsWith('lc-')"));
  assert.ok(ui.includes("entry.source?.startsWith('lucide/')"));
  const license=read('docs/licenses/LUCIDE-ISC-LICENSE.txt');
  assert.match(license,/ISC License/);
  assert.match(license,/The MIT License/);
});
