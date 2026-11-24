'use strict';
// Read-only audit: reports QA evidence not referenced in tracked text and broken local links.
// Never removes files, alters a Git ref or assumes that "unreferenced" means disposable.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const QA='docs/qa/evidence/';
const IMAGE=/\.(?:png|jpe?g|webp|gif|svg)$/i;
const TEXT=/\.(?:md|txt|json|jsonl|html|css|js|cjs|mjs|py|go|java|swift|ps1|yml|yaml)$/i;

function audit(files,records){
 const names=new Set(files);
 const images=files.filter(p=>p.startsWith(QA)&&IMAGE.test(p));
 const refs=new Set(),missing=[];
 for(const record of records){
  const content=record.content;
  if(record.path.startsWith('docs/qa/')&&record.path.endsWith('.md')){
   // Capture ordinary Markdown links, not just rendered images (many QA files link screenshots as text).
   const rx=/\]\(\s*<?(evidence\/[^)\s>]+)>?(?:\s+[^)]*)?\)/g;
   for(const match of content.matchAll(rx)){
    const asset=QA+match[1].slice('evidence/'.length).split('#')[0].split('?')[0];
    if(!names.has(asset))missing.push({document:record.path,target:asset});
   }
  }
  for(const image of images){
   if(content.includes(path.posix.basename(image)))refs.add(image);
  }
 }
 return {
  checkedImages:images.length,
  referencedImages:refs.size,
  unreferencedCandidates:images.filter(name=>!refs.has(name)),
  brokenLinks:missing,
  warning:'Unreferenced means review only. Never delete evidence without checking reports and historical users.',
  filesRemoved:0
 };
}

function inspect(root=ROOT){
 const tracked=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'})
  .split('\0').filter(Boolean);
 const records=[];
 for(const file of tracked){
  if(!TEXT.test(file)||file.startsWith('packages/editor-ui/vendor/'))continue;
  const full=path.join(root,file);
  if(!fs.existsSync(full))continue;
  const size=fs.statSync(full).size;
  if(size>2500000)continue;
  records.push({path:file,content:fs.readFileSync(full,'utf8')});
 }
 return audit(tracked,records);
}

function main(argv=process.argv.slice(2)){
 try{
  if(argv.includes('--help')||argv.includes('-h')){
   console.log('Uso: node scripts/maintenance/qa-evidence-audit.cjs [--json] [--check]');
   console.log('Solo audit: non elimina immagini o rapporti. --check segnala link mancanti.');
   return 0;
  }
  const result=inspect();
  if(argv.includes('--json'))console.log(JSON.stringify(result,null,2));
  else{
   console.log('Immagini QA: '+result.checkedImages+'; citate: '+result.referencedImages);
   console.log('Possibili immagini da revisionare: '+result.unreferencedCandidates.length);
   for(const item of result.unreferencedCandidates)console.log('REVIEW ONLY '+item);
   for(const link of result.brokenLinks)console.error('BROKEN '+link.document+' -> '+link.target);
  }
  return argv.includes('--check')&&result.brokenLinks.length?1:0;
 }catch(error){console.error(String(error.message||error));return 2;}
}
if(require.main===module)process.exitCode=main();
module.exports={audit,inspect,main};
