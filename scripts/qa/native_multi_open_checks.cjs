/* Real native HTTP/Go filesystem + editor checks. Use only a QA probe built by
 * prepare_multi_open_probe.py: the OS picker boundary is substituted on Linux.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('@playwright/test');
const args=Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:null).filter(Boolean));
if(!args.binary||!args.output||fs.existsSync(args.output))throw Error('Use --binary QA_BACKEND --output NEW_DIRECTORY');
const out=path.resolve(args.output),session=path.join(out,'session'),filesDir=path.join(out,'files'),selection=path.join(out,'selection.json');fs.mkdirSync(session,{recursive:true});fs.mkdirSync(filesDir);fs.writeFileSync(selection,'[]');
const checks=[],report={method:'real Linux Go backend and Chromium; only native picker substituted',physicalWindowsMacOSTested:false,checks};
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
function project(name){return {schema:'NeuroMapArchitect-SingleTab-v6',root:{id:'root_'+name,text:name,notes:'Original note',children:[{id:'child_'+name,text:'First',children:[]},{id:'other_'+name,text:'Second',children:[]}]},images:[{id:'img_'+name,src:pixel,width:80,height:60,mode:'attached',attachedNodeId:'child_'+name,offset:{dx:0,dy:-80},worldPos:{x:0,y:0},zLayer:'front',aspectLocked:true}],relationships:[{id:'rel_'+name,fromId:'child_'+name,toId:'other_'+name,label:'Original link',color:'#aabbcc'}]};}
function write(name,text){const f=path.join(filesDir,name);fs.writeFileSync(f,typeof text==='string'||Buffer.isBuffer(text)?text:JSON.stringify(text));return f;}
let browser,server,page,backupDir;
async function check(name,fn){try{const details=await fn();checks.push({name,passed:true,details:details||null});console.log('PASS '+name)}catch(error){checks.push({name,passed:false,error:String(error.message).replace(/__nm_launch=[A-Za-z0-9_-]+/g,'__nm_launch=[redacted]')});console.log('FAIL '+name+': '+checks.at(-1).error)}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
async function closeReport(){const overlay=page.locator('#nm-decision-overlay');if(await overlay.isVisible())await page.locator('#nm-decision-actions button').first().click();}
async function open(paths,{cancel=false}={}){
 await closeReport();fs.writeFileSync(selection,JSON.stringify(paths));
 await page.locator('#mindmap-canvas').focus();await page.keyboard.press('Control+o');
 if(cancel){await page.locator('#nm615-import-modal [data-nm615=cancel]').click({timeout:15000});}
 await page.waitForFunction(()=>!neuroMapApp._nmNativeOpenPending,null,{timeout:120000});
 return page.evaluate(()=>neuroMapApp._nmLastNativeOpenReport);
}
(async()=>{
 server=spawn(path.resolve(args.binary),['--test-server'],{env:{...process.env,APPDATA:session,LOCALAPPDATA:session,XDG_CONFIG_HOME:session,GLAUKA_QA_MULTI_SELECTION:selection},stdio:['ignore','pipe','pipe']});server.stderr.on('data',()=>{});
 const launch=await new Promise((resolve,reject)=>{const lines=readline.createInterface({input:server.stdout}),timer=setTimeout(()=>reject(Error('Native startup timeout')),15000);lines.once('line',s=>{clearTimeout(timer);lines.close();resolve(s.trim())});server.once('error',reject)});
 if(new URL(launch).hostname!=='127.0.0.1')throw Error('Unexpected native origin');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(launch,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.neuroMapApp?.io&&window.neuromapDesktop);
 await page.evaluate(async()=>{await neuroMapApp._desktopRecoveryReady;await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=neuroMapApp;a.state.updateNodeText(a.state.root.id,'Original unsaved map');a.markChanged();window.__original=a.activeTabId;window.__originalState=JSON.stringify({root:a.state.root,undo:a.state.undoStack,images:a.state.images,relations:a.state.relationships});});
 const a=write('A.gk',project('A')),b=write('B.neuromap',project('B'));
 await check('opens real files with images and relationships while preserving existing unsaved data',async()=>{const r=await open([a,b]);assert.deepEqual([r.opened,r.ignored,r.failed],[2,0,0]);assert.equal(r.backupProtected,true);const data=await page.evaluate(()=>neuroMapApp.tabs.filter(t=>t.filePath).map(t=>({images:t.state.images.length,relations:t.state.relationships.length,path:t.filePath})));assert.equal(data.length,2);assert.ok(data.every(t=>t.images===1&&t.relations===1));});
 await check('duplicates and repeated opens preserve user edits and Undo',async()=>{await page.evaluate(p=>{const x=neuroMapApp.tabs.find(t=>t.filePath===p);neuroMapApp.activateTab(x.id);neuroMapApp.state.updateNodeText(neuroMapApp.state.root.id,'Edited after opening');neuroMapApp.markChanged();window.__editedUndo=JSON.stringify(neuroMapApp.state.undoStack)},a);const r=await open([a,a,b]);assert.deepEqual([r.opened,r.ignored,r.failed],[0,3,0]);const data=await page.evaluate(p=>{const t=neuroMapApp.tabs.find(t=>t.filePath===p);return {text:t.state.root.text,dirty:t.state.isDirty,same:JSON.stringify(t.state.undoStack)===__editedUndo}},a);assert.deepEqual(data,{text:'Edited after opening',dirty:true,same:true});});
 await check('missing and corrupt files do not prevent later valid opens and all errors stay visible',async()=>{const missing=path.join(filesDir,'MISSING.gk'),bad=write('CORRUPT.gk','{invalid JSON'),good=write('Good-after-errors.gk',project('AfterErrors')),r=await open([missing,bad,good]);assert.deepEqual([r.opened,r.ignored,r.failed],[1,0,2]);await page.locator('#nm-decision-overlay').waitFor({state:'visible'});const text=await page.locator('#nm-decision-text').innerText();assert.ok(text.includes('MISSING.gk')&&text.includes('CORRUPT.gk'));await closeReport();});
 await check('an import error report waits without replacing an existing user confirmation',async()=>{
  const bad=write('Queued-report.gk','{invalid JSON');fs.writeFileSync(selection,JSON.stringify([bad]));
  await page.evaluate(async()=>{const files=await neuromapDesktop.openProjects();window.__reportBatch=neuroMapApp.v6ImportNativeBatch(files);window.__userQuestion=neuroMapApp.nmAsk({title:'Conferma utente',message:'Mantieni questa domanda',choices:[{value:'continue',text:'Continua',primary:true}]});});
  await page.evaluate(()=>window.__reportBatch);assert.equal(await page.locator('#nm-decision-text').innerText(),'Mantieni questa domanda');
  await page.locator('#nm-decision-actions').getByRole('button',{name:'Continua',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('nm-decision-text')?.textContent.includes('Queued-report.gk'));
  await closeReport();
 });
 await check('cancelling a large Markdown import keeps the original file association and continues',async()=>{const md=write('cancel.md','# Large document\n'+Array.from({length:180},(_,i)=>'  - Concept '+i).join('\n')),good=write('After-cancel.gk',project('AfterCancel')),r=await open([md,good],{cancel:true});assert.deepEqual([r.opened,r.ignored,r.failed],[1,1,0]);assert.equal(await page.evaluate(p=>neuroMapApp.tabs.some(t=>t.filePath===p),md),false);});
 await check('readable files open even when path approval and recovery persistence fail',async()=>{
  await page.evaluate(()=>neuroMapApp.persistWorkspace());const dir=path.join(session,'NeuroMap Architect');backupDir=dir+'.qa-backup';fs.renameSync(dir,backupDir);fs.writeFileSync(dir,'blocked preferences directory');
  try{const good=write('Grant-warning.gk',project('Warning')),r=await open([good]);assert.deepEqual([r.opened,r.failed],[1,0]);assert.equal(r.entries[0].pathWarning,true);assert.equal(r.backupProtected,false);await page.locator('#nm-decision-overlay').waitFor({state:'visible'});assert.match(await page.locator('#nm-decision-text').innerText(),/percorso/i);await closeReport();}
  finally{fs.unlinkSync(dir);fs.renameSync(backupDir,dir);backupDir=null;}
 });
 await check('the 100 MiB boundary opens and an oversized selection is rejected independently',async()=>{const root=project('Boundary'),buffer=Buffer.alloc(100*1024*1024,0x20);buffer.write(JSON.stringify(root));const good=write('Boundary-100MiB.gk',buffer),bad=path.join(filesDir,'Oversized.gk'),fd=fs.openSync(bad,'w');fs.ftruncateSync(fd,100*1024*1024+1);fs.closeSync(fd);const r=await open([bad,good]);assert.deepEqual([r.opened,r.ignored,r.failed],[1,0,1]);assert.equal(r.entries[0].code,'tooLarge');assert.ok(await page.evaluate(p=>neuroMapApp.tabs.some(t=>t.filePath===p&&t.state.root.id==='root_Boundary'),good));await closeReport();});
 await check('the original unsaved map still has its original tree, images, relationships and history',async()=>{assert.equal(await page.evaluate(()=>{const s=neuroMapApp.tabs.find(t=>t.id===__original).state;return JSON.stringify({root:s.root,undo:s.undoStack,images:s.images,relations:s.relationships})===__originalState}),true);assert.equal(await page.evaluate(()=>neuroMapApp.persistWorkspace()),true);});
})().catch(e=>{checks.push({name:'harness',passed:false,error:String(e.message).replace(/__nm_launch=[A-Za-z0-9_-]+/g,'__nm_launch=[redacted]')});console.log('FAIL harness: '+checks.at(-1).error)}).finally(async()=>{
 if(backupDir){const dir=path.join(session,'NeuroMap Architect');if(fs.existsSync(dir))fs.unlinkSync(dir);fs.renameSync(backupDir,dir);}
 if(browser)await browser.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>{server.once('exit',r);setTimeout(r,3000).unref()})}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(checks.some(x=>!x.passed))process.exitCode=1;
});
