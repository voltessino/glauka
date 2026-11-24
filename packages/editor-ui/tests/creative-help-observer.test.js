'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const composeUiSource=require('./helpers/compose-ui-source.cjs');

test('help tooltip observes only the active owner, not the whole document body',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../creative-help.js'),'utf8');
 assert.match(source,/observer\.observe\(owner/);
 assert.doesNotMatch(source,/\.observe\(\s*document\.body/);
 assert.match(source,/observer\?\.disconnect\(\)/);
});

test('marker shelf mount is idempotent and tags its injected style',()=>{
 const source=composeUiSource('creative-markers');
 assert.match(source,/if \(app\._nmMarkerUI \|\| document\.getElementById\("nm-marker-search"\)\) return;/);
 assert.match(source,/style\.id = "nm-marker-shelf-styles"/);
 assert.equal((source.match(/host\.before\(chips, tools\)/g)||[]).length,1);
});
