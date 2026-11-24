const {test,expect}=require('@playwright/test');

async function boot(page){
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapMenuUX&&window.NeuroMapContextRefresh);
 await page.evaluate(async()=>{await window.GlaukaAppReady;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden'));});
}
async function addPhoto(page){
 return page.evaluate(()=>{
  const app=neuroMapApp;
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=54;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#2d88aa';ctx.fillRect(0,0,80,54);
  app.state.addImageItem({src:canvas.toDataURL('image/png'),width:220,height:149,
   mode:'free',worldPos:{x:150,y:40}});
  const img=app.state.images.at(-1);
  app.selectImage(img.id);
  return img.id;
 });
}
test('File, Edit and View use semantic icons without changing command labels',async({page})=>{
 await boot(page);
 for(const key of ['file','edit','view']){
  await expect(page.locator('#dropdown-'+key+' .dropdown-item > svg').first()).toHaveCount(1);
  const result=await page.locator('#dropdown-'+key).evaluate(el=>
   [...el.querySelectorAll('.dropdown-item')].map(btn=>({
    id:btn.id,label:btn.textContent,icons:btn.querySelectorAll(':scope > svg').length,
    valid:[...btn.querySelectorAll(':scope > svg')].every(svg=>svg.getAttribute('aria-hidden')==='true'&&[...svg.querySelectorAll('path')].some(path=>Boolean(path.getAttribute('d')?.trim())))
   })));
  expect(result.every(row=>row.icons===1 && row.valid && Boolean(row.label?.trim())),JSON.stringify(result)).toBeTruthy();
 }
 // Save status rebuilds its contents; both decorators must still leave one icon.
 await page.evaluate(()=>NeuroMapSaveStatus.report(neuroMapApp,false));
 await expect(page.locator('#nm-save-status > svg')).toHaveCount(1);
 await expect(page.locator('#nm-save-status > svg')).toHaveAttribute('aria-hidden','true');
 await expect.poll(()=>page.locator('#nm-save-status > svg').evaluate(svg=>[...svg.querySelectorAll('path')].some(path=>Boolean(path.getAttribute('d')?.trim())))).toBe(true);
});
test('selecting a photo keeps only image controls open',async({page})=>{
 await boot(page);
 await page.evaluate(()=>document.querySelector('#inspector-sidebar').classList.remove('collapsed'));
 await addPhoto(page);
 await expect(page.locator('#image-controls')).toBeVisible();
 await expect(page.locator('#inspector-sidebar')).toHaveClass(/collapsed/);
 expect(await page.locator('#image-controls').evaluate(el=>el.parentElement===document.body)).toBe(true);
 await page.locator('#img-close').click();
 await expect(page.locator('#image-controls')).toBeHidden();
});
test('Ctrl+C sends selected PNG to external clipboard backend, without placeholder',async({page})=>{
 await boot(page);
 await addPhoto(page);
 await page.evaluate(()=>{
  window.__glImageClipboardResult=null;
  const api=window.NeuroMapDesktopWorkflow.clipboard;
  api.writePNG=async value=>{
   const blob=await value;
   window.__glImageClipboardResult={type:blob.type,size:blob.size};
  };
  document.getElementById('mindmap-canvas').focus();
 });
 await page.keyboard.press('Control+c');
 await page.waitForFunction(()=>window.__glImageClipboardResult!==null);
 const result=await page.evaluate(()=>window.__glImageClipboardResult);
 expect(result.type).toBe('image/png');
 expect(result.size).toBeGreaterThan(30);
});
test('context menus show only actions appropriate to node, image or empty canvas',async({page})=>{
 await boot(page);
 const id=await addPhoto(page);
 await page.evaluate(id=>{
  const app=neuroMapApp;
  app.showContextMenu(350,250,{type:'image',item:app.state.findImage(id)});
 },id);
 await expect(page.locator('#ctx-group-image')).toBeVisible();
 await expect(page.locator('#ctx-group-node')).toBeHidden();
 await expect(page.locator('#nm-context-primary-image #ctx-img-copy')).toBeVisible();
 await expect(page.locator('#nm-context-more-image')).not.toHaveAttribute('open','');
 await page.evaluate(()=>neuroMapApp.showContextMenu(350,250,{type:'node',item:neuroMapApp.state.root}));
 await expect(page.locator('#ctx-group-image')).toBeHidden();
 await expect(page.locator('#nm-context-primary-node #ctx-add-child')).toBeVisible();
 await expect(page.locator('#nm-context-more-node')).not.toHaveAttribute('open','');
 await page.evaluate(()=>neuroMapApp.showContextMenu(350,250,null));
 await expect(page.locator('#ctx-group-canvas')).toBeVisible();
 await expect(page.locator('#ctx-group-image')).toBeHidden();
 await expect(page.locator('#ctx-group-node')).toBeHidden();
});
test('Study panel retains title and close button when scrolled to bottom',async({page})=>{
 await boot(page);
 const testResult=await page.evaluate(()=>{
  const panel=document.getElementById('nm-learn-panel');
  panel.hidden=false;
  // Framed panels keep the heading outside the scroll body.
  const body=panel.querySelector(':scope > .nm-panel-body')||panel;
  const filler=document.createElement('section');
  filler.style.height='1800px';filler.textContent='Contenuto lungo di prova';
  body.append(filler);
  body.scrollTop=body.scrollHeight;
  const heading=panel.querySelector(':scope > header');
  const rect=heading.getBoundingClientRect(),base=panel.getBoundingClientRect();
  const close=heading.querySelector('button');
  const answer={
   top:rect.top,baseTop:base.top,visible:!!close,
   framed:panel.classList.contains('nm-panel-frame'),
   bodyScroll:body.scrollTop>0,
   headingInsideBody:!!body.contains(heading)&&body!==panel
  };
  filler.remove();panel.hidden=true;return answer;
 });
 expect(testResult.framed).toBe(true);
 expect(testResult.headingInsideBody).toBe(false);
 expect(testResult.bodyScroll).toBe(true);
 expect(testResult.top).toBeGreaterThanOrEqual(testResult.baseTop-1);
 expect(testResult.visible).toBe(true);
});
