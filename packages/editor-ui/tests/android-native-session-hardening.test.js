'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../../..');
const ANDROID=path.join(ROOT,'apps/android/native/app/src/main');
const native=(file)=>fs.readFileSync(path.join(ANDROID,'java/it/neuromap/architect/preview',file),'utf8');
const asset=(file)=>fs.readFileSync(path.join(ANDROID,'assets',file),'utf8');

test('legacy Android blob downloads use the acknowledged export protocol',async()=>{
  const calls=[],original=[];
  class Anchor {
    constructor(){this.href='blob:map';this.download='map.svg'}
    click(){original.push('clicked')}
  }
  const window={
    NMAndroid:{saveProject(){}},
    NeuroMapLifecycle:{async androidExport(blob,filename){calls.push({blob,filename});return true}}
  };
  const document={addEventListener(){},getElementById(){return null},
    querySelectorAll(){return[]},createElement(){return{remove(){},textContent:''}},
    body:{appendChild(){}}};
  const scope={window,document,HTMLAnchorElement:Anchor,Blob,Promise,
    setTimeout(){},clearTimeout(){},
    fetch:async()=>({ok:true,blob:async()=>new Blob(['map data'])}),
    NeuroMapLocale:{translate:x=>x},
    MouseEvent:class {}};
  vm.runInNewContext(asset('assets/mobile.js'),scope,{filename:'mobile.js'});
  new Anchor().click();
  for(let i=0;i<15;i++)await Promise.resolve();
  assert.equal(original.length,0,'native download must not open an untracked blob URL');
  assert.equal(calls.length,1);
  assert.equal(calls[0].filename,'map.svg');
  assert.equal(calls[0].blob.size,8);
});

test('export staging remains private, atomic and recoverable after process recreation',()=>{
  const src=native('PendingAndroidExportStore.java');
  assert.match(src,/new AtomicFile\(new File\(folder, "pending.bytes"\)\)/);
  assert.match(src,/new AtomicFile\(new File\(folder, "pending.json"\)\)/);
  assert.ok(src.indexOf('writeAtomic(payload, content)') <
            src.indexOf('writeAtomic(metadata,'),
            'data must reach disk before commit metadata');
  assert.match(src,/MessageDigest\.isEqual/);
  assert.match(src,/if \(hasPending\(\)\) throw new IllegalStateException/);
  const activity=native('MainActivity.java');
  assert.match(activity,/pendingExportStore\.stage\(id,safe,bytes\)/);
  assert.match(activity,/pendingExportStore\.snapshot\(\)/);
  assert.match(activity,/pendingExportStore\.clear\(\)/);
  assert.match(activity,/ActivityResultContracts\.StartActivityForResult/);
  assert.match(activity,/exportLauncher\.launch\(intent\)/);
  assert.doesNotMatch(activity,/startActivityForResult\(intent,SAVE_FILE\)/);
  const recoveryUI=activity.slice(activity.indexOf('private void offerPendingExport()'),
      activity.indexOf('private void saveReply('));
  assert.match(recoveryUI,/pendingExportStore\.info\(\)/);
  assert.doesNotMatch(recoveryUI,/pendingExportStore\.snapshot\(\)/);
  assert.ok(!activity.includes('private byte[] pendingSave'));
  assert.match(activity,/callbackSession==rendererSession/);
});

test('Android back timeout is safe, cancelable and ignores late JS replies',()=>{
  const src=native('MainActivity.java');
  assert.match(src,/closeHandler\.postDelayed\(closeWatchdog,90000\)/);
  assert.match(src,/closePromptVisible=true/);
  assert.match(src,/closeAttempt\+\+/);
  assert.match(src,/String\.valueOf\(closeAttempt\)\.equals\(attempt\)/);
  assert.match(src,/\.setNegativeButton\(AndroidNativeMessages\.text\(interfaceLocale\(\),"stay"\)/);
  assert.match(src,/NMAndroid\.finishClose\(/);
  assert.match(src,/if\(closePromptVisible&&closeInProgress\)/);
});

test('frame protection leaves OCR/PDF workers and inline editor scripts working',()=>{
  const html=asset('app/index.html');
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/frame-src 'none'/);
  assert.match(html,/object-src 'none'/);
  assert.doesNotMatch(html,/child-src 'none'/);
  assert.doesNotMatch(html,/worker-src 'none'/);
  const activity=native('MainActivity.java');
  assert.match(activity,/settings\.setAllowFileAccessFromFileURLs\(false\)/);
  assert.match(activity,/settings\.setAllowUniversalAccessFromFileURLs\(false\)/);
  assert.match(activity,/rendererSession==jobSession/);
  assert.match(activity,/rendererSession==session/);
});

test('Android 16 edge-to-edge migration remains an explicit release gate',()=>{
  const gradle=fs.readFileSync(path.join(ROOT,'apps/android/native/app/build.gradle'),'utf8');
  const styles=fs.readFileSync(path.join(ANDROID,'res/values-v35/styles.xml'),'utf8');
  const base=fs.readFileSync(path.join(ANDROID,'res/values/styles.xml'),'utf8');
  assert.doesNotMatch(base,/windowOptOutEdgeToEdgeEnforcement|windowLightNavigationBar/);
  assert.match(gradle,/targetSdk 35/);
  assert.match(styles,/windowOptOutEdgeToEdgeEnforcement/);
  // Do not claim API-36 compatibility based solely on an APK or a CSS patch.
});
