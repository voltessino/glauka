'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('./qa-evidence-audit.cjs');

test('QA screenshots linked as text or images are retained, never marked orphan',()=>{
 const files=['docs/qa/evidence/demo.png','docs/qa/evidence/second.webp'];
 const docs=[{path:'docs/qa/report.md',
  content:'[Schermata](evidence/demo.png) e ![Seconda](evidence/second.webp)'}];
 const result=audit(files,docs);
 assert.equal(result.checkedImages,2);
 assert.equal(result.referencedImages,2);
 assert.deepEqual(result.unreferencedCandidates,[]);
 assert.deepEqual(result.brokenLinks,[]);
 assert.equal(result.filesRemoved,0);
});
test('unused screenshots are only REVIEW candidates, not removed',()=>{
 const files=['docs/qa/evidence/used.png','docs/qa/evidence/unused.png'];
 const result=audit(files,[{path:'docs/qa/a.md',content:'![ok](evidence/used.png)'}]);
 assert.deepEqual(result.unreferencedCandidates,['docs/qa/evidence/unused.png']);
 assert.equal(result.filesRemoved,0);
});
test('missing local report evidence is identified precisely',()=>{
 const result=audit([],[{path:'docs/qa/a.md',
  content:'[Prova mancante](evidence/missing.png)'}]);
 assert.deepEqual(result.brokenLinks,[{document:'docs/qa/a.md',target:'docs/qa/evidence/missing.png'}]);
});
test('external, irrelevant and non-QA references are ignored',()=>{
 const result=audit(['apps/website/assets/demo.png'],[
  {path:'docs/qa/a.md',content:'[External](https://example.com/evidence/foo.png)'},
  {path:'docs/other.md',content:'[Archive](evidence/missing.png)'}
 ]);
 assert.equal(result.checkedImages,0);
 assert.deepEqual(result.brokenLinks,[]);
});
