'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Auth=require('../oauth-pkce');
function broker(){
 const records=[];
 const native={
  isAllowedRedirect:(provider,url)=>url==='http://127.0.0.1:43211/callback'||
    url==='https://glauka.it/oauth/android',
  openBrowser:async url=>{records.push({kind:'browser',url})},
  exchangeCode:async packet=>{records.push({kind:'exchange',packet})},
  disconnect:async provider=>{records.push({kind:'disconnect',provider})}
 };
 let seed=10;
 const random=arr=>{for(let i=0;i<arr.length;i++)arr[i]=(seed++%256)};
 const subtle={digest:async(_,bytes)=>new Uint8Array(32).fill(bytes[0])};
 return {records,service:Auth.createBroker({native,random,subtle})};
}
test('Google PKCE S256 requires a state, challenge, minimum drive.file scope and offline access',async()=>{
 const {service,records}=broker();
 await service.connect({provider:'google',clientId:'public-id',
  redirectUri:'http://127.0.0.1:43211/callback'});
 const url=new URL(records[0].url);
 assert.equal(url.host,'accounts.google.com');
 assert.equal(url.searchParams.get('access_type'),'offline');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('scope'),'https://www.googleapis.com/auth/drive.file');
 assert.ok(url.searchParams.get('state').length>30);
 assert.ok(url.searchParams.get('code_challenge').length>30);
 await assert.rejects(service.complete({code:'valid-code',state:'wrong'}),/Invalid OAuth state/);
 assert.equal(records.filter(x=>x.kind==='exchange').length,0);
});
test('Dropbox PKCE requires offline refresh and exchanges code only in native broker',async()=>{
 const {service,records}=broker();
 await service.connect({provider:'dropbox',clientId:'client-id',
  redirectUri:'https://glauka.it/oauth/android'});
 const url=new URL(records[0].url);
 assert.equal(url.host,'www.dropbox.com');
 assert.equal(url.searchParams.get('token_access_type'),'offline');
 const state=url.searchParams.get('state');
 await service.complete({code:'valid-code',state});
 const tokenExchange=records[1].packet;
 assert.equal(tokenExchange.provider,'dropbox');
 assert.ok(tokenExchange.verifier.length>=43);
 assert.equal(tokenExchange.code,'valid-code');
 assert.equal(records[1].kind,'exchange');
 assert.equal(JSON.stringify(records).includes('refresh_token'),false);
});
test('OAuth cannot start with an unapproved redirect or with no OS broker',async()=>{
 assert.throws(()=>Auth.createBroker({native:{}}),/Secure native OAuth broker/);
 const {service,records}=broker();
 await assert.rejects(service.connect({provider:'google',clientId:'id',
  redirectUri:'https://evil.invalid/callback'}),/Untrusted/);
 assert.equal(records.length,0);
});
test('incomplete and denied OAuth flows never send a token exchange',async()=>{
 const {service,records}=broker();
 await service.connect({provider:'google',clientId:'id',redirectUri:'https://glauka.it/oauth/android'});
 const params=new URL(records[0].url).searchParams;
 await assert.rejects(service.complete({error:'access_denied',state:params.get('state')}),/cancelled/);
 assert.equal(records.filter(x=>x.kind==='exchange').length,0);
 await assert.rejects(service.complete({code:'old-code',state:params.get('state')}),/No authorization/);
});
