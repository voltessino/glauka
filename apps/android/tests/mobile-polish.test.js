'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../native/app/src/main/assets');
const source=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const html=source('app/index.html');
const tools=source('assets/mobile-74.js');
const style=source('assets/mobile-ui-polish.css');
const node=source('assets/mobile-node-actions.js');
const dock=source('assets/mobile.js');
test('Orbit is fully absent from Android production HTML and replaced by unified mobile styling',()=>{
 assert.doesNotMatch(html,/mobile-orbit(?:-toggle)?\.(?:css|js)|nm-orbit-stylesheet/);
 assert.match(html,/mobile-ui-polish\.css/);
 assert.match(html,/mobile-node-actions\.js/);
 assert.ok(html.indexOf('mobile-ui-polish.css')>html.indexOf('mobile-commands.css'));
 assert.ok(html.indexOf('mobile-node-actions.js')>html.indexOf('mobile-74.js'));
 assert.equal(fs.existsSync(path.join(ROOT,'assets/mobile-orbit.css')),false);
 assert.equal(fs.existsSync(path.join(ROOT,'assets/mobile-orbit-toggle.js')),false);
});
test('Android dialogs use one legible set of semantic colors',()=>{
 for(const selector of ['#nm74-overlay .nm74-sheet','.nm-android-import','.nm-android-commands-panel','#nm74-overlay .nm74-field > span']){
  assert.ok(style.includes(selector),selector+' missing');
 }
 assert.match(style,/--gl-mobile-accent:\s*var\(/);
 assert.match(style,/--gl-mobile-ink:/);
 assert.match(style,/--gl-mobile-paper:/);
 assert.match(style,/color-scheme:\s*light/);
 assert.match(style,/body\.nm-workspace-v2\.nm-android-light/);
});
test('Document, PDF, TSV and JSON selectors preserve real native file inputs with separate pick action',()=>{
 assert.match(tools,/const fileField\s*=/);
 assert.match(tools,/picker\.type\s*=\s*['"]file['"]/);
 assert.match(tools,/choose\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*picker\.click\(\)\)/);
 assert.match(tools,/picker\.files\?\.\[0\]\?\.name/);
 assert.equal((tools.match(/=\s*fileField\(/g)||[]).length,4);
 for(const cssClass of ['nm74-native-file','nm74-file-pick','nm74-file-name'])assert.ok(style.includes(cssClass));
});
test('Android tools use the shared eight-language preference with pending-edit protection',()=>{
 assert.match(tools,/root\.GlaukaI18n\?\.pair/);
 assert.match(tools,/hasPendingLanguageEdits/);
 assert.match(tools,/hasCaptureDraft/);
 assert.doesNotMatch(tools,/localePicker|localeFooter/);
 const languages=fs.readFileSync(path.resolve(__dirname,'../../../packages/editor-ui/android-languages.js'),'utf8');
 assert.match(languages,/locale\.languages/);
 assert.match(languages,/locale\.setLanguage/);
 assert.match(languages,/hasPendingLanguageEdits/);
});
test('Contextual actions are not destructive on touch and require confirmation',()=>{
 assert.match(node,/selectedNodeId/);
 assert.match(node,/state\.root\?\.id/);
 assert.match(node,/c\.app\.nmAsk/);
 assert.match(node,/accepted=answer==='delete'/);
 assert.match(node,/if\(!accepted\)return/);
 assert.match(node,/c\.app\.deleteSelected\(\)/);
 assert.match(node,/c\.app\.scheduleSave\?\.\(\)/);
 assert.match(node,/armed=false/);
 assert.match(style,/#gl-mobile-node-actions\[hidden\]/);
});
test('Android phone panels suppress minimize strips, touch help tooltips and stack AI Studio with a scrim',()=>{
 const mobileCss=source('assets/mobile-app.css');
 const mobileJs=source('assets/mobile-app.js');
 const creativeHelp=fs.readFileSync(path.resolve(__dirname,'../../../packages/editor-ui/creative-help.js'),'utf8');
 const creativeUi=fs.readFileSync(path.resolve(__dirname,'../../../packages/editor-ui/creative-ui.js'),'utf8');
 const aiForm=fs.readFileSync(path.resolve(__dirname,'../../../packages/editor-ui/ai-studio-mount-panel-form.js'),'utf8');
 assert.match(creativeHelp,/onTouchUi/);
 assert.match(creativeHelp,/glauka-mobile-app/);
 assert.match(creativeUi,/onPhone\(\)/);
 assert.match(aiForm,/onPhone/);
 assert.match(mobileJs,/glauka-ai-scrim/);
 assert.match(mobileJs,/syncAiScrim/);
 assert.match(mobileCss,/#glauka-ai-scrim/);
 assert.match(mobileCss,/#nm-ai-studio\s*>\s*\.nm-ai-service-bar[\s\S]*?flex-direction:\s*row/);
});
