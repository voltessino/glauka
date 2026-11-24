'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
test('Desktop Windows/macOS source order loads document core before Knowledge UI',()=>{
 const names=JSON.parse(read('apps/desktop-shared/editor/sources.json'));
 assert.ok(names.includes('document-view-core.js'));
 assert.ok(names.indexOf('document-view-core.js')<names.indexOf('knowledge-ui.js'));
 const ui=read('apps/desktop-shared/editor/knowledge-ui.js').replace(
  '/* @neuromap-knowledge-ui-draw */\n',
  read('apps/desktop-shared/editor/knowledge-ui-draw.js'));
 assert.match(ui,/function drawDocument\(\)/);
 assert.match(ui,/D\.commit\(owner,/);
 assert.match(ui,/D\.exportText\(owner\.root\)/);
});
test('Android portable bundle stages the same document core, with touch-first editor',()=>{
 const prepare=read('scripts/release/prepare.py');
 assert.match(prepare,/'knowledge-core', 'document-view-core'/);
 const ui=read('apps/android/native/app/src/main/assets/assets/mobile-74.js');
 assert.match(ui,/\[\s*['"]writing['"],\s*['"]✎['"]/);
 assert.match(ui,/editorSession\s*=\s*\{\s*hasUnsaved:\s*changed\s*\}/);
 assert.match(ui,/D\.commit\(owner,/);
 assert.match(ui,/D\.exportText\(owner\.root\)/);
});
test('No new persisted schema, network calls or Actions required by document core',()=>{
 const core=read('apps/desktop-shared/editor/document-view-core.js');
 assert.doesNotMatch(core,/\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB|eval\s*\(/);
 assert.doesNotMatch(core,/workflow_dispatch|github\.com\/actions/);
 assert.match(core,/state\.pushHistory\(\)/);
});
