'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sourcePath=require('./helpers/editor-source.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const MANIFEST_SHARED=['media-icon-core.js','navigation-flashcards.js','navigation-search-camera.js'];
const LEXICAL_SHARED=['app-hit-testing.js','app-image-drag.js','app-node-mutations.js'];
const STATE_SHARED=['state-relationships-summary.js','state-node-style.js'];
const SHARED_DIR=path.join(ROOT,'packages/editor-ui/editor-shared');

test('both manifests reference one canonical copy of the shared editor slices',()=>{
 for(const name of MANIFEST_SHARED){
  const paths=[];
  for(const platform of ['desktop-shared','android']){
   const editor=path.join(ROOT,'apps',platform,'editor');
   const entries=JSON.parse(fs.readFileSync(path.join(editor,'sources.json'),'utf8'));
   assert.equal(entries.filter(item=>item==='shared/'+name).length,1);
   assert.ok(!fs.existsSync(path.join(editor,name)),'platform copy must not mask the shared source');
   paths.push(sourcePath(editor,'shared/'+name));
  }
  assert.equal(paths[0],paths[1]);
  assert.ok(fs.readFileSync(paths[0]).length>0);
 }
});

test('identical app class fragments live once under editor-shared',()=>{
 for(const name of LEXICAL_SHARED){
  const shared=path.join(SHARED_DIR,name);
  assert.ok(fs.existsSync(shared),name+' must exist in editor-shared');
  assert.ok(fs.readFileSync(shared).length>0);
  for(const platform of ['desktop-shared','android']){
   const editor=path.join(ROOT,'apps',platform,'editor');
   assert.ok(!fs.existsSync(path.join(editor,name)),
    platform+' must not keep a local copy of '+name);
   const app=fs.readFileSync(path.join(editor,'app.js'),'utf8');
   assert.equal(app.split('/* @neuromap-'+name.replace(/\.js$/,'')+' */\n').length,2);
  }
 }
});

test('identical state relationship methods live once under editor-shared',()=>{
 for(const name of STATE_SHARED){
  const shared=path.join(SHARED_DIR,name);
  assert.ok(fs.existsSync(shared),name+' must exist in editor-shared');
  assert.ok(fs.readFileSync(shared).length>0);
  for(const platform of ['desktop-shared','android']){
   const editor=path.join(ROOT,'apps',platform,'editor');
   assert.ok(!fs.existsSync(path.join(editor,name)),
    platform+' must not keep a local copy of '+name);
   const state=fs.readFileSync(path.join(editor,'state.js'),'utf8');
   assert.equal(state.split('/* @neuromap-'+name.replace(/\.js$/,'')+' */\n').length,2);
  }
 }
});
