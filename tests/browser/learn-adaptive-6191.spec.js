const {test,expect}=require('@playwright/test');
test.describe('NeuroMap 6.19.1 Adaptive Learning (desktop)',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?._nmLearning&&window.NeuroMapAdaptiveCore);
  await page.locator('#nm6-welcome-start').click();
  await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.importHierarchy({text:'Anatomia',children:[
    {text:'Cuore',notes:'Pompa ematica',children:[
     {text:'Atrio',children:[]},{text:'Ventricolo',children:[]}]},
    {text:'Rene',children:[]},{text:'Fegato',children:[]},
    {text:'Polmone',children:[]}
   ]},{newTab:true});
  });
 });
 test('Mistake-to-Map overlays only observed errors without rewriting nodes',async({page})=>{
  const before=await page.evaluate(()=>{
   const a=neuroMapApp,n=a.state.root.children[0];
   a.learningAttempts=NeuroMapLearningCore.addAttempt([],{
    tabId:a.activeTabId,nodeId:n.id,itemId:'card:test',
    format:'choice',correct:false,sourceSignature:a.v5Signature(n,a.state)},Date.now()-3000);
   return {root:JSON.stringify(a.state.root),undo:a.state.undoStack.length};
  });
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Da ripassare',exact:true}).click();
  await expect(page.locator('#nm-learn-panel')).toContainText('1 errori');
  await page.getByRole('button',{name:'Evidenzia errori sulla mappa'}).click();
  const result=await page.evaluate(()=>{
   const a=neuroMapApp;
   return {count:a.renderer._nmAdaptiveBadges.size,root:JSON.stringify(a.state.root),
    undo:a.state.undoStack.length};
  });
  expect(result.count).toBe(1);
  expect(result.root).toBe(before.root);
  expect(result.undo).toBe(before.undo);
  await page.getByRole('button',{name:'Nascondi indicatori'}).click();
  expect(await page.evaluate(()=>neuroMapApp.renderer._nmAdaptiveBadges)).toBeNull();
 });
 test('stale mistake history is distinguished from current quiz results',async({page})=>{
  await page.evaluate(()=>{
   const a=neuroMapApp,n=a.state.root.children[0];
   a.learningAttempts=NeuroMapLearningCore.addAttempt([],{
    tabId:a.activeTabId,nodeId:n.id,itemId:'stale',
    format:'open',correct:false,sourceSignature:'old-context'},Date.now()-1000);
  });
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Da ripassare',exact:true}).click();
  await expect(page.locator('#nm-learn-panel .nm-learn-summary')).toContainText('1 valutazioni');
  expect(await page.evaluate(()=>{
   const a=neuroMapApp;return NeuroMapAdaptiveCore.radar(a.state.root,{
    tabId:a.activeTabId,attempts:a.learningAttempts,
    signatureFor:n=>a.v5Signature(n,a.state)}).totals.mistakes;
  })).toBe(0);
 });
 test('Exam Planner saves date and budget into the NeuroMap project',async({page})=>{
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Esame',exact:true}).click();
  await page.locator('#nm-learn-panel input[type=date]').fill('2027-06-24');
  await page.locator('#nm-learn-panel input[type=number]').fill('45');
  await page.getByRole('button',{name:'Salva piano'}).click();
  const meta=await page.evaluate(()=>{
   const a=neuroMapApp,t=a.tabs.find(t=>t.id===a.activeTabId);
   return {plan:NM614.serialize(a,t).learningPlan,saved:a.learningPlans.length,
    dirty:a.state.isDirty};
  });
  expect(meta.plan.examDate).toBe('2027-06-24');
  expect(meta.plan.minutesPerDay).toBe(45);
  expect(meta.dirty).toBe(true);
  expect(meta.saved).toBe(1);
 });
 test('switching map hides markers and closes adaptive panel',async({page})=>{
  await page.evaluate(()=>{
   const a=neuroMapApp,n=a.state.root.children[0];
   a.learningAttempts=NeuroMapLearningCore.addAttempt([],{
    tabId:a.activeTabId,nodeId:n.id,itemId:'mistake',
    format:'choice',correct:false,sourceSignature:a.v5Signature(n,a.state)},Date.now()-1000);
  });
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Da ripassare',exact:true}).click();
  await page.getByRole('button',{name:'Evidenzia errori sulla mappa'}).click();
  await page.evaluate(()=>neuroMapApp.createNewTab('Other'));
  expect(await page.evaluate(()=>neuroMapApp.renderer._nmAdaptiveBadges)).toBeNull();
  await expect(page.locator('#nm-learn-panel')).toBeHidden();
 });
 test('Adaptive quiz prioritizes a known difficult node without calling AI',async({page})=>{
  await page.evaluate(()=>{
   const a=neuroMapApp,n=a.state.root.children[0];
   a.learningAttempts=NeuroMapLearningCore.addAttempt([],{
    tabId:a.activeTabId,nodeId:n.id,itemId:'quiz-wrong',
    format:'choice',correct:false,sourceSignature:a.v5Signature(n,a.state)},Date.now()-1000);
   a.aiClient.chat=()=>{throw Error('External AI must not be called')};
  });
  await page.locator('#nm-learn-open').click();
  await page.getByRole('button',{name:'Quiz',exact:true}).click();
  await page.getByRole('button',{name:'Inizia quiz'}).click();
  await expect(page.locator('.nm-learn-question')).toContainText(/Cuore/);
 });
});
