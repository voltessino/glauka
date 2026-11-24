'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');

test('new-tab button preserves its action ID but is browser-like',()=>{
 const html=source('apps/desktop-shared/src/resources/index.html');
 assert.match(html,/<button id="btn-new-tab" class="tab-action-btn gl-browser-add-tab"/);
 assert.match(html,/aria-label="Nuova scheda \(Ctrl\+T\)">\+<\/button>/);
 assert.doesNotMatch(html,/<span>\+ Scheda<\/span>/);
});
test('history clock is distinct from automatic recovery state',()=>{
 const history=source('apps/desktop-shared/editor/version-history.js');
 const status=source('packages/editor-ui/save-status.js');
 assert.match(history,/id='gl-history-quick'/);
 assert.match(history,/nm614OpenHistoryPanel\(window\.neuroMapApp\)/);
 assert.match(status,/Recovery up to date/);
 assert.match(status,/Recupero OK/);
 assert.match(history,/describeProjectHistory/);
 assert.match(history,/pinProjectHistory/);
});
test('the cloud shortcut opens native auth status with opt-in provider synchronization',()=>{
 const cloud=source('apps/desktop-shared/src/cloud_panel.js');
 const oauth=source('apps/desktop-shared/src/cloud_oauth.go');
 assert.match(cloud,/id='gl-cloud-quick'/);
 assert.match(cloud,/opener\.click\(\)/);
 assert.match(cloud,/OneDrive/);
 assert.match(cloud,/attiva la sincronizzazione/);
 assert.match(cloud,/solo una destinazione è attiva/);
 assert.match(oauth,/case "google":/);
 assert.match(oauth,/case "dropbox":/);
 assert.match(oauth,/case "onedrive":/);
});
test('performance toggle is parked for Settings and duplicate distribution in View is hidden',()=>{
 const composeUiSource=require('./helpers/compose-ui-source.cjs');
 const view=source('apps/desktop-shared/src/resources/index.html');
 const curate=composeUiSource('workspace-tools');
 const settings=source('packages/editor-ui/settings-center.js');
 assert.match(view,/id="gl-view-distribution-control" hidden style="display:none!important"/);
 assert.match(curate,/gl-settings-park/);
 assert.match(curate,/park\.append\(control\)/);
 assert.doesNotMatch(curate,/menu\.append\(heading, control\)/);
 assert.match(settings,/getElementById\("nm-fast-canvas-toggle"\)/);
 assert.match(settings,/Disegno rapido per mappe grandi/);
});
test('Pro AI is visually distinguished and provider costs remain separate',()=>{
 for(const name of ['index.html','home-en.html']){
  const s=source('apps/website/home-review/'+name);
  // Prisma Vivo replaced the old plan-* CSS hooks. Keep checking the
  // actual distinction and provider billing instead of obsolete class names.
  const pro=s.split('<!-- PLAN: PRO (HIGHLIGHTED) -->')[1]?.split('<!-- Download')[0];
  assert.ok(pro,'Pro plan exists');
  assert.match(pro,/<h3[^>]*>PRO<\/h3>/);
  assert.match(pro,/shadow-xl/);
  assert.match(pro,/BYOK/);
  assert.match(pro,/(paghi solo ciò che usi dal tuo provider AI|pay only for what you use with your AI provider)/i);
 }

});
