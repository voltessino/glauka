'use strict';
const {test,expect}=require('@playwright/test');
const {Buffer}=require('node:buffer');
for(const device of ['desktop','android'])test.describe(device+' image-import integrity',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize(device==='android'?{width:393,height:852}:{width:1280,height:900});
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto(device==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.io?.attachImageFileToNode &&
    document.getElementById('node-image-input'));
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
 });
 async function imageFile(page){
  const base64=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=48;canvas.height=32;
   canvas.getContext('2d').fillRect(0,0,48,32);
   return canvas.toDataURL('image/png').split(',')[1];
  });
  return {name:'anatomy.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')};
 }
 test('native file input decodes a PNG and keeps the original selected node',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const selected=await page.evaluate(()=>{
   const a=neuroMapApp;
   a.importHierarchy({text:'Anatomy',children:[{text:'Heart',children:[]}]},{newTab:true});
   const id=a.state.root.children[0].id;a.selectNode(id);return id;
  });
  await page.locator('#node-image-input').setInputFiles(await imageFile(page));
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images.length)).toBe(1);
  const result=await page.evaluate(()=>({
   img:neuroMapApp.state.images[0],
   snapshot:neuroMapApp.state.createSnapshot().images[0]
  }));
  expect(result.img.attachedNodeId).toBe(selected);
  expect(result.img.width).toBe(135);expect(result.img.height).toBe(90);
  expect(result.snapshot.src).toBe(result.img.src);
  expect(errors).toEqual([]);
 });
 test('changing tab while the selected file is still reading never adds it to the new tab',async({page})=>{
  const previous=await page.evaluate(()=>{
   const a=neuroMapApp;a.importHierarchy({text:'Original',children:[]},{newTab:true});
   window.__pendingImageReaders=[];
   const Reader=window.FileReader;
   window.__originalReadImageFile=Reader.prototype.readAsDataURL;
   window.FileReader=class extends Reader{
    readAsDataURL(file){window.__pendingImageReaders.push({reader:this,file});}
   };
   return a.activeTabId;
  });
  await page.locator('#node-image-input').setInputFiles(await imageFile(page));
  const tab=await page.evaluate(()=>{
   const a=neuroMapApp;
   a.createNewTab('Different topic');
   const entry=window.__pendingImageReaders[0];
   if(!entry)throw Error('Importer did not start its FileReader');
   return {current:a.activeTabId,readers:window.__pendingImageReaders.length};
  });
  expect(tab.readers).toBe(1);
  expect(tab.current).not.toBe(previous);
  const counts=await page.evaluate(async()=>{
   const entry=window.__pendingImageReaders[0];
   const done=new Promise(resolve=>entry.reader.addEventListener('loadend',resolve,{once:true}));
   window.__originalReadImageFile.call(entry.reader,entry.file);
   await done;
   return neuroMapApp.tabs.map(t=>({id:t.id,images:t.state.images.length}));
  });
  expect(counts.every(x=>x.images===0)).toBe(true);
 });
 test('mixed document/image drops are rejected without importing into a different tab',async({page})=>{
  const result=await page.evaluate(()=>{
   const a=neuroMapApp,events=[];
   const oldImport=a.importFiles,oldAttach=a.io.attachImageFileToNode,oldToast=a.showToast;
   a.importFiles=async()=>{events.push('document');};
   a.io.attachImageFileToNode=()=>{events.push('image');};
   a.showToast=()=>{events.push('warning');};
   try{
    const dt=new DataTransfer();
    dt.items.add(new File(['Lesson'],'topic.txt',{type:'text/plain'}));
    dt.items.add(new File(['image'],'photo.png',{type:'image/png'}));
    const before=a.activeTabId;
    document.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
    return {events,unchangedTab:a.activeTabId===before};
   }finally{
    a.importFiles=oldImport;a.io.attachImageFileToNode=oldAttach;a.showToast=oldToast;
   }
  });
  expect(result).toEqual({events:['warning'],unchangedTab:true});
 });
 test('SVG input is rejected before it can become an untrusted persisted image',async({page})=>{
  await page.locator('#node-image-input').setInputFiles({
   name:'vector.svg',mimeType:'image/svg+xml',
   buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Test</text></svg>')
  });
  expect(await page.evaluate(()=>neuroMapApp.state.images.length)).toBe(0);
 });
});
