const {test}=require('node:test');
const assert=require('node:assert/strict');
const {formatList}=require('../workspace-layout.js');
test('list formats replace markers without stacking them and preserve blank lines',()=>{
 const input='• Primo\n\n  ○ Secondo\n3. Terzo';
 assert.equal(formatList(input,'number'),'1. Primo\n\n  2. Secondo\n3. Terzo');
 assert.equal(formatList(input,'letter'),'a. Primo\n\n  b. Secondo\nc. Terzo');
 for(const kind of ['disc','circle','square','dash','number','letter'])assert.equal(formatList(formatList(input,kind),kind),formatList(input,kind));
});
test('removing lists keeps original line contents, links and indentation',()=>{
 assert.equal(formatList('1. https://example.com\n  a) Dettaglio\n▪ Ultimo','none'),'https://example.com\n  Dettaglio\nUltimo');
 assert.equal(formatList('A. Nome\nParola-senza-spazi','unknown'),'A. Nome\nParola-senza-spazi');
});
test('lettered lists continue after z without numbering empty lines',()=>{
 const lines=Array.from({length:28},(_,i)=>'Elemento '+i).join('\n');
 assert.equal(formatList(lines,'letter').split('\n').at(-1),'ab. Elemento 27');
});
