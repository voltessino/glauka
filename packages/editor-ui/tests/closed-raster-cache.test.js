'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../editor-colors.js'),'utf8');
test('closed raster cleanup keeps shared/open, SVG, remote and unrelated cache entries',()=>{
 const {ColorUtils,imageCache}=new Function(source+';return {ColorUtils,imageCache}')();
 const a='data:image/png;base64,A',b='data:image/jpeg;base64,B',svg='data:image/svg+xml;base64,S',remote='https://example.test/image.png',other='data:image/webp;base64,O';
 for(const key of [a,b,svg,remote,other])imageCache.set(key,{key});
 assert.equal(ColorUtils.releaseClosedRasterImages([a,a,b,svg,remote],[b]),1);
 assert.equal(imageCache.has(a),false);for(const key of [b,svg,remote,other])assert.equal(imageCache.has(key),true);
});
test('decoded image cache prefers LRU eviction of completed entries and stays bounded',()=>{
 const {imageCache,rememberCachedImage,touchCachedImage,IMAGE_CACHE_LIMIT}=new Function(
  source+';return {imageCache,rememberCachedImage,touchCachedImage,IMAGE_CACHE_LIMIT}')();
 assert.equal(IMAGE_CACHE_LIMIT,96);
 const pending={complete:false};
 rememberCachedImage('pending',pending);
 for(let i=0;i<IMAGE_CACHE_LIMIT;i++)
  rememberCachedImage('done-'+i,{complete:true,naturalWidth:1,id:i});
 assert.equal(imageCache.has('pending'),true,'still-decoding entry is kept while completed ones fill the budget');
 assert.equal(imageCache.size,IMAGE_CACHE_LIMIT);
 assert.equal(imageCache.has('done-0'),false);
 touchCachedImage('done-1');
 rememberCachedImage('done-extra',{complete:true,naturalWidth:1,id:'extra'});
 assert.equal(imageCache.has('done-1'),true,'recently touched completed image survives the next insert');
 assert.equal(imageCache.has('done-2'),false);
 assert.equal(imageCache.size,IMAGE_CACHE_LIMIT);
});
function app(close){
 const env={};env.globalThis=env;vm.runInNewContext(require('./helpers/compose-graphics.cjs')(),env);
 class App{closeTab(...args){return close.apply(this,args)}}class Renderer{}
 env.NeuroMapGraphics.install(App,Renderer);const a=new App();a.calls=[];a.renderer={releaseClosedRasterImages:(from,keep)=>a.calls.push({from,keep})};return a;
}
test('cancelled async close does not release images',async()=>{
 const a=app(async()=>false),tab={id:'old',state:{images:[{src:'closed'}]}};a.tabs=[tab];a.state=tab.state;a.activeTabId=tab.id;
 assert.equal(await a.closeTab(),false);assert.equal(a.calls.length,0);
});
test('successful async close releases only after removal and includes every open source',async()=>{
 const old={id:'old',state:{images:[{src:'closed'},{src:'shared'},{src:'undo-only'}]}},other={id:'other',state:{images:[{src:'shared'}],undoStack:[null,{images:[null,{src:'undo-only'}]}]}};
 const a=app(async function(){await Promise.resolve();this.tabs=[other];this.state=other.state;return true});a.tabs=[old,other];a.state=old.state;a.activeTabId='old';
 const promise=a.closeTab();assert.equal(a.calls.length,0);assert.equal(await promise,true);
 assert.deepEqual(Array.from(a.calls[0].from),['closed','shared','undo-only']);assert.ok(a.calls[0].keep.has('shared'));assert.ok(a.calls[0].keep.has('undo-only'));
});
test('synchronous and failed closures preserve return/exception semantics and current-state ownership',()=>{
 const old={id:'old',state:{images:[{src:'closed'}]}},other={id:'other',state:{images:[]}};
 const a=app(function(){this.tabs=[other];this.state=other.state;return 7});a.tabs=[old,other];a.state=old.state;a.activeTabId='old';assert.equal(a.closeTab(),7);assert.equal(a.calls.length,1);
 const b=app(()=>{throw Error('cancelled')});b.tabs=[old];b.state=old.state;b.activeTabId='old';assert.throws(()=>b.closeTab(),/cancelled/);assert.equal(b.calls.length,0);
 const c=app(function(){this.tabs=[];return true});c.tabs=[old];c.state=old.state;c.activeTabId='old';c.closeTab();assert.equal(c.calls.length,0);
});
