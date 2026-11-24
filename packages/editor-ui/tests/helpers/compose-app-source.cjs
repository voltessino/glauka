'use strict';
/* Expand the lexical class fragments that prepare.py splices into app.js. */
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../../..');
const FRAGMENTS=Object.freeze([
  ['/* @neuromap-app-tabs */\n','app-tabs.js'],
  ['/* @neuromap-app-camera-status */\n','app-camera-status.js'],
  ['/* @neuromap-app-hit-testing */\n','app-hit-testing.js'],
  ['/* @neuromap-app-selection-clipboard */\n','app-selection-clipboard.js'],
  ['/* @neuromap-app-image-drag */\n','app-image-drag.js'],
  ['/* @neuromap-app-inline-edit */\n','app-inline-edit.js'],
  ['/* @neuromap-app-node-mutations */\n','app-node-mutations.js'],
  ['/* @neuromap-app-import */\n','app-import.js'],
  ['/* @neuromap-app-persist */\n','app-persist.js'],
  ['/* @neuromap-app-summary-image */\n','app-summary-image.js'],
  ['/* @neuromap-app-context-find */\n','app-context-find.js'],
  ['/* @neuromap-app-bind-ui */\n','app-bind-ui.js'],
]);
const CONTROLS=Object.freeze([
  ['/* @neuromap-desktop-controls-native */\n','desktop-controls-native.js'],
  ['/* @neuromap-desktop-controls-selection */\n','desktop-controls-selection.js'],
  ['/* @neuromap-desktop-controls-bind */\n','desktop-controls-bind.js'],
]);
const SHARED_APP=new Set(['app-hit-testing.js','app-image-drag.js','app-node-mutations.js']);
module.exports=function composeAppSource(platform){
  if(platform!=='desktop-shared'&&platform!=='android')
    throw Error('Unsupported editor platform: '+platform);
  const dir=path.join(ROOT,'apps',platform,'editor');
  const sharedDir=path.join(ROOT,'packages/editor-ui/editor-shared');
  let source=fs.readFileSync(path.join(dir,'app.js'),'utf8').replace(/\r\n?/g,'\n');
  for(const [marker,file] of FRAGMENTS){
    if(!source.includes(marker))throw Error('Missing '+marker+' in '+platform+'/app.js');
    const from=SHARED_APP.has(file)?sharedDir:dir;
    const fragment=fs.readFileSync(path.join(from,file),'utf8').replace(/\r\n?/g,'\n');
    source=source.replace(marker,fragment);
  }
  return source;
};
module.exports.composeDesktopControls=function composeDesktopControls(platform){
  if(platform!=='desktop-shared'&&platform!=='android')
    throw Error('Unsupported editor platform: '+platform);
  const dir=path.join(ROOT,'apps',platform,'editor');
  let source=fs.readFileSync(path.join(dir,'desktop-controls.js'),'utf8').replace(/\r\n?/g,'\n');
  for(const [marker,file] of CONTROLS){
    if(!source.includes(marker))throw Error('Missing '+marker+' in '+platform+'/desktop-controls.js');
    source=source.replace(marker,fs.readFileSync(path.join(dir,file),'utf8').replace(/\r\n?/g,'\n'));
  }
  return source;
};
