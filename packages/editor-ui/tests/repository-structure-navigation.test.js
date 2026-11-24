'use strict';
const sourcePath=require('./helpers/editor-source.cjs');
// Structural checks for maintainers and coding agents; no network or GitHub Actions.
// Only stable entry points are checked, not an exhaustive frozen file catalogue.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const resolve=p=>path.join(ROOT,p);
const read=p=>fs.readFileSync(resolve(p),'utf8');

const DOCUMENTS=[
 'README.md','AGENTS.md','CONTRIBUTING.md',
 'docs/README.md','docs/CODE_NAVIGATION.md',
 'docs/REPOSITORY_LAYOUT.md','docs/REPOSITORY_MAINTENANCE_PLAN.md',
 'docs/maintenance/2026-10-31-modularization-roadmap.md',
 'docs/maintenance/2026-10-31-branch-triage.md',
 'docs/DEVELOPMENT.md','docs/qa/README.md',
 'apps/desktop-shared/editor/README.md','apps/android/editor/README.md'
];
test('every linked local resource in the navigation entry points exists in-repo',()=>{
 const bad=[];
 for(const document of DOCUMENTS){
  assert.ok(fs.existsSync(resolve(document)),'missing guide: '+document);
  const markdown=read(document);
  // Only inspect links, not code blocks or arbitrary text snippets. The
  // canonical entry points use ordinary relative Markdown links.
  for(const match of markdown.matchAll(/\]\(([^)]+)\)/g)){
   const raw=match[1].split('#')[0].trim();
   if(!raw||/^(?:https?:\/\/|mailto:|#)/i.test(raw))continue;
   const local=path.resolve(path.dirname(resolve(document)),decodeURIComponent(raw));
   if(local!==ROOT&&!local.startsWith(ROOT+path.sep)||!fs.existsSync(local))
    bad.push(document+' -> '+raw);
  }
 }
 assert.deepEqual(bad,[],'broken navigation links');
});
test('both editors have complete nonduplicated source manifests',()=>{
 for(const platform of ['desktop-shared','android']){
  const dir='apps/'+platform+'/editor/';
  const list=JSON.parse(read(dir+'sources.json'));
  assert.ok(Array.isArray(list)&&list.length>=10);
  assert.equal(list.length,new Set(list).size,'duplicate editor source: '+platform);
  for(const name of list){
   assert.match(name,/^(?:shared\/)?[a-z0-9][a-z0-9-]*\.js$/,'invalid manifest item: '+name);
   assert.ok(fs.existsSync(sourcePath(resolve(dir),name)),'missing source: '+dir+name);
  }
  assert.equal(list[0],'prelude.js');
  assert.equal(list.at(-1),'startup.js');
  assert.ok(list.indexOf('state.js')<list.indexOf('app.js'));
  assert.ok(list.indexOf('layout.js')<list.indexOf('app.js'));
 }
});
test('desktop presentation metadata loads after Atlas and before app controller',()=>{
 const dir='apps/desktop-shared/editor/';
 const list=JSON.parse(read(dir+'sources.json'));
 const atlas=list.indexOf('atlas-library-core.js');
 assert.ok(atlas>=0);
 assert.deepEqual(list.slice(atlas,atlas+3),
  ['atlas-library-core.js','workspace-view-metadata.js','app.js']);
 const metadata=read(dir+'workspace-view-metadata.js');
 const app=read(dir+'app.js');
 for(const name of ['nmCleanViewWorkspace','nmArchiveViewWorkspaces','nmCleanCanvasCamera']){
  assert.ok(metadata.includes('function '+name+'('),'missing extracted function: '+name);
  assert.ok(!app.includes('function '+name+'('),'duplicated controller helper: '+name);
 }
 const android=JSON.parse(read('apps/android/editor/sources.json'));
 assert.ok(!android.includes('workspace-view-metadata.js'),
  'Desktop-only archived view metadata must not be added to Android');
});
test('release staging still composes both editors from source manifests',()=>{
 const stage=read('scripts/release/prepare.py');
 assert.match(stage,/def editor_sources\(platform\):/);
 assert.ok(stage.includes("folder / 'sources.json'"));
 assert.ok(stage.includes("source = ''.join(read(editor_source_path(folder, name)) for name in files)"));
 assert.ok(fs.existsSync(resolve('versions.json')));
});

test('recovery, autosave and Atlas tests load extracted metadata from its canonical file',()=>{
 const tests=['workspace-recovery-integrity.test.js','workspace-autosave-race.test.js',
  'atlas-workspace-roundtrip.test.js'];
 for(const file of tests){
  const text=read('packages/editor-ui/tests/'+file);
  assert.ok(text.includes('workspace-view-metadata.js'),
   'test still assumes helpers are inside app.js: '+file);
  assert.ok(text.includes('workspaceMetadataSource'),
   'workspace helpers not loaded in '+file);
  assert.ok(!/appSource\.slice\(0,appSource\.indexOf\(['"]    \/\/ Controller: local-first/.test(text),
   'old app.js prefix extraction in '+file);
  assert.ok(!/source\.slice\(0,source\.indexOf\(['"]    \/\/ Controller: local-first/.test(text),
   'old app.js prefix extraction in '+file);
 }
});
