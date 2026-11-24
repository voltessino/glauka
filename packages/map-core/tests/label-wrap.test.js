const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function instrumentedWrapper(){
  let calls=0;
  class Segmenter {
    constructor(){this.native=new Intl.Segmenter(undefined,{granularity:'grapheme'});}
    segment(text){calls++;return this.native.segment(text);}
  }
  const context={Intl:{Segmenter}};
  vm.runInNewContext(fs.readFileSync(require.resolve('..'),'utf8'),context);
  return {wrap:context.NeuroMapCore.wrapLabelText,calls:()=>calls};
}

test('repeated label layout avoids grapheme segmentation and isolates caller mutations',()=>{
  const {wrap,calls}=instrumentedWrapper();
  const text='👨‍👩‍👧‍👦'.repeat(12)+' ending';
  const expected=Array.from(wrap(text,8));
  const count=calls();
  assert.ok(count>0);
  const copy=wrap(text,8);copy[0]='changed';copy.push('extra');
  assert.deepEqual(Array.from(wrap(text,8)),expected);
  assert.equal(calls(),count);
  assert.notDeepEqual(Array.from(wrap(text,12)),expected);
  assert.ok(calls()>count);
});

test('distinct labels evict old entries instead of retaining every document forever',()=>{
  const {wrap,calls}=instrumentedWrapper();
  const text='abcdefghijklmnopqrstuv';
  const expected=Array.from(wrap(text,8));
  for(let i=0;i<300;i++)wrap(text+i,8);
  const count=calls();
  assert.deepEqual(Array.from(wrap(text,8)),expected);
  assert.ok(calls()>count,'an old entry must be computed again after eviction');
});

test('very large labels bypass retention and preserve the existing line limit',()=>{
  const {wrap,calls}=instrumentedWrapper();
  const text='α'.repeat(2000);
  const first=Array.from(wrap(text,8));
  const count=calls();
  assert.equal(first.length,200);
  assert.equal(first.join(''),text.slice(0,1600));
  assert.deepEqual(Array.from(wrap(text,8)),first);
  assert.ok(calls()>count);
});
