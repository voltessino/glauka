'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
module.exports=function composeRichCaption(){
  const dir=path.join(__dirname,'..','..');
  const filename=path.join(dir,'rich-caption-core.js');
  let source=fs.readFileSync(filename,'utf8');
  for(const [marker,file] of [
    ['/* @neuromap-rich-caption-core-text */\n','rich-caption-core-text.js'],
    ['/* @neuromap-rich-caption-core-render */\n','rich-caption-core-render.js'],
    ['/* @neuromap-rich-caption-core-bind */\n','rich-caption-core-bind.js'],
  ]) source=source.replace(marker,fs.readFileSync(path.join(dir,file),'utf8'));
  const mod=new Module(filename);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(dir);
  mod._compile(source,filename);
  return mod.exports;
};
