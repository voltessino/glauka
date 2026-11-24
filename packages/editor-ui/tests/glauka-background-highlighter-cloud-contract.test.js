'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=filename=>fs.readFileSync(path.join(root,filename),'utf8');

test('map background uses a compact dropdown with correct selected preview',()=>{
 const js=read('packages/editor-ui/theme-picker.js');
 assert.match(js,/id='nm-map-background-picker'/);
 assert.match(js,/id='nm-map-background-trigger'/);
 assert.match(js,/element\.append\(heading,disclosure\)/);
 assert.match(js,/disclosure\.open=false/);
 assert.match(js,/currentColor\.style\.setProperty\('--nm-current-bg',selectedTheme\.color\)/);
 assert.match(js,/onChange\(theme\.id\)/);
 assert.match(js,/groupLabels\[1\]\.textContent/);
});
test('highlighter options have actual text-based colored previews and preserve Undo',()=>{
 const composeUiSource=require('./helpers/compose-ui-source.cjs');
 const code=composeUiSource('workspace-layout');
 const css=read('packages/editor-ui/workspace-layout.css');
 assert.match(code,/className='nm-highlighter-sample'/);
 assert.match(code,/sample\.style\.setProperty\('--nm-highlighter-color',color\)/);
 assert.match(code,/id='nm-text-highlight-picker'/);
 assert.match(code,/app\.state\.pushHistory\(\)/);
 assert.match(code,/n\.fontHighlight=color/);
 assert.match(css,/background-color:var\(--nm-highlighter-color,#f1f5f9\)!important/);
 assert.match(css,/\.nm-text-highlight-swatch\[aria-pressed="true"\]/);
 for(const color of ['#facc15','#86efac','#7dd3fc','#fda4af','#c4b5fd'])
  assert.ok(code.includes(color),'missing color '+color);
});
test('cloud connection and sync are distinct, explicitly named user actions',()=>{
 const composeAppSource=require('./helpers/compose-app-source.cjs');
 const cloud=read('apps/desktop-shared/src/cloud_panel.js');
 const go=read('apps/desktop-shared/src/cloud_oauth.go');
 const app=composeAppSource('desktop-shared');
 assert.match(cloud,/cloudLogo\(id\)/);
 assert.match(cloud,/Sincronizzazione automatica/);
 assert.match(cloud,/gl-cloud-sync-now/);
 assert.match(cloud,/GlaukaCloudSync\.setEnabled\(id,newValue\)/);
 assert.match(cloud,/GlaukaCloudSync\.syncNow\(id\)/);
 assert.match(cloud,/OAuth.*Client ID|Client ID.*OAuth/);
 assert.match(go,/cloudProviderConfigForDir/);
 assert.match(go,/\/__desktop\/cloud\/auth\/public-config\/write/);
 assert.match(app,/GlaukaCloudSync\?\.onWorkspaceSaved\(onDisk\)/);
});
test('native page embeds cloud sync client before account UI',()=>{
 const main=read('apps/desktop-shared/src/main.go');
 assert.match(main,/cloud_sync_ui\.js/);
 const sourceIndex=main.indexOf('string(cloudSyncUI)');
 const panelIndex=main.indexOf('string(cloudPanel)');
 assert.ok(sourceIndex>0 && panelIndex>sourceIndex);
});
