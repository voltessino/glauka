'use strict';
const fs=require('node:fs');
const path=require('node:path');
module.exports=function composeDragPreview(){
  const dir=path.join(__dirname,'..','..');
  let source=fs.readFileSync(path.join(dir,'drag-preview.js'),'utf8');
  for(const [marker,file] of [
    ['/* @neuromap-drag-preview-resolve */\n','drag-preview-resolve.js'],
    ['/* @neuromap-drag-preview-apply */\n','drag-preview-apply.js'],
    ['/* @neuromap-drag-preview-preview */\n','drag-preview-preview.js'],
  ]){
    if(!source.includes(marker))throw Error('Missing '+marker);
    source=source.replace(marker,fs.readFileSync(path.join(dir,file),'utf8'));
  }
  return source;
};
