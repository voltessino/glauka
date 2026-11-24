'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../../../apps/desktop-shared/editor/visual-study-core.js');
test('image coordinates remain relative and bounded after zoom changes',()=>{
 const r=H.locate({left:100,top:50,width:400,height:200},200,100);
 assert.deepEqual(r,{x:.25,y:.25});
 assert.throws(()=>H.locate({left:0,top:0,width:0,height:100},0,0),/unavailable/);
});
test('reject malformed or duplicate hotspots, limit memory and preserve reference',()=>{
 const h={x:.3,y:.5,nodeId:'n_123',label:'Aorta'};
 const one=H.add([],h);
 assert.equal(one.length,1);assert.equal(one[0].nodeId,h.nodeId);
 assert.throws(()=>H.add(one,h),/duplicated/);
 assert.deepEqual(H.normalize([{...h,x:9}]),[]);
 assert.deepEqual(H.normalize(one),one);
 const q=H.quiz(one,id=>id==='n_123');
 assert.equal(q.length,1);assert.equal(q[0].hotspot.label,'Aorta');
});
test('malformed image hotspot fields cannot influence cloned model',()=>{
 assert.deepEqual(H.normalize([{x:'NaN',y:.1,nodeId:'ok',label:'bad'}]),[]);
 assert.deepEqual(H.normalize([{x:.1,y:.1,nodeId:'<img>',label:'bad'}]),[]);
 assert.deepEqual(H.normalize([{x:.1,y:.1,nodeId:'n_1',label:''}]),[]);
});