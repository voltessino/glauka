const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])for(const mode of ['clockwise','balanced','fluid','radial']){
 test(`${platform} ${mode}: batched selection stays fresh across scopes, Undo, delete and tab changes`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto(platform==='android'?(process.env.GLAUKA_ANDROID_TEST_URL || 'http://127.0.0.1:5173/app/index.html'):(process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
  await page.waitForFunction(()=>window.neuroMapApp?.nmSettingsApplyNode);
  const result=await page.evaluate(mode=>{
   const a=neuroMapApp;
   a.importHierarchy({text:'Batch',notes:'Preserve',children:[{text:'A',children:[{text:'A1',collapsed:true,children:[{text:'A1x',notes:'Hidden note',children:[]}]},{text:'A2',children:[]}]},{text:'B',children:[{text:'B1',children:[]}]}]},{newTab:true});
   if(mode==='radial'){a.state.branchStyle='radial';a.recalculateAndRender()}else document.getElementById('nm-mode-'+mode).click();
   const originalTab=a.activeTabId,[A,B]=a.state.root.children,[A1]=A.children,[B1]=B.children;
   const ids=[A.id,A1.id,B1.id,'missing'];a.state.selectedNodeIds=ids;a.state.selectedNodeId=A.id;
   const names=nodes=>nodes.map(n=>n.text),target=document.getElementById('nm-format-target'),scopes={};
   for(const value of ['selection','subtree','descendants','map','level1','level2']){
    target.value=value;target.dispatchEvent(new Event('change',{bubbles:true}));scopes[value]=names(a.nm70ScopeNodes());
   }
   target.value='selection';target.dispatchEvent(new Event('change',{bubbles:true}));
   const selected=names(a.v6SelectedNodes());a.nmSettingsApplyNode('fontColor','#12ab34');
   const painted=names(a.state.getAllNodesIncludingCollapsed().filter(n=>n.fontColor==='#12ab34'));
   a.undo();const undo=names(a.state.getAllNodesIncludingCollapsed().filter(n=>n.fontColor==='#12ab34'));
   a.redo();const redo=names(a.state.getAllNodesIncludingCollapsed().filter(n=>n.fontColor==='#12ab34'));
   a.state.deleteNode(A1.id);a.markChanged();
   const deleted=a.state.findNode(A1.id)===null&&NeuroMapCore.findNodesById(a.state.root,[A1.id])[0]===null;
   a.undo();const restored=NeuroMapCore.findNodesById(a.state.root,[A1.id])[0]?.children[0].notes;
   const before=JSON.stringify(a.io.buildSerializedProjectPayload().root);
   a.importHierarchy({text:'Other',children:[]},{newTab:true});
   const other=a.v6SelectedNodes().map(n=>n.text);a.activateTab(originalTab);
   const unchanged=before===JSON.stringify(a.io.buildSerializedProjectPayload().root);
   return{scopes,selected,painted,undo,redo,deleted,restored,other,unchanged};
  },mode);
  expect(result.scopes).toEqual({selection:['A','A1','B1'],subtree:['A','A1','A1x','A2','B1'],descendants:['A1','A1x','A2'],map:['Batch','A','A1','A1x','A2','B','B1'],level1:['A','B'],level2:['A1','A2','B1']});
  expect(result.selected).toEqual(['A','A1','B1']);expect(result.painted).toEqual(['A','A1','B1']);expect(result.undo).toEqual([]);expect(result.redo).toEqual(result.painted);
  expect(result.deleted).toBe(true);expect(result.restored).toBe('Hidden note');expect(result.other).toEqual(['Other']);expect(result.unchanged).toBe(true);
 });
}
