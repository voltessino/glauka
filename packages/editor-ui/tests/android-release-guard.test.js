'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const gradle=read('apps/android/native/app/build.gradle');
const localBuilder=read('scripts/release/build_android_local.py');
const verifier=read('scripts/release/verify_android_preview.py');
const manifest=read('apps/android/native/app/src/main/AndroidManifest.xml');
const main=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java');
// The runtime concatenates these three classic-script slices into one scope.
const shell=['shell-dictionary.js','shell-product-locale.js','shell.js']
  .map(name=>read('apps/android/editor/'+name)).join('');
const ai=read('apps/android/editor/ai-client.js');
const work=read('packages/editor-ui/ai-workflows.js');
const lifecycle=read('packages/editor-ui/lifecycle.js');
const javaAsset=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/AndroidAssetPolicy.java');
const javaAI=read('apps/android/native/app/src/main/java/it/neuromap/architect/preview/AndroidAiHostPolicy.java');
test('release version is never duplicated as a hardcoded old APK version',()=>{
 const version=JSON.parse(read('versions.json')).android;
 assert.ok(Number.isInteger(version.version_code)&&version.version_code>=28);
 assert.match(version.version,/^\d+\.\d+\.\d+$/);
 assert.match(gradle,/JsonSlurper/);
 assert.match(gradle,/androidVersion\.version_code/);
 assert.match(gradle,/androidVersion\.version/);
 assert.match(localBuilder,/prepare\.py/);
 assert.match(localBuilder,/verify_android_preview\.py/);
 assert.match(verifier,/versions\.json/);
 assert.doesNotMatch(localBuilder,/0\.5\.0-private-test/);
 assert.equal(fs.existsSync(path.join(ROOT,'.github/workflows/build-apk.yml')),false);
 assert.match(read('scripts/release/prepare.py'),/shutil\.copyfile\(ROOT \/ 'versions\.json'/);
});
test('release signing and shrinking have no hardcoded credentials',()=>{
 assert.match(gradle,/signingConfigs/);
 assert.match(gradle,/minifyEnabled true/);
 assert.match(gradle,/shrinkResources true/);
 assert.match(gradle,/buildConfigField 'boolean', 'PRIVATE_AI_TEST', 'false'/);
 assert.match(gradle,/buildConfigField 'boolean', 'PRIVATE_AI_TEST', 'true'/);
 assert.match(read('apps/android/native/app/proguard-rules.pro'),/@android\.webkit\.JavascriptInterface <methods>/);
 assert.doesNotMatch(gradle,/\.jks["']/);
 assert.match(gradle,/GLAUKA_RELEASE_STORE_FILE/);
});
test('AI bridge enforces native licenses and the owner key is absent from release',()=>{
 assert.match(main,/web\.addJavascriptInterface\(new AiBridge\(\),"NMAndroidAI"\)/);
 assert.match(main,/if\(!license\.isPro\(\)\)throw new SecurityException/);
 assert.match(gradle,/OWNER_LICENSE_PUBLIC_KEY', '""'/);
 assert.match(main,/isPrivatePreview\(\)/);
 assert.match(shell,/window\.NMAndroidAI\?\.productStatus/);
 assert.doesNotMatch(shell,/voltes|nm_android_test_pro_enabled/);
 assert.doesNotMatch(main+shell+work,/NMAndroidTest|NM_ANDROID_PRIVATE_TEST/);
 assert.match(work,/NMAndroidAI/);
});
test('AI keys never enter the Android WebView request header or session storage path',()=>{
 assert.match(main,/aiVault\.readAIKey\(u\.getHost\(\)\)/);
 assert.match(main,/saveAIKey\(String host,String key\)/);
 assert.match(main,/hasAIKey\(String host\)/);
 assert.match(main,/deleteAIKey\(String host\)/);
 assert.doesNotMatch(main,/con\.setRequestProperty\(k,hdr\.getString\(k\)\).*authorization/);
 assert.match(ai,/window\.NMAndroidAI\?\.saveAIKey/);
 assert.match(ai,/if\(!window\.NMAndroid && this\.settings\.rememberSession/);
 assert.match(ai,/sessionStorage\.removeItem\('neuromap\.ai\.secret\.v4'\)/);
});
test('Android asset/host allowlists and back navigation are explicit and testable',()=>{
 assert.match(main,/AndroidAssetPolicy\.mimeFor\(path\)/);
 assert.match(main,/AndroidAiHostPolicy\.isAllowed\(endpoint\)/);
 assert.match(main,/getOnBackPressedDispatcher\(\)\.addCallback/);
 assert.match(main,/NeuroMapLifecycle\.handleBack\(\)/);
 assert.doesNotMatch(main,/@Override public void onBackPressed\(\)/);
 assert.match(lifecycle,/function handleBack\(\)/);
 assert.match(lifecycle,/handleBack,install/);
 assert.match(javaAsset,/encodedPath\.indexOf\('%'\)>=0/);
 assert.match(javaAI,/u\.getRawUserInfo\(\)!=null/);
 assert.match(javaAI,/u\.getPort\(\)!=-1/);
 assert.match(manifest,/android:label="Glauka"/);
});
test('Studio and tools exposes exactly five primary sections with Experimental grouping',()=>{
 const code=read('apps/android/native/app/src/main/assets/assets/mobile-74.js');
 assert.match(code,/new Set\(\['capture','documents','sources','cards','dashboard'\]\)/);
 assert.match(code,/nav\.append\(experimental\)/);
 assert.match(code,/experimentalLabel\.textContent/);
 assert.match(read('apps/android/native/app/src/main/assets/assets/mobile-74.css'),/nm74-experimental/);
});
