/* Real staged native HTTP backend + Chromium + real filesystem fixtures.
 * Only the unavailable OS picker is substituted by prepare_multi_open_probe.py.
 * Timings exclude picker/OS window startup. Never prints the launch secret.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),readline=require('node:readline'),{spawn}=require('node:child_process');
const {chromium}=require('@playwright/test');
const args=Object.fromEntries(process.argv.slice(2).map((a,i,all)=>a.startsWith('--')?[a.slice(2),all[i+1]]:null).filter(Boolean));
const binary=path.resolve(args.binary||''),out=path.resolve(args.output||'');
if(!args.binary||!args.output||fs.existsSync(out))throw Error('Use --binary QA_BACKEND --output NEW_DIRECTORY [--repetitions 3]');
fs.mkdirSync(out,{recursive:true});
const corpus=path.join(out,'corpus');fs.mkdirSync(corpus);
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
function project(i,large=false){const root={id:`root_${i}`,text:`Fixture ${i} · à 中文`,notes:'Original note',children:Array.from({length:large?100:150},(_,j)=>({id:`node_${i}_${j}`,text:`Concept ${j}`,notes:large?'Clinical note '.repeat(770):'',children:[]}))};return {schema:'NeuroMapArchitect-SingleTab-v6',root,images:[{id:`image_${i}`,src:pixel,width:80,height:60,mode:'attached',attachedNodeId:root.children[0].id,offset:{dx:0,dy:-80},worldPos:{x:10,y:10},zLayer:'front',aspectLocked:true}],relationships:[{id:`rel_${i}`,fromId:root.children[0].id,toId:root.children[1].id,label:'Original relationship',color:'#aabbcc'}],thresholdY:500,typographyScale:1};}
function zipStored(entries){
 const chunks=[],directory=[];let offset=0;
 for(const [name,text]of entries){const n=Buffer.from(name),data=Buffer.from(text);let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}crc=(crc^0xffffffff)>>>0;
 const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);chunks.push(h,n,data);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);directory.push(c,n);offset+=h.length+n.length+data.length;
 }
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,central,end]);
}
const corpusFiles={small:[],mixed:[],large:[]},expectedByPath={};
for(let i=0;i<30;i++)for(const kind of Object.keys(corpusFiles)){
 const ext=kind==='mixed'?['gk','neuromap','xmind','md','opml','json','txt','markdown','xml','glk'][i%10]:'gk',name=path.join(corpus,`${kind}-${String(i).padStart(2,'0')}.${ext}`),p=project(i,kind==='large');
 if(kind==='mixed')p.root.children=p.root.children.slice(0,100); // Below the existing 130-node split-choice prompt.
 const text=['gk','neuromap','json','glk'].includes(ext)?JSON.stringify(p):['opml','xml'].includes(ext)?`<?xml version="1.0"?><opml version="2.0"><body><outline text="Fixture ${i}">${p.root.children.map((_,j)=>`<outline text="Concept ${j}"/>`).join('')}</outline></body></opml>`:`# Fixture ${i}\n${p.root.children.map((_,j)=>'  - Concept '+j).join('\n')}`;
 const documents=ext==='xmind'?[p,project(i+1000)]:['gk','neuromap','json','glk'].includes(ext)?[p]:[];
 const bytes=ext==='xmind'?zipStored([['content.json',JSON.stringify([{rootTopic:{id:p.root.id,title:p.root.text}}])],['neuromap/workspace.json',JSON.stringify({schema:'NeuroMapArchitect-WorkspaceBatch-v6',tabs:documents})]]):text;
 fs.writeFileSync(name,bytes);corpusFiles[kind].push(name);
 expectedByPath[name]=documents.map(d=>({rootId:d.root.id,text:d.root.text,firstId:d.root.children[0].id,lastId:d.root.children.at(-1).id,childCount:d.root.children.length,totalNotes:d.root.children.reduce((n,c)=>n+c.notes.length,0),image:d.images[0],relationship:d.relationships[0]}));
}
fs.writeFileSync(path.join(out,'corpus.json'),JSON.stringify(corpusFiles,null,2));
const results=[];
async function startBackend(temp,selection){
 const server=spawn(binary,['--test-server'],{env:{...process.env,APPDATA:temp,LOCALAPPDATA:temp,XDG_CONFIG_HOME:temp,GLAUKA_QA_MULTI_SELECTION:selection},stdio:['ignore','pipe','pipe']});server.stderr.on('data',()=>{});
 const url=await new Promise((resolve,reject)=>{const lines=readline.createInterface({input:server.stdout}),timer=setTimeout(()=>reject(Error('QA backend timeout')),15000);lines.once('line',s=>{clearTimeout(timer);lines.close();resolve(s.trim())});server.once('error',reject);server.once('exit',()=>reject(Error('QA backend exited')))});
 const parsed=new URL(url);if(parsed.hostname!=='127.0.0.1'||!parsed.searchParams.has('__nm_launch'))throw Error('Invalid native launch URL');return {server,url};
}
async function runCase(browser,kind,count,rep){
 const temp=fs.mkdtempSync(path.join(out,'session-')),selection=path.join(temp,'selection.json'),files=corpusFiles[kind].slice(0,count);fs.writeFileSync(selection,JSON.stringify(files));
 let server,context;const row={kind,count,repetition:rep,inputBytes:files.reduce((n,f)=>n+fs.statSync(f).size,0),runs:[],errors:[]};
 try{
  const started=await startBackend(temp,selection);server=started.server;context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it')});await page.goto(started.url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.neuroMapApp&&window.neuromapDesktop&&!document.documentElement.classList.contains('glauka-booting'),null,{timeout:30000});
  await page.evaluate(async()=>{await window.GlaukaAppReady;await neuroMapApp._desktopRecoveryReady;document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));window.__multiMetrics={layouts:0,layoutMs:0,tabBars:0,notices:[]};const a=neuroMapApp,compute=a.layout.computeLayout,tabbar=a.renderTabBar,toast=a.showToast;a.layout.computeLayout=function(...args){const t=performance.now();try{return compute.apply(this,args)}finally{__multiMetrics.layouts++;__multiMetrics.layoutMs+=performance.now()-t}};a.renderTabBar=function(...args){__multiMetrics.tabBars++;return tabbar.apply(this,args)};a.showToast=function(text,...args){__multiMetrics.notices.push(String(text));return toast.call(this,text,...args)};a.state.updateNodeText(a.state.root.id,'UNSAVED — preserve this map');a.markChanged();window.__originalTab=a.activeTabId;window.__originalState=JSON.stringify({root:a.state.root,images:a.state.images,relationships:a.state.relationships,undo:a.state.undoStack});});
  if(args.profile)await page.evaluate(()=>{
   __multiMetrics.phases={};
   const measure=(name,fn,owner)=>function(...args){
    const t=performance.now(),done=()=>{const p=__multiMetrics.phases[name]||={calls:0,inclusiveMs:0};p.calls++;p.inclusiveMs+=performance.now()-t};
    try{const value=fn.apply(owner||this,args);if(value?.then)return Promise.resolve(value).finally(done);done();return value}catch(error){done();throw error}
   };
   const a=neuroMapApp;
   for(const [owner,key,name]of [[a,'parseTextHierarchy','textParse'],[a.io,'parseZipArchiveInMemory','zipParse'],[a,'importFiles','importCommit'],[a,'persistWorkspace','recoveryPersist']])
    if(typeof owner[key]==='function')owner[key]=measure(name,owner[key],owner);
   const core=GlaukaNativeOpen;
   window.GlaukaNativeOpen={...core,run(files,options){
    return core.run(files.map(file=>file.read?{...file,read:measure('nativeRead',file.read,file)}:file),options);
   }};
  });
  for(const phase of ['open','reopen']){
   if(args.profile)await page.evaluate(()=>{__multiMetrics.phases={}});
   const before=await page.evaluate(()=>({tabs:neuroMapApp.tabs.length,layouts:__multiMetrics.layouts,layoutMs:__multiMetrics.layoutMs,tabBars:__multiMetrics.tabBars,noticeStart:__multiMetrics.notices.length}));let rss=0;
   const sample=()=>{try{rss=Math.max(rss,Number(fs.readFileSync(`/proc/${server.pid}/status`,'utf8').match(/^VmRSS:\s+(\d+)/m)?.[1]||0)*1024)}catch{}};sample();const sampler=setInterval(sample,20),t=performance.now();
   try{await page.locator('#mindmap-canvas').focus();await page.keyboard.press('Control+o');await page.waitForFunction(()=>!neuroMapApp._nmNativeOpenPending,null,{timeout:180000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}finally{clearInterval(sampler);sample();}
   const elapsedMs=performance.now()-t;
   const after=await page.evaluate(()=>{const a=neuroMapApp,t=a.tabs.find(t=>t.id===__originalTab);return {tabs:a.tabs.length,layouts:__multiMetrics.layouts,layoutMs:__multiMetrics.layoutMs,tabBars:__multiMetrics.tabBars,notices:__multiMetrics.notices,originalPreserved:JSON.stringify({root:t.state.root,images:t.state.images,relationships:t.state.relationships,undo:t.state.undoStack})===__originalState,origins:new Set(a.tabs.map(t=>t.filePath).filter(Boolean)).size,heapBytes:performance.memory?.usedJSHeapSize||null,report:a._nmLastNativeOpenReport||null}});
   const metadataPreserved=await page.evaluate(expected=>expected.every(([path,docs])=>docs.every((doc,index)=>{
    const s=neuroMapApp.tabs.filter(t=>t.filePath===path).sort((a,b)=>a.originSheetIndex-b.originSheetIndex)[index]?.state;
    return s&&s.root.id===doc.rootId&&s.root.text===doc.text&&s.root.children.length===doc.childCount&&s.root.children[0].id===doc.firstId&&s.root.children.at(-1).id===doc.lastId&&s.root.children.reduce((n,c)=>n+c.notes.length,0)===doc.totalNotes&&s.images.length===1&&s.images[0].src===doc.image.src&&s.images[0].attachedNodeId===doc.image.attachedNodeId&&s.relationships.length===1&&s.relationships[0].fromId===doc.relationship.fromId&&s.relationships[0].toId===doc.relationship.toId;
   })),files.map(f=>[f,expectedByPath[f]]));
   row.runs.push({phases:args.profile?await page.evaluate(()=>__multiMetrics.phases):undefined,metadataPreserved,phase,elapsedMs,addedTabs:after.tabs-before.tabs,uniqueOrigins:after.origins,layoutCalls:after.layouts-before.layouts,layoutMs:after.layoutMs-before.layoutMs,tabBarRenders:after.tabBars-before.tabBars,peakBackendRSSBytes:rss,heapBytes:after.heapBytes,originalPreserved:after.originalPreserved,notices:after.notices.slice(before.noticeStart),report:after.report});
   if(!metadataPreserved)throw Error('Opening files changed native notes/images/relationships or sheet identity');
   if(!after.originalPreserved)throw Error('Opening files changed the original unsaved map');
   if(after.origins!==count)row.errors.push(`${phase}: expected ${count} origins, got ${after.origins}`);
  }
 }catch(e){row.errors.push(String(e.message).replace(/__nm_launch=[A-Za-z0-9_-]+/g,'__nm_launch=[redacted]'))}finally{if(context)await context.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>{server.once('exit',r);setTimeout(r,3000).unref()})}fs.rmSync(temp,{recursive:true,force:true});}
 results.push(row);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({method:'real Linux native backend + Chromium; native picker substituted; real generated filesystem fixtures; no simulated clock',results},null,2));console.log(`${kind} ${count} #${rep}: ${row.runs.map(r=>r.phase+' '+r.elapsedMs.toFixed(1)+' ms').join(', ')}; errors ${row.errors.length}`);
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--enable-precise-memory-info']});try{for(let rep=1;rep<=Number(args.repetitions||3);rep++)for(const kind of (args.kinds||'small,mixed,large').split(','))for(const count of (args.counts||'5,10,20,30').split(',').map(Number))await runCase(browser,kind,count,rep);}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
