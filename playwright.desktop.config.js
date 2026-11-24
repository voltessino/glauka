const {defineConfig}=require('@playwright/test');
const base=require('./playwright.config');
const browserName=process.env.NEUROMAP_TEST_ENGINE||'chromium';
if(!['chromium','webkit'].includes(browserName))throw Error('Unsupported desktop test engine: '+browserName);
module.exports=defineConfig({
  ...base,
  grep:/desktop/,
  // setup-python exposes `python` on both Windows and macOS.
  webServer:[{...base.webServer[1],command:base.webServer[1].command.replace(/^python3 /,'python ')}],
  use:{...base.use,browserName,launchOptions:browserName==='webkit'?{}:base.use.launchOptions,
    screenshot:'only-on-failure',trace:'retain-on-failure'}
});
