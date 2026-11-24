const {test}=require('node:test');
const assert=require('node:assert/strict');
global.NeuroMapCreativeModules={ui:{}};
(()=>{const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const dir=path.join(__dirname,'..');const filename=path.join(dir,'creative-formatting.js');
let source=fs.readFileSync(filename,'utf8').replace('/* @neuromap-creative-formatting-values */\n',fs.readFileSync(path.join(dir,'creative-formatting-values.js'),'utf8'));
const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(dir);mod._compile(source,filename);})();
const {clean}=NeuroMapCreativeModules.formatting;
test('future-map continuation preferences do not retain another map’s logical IDs or measured floor',()=>{
 const value=clean({layoutDistribution:{enabled:true,height:2800,minimumHeight:2600,anchorSides:{privateNode:'right'}}},['layoutDistribution']);
 assert.deepEqual(value,{layoutDistribution:{enabled:true,height:2800,minimumHeight:480}});
});
test('continuation preferences preserve valid expanded limits and reject non-finite heights',()=>{
 assert.equal(clean({layoutDistribution:{enabled:true,height:16000}},['layoutDistribution']).layoutDistribution.height,16000);
 assert.deepEqual(clean({layoutDistribution:{enabled:true,height:Infinity}},['layoutDistribution']),{});
});
