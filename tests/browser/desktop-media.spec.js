const {test,expect}=require('@playwright/test');
async function desktop(page){
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp && document.getElementById('nm-media-tools'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
}
test('desktop both spacing defaults persist across new tabs and application reload',async({page})=>{
 await desktop(page);
 expect(await page.evaluate(()=>({v:neuroMapApp.state.compactness,x:neuroMapApp.state.branchGapX}))).toEqual({v:55,x:30});
 await page.evaluate(()=>{const a=neuroMapApp;a.state.compactness=90;a.state.branchGapX=95;a.markChanged();});
 await page.evaluate(()=>document.getElementById('nm70-gap-save').click());
 await page.evaluate(()=>neuroMapApp.createNewTab('Next'));
 expect(await page.evaluate(()=>({v:neuroMapApp.state.compactness,x:neuroMapApp.state.branchGapX}))).toEqual({v:90,x:95});
 await page.reload();await page.waitForFunction(()=>window.neuroMapApp && document.getElementById('nm-media-tools'));
 await page.evaluate(()=>neuroMapApp.createNewTab('After relaunch'));
 expect(await page.evaluate(()=>({v:neuroMapApp.state.compactness,x:neuroMapApp.state.branchGapX}))).toEqual({v:90,x:95});
});
test('desktop image crop, 90 degree rotation, border and caption are undoable and survive snapshots',async({page})=>{
 await desktop(page);
 await page.evaluate(()=>{
  const a=neuroMapApp;
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=50;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#16a34a';ctx.fillRect(0,0,80,50);
  a.state.addImageItem({src:canvas.toDataURL(),width:140,height:110,mode:'free',worldPos:{x:0,y:0}});
  a.selectImage(a.state.images.at(-1).id);
 });
 await page.locator('#nm-img-rot-right').click();
 await page.locator('#nm-img-crop').click();
 await page.locator('.nm-crop-selection').press('Shift+ArrowLeft');
 await page.locator('#nm-image-crop-dialog [data-action=apply]').click();
 await page.locator('#nm-img-frame').selectOption('double');
 await page.locator('#nm-img-radius').selectOption('24');
 await page.locator('#nm-img-caption').fill('Epitelio intestinale');await page.locator('#nm-img-caption').dispatchEvent('change');
 const out=await page.evaluate(()=>{const a=neuroMapApp;return {image:a.state.constructor.cloneImages(a.state.images)[0],snapshot:a.state.createSnapshot().images[0],history:a.state.undoStack.length};});
 expect(out.image).toMatchObject({rotation:90,crop:{right:1},frame:'double',borderRadius:24,caption:'Epitelio intestinale'});
 expect(out.snapshot.caption).toBe('Epitelio intestinale');expect(out.history).toBeGreaterThan(4);
});
test('desktop URLs in node text are recognized without a dedicated link editor',async({page})=>{
 await desktop(page);const result=await page.evaluate(()=>{const a=neuroMapApp;a.state.root.text='https://example.com/notes?q=a&b=c';a.markChanged();return {url:NeuroMapCreative.nodeURL(a.state.root),saved:a.state.createSnapshot().root.text,box:!!document.getElementById('nm-node-link-controls'),unsafe:NeuroMapCreative.nodeURL({text:'javascript:alert(1)'})};});
 expect(result).toEqual({url:'https://example.com/notes?q=a&b=c',saved:'https://example.com/notes?q=a&b=c',box:false,unsafe:''});
});

test('desktop website links survive a hierarchical project import',async({page})=>{
 await desktop(page);
 const outcome=await page.evaluate(()=>{
  const a=neuroMapApp;
  a.importHierarchy({text:'Anatomia',linkUrl:'https://example.org/anatomy',children:[{text:'Tessuti',linkUrl:'https://example.org/tissues',children:[]}]},{newTab:true});
  return [a.state.root.linkUrl,a.state.root.children[0].linkUrl,a.state.createSnapshot().root.children[0].linkUrl];
 });
 expect(outcome).toEqual(['https://example.org/anatomy','https://example.org/tissues','https://example.org/tissues']);
});
