'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
module.exports=function composeCreativeCore(){
  const dir=path.join(__dirname,'..','..');
  const filename=path.join(dir,'creative-core.js');
  const source=fs.readFileSync(filename,'utf8').replace(
    '/* @neuromap-creative-core-objects */\n',
    fs.readFileSync(path.join(dir,'creative-core-objects.js'),'utf8'));
  const mod=new Module(filename);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(dir);
  mod._compile(source,filename);
  return mod.exports;
};
