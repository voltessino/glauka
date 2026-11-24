'use strict';
// Synthetic Playwright journeys, not 100 human usability tests.
// npx playwright test tests/browser/student-100-journeys.spec.js --workers=2
const {test,expect}=require('@playwright/test');
const {Buffer}=require('node:buffer');
const {pdfFixture}=require('./pdfjs-fixture');
const people=[
 ['Liceo scientifico','Fisica','Moto','F=ma'],
 ['Liceo classico','Storia','Roma repubblicana','date e tappe'],
 ['Liceo linguistico','Spagnolo','Verbi','niño, ¿qué?'],
 ['Liceo artistico','Arte','Prospettiva','didascalie'],
 ['Istituto tecnico','Elettronica','Circuiti','Ω, µF'],
 ['Medicina','Anatomia','Cuore','atri e ventricoli'],
 ['Infermieristica','Fisiologia','Perfusione','gittata cardiaca'],
 ['Ingegneria biomedica','Biomateriali','Elasticità','σ=Eε'],
 ['Informatica','Reti','TCP/IP','ttl=64'],
 ['Giurisprudenza','Diritto','Obbligazioni','norme e fonti'],
 ['Economia','Contabilità','Bilancio','ricavi e costi'],
 ['Biologia','Istologia','Tessuti','epitelio e stroma'],
 ['Chimica','Stechiometria','Reazioni','H₂O e NaCl'],
 ['Psicologia','Memoria','Richiamo','ripasso e recupero'],
 ['Storia contemporanea','Novecento','Guerre mondiali','1914–1918'],
 ['Lettere','Letteratura','Verismo','autore e opera'],
 ['Scienze della formazione','Pedagogia','Apprendimento','feedback'],
 ['Studente lavoratore','Organizzazione','Turni di studio','15 minuti'],
 ['Ripresa studi','Matematica','Frazioni','1/2 + 3/4'],
 ['Ricercatore','Metodologia','Fonti','α, β e citazioni']
];
const paths=['import-txt','quiz-to-exam','outline-view','android-large-import','android-dashboard'];
const scenarios=people.flatMap(([persona,course,topic,detail],i)=>
 paths.map((path,j)=>({id:String(i*5+j+1).padStart(3,'0'),
  persona,course,topic,detail,path,minutes:[10,25,45,90,150][(i+j)%5],
  device:j>=3?'android':'desktop'})));
if(scenarios.length!==100||new Set(scenarios.map(s=>s.id)).size!==100)
 throw Error('Scenario count or IDs invalid');

async function launch(page,device){
 const mobile=device==='android';
 await page.setViewportSize(mobile?{width:393,height:852}:{width:1280,height:850});
 await page.addInitScript(()=>{
  localStorage.setItem('nm6_welcome_seen','1');
  localStorage.setItem('nm6_locale','it');
 });
 await page.goto(mobile?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.state&&window.neuroMapApp.importHierarchy);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(n=>n.classList.add('hidden')));
}
async function seed(page,s){
 return page.evaluate(p=>{
  const a=neuroMapApp;
  a.importHierarchy({text:p.course+' — '+p.topic,notes:p.detail,children:[
   {text:p.topic,notes:'Appunti '+p.detail,children:[
    {text:'Definizione',notes:'Descrizione',children:[]},
    {text:'Esempio',notes:p.detail,children:[]}]},
   {text:'Relazioni',notes:'Collegamenti',children:[]},
   {text:'Verifica',notes:'Domande',children:[]},
   {text:'Ripasso',notes:'Richiamo attivo',children:[]}
  ]},{newTab:true});
  return {tab:a.activeTabId,child:a.state.root.children[0].id,
   root:a.state.root.id,nodes:a.state.getAllNodes().length};
 },s);
}
const tree=page=>page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
const textFor=s=>[
 s.topic+' — definizione: '+s.detail,
 'Seconda spiegazione: '+s.course,
 'Esempio applicativo: '+s.detail,
 'Domande: cosa ricordare e perché?'
].join('\n\n');

