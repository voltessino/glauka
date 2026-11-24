'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../../apps/desktop-shared/editor/native-open-core.js');
test('native reads overlap but live commits stay ordered and singular',async()=>{
 let reading=0,maxReading=0,applying=0,maxApplying=0;const committed=[];
 const files=Array.from({length:30},(_,i)=>({filename:i+'.gk',size:100}));
 const result=await Core.run(files,{load:async f=>{maxReading=Math.max(maxReading,++reading);await new Promise(r=>setTimeout(r,1));reading--;return f},apply:async f=>{maxApplying=Math.max(maxApplying,++applying);await new Promise(r=>setTimeout(r,1));committed.push(f.filename);applying--;return {status:'opened'}},yieldUI:async()=>{}});
 assert.equal(maxReading,2);assert.equal(maxApplying,1);assert.deepEqual(committed,files.map(f=>f.filename));assert.equal(result.opened,30);
});
test('ready payloads keep their reservations until committed; large files are exclusive',async()=>{
 let live=0,peak=0;const files=[{filename:'big.gk',size:Core.BUFFER_BYTES+1},{filename:'small.gk',size:100},{filename:'other.gk',size:100}];
 await Core.run(files,{load:async f=>{live+=f.size;peak=Math.max(peak,live);return f},apply:async f=>{assert.ok(live<=Math.max(Core.BUFFER_BYTES,f.size));live-=f.size;return {status:'opened'}},yieldUI:async()=>{}});
 assert.equal(peak,Core.BUFFER_BYTES+1);assert.equal(live,0);
});
test('a corrupt file or failed read does not block later files or hide failure details',async()=>{
 const files=[{filename:'bad.gk',size:10},{filename:'missing.gk',error:{code:'unreadable',message:'missing'}},{filename:'good.gk',size:10},{filename:'duplicate.gk',ignored:'duplicate'}];
 const result=await Core.run(files,{load:async f=>{if(f.filename==='bad.gk')throw Error('broken JSON');return f},apply:async()=>({status:'opened'}),yieldUI:async()=>{}});
 assert.deepEqual([result.opened,result.ignored,result.failed],[1,1,2]);assert.equal(result.entries[0].message,'broken JSON');assert.equal(result.entries[1].code,'unreadable');
});
test('Windows drive/UNC identity is case insensitive and Unix/Mac identity is case sensitive',()=>{
 assert.equal(Core.pathKey('C:\\Maps\\A.gk'),Core.pathKey('c:/maps/a.gk'));assert.equal(Core.pathKey('\\\\Server\\Map.gk'),Core.pathKey('//server/map.gk'));assert.notEqual(Core.pathKey('/Maps/A.gk'),Core.pathKey('/Maps/a.gk'));
});
test('reports retain failures and path warnings in every supported UI language',()=>{
 assert.deepEqual(Object.keys(Core.copy).sort(),['ar','de','en','es','fr','it','pt','zh-CN'].sort());
 const r=Core.report();Core.record(r,{filename:'A.gk',pathWarning:true},{status:'opened'});Core.record(r,{filename:'B.gk'},{status:'failed',code:'tooLarge'});
 for(const locale of Object.keys(Core.copy)){assert.deepEqual(Object.keys(Core.copy[locale]),Object.keys(Core.copy.en));assert.match(Core.summary(r,locale),/1.*0.*1/);assert.ok(Core.details(r,locale).includes('A.gk'));assert.ok(Core.details(r,locale).includes('B.gk'));assert.ok(Core.details(r,locale).includes('100'));}
});
