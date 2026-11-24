const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,paginate,RANGES,chunks}=require('../native/app/src/main/assets/assets/smart-import-core.js');
function originals(page){const result=[];const stack=[...(page.root.children||[])].reverse();while(stack.length){const n=stack.pop();if(!n._nmContext)result.push(n._nmSourceId);for(let i=(n.children||[]).length-1;i>=0;i--)stack.push(n.children[i]);}return result;}
test('small Markdown retains headings, bullet hierarchy and sequence',()=>{
  const root=parse('# Capitolo\n## Cuore\n- Arteria\n  - Parete\n- Vena\n## Reni\n- Glomerulo','Appunti');
  assert.equal(root.children[0].text,'Capitolo');
  assert.equal(root.children[0].children[0].text,'Cuore');
  assert.deepEqual(root.children[0].children[0].children.map(x=>x.text),['Arteria','Vena']);
  assert.equal(root.children[0].children[0].children[0].children[0].text,'Parete');
});
test('very long single chapter has many readable maps in the original order',()=>{
  const doc='# Corso\n## Capitolo gigante\n'+Array.from({length:1900},(_,i)=>'- Argomento '+String(i+1).padStart(4,'0')).join('\n');
  const result=paginate(parse(doc,'Corso'),125);
  assert.ok(result.pages.length>=14 && result.pages.length<=22, 'maps: '+result.pages.length);
  assert.ok(result.pages.every(p=>p.size<=125),JSON.stringify(result.pages.map(p=>p.size)));
  const flat=result.pages.flatMap(originals);assert.deepEqual(flat,Array.from({length:flat.length},(_,i)=>i+1));
  assert.equal(result.totalSources,result.originalSources);
});
test('6200 nodes are never truncated; configurable budgets honored',()=>{
  const doc=Array.from({length:6200},(_,i)=>'- Node '+i).join('\n');
  for(const budget of RANGES){
    const result=paginate(parse(doc,'Massivo'),budget);
    assert.equal(result.totalSources,6200);
    assert.ok(result.pages.length>10);
    assert.ok(result.pages.every(p=>p.size<=budget), 'budget '+budget);
    assert.deepEqual(result.pages.flatMap(originals),Array.from({length:6200},(_,i)=>i+1));
  }
});
test('long paragraphs split without dropping words',()=>{
  const s='Fisiologia '.repeat(400).trim();
  const root=parse(s,'Testo'); const flat=root.children.map(n=>n.text);
  assert.ok(flat.length>8);
  assert.equal(flat.join(' '),s);
  assert.ok(flat.every(x=>x.length<=245));
});
test('fenced code preserved in notes, not misparsed as headings',()=>{
  const root=parse('# Esempio\n```js\n# not a heading\nlet x = 3;\n```\n- fine','Codice');
  assert.match(root.children[0].notes,/not a heading/);
  assert.equal(root.children[0].children[0].text,'fine');
});
test('last page not tiny for flat text import',()=>{
  const result=paginate(parse(Array.from({length:210},(_,i)=>'Riga '+i).join('\n'),'Testo'),125);
  assert.equal(result.pages.length,2);
  assert.ok(result.pages[1].sourceCount>=80);
});
test('paginating XMind preserves images, side pins, notes and boundary titles',()=>{
  const root={text:'Study',children:Array.from({length:210},(_,i)=>({text:'Topic '+i,_nmSourceId:i+1,
    sidePinned:i%2?'left':'right',notes:'Note '+i,image:{src:'data:image/png;base64,aGVsbG8='},
    boundary:{enabled:true,title:'Chapter '+i},children:[]}))};
  const result=paginate(root,80);
  const copies=result.pages.flatMap(p=>p.root.children);
  assert.equal(copies.length,210);
  copies.forEach((node,i)=>{assert.equal(node.sidePinned,root.children[i].sidePinned);assert.deepEqual(node.image,root.children[i].image);assert.equal(node.notes,'Note '+i);assert.equal(node.boundary.title,'Chapter '+i);});
  copies[0].boundary.title='Changed';assert.equal(root.children[0].boundary.title,'Chapter 0');
});

test('alphabetic and Unicode bullets preserve hierarchy without stripping prose',()=>{
 const r=parse('# Titolo\na) Primo\n  • Dettaglio\nb) Secondo\n1) Terzo\n○ Quarto','Appunti');
 assert.deepEqual(r.children[0].children.map(n=>n.text),['Primo','Secondo','Terzo','Quarto']);
 assert.equal(r.children[0].children[0].children[0].text,'Dettaglio');
 const prose=parse('Nota. Questo paragrafo deve restare intero.\nMix. Another sentence.','Appunti');
 assert.deepEqual(prose.children.map(n=>n.text),['Nota. Questo paragrafo deve restare intero.','Mix. Another sentence.']);
});

test('Smart Import preserves Unicode grapheme clusters across 245-unit limits',()=>{
  for(const glyph of ['🧬','👩‍🔬','🇮🇹','a\u0301','✈\uFE0F']){
    const original=glyph.repeat(150), parts=chunks(original,245);
    assert.ok(parts.length>1,glyph);
    assert.equal(parts.join(''),original,glyph);
    assert.ok(parts.every(part=>part.length<=245),glyph);
    assert.ok(parts.every(part=>!/[\uD800-\uDBFF]$/.test(part) && !/^[\uDC00-\uDFFF]/.test(part)),glyph);
    if(typeof Intl.Segmenter==='function'){
      const boundaries=new Set([...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(original)]
        .map(item=>item.index+item.segment.length));
      let offset=0;
      for(const part of parts){offset+=part.length;assert.ok(boundaries.has(offset),glyph+' split grapheme');}
    }
  }
  assert.equal(parse('🧬'.repeat(150)).children.map(n=>n.text).join(''),'🧬'.repeat(150));
});
test('Smart Import rejects an indivisible grapheme longer than a node limit',()=>{
  if(typeof Intl.Segmenter!=='function')return; // code-point-safe older WebViews
  assert.throws(()=>chunks('a'+'\u0301'.repeat(250),245),/Unicode character exceeds/);
});
