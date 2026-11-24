#!/usr/bin/env node
// Real Chromium page/bridge/backend close. This does not automate Windows chrome.
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('@playwright/test'),readline=require('node:readline');
(async()=>{
 const binary=process.argv[2];if(!binary)throw Error('Pass a staged desktop backend executable');
 const config=fs.mkdtempSync(path.join(os.tmpdir(),'neuromap-close-'));
 const server=spawn(path.resolve(binary),['--mac-server'],{env:{...process.env,APPDATA:config,XDG_CONFIG_HOME:config},stdio:['ignore','pipe','pipe']});
 let browser,errors='';server.stderr.on('data',d=>errors+=d);const exited=new Promise(resolve=>server.on('exit',(code,signal)=>resolve({code,signal})));
 try{
  const lines=readline.createInterface({input:server.stdout});const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Backend startup timed out: '+errors)),10000);lines.once('line',line=>{clearTimeout(timeout);resolve(line.trim())})});
  if(!/^http:\/\/127\.0\.0\.1:\d+\/\?__nm_launch=[A-Za-z0-9_-]{43}$/.test(url))throw Error('Invalid authenticated backend launch URL');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));const page=await context.newPage();page.on('dialog',d=>d.accept());
  const live=page.waitForResponse(r=>r.url().endsWith('/__desktop/window/live')&&r.status()===200);
  await page.goto(url);await live;await page.waitForFunction(()=>window.neuroMapApp&&window.neuromapDesktop);
  const saved=await page.evaluate(async()=>{const a=neuroMapApp;a.state.root.text='QA real window close';a.tabs.forEach(t=>t.state.isDirty=false);return await a.persistWorkspace()});if(!saved)throw Error('Recovery failed before close');
  const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,500));if(server.exitCode!==null)throw Error('Frozen page lost its backend');await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await page.locator('#mindmap-canvas').click({position:{x:400,y:400}});
  const closed=page.waitForEvent('close');const begin=Date.now();await page.close({runBeforeUnload:true});await closed;await browser.close();browser=null;
  let timeout;const result=await Promise.race([exited,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Backend still alive after browser close: '+errors)),10000)})]).finally(()=>clearTimeout(timeout));
  if(result.code!==0)throw Error('Backend failed: '+JSON.stringify(result)+' '+errors);
  const workspace=JSON.parse(fs.readFileSync(path.join(config,'NeuroMap Architect','workspace-autosave.json'),'utf8'));if(!workspace.tabs.some(t=>t.root.text==='QA real window close'))throw Error('Recovery content lost');
  process.stdout.write(JSON.stringify({realChromiumPageClosed:true,liveConnectionEstablished:true,frozenPageResumed:true,browserProcessClosed:true,backendExited:true,recoveryPreserved:true,observedExitMs:Date.now()-begin,nativeWindowsGUIExercised:false},null,2)+'\n');
 }finally{if(browser)await browser.close();if(server.exitCode===null&&!server.killed)server.kill();fs.rmSync(config,{recursive:true,force:true})}
})().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1});
