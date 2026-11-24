'use strict';
// Static contracts for the Android prepublication security posture.
// These complement, but do not replace, Gradle/JVM and device tests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const manifest=read('apps/android/native/app/src/main/AndroidManifest.xml');
const extraction=read('apps/android/native/app/src/main/res/xml/data_extraction_rules.xml');
const java=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java');
const html=read('apps/android/native/app/src/main/assets/app/index.html');

test('Android 12+ backup and device transfer explicitly exclude app-private data',()=>{
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android:fullBackupContent="false"/);
  assert.match(manifest,/android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(extraction,/<data-extraction-rules>/);
  for(const section of ['cloud-backup','device-transfer']){
    const body=extraction.match(new RegExp('<'+section+'>([\\s\\S]*?)<\\/'+section+'>'))?.[1];
    assert.ok(body,'missing '+section+' section');
    for(const domain of ['root','file','database','sharedpref','device_root','device_file','device_database','device_sharedpref','external']){
      assert.match(body,new RegExp('<exclude\\s+domain="'+domain+'"\\s+path="\\."\\s*\\/>'));
    }
  }
});

test('Recovery JavaScript bridge validates caller request IDs and bounds payloads before work dispatch',()=>{
  assert.match(java,/private boolean validRequestId\(String id\)/);
  assert.match(java,/if\(!validRequestId\(id\)\)return;/);
  assert.match(java,/if\(json==null\|\|json\.length\(\)>WorkspaceRecoveryStore\.LIMIT\)/);
  assert.match(java,/@JavascriptInterface public void read\(String id\) \{\s*if\(!validRequestId\(id\)\|\|!isCurrentRenderer\(\)\)return;/);
  assert.match(java,/@JavascriptInterface public void write\(String json,String id\) \{\s*if\(!validRequestId\(id\)\|\|!isCurrentRenderer\(\)\)return;/);
  assert.match(java,/@JavascriptInterface public void discard\(String id\) \{\s*if\(!validRequestId\(id\)\|\|!isCurrentRenderer\(\)\)return;/);
});

test('Existing WebView file and mixed-content restrictions remain enabled',()=>{
  for(const rule of [
    'settings.setAllowFileAccess(false)',
    'settings.setAllowContentAccess(false)',
    'settings.setAllowFileAccessFromFileURLs(false)',
    'settings.setAllowUniversalAccessFromFileURLs(false)',
    'settings.setJavaScriptCanOpenWindowsAutomatically(false)',
    'settings.setSafeBrowsingEnabled(true)',
    'WebSettings.MIXED_CONTENT_NEVER_ALLOW'
  ]) assert.ok(java.includes(rule),rule);
});

test('Packaged Android WebView CSP denies remote scripts and untrusted frame origins',()=>{
  assert.match(html,/script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(html,/connect-src 'self' https:\/\/api\.iconify\.design https:\/\/api\.mymemory\.translated\.net/);
  assert.match(html,/worker-src 'self' blob:/);
  assert.match(html,/frame-src 'none'/);
  assert.match(html,/object-src 'none'/);
  assert.match(html,/base-uri 'none'/);
  assert.match(java,/if\(!BuildConfig\.DEBUG\)WebView\.setWebContentsDebuggingEnabled\(false\)/);
});

test('Recovery access is bound to the live WebView renderer session at dispatch and on the I/O queue',()=>{
  assert.match(java,/private volatile WebView web;/);
  assert.match(java,/private volatile long rendererSession;/);
  assert.match(java,/AndroidRecoverySessionPolicy\.canAccess\(session,rendererSession,web!=null\)/);
  for(const method of [
    'read\\(String id\\)', 'write\\(String json,String id\\)', 'discard\\(String id\\)'
  ]){
    const source=java.match(new RegExp('@JavascriptInterface public void '+method+' \\{([\\s\\S]*?)\\n        \\}'))?.[1];
    assert.ok(source,'Missing recovery bridge entry point: '+method);
    assert.match(source,/!isCurrentRenderer\(\)/);
  }
  assert.ok((java.match(/if\(!isCurrentRenderer\(\)\)return;/g)||[]).length>=3);
});
