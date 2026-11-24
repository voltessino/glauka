'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
// The tests exercise the exact platform IO method instead of duplicating a
// simplified decompressor in the fixture.
const ROOT=path.resolve(__dirname,'../../..');
function method(filename){
 const source=fs.readFileSync(path.join(ROOT,filename),'utf8');
 const start=source.indexOf('      async decompressZipEntryBytes(');
 const end=source.indexOf('\n      async parseZipArchiveInMemory(',start);
 assert.ok(start>=0&&end>start,filename+': method missing');
 return new Function('DecompressionStream','return ({'+source.slice(start,end)+'}).decompressZipEntryBytes;')(
  globalThis.DecompressionStream
 );
}
for(const location of ['apps/desktop-shared/editor/io.js','apps/android/editor/io.js']){
 test(location+' — small DEFLATE payload round trips losslessly',async()=>{
  const unzip=method(location),original=Buffer.from('Anatomy α quiz'.repeat(600));
  const compressed=zlib.deflateRawSync(original);
  const output=await unzip.call({},new Uint8Array(compressed),8,0,compressed.length,64*1024);
  assert.deepEqual(Buffer.from(output),original);
 });
 test(location+' — inflation bomb with a tiny compressed input is interrupted by quota',async()=>{
  const unzip=method(location),data=Buffer.alloc(4*1024*1024,65);
  const compressed=zlib.deflateRawSync(data,{level:9});
  assert.ok(compressed.byteLength<8000);
  await assert.rejects(unzip.call({},new Uint8Array(compressed),8,0,compressed.length,512*1024),
   /limite di decompressione/);
 });
 test(location+' — STORE entries are also capped and invalid indexes rejected',async()=>{
  const unzip=method(location),payload=new Uint8Array(20_000);
  await assert.rejects(unzip.call({},payload,0,0,payload.length,1024),
   /limite di decompressione/);
  await assert.rejects(unzip.call({},payload,0,-1,10),/danneggiato/);
  await assert.rejects(unzip.call({},payload,0,10000,10001),/danneggiato/);
 });
 test(location+' — invalid compression data cannot be mistaken for a valid XMind entry',async()=>{
  const unzip=method(location),garbage=new Uint8Array([12,0,255,1,23,18]);
  await assert.rejects(unzip.call({},garbage,8,0,garbage.length,100_000));
  await assert.rejects(unzip.call({},garbage,99,0,garbage.length,100_000),/non supportato/);
 });
}
