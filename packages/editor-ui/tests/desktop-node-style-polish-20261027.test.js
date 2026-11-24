'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const core=require('../map-style-core');
const composeAppSource=require('./helpers/compose-app-source.cjs');
const app=composeAppSource('desktop-shared');
const renderer=read('apps/desktop-shared/editor/renderer.js');
const svgExporter=read('apps/desktop-shared/editor/io.js');
const gallery=read('packages/editor-ui/map-style-gallery.js');
const theme=read('packages/editor-ui/interface-theme.css');
const chrome=read('packages/editor-ui/orbit-workspace.js');
const textTools=read('packages/editor-ui/node-text-tools.js');
const css=read('packages/editor-ui/glauka-brand.css');

test('unboxed free-label preset is available and has real map application + one Undo',()=>{
 const preset=core.PRESETS.find(x=>x.id==='free');
 assert.ok(preset);
 assert.equal(preset.nodeShape,'plain');
 assert.ok(core.SHAPES.includes('plain'));
 const child={id:'b1',text:'Anatomia',children:[],nodeShape:'card'};
 const root={id:'r',text:'Mappa',children:[child]};
 let histories=0;
 const state={root,selectedNodeId:'b1',selectedNodeIds:['b1'],
  pushHistory(){histories++}};
 const changed=core.apply(state,preset,'selection',{prisma:['#6541df']});
 assert.equal(changed,1);
 assert.equal(histories,1);
 assert.equal(child.nodeShape,'plain');
 assert.equal(root.nodeShape,undefined);
});
test('default canvas nodes are unboxed and a plain selection is a capsule',()=>{
 assert.match(renderer,/const shape=node\.nodeShape\|\|'plain'/);
 assert.match(renderer,/if\(!plain\)this\.nmNodeShapePath/);
 assert.match(renderer,/if\(plain && \(isSelected\|\|isHovered\) && !this\._nmNavExport\)/);
 assert.match(renderer,/this\.paintPlainSelection\(x,y,m\.width,m\.height,!!isSelected\)/);
 assert.match(renderer,/this\.roundRectPath\(x - 6, y - 2, w \+ 12, h \+ 4, 8\)/);
 assert.match(renderer,/ctx\.shadowBlur = selected \? 10 : 0/);
 assert.match(renderer,/skin === 'prisma' \|\| skin === 'minimal'/);
 assert.doesNotMatch(renderer,/ctx\.moveTo\(x\+8,y\+m\.height-2\)/);
});
test('SVG export agrees with the canvas default and excludes card backgrounds',()=>{
 assert.match(svgExporter,/const shape=node\.nodeShape\|\|'plain'/);
 assert.match(svgExporter,/if\(shape==='plain'\|\|shape==='none'\)return ''/);
 assert.match(svgExporter,/nmMapShapeSVG\(node,x,y,m\.width,m\.height-3\)/);
});
test('inline editor shares the label position and has no duplicate floating card',()=>{
 assert.match(app,/worldToScreen\(m\.x\+icon\/2,labelY\)/);
 assert.match(app,/this\.renderer\.inlineEditingNodeId=node\.id/);
 assert.match(app,/this\.layout\.editingLabel=\{id:this\.editorNodeId,text:/);
 assert.match(read("apps/desktop-shared/editor/editor.css"),/background:transparent!important/);
 assert.match(read("apps/desktop-shared/editor/editor.css"),/backdrop-filter:none!important/);
});
test('inspector exposes borderless and outlined shapes through existing undo-safe application',()=>{
 assert.match(textTools,/shape\.id="glauka-node-shape"/);
 assert.match(textTools,/\["plain","Senza contorno","No border"\]/);
 assert.match(textTools,/apply\("nodeShape",shape\.value\)/);
 assert.match(textTools,/if \(app\.nmSettingsApplyNode\) app\.nmSettingsApplyNode\(key, value\)/);
 assert.match(css,/\.glauka-node-shape-row/);
});
test('format text actions stay inside the panel without a three-dot portal',()=>{
 assert.match(textTools,/glauka-text-actions/);
 assert.match(textTools,/glauka-font-strike/);
 assert.match(textTools,/underline\.after\(strike\)|nm-text-underline/);
 assert.doesNotMatch(textTools,/document\.body\.append\(menu\)/);
 assert.doesNotMatch(textTools,/summary\.textContent = "⋯"/);
 assert.match(css,/\.glauka-text-actions/);
 assert.match(css,/#v5-font-reset\.glauka-text-reset/);
 assert.match(css,/\.glauka-text-actions \{[\s\S]*?display: flex;/);
 assert.match(css,/\.glauka-text-actions \.glauka-text-action[\s\S]*?min-height: 34px/);
});
test('map style gallery uses readable miniature maps instead of anonymous swatches',()=>{
 assert.match(gallery,/el\('text'/);
 assert.match(gallery,/label:'IDEA'/);
 assert.match(gallery,/label:'Tema'/);
 assert.match(gallery,/label:'Ramo'/);
 assert.match(gallery,/lineWidth\(i===2\?1:0\)/);
 assert.match(gallery,/pointerenter/);
 assert.match(gallery,/\.preview\(app,p,scope\.value,b\)/);
});
test('theme finishing accent and density preferences work across different UI skins',()=>{
 for(const accent of ['cyan','violet','amber']){
  assert.ok(theme.includes('data-nm-orbit-accent="'+accent+'"'));
 }
 assert.match(theme,/data-nm-orbit-density="compact"/);
 assert.match(theme,/--nm-theme-focus:/);
 assert.match(theme,/--nm-theme-action:/);
 assert.match(chrome,/document\.body\.dataset\.nmOrbitAccent=state\.accent/);
 assert.match(chrome,/document\.body\.dataset\.nmOrbitDensity=state\.density/);
 assert.match(chrome,/setSettings\(\{accent\}\)/);
 assert.match(chrome,/setSettings\(\{density\}\)/);
 assert.match(chrome,/const active=state\.enabled/);
});
test('theme finishing never edits node geometry or serializes UI-only preferences with maps',()=>{
 assert.match(chrome,/root\.localStorage\?\.setItem\(core\.STORAGE_KEY,JSON\.stringify\(state\)\)/);
 assert.doesNotMatch(chrome,/node\.nodeShape=|node\.color=|state\.pushHistory\(/);
 assert.match(theme,/Keep.*canvas|This layer never recolors the document canvas/);
});
