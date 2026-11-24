'use strict';
/* Expand lexical UI fragments the same way prepare.ui_source does. */
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../../..');
const UI=path.join(ROOT,'packages/editor-ui');
const FRAGMENTS=Object.freeze({
  'creative-settings':[
    ['/* @neuromap-settings-values */\n','creative-settings-values.js'],
    ['/* @neuromap-creative-settings-mount-body */\n','creative-settings-mount-body.js'],
    ['/* @neuromap-creative-settings-organize */\n','creative-settings-organize.js'],
  ],
  'creative-tools':[
    ['/* @neuromap-creative-tools-object-dialog */\n','creative-tools-object-dialog.js'],
    ['/* @neuromap-creative-tools-library-dialog */\n','creative-tools-library-dialog.js'],
    ['/* @neuromap-creative-tools-mount */\n','creative-tools-mount.js'],
    ['/* @neuromap-creative-tools-sync */\n','creative-tools-sync.js'],
  ],
  'creative-drawing':[
    ['/* @neuromap-creative-drawing-dialogs */\n','creative-drawing-dialogs.js'],
    ['/* @neuromap-creative-drawing-toolbar */\n','creative-drawing-toolbar.js'],
    ['/* @neuromap-creative-drawing-library */\n','creative-drawing-library.js'],
  ],
  'creative-formatting':[
    ['/* @neuromap-creative-formatting-values */\n','creative-formatting-values.js'],
  ],
  'caption-editor':[
    ['/* @neuromap-caption-editor-buttons */\n','caption-editor-buttons.js'],
    ['/* @neuromap-caption-editor-layout */\n','caption-editor-layout.js'],
  ],
  'navigation-experience':[
    ['/* @neuromap-navigation-experience-styles */\n','navigation-experience-styles.js'],
    ['/* @neuromap-navigation-experience-ui */\n','navigation-experience-ui.js'],
    ['/* @neuromap-navigation-experience-focus */\n','navigation-experience-focus.js'],
    ['/* @neuromap-navigation-experience-render */\n','navigation-experience-render.js'],
  ],
  'linked-views':[
    ['/* @neuromap-linked-view-decorations */\n','linked-view-decorations.js'],
    ['/* @neuromap-linked-view-styles */\n','linked-view-styles.js'],
    ['/* @neuromap-linked-view-project */\n','linked-view-project.js'],
    ['/* @neuromap-linked-view-camera-workspace */\n','linked-view-camera-workspace.js'],
    ['/* @neuromap-linked-view-ensure */\n','linked-view-ensure.js'],
    ['/* @neuromap-linked-view-toolbars */\n','linked-view-toolbars.js'],
    ['/* @neuromap-linked-view-export */\n','linked-view-export.js'],
    ['/* @neuromap-linked-view-runtime */\n','linked-view-runtime.js'],
  ],
  'workspace-layout':[
    ['/* @neuromap-workspace-layout-lists */\n','workspace-layout-lists.js'],
  ],
  'workspace-tools':[
    ['/* @neuromap-workspace-tools-curate */\n','workspace-tools-curate.js'],
  ],
  'creative-markers':[
    ['/* @neuromap-creative-markers-catalog */\n','creative-markers-catalog.js'],
    ['/* @neuromap-creative-markers-actions */\n','creative-markers-actions.js'],
    ['/* @neuromap-creative-markers-mount */\n','creative-markers-mount.js'],
  ],
});
const NESTED=Object.freeze({
  'creative-tools-mount.js':[
    ['/* @neuromap-creative-tools-mount-bind */\n','creative-tools-mount-bind.js'],
    ['/* @neuromap-creative-tools-mount-panel */\n','creative-tools-mount-panel.js'],
  ],
  'creative-settings-mount-body.js':[
    ['/* @neuromap-creative-settings-mount-builders */\n','creative-settings-mount-builders.js'],
    ['/* @neuromap-creative-settings-mount-handlers */\n','creative-settings-mount-handlers.js'],
  ],
  'workspace-layout-lists.js':[
    ['/* @neuromap-workspace-layout-lists-tools */\n','workspace-layout-lists-tools.js'],
  ],
  'workspace-layout-lists-tools.js':[
    ['/* @neuromap-workspace-layout-lists-mount */\n','workspace-layout-lists-mount.js'],
    ['/* @neuromap-workspace-layout-lists-text */\n','workspace-layout-lists-text.js'],
    ['/* @neuromap-workspace-layout-lists-insert */\n','workspace-layout-lists-insert.js'],
    ['/* @neuromap-workspace-layout-lists-chrome */\n','workspace-layout-lists-chrome.js'],
  ],
  'linked-view-camera-workspace.js':[
    ['/* @neuromap-linked-view-camera-kanban */\n','linked-view-camera-kanban.js'],
    ['/* @neuromap-linked-view-camera-workspace-panels */\n','linked-view-camera-workspace-panels.js'],
  ],
  'linked-view-ensure.js':[
    ['/* @neuromap-linked-view-ensure-chrome */\n','linked-view-ensure-chrome.js'],
    ['/* @neuromap-linked-view-ensure-zoom */\n','linked-view-ensure-zoom.js'],
    ['/* @neuromap-linked-view-ensure-toolbars */\n','linked-view-ensure-toolbars.js'],
    ['/* @neuromap-linked-view-ensure-dual */\n','linked-view-ensure-dual.js'],
  ],
  'linked-view-toolbars.js':[
    ['/* @neuromap-linked-view-toolbars-network */\n','linked-view-toolbars-network.js'],
    ['/* @neuromap-linked-view-toolbars-flow */\n','linked-view-toolbars-flow.js'],
  ],
  'linked-view-export.js':[
    ['/* @neuromap-linked-view-export-pdf */\n','linked-view-export-pdf.js'],
    ['/* @neuromap-linked-view-export-raster */\n','linked-view-export-raster.js'],
    ['/* @neuromap-linked-view-export-view */\n','linked-view-export-view.js'],
  ],
  'linked-view-runtime.js':[
    ['/* @neuromap-linked-view-runtime-sync */\n','linked-view-runtime-sync.js'],
    ['/* @neuromap-linked-view-runtime-dual */\n','linked-view-runtime-dual.js'],
    ['/* @neuromap-linked-view-runtime-render */\n','linked-view-runtime-render.js'],
  ],
});
function expandNested(file,source){
  let text=source;
  for(const [nestedMarker,nestedFile] of (NESTED[file]||[])){
    if(!text.includes(nestedMarker))throw Error('Missing '+nestedMarker+' in '+file);
    let nested=fs.readFileSync(path.join(UI,nestedFile),'utf8').replace(/\r\n?/g,'\n');
    nested=expandNested(nestedFile,nested);
    text=text.replace(nestedMarker,nested);
  }
  return text;
}
module.exports=function composeUiSource(name){
  let source=fs.readFileSync(path.join(UI,name+'.js'),'utf8').replace(/\r\n?/g,'\n');
  for(const [marker,file] of (FRAGMENTS[name]||[])){
    if(!source.includes(marker))throw Error('Missing '+marker+' in '+name);
    let frag=fs.readFileSync(path.join(UI,file),'utf8').replace(/\r\n?/g,'\n');
    frag=expandNested(file,frag);
    source=source.replace(marker,frag);
  }
  return source;
};
