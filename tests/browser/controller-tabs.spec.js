const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(`${platform}: extracted tab lifecycle keeps thirty document states, duplication and clean closure`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmSettings);
 const result=await page.evaluate(async()=>{
  const a=neuroMapApp,records=[];
  for(let i=0;i<30;i++){const t=a.createNewTab('Document '+i);a.state.pushHistory();a.state.root.text='Edited '+i;a.state.isDirty=true;records.push({id:t.id,state:a.state,root:JSON.stringify(a.state.root),undo:JSON.stringify(a.state.undoStack)})}
  let intact=true;for(const r of records){a.activateTab(r.id);intact&&=a.state===r.state&&JSON.stringify(a.state.root)===r.root&&JSON.stringify(a.state.undoStack)===r.undo}
  const original=a.state,originalBytes=JSON.stringify(original.createSnapshot());a.duplicateTab();const duplicate=a.state,duplicateId=a.activeTabId;
  const independent=duplicate!==original&&duplicate.root!==original.root;duplicate.root.text='Changed duplicate';
  const preserved=originalBytes===JSON.stringify(original.createSnapshot());duplicate.isDirty=false;await a.closeTab(duplicateId);
  for(const r of records)r.state.isDirty=false;
  for(const r of records.slice(1))await a.closeTab(r.id);
  a.activateTab(records[0].id);a.undo();const undone=a.state.root.text;a.redo();const redone=a.state.root.text;
  return{intact,independent,preserved,closed:!a.tabs.some(t=>records.slice(1).some(r=>r.id===t.id)||t.id===duplicateId),owner:a.state===records[0].state,undone,redone};
 });
 expect(result).toEqual({intact:true,independent:true,preserved:true,closed:true,owner:true,undone:'Document 0',redone:'Edited 0'});
});