test.describe('100 synthetic students — UI integration, not human research',()=>{
 for(const s of scenarios){
  test(s.id+' · '+s.persona+' · '+s.path+' · '+s.minutes+' min',async({page})=>{
   test.setTimeout(s.path==='import-txt'&&((Number(s.id)-1)/5)%5===0?120000:60000);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await launch(page,s.device);
   if(s.path==='import-txt'){
    await page.waitForFunction(()=>neuroMapApp?._nmDocumentImport);
    const before=await page.evaluate(()=>neuroMapApp.state.root.children.length);
    await page.evaluate(()=>neuroMapApp._nmDocumentImport.open());
    const modal=page.locator('#nm-doc-import');
    await expect(modal).toBeVisible();
    const fullPDF=((Number(s.id)-1)/5)%5===0;
    if(fullPDF){
     // Four students confront a locally generated *real* 200-page PDF, not a text stand-in.
     await modal.locator('input[type=file]').setInputFiles({
      name:s.id+'-dispensa.pdf',mimeType:'application/pdf',
      buffer:pdfFixture(200,{bookmarks:false,texts:Array.from({length:200},
       (_,i)=>'Lesson '+(i+1)+' '+s.topic)})
     });
     await expect(modal.locator('.nm-di-preview')).toContainText('Pagina 1');
     const apply=modal.getByRole('button',{name:'Aggiungi alla mappa'});
     await expect(apply).toBeDisabled();
     await modal.locator('input[type=checkbox]').check();
     await expect(apply).toBeEnabled();
     expect(await page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before);
     await apply.click();
    }else{
     await modal.locator('input[type=file]').setInputFiles({
      name:s.id+'-appunti.txt',mimeType:'text/plain',
      buffer:Buffer.from(textFor(s),'utf8')
     });
     await expect(modal.locator('.nm-di-preview')).toContainText(s.topic);
     expect(await page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before);
     await modal.getByRole('button',{name:'Aggiungi alla mappa'}).click();
    }
    await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before+1);
    const added=await page.evaluate(()=>neuroMapApp.state.root.children.at(-1).children.map(n=>n.text));
    expect(added.length).toBe(fullPDF?200:4);
    if(!fullPDF)expect(added[0]).toContain(s.topic);
    await page.evaluate(()=>neuroMapApp.undo());
    expect(await page.evaluate(()=>neuroMapApp.state.root.children.length)).toBe(before);
   }else if(s.path==='quiz-to-exam'){
    await seed(page,s);
    await page.locator('#nm-learn-open').click();
    await page.getByRole('button',{name:'Quiz',exact:true}).click();
    await page.getByRole('button',{name:'Inizia quiz'}).click();
    await expect(page.locator('.nm-learn-question')).toBeVisible();
    const choice=page.locator('#nm-learn-panel .nm-learn-options button');
    if(await choice.count())await choice.first().click();
    else{
     await page.getByRole('button',{name:'Mostra risposta'}).click();
     await page.getByRole('button',{name:'✓ Ricordato'}).click();
    }
    const logged=await page.evaluate(()=>({
     record:neuroMapApp.learningAttempts.at(-1),tab:neuroMapApp.activeTabId
    }));
    expect(logged.record.tabId).toBe(logged.tab);
    await page.getByRole('button',{name:'Da ripassare',exact:true}).click();
    await expect(page.locator('#nm-learn-panel .nm-learn-summary')).toBeVisible();
    await page.getByRole('button',{name:'Esame',exact:true}).click();
    await page.locator('#nm-learn-panel input[type=date]').fill('2027-06-24');
    await page.locator('#nm-learn-panel input[type=number]').fill(String(s.minutes));
    await page.getByRole('button',{name:'Salva piano'}).click();
    const plan=await page.evaluate(()=>neuroMapApp.learningPlans.find(p=>
     p.tabId===neuroMapApp.activeTabId));
    expect(plan).toMatchObject({examDate:'2027-06-24',minutesPerDay:s.minutes});
   }else if(s.path==='outline-view'){
    const setup=await seed(page,s);
    await page.waitForFunction(()=>window.NeuroMapLinkedViews&&neuroMapApp?._nmKnowledge);
    await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
    await expect(page.locator('#nm-view-overlay')).toBeVisible();
    const card=page.locator('.nm-view-card[data-node-id="'+setup.child+'"]');
    await expect(card).toBeVisible();
    await card.dblclick();
    const revised='Revised '+s.id+' '+s.topic;
    await page.locator('.nm-view-edit').fill(revised);
    await page.locator('.nm-view-edit').press('Enter');
    expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,setup.child)).toBe(revised);
    await page.locator('#nm-view-back').click();
    await expect(page.locator('#nm-view-overlay')).toBeHidden();
    await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));
    if(Number(s.id)%3===0){
     // Accessibility-oriented profiles exercise the actual readable UI mode.
     await page.evaluate(()=>NeuroMapUISkin.set({readability:'comfortable',contrast:'high'}));
     expect(await page.locator('body').getAttribute('data-nm-skin-readability')).toBe('comfortable');
     const target=await page.locator('#btn-zoom-in').evaluate(el=>parseFloat(getComputedStyle(el).minHeight));
     expect(target).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#nm-knowledge-panel .nm-kn-query').fill(revised);
    await expect(page.locator('#nm-knowledge-panel')).toContainText(revised);
    const actual=await page.evaluate(()=>({
     ids:neuroMapApp.state.getAllNodes().map(n=>n.id),
     edited:neuroMapApp.state.root.children[0].text
    }));
    expect(new Set(actual.ids).size).toBe(actual.ids.length);
    expect(actual.edited).toBe(revised);
   }else if(s.path==='android-large-import'){
    await page.waitForFunction(()=>neuroMapApp.importHierarchyPreview);
    await page.evaluate(p=>{
     const root={text:p.course+' '+p.topic,
      children:Array.from({length:301},(_,i)=>({
       text:p.topic+' '+i,notes:p.detail,children:[]
      }))};
     window.qaStudentImport=neuroMapApp.importHierarchyPreview(root,{newTab:true});
    },s);
    const preview=page.locator('#nm-android-root-preview');
    await expect(preview).toBeVisible();
    await page.selectOption('#nm-android-preview-size','125');
    await expect(page.locator('.nm-android-preview-card')).toHaveCount(3);
    await preview.locator('[data-action="create"]').click();
    const imported=await page.evaluate(async()=>{
     await window.qaStudentImport;
     return {tabs:neuroMapApp.tabs.length,root:neuroMapApp.state.root.text};
    });
    expect(imported.tabs).toBeGreaterThanOrEqual(3);
    const cardID=await page.evaluate(p=>{
     const a=neuroMapApp,n=a.state.root;
     a.studyCards=[{id:'student-card-'+p.id,sourceTabId:a.activeTabId,
      sourceNodeId:n.id,sourceSignature:a.v5Signature(n),
      question:'Ricorda '+p.topic,answer:p.detail,
      sr:{dueAt:0,intervalDays:0,reviews:0,lapses:0}}];
     a.openFlashcards();return a.studyCards[0].id;
    },s);
    await expect(page.locator('#flash-progress')).toHaveText('Carta 1 / 1');
    await page.locator('#flash-reveal').click();
    await page.evaluate(()=>neuroMapApp.rateFlashcard(3));
    const saved=await page.evaluate(()=>neuroMapApp.studyCards[0]);
    expect(saved.id).toBe(cardID);
    expect(saved.sr.reviews).toBe(1);
   }else if(s.path==='android-dashboard'){
    const setup=await seed(page,s);
    await page.waitForFunction(()=>window.NeuroMapAndroid74&&window.NeuroMapDashboard82);
    await page.evaluate(()=>{
     const a=neuroMapApp,n=a.state.root.children[0];
     n.text='Compito '+a.activeTabId;
     n.taskStatus='todo';n.dueDate='2027-05-01';
     window.qaStudentTask=n.id;
     NeuroMapAndroid74.open();NeuroMapAndroid74.show('dashboard');
    });
    const dashboard=page.locator('.nm82-dashboard');
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toContainText('Mappe aperte');
    await dashboard.locator('input[type=date]').fill('2027-05-01');
    const before=await tree(page);
    await dashboard.getByRole('button',{name:/Compito /}).first().click();
    expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeId))
     .toBe(await page.evaluate(()=>window.qaStudentTask));
    expect(await tree(page)).toBe(before);
    const current=await page.evaluate(id=>neuroMapApp.state.findNode(id).text,setup.child);
    expect(current).toContain('Compito ');
    await page.evaluate(p=>{
     const a=neuroMapApp,n=a.state.findNode(window.qaStudentTask);
     a.studyCards=[{id:'review-'+p.id,sourceTabId:a.activeTabId,
      sourceNodeId:n.id,sourceSignature:a.v5Signature(n),
      question:'Definisci '+p.topic,answer:p.detail,
      sr:{dueAt:0,reviews:0,lapses:0}}];
     a.openFlashcards();
    },s);
    await expect(page.locator('#flash-reveal')).toBeVisible();
    await page.locator('#flash-reveal').click();
    expect(await tree(page)).toBe(before);
    if(Number(s.id)%2===0){
     // Persistence: keep the original student map across a real browser reload.
     const expected=await page.evaluate(()=>neuroMapApp.state.root.text);
     await page.evaluate(()=>neuroMapApp.persistWorkspace());
     await page.reload();
     await page.waitForFunction(()=>window.neuroMapApp?.state?.root);
     expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe(expected);
    }
   }else throw Error('Unknown path '+s.path);
   expect(errors).toEqual([]);
  });
 }
});
module.exports={scenarios};
