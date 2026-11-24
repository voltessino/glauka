const{test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('../../../apps/desktop-shared/editor/ocr-quality'),I=require('../../../apps/desktop-shared/editor/ocr-image');
const line=(text,x,y,w=.3,h=.025)=>({text,box:[x,y,w,h],confidence:.9});
test('explicit column order preserves headings and reads left before right',()=>{
 const a=[line('Titolo',.05,.01,.9),line('R1',.56,.2),line('L2',.05,.3),line('L1',.05,.2),line('R2',.56,.3),line('Fine',.05,.8,.9)];
 const before=JSON.stringify(a),r=Q.readingOrder(a,{mode:'columns'});assert.equal(r.text,'Titolo\nL1\nL2\nR1\nR2\nFine');assert.equal(JSON.stringify(a),before);
});
test('table rows preserve paired labels and values with tabs',()=>{
 const a=[line('50 mg',.6,.2),line('Farmaco A',.05,.2),line('Farmaco B',.05,.3),line('10 mg',.6,.3)];
 assert.equal(Q.readingOrder(a,{mode:'rows'}).text,'Farmaco A\t50 mg\nFarmaco B\t10 mg');
 assert.equal(Q.readingOrder(a).mode,'rows');
});
test('ambiguous aligned text columns stay in original engine order until explicitly chosen',()=>{
 const a=[line('a',.05,.2),line('b',.6,.2),line('c',.05,.3),line('d',.6,.3)];
 const r=Q.readingOrder(a);assert.equal(r.mode,'engine');assert.equal(r.ambiguous,true);assert.equal(r.text,'a\nb\nc\nd');
});
test('numeric review detects source changes, repeated doses and ambiguous digits without correcting text',()=>{
 const text='Dose O,5 mg. Valore 1.000 mL. Dose 5 µg.';const r=Q.numericReview(text,'Dose 0,5 mg. Dose 5 µg. Dose 5 µg.');
 assert.ok(r.alerts.some(a=>a.kind==='ambiguous-digit'));assert.ok(r.alerts.some(a=>a.kind==='decimal-separator'));
 assert.equal(r.alerts.filter(a=>a.kind==='differs-from-source').length,2);assert.equal(text,'Dose O,5 mg. Valore 1.000 mL. Dose 5 µg.');
 assert.equal(Q.numericReview('5 IU').alerts.some(a=>a.kind==='ambiguous-digit'),false);
});
test('region coordinates are bounded and finite',()=>{
 assert.deepEqual(Q.region([.1,.2,.4,.2]),[.1,.2,.4,.2]);for(const b of [[0,0,0,1],[-1,0,.5,.5],[.9,0,.2,.5],[0,0,NaN,1]])assert.throws(()=>Q.region(b));
});
test('low-contrast normalization is bounded and blank pages stay unchanged',()=>{
 const blank=new Uint8Array(400).fill(255);assert.equal(I.contrast(blank).apply,false);assert.equal(I.skew(blank,20,20).angle,0);
 const gray=new Uint8Array(1000).fill(190);gray.fill(130,0,100);const c=I.contrast(gray);assert.equal(c.apply,true);assert.ok(c.gain<=2.5);
});
test('skew estimator finds slanted text baselines rather than rotating blank pages',()=>{
 const w=600,h=400,gray=new Uint8Array(w*h).fill(255),angle=2*Math.PI/180;
 for(let row=0;row<6;row++)for(let x=40;x<550;x++)for(let k=0;k<4;k++){const y=Math.round(45+row*48+x*Math.tan(angle))+k;if(x%21<13)gray[y*w+x]=20}
 const r=I.skew(gray,w,h);assert.ok(Math.abs(r.angle-2)<.6,JSON.stringify(r));
});
test('inverse deskew boxes stay on the original page and identity is exact',()=>{
 const b=I.sourceBox([.1,.2,.3,.1],{width:100,height:100,outWidth:100,outHeight:100,angle:0,scale:1});b.forEach((v,i)=>assert.ok(Math.abs(v-[.1,.2,.3,.1][i])<1e-10));
 const rotated=I.sourceBox([0,0,1,1],{width:100,height:100,outWidth:106,outHeight:106,angle:3,scale:1});assert.ok(rotated.every(Number.isFinite));assert.ok(rotated[0]+rotated[2]<=1);assert.ok(rotated[1]+rotated[3]<=1);
});
test('table mode separates distant word groups inside a single engine line',()=>{
 const a=line('Sodio 140 mmol/L',.05,.2,.8);a.words=[line('Sodio',.05,.2,.1),line('140',.6,.2,.06),line('mmol/L',.68,.2,.1)];
 assert.equal(Q.readingOrder([a],{mode:'rows'}).text,'Sodio\t140 mmol/L');
});
test('mixed digit glyphs and dose denominators are compared without mistaking IU for a digit',()=>{
 const r=Q.numericReview('1O mg e 5 µg/mL e 5IU','10 mg e 5 µg/L e 5IU');
 assert.equal(r.alerts.filter(a=>a.kind==='ambiguous-digit').length,1);assert.ok(r.alerts.some(a=>a.kind==='differs-from-source'&&a.value==='5 µg/L'));
});
test('large layout analyses fall back transparently without dropping original lines',()=>{
 const lines=Array.from({length:2001},(_,i)=>line('x',.1,i/3000,.1,.0001));const r=Q.readingOrder(lines,{mode:'columns'});assert.equal(r.mode,'engine');assert.equal(r.partial,true);assert.equal(r.lines.length,2001);
});
