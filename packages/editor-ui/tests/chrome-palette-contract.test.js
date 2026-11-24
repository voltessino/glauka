'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const skin=require('../ui-skin-core');
const orbit=require('../orbit-core');

test('every interface palette has a valid independent selection and automatic accent',()=>{
 assert.equal(skin.THEMES.length,10);
 assert.equal(new Set(skin.THEMES.map(item=>item.id)).size,10);
 assert.equal(skin.THEMES[0].id,'prisma');
 assert.equal(skin.THEMES[1].id,'slate');
 for(const theme of skin.THEMES){
  assert.equal(skin.read({theme:theme.id}).theme,theme.id);
  assert.equal(skin.visible({theme:theme.id},true),theme.id);
 }
 assert.deepEqual(orbit.accents,['auto','cyan','violet','amber']);
 assert.equal(orbit.read(null).accent,'auto');
 assert.equal(orbit.read({accent:'cyan'}).accent,'cyan');
 assert.equal(orbit.read({accent:'purple'}).accent,'auto');
});

test('Compass navigation CSS never hard-codes former blue/violet UI selections',()=>{
 const composeUiSource=require('./helpers/compose-ui-source.cjs');
 const nav=composeUiSource('navigation-experience');
 const rail=read('packages/editor-ui/workspace-chrome.js');
 const chrome=read('packages/editor-ui/luminous-chrome.css');
 const layout=read('apps/desktop-shared/editor/editor.css');
 for(const former of ['#53418c','#332b67','#7b4494','#223453','#382f63']){
  assert.ok(!nav.includes(former),'obsolete navigation accent '+former);
 }
 for(const former of ['#087ff8','#0342c6','#092b9e']){
  assert.ok(!chrome.includes(former),'selected chrome still uses '+former);
 }
 assert.match(nav,/#nm616-nav-focus\{background:var\(--nm-theme-action/);
 assert.match(rail,/#nm616-nav-disclosure>summary::after\{content:'⌄';color:var\(--nm-theme-focus/);
 assert.match(layout,/#nm614-navigation-flyout[\s\S]*?background:var\(--nm-skin-surface/);
 assert.match(read('apps/desktop-shared/editor/saving.js'),/Strumenti rapidi Glauka/);
});

test('theme contracts cover Compass, dialog controls, high contrast and previews',()=>{
 const sheet=read('packages/editor-ui/interface-theme.css');
 const css=sheet.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'invalid CSS brace count');
 for(const value of ['#nm614-open-navigation','#nm616-nav-focus','#nm616-nav-caption',
   '#nm616-minimap-shell','.nm-export-dialog','.nm-creative-dialog','.nm-settings-panel']){
  assert.ok(sheet.includes(value),'theme contract missing '+value);
 }
 assert.match(sheet,/\[data-nm-skin="prisma"\]\[data-nm-skin-contrast="high"\]/);
 assert.match(sheet,/--nm-theme-on-action/);
 assert.match(sheet,/user-authored colors/);
 assert.match(sheet,/minimap canvas/);
});

test('Compass structural cards and breadcrumbs inherit the selected theme',()=>{
 const sheet=read('packages/editor-ui/interface-theme.css');
 const presentation=read('packages/editor-ui/presentation-experience.js');
 assert.match(sheet,/#nm614-navigation-flyout\s+:is\(div, section, nav, details, header, footer\)/);
 assert.match(sheet,/#nm616-context-path \.nm616-crumb\s*\{/);
 assert.match(sheet,/#nm616-context-path \.nm616-crumb:last-child\s*\{/);
 assert.match(sheet,/background: var\(--nm-navigation-hover\) !important/);
 assert.match(presentation,/#nm616-context\{[^\n]*background:var\(--nm-skin-surface/);
 assert.match(presentation,/#nm616-context-path \.nm616-crumb:hover\{background:color-mix/);
 assert.match(presentation,/#nm616-context-actions button\{[^\n]*background:var\(--nm-skin-top/);
 for(const color of ['#394368','#203452','#3e4777','#a9bfe4','#f2eaff']){
  assert.ok(!presentation.includes(color),'old hard-coded Compass color '+color);
 }
});

test('Compass level wrapper cannot keep the obsolete dark tile',()=>{
 const sheet=read('packages/editor-ui/interface-theme.css');
 const editor=read('apps/desktop-shared/editor/editor.css');
 const html=read('apps/desktop-shared/src/resources/index.html');
 assert.match(editor,/\.nm69-nav-level\{[^}]*background:transparent/);
 assert.doesNotMatch(editor,/\.nm69-nav-level\{[^}]*#111a30/);
 assert.doesNotMatch(editor,/\.nm69-nav-level select\{[^}]*#18233e/);
 assert.doesNotMatch(editor,/\.nm612-nav-order select\{[^}]*#19213d/);
 assert.match(html,/<label class="nm69-nav-level"[^>]*>.*?<select id="nm69-nav-level"/);
 assert.match(html,/<label class="nm612-nav-order"[^>]*>.*?<select id="nm612-nav-order"/);
 assert.match(sheet,/#nm614-navigation-flyout\s+#nm7-advanced-navigation\s+:is\(label\.nm69-nav-level, label\.nm612-nav-order\)\s*\{[\s\S]*?color: var\(--nm-skin-muted\) !important;/);
 assert.match(sheet,/#nm614-navigation-flyout\s+:is\(#nm69-nav-level, #nm612-nav-order\)\s*\{[\s\S]*?background: var\(--nm-navigation-control\) !important;/);
 assert.match(sheet,/#nm614-navigation-flyout\s+:is\(#nm69-nav-level, #nm612-nav-order\) option\s*\{[\s\S]*?background: var\(--nm-skin-surface\)/);
});

test('both light interface skins declare light native control rendering',()=>{
 const theme=read('packages/editor-ui/interface-theme.css');
 const learning=read('apps/desktop-shared/editor/learn-ui.js').replace('/* @neuromap-learn-ui-session */\n',read('apps/desktop-shared/editor/learn-ui-session.js'));
 const source=read('packages/editor-ui/ui-skin-core.js');
 assert.match(theme,/body:is\(\[data-nm-skin="prisma"\], \[data-nm-skin="minimal"\]\)\s*\{\s*color-scheme: light;/);
 assert.match(learning,/#nm-learn-panel :is\(input,select\)\{[^}]*color-scheme:inherit/);
 assert.doesNotMatch(learning,/color-scheme:dark/);
 assert.ok(source.includes("id:'prisma'"));
 assert.ok(source.includes("id:'minimal'"));
});
test('source dialog, picker, navigation and learning controls use the same theme tokens',()=>{
 const files=[
  'apps/desktop-shared/editor/editor.css','packages/editor-ui/topbar-curation.js',
  'apps/desktop-shared/editor/learn-ui.js','packages/editor-ui/first-steps.js',
  'packages/editor-ui/view-picker.js'
 ];
 const sources=Object.fromEntries(files.map(p=>[p, p.endsWith('learn-ui.js')
  ? read(p).replace('/* @neuromap-learn-ui-session */\n',read('apps/desktop-shared/editor/learn-ui-session.js'))
  : read(p)]));
 for(const [p,s] of Object.entries(sources)){
  assert.match(s,/var\(--nm-skin-(?:surface|top|ink|stroke|muted)/,p+' not palette-driven');
 }
 const learn=sources['apps/desktop-shared/editor/learn-ui.js'];
 assert.match(learn,/font:13px\/1\.4 system-ui;color-scheme:inherit/);
 assert.doesNotMatch(learn,/color-scheme:dark/);
 assert.doesNotMatch(learn,/\[data-nm-skin="minimal"\] #nm-learn-panel :is\(input,select\)/);
 const editor=sources['apps/desktop-shared/editor/editor.css'];
 assert.match(editor,/\.nm67-notes-modal\{[^}]*var\(--nm-skin-surface/);
 assert.match(editor,/#nm67-notes-editor,#nm67-notes-preview\{[^}]*var\(--nm-skin-top/);
 const view=sources['packages/editor-ui/view-picker.js'];
 assert.match(view,/\.nm-view-choice\[aria-checked=true\]\{background:var\(--nm-theme-action/);
 const guide=sources['packages/editor-ui/first-steps.js'];
 assert.match(guide,/#nm7-guide-dialog li\{[^}]*background:var\(--nm-skin-top/);
 assert.doesNotMatch(guide,/#nm7-guide-dialog li strong\{[^}]*color:#fff/);
 const top=sources['packages/editor-ui/topbar-curation.js'];
 assert.match(top,/\.nm7-nav-label\{[^}]*color:var\(--nm-skin-muted/);
});
test('desktop build bundles the identical shared chrome contract for Windows and macOS',()=>{
 const script=read('scripts/release/prepare.py');
 for(const key of ['interface-theme.css','luminous-chrome.css','workspace-skins','navigation-experience','workspace-chrome']){
  assert.ok(script.includes(key),'release preparation omits '+key);
 }
});
