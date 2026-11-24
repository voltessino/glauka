'use strict';
const {defineConfig}=require('@playwright/test');

// Security-only browser tests: no editor staging, no web servers, no live API.
module.exports=defineConfig({
  testDir:'./tests/browser',
  testMatch:['illustration-svg-security.spec.js'],
  workers:1,
  timeout:30000,
  use:{
    headless:true,
    launchOptions:{
      executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,
      args:['--no-sandbox']
    }
  },
  reporter:'list'
});
