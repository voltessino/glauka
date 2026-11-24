'use strict';
// Local, explicitly licensed and transcribed corpus intake. Never downloads documents.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function load(filename){
 const manifest=JSON.parse(fs.readFileSync(filename,'utf8')),base=path.dirname(path.resolve(filename));
 if(manifest.schemaVersion!=='ocr2-corpus/v1'||!Array.isArray(manifest.documents)||manifest.documents.length>10)throw Error('Invalid corpus manifest');
 const ids=new Set();return manifest.documents.map(d=>{
  if(!d||!['real','synthetic'].includes(d.kind)||typeof d.id!=='string'||!/^[a-z0-9-]{1,60}$/.test(d.id)||ids.has(d.id)||typeof d.file!=='string'||path.isAbsolute(d.file)||!d.file.toLowerCase().endsWith('.pdf')||!/^[a-f0-9]{64}$/.test(d.sha256||'')||!['CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0','Public-Domain','Self-Authored','Permission'].includes(d.license)||typeof d.rightsStatement!=='string'||d.rightsStatement.length<10||typeof d.annotator!=='string'||!d.annotator.trim()||!Array.isArray(d.pages)||!d.pages.length||d.pages.length>20)throw Error('Invalid document provenance or annotation');
  ids.add(d.id);const file=fs.realpathSync(path.resolve(base,d.file));if(!file.startsWith(fs.realpathSync(base)+path.sep))throw Error('Corpus file must remain within manifest folder');
  if(fs.statSync(file).size>40*1024*1024)throw Error('Corpus PDF exceeds 40 MB');const bytes=fs.readFileSync(file);if(bytes.subarray(0,5).toString()!=='%PDF-'||crypto.createHash('sha256').update(bytes).digest('hex')!==d.sha256)throw Error('Corpus source fingerprint mismatch');
  const seen=new Set();for(const p of d.pages){if(!Number.isInteger(p.page)||p.page<1||p.page>350||seen.has(p.page)||typeof p.truth!=='string'||!p.truth.trim()||p.truth.length>45000)throw Error('Invalid page transcription');seen.add(p.page)}
  return {id:d.id,bytes,selection:d.pages.map(p=>p.page).join(','),realPages:d.pages,provenance:{documentKind:d.kind,license:d.license,rightsStatement:d.rightsStatement,annotator:d.annotator,sha256:d.sha256}};
 });
}
module.exports={load};
