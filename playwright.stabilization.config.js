// Local integration gate for PR #230. No CI triggers; Chromium and WebKit
// exercise the same staged desktop/Android editors.
const base=require('./playwright.config');
module.exports={...base,
 testMatch:['compact-insert-toolbox.spec.js','insert-linked-views-integration.spec.js',
  'linked-view-compact-release.spec.js','pr230-panel-zoom.spec.js','linked-view-stability.spec.js'],
 projects:[
  {name:'chromium',use:{browserName:'chromium',launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}}},
  {name:'webkit',use:{browserName:'webkit',launchOptions:{}}}
 ]
};
