const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../media-core');
test('minimum spacing defaults and saved values are stable',()=>{
 assert.deepEqual(m.spacing(null),{compactness:55,branchGapX:30});
 assert.deepEqual(m.spacing({compactness:90,branchGapX:135}),{compactness:90,branchGapX:135});
 assert.deepEqual(m.spacing({compactness:0,branchGapX:900}),{compactness:55,branchGapX:220});
});
test('rotate/crop/frames/caption sanitize without changing source pixels',()=>{
 const p=m.imageProps({rotation:450,crop:{left:20,right:10,top:15,bottom:5},borderRadius:24,frame:'double',caption:'Microscopia',captionAlign:'left',captionFontSize:11});
 assert.deepEqual(p,{rotation:90,crop:{left:20,right:10,top:15,bottom:5},borderRadius:24,frame:'double',caption:'Microscopia',captionAlign:'left',captionFontSize:11});
 assert.deepEqual(m.imageSourceRect(800,600,p.crop),{sx:160,sy:90,sw:560,sh:480});
 assert.deepEqual(m.imageProps(null),{rotation:0,crop:{left:0,right:0,top:0,bottom:0},borderRadius:8,frame:'thin',caption:'',captionAlign:'left',captionFontSize:11});
});
test('links only accept safe fully qualified HTTP(S) URLs',()=>{
 assert.equal(m.safeURL('https://example.org/study?q=1'),'https://example.org/study?q=1');
 for(const value of ['javascript:alert(1)','file:///home/user','data:text/html,<script>','https://user:pass@host.com','localhost','ftp://host.com','https://host.com\nInjection'])assert.equal(m.safeURL(value),'',value);
});
test('nonfinite image rotations normalize to a renderable value',()=>{
 for(const rotation of [NaN,Infinity,-Infinity,'not a number'])assert.equal(m.imageProps({rotation}).rotation,0);
});

test('visual crop can keep an off-centre strip and always retains a nonempty image',()=>{
 assert.deepEqual(m.crop({left:80,right:5,top:2,bottom:3}),{left:80,right:5,top:2,bottom:3});
 const crop=m.crop({left:1000,right:80,top:-10,bottom:Infinity});
 assert.ok(crop.left+crop.right<=95);assert.ok(crop.top+crop.bottom<=95);
 const source=m.imageSourceRect(600,400,crop);assert.ok(source.sw>0&&source.sh>0);
});
