const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 7.6 Knowledge Database desktop',()=>{
 test.beforeEach(async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmKnowledgeDB76&&window.NeuroMapKnowledgeDB);
 });
 test('typed metadata saves to the original selected node and Undo restores it',async({page})=>{
  await page.evaluate(()=>{const app=neuroMapApp;
   app.selectNode(app.state.root.id);window.__beforeDB=JSON.stringify(NeuroMapKnowledgeDB.normalize(app.state.root.knowledge));
   app._nmKnowledgeDB76.open();
  });
  const panel=page.locator('#nm76-overlay');
  await expect(panel).toBeVisible();
  await panel.getByPlaceholder('Anatomia, Ripasso, Esame').fill('Anatomia, Studio, studio');
  await panel.getByPlaceholder('es. materia').fill('materia');
  await panel.locator('.nm76-line select').first().selectOption('text');
  await panel.getByRole('button',{name:'Salva proprietà'}).click();
  const tags=await page.evaluate(()=>neuroMapApp.state.root.knowledge.tags);
  expect(tags).toEqual(['Anatomia','Studio']);
  await page.evaluate(()=>neuroMapApp.undo());
  const restored=await page.evaluate(()=>JSON.stringify(NeuroMapKnowledgeDB.normalize(neuroMapApp.state.root.knowledge)));
  expect(restored).toBe(await page.evaluate(()=>window.__beforeDB));
 });
 test('daily note creation is idempotent and preserves existing notes',async({page})=>{
  await page.evaluate(()=>{const app=neuroMapApp;app.selectNode(app.state.root.id);app._nmKnowledgeDB76.open()});
  const p=page.locator('#nm76-overlay');
  await p.getByRole('button',{name:'Apri / crea diario'}).click();
  const first=await page.evaluate(()=>{
   const stack=[neuroMapApp.state.root];let matches=0;
   while(stack.length){const n=stack.pop();if(n.knowledge?.dailyKey)matches++;stack.push(...(n.children||[]))}
   return matches;
  });
  expect(first).toBe(1);
  await page.evaluate(()=>neuroMapApp._nmKnowledgeDB76.open());
  await p.getByRole('button',{name:'Apri / crea diario'}).click();
  const second=await page.evaluate(()=>{
   const stack=[neuroMapApp.state.root];let count=0;
   while(stack.length){const n=stack.pop();if(n.knowledge?.dailyKey)count++;stack.push(...(n.children||[]))}
   return count;
  });
  expect(second).toBe(1);
 });
});

for(const locale of ['it','en'])test('database keeps drafts and synchronizes template tags: '+locale,async({page})=>{
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?._nmKnowledgeDB76);
 await page.evaluate(async locale=>{
  await GlaukaI18n.setLanguage(locale);
  const a=neuroMapApp;a.selectNode(a.state.root.id);
  NeuroMapKnowledgeDB.update(a.state,a.state.root.id,{fields:{keep:{type:'text',value:'original'}}});
  a._nmKnowledgeDB76.open();
 },locale);
 const p=page.locator('#nm76-overlay'),tags=p.getByPlaceholder(locale==='it'?'Anatomia, Ripasso, Esame':'Anatomy, Review, Exam');
 const save=p.getByRole('button',{name:locale==='it'?'Salva proprietà':'Save properties',exact:true});
 await tags.fill('Draft');
 await p.getByRole('button',{name:locale==='it'?'Applica template':'Apply template',exact:true}).click();
 await expect(p.locator('[role=status]')).toContainText(locale==='it'?'Salva o annulla':'Save or discard');
 expect(await page.evaluate(()=>neuroMapApp.state.root.knowledge.tags)).toEqual([]);
 await p.locator('.nm76-line input').nth(2).fill('keep');
 await p.getByRole('button',{name:locale==='it'?'Rimuovi campo':'Remove field',exact:true}).click();
 expect(await page.evaluate(()=>neuroMapApp.state.root.knowledge.fields.keep.value)).toBe('original');
 await save.click();
 await p.getByRole('button',{name:locale==='it'?'Applica template':'Apply template',exact:true}).click();
 await expect(tags).toHaveValue('Draft, Studio');
 await save.click();
 expect(await page.evaluate(()=>neuroMapApp.state.root.knowledge.tags)).toEqual(['Draft','Studio']);
});
