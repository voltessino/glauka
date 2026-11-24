/* Release gate: run the actual staged Go server with CSP/native bridge, then
 * verify startup and menu-observer quiescence in a fresh Chromium profile.
 * Temporary recovery/profile state only. Never print the launch token.
 */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),readline=require('node:readline'),{spawn}=require('node:child_process');
const {chromium}=require('@playwright/test');
(async()=>{
 if(!process.argv[2])throw Error('Pass the host-native desktop QA backend');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'glauka-startup-smoke-'));
 const server=spawn(path.resolve(process.argv[2]),['--test-server'],{env:{...process.env,APPDATA:temp,LOCALAPPDATA:temp,XDG_CONFIG_HOME:temp},stdio:['ignore','pipe','pipe']});
 server.stderr.on('data',()=>{});let browser;
 try{
  const launch=await new Promise((resolve,reject)=>{
   const lines=readline.createInterface({input:server.stdout});
   const timer=setTimeout(()=>{lines.close();reject(Error('Desktop QA backend startup timed out'))},15000);
   lines.once('line',line=>{clearTimeout(timer);lines.close();resolve(line.trim())});
   server.once('error',e=>{clearTimeout(timer);reject(e)});server.once('exit',()=>{clearTimeout(timer);reject(Error('Desktop QA backend exited before startup'))});
  });
  const url=new URL(launch);if(url.hostname!=='127.0.0.1'||!url.searchParams.has('__nm_launch'))throw Error('Invalid desktop QA launch origin');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const started=Date.now();const response=await page.goto(launch,{waitUntil:'domcontentloaded',timeout:20000});
  if(!response.headers()['content-security-policy']?.includes("script-src 'nonce-"))throw Error('Native CSP missing');
  await page.waitForFunction(()=>window.neuroMapApp?.tabs&&window.neuromapDesktop&&!document.documentElement.classList.contains('glauka-booting'),{},{timeout:15000});
  const result=await page.evaluate(async()=>{
   const menu=document.getElementById('dropdown-tools');let mutations=0;
   const observer=new MutationObserver(r=>mutations+=r.length);observer.observe(menu,{childList:true,subtree:true});
   for(let i=0;i<50;i++)NeuroMapWorkspaceTools.curate();
   await new Promise(r=>setTimeout(r,200));const settled=mutations;
   await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));observer.disconnect();
   return {settled,mutations,visible:document.getElementById('glauka-startup').hidden};
  });
  if(!result.visible||result.settled!==result.mutations||result.mutations>10||errors.length)throw Error('Desktop UI did not reach a stable, responsive ready state');
  // Regression: the production Go server uses a restrictive CSP. The theme
  // bootstrap must receive the SAME nonce as other authorized inline scripts,
  // otherwise a saved dark appearance silently starts on a white splash.
  const nativeCsp=response.headers()['content-security-policy'];
  const nonceMatch=nativeCsp.match(/script-src\s+'nonce-([^']+)'/);
  if(!nonceMatch)throw Error('Native CSP has no script nonce');
  async function assertStartupAppearance(theme,background,textColor,titleColor){
    await page.evaluate(theme=>localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme,contrast:'normal',readability:'standard'})),theme);
    await page.reload({waitUntil:'domcontentloaded',timeout:20000});
    const visual=await page.evaluate(()=>{
      const splash=document.getElementById('glauka-startup');
      return {
        nonce:document.getElementById('glauka-theme-boot')?.nonce,
        dark:document.documentElement.classList.contains('glauka-dark-theme'),
        background:getComputedStyle(splash).backgroundColor,
        textColor:getComputedStyle(document.getElementById('glauka-startup-status')).color,
        titleColor:getComputedStyle(splash.querySelector('strong')).color
      };
    });
    if(visual.nonce!==nonceMatch[1])throw Error('Startup theme script missing native CSP nonce');
    if(visual.dark!==(theme!=='prisma')||visual.background!==background||visual.textColor!==textColor||visual.titleColor!==titleColor)
      throw Error('Incorrect splash appearance after reload: '+JSON.stringify({theme,visual}));
    await page.waitForFunction(()=>window.neuroMapApp?.tabs&&!document.documentElement.classList.contains('glauka-booting'),{},{timeout:15000});
  }
  await assertStartupAppearance('slate','rgb(15, 20, 34)','rgb(203, 213, 225)','rgb(226, 232, 240)');
  await assertStartupAppearance('prisma','rgb(255, 255, 255)','rgb(98, 94, 112)','rgb(27, 27, 39)');
  console.log('PASS native CSP theme bootstrap and light/dark splash on reload');
  // Delivery contract: the actual embedded UI must include the panel fixes,
  // not merely reach a responsive startup screen from a different main.
  const panels=await page.evaluate(async()=>{
   window.NeuroMapHome?.close();
   document.getElementById('nm-open-insert').click();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const panel=document.getElementById('nm-insert-panel'),heading=panel.querySelector('.nm-side-panel-heading'),
     body=panel.querySelector(':scope>.nm-panel-body'),actions=heading?.querySelector('.nm-panel-header-actions');
   if(!body||!actions||actions.querySelectorAll('button').length<2)return false;
   panel.querySelector('.nm-panel-preview-toggle').click();
   await new Promise(r=>requestAnimationFrame(r));
   const compact=panel.classList.contains('nm-panel-compact')&&getComputedStyle(body).display==='none'&&panel.getBoundingClientRect().height<100;
   actions.querySelector('button:last-child').click();
   document.getElementById('v6-show-layout').click();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const trigger=document.getElementById('nm-view-picker-trigger'),label=trigger?.querySelector('span');
   return compact&&trigger.getBoundingClientRect().width>200&&!!label?.textContent.trim()&&label.getBoundingClientRect().width>0;
  });
  if(!panels||errors.length)throw Error('Embedded editor is missing compact panel headers or readable View as controls');
  console.log('PASS native desktop startup: CSP + bridge + ready + stable menu + event loop ('+(Date.now()-started)+' ms)');
  console.log('PASS embedded panel headers, compact body and readable view selector');
 }finally{
  if(browser)await browser.close();
  if(server.exitCode===null){server.kill();await new Promise(r=>{server.once('exit',r);setTimeout(r,3000).unref()})}
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(String(error.message||error).replace(/__nm_launch=[A-Za-z0-9_-]+/g,'__nm_launch=[redacted]'));process.exitCode=1});
