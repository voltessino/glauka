'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../../apps/desktop-shared/editor/atlas-library-core.js');

test('stale or malformed timestamps never overwrite newer Atlas snapshots',()=>{
 for(let i=0;i<1000;i++){
  const fresh={filePath:'C:/Study/map-'+i+'.neuromap',tabId:'new-'+i,
   updatedAt:10000+i,nodes:[{id:'n',text:'Fresh'}]};
  const stale={...fresh,tabId:'old-'+i,updatedAt:i%2?'invalid':i,
   nodes:[{id:'n',text:'Stale'}]};
  for(const pair of [[fresh,stale],[stale,fresh]]){
   const result=A.clean(pair);
   assert.equal(result.length,1);
   assert.equal(result[0].nodes[0].text,'Fresh');
   assert.ok(result[0].tabIds.includes('old-'+i));
  }
 }
});

test('oversized session aliases are bounded during Atlas cleanup',()=>{
 const record={filePath:'C:/Study/one.neuromap',updatedAt:123,
  nodes:[{id:'n',text:'Node'}],
  tabIds:Array.from({length:10000},(_,i)=>'session-'+i)};
 const cleaned=A.clean([record]);
 assert.equal(cleaned.length,1);
 assert.ok(cleaned[0].tabIds.length<=32);
 assert.equal(cleaned[0].tabIds.at(-1),'session-9999');
});
