/* Raw recording of actual editor view switches, for QA rather than a simulated morph. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('@playwright/test');
const {openDocument}=require('./capture-website-localized.cjs');
(async()=>{
 const lang=process.argv.includes('--lang')?process.argv[process.argv.indexOf('--lang')+1]:'en';
 if(!['it','en'].includes(lang))throw Error('Use --lang it or en');
 const dir=path.resolve('docs/qa/evidence/website-premium');
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1600,height:1000},locale:lang==='it'?'it-IT':'en-GB',recordVideo:{dir:'/tmp/glauka-view-recordings',size:{width:1280,height:800}}});
 try {
  const source=`docs/examples/website/views-${lang}.glauka.json`;
  const {page}=await openDocument({newPage:()=>context.newPage()},lang,source,'http://127.0.0.1:5174/index.html');
  const video=page.video();
  const before=await page.evaluate(()=>JSON.stringify({root:neuroMapApp.state.root.children,relations:neuroMapApp.state.relationships}));
  for(const mode of ['mindmap','orgchart','concept-network','flowchart','mindmap']){
   await page.evaluate(mode=>NeuroMapLinkedViews.setMode(neuroMapApp,mode),mode);
   if(mode!=='mindmap')await page.locator('#nm-view-zoom-fit').click();
   await page.waitForTimeout(1000); // real frames, no retiming or fabricated interpolation
  }
  const after=await page.evaluate(()=>JSON.stringify({root:neuroMapApp.state.root.children,relations:neuroMapApp.state.relationships}));
  if(before!==after)throw Error('View switching changed canonical content');
  await page.close();await context.close();
  const dest=path.join(dir,`actual-view-switch-${lang}.webm`);await video.saveAs(dest);
  fs.writeFileSync(dest+'.json',JSON.stringify({source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),language:lang,capturedAt:new Date().toISOString(),sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex'),description:'Unedited recording from the actual local editor, including initial loading. Actual mode switches, not a node-morph animation. Canonical content unchanged.'},null,2)+'\n');
 }finally{await context.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
