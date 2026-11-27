'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../../../apps/desktop-shared/editor');
const text=file=>fs.readFileSync(path.join(dir,file),'utf8');
test('shell dictionary is composed exactly before the home and product UI',()=>{
 const manifest=JSON.parse(text('sources.json'));
 const i=manifest.indexOf('shell-dictionary.js');
 assert.ok(i>0);
 assert.deepEqual(manifest.slice(i,i+3),['shell-dictionary.js','shell-product-locale.js','shell.js']);
 assert.equal(manifest[i-1],'media.js');
 const prefix=text('shell-dictionary.js');
 assert.ok(prefix.includes('const NM_DICT={'));
 assert.ok(prefix.includes('const NM_PRODUCT_VERSION='));
 assert.ok(!text('shell.js').includes('const NM_PRODUCT_VERSION='));
 assert.doesNotThrow(()=>new Function(prefix));
 assert.doesNotThrow(()=>new Function(text('shell.js')));
});
test('the separated desktop translations remain available with the expected version',()=>{
 const dict=new Function(text('shell-dictionary.js')+
  '\nreturn {version:NM_PRODUCT_VERSION,translations:NM_DICT};')();
 const version=JSON.parse(fs.readFileSync(path.join(__dirname,'../../../versions.json'),'utf8'));
 assert.equal(dict.version,version.windows.version);
 assert.equal(dict.version,version.macos.version);
 assert.equal(dict.version,version.editor);
 assert.equal(dict.translations.File,'File');
 assert.equal(dict.translations['Nuova Scheda'],'New map');
 assert.ok(Object.keys(dict.translations).length>150);
});
