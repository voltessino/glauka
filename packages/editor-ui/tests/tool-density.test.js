'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../workspace-layout.css'),'utf8').replace(/\r\n?/g,'\n');

test('style ribbon groups bold italic and underline without a second font-size readout',()=>{
 const emphasis=css.match(/body\.nm-workspace-v2 #nm-text-emphasis \{([^}]+)\}/g);
 assert.ok(emphasis);
 assert.match(emphasis[emphasis.length-1],/display:\s*flex/);
 assert.match(emphasis[emphasis.length-1],/gap:\s*6px/);
 assert.match(emphasis[emphasis.length-1],/margin:\s*0 0 var\(--nm-skin-pad,\s*12px\)/);
 const buttons=[...css.matchAll(/body\.nm-workspace-v2 #nm-text-emphasis > button:not\(\[hidden\]\)\s*\{([^}]+)\}/g)];
 const final=buttons[buttons.length-1][1];
 assert.match(final,/flex:\s*0 0 34px\s*;/);
 assert.match(final,/width:\s*34px\s*;/);
 assert.match(final,/height:\s*34px\s*;/);
 assert.match(final,/border-radius:\s*9px\s*!important/);
 assert.match(css,/body\.nm-workspace-v2 #nm-text-emphasis > #btn-weight-bold \{[^}]*border-radius:\s*9px\s*!important/);
 assert.match(css,/body\.nm-workspace-v2 #nm-text-emphasis > #nm-text-underline \{[^}]*border-radius:\s*9px\s*!important/);
 assert.match(css,/body\.nm-workspace-v2 #nm-text-emphasis #nm-list-trigger[\s\S]*?min-height:\s*34px/);
 assert.match(css,/#inspector-sidebar \.nm-setting-control:has\(> #inspector-fontsize-slider\)/);
});

test('node color palette is a compact square grid and map themes stay separate',()=>{
 assert.match(css,/body\.nm-workspace-v2 #inspector-swatch-grid\.color-swatch-grid \{[^}]*repeat\(auto-fill,\s*minmax\(28px,\s*1fr\)\)[^}]*gap:\s*var\(--nm-skin-gap,\s*8px\)/);
 assert.match(css,/body\.nm-workspace-v2 #inspector-sidebar \.custom-color-row \{[^}]*display:\s*flex[^}]*gap:\s*var\(--nm-skin-gap,\s*8px\)/);
 assert.match(css,/body\.nm-workspace-v2 #inspector-sidebar \.theme-grid \{[^}]*gap:\s*var\(--nm-skin-gap,\s*8px\)/);
 assert.match(css,/body\.nm-workspace-v2 #inspector-sidebar \.theme-card-btn \{[^}]*padding:\s*var\(--nm-skin-control-pad,\s*8px\)/);
 const swatch=css.match(/body\.nm-workspace-v2 #inspector-swatch-grid \.color-swatch \{([^}]+)\}/);
 assert.ok(swatch);
 assert.match(swatch[1],/aspect-ratio:\s*1/);
 assert.match(swatch[1],/width:\s*100%/);
 assert.match(swatch[1],/min-height:\s*0\s*!important/);
 assert.match(css,/body\.nm-workspace-v2 #inspector-sidebar \.theme-grid \{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
 assert.match(css,/body\.nm-workspace-v2 #inspector-sidebar \.theme-card-btn \{[^}]*background:\s*var\(--nm-ui-top/);
 assert.match(css,/body\.nm-workspace-v2 #nm-text-alignment \.nm68-align-buttons button \{[^}]*height:\s*40px/);
});
