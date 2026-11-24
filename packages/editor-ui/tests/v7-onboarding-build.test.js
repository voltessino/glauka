'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
test('first steps loads before startup and installs exactly once',()=>{
 const build=text('scripts/release/prepare.py');
 const startup=text('apps/desktop-shared/editor/startup.js');
 const html=text('apps/desktop-shared/src/resources/index.html');
 assert.match(build,/'workspace-skins', 'first-steps', 'topbar-curation', 'map-style-core'/);
 assert.match(startup,/NeuroMapFirstStepsInstall\(NeuroMapApp\)/);
 assert.equal((startup.match(/NeuroMapFirstStepsInstall\(/g)||[]).length,1);
 assert.equal((html.match(/id="nm7-guide-open"/g)||[]).length,1);
 assert.match(html,/aria-label="Guida introduttiva a Glauka"/);
});
test('comfort mode has readable targets, focus indicator and no forced modal',()=>{
 const skins=text('packages/editor-ui/workspace-skins.js');
 const guide=text('packages/editor-ui/first-steps.js');
 assert.match(skins,/data-nm-skin-readability="comfortable"/);
 assert.match(skins,/min-height:44px!important/);
 assert.match(skins,/outline:3px solid #fbbf24!important/);
 assert.match(skins,/prefers-reduced-motion:reduce/);
 assert.match(guide,/dialog\.showModal\(\)/);
 assert.doesNotMatch(guide,/localStorage\.setItem/);
 assert.doesNotMatch(guide,/app\.state\.root|pushHistory\(/);
});
test('readability and first steps do not overwrite map content or inject remote URLs',()=>{
 const all=text('packages/editor-ui/first-steps.js')+
  text('packages/editor-ui/workspace-skins.js')+
  text('packages/editor-ui/ui-skin-core.js');
 assert.doesNotMatch(all,/https?:\/\//);
 assert.doesNotMatch(all,/\.innerHTML\s*=/);
 assert.doesNotMatch(all,/fetch\(/);
 assert.doesNotMatch(all,/state\.root\.text\s*=/);
});
