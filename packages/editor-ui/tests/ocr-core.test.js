const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../../../apps/desktop-shared/editor/ocr-core');
test('explicit page ranges deduplicate, sort and support large multi-page books cleanly',()=>{
 assert.deepEqual(C.pages('4, 1-3, 2',10),[1,2,3,4]);
 assert.equal(C.pages('1-25',450).length,25);
 assert.deepEqual(C.pages('410, 420-421',450),[410,420,421]);
 for(const s of ['','0','4-2','451','x','1,999'])assert.throws(()=>C.pages(s,450));
});
const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n';
test('TSV keeps line order and normalized boxes, using weakest word confidence',()=>{
 const p=C.tsv(header+'5\t1\t1\t1\t1\t1\t10\t20\t20\t10\t98\tDose\n5\t1\t1\t1\t1\t2\t35\t20\t20\t10\t50\t5 µg\n',100,100);
 assert.equal(p.text,'Dose 5 µg');assert.equal(p.lines[0].confidence,.5);assert.deepEqual(p.lines[0].box,[.1,.2,.45,.1]);
 assert.equal(C.warnings(p).lowConfidence,true);assert.ok(C.warnings(p).units.length);
 assert.throws(()=>C.tsv('plain text',100,100));
 assert.throws(()=>C.tsv(header+'5\t1\t1\t1\t1\t1\tNaN\t20\t20\t10\t98\tDose\n',100,100));
});
test('OCR proposal requires approval and keeps full edited text and original source identity',()=>{
 const rows=[{page:7,edited:'Verifica 5 µg/mL\n'+ 'x'.repeat(2000)}],source={fileName:'original.pdf',sha256:'a'.repeat(64)};
 assert.throws(()=>C.outline(rows,source,false));const p=C.outline(rows,source,true);
 assert.equal(p.children[0].notes,rows[0].edited);assert.equal(C.outline([{page:1,edited:'  testo\n'}],source,true).children[0].notes,'  testo\n');assert.equal(p.children[0].sourceRefs[0].page,7);assert.equal(p.children[0].sourceRefs[0].quote.length,1800);
 assert.throws(()=>C.outline([{page:7,edited:'x'.repeat(45001)}],source,true));
 assert.throws(()=>C.outline([...rows,...rows],source,true));
});
test('scientific-unit review includes micrograms, picograms and common OCR substitutions',()=>{
 for(const unit of ['µg','μg','ug','pg','ng','mg','g','mmol/L','%'])assert.ok(C.warnings({text:'Dose 5 '+unit}).units.length,unit);
});
test('painted image area distinguishes small logos, scanned pages and unknown grouped images',()=>{
 const ops={save:1,restore:2,transform:3,paintImageXObject:4,paintImageXObjectRepeat:5};
 const image=(w,h)=>({fnArray:[1,3,4,2],argsArray:[[],[w,0,0,h,0,0],['im'],[]]});
 assert.equal(C.imageCoverage(image(100,100),ops,[0,0,100,100]),1);
 assert.equal(C.imageCoverage(image(10,10),ops,[0,0,100,100]),.01);
 assert.equal(C.imageCoverage({fnArray:[5],argsArray:[[]]},ops,[0,0,100,100]),null);
 assert.equal(C.imageCoverage(image(Infinity,100),ops,[0,0,100,100]),null);
});
 test('editable OCR titles preserve full notes and page provenance without inventing content',()=>{
 assert.equal(C.suggestedTitle('\n42\nIl cuore\nDettagli',1),'Il cuore');assert.equal(C.suggestedTitle('',3,'Page'),'Page 3');assert.equal(C.suggestedTitle('x'.repeat(90),1).length,80);
 const p=C.outline([{page:420,title:'  Fisiologia  ',edited:'Testo completo\n5 µg'}],{fileName:'f.pdf',sha256:'b'.repeat(64)},true);
 assert.equal(p.children[0].text,'Fisiologia');assert.equal(p.children[0].notes,'Testo completo\n5 µg');assert.equal(p.children[0].sourceRefs[0].page,420);
});
