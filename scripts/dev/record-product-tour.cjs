/* Record a FULL feature tour from the running Glauka desktop editor.
 * Usage (local only, no GitHub Actions):
 *   npm run dev:desktop     # or the existing editor preview on :5174
 *   CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/dev/record-product-tour.cjs
 * The media is NOT published until all real editor actions and proof gates pass.
 * AI uses a clearly labelled LOCAL FIXTURE: no live provider, secrets or costs.
 */
"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const {chromium}=require('@playwright/test');
const createProject=require('./website-demo-project.cjs');
const root=path.resolve(__dirname,'../..');
const media=path.join(root,'apps/website/media');
const basename='glauka-feature-tour';
const FPS=10,WIDTH=1440,HEIGHT=900;
const liveAI=process.argv.includes('--live-ai');
const count=Number(process.argv.find(a=>a.startsWith('--nodes='))?.slice(8)||1200);
if(!Number.isInteger(count)||count<200||count>2400)
 throw Error('--nodes must be 200..2400; never claim import of more than was verified');
const base=process.env.GLAUKA_EDITOR_URL||'http://127.0.0.1:5174/index.html';
if(!/^http:\/\/127\.0\.0\.1:(?:\d+)\/index\.html$/.test(base))
 throw Error('For privacy, record only the local editor loopback address');
