'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const broker=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/GlaukaCloudAndroidTokenBroker.java');
const vault=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/GlaukaCloudSecureVault.java');
const app=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java');
test('Android code exchange uses native HTTPS token endpoint with strict redirect and size bounds',()=>{
 for(const text of ['https://oauth2.googleapis.com/token','https://api.dropboxapi.com/oauth2/token',
  'setInstanceFollowRedirects(false)','setConnectTimeout(TIMEOUT_MS)',
  'setReadTimeout(TIMEOUT_MS)','MAX_JSON','MAX_JSON)',
  'code_verifier','authorization_code','response too large']){
  assert.ok(broker.includes(text),text);
 }
 assert.match(broker,/post\(code\.provider,payload\)/);
 assert.match(broker,/GlaukaCloudSecureVault\.Entry/);
 assert.match(broker,/vault\.save\(code\.provider/);
});
test('Android refresh preserves refresh token when OAuth provider rotates only access token',()=>{
 assert.match(broker,/payload\.put\("grant_type","refresh_token"\)/);
 assert.match(broker,/original\.refreshToken/);
 assert.match(broker,/result\.optString|refreshed\.optString/);
 assert.match(broker,/refreshed\.optString\("refresh_token",original\.refreshToken\)/);
 assert.match(broker,/System\.currentTimeMillis\(\)\+60000L/);
 assert.match(broker,/vault\.save\(provider,current\)/);
});
test('Android bearer tokens cannot be requested by web content and never log secrets',()=>{
 assert.doesNotMatch(broker,/@JavascriptInterface|evaluateJavascript\s*\(|addJavascriptInterface\s*\(|System\.out\.|Log\./);
 assert.doesNotMatch(app,/new GlaukaCloudAndroidTokenBroker/);
 assert.match(broker,/requireWorkerThread\(\)/);
 assert.match(broker,/throw new GeneralSecurityException\("Secure OAuth exchange unavailable"\)/);
 assert.match(vault,/KeyStore\.getInstance\("AndroidKeyStore"\)/);
});
