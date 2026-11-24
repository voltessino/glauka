'use strict';
// A single lexical scope is intentional. A module boundary must not silently
// become a separate <script>, module import, or change the staging order.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sourcePath=require('./helpers/editor-source.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const editorial=path.join(ROOT,'apps/desktop-shared/editor');
const android=path.join(ROOT,'apps/android/editor');
const sourceFor=(root)=>{
 const entries=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8'));
 assert.equal(entries.length,new Set(entries).size,'duplicate source in '+root);
 assert.equal(entries[0],'prelude.js');
 assert.equal(entries.at(-1),'startup.js');
 for(const name of entries)assert.ok(fs.existsSync(sourcePath(root,name)),
  'missing '+sourcePath(root,name));
 return {entries,source:entries.map(name=>fs.readFileSync(sourcePath(root,name),'utf8')).join('')};
};
const once=(source,needle,label)=>{
 assert.equal(source.split(needle).length-1,1,'expected exactly one '+(label||needle));
};
const normalized=(source)=>source.replace(/\r\n?/g,'\n');

test('desktop and Android complete source bundles compile as classic scripts',()=>{
 const colors=fs.readFileSync(path.join(ROOT,'packages/editor-ui/editor-colors.js'),'utf8');
 for(const root of [editorial,android]){
  const {source}=sourceFor(root);
  const bundle=normalized(source);
  once(bundle,'/* @neuromap-editor-colors */','editor-colors staging marker');
  once(bundle,'/* @neuromap-app-tabs */\n','app-tabs staging marker');
  once(bundle,'/* @neuromap-app-selection-clipboard */\n','selection-clipboard staging marker');
  const composed=bundle.replace('/* @neuromap-editor-colors */',colors)
    .replace('/* @neuromap-app-tabs */\n',normalized(fs.readFileSync(path.join(root,'app-tabs.js'),'utf8')))
    .replace('/* @neuromap-app-selection-clipboard */\n',
      normalized(fs.readFileSync(path.join(root,'app-selection-clipboard.js'),'utf8')));
  assert.doesNotThrow(()=>new vm.Script(composed,{filename:path.basename(path.dirname(root))+'-editor.js'}),
   'combined lexical scope must compile on '+root);
 }
});
test('desktop modules and integration points remain in exact runtime order',()=>{
 const {entries,source}=sourceFor(editorial);
 const ordered=['atlas-library-core.js','workspace-view-metadata.js','app.js'];
 const i=entries.indexOf(ordered[0]);
 assert.deepEqual(entries.slice(i,i+ordered.length),ordered);
 const layout=['layout-text-controls.js','layout-navigation.js','layout-tab-order.js',
  'layout-ui-controls.js','layout-audit-import.js','layout-geometry.js','layout-menu-import.js'];
 const j=entries.indexOf(layout[0]);
 assert.deepEqual(entries.slice(j,j+layout.length),layout);
 const shell=['shell-dictionary.js','shell-product-locale.js','shell.js'];
 const k=entries.indexOf(shell[0]);
 assert.deepEqual(entries.slice(k,k+shell.length),shell);
 const landmarks=['function nmCleanViewWorkspace(raw)','class NeuroMapApp',
  'const NM70_GAP_STORAGE','const NM611 = {','const NM612_NAV_STORAGE',
  'const NM613 = {','const NM_PRODUCT_VERSION=','const NM_I18N={','function nm6InjectShell()'];
 const offsets=landmarks.map(name=>{once(source,name);return source.indexOf(name)});
 assert.ok(offsets[0]<offsets[1]);
 assert.ok(offsets[2]<offsets[3]&&offsets[3]<offsets[4]&&offsets[4]<offsets[5]);
 assert.ok(offsets[6]<offsets[7]&&offsets[7]<offsets[8]);
});
test('both platform navigation slices preserve classic script order and ownership',()=>{
 for(const root of [editorial,android]){
  const {entries,source}=sourceFor(root);
  const names=['shared/navigation-search-camera.js','shared/navigation-flashcards.js','navigation-ai-actions.js','navigation-study.js'];
  const at=entries.indexOf(names[0]);
  assert.ok(at>=0,'camera/search source not declared');
  assert.deepEqual(entries.slice(at,at+names.length),names);
  const [camera,flash,ai,bind]=names.map(name=>fs.readFileSync(sourcePath(root,name),'utf8'));
  assert.ok(camera.includes('NeuroMapApp.prototype.teleportToNode=function('));
  assert.ok(camera.includes('NeuroMapApp.prototype.chooseSpotlight=function('));
  assert.ok(flash.startsWith('    // Spaced repetition:'));
  assert.ok(flash.includes('NeuroMapApp.prototype.collectFlashcards=function('));
  assert.ok(flash.includes('NeuroMapApp.prototype.rateFlashcard=function('));
  assert.ok(ai.startsWith('    // AI UI and handlers.'));
  assert.ok(bind.startsWith('    NeuroMapApp.prototype.bindV4=function()'));
  assert.ok(ai.includes('NeuroMapApp.prototype.aiExpandBranch=function('));
  assert.ok(source.includes(camera+flash+ai+bind),'staging must retain adjacent lexical scope');
 }
});

