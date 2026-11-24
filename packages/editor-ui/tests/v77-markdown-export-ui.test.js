'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../../map-core');

class FakeBlob {
  constructor(chunks,options){this.chunks=chunks;this.options=options;}
}

function exportMethods(platform){
  const source=fs.readFileSync(path.join(__dirname,
    '../../../apps',platform,'editor/io.js'),'utf8');
  const start=source.indexOf('      exportMarkdown() {');
  const end=source.indexOf('      exportOPML() {',start);
  assert.ok(start>=0&&end>start,'Markdown export methods must exist');
  const methods=source.slice(start,end).replace(
    '\n      exportBatchMarkdown()',',\n      exportBatchMarkdown()');
  return new Function('Blob','return ({'+methods+'});')(FakeBlob);
}

for(const platform of ['desktop-shared','android']){
  test(platform+' Markdown export rejects invalid data before download',()=>{
    const cycle={text:'Cycle',children:[]};cycle.children.push(cycle);
    const toasts=[],downloads=[];
    const io=Object.assign(Object.create(exportMethods(platform)),{
      app:{state:{root:cycle},tabs:[{state:{root:cycle}}],
        showToast:(...args)=>toasts.push(args),saveActiveTabSnapshot:()=>{}},
      serializeNodeToMarkdown:root=>core.serializeMarkdown(root),
      sanitizeFilename:text=>text,
      triggerDownload:(...args)=>downloads.push(args)
    });
    assert.equal(io.exportMarkdown(),false);
    assert.equal(downloads.length,0);
    assert.equal(toasts.at(-1)[1],'ERRORE EXPORT');
    assert.match(toasts.at(-1)[0],/ciclica/);
  });
  test(platform+' batch Markdown is all-or-nothing on invalid later tab',()=>{
    const valid={text:'Valid',children:[]};
    const invalid={text:'Invalid',children:[]};invalid.children.push(invalid);
    const toasts=[],downloads=[];
    const io=Object.assign(Object.create(exportMethods(platform)),{
      app:{state:{root:valid},tabs:[{state:{root:valid}},{state:{root:invalid}}],
        showToast:(...args)=>toasts.push(args),saveActiveTabSnapshot:()=>{}},
      serializeNodeToMarkdown:root=>core.serializeMarkdown(root),
      sanitizeFilename:text=>text,
      triggerDownload:(...args)=>downloads.push(args)
    });
    assert.equal(io.exportBatchMarkdown(),false);
    assert.equal(downloads.length,0);
    assert.equal(toasts.at(-1)[1],'ERRORE EXPORT');
  });
  test(platform+' Markdown export still downloads a valid map',()=>{
    const valid={text:'Root',children:[{text:'Child',children:[]}]};
    const toasts=[],downloads=[];
    const io=Object.assign(Object.create(exportMethods(platform)),{
      app:{state:{root:valid},tabs:[{state:{root:valid}}],
        showToast:(...args)=>toasts.push(args),saveActiveTabSnapshot:()=>{}},
      serializeNodeToMarkdown:root=>core.serializeMarkdown(root),
      sanitizeFilename:text=>text,
      triggerDownload:(...args)=>downloads.push(args)
    });
    io.exportMarkdown();
    assert.equal(downloads.length,1);
    assert.equal(downloads[0][1],'Root.md');
    assert.equal(toasts.at(-1)[1],'EXPORT MD');
  });
}
