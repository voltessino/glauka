'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {sha256}=require('../hash');
test('SHA-256 of UTF-8 payload uses the real cryptographic digest',async()=>{
 const hash=await sha256('abc',{subtle:webcrypto.subtle});
 assert.equal(hash,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('SHA-256 rejects missing crypto and wrong input type',async()=>{
 await assert.rejects(sha256(123,{subtle:webcrypto.subtle}),/UTF-8/);
 await assert.rejects(sha256('a',{subtle:{digest:async()=>new Uint8Array(6)}}),/digest size/);
});
