'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const bridge=read('apps/desktop-shared/src/bridge.js');
const broker=read('apps/desktop-shared/src/cloud_oauth.go');
const transport=read('apps/desktop-shared/src/cloud_transport.go');
const main=read('apps/desktop-shared/src/main.go');
const panel=read('apps/desktop-shared/src/cloud_panel.js');
const style=read('apps/desktop-shared/src/cloud_panel.css');
test('the desktop bridge never exposes secret OAuth tokens or a generic fetch token vault',()=>{
 assert.match(bridge,/cloudAuth: Object\.freeze/);
 assert.match(bridge,/cloudTransport: Object\.freeze/);
 for(const cmd of ["cloud/auth/status","cloud/auth/start","cloud/auth/disconnect","cloud/request"])
  assert.ok(bridge.includes(cmd),cmd);
 assert.doesNotMatch(bridge,/cloud\/auth\/(?:tokens|read-token|refresh-token)/);
 assert.doesNotMatch(transport,/result\["access_token"\]/);
 assert.match(transport,/native\.Header\.Set\("Authorization","Bearer "/);
 assert.match(transport,/cloudRefreshToken/);
});
test('all native Cloud routes stay behind the authenticated desktop request policy',()=>{
 assert.match(main,/s\.cloudOAuthRoutes\(mux\)/);
 assert.match(main,/s\.cloudTransportRoutes\(mux\)/);
 assert.match(main,/r\.URL\.Path == "\/__desktop\/cloud\/oauth\/callback"/);
 assert.match(transport,/if !s\.secure\(w,r\)\{return\}/);
 assert.match(broker,/if !s\.secure\(w,r\)\{return\}/);
 assert.match(broker,/subtle\.ConstantTimeCompare/);
 assert.match(broker,/cloudSaveTokens/);
 assert.match(broker,/protectSecret\(serialized,false\)/);
});
test('native transport allows only app-scoped hosts and provider routes',()=>{
 assert.match(transport,/case "google":/);
 assert.match(transport,/case "dropbox":/);
 assert.match(transport,/u\.Hostname\(\)!="www\.googleapis\.com"/);
 assert.match(transport,/content\.dropboxapi\.com/);
 assert.match(transport,/cloudMaxRequest=18 << 20/);
 assert.match(transport,/cloudMaxResponse=14 << 20/);
 assert.match(transport,/strings\.ContainsRune\(value,rune\(13\)\)/);
});
test('Cloud UI cannot claim that documents are synced when OAuth has merely completed',()=>{
 assert.match(panel,/Sync non attiva/);
 assert.match(panel,/Sincronizzazione automatica/);
 assert.match(panel,/GlaukaCloudSync\.setEnabled/);
 assert.match(broker,/cloudProviderConfigForDir/);
 assert.match(panel,/cloudAuth/);
 assert.doesNotMatch(panel,/refresh_token|access_token/);
 assert.match(style,/#gl-cloud-dialog/);
 assert.match(main,/cloud_panel\.js cloud_panel\.css/);
 assert.match(main,/script nonce/);
});
