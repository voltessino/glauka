'use strict';
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');

function git(args){
  return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
}
function read(name){
  return fs.readFileSync(path.join(root,name),'utf8');
}

function staticProblems(){
  const problems=[];
  let versions;
  try{versions=JSON.parse(read('versions.json'));}
  catch(error){return ['versions.json non si legge. '+error.message];}
  if(versions.windows?.version!=='1.0.4'||versions.macos?.version!=='1.0.4'){
    problems.push('La versione visibile di Windows e Mac deve restare 1.0.4. Controlla versions.json. Il numero 7.4.0-rc.1 è solo l\'identificativo interno dei moduli, non va mostrato.');
  }
  if(versions.editor==='1.0.4'){
    problems.push('versions.json editor non è la versione mostrata alle persone. Non copiare 1.0.4 nel numero interno dei moduli senza una decisione separata.');
  }
  if(versions.android?.version!=='0.6.21-rc.1-private'){
    problems.push('Il numero dell\'app per telefono è una linea diversa. Non cambiarlo solo per allinearlo a 1.0.4.');
  }
  const shell=read('apps/desktop-shared/editor/shell-dictionary.js');
  if(!shell.includes("const NM_PRODUCT_VERSION='1.0.4'")){
    problems.push('Il numero mostrato nell\'app non è 1.0.4. Aggiorna apps/desktop-shared/editor/shell-dictionary.js.');
  }
  if(shell.includes('7.4.0')){
    problems.push('shell-dictionary.js contiene ancora 7.4.0. Quel file è quello che vede chi usa l\'app.');
  }
  const pkg=JSON.parse(read('package.json'));
  if(!String(pkg.scripts?.['test:structure']||'').includes('glauka-integrity-preflight.test.cjs')){
    problems.push('npm run test:structure non include più il controllo di integrità. Rimetti scripts/maintenance/glauka-integrity-preflight.test.cjs nello script.');
  }
  if(!String(pkg.scripts?.test||'').includes('glauka-integrity-preflight.test.cjs')){
    problems.push('npm test non include più il controllo di integrità.');
  }
  for(const manifest of ['apps/desktop-shared/editor/sources.json','apps/android/editor/sources.json']){
    let list;
    try{list=JSON.parse(read(manifest));}
    catch(error){problems.push(manifest+' non è un elenco valido. '+error.message);continue;}
    const seen=new Set();
    const folder=path.dirname(manifest);
    for(const name of list){
      if(seen.has(name))problems.push(manifest+' elenca due volte '+name+'. Tieni un solo passaggio, nell\'ordine di caricamento.');
      seen.add(name);
      if(!/^(?:shared\/)?[a-z0-9][a-z0-9-]*\.js$/.test(name)){
        problems.push(manifest+' ha un nome non ammesso: '+name);
        continue;
      }
      const file=name.startsWith('shared/')
        ?path.join(root,'packages/editor-ui/editor-shared',name.slice(7))
        :path.join(root,folder,name);
      if(!fs.existsSync(file))problems.push('Manca il sorgente dichiarato da '+manifest+': '+name);
    }
    for(const required of ['app.js','state.js','shell-dictionary.js','shell.js']){
      if(!list.includes(required))problems.push(manifest+' non carica '+required+'.');
    }
    if(list.indexOf('shell-dictionary.js')>list.indexOf('shell.js')){
      problems.push(manifest+' deve caricare shell-dictionary.js prima di shell.js.');
    }
    if(!list.includes('shared/map-share-ui.js')){
      problems.push(manifest+' non carica shared/map-share-ui.js. Windows, Mac e Android devono preparare la stessa condivisione mappe.');
    }
  }
  const shareMarker='/* @neuromap-map-share-core */\n';
  const shareText=read('packages/editor-ui/editor-shared/map-share-ui.js');
  if(shareText.split(shareMarker).length-1!==1){
    problems.push('Il segnale di condivisione mappe deve comparire una sola volta in packages/editor-ui/editor-shared/map-share-ui.js.');
  }
  for(const file of ['packages/map-sharing/core.js','packages/map-sharing/transfer.js','packages/editor-ui/editor-colors.js']){
    if(!fs.existsSync(path.join(root,file)))problems.push('Manca '+file+'. Serve per preparare Windows, Mac e Android.');
  }
  const site=read('apps/website/release-config.js');
  if((site.match(/version:\s*"1\.0\.4"/g)||[]).length<2||/1\.0\.0/.test(site)){
    problems.push('Il sito pubblico non mostra 1.0.4 per Windows e Mac. Aggiorna apps/website/release-config.js. Il numero del telefono resta una linea diversa.');
  }
  for(const page of ['apps/website/index.html','apps/website/home-review/index.html','apps/website/home-review/home-en.html','apps/website/home-review/home.js','apps/website/home-review/release-status.js']){
    if(/1\.0\.0/.test(read(page)))problems.push(page+' mostra ancora 1.0.0. La versione visibile di Windows e Mac è 1.0.4.');
  }
  for(const rel of [
    'apps/desktop-shared/editor/app.js','apps/desktop-shared/editor/state.js',
    'apps/android/editor/app.js','apps/android/editor/state.js'
  ]){
    if(!fs.existsSync(path.join(root,rel)))continue;
    const counts=new Map();
    for(const mark of read(rel).match(/\/\* @neuromap-[a-z0-9-]+ \*\//g)||[]){
      counts.set(mark,(counts.get(mark)||0)+1);
    }
    for(const [mark,count] of counts){
      if(count!==1)problems.push(rel+' contiene '+mark+' '+count+' volte. Ogni segnale di composizione deve comparire una sola volta.');
    }
  }
  const spec='tests/browser/panel-version-theme.spec.js';
  if(!fs.existsSync(path.join(root,spec))){
    problems.push('Manca la prova nel browser '+spec+'. Va ricreata: pannelli, versione e tema al primo caricamento.');
  }else{
    const text=read(spec);
    for(const needle of ['nm-panel-compact','data-nm-size-scope="layout"','NM_PRODUCT_VERSION','prisma','#nm-ai-studio','#inspector-sidebar','#nm-learn-panel']){
      if(!text.includes(needle))problems.push(spec+' non controlla più "'+needle+'".');
    }
  }
  return problems;
}

function gitProblems(){
  const problems=[];
  let status='';
  try{status=git(['status','--porcelain']);}
  catch(error){return ['Git non risponde da questa cartella. '+error.message];}
  if(status && process.env.GLAUKA_DECLARED_CHANGES!=='1'){
    problems.push('Ci sono modifiche non registrate. Fai un commit, oppure, se sono già spiegate, imposta GLAUKA_DECLARED_CHANGES=1 e rilancia. Controlla con: git status --short');
  }
  try{git(['rev-parse','--verify','origin/main']);}
  catch{return problems.concat(['Manca origin/main. Esegui: git fetch origin --prune']);}
  const gitPointer=path.join(root,'.git');
  const gitDir=fs.statSync(gitPointer).isDirectory()?gitPointer:path.resolve(root,fs.readFileSync(gitPointer,'utf8').match(/^gitdir:\s*(.+)$/m)[1].trim());
  const fetchHead=path.join(gitDir,'FETCH_HEAD');
  if(!fs.existsSync(fetchHead)){
    problems.push('Questa copia non ha un origin/main scaricato. Esegui: git fetch origin --prune');
  }
  try{git(['merge-base','--is-ancestor','origin/main','HEAD']);}
  catch{
    problems.push('Questo ramo non contiene l\'attuale origin/main. Non continuare. Esegui: git fetch origin --prune poi git switch --detach origin/main e git switch -c nome-nuovo. Non riutilizzare un ramo vecchio.');
  }
  try{
    const [behind]=git(['rev-list','--left-right','--count','origin/main...HEAD']).split(/\s+/).map(Number);
    if(behind>0)problems.push('origin/main ha '+behind+' aggiornamenti assenti da questo ramo. Non aprire una richiesta di unione. Crea un ramo nuovo dall\'attuale origin/main.');
  }catch{problems.push('Non riesco a contare la distanza da origin/main. Esegui: git fetch origin --prune');}
  let branch='';
  try{branch=git(['rev-parse','--abbrev-ref','HEAD']);}
  catch{problems.push('Non riesco a leggere il nome del ramo.');}
  if(branch==='main'||branch==='HEAD'){
    problems.push('Sei su main o su un punto staccato. Crea un ramo nuovo da origin/main. Non fare commit su main e non fare push diretto su origin/main.');
  }
  return problems;
}

function main(){
  const problems=[...staticProblems(),...gitProblems()];
  if(problems.length){
    console.error(problems.map(item=>'ERRORE: '+item).join('\n'));
    process.exit(1);
  }
  console.log('Controllo superato: il ramo contiene origin/main e i controlli di pannelli, versione e tema sono presenti.');
}
if(require.main===module)main();
module.exports={staticProblems,gitProblems};
