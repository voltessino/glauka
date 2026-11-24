'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('Microsoft OneDrive uses app-scoped Graph URLs and native-only tokens',()=>{
 const transport=read('apps/desktop-shared/src/cloud_transport.go'),
  auth=read('apps/desktop-shared/src/cloud_oauth.go'),
  bridge=read('apps/desktop-shared/src/bridge.js');
 assert.match(transport,/case "onedrive":/);
 assert.match(transport,/graph\.microsoft\.com/);
 assert.match(transport,/\/special\/approot/);
 assert.match(transport,/cloudAllowedOneDriveDownload/);
 assert.match(transport,/download\.Header has no bearer token/);
 assert.match(transport,/CheckRedirect=func/);
 assert.match(auth,/login\.microsoftonline\.com/);
 assert.match(auth,/Files\.ReadWrite\.AppFolder/);
 assert.match(auth,/offline_access/);
 assert.match(auth,/cloudSaveTokens/);
 assert.match(auth,/protectSecret\(serialized,false\)/);
 assert.doesNotMatch(bridge,/refresh_token|access_token|Bearer \+token/);
 assert.match(bridge,/cloudTransport: Object\.freeze/);
});
test('OneDrive exposes the same guided account and recovery actions as Drive/Dropbox',()=>{
 const panel=read('apps/desktop-shared/src/cloud_panel.js'),
  recovery=read('apps/desktop-shared/src/cloud_library_ui.js'),
  reader=read('apps/desktop-shared/src/cloud_reader.js'),
  sync=read('apps/desktop-shared/src/cloud_sync_ui.js');
 assert.match(panel,/names=\{google:'Google Drive',dropbox:'Dropbox',onedrive:'Microsoft OneDrive'\}/);
 assert.match(panel,/\['google','dropbox','onedrive'\]/);
 assert.match(panel,/gl-cloud-sync-now/);
 assert.match(panel,/Save and sync now/);
 assert.match(panel,/Microsoft Entra Client ID/);
 assert.match(recovery,/onedrive:\(\)=>P\.onedrive/);
 assert.match(reader,/allowed\.add\('onedrive'\)/);
 assert.match(sync,/PREFIXES=\{google:'glg_',dropbox:'gld_',onedrive:'glw_'\}/);
 assert.match(sync,/cloud\/workspace\/protect|protect\(expectedLocal\)/);
 assert.doesNotMatch(panel,/OneDrive non ancora disponibile|Planned · connection unavailable/);
});
test('OneDrive source is bundled without runtime third-party scripts',()=>{
 const modules=read('apps/desktop-shared/src/cloud_modules.js'),
  source=read('packages/cloud-sync/providers.js');
 assert.match(modules,/function onedrive\(\{transport\}/);
 assert.equal(modules.includes(source.trim()),true);
 assert.doesNotMatch(source,/<script|document\.write\(/i);
});
