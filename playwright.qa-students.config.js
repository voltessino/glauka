'use strict';
// Explicit, resource-intensive synthetic UI stress tests. Never run from npm run test:browser
// or GitHub Actions. Run locally and review trace/screenshot failures.
const {defineConfig}=require('@playwright/test');
const base=require('./playwright.config');
module.exports=defineConfig({
 ...base,
 testIgnore:[],
 testMatch:[
  '**/student-100-journeys.spec.js',
  '**/student-1000-international.spec.js'
 ],
 reporter:'list',
 use:{...base.use,trace:'retain-on-failure',screenshot:'only-on-failure'},
 workers:2,
 timeout:65000
});
