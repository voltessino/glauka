'use strict';
const fs=require('node:fs');
const path=require('node:path');
module.exports=function composeContinuationLayout(){
  const dir=path.join(__dirname,'..','..');
  return fs.readFileSync(path.join(dir,'continuation-layout.js'),'utf8')
    .replace('/* @neuromap-continuation-layout-mount */\n',
      fs.readFileSync(path.join(dir,'continuation-layout-mount.js'),'utf8'));
};
