'use strict';
// 1,000 synthetic GUI scenarios. "Country" refers only to ISO test data;
// this is not human research or evidence about national learning habits.
// Run against the project-local 5173/5174 Playwright servers, no GitHub Actions.
const {test,expect}=require('@playwright/test');
const {Buffer}=require('node:buffer');
const {STUDENTS,treeFor}=require('./fixtures/student-1000-profiles');
const {pdfFixture}=require('./pdfjs-fixture');
const JPG='image/jpeg',PNG='image/png';
const subjectText=s=>s.subject+' · '+s.countryCode+' · '+s.specimen;
function mediaName(s,type){return s.id+(type===JPG?'.jpg':'.png');}
async function launch(page,s){
 const android=s.device==='android',width=android?[360,393,768][s.seed%3]:[1024,1280,1440][s.seed%3];
 await page.setViewportSize({width,height:android?850:900});
 const locale=['image-node','image-free','image-two','image-editor',
  'workspace-reload','view-undo'].includes(s.workflow)?s.language:'it';
 await page.addInitScript(language=>{
  localStorage.setItem('nm6_welcome_seen','1');
  localStorage.setItem('nm6_locale',language);
 },locale);
 await page.goto(android?'http://127.0.0.1:5173/app/index.html':
  'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.state&&
  window.neuroMapApp?.io?.attachImageFileToNode&&
  document.getElementById('node-image-input'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade')
  .forEach(el=>el.classList.add('hidden')));
}
async function seed(page,s,count=5){
 return page.evaluate(({p,count})=>{
  const a=neuroMapApp;
  const root={text:p.subject+' · '+p.id,
   notes:'Appunti '+p.countryCode+' — '+p.specimen,
   children:Array.from({length:count},(_,j)=>({
    text:p.subject+' · capitolo '+(j+1),notes:p.specimen,
    children:[{text:'Esempio '+j,notes:p.specimen,children:[]}]}))};
  a.importHierarchy(root,{newTab:true});
  const first=a.state.root.children[0];
  return {tab:a.activeTabId,root:a.state.root.id,node:first.id,
   title:a.state.root.text,notes:first.notes};
 },{p:s,count});
}
async function upload(page,s,type=PNG,attached=true){
 // The input is the REAL file input and its existing onChange/FileReader/Image pipeline.
 await page.evaluate(attached=>{
  const a=neuroMapApp;
  attached?a.selectNode(a.state.root.children[0].id):a.clearSelection();
 },attached);
 const base64=await page.evaluate(type=>{
  const c=document.createElement('canvas');c.width=48;c.height=32;
  const ctx=c.getContext('2d');ctx.fillStyle='#235bad';ctx.fillRect(0,0,48,32);
  ctx.fillStyle='#ffffaa';ctx.fillRect(5,5,12,12);
  return c.toDataURL(type).split(',')[1];
 },type);
 const before=await page.evaluate(()=>neuroMapApp.state.images.length);
 await page.locator('#node-image-input').setInputFiles({
  name:mediaName(s,type),mimeType:type,buffer:Buffer.from(base64,'base64')
 });
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images.length),
  {timeout:15000}).toBe(before+1);
 // Clear selection selects the root; use the actual Detach command for a free image.
 if(!attached)await page.locator('#img-toggle-attach').dispatchEvent('click');
 return page.evaluate(()=>({
  image:neuroMapApp.state.images.at(-1),
  snapshot:neuroMapApp.state.createSnapshot().images.at(-1),
  originalNode:neuroMapApp.state.root.children[0].id
 }));
}
async function assertImagesStable(page){
 const result=await page.evaluate(()=>{
  const a=neuroMapApp,ids=a.state.images.map(img=>img.id);
  const snapshot=a.state.createSnapshot();
  return {ids,distinct:new Set(ids).size===ids.length,
   count:snapshot.images.length,node:a.state.root.children[0].id,
   valid:a.state.images.every(im=>im.src.startsWith('data:image/') &&
    im.width>0&&im.height>0&&Number.isFinite(im.width)&&Number.isFinite(im.height))
  };
 });
 expect(result.distinct).toBe(true);expect(result.valid).toBe(true);
 expect(result.count).toBe(result.ids.length);
}
test.describe('1000 international study journeys — simulated browser tasks',()=>{
 for(const s of STUDENTS){
  test(s.id+' · '+s.countryCode+' · '+s.subject+' · '+s.workflow,async({page})=>{
   test.setTimeout(s.workflow==='pdf-source'&&s.seed%17===0?120000:65000);
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await launch(page,s);
   if(s.workflow==='image-node'){
    const state=await seed(page,s);
    const {image,snapshot,originalNode}=await upload(page,s,PNG,true);
    expect(image.mode).toBe('attached');
    expect(image.attachedNodeId).toBe(state.node);
    expect(image.naturalWidth).toBe(48);
    expect(image.naturalHeight).toBe(32);
    expect(snapshot.src).toBe(image.src);
    expect(originalNode).toBe(state.node);
    await assertImagesStable(page);
   }else if(s.workflow==='image-free'){
    await seed(page,s);
    const {image,snapshot}=await upload(page,s,JPG,false);
    expect(image.mode).toBe('free');
    expect(image.attachedNodeId).toBeNull();
    expect(image.src).toMatch(/^data:image\/jpeg;base64,/);
    expect(snapshot.id).toBe(image.id);
    await assertImagesStable(page);
   }else if(s.workflow==='image-two'){
    const state=await seed(page,s);
    const a=await upload(page,s,PNG,true);
    const b=await upload(page,s,JPG,true);
    expect(a.image.id).not.toBe(b.image.id);
    expect(a.image.attachedNodeId).toBe(state.node);
    expect(b.image.attachedNodeId).toBe(state.node);
    await assertImagesStable(page);
    const copy=await page.evaluate(()=>neuroMapApp.state.createSnapshot().images);
    expect(copy).toHaveLength(2);
    // File validation should never accept a broken image as decoded media.
    if((s.seed-3)%50===0){
     await page.locator('#node-image-input').setInputFiles({
      name:'broken.png',mimeType:PNG,buffer:Buffer.from('not an image')
     });
     await page.waitForTimeout(120);
     expect(await page.evaluate(()=>neuroMapApp.state.images.length)).toBe(2);
    }
   }else if(s.workflow==='image-editor'){
    await seed(page,s);
    const before=await upload(page,s,PNG,true);
    await page.waitForFunction(()=>document.getElementById('nm-img-rot-right'));
    await page.evaluate(()=>neuroMapApp.selectImage(neuroMapApp.state.images.at(-1).id));
    await page.locator('#nm-img-rot-right').click();
    await page.locator('#nm-img-frame').selectOption('double');
    await page.locator('#nm-img-radius').selectOption('24');
    const caption=subjectText(s);
    await page.locator('#nm-img-caption').fill(caption);
    await page.locator('#nm-img-caption').dispatchEvent('change');
    const result=await page.evaluate(()=>({
     img:neuroMapApp.state.images.at(-1),
     stored:neuroMapApp.state.createSnapshot().images.at(-1)
    }));
    expect(result.img).toMatchObject({rotation:90,frame:'double',
     borderRadius:24,caption});
    expect(result.stored.caption).toBe(caption);
    expect(result.img.id).toBe(before.image.id);
   }else if(s.workflow==='text-and-image'){
    const state=await seed(page,s);
    await page.waitForFunction(()=>neuroMapApp?._nmDocumentImport);
    await page.evaluate(()=>neuroMapApp._nmDocumentImport.open());
    const dialog=page.locator('#nm-doc-import');
    await dialog.locator('input[type=file]').setInputFiles({
     name:s.id+'.txt',mimeType:'text/plain',
     buffer:Buffer.from([subjectText(s),'Esempio','Quesiti','Ripasso'].join('\n\n'))
    });
    await expect(dialog.locator('.nm-di-preview')).toContainText(s.subject);
    await dialog.getByRole('button',{name:'Aggiungi alla mappa'}).click();
    await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(6);
    const media=await upload(page,s,PNG,true);
    expect(media.image.attachedNodeId).toBe(state.node);
    expect(await page.evaluate(()=>neuroMapApp.state.root.children.at(-1).children.length)).toBe(4);
    await assertImagesStable(page);
   }else if(s.workflow==='quiz-exam'){
    await seed(page,s);
    await page.waitForFunction(()=>neuroMapApp?._nmLearning&&window.NeuroMapAdaptiveCore);
    await page.locator('#nm-learn-open').click();
    await page.getByRole('button',{name:'Quiz',exact:true}).click();
    await page.getByRole('button',{name:'Inizia quiz'}).click();
    await expect(page.locator('.nm-learn-question')).toBeVisible();
    const choices=page.locator('#nm-learn-panel .nm-learn-options button');
    if(await choices.count())await choices.first().click();
    else{
     await page.getByRole('button',{name:'Mostra risposta'}).click();
     await page.getByRole('button',{name:'✓ Ricordato'}).click();
    }
    const observation=await page.evaluate(()=>({
     last:neuroMapApp.learningAttempts.at(-1),
     tab:neuroMapApp.activeTabId
    }));
    expect(observation.last.tabId).toBe(observation.tab);
    await page.getByRole('button',{name:'Esame',exact:true}).click();
    await page.locator('#nm-learn-panel input[type=date]').fill('2027-06-24');
    await page.locator('#nm-learn-panel input[type=number]').fill(String(s.minutes));
    await page.getByRole('button',{name:'Salva piano'}).click();
    const plan=await page.evaluate(()=>neuroMapApp.learningPlans.find(p=>p.tabId===neuroMapApp.activeTabId));
    expect(plan).toMatchObject({examDate:'2027-06-24',minutesPerDay:s.minutes});
   }else if(s.workflow==='map-outline'){
    const state=await seed(page,s);
    await page.waitForFunction(()=>window.NeuroMapLinkedViews&&neuroMapApp?._nmKnowledge);
    await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
    await expect(page.locator('#nm-view-overlay')).toBeVisible();
    const card=page.locator('.nm-view-card[data-node-id="'+state.node+'"]');
    await card.dblclick();
    const label=s.subject+' '+s.specimen+' [revised]';
    await page.locator('.nm-view-edit').fill(label);
    await page.locator('.nm-view-edit').press('Enter');
    await page.locator('#nm-view-back').click();
    await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));
    await page.locator('#nm-knowledge-panel .nm-kn-query').fill('[revised]');
    await expect(page.locator('#nm-knowledge-panel')).toContainText(label);
    expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,state.node)).toBe(label);
   }else if(s.workflow==='workspace-reload'){
    const state=await seed(page,s);
    const first=await upload(page,s,PNG,true);
    expect(first.image.attachedNodeId).toBe(state.node);
    await page.evaluate(()=>neuroMapApp.persistWorkspace());
    await page.reload();
    await page.waitForFunction(()=>window.neuroMapApp?.state?.root);
    const restored=await page.evaluate(()=>({
     title:neuroMapApp.state.root.text,
     imageCount:neuroMapApp.state.images.length,
     images:neuroMapApp.state.images.map(im=>({mode:im.mode,
      attachedNodeId:im.attachedNodeId,src:im.src.slice(0,22)})),
     node:neuroMapApp.state.root.children[0]?.id
    }));
    expect(restored.title).toBe(state.title);
    expect(restored.imageCount).toBe(1);
    expect(restored.images[0].attachedNodeId).toBe(restored.node);
    expect(restored.images[0].src).toMatch(/^data:image\/png;base64/);
   }else if(s.workflow==='pdf-source'){
    await page.waitForFunction(()=>neuroMapApp?._nmDocumentImport);
    const pages=s.seed%17===0?200:2+s.seed%5;
    const doc=pdfFixture(pages,{bookmarks:false,
     texts:Array.from({length:pages},(_,i)=>'Lesson '+(i+1)+' '+s.subject)});
    const old=await page.evaluate(()=>neuroMapApp.state.root.children.length);
    await page.evaluate(()=>neuroMapApp._nmDocumentImport.open());
    const dialog=page.locator('#nm-doc-import');
    await dialog.locator('input[type=file]').setInputFiles({
     name:s.id+'.pdf',mimeType:'application/pdf',buffer:doc
    });
    await expect(dialog.locator('.nm-di-preview')).toContainText('Pagina 1');
    const add=dialog.getByRole('button',{name:'Aggiungi alla mappa'});
    await expect(add).toBeDisabled();
    await dialog.locator('input[type=checkbox]').check();
    await expect(add).toBeEnabled();
    await add.click();
    await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.length))
     .toBe(old+1);
    const result=await page.evaluate(()=>({
     nodes:neuroMapApp.state.root.children.at(-1).children,
     stored:neuroMapApp.state.createSnapshot()
    }));
    expect(result.nodes.length).toBe(pages);
    const refs=result.nodes.flatMap(node=>node.sourceRefs||[]);
    expect(refs.length).toBe(pages);
    expect(refs.every(r=>r.sha256&&r.page>=1&&r.page<=pages)).toBe(true);
   }else if(s.workflow==='view-undo'){
    const state=await seed(page,s);
    await page.waitForFunction(()=>window.NeuroMapLinkedViews);
    const before=await page.evaluate(id=>neuroMapApp.state.findNode(id).text,state.node);
    await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
    const card=page.locator('.nm-view-card[data-node-id="'+state.node+'"]');
    await card.dblclick();
    const changed=s.subject+' · updated';
    await page.locator('.nm-view-edit').fill(changed);
    await page.locator('.nm-view-edit').press('Enter');
    await page.evaluate(()=>{neuroMapApp.undo();neuroMapApp.recalculateAndRender()});
    expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,state.node)).toBe(before);
    await page.evaluate(()=>{neuroMapApp.redo();neuroMapApp.recalculateAndRender()});
    expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,state.node)).toBe(changed);
   }else throw Error('Unexpected student workflow '+s.workflow);
   expect(errors).toEqual([]);
  });
 }
});
module.exports={STUDENTS};
