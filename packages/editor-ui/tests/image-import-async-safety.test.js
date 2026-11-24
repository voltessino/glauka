'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const PLATFORM_FILES=['apps/desktop-shared/editor/io.js','apps/android/editor/io.js'];
function harness(filename){
 const source=fs.readFileSync(path.join(ROOT,filename),'utf8').replace(/\r\n?/g,'\n');
 const begin=source.indexOf('      attachImageFileToNode(file, targetNodeId = null, dropWorldPos = null) {');
 const finish=source.indexOf('\n      }\n\n    }',begin);
 assert.ok(begin>=0&&finish>begin,filename+': missing importer');
 const method=source.slice(begin,finish+8);
 const readers=[],pictures=[];
 class FakeReader {
  readAsDataURL(file){this.file=file;readers.push(this);}
 }
 class FakePicture {
  set src(url){this.url=url;pictures.push(this);}
 }
 const run=new Function('FileReader','Image','return ({'+method+'}).attachImageFileToNode;')(
  FakeReader,FakePicture
 );
 return {
  run,readers,pictures,
  read(n=0){const reader=readers[n];reader.onload({target:{result:reader.file.dataUrl}});},
  readFail(n=0){readers[n].onerror(new Error('failed read'));},
  decode(n=0,width=48,height=32){
   const image=pictures[n];image.naturalWidth=width;image.naturalHeight=height;image.onload();
  },
  decodeFail(n=0){pictures[n].onerror(new Error('failed decode'));}
 };
}
function state(label){
 return {
  label,images:[],
  findNode(id){return id===label+'-node'?{id,text:'Topic'}:null;},
  addImageItem(data){this.images.push(data);return data;}
 };
}
function appWith(stateValue=state('first')){
 const toast=[];
 const app={
  state:stateValue,activeTabId:'tab-first',
  layout:{getLayout:()=>({x:100,y:200,height:40})},
  showToast:(message,type)=>toast.push({message,type}),
  markChanged(){app.changes=(app.changes||0)+1},
  updateImageControls(){app.refreshes=(app.refreshes||0)+1}
 };
 return {app,toast};
}
function file(options={}){
 return {type:'image/png',name:'picture.png',size:1024,
  dataUrl:'data:image/png;base64,AQID',...options};
}
for(const filename of PLATFORM_FILES){
 test(filename+' — image arriving after a tab switch cannot corrupt another map',()=>{
  const h=harness(filename),a=appWith(),other=state('second');
  h.run.call({app:a.app},file(),null,{x:12,y:33});
  a.app.state=other;a.app.activeTabId='tab-second';
  h.read();
  assert.equal(h.pictures.length,0);
  assert.equal(other.images.length,0);
  assert.equal(a.app.changes||0,0);
 });
 test(filename+' — tab switch while decoding cancels the pending import',()=>{
  const h=harness(filename),a=appWith(),original=a.app.state,other=state('second');
  h.run.call({app:a.app},file(),'first-node');
  h.read();
  assert.equal(h.pictures.length,1);
  a.app.state=other;a.app.activeTabId='tab-second';
  h.decode();
  assert.equal(original.images.length,0);
  assert.equal(other.images.length,0);
  assert.equal(a.app.changes||0,0);
 });
 test(filename+' — regular PNG attached/JPEG free saves finite coordinates',()=>{
  const h=harness(filename),a=appWith(),img=file();
  h.run.call({app:a.app},img,'first-node');h.read();h.decode();
  assert.equal(a.app.state.images.length,1);
  const attached=a.app.state.images[0];
  assert.equal(attached.mode,'attached');
  assert.equal(attached.attachedNodeId,'first-node');
  assert.equal(attached.width,135);
  assert.equal(attached.height,90);
  assert.equal(attached.worldPos.x,100);
  h.run.call({app:a.app},file({type:'image/jpeg',name:'camera.jpg',
   dataUrl:'data:image/jpeg;base64,AQID'}),null,{x:NaN,y:Infinity});
  h.read(1);h.decode(1);
  const free=a.app.state.images[1];
  assert.equal(free.mode,'free');
  assert.equal(free.attachedNodeId,null);
  assert.equal(free.worldPos.x,0);
  assert.equal(free.worldPos.y,0);
  assert.equal(a.app.changes,2);
  assert.equal(a.app.refreshes,2);
 });
 test(filename+' — reject oversize, empty, SVG and unexpected file types before allocating a reader',()=>{
  const h=harness(filename),a=appWith();
  for(const attempt of [
   file({type:'image/svg+xml',name:'script.svg'}),
   file({type:'application/javascript',name:'script.js'}),
   file({size:0}),
   file({size:32*1024*1024+1}),
   file({type:'',name:'unknown.abc'}),
   file({size:NaN})
  ])h.run.call({app:a.app},attempt,null);
  assert.equal(h.readers.length,0);
  assert.equal(a.app.state.images.length,0);
  assert.equal(a.toast.length,6);
  h.run.call({app:a.app},file({type:'',name:'valid.webp'}),null);
  assert.equal(h.readers.length,1,'image extension fallback for unknown OS MIME');
 });
 test(filename+' — corrupted image and I/O errors report failures without modifying document',()=>{
  const h=harness(filename),a=appWith();
  h.run.call({app:a.app},file(),null);h.readFail();
  h.run.call({app:a.app},file(),null);h.read(1);h.decodeFail();
  assert.equal(a.app.state.images.length,0);
  assert.equal(a.toast.length,2);
  assert.equal(a.app.changes||0,0);
 });
 test(filename+' — decoded geometry rejects empty and huge images, bounds extreme ratios',()=>{
  const h=harness(filename),a=appWith();
  for(const [w,hh] of [[0,30],[20,0],[1e6,100],[10,1e7]]){
   const n=h.readers.length;h.run.call({app:a.app},file(),null);
   h.read(n);h.decode(n,w,hh);
  }
  assert.equal(a.app.state.images.length,0);
  assert.equal(a.toast.length,4);
  for(const [w,hh] of [[1,1e7/200],[1e7/200,1]]){
   const n=h.readers.length;h.run.call({app:a.app},file(),null);
   h.read(n);h.decode(n,w,hh);
  }
  assert.equal(a.app.state.images.length,2);
  for(const img of a.app.state.images){
   assert.ok(Number.isFinite(img.width)&&img.width>=1&&img.width<=135);
   assert.ok(Number.isFinite(img.height)&&img.height>=1&&img.height<=600);
  }
 });
}
