'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
module.exports=function composeLocalization(){
  const dir=path.join(__dirname,'..','..');
  const filename=path.join(dir,'localization.js');
  const messages=fs.readFileSync(path.join(dir,'localization-messages.js'),'utf8')
    .replace('/* @neuromap-localization-messages-main */\n',
      fs.readFileSync(path.join(dir,'localization-messages-main.js'),'utf8'))
    .replace('/* @neuromap-localization-messages-ranges */\n',
      fs.readFileSync(path.join(dir,'localization-messages-ranges.js'),'utf8'));
  const source=fs.readFileSync(filename,'utf8').replace(
    '/* @neuromap-localization-messages */\n', messages);
  const mod=new Module(filename);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(dir);
  mod._compile(source,filename);
  return mod.exports;
};
