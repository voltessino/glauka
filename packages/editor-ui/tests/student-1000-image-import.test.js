'use strict';
// 2,000 deterministic calls against actual desktop/Android image-import method bodies.
// Uses mock FileReader + Image: verifies dispatch and mapping, NOT real image decoding.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {STUDENTS}=require('../../../tests/browser/fixtures/student-1000-profiles');
const ROOT=path.resolve(__dirname,'../../..');
function importMethod(filename,dimensions={width:48,height:32}){
 const source=fs.readFileSync(path.join(ROOT,filename),'utf8').replace(/\r\n?/g,'\n');
 const head='      attachImageFileToNode(file, targetNodeId = null, dropWorldPos = null) {';
 const start=source.indexOf(head),end=source.indexOf('\n      }\n\n    }',start);
 assert.ok(start>=0&&end>start,'image import method missing from '+filename);
 const method=source.slice(start,end+8);
 class FileReader{
  readAsDataURL(file){
   if(file instanceof Error)throw file;
   this.onload({target:{result:file.dataUrl}});
  }
 }
 class Image{
  set src(value){
   if(typeof value==='string'){
    this.naturalWidth=dimensions.width;this.naturalHeight=dimensions.height;this.onload();
   }
  }
 }
 // Compiled only from trusted source files in this repository; avoid evaluating
 // imported/user-supplied image data. Equivalent technique to existing layout tests.
 return new Function('FileReader','Image','return ({'+method+'}).attachImageFileToNode;')(
  FileReader,Image
 );
}
for(const location of [
 'apps/desktop-shared/editor/io.js',
 'apps/android/editor/io.js'
]){
 test(location+' · 1,000 international attached/free imports preserve intended nodes',()=>{
  const importImage=importMethod(location);
  let attached=0,free=0;
  for(let i=0;i<STUDENTS.length;i++){
   const student=STUDENTS[i];
   const expectedMode=i%2===0?'attached':'free';
   const target='node-'+i,images=[],nodes=new Map([[target,{id:target,text:student.subject}]]);
   const app={
    state:{findNode:id=>nodes.get(id)||null,addImageItem:payload=>images.push(payload)},
    layout:{getLayout:()=>({x:i*2,y:100,height:40})},
    markChanged(){this.changed=true},
    updateImageControls(){this.refreshed=true},
    showToast(){this.notified=true}
   };
   importImage.call({app},{type:'image/png',size:128,name:'test.png',dataUrl:'data:image/png;base64,AA=='},
    expectedMode==='attached'?target:null,{x:33+i,y:-5});
   assert.equal(images.length,1);
   const img=images[0];
   assert.equal(img.mode,expectedMode);
   assert.equal(img.naturalWidth,48);
   assert.equal(img.naturalHeight,32);
   assert.equal(img.aspectLocked,true);
   if(expectedMode==='attached'){
    assert.equal(img.attachedNodeId,target);
    assert.equal(img.worldPos.x,i*2);
    attached++;
   }else{
    assert.equal(img.attachedNodeId,null);
    assert.equal(img.worldPos.x,33+i);
    free++;
   }
   assert.equal(app.changed,true);
   assert.equal(app.refreshed,true);
   assert.equal(app.notified,true);
  }
  assert.equal(attached,500);
  assert.equal(free,500);
 });
}

for(const location of [
 'apps/desktop-shared/editor/io.js',
 'apps/android/editor/io.js'
]){
 test(location+' · zero-size decoded images never reach map state',()=>{
  const importImage=importMethod(location,{width:0,height:120});
  let mutated=false,warning=false;
  const app={
   state:{addImageItem(){mutated=true;}},
   markChanged(){mutated=true;},
   updateImageControls(){mutated=true;},
   showToast(){warning=true;}
  };
  importImage.call({app},{type:'image/png',size:128,name:'test.png',dataUrl:'data:image/png;base64,AA=='},null,{x:0,y:0});
  assert.equal(mutated,false);
  assert.equal(warning,true);
 });
 test(location+' · pathological aspect ratios yield finite, bounded image geometry',()=>{
  for(const dimensions of [{width:1,height:10000000},{width:10000000,height:1}]){
   const importImage=importMethod(location,dimensions),pictures=[];
   const app={
    state:{addImageItem:data=>pictures.push(data)},
    markChanged(){},updateImageControls(){},showToast(){}
   };
   importImage.call({app},{type:'image/png',size:128,name:'test.png',dataUrl:'data:image/png;base64,AA=='},null,{x:0,y:0});
   assert.equal(pictures.length,1);
   assert.ok(Number.isFinite(pictures[0].width)&&pictures[0].width>=1&&pictures[0].width<=135);
   assert.ok(Number.isFinite(pictures[0].height)&&pictures[0].height>=1&&pictures[0].height<=600);
  }
 });
}
