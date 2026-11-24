'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../../../apps/desktop-shared/editor/anki-tsv-core.js');
test('Anki TSV UTF-8 Front/Back roundtrip, no HTML or scheduling claims',()=>{
 const source=[{question:'Anatomia del cuore?',answer:'Quattro camere'},{question:'Cosa fa il rene?',answer:'Filtra il sangue'}];
 const serialized=A.exportTSV(source);
 assert.ok(serialized.startsWith('\uFEFF#separator:tab'));
 assert.match(serialized,/#html:false/);
 assert.deepEqual(A.parse(serialized),source);
});
test('invalid rows and duplicate cards are bounded',()=>{
 assert.deepEqual(A.parse('Front\tBack\nQ\tA\nQ\tA'),[{question:'Q',answer:'A'}]);
 assert.throws(()=>A.parse('not tab separated'),/Front and Back/);
 assert.throws(()=>A.exportTSV([]),/No flashcards/);
 assert.throws(()=>A.parse(Array.from({length:A.MAX_CARDS+2},(_,i)=>'Q'+i+'\tA'+i).join('\n')),/500 cards/);
});
test('remove embedded control characters without interpreting HTML',()=>{
 assert.deepEqual(A.parse('H<tag>\tA<script>alert(1)</script>'),
 [{question:'H<tag>',answer:'A<script>alert(1)</script>'}]);
});