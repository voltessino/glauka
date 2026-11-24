'use strict';
const fs=require('node:fs');
const path=require('node:path');
module.exports=function composeGraphics(){
  const dir=path.join(__dirname,'..','..');
  let source=fs.readFileSync(path.join(dir,'graphics.js'),'utf8');
  for(const [marker,file] of [
    ['/* @neuromap-graphics-helpers */\n','graphics-helpers.js'],
    ['/* @neuromap-graphics-install */\n','graphics-install.js'],
  ]){
    if(!source.includes(marker))throw Error('Missing '+marker);
    source=source.replace(marker,fs.readFileSync(path.join(dir,file),'utf8'));
  }
  return source;
};
