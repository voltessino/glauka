const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'tests/browser',
 testMatch:['android-context-format.spec.js','android-native-recovery.spec.js','android-text-authoring.spec.js','android74-responsive.spec.js','android-languages.spec.js','android-phone-shell.spec.js','android-mobile-polish.spec.js','android-surfaces.spec.js','android-linked-views-exclusive.spec.js','android-ocr-lazy.spec.js','android-studio-tools-lazy.spec.js'],
 workers:2,
 fullyParallel:true,
 retries:0,
 timeout:35000,
 use:{locale:'it-IT',baseURL:'http://127.0.0.1:5178',browserName:'chromium',headless:true,
  launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']},
  actionTimeout:10000},
 webServer:{command:(process.platform==='win32'?'py -3':'python3')+' scripts/release/android74_preview_server.py --port 5178',
  url:'http://127.0.0.1:5178/app/index.html',reuseExistingServer:false,timeout:150000}
});
