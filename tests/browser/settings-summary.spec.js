const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(`${platform}: settings summaries stay fresh across scopes, edits, undo and tab changes`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmSettings);
 const result=await page.evaluate(()=>{
  const a=neuroMapApp;a.importHierarchy({text:'Settings',children:[{text:'A',children:[{text:'A1',children:[]}]},{text:'B',children:[]}]},{newTab:true});
  const owner=a.activeTabId,source=a.state,spec=NeuroMapCreativeModules.formatting.specs.find(s=>s.id==='font-size');
  const target=document.getElementById('nm-format-target'),scope=document.getElementById('nm-settings-scope-style'),output=document.getElementById('inspector-fontsize-val');
  for(const node of source.getAllNodesIncludingCollapsed())node.fontSize=20;
  source.root.children[0].fontSize=26;a.selectNode(source.root.children[0].id);
  const before=JSON.stringify(source.createSnapshot()),history=source.undoStack.length,observed={};
  const capture=mode=>{target.value=mode;a.nmFormatRefresh();return{summary:a.nmSettings.summary(spec),mixed:document.getElementById('inspector-fontsize-slider').dataset.mixed,text:output.textContent}};
  scope.value='tab';observed.map=capture('map');observed.selection=capture('selection');observed.subtree=capture('subtree');observed.descendants=capture('descendants');observed.level=capture('level1');
  const readOnly=before===JSON.stringify(source.createSnapshot())&&history===source.undoStack.length;
  target.value='selection';a.nmSettingsApplyNode('fontSize',32);a.nmFormatRefresh();const changed=a.nmSettings.summary(spec).value.fontSize;
  a.undo();a.nmFormatRefresh();const undone=a.nmSettings.summary(spec).value.fontSize;a.redo();a.nmFormatRefresh();const redone=a.nmSettings.summary(spec).value.fontSize;
  a.createNewTab('Other');a.state.root.fontSize=40;target.value='map';a.nmFormatRefresh();const other=a.nmSettings.summary(spec).value.fontSize;
  scope.value='all';a.nmFormatRefresh();const all=a.nmSettings.summary(spec).mixed;
  scope.value='tab';a.activateTab(owner);target.value='selection';a.nmFormatRefresh();const returned=a.nmSettings.summary(spec).value.fontSize;
  return{observed,readOnly,changed,undone,redone,other,all,returned};
 });
 for(const mode of ['map','subtree','level']){expect(result.observed[mode].summary.mixed).toBe(true);expect(result.observed[mode].mixed).toBe('true');expect(result.observed[mode].text).toBe('Valori diversi')}
 expect(result.observed.selection.summary).toEqual({value:{fontSize:26},mixed:false,empty:false});
 expect(result.observed.descendants.summary).toEqual({value:{fontSize:20},mixed:false,empty:false});
 expect({...result,observed:undefined}).toEqual({observed:undefined,readOnly:true,changed:32,undone:26,redone:32,other:40,all:true,returned:32});
});
