'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../../../apps/desktop-shared/editor/ocr-structure'),C=require('../../../apps/desktop-shared/editor/ocr-core'),Q=require('../../../apps/desktop-shared/editor/ocr-quality'),I=require('../../../apps/desktop-shared/editor/ocr-image');
const l=(text,y,h=.02,x=.05)=>({text,box:[x,y,.8,h],confidence:.95});
const lines=[l('ANATOMIA DEL CUORE',.04,.045),l('1. Camere cardiache',.13,.03),l('Il cuore comprende quattro camere.',.20),l('Gli atri ricevono il sangue venoso.',.23),l('• Atrio destro',.29),l('• Ventricolo destro',.33),l('2. Circolazione',.4,.03),l('Il sangue raggiunge i polmoni.',.46),l('Dose\t5 µg/mL',.52)];
test('geometry proposes headings, paragraphs, lists and tables without rewriting any source text',()=>{
 const text=lines.map(l=>l.text).join('\n'),before=JSON.stringify(lines),p=S.analyze(text,lines);assert.equal(p.geometry,true);assert.deepEqual(p.blocks.map(b=>b.role),['heading','heading','paragraph','list','list','heading','paragraph','table']);assert.deepEqual(p.blocks.filter(b=>b.role==='heading').map(b=>b.level),[1,2,2]);assert.equal(p.blocks[2].text,lines[2].text+'\n'+lines[3].text);assert.ok(S.validate(p,text));assert.equal(JSON.stringify(lines),before);
 const page=C.outline([{page:4,edited:text}],{fileName:'lezione.pdf',sha256:'a'.repeat(64)},true).children[0],tree=S.children(p,text,page);assert.equal(tree[0].text,'ANATOMIA DEL CUORE');assert.equal(tree[0].children[0].text,'1. Camere cardiache');assert.equal(tree[0].children[0].children[0].notes,p.blocks[2].text);assert.equal(tree[0].children[0].sourceRefs[0].page,4);assert.equal(tree[0].children[0].sourceRefs[0].sha256,'a'.repeat(64));assert.equal(page.notes,text);
});
test('edited or malformed proposals cannot invent, omit, reorder or duplicate source text',()=>{
 const text=lines.map(l=>l.text).join('\n'),p=S.analyze(text,lines);
 for(const change of [q=>q.text+='x',q=>q.blocks[0].text='Invented',q=>q.blocks.splice(2,1),q=>q.blocks[0].level=4,q=>q.blocks[0].title='',q=>q.blocks[1].id=q.blocks[0].id,q=>q.blocks.reverse()]){const q=structuredClone(p);change(q);assert.throws(()=>S.validate(q,text))}
 const edited=S.analyze('Appunti corretti\n• Nessun dato inventato',lines);assert.equal(edited.geometry,false);assert.equal(edited.blocks[0].role,'paragraph');assert.equal(edited.blocks[1].role,'list');assert.throws(()=>S.children(p,text+'x',{}));assert.throws(()=>C.outline([{page:4,edited:text}],{fileName:'f',sha256:'a'.repeat(64)},false));
});
test('structure budgets fail visibly and preserve full source text',()=>{
 const text=Array.from({length:401},(_,i)=>'• Voce '+i).join('\n'),p=S.analyze(text);assert.equal(p.partial,true);assert.equal(p.text,text);assert.deepEqual(p.blocks,[]);assert.throws(()=>S.validate(p,text));assert.throws(()=>S.analyze('x'.repeat(45001)));assert.throws(()=>S.analyze('',new Array(10001)));
});
test('PDF text fragments retain typography, source coordinates and line order in rotated viewports',()=>{
 const content={items:[{str:'Anatomia',width:120,height:24,transform:[24,0,0,24,20,350],hasEOL:true},{str:'Cuore',width:50,height:12,transform:[12,0,0,12,20,300],hasEOL:true}]},viewport={width:400,height:400,transform:[1,0,0,-1,0,400]},out=S.nativeLines(content,viewport);assert.equal(out.length,2);assert.equal(out[0].box[3],.06);assert.equal(out[1].text,'Cuore');assert.equal(S.analyze(out.map(x=>x.text).join('\n'),out).blocks[0].role,'heading');
 const rotated=S.nativeLines(content,{width:400,height:400,transform:[0,1,1,0,0,0]});assert.ok(rotated.flatMap(l=>l.box).every(n=>n>=0&&n<=1));
});
test('aligned prose columns improve order while ambiguous cells and numeric tables stay conservative',()=>{
 const a=[l('Il cuore riceve sangue dagli atri.',.2,.02,.05),l('Il polmone consente lo scambio gassoso.',.2,.02,.56),l('Le valvole regolano il flusso sanguigno.',.3,.02,.05),l('Gli alveoli hanno una parete sottile.',.3,.02,.56)].map(x=>({...x,box:[x.box[0],x.box[1],.35,.02]}));
 assert.equal(Q.readingOrder(a).mode,'columns');assert.equal(Q.readingOrder(a).text,[a[0],a[2],a[1],a[3]].map(x=>x.text).join('\n'));
});
test('scientific symbols and exponents are review alerts only, with exact UTF-16 offsets',()=>{
 const text='Misura β = 2 × 10^-3; HCO₃⁻, Na+ e 5 µg/mL; 5 mg.',r=Q.numericReview(text);assert.ok(r.alerts.some(x=>x.kind==='scientific-symbol'));assert.ok(r.alerts.filter(x=>x.kind==='dose-unit').length===2);for(const a of r.alerts)assert.equal(text.slice(a.index,a.index+a.value.length),a.value);assert.equal(text,'Misura β = 2 × 10^-3; HCO₃⁻, Na+ e 5 µg/mL; 5 mg.');
});
test('quarter-turn inverse mapping preserves overlay coordinates',()=>{
 assert.deepEqual(I.sourceBox([0,0,1,1],{width:100,height:200,outWidth:200,outHeight:100,angle:-90,scale:1}),[0,0,1,1]);const box=I.sourceBox([.1,.2,.3,.4],{width:100,height:200,outWidth:200,outHeight:100,angle:-90,scale:1});assert.ok(box.every(n=>n>=0&&n<=1));assert.ok(Math.abs(box[0]-.2)<1e-8);assert.ok(Math.abs(box[1]-.6)<1e-8);
});
test('orientation detects axis only; no fabricated direction or automatic transform',()=>{
 const w=180,h=160,gray=new Uint8Array(w*h).fill(255);for(const y of [20,50,80,110])for(let dy=0;dy<5;dy++)for(let x=15;x<165;x++)gray[(y+dy)*w+x]=0;assert.equal(I.orientation(gray,w,h).axis,'horizontal');const turned=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)turned[x*h+(h-1-y)]=gray[y*w+x];assert.equal(I.orientation(turned,h,w).axis,'vertical');assert.equal(I.orientation(new Uint8Array(10000).fill(255),100,100).axis,'unknown');
});
test('large scientific review declares partial output and preserves dose warnings',()=>{const r=Q.numericReview('β '.repeat(100)+'5 mg');assert.equal(r.partial,true);assert.ok(r.alerts.some(a=>a.kind==='dose-unit'));assert.ok(r.alerts.length<=80)});
