'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../..');
const vault=fs.readFileSync(path.join(repo,
 'apps/android/native/app/src/main/java/it/neuromap/architect/preview/GlaukaCloudSecureVault.java'),'utf8');
const manifest=fs.readFileSync(path.join(repo,
 'apps/android/native/app/src/main/AndroidManifest.xml'),'utf8');
const app=fs.readFileSync(path.join(repo,
 'apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java'),'utf8');
test('Android Cloud secrets are private AES-GCM ciphertext using non-exportable Keystore key',()=>{
 for(const requirement of ['KeyStore.getInstance("AndroidKeyStore")',
  'KeyProperties.KEY_ALGORITHM_AES','KeyProperties.BLOCK_MODE_GCM',
  'new GCMParameterSpec(TAG_BITS','cipher.updateAAD(slot.getBytes',
  'Cipher.ENCRYPT_MODE','Cipher.DECRYPT_MODE','preferences.edit().putString',
  'Context.MODE_PRIVATE'])
  assert.ok(vault.includes(requirement),requirement);
 assert.match(vault,/TAG_BITS = 128/);
 assert.match(vault,/IV_BYTES = 12/);
 assert.match(vault,/\.commit\(\)/);
 assert.match(manifest,/android:allowBackup="false"/);
 assert.match(manifest,/android:fullBackupContent="false"/);
});
test('WebView has no API to export Cloud OAuth access or refresh tokens',()=>{
 assert.doesNotMatch(vault,/@JavascriptInterface/);
 assert.doesNotMatch(vault,/evaluateJavascript|addJavascriptInterface|System\.out|Log\./);
 assert.doesNotMatch(app,/new GlaukaCloudSecureVault\(\)\.read/);
 assert.doesNotMatch(app,/GlaukaCloudSecureVault\.read/);
});
test('Corrupt Keystore and ciphertext fail closed rather than silently falling back',()=>{
 assert.match(vault,/throw new GeneralSecurityException\("Cloud vault truncated"\)/);
 assert.match(vault,/throw new GeneralSecurityException\("Existing cloud key invalid"/);
 assert.match(vault,/throw new GeneralSecurityException\("Cloud vault validation failed"/);
 assert.match(vault,/Arrays\.fill\(plaintext,\(byte\)0\)/);
 assert.match(vault,/Arrays\.fill\(plain,\(byte\)0\)/);
});
