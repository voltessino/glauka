'use strict';
const {test,expect}=require('@playwright/test');
test.describe('Android preserves desktop learning data even when features are not exposed in Android UI',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto('http://127.0.0.1:5173/app/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.io?.exportBatchWorkspaceJSON&&
    window.neuroMapApp.importFile);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(n=>n.classList.add('hidden')));
 });
 test('workspace JSON export/import preserves quiz attempts and one exam plan per tab',async({page})=>{
  const result=await page.evaluate(async()=>{
   const a=neuroMapApp;
   a.importHierarchy({text:'Physiology',children:[{text:'Heart',children:[]}]},{newTab:true});
   const originalTab=a.activeTabId,sourceNode=a.state.root.children[0].id;
   a.learningAttempts=[{tabId:originalTab,nodeId:sourceNode,
    itemId:'question-1',format:'choice',correct:false,sourceSignature:'original',at:12345}];
   a.learningPlans=[{tabId:originalTab,examDate:'2027-06-24',minutesPerDay:35}];
   let exported;const original=a.io.triggerDownload;
   a.io.triggerDownload=blob=>{exported=blob};
   let payload;
   try{
    a.io.exportBatchWorkspaceJSON();
    payload=JSON.parse(await exported.text());
   }finally{a.io.triggerDownload=original;}
   const originalSheet=payload.tabs.find(t=>t.id===originalTab);
   if(!originalSheet)throw Error('Export omitted the source tab');
   const before=a.tabs.length;
   await a.importFile(new File([JSON.stringify({
    schema:'NeuroMapArchitect-WorkspaceBatch-v6',
    tabs:[originalSheet]} )],'study-workspace.json'));
   const imported=a.activeTabId,importedAttempt=a.learningAttempts.find(x=>x.tabId===imported);
   const importedPlan=a.learningPlans.find(x=>x.tabId===imported);
   return {
    exportedAttempts:originalSheet.learningAttempts.length,
    exportedDate:originalSheet.learningPlan?.examDate,
    tabAdded:a.tabs.length===before+1,
    importedNodeValid:!!a.state.findNode(importedAttempt?.nodeId),
    importedTabLinked:importedAttempt?.tabId===imported,
    importedCorrect:importedAttempt?.correct,
    importedDate:importedPlan?.examDate,
    importedMinutes:importedPlan?.minutesPerDay
   };
  });
  expect(result).toEqual({exportedAttempts:1,exportedDate:'2027-06-24',
   tabAdded:true,importedNodeValid:true,importedTabLinked:true,
   importedCorrect:false,importedDate:'2027-06-24',importedMinutes:35});
 });
 test('single map import keeps quiz node IDs and retains plan',async({page})=>{
  const result=await page.evaluate(async()=>{
   const a=neuroMapApp;
   const payload={schema:'NeuroMapArchitect-SingleTab-v6',
    root:{id:'original-root',text:'Anatomy',children:[{id:'old-node',text:'Kidney',children:[]}]},
    learningAttempts:[{tabId:'old-tab',nodeId:'old-node',itemId:'kidney-quiz',
      correct:false,format:'choice',sourceSignature:'old'}],
    learningPlan:{tabId:'old-tab',examDate:'2027-03-10',minutesPerDay:20}};
   await a.importFile(new File([JSON.stringify(payload)],'anatomy.neuromap'),{newTab:true});
   const node=a.state.root.children[0],attempt=a.learningAttempts.find(x=>x.tabId===a.activeTabId),
    plan=a.learningPlans.find(x=>x.tabId===a.activeTabId);
   return {newID:node.id!=='old-node',mappedID:attempt?.nodeId===node.id,
    correct:attempt?.correct,examDate:plan?.examDate,minutes:plan?.minutesPerDay};
  });
  expect(result).toEqual({newID:false,mappedID:true,correct:false,
   examDate:'2027-03-10',minutes:20});
 });
 test('workspace imports cannot set negative or greater-than-100 distribution bias',async({page})=>{
  const checked=await page.evaluate(async()=>{
   const a=neuroMapApp,out=[];
   for(const value of [-50,101,0,100]){
    const payload={schema:'NeuroMapArchitect-WorkspaceBatch-v6',
     tabs:[{root:{text:'Threshold '+value,children:[]},thresholdY:value}]};
    await a.importFile(new File([JSON.stringify(payload)],'threshold.json'));
    out.push(a.state.thresholdY);
   }
   return out;
  });
  expect(checked).toEqual([50,50,0,100]);
 });
 test('autosave survives a genuine browser reload with plans and observed results',async({page})=>{
  const before=await page.evaluate(()=>{
   const a=neuroMapApp;
   a.importHierarchy({text:'Chemistry',children:[{text:'Atom',children:[]}]},{newTab:true});
   const tab=a.activeTabId,node=a.state.root.children[0].id;
   a.learningAttempts=[{tabId:tab,nodeId:node,itemId:'atom',correct:true}];
   a.learningPlans=[{tabId:tab,examDate:'2027-04-01',minutesPerDay:45}];
   if(!a.persistWorkspace())throw Error('Autosave failed on small project');
   return {tab,node};
  });
  await page.reload();
  await page.waitForFunction(()=>window.neuroMapApp?.state);
  const result=await page.evaluate(ids=>{
   const a=neuroMapApp;
   return {
    tab:a.activeTabId,
    attempt:a.learningAttempts.find(x=>x.tabId===ids.tab),
    plan:a.learningPlans.find(x=>x.tabId===ids.tab)
   };
  },before);
  expect(result.tab).toBe(before.tab);
  expect(result.attempt).toMatchObject({nodeId:before.node,correct:true});
  expect(result.plan).toMatchObject({examDate:'2027-04-01',minutesPerDay:45});
 });
});
