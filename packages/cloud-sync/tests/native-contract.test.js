'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../../..');
const read=file=>fs.readFileSync(path.join(base,file),'utf8');
const go=read('apps/desktop-shared/src/cloud_storage.go');
const main=read('apps/desktop-shared/src/main.go');
const bridge=read('apps/desktop-shared/src/bridge.js');
const java=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java');
test('desktop routes require native authenticated session and write with fsync replacement',()=>{
 assert.match(main,/s\.cloudLocalRoutes\(mux\)/);
 assert.match(go,/if !s\.secure\(w,r\)\{return\}/);
 for(const route of ['cloud/index/read','cloud/index/write','cloud/documents/list',
   'cloud/document/read','cloud/document/write'])assert.ok(go.includes(route));
 assert.match(go,/atomicFile\(/);
 assert.match(go,/cloudDocumentID/);
 assert.match(bridge,/cloudLocal: Object\.freeze/);
});
test('Android native cloud staging is private, atomic, and never a network proxy',()=>{
 assert.match(java,/addJavascriptInterface\(new CloudLocalStorage\(\),"GlaukaCloudLocal"\)/);
 assert.match(java,/new AtomicFile\(path\)/);
 assert.match(java,/new AtomicFile\(file\)\.openRead\(\)/);
 assert.match(java,/getFilesDir\(\),"glauka-cloud"/);
 assert.doesNotMatch(java.slice(java.indexOf('private final class CloudLocalStorage'),
   java.indexOf('private final class AndroidExport')),/HttpURLConnection|Authorization|refresh_token/);
});
test('Android new post-Orbit scripts are permitted by strict asset whitelist',()=>{
 const whitelist=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/AndroidAssetPolicy.java');
 assert.match(java,/AndroidAssetPolicy\.mimeFor\(path\)/);
 for(const asset of ['mobile-ui-polish.css','mobile-node-actions.js']){
  assert.ok(whitelist.includes(asset),asset+' blocked by native WebView');
 }
 assert.doesNotMatch(whitelist,/mobile-orbit(?:-toggle)?\.(?:js|css)/);
});
