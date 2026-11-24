const {defineConfig}=require('@playwright/test');
const pythonCommand=process.env.NEUROMAP_PYTHON || (process.platform==='win32'?'py -3':'python3');
module.exports=defineConfig({
  testDir:'./tests/browser',
  // Opt-in stress journeys use a dedicated config so the standard smoke suite
  // stays fast and does not claim that unrun scenarios were validated.
  testIgnore:['**/android74-responsive.spec.js','**/student-100-journeys.spec.js',
    '**/student-1000-international.spec.js'],
  workers:2,timeout:30000,
  use:{baseURL:'http://127.0.0.1:5178',locale:'it-IT',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}},
  webServer:[
    {command:pythonCommand+' scripts/dev/serve.py android --port 5173',url:'http://127.0.0.1:5173/app/index.html',reuseExistingServer:false},
    {command:pythonCommand+' scripts/dev/serve.py macos --port 5174',url:'http://127.0.0.1:5174/index.html',reuseExistingServer:false},
    {command:pythonCommand+' scripts/release/android74_preview_server.py --port 5178',url:'http://127.0.0.1:5178/app/index.html',reuseExistingServer:false}
  ],reporter:'list'
});
