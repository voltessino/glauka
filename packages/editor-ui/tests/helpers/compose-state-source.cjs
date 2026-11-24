'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../../..');
const SHARED=path.join(ROOT,'packages/editor-ui/editor-shared');
const MARKERS=[
  ['state-relationships-summary','state-relationships-summary.js'],
  ['state-node-style','state-node-style.js'],
];

/** Expand lexical state.js markers the same way prepare.editor_sources does. */
module.exports=function composeStateSource(platform){
  const folder=platform==='android'||platform==='apps/android'
    ?'apps/android/editor':'apps/desktop-shared/editor';
  let source=fs.readFileSync(path.join(ROOT,folder,'state.js'),'utf8');
  for(const [marker,file] of MARKERS){
    const token=`/* @neuromap-${marker} */\n`;
    if(source.includes(token))
      source=source.replace(token,fs.readFileSync(path.join(SHARED,file),'utf8'));
  }
  return source;
};
