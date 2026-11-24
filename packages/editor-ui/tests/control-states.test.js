'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('hover, focus and pressed states follow Prisma and Graphite tokens',()=>{
 const theme=read('packages/editor-ui/interface-theme.css');
 const views=read('packages/editor-ui/linked-view-styles.js');
 const tools=read('packages/editor-ui/creative-tools.css');
 assert.match(theme,/--nm-ui-hover:\s*color-mix\(in srgb, var\(--nm-theme-focus\) 16%, var\(--nm-skin-surface\)\)/);
 assert.doesNotMatch(theme,/--nm-ui-hover:\s*var\(--nm-skin-top\)/);
 const ribbon=theme.slice(theme.indexOf('.topbar\n  .toolbar-group\n  button.btn-ui {'));
 assert.match(ribbon,/button\.btn-ui:is\(:hover, \[aria-expanded="true"\]\)[\s\S]*background:\s*var\(--nm-ui-hover\) !important/);
 assert.match(views,/:is\(\[aria-pressed="true"\],\[aria-expanded="true"\]\)\{[\s\S]*var\(--nm-theme-action,#6441df\)/);
 assert.match(views,/outline:2px solid var\(--nm-theme-action,#6441df\)/);
 assert.match(theme,/#nm-view-overlay :is\(button, summary\):focus-visible \{\s*outline: 2px solid var\(--nm-theme-action\) !important;/);
 assert.doesNotMatch(tools,/#nm-creative-launcher button:is\(:hover, :focus-visible\) \{[^}]*outline:\s*none/);
 assert.match(tools,/#nm-creative-launcher button:focus-visible \{\s*outline: 2px solid var\(--nm-theme-action, #6441df\)/);
});
