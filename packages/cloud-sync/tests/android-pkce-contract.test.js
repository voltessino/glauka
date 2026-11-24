'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const java=fs.readFileSync(path.join(root,
 'apps/android/native/app/src/main/java/it/neuromap/architect/preview/GlaukaCloudAndroidPkce.java'),'utf8');
const main=fs.readFileSync(path.join(root,
 'apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java'),'utf8');
const manifest=fs.readFileSync(path.join(root,
 'apps/android/native/app/src/main/AndroidManifest.xml'),'utf8');
test('Android PKCE uses strong entropy, S256, short-lived state and native callback validation',()=>{
 for(const literal of ['new SecureRandom()','nonce(32)','nonce(48)',
  'MessageDigest.getInstance("SHA-256")','code_challenge_method','S256',
  'MessageDigest.isEqual','pending=null; // exactly one attempt',
  'MAX_AGE_MILLIS = 5L*60*1000'])
  assert.ok(java.includes(literal),literal);
 assert.match(java,/getQueryParameter\("state"\)/);
 assert.match(java,/getQueryParameter\("code"\)/);
 assert.match(java,/getQueryParameter\("error"\)/);
 assert.match(java,/return new VerifiedCode/);
});
test('Android does not allow custom schemes, loopback or unverified callback to activate login',()=>{
 assert.match(java,/!"https"\.equals\(u\.getScheme\(\)\)/);
 assert.match(java,/!\"\/oauth\/android\"\.equals\(u\.getPath\(\)\)/);
 assert.doesNotMatch(main,/new GlaukaCloudAndroidPkce\(\)\.begin/);
 assert.doesNotMatch(main,/"GlaukaOAuth"|\@JavascriptInterface.*oauth/);
 assert.doesNotMatch(manifest,/android:autoVerify="true"/);
});
test('PKCE helper does not expose tokens, OAuth codes or stored vault through WebView',()=>{
 assert.doesNotMatch(java,/\@JavascriptInterface|addJavascriptInterface|evaluateJavascript/);
 assert.doesNotMatch(java,/System\.out|Log\.|SharedPreferences/);
 assert.match(java,/synchronized VerifiedCode consume/);
 assert.match(java,/synchronized void cancel/);
});
