'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'../../../playwright.config.js'),'utf8');
function readConfig(platform,env={}){
 const mod={exports:{}};
 new Function('require','module','process',text)(
  ()=>({defineConfig:obj=>obj}),mod,{platform,env});
 return mod.exports;
}
test('Windows browser test servers use the installed Python launcher',()=>{
 const config=readConfig('win32');
 assert.equal(config.webServer.length,3);
 assert.deepEqual(config.webServer.map(s=>new URL(s.url).port),['5173','5174','5178']);
 for(const server of config.webServer)assert.match(server.command,/^py -3 (?:scripts\/dev\/serve\.py|scripts\/release\/android74_preview_server\.py) /);
});
test('macOS and Linux still use python3 to prepare their test sites',()=>{
 for(const host of ['darwin','linux']){
  const config=readConfig(host);
  for(const server of config.webServer)assert.match(server.command,/^python3 (?:scripts\/dev\/serve\.py|scripts\/release\/android74_preview_server\.py) /);
 }
});
test('local Python override is respected on all developer hosts',()=>{
 for(const host of ['win32','linux','darwin']){
  const config=readConfig(host,{NEUROMAP_PYTHON:'python'});
  for(const server of config.webServer)assert.match(server.command,/^python (?:scripts\/dev\/serve\.py|scripts\/release\/android74_preview_server\.py) /);
 }
});
