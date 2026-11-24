'use strict';
// Read-only helper: routes a symptom to canonical sources, never runs a build.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const dataFile=path.join(root,'docs','FEATURE_MAP.json');
function normalized(input){
 return String(input||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim();
}
function readMap(){return JSON.parse(fs.readFileSync(dataFile,'utf8'));}
function validate(map,exists=fs.existsSync){
 if(map.version!==1||!Array.isArray(map.features)||map.features.length<10)
  throw Error('Formato indice non valido');
 const keys=new Set(),ids=new Set();
 for(const f of map.features){
  if(!f.id||!f.title||!f.warning||ids.has(f.id))throw Error('Categoria incompleta o duplicata');
  ids.add(f.id);
  for(const alias of [f.id,...f.aliases]){
   const key=normalized(alias);
   if(!key||keys.has(key))throw Error('Alias duplicato: '+key);
   keys.add(key);
  }
  for(const field of ['common','desktop','android','tests']){
   if(!Array.isArray(f[field]))throw Error('Sezione mancante: '+field);
   for(const item of f[field]){
    if(typeof item!=='string'||!item||item.startsWith('/')||
       item.split('/').some(x=>x==='..'||x==='.'||!x)||
       item.includes(String.fromCharCode(92))||
       item==='apps/android/native/app/src/main/assets/assets/architect.js')
       throw Error('Percorso non sicuro: '+item);
    if(!exists(path.join(root,item)))throw Error('Percorso inesistente: '+item);
   }
  }
  if(!f.tests.length||!f.common.length&&!f.desktop.length&&!f.android.length)
   throw Error('Sorgenti o test mancanti: '+f.id);
 }
 return map.features.length;
}
function search(map,term){
 const key=normalized(term);if(!key)return [];
 const same=map.features.filter(f=>[f.id,...f.aliases].some(a=>normalized(a)===key));
 if(same.length)return same;
 return map.features.filter(f=>normalized(f.title).includes(key)||
  f.aliases.some(a=>normalized(a).includes(key)));
}
function describe(f){
 const sections=[['Codice comune',f.common],['Windows / macOS',f.desktop],
  ['Android',f.android],['Test',f.tests]];
 const out=[f.title];
 for(const [name,items] of sections){
  if(items.length)out.push('  '+name+':',...items.map(s=>'    '+s));
 }
 out.push('  Attenzione: '+f.warning);
 return out.join(String.fromCharCode(10));
}
function main(args=process.argv.slice(2)){
 try{
  if(args.includes('--help')){console.log('Uso: node scripts/maintenance/where-to-edit.cjs <problema> | --list | --check');return 0;}
  const map=readMap();validate(map);
  if(args.includes('--check')){console.log('OK: '+map.features.length+' aree controllate');return 0;}
  if(args.includes('--list')){map.features.forEach(f=>console.log(f.id+' - '+f.title));return 0;}
  const q=args.join(' '),found=search(map,q);
  if(!found.length){console.error('Nessuna corrispondenza. Usa --list.');return 1;}
  found.forEach(f=>console.log(describe(f)));return 0;
 }catch(e){console.error(e.message);return 2;}
}
if(require.main===module)process.exitCode=main();
module.exports={normalized,readMap,validate,search,describe,main};
