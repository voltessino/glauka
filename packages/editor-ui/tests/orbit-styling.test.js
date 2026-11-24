const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const styles=fs.readFileSync(path.join(__dirname,'../orbit-workspace.css'),'utf8');
const actions=fs.readFileSync(path.join(__dirname,'../orbit-workspace.js'),'utf8');

test('Orbit desktop theme covers chrome, tabs, inspector, toolbars and overlays',()=>{
 for(const selector of ['.top-chrome','.tab-item.active','.topbar.nm-ribbon',
   '#inspector-sidebar','.hud-bottom-left','#nm-orbit-command-dialog',
   '#nm-orbit-desktop-settings'])
   assert.ok(styles.includes(selector),selector);
});
test('all futuristic CSS is presentation-only and the canvas is never recolored',()=>{
 assert.doesNotMatch(styles,/#(?:mindmap-canvas|map-canvas)\s*\{/);
 assert.doesNotMatch(styles,/(?:\.node\.color|canvas\.style|\.children\s*=)/);
 assert.match(styles,/body\.nm-orbit-workspace/);
 assert.match(styles,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
test('theme supports three Orbit accents, compact layout, accessible focus and keyboard palette',()=>{
 for(const v of ['cyan','violet','amber'])assert.ok(styles.includes(v));
 assert.match(styles,/data-nm-orbit-density="compact"/);
 assert.match(styles,/:focus-visible/);
 assert.match(actions,/Ctrl\+Maiusc\+P/);
 assert.match(actions,/aria-modal/);
});
test('Orbit script does not touch the canonical state machine, save paths or editor layout',()=>{
 assert.doesNotMatch(actions,/(?:pushHistory|\.markChanged\(|\.root\.children\s*=|\.applyGlobalTheme\(|\.save\()/);
 assert.match(actions,/localStorage/);
 assert.doesNotMatch(actions,/innerHTML\s*=/);
});