test('media icon core precedes platform UI controls without changing classic-script scope',()=>{
 for(const root of [editorial,android]){
  const {entries,source}=sourceFor(root);
  const index=entries.indexOf('shared/media-icon-core.js');
  assert.ok(index>0,'icon core must be declared');
  assert.equal(entries[index+1],'media.js','icon helpers must precede UI');
  const core=fs.readFileSync(sourcePath(root,'shared/media-icon-core.js'),'utf8');
  const ui=fs.readFileSync(path.join(root,'media.js'),'utf8');
  assert.ok(core.includes('function nm54SanitizeSvg('));
  assert.ok(core.includes('function nm54IconUri('));
  assert.ok(ui.startsWith('    NeuroMapApp.prototype.nm54SyncSettings=function()'));
  assert.ok(ui.includes('NeuroMapApp.prototype.nm54OpenIllustrate=async function('));
  assert.doesNotThrow(()=>new vm.Script(core));
  assert.doesNotThrow(()=>new vm.Script(ui));
  assert.ok(source.includes(core+ui),'composed editor must retain contiguous original text');
 }
});

test('Android shell dictionary, license/locale and Home remain adjacent classic-script slices',()=>{
 const {entries,source}=sourceFor(android);
 const names=['shell-dictionary.js','shell-product-locale.js','shell.js'];
 const index=entries.indexOf(names[0]);
 assert.ok(index>=0,'Android dictionary must be in manifest');
 assert.deepEqual(entries.slice(index,index+3),names);
 const [dictionary,product,home]=names.map(name=>fs.readFileSync(path.join(android,name),'utf8'));
 assert.ok(dictionary.includes('const NM_PRODUCT_VERSION='));
 assert.ok(dictionary.includes('const NM_DICT={'));
 assert.ok(product.startsWith('const NM_I18N={'));
 assert.ok(product.includes('window.nmProduct=nmProduct;'));
 assert.ok(product.includes('function nm6Translate('));
 assert.ok(home.startsWith('function nm6InjectShell()'));
 assert.ok(!home.includes('const NM_I18N={'));
 for(const part of [dictionary,product,home])assert.doesNotThrow(()=>new vm.Script(part));
 assert.ok(source.includes(dictionary+product+home),'Android shell must be assembled unchanged');
});

test('study canvas interactions precede the study deck on both platforms',()=>{
 for(const root of [editorial,android]){
  const {entries,source}=sourceFor(root);
  const i=entries.indexOf('study-canvas-interactions.js');
  assert.ok(i>=0,'study canvas source missing');
  assert.equal(entries[i+1],'study-interactions.js');
  const canvas=fs.readFileSync(path.join(root,'study-canvas-interactions.js'),'utf8');
  const study=fs.readFileSync(path.join(root,'study-interactions.js'),'utf8');
  assert.ok(canvas.includes('OrganicLayoutEngine.prototype.applyManualOffsets=function(root){'));
  assert.ok(canvas.includes('NeuroMapApp.prototype.v5ReparentNode=function('));
  assert.ok(study.startsWith('    // AI study deck:'));
  assert.ok(study.includes('NeuroMapApp.prototype.v5Deck=function('));
  assert.ok(study.includes('NeuroMapApp.prototype.bindUI=function('));
  assert.ok(source.includes(canvas+study),'classic-script concatenation must be contiguous');
  assert.doesNotThrow(()=>new vm.Script(canvas));
  assert.doesNotThrow(()=>new vm.Script(study));
 }
});

test('desktop-only modules stay out of the Android Free editor',()=>{
 const {entries,source}=sourceFor(android);
 for(const file of ['workspace-view-metadata.js','layout-text-controls.js','layout-tab-order.js','layout-ui-controls.js',
  'layout-audit-import.js','layout-geometry.js','layout-menu-import.js']){
  assert.ok(!entries.includes(file),'desktop-only module leaked into Android: '+file);
 }
 // The Android dictionary, product locale and Home are platform-local sources.
 // Their presence and order are verified by the Android shell test above.
 assert.ok(!source.includes('function nmArchiveViewWorkspaces(raw,tabs=[])'));
});