const scenes=[
 {id:'intro',seconds:7,it:'Le idee trovano una struttura',en:'Make your thinking visible'},
 {id:'ai',seconds:28,it:'AI: spiega un concetto',en:'AI: explain a concept'},
 {id:'views',seconds:30,it:'Una mappa, diverse viste',en:'One map, multiple views'},
 {id:'markdown',seconds:34,it:'Markdown grande: importazione reale',en:'Large Markdown: real import'},
 {id:'quiz',seconds:24,it:'Quiz offline da rami e note',en:'Offline quizzes from your map'},
 {id:'flashcards',seconds:24,it:'Flashcard e ripasso attivo',en:'Flashcards and active recall'},
 {id:'outro',seconds:8,it:'Glauka: tutto resta collegato',en:'Glauka: keep it connected'}
];
const total=scenes.reduce((a,x)=>a+x.seconds,0);
const chapterList=[];let position=0;
for(const s of scenes){s.start=position;chapterList.push({id:s.id,start:position,it:s.it,en:s.en});position+=s.seconds;}
const subtitleText={
 intro:'Dalla prima idea alla mappa: una registrazione dell’editor desktop.',
 ai:liveAI
  ?'Spiega un concetto nel contesto della mappa con il provider AI configurato per questa registrazione.'
  :'Spiega un concetto nel contesto della mappa. Questa risposta AI è un esempio locale dichiarato, non una chiamata a un provider.',
 views:'Gli stessi nodi passano dalla mappa a un organigramma, a un albero e a una rete concettuale.',
 markdown:'Importiamo un Markdown con molte voci tramite lo studio di importazione, misurando il tempo reale dell’operazione.',
 quiz:'Le domande offline nascono dai rami e dalle note. La risposta e la valutazione restano sotto il controllo dell’utente.',
 flashcards:'Una carta presenta la domanda, poi rivela la risposta per il ripasso attivo.',
 outro:'La demo mostra funzioni realmente presenti nell’editor. Prestazioni e disponibilità dipendono dal dispositivo e dalla versione.'
};
const subtitleEnglish={"intro": "From the first idea to a map: a recording of the real desktop editor.", "ai": "Explain a concept in the context of your map. This is a labelled local sample response, not a live AI provider call.", "views": "The same topics become a mind map, an organisation chart, a concept tree and a concept network.", "markdown": "Import a large Markdown outline and split it into maps. The time shown was measured on the recording computer.", "quiz": "Offline questions use your branches and notes. Check answers against your sources.", "flashcards": "Try to recall the answer, reveal it, then rate how well you remembered it.", "outro": "Glauka connects maps, AI assistance, imports and review. Features and performance vary by platform and device."};
function formatTime(s){
 const t=Math.round(s*1000);return [Math.floor(t/3600000),Math.floor(t/60000)%60,Math.floor(t/1000)%60]
 .map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(t%1000).padStart(3,'0');
}
function subtitleFile(language="it"){
 let text='WEBVTT\n\n';for(const s of scenes)
   text+=formatTime(s.start)+' --> '+formatTime(s.start+s.seconds)+'\n'+(language==='en'?subtitleEnglish[s.id]:subtitleText[s.id])+'\n\n';
 return text;
}
function markdown(nodes){
 // Genuine Markdown outline, not random fake screenshots or cached HTML.
 const out=['# Anatomia e fisiologia — archivio dimostrativo'];
 for(let i=0;i<nodes;i++){
   const group=1+Math.floor(i/60),num=String(i+1).padStart(4,'0');
   out.push(i%60===0?'## Modulo '+group:'- Concetto '+num+' — definizione e collegamenti');
 }
 return out.join('\n');
}
async function main(){
 fs.mkdirSync(media,{recursive:true});
 const tmp=path.join(media,basename+'.recording.mp4');
 const completeFile=path.join(media,basename+'.mp4');
 const captionFile=path.join(media,basename+'.it.vtt');
 const proofFile=path.join(media,basename+'.provenance.json');
 const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,
  args:['--no-sandbox']
 });
 let encoder,encoderError='',done,frames=0;
 const proof={source:'Real Glauka desktop editor on loopback',
  ai:liveAI?'Live configured provider, explicitly opted in':'Local labelled fixture, NOT a live provider response',
  audio:false,fps:FPS,nodesRequested:count,actions:[],chapterList};
 try{
  const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},
   deviceScaleFactor:1,locale:'it-IT'});
  const permittedOrigins=new Set([new URL(base).origin]);
  await page.route('**/*',route=>{
   try{
     const target=new URL(route.request().url());
     return permittedOrigins.has(target.origin)?route.continue():route.abort();
   }catch{return route.abort();}
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.neuroMapApp?.renderer&&window.NeuroMapLinkedViews
   &&window.NeuroMapUISkin&&window.nmProduct,null,{timeout:45000});
  await page.evaluate(project=>{
   const a=window.neuroMapApp;
   a.importHierarchy(project,{newTab:true});
   window.NM615.setTheme('white');
   window.NeuroMapUISkin.set({theme:'minimal'});
   document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden'));
   a.recalculateAndRender();a.fitToScreen();
  },createProject());
  await page.addStyleTag({content:`
  .gl-tour-caption{position:fixed;bottom:15px;left:50%;transform:translateX(-50%);
  width:min(1080px,calc(100% - 50px));z-index:1000000;border:1px solid #ded9eb;
  border-radius:17px;background:#fffc;color:#211c33;
  padding:16px 24px;box-shadow:0 15px 48px #0b092844;font:16px/1.4 system-ui}
  .gl-tour-caption strong{display:block;color:#593fc6;font-size:21px}
  .gl-tour-caption small{display:block;color:#5d526e;margin-top:6px;font-size:13px}
  .gl-tour-caption em{position:absolute;right:24px;top:20px;font-size:17px;
  font-style:normal;font-weight:850;color:#7152da}
  `});
  await page.evaluate(()=>{
   const box=document.createElement('aside');box.className='gl-tour-caption';
   box.innerHTML='<strong></strong><small></small><em>glauka.</em>';
   document.body.append(box);
  });
  async function caption(title,detail){
   await page.evaluate(([title,detail])=>{
    const b=document.querySelector('.gl-tour-caption');
    b.querySelector('strong').textContent=title;
    b.querySelector('small').textContent=detail;
   },[title,detail]);
  }
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
   '-f','image2pipe','-framerate',String(FPS),'-i','pipe:0',
   '-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','24',
   '-pix_fmt','yuv420p','-movflags','+faststart',tmp],{stdio:['pipe','ignore','pipe']});
  encoder.stderr.on('data',d=>{encoderError+=d.toString()});
  done=once(encoder,'close');
  async function frame(seconds){
   for(let i=0;i<seconds*FPS;i++){
    if(errors.length)throw Error('Editor error: '+errors.join('; '));
    const data=await page.screenshot({type:'png',animations:'disabled'});
    if(!encoder.stdin.write(data))await once(encoder.stdin,'drain');
    frames++;
   }
  }
  await caption(scenes[0].it,'Registrazione reale, con contenuti dimostrativi.');await frame(scenes[0].seconds);
  // Live AI is strictly opt-in: --live-ai requires a locally configured
  // HTTPS provider. Only that exact origin is added to Playwright's allowlist.
  if(liveAI){
   const settings=await page.evaluate(()=>({
     baseUrl:neuroMapApp.aiClient.settings.baseUrl,
     model:neuroMapApp.aiClient.settings.model
   }));
   if(!settings.model)throw Error('--live-ai needs a configured model');
   const provider=new URL(settings.baseUrl||'');
   if(provider.protocol!=='https:')throw Error('Live AI provider must use HTTPS');
   permittedOrigins.add(provider.origin);
  }
  // Scene 1: the genuine AI workflow and genuine response UI.
  await page.evaluate(async(live)=>{
   const app=neuroMapApp;app.selectNode(app.state.root.children[0].id);
   window.nmProduct.guard=()=>true;
   if(!live)app.aiClient.chat=async()=>JSON.stringify({
    'DEFINIZIONE TECNICA':'Un concetto è un’unità di significato collegata ad altri concetti della stessa disciplina.',
    'SPIEGAZIONE SEMPLICE':'Una mappa mette in relazione idee, dettagli ed esempi, così è più facile individuare i legami.',
    'ESEMPIO PRATICO':'In un progetto, l’idea si collega alle persone, alle risorse, al piano e alla verifica dei risultati.'
   });
   await app.aiExplainNode();
  },liveAI);
  if(!(await page.locator('#ai-explain-panel').isVisible()))throw Error('AI explanation UI did not appear');
  proof.actions.push({scene:'ai',verified:true,fixture:!liveAI,liveProvider:liveAI});
  await caption(scenes[1].it,liveAI
    ? 'Richiesta e risposta del provider AI configurato localmente'
    : 'Schermata AI reale · Testo dimostrativo locale, senza provider online');
  await frame(scenes[1].seconds);
  await page.locator('#ai-explain-panel').evaluate(el=>el.classList.add('hidden'));
  // Scene 2: production Linked Views, not fabricated screen transitions.
  const modes=['mindmap','orgchart','concept-tree','concept-network'];
  const per=Math.floor(scenes[2].seconds/modes.length);
  for(let i=0;i<modes.length;i++){
   const mode=modes[i];
   const status=await page.evaluate(mode=>{
    const ok=NeuroMapLinkedViews.setMode(neuroMapApp,mode);
    return {ok,actual:neuroMapApp.state.root.viewMode||'mindmap'};
   },mode);
   if(status.ok===false||status.actual!==mode)throw Error('Cannot display real view: '+mode);
   const label={mindmap:'Mappa mentale',orgchart:'Organigramma',
    'concept-tree':'Albero concettuale','concept-network':'Rete concettuale'}[mode];
   await caption(scenes[2].it,label+' · Gli stessi dati, un’altra rappresentazione');
   await page.waitForTimeout(100);
   await frame(per+(i===modes.length-1?scenes[2].seconds%per:0));
  }
  proof.actions.push({scene:'views',verified:modes});
  // Scene 3: actual Markdown import studio and actual elapsed time.
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'mindmap'));
  const before=await page.evaluate(()=>neuroMapApp.tabs.length);
  await page.locator('#paste-modal').evaluate(el=>el.classList.remove('hidden'));
  await page.locator('#paste-modal-textarea').fill(markdown(count));
  await page.locator('#btn-confirm-paste-newtab').click();
  await page.locator('#gl-paste-studio').waitFor({state:'visible',timeout:15000});
  await page.locator('#gl-import-mode').selectOption('split');
  await page.locator('#gl-import-capacity').selectOption('80');
  await caption(scenes[3].it,'Markdown reale · '+count.toLocaleString('it-IT')+
    ' righe · Anteprima e suddivisione in mappe');
  await frame(8);
  const t0=await page.evaluate(()=>performance.now());
  await page.locator('#gl-paste-studio .nm615-primary').click({timeout:30000});
  await page.waitForFunction(before=>neuroMapApp.tabs.length>before,before,{timeout:60000});
  const outcome=await page.evaluate(({before,t0})=>({
    createdTabs:neuroMapApp.tabs.length-before,
    elapsedMs:Math.round(performance.now()-t0),
    newNodes:neuroMapApp.tabs.slice(before).reduce((n,t)=>
      n+t.state.getAllNodesIncludingCollapsed().length,0)
   }),{before,t0});
  if(outcome.createdTabs<2||outcome.newNodes<count*.75)
   throw Error('Markdown import verification failed: '+JSON.stringify(outcome));
  proof.actions.push({scene:'markdown',...outcome,nodesRequested:count});
  await page.evaluate(()=>neuroMapApp.hideMenus());
  await caption(scenes[3].it,'Import effettivo: '+outcome.createdTabs+' mappe · '+
    outcome.newNodes+' nodi · '+(outcome.elapsedMs/1000).toFixed(2)+' s su questa macchina');
  await frame(scenes[3].seconds-8);
  // Scene 4: return to a small real map for a readable offline quiz.
  await page.evaluate(project=>{
   // Real app quiz engine needs genuine question material in the nodes.
   project.children[0].notes='Qual è il ruolo dell’idea nel progetto? Collegare un problema al risultato desiderato.';
   project.children[1].notes='Chi partecipa? Persone coinvolte, utenti e collaboratori.';
   project.children[3].notes='Che cosa contiene un piano? Priorità e passi concreti.';
   neuroMapApp.importHierarchy(project,{newTab:true});
   neuroMapApp.fitToScreen();
  },createProject());
  await page.locator('#nm-learn-open').click();
  await page.locator('#nm-learn-panel .nm-learn-tabs button')
    .filter({hasText:'Quiz'}).click();
  await page.locator('#nm-learn-panel .nm-learn-row button')
    .filter({hasText:'Inizia quiz'}).click();
  await page.locator('#nm-learn-panel .nm-learn-question').waitFor({state:'visible',timeout:10000});
  proof.actions.push({scene:'quiz',verified:true,question:await page.locator('.nm-learn-question').first().innerText()});
  await caption(scenes[4].it,'Quiz reale generato offline da rami e note');
  await frame(scenes[4].seconds);
  // Close only the study panel; the next scene uses the native flashcard player.
  await page.locator('#nm-learn-panel header button').click();
  // Scene 5: card is a declared local demo fixture inside the real player.
  await page.evaluate(()=>{
   const a=neuroMapApp,n=a.state.root.children[0];
   a.studyCards=[{
     id:'tour-card',sourceTabId:a.activeTabId,sourceNodeId:n.id,
     sourceSignature:a.v5Signature(n),question:'Che cosa significa collegare i concetti?',
     answer:'Riconoscere relazioni tra idee, esempi e informazioni.',
     sr:{dueAt:0,intervalDays:0,reviews:0,lapses:0}
   }];
   a.openFlashcards();
  });
  await page.locator('#flash-modal').waitFor({state:'visible',timeout:10000});
  if(!(await page.locator('#flash-reveal').isEnabled()))throw Error('Flashcard player is empty');
  proof.actions.push({scene:'flashcards',verified:true,fixture:true});
  await caption(scenes[5].it,'Flashcard dimostrativa nel vero player: prova a rispondere');
  await frame(11);
  await page.locator('#flash-reveal').click();
  await caption(scenes[5].it,'Rivela la risposta e valuta quanto ricordi');
  await frame(scenes[5].seconds-11);
  await page.evaluate(()=>neuroMapApp.closeFlashcards());
  await page.evaluate(()=>{
   NeuroMapLinkedViews.setMode(neuroMapApp,'mindmap');
   neuroMapApp.fitToScreen();
  });
  await caption(scenes[6].it,'Mappe, AI, importazione, quiz e flashcard · Demo desktop');
  await frame(scenes[6].seconds);
  encoder.stdin.end();
  const [exit]=await done;if(exit!==0)throw Error('ffmpeg failed: '+encoderError);
  const probe=spawn('ffprobe',['-v','error','-show_entries','format=duration',
    '-of','default=nokey=1:noprint_wrappers=1',tmp]);
  let buffer='';probe.stdout.on('data',d=>buffer+=d);
  const [probeExit]=await once(probe,'close');
  const duration=Number(buffer.trim());
  if(probeExit!==0||!Number.isFinite(duration)||Math.abs(duration-total)>.3)
   throw Error('Rendered duration does not match real chapter timing');
  const hash=crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
  proof.fps=FPS;proof.frames=frames;proof.durationSeconds=duration;
  proof.sha256=hash;proof.nodeMetricsMeasuredOn='the computer running the local recorder';
  fs.renameSync(tmp,completeFile);
  const poster=spawn('ffmpeg',['-y','-ss','2','-i',completeFile,'-frames:v','1',path.join(media,basename+'.png')],{stdio:'ignore'});
  const [posterExit]=await once(poster,'close');if(posterExit!==0)throw Error('Cannot generate video poster');
  fs.writeFileSync(captionFile,subtitleFile(),'utf8');
  fs.writeFileSync(path.join(media,basename+'.en.vtt'),subtitleFile('en'),'utf8');
  fs.writeFileSync(proofFile,JSON.stringify(proof,null,2)+'\n','utf8');
  console.log('Verified real product tour:',completeFile,'duration',duration,
   'frames',frames,'SHA256',hash);
  console.log('Markdown measured:',JSON.stringify(outcome));
 }catch(error){
  encoder?.stdin?.destroy();
  if(encoder){encoder.kill('SIGKILL');await done?.catch(()=>{})}
  try{fs.unlinkSync(tmp)}catch{}
  throw error;
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
