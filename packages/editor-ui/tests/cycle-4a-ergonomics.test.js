'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('desktop close controls and the side grip meet the 32px target',()=>{
 const css=read('apps/desktop-shared/editor/editor.css');
 const layout=read('packages/editor-ui/workspace-layout.css');
 assert.match(css,/width: 32px;\s*height: 32px;/);
 assert.match(css,/\.v6-native-fallback\{display:none!important/);
 assert.match(css,/#btn-close-inspector\{width:32px;height:32px/);
 assert.match(css,/\.tab-close-btn:focus-visible/);
 assert.match(layout,/width:2px;/);
 assert.match(layout,/cursor:col-resize/);
 assert.match(layout,/left:0!important/);
 assert.match(layout,/margin:0!important/);
 assert.match(layout,/box-sizing:border-box!important/);
 assert.doesNotMatch(layout,/margin:0 0 0 -6px/);
 assert.doesNotMatch(layout,/translateX\(-12px\)/);
 assert.doesNotMatch(layout,/\.nm-panel-resize-handle::after/);
 assert.match(layout,/--nm-inspector-panel-width,var\(--nm-right-panel-width,360px\)/);
});

test('a missing saved width opens the inspector at 360 and a saved width is kept',()=>{
 const source=read('packages/editor-ui/workspace-layout-lists-chrome.js');
 assert.match(source,/fallback:360/);
 assert.match(source,/return fallback;/);
 assert.match(source,/event\.key==="Escape"/);
 assert.doesNotMatch(source,/nm\.workspace\.inspectorWidth\.v1[\s\S]{0,80}return 360/);
});

test('hidden font preset is not a pointer target and the number field stays usable',()=>{
 const html=read('apps/desktop-shared/src/resources/index.html');
 const brand=read('packages/editor-ui/glauka-brand.css');
 assert.match(html,/id="v5-font-preset"[^>]*aria-hidden="true"/);
 assert.match(html,/id="v6-preset-trigger"/);
 assert.match(brand,/#glauka-font-size \{\s*min-width: 4\.5rem;/);
 assert.match(read('packages/editor-ui/luminous-chrome.css'),/--nm-type-control: 14px;/);
});

test('Android close control uses a larger touch area',()=>{
 const css=read('apps/android/native/app/src/main/assets/assets/mobile-app.css');
 assert.match(css,/body\.glauka-mobile-app \.tab-close-btn \{\s*width: 48px;\s*height: 48px;/);
});

test('prisma skin CSS excludes the startup splash and teardown skips duplicate flushes',()=>{
 const brand=read('packages/editor-ui/glauka-brand.css');
 assert.match(brand,/body\.nm-workspace-v2\[data-nm-skin="prisma"\]\s*>\s*:not\([^)]*#glauka-startup[^)]*\)/);
 const lifecycle=read('packages/editor-ui/lifecycle.js');
 assert.match(lifecycle,/pagehide',\(\)=>\{if\(!approvedNativeExit&&!discardedNativeExit\)flush\(\)/);
 assert.match(lifecycle,/visibilitychange',\(\)=>\{if\(document\.hidden&&!approvedNativeExit&&!discardedNativeExit\)flush\(\)/);
});
