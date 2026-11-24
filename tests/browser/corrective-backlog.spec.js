const {test,expect}=require('@playwright/test');
test.describe('desktop adapted corrective backlog',()=>{
 test.beforeEach(async({page})=>{await page.setViewportSize({width:1366,height:950});await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.io&&window.NeuroMapDesktopWorkflow);await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));});
 test('R04-R06 new defaults are compact and essential, explicit saved settings survive reopening',async({page})=>{
  expect(await page.evaluate(()=>{const s=neuroMapApp.newState('Defaults');return [s.compactness,s.branchGapX,s.branchStyle];})).toEqual([55,30,'xmind8']);
  await page.evaluate(()=>{localStorage.setItem('neuromap.default.branchGapX.v6.11','180');const a=neuroMapApp;a.createNewTab();a.state.compactness=125;a.state.branchStyle='buzan';a.persistWorkspace();});
  await page.reload();await page.waitForFunction(()=>window.neuroMapApp?.io);
  expect(await page.evaluate(()=>[neuroMapApp.state.compactness,neuroMapApp.state.branchGapX,neuroMapApp.state.branchStyle])).toEqual([125,180,'buzan']);
 });
 for(const side of ['left','right'])test(`R10 ${side} horizontal arrows use only direct children and parent, and stop at leaves`,async({page})=>{
  const r=await page.evaluate(side=>{const a=neuroMapApp;a.importHierarchy({text:'Center',children:[{text:'Target',children:[{text:'First',children:[]},{text:'Last',children:[]}]},{text:'Unrelated',children:[{text:'Other',children:[]}]}]},{newTab:true});a.state.root.children[0].sidePinned=side;a.state.root.children[1].sidePinned=side;a.recalculateAndRender();const parent=a.state.root.children[0],out=side==='left'?'ArrowLeft':'ArrowRight',back=side==='left'?'ArrowRight':'ArrowLeft';a.selectNode(parent.id);a.nm611MoveSelection(out);const child=a.state.findNode(a.state.selectedNodeId),m=a.layout.getLayout(child.id),siblings=parent.children.map(n=>({id:n.id,y:a.layout.getLayout(n.id).y}));const blocked=!a.nm611MoveSelection(out),id=a.state.selectedNodeId;a.nm611MoveSelection(back);return {direct:child.parentId===parent.id,blocked,unchanged:id===child.id,parent:a.state.selectedNodeId===parent.id,chosenY:m.y,expectedY:side==='left'?Math.max(...siblings.map(n=>n.y)):Math.min(...siblings.map(n=>n.y))};},side);
  expect(r).toEqual({direct:true,blocked:true,unchanged:true,parent:true,chosenY:r.expectedY,expectedY:r.expectedY});
 });
 test('R10 repeated boundary arrows stay on canvas and never activate the branch button',async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Center',children:[{text:'Left leaf',children:[]}]},{newTab:true});a.state.root.children[0].sidePinned='left';a.recalculateAndRender();a.selectNode(a.state.root.children[0].id);a.canvas.focus();window.qaClicks=0;document.querySelector('#nm67-next-main')?.addEventListener('click',()=>qaClicks++);});
  const before=await page.evaluate(()=>neuroMapApp.state.selectedNodeId);
  await page.keyboard.press('ArrowLeft');for(let i=0;i<30;i++)await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(()=>({id:neuroMapApp.state.selectedNodeId,focus:document.activeElement.id,clicks:qaClicks}))).toEqual({id:before,focus:'mindmap-canvas',clicks:0});
 });
 test('R09 Undo to the saved baseline clears dirty; Redo and styling restore it without navigation false positives',async({page})=>{
  const result=await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Saved',children:[{text:'One',children:[]},{text:'Two',children:[]}]},{newTab:true});a.state.isDirty=false;NeuroMapDesktopWorkflow.saved(a.state);a.selectNode(a.state.root.children[0].id);const clean=!a.state.isDirty;a.state.updateNodeText(a.state.selectedNodeId,'Changed');a.markChanged();const changed=a.state.isDirty;a.undo();const undo=a.state.isDirty;a.redo();const redo=a.state.isDirty;a.undo();a.state.pushHistory();a.state.strokeScale=2;a.markChanged();const style=a.state.isDirty;a.undo();return {clean,changed,undo,redo,style,styleUndo:a.state.isDirty};});
  expect(result).toEqual({clean:true,changed:true,undo:false,redo:true,style:true,styleUndo:false});
 });
 test('R01 cancelled native saves remain dirty; successful saves retain Unicode path and expose it in the tab',async({page})=>{
  const result=await page.evaluate(async()=>{const a=neuroMapApp;a.state.pushHistory();a.state.root.text='Mappa α';a.markChanged();window.neuromapDesktop={saveProject:async()=>({cancelled:true}),writeWorkspace:async()=>{}};const cancelled=await a.saveActiveTabSafe();const stillDirty=a.state.isDirty;neuromapDesktop.saveProject=async()=>({path:'/Users/qa/Mappe α/Studio.neuromap',name:'Studio.neuromap'});const saved=await a.saveActiveTabSafe();const tab=a.tabs.find(t=>t.id===a.activeTabId);return {cancelled,stillDirty,saved,dirty:a.state.isDirty,path:tab.filePath,title:document.querySelector('.tab-item.active').title};});
  expect(result).toMatchObject({cancelled:false,stillDirty:true,saved:true,dirty:false,path:'/Users/qa/Mappe α/Studio.neuromap'});expect(result.title).toContain(result.path);
 });
 test('R02 external structured Markdown opens import without duplicate nodes and text editing keeps native paste',async({page})=>{
  const before=await page.evaluate(()=>{const a=neuroMapApp;window.qaOriginalRoot=JSON.stringify(a.state.root);const data=new DataTransfer();data.setData('text/plain','# External\n## **Alpha**\n- *Beta*');const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data});a.canvas.dispatchEvent(e);return a.tabs.length;});
  await expect(page.locator('#paste-modal')).toBeVisible();expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root)===qaOriginalRoot)).toBe(true);
  await page.locator('#btn-confirm-paste-newtab').click();await page.locator('#gl-import-mode').selectOption('one');await page.locator('#gl-paste-studio').getByRole('button',{name:'Crea 1 mappe',exact:true}).click();await expect(page.locator('#paste-modal')).toBeHidden();
  expect(await page.evaluate(()=>({count:neuroMapApp.tabs.length,text:neuroMapApp.state.root.text,weight:neuroMapApp.state.root.children[0].fontWeight,italic:neuroMapApp.state.root.children[0].children[0].fontItalic}))).toEqual({count:before+1,text:'External',weight:700,italic:true});
  const native=await page.evaluate(()=>{const a=neuroMapApp;a.editSelected();const d=new DataTransfer();d.setData('text/plain','# Text for the node');const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d});document.getElementById('inline-editor-input').dispatchEvent(e);return !e.defaultPrevented;});expect(native).toBe(true);await expect(page.locator('#paste-modal')).toBeHidden();
 });
 for(const mode of ['common','individual'])test(`R07 split import uses ${mode} central names, preserving options and all source leaves`,async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp;window.qaBefore=a.tabs.length;window.qaImport=a.nm611ImportRoot({text:'Chapters',children:Array.from({length:260},(_,i)=>({text:'Topic '+i,children:[]}))},{newTab:true});});
  await expect(page.locator('#nm615-import-modal')).toBeVisible();await page.locator('#nm-import-name-mode').selectOption(mode);
  if(mode==='common')await page.locator('#nm-import-common-name').fill('Common α');else await page.locator('#nm-import-name-list input').first().fill('Custom first');
  const count=await page.locator('#nm-import-name-list input').count();await page.locator('#nm615-import-modal [data-nm615=split]').click();
  const result=await page.evaluate(async()=>{await qaImport;const tabs=neuroMapApp.tabs.slice(qaBefore),leaves=tabs.flatMap(t=>t.state.getAllNodes().filter(n=>!n.children.length).map(n=>n.text));return {names:tabs.map(t=>t.state.root.text),leaves};});
  expect(result.names).toHaveLength(count);expect(result.leaves).toEqual(Array.from({length:260},(_,i)=>'Topic '+i));if(mode==='common')expect(new Set(result.names)).toEqual(new Set(['Common α']));else expect(result.names[0]).toBe('Custom first');
 });
 test('R08 clipboard commands stay visible before collapsed groups, with root/blank disabled states',async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp;a.showContextMenu(200,200,{type:'node',item:a.state.root});});
  await page.locator('#nm-context-more-node > summary').click();
  await expect(page.locator('#ctx-cut')).toBeVisible();await expect(page.locator('#ctx-copy')).toBeVisible();await expect(page.locator('#ctx-paste')).toBeVisible();await expect(page.locator('#ctx-copy')).toBeDisabled();
  expect(await page.locator('#ctx-copy').evaluate(e=>!e.closest('details'))).toBe(true);
 });
 test('R02 native Mac clipboard facade preserves large Unicode payloads and reports errors',async({page})=>{
  const result=await page.evaluate(async()=>{let value='',calls=0;window.webkit={messageHandlers:{neuromapClipboard:{postMessage:message=>{calls++;if(message.kind==='write')value=message.text;queueMicrotask(()=>NeuroMapDesktopWorkflow.clipboardReply({id:message.id,text:message.kind==='read'?value:''}));}}}};const text='# α 中文\n'+('Concept 🧠\n'.repeat(20000));await NeuroMapDesktopWorkflow.clipboard.writeText(text);return {same:await NeuroMapDesktopWorkflow.clipboard.readText()===text,calls};});expect(result).toEqual({same:true,calls:2});
 });
 test('R01 Mac save shortcuts preserve Save All and the separate Save As command',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'}));await page.reload();await page.waitForFunction(()=>window.neuroMapApp?.io);
  await page.evaluate(()=>{window.qaSaves=[];neuroMapApp.saveActiveTabSafe=as=>{qaSaves.push(as?'as':'one');return true;};neuroMapApp.saveAllTabs=()=>{qaSaves.push('all');return true;};neuroMapApp.canvas.focus();});
  await page.keyboard.press('Meta+s');await page.keyboard.press('Meta+Shift+s');await page.evaluate(()=>document.getElementById('menu-save-file-as').click());
  expect(await page.evaluate(()=>qaSaves)).toEqual(['one','all','as']);
 });
 for(const ok of [false,true])test(`R09 Save and quit ${ok?'succeeds only after all documents save':'stays open on cancellation or failure'}`,async({page})=>{
  await page.evaluate(ok=>{neuroMapApp.state.isDirty=true;neuroMapApp.saveAllTabs=async()=>{if(ok)neuroMapApp.tabs.forEach(t=>t.state.isDirty=false);return ok;};window.qaClosing=NeuroMapLifecycle.requestClose();},ok);
  await page.locator('#nm-decision-actions').getByRole('button',{name:'Salva',exact:true}).click();expect(await page.evaluate(()=>qaClosing)).toBe(ok);
 });
 test('R07 desired map count and live language switching preserve user names',async({page})=>{
  await page.evaluate(()=>{window.qaImport=neuroMapApp.nm611ImportRoot({text:'Source',children:Array.from({length:260},(_,i)=>({text:'Item '+i,children:[]}))},{newTab:true});});
  await page.locator('#nm-import-desired-count').fill('3');await page.locator('#nm-import-desired-count').dispatchEvent('change');
  await expect(page.locator('#nm-import-name-list input')).toHaveCount(3);await page.locator('#nm-import-name-list input').first().fill('Salva');
  await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});
  await expect(page.locator('#nm-import-name-mode option').first()).toHaveText('Name per map');await expect(page.locator('#nm-import-name-list input').first()).toHaveValue('Salva');
  await page.locator('#nm615-import-modal [data-nm615=split]').click();await page.evaluate(()=>qaImport);
  await page.evaluate(()=>{window.qaSmall=neuroMapApp.nm611ImportRoot({text:'Fresh title',children:[]},{newTab:true});});await page.evaluate(()=>qaSmall);expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Fresh title');
 });
 test('R10 vertical navigation is directional and stable after zoom and tab switches',async({page})=>{
  const result=await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Center',children:Array.from({length:6},(_,i)=>({text:'Branch '+i,children:[{text:'Child '+i,children:[]}]}))},{newTab:true});const id=a.activeTabId,current=a.state.root.children[1];const outcomes=[];for(const zoom of [.5,1,2]){a.renderer.camera.zoom=zoom;a.activateTab(a.tabs[0].id);a.activateTab(id);a.selectNode(current.id);const y=a.layout.getLayout(current.id).y;for(const key of ['ArrowUp','ArrowDown']){const chosen=Array.from({length:10},()=>NeuroMapDesktopWorkflow.next(a,key));outcomes.push({stable:chosen.every(n=>n?.id===chosen[0]?.id),direction:!chosen[0]||(key==='ArrowUp'?a.layout.getLayout(chosen[0].id).y<y:a.layout.getLayout(chosen[0].id).y>y)});}}return outcomes;});for(const value of result)expect(value).toEqual({stable:true,direction:true});
 });
 test('R09 moving an image becomes dirty before mouse release and Undo restores the saved position',async({page})=>{
  const result=await page.evaluate(()=>{const a=neuroMapApp;a.state.images=[{id:'qa-image',src:'data:image/png;base64,AA==',mode:'free',width:80,height:60,worldPos:{x:0,y:0}}];a.state.isDirty=false;NeuroMapDesktopWorkflow.saved(a.state);const original=a.state.constructor.cloneImages(a.state.images)[0];a.drag={kind:'image-move',startX:0,startY:0,moved:false,historyTaken:false,original,rect:{x:0,y:0,w:80,h:60}};a.updateImageDrag({clientX:40,clientY:20});const dirty=NeuroMapLifecycle.dirty();a.drag=null;a.undo();return {dirty,undo:a.state.isDirty,x:a.state.images[0].worldPos.x};});expect(result).toEqual({dirty:true,undo:false,x:0});
 });
 test('R07 a second import cannot duplicate an import already awaiting confirmation',async({page})=>{
  await page.evaluate(()=>{window.qaPending=neuroMapApp.nm611ImportRoot({text:'Large',children:Array.from({length:260},(_,i)=>({text:'Item '+i,children:[]}))},{newTab:true});});
  expect(await page.evaluate(()=>neuroMapApp.nm611ImportRoot({text:'Duplicate',children:[]},{newTab:true}))).toBe(-1);
  await page.locator('#nm615-import-modal [data-nm615=cancel]').click();expect(await page.evaluate(()=>qaPending)).toBe(-1);
 });
 for(const route of ['file','clipboard'])test(`R07 explicit multi-document Markdown uses the same naming dialog via ${route}`,async({page})=>{
  await page.evaluate(route=>{const source='# First\n- A\n---\n# Second\n- B';if(route==='file')window.qaMulti=neuroMapApp.importFile(new File([source],'two.md'),{newTab:true});else neuroMapApp.nm66PasteOutline(source);},route);
  if(route==='clipboard')await page.locator('#btn-confirm-paste-newtab').click();
  if(route==='file'){
   await expect(page.locator('#nm615-import-modal')).toBeVisible();await expect(page.locator('#nm-import-name-list input')).toHaveCount(2);await page.locator('#nm-import-name-list input').first().fill('Renamed');await page.locator('#nm615-import-modal [data-nm615=split]').click();
  }else{
   await expect(page.locator('#gl-paste-studio')).toBeVisible();await expect(page.locator('#gl-import-map-select option')).toHaveCount(2);await page.locator('#gl-import-map-name').fill('Renamed');await page.locator('#gl-paste-studio').getByRole('button',{name:'Crea 2 mappe',exact:true}).click();
  }
  if(route==='file')await page.evaluate(()=>qaMulti);await expect.poll(()=>page.evaluate(()=>neuroMapApp.tabs.slice(-2).map(t=>t.state.root.text))).toEqual(['Renamed','Second']);
  expect(await page.evaluate(()=>neuroMapApp.tabs.slice(-2).map(t=>t.state.root.children[0].text))).toEqual(['A','B']);
 });
 test('R00 attached images reserve their own space without covering neighbouring labels',async({page})=>{
  const result=await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Root',children:[{text:'Parent',children:[{text:'First',children:[]},{text:'Second',children:[]},{text:'Third',children:[]}]}]},{newTab:true});const owner=a.state.root.children[0].children[2];a.state.images=[{id:'picture',mode:'attached',attachedNodeId:owner.id,width:160,height:80,offset:{dx:0,dy:-84}}];a.recalculateAndRender();const r=a.renderer.resolveImageWorldRect(a.state.images[0]);return a.state.getAllNodes().filter(n=>n.id!==owner.id).filter(n=>{const m=a.layout.getLayout(n.id);return r.x<m.x+m.width/2&&r.x+r.w>m.x-m.width/2&&r.y<m.y+m.height/2&&r.y+r.h>m.y-m.height/2;}).map(n=>n.text);});expect(result).toEqual([]);
 });
 test('R07 capacity validation keeps edited names visible instead of partially creating maps',async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp;while(a.tabs.length<20)a.createNewTab();window.qaCapacity=a.nm611ImportRoot({text:'Large',children:Array.from({length:260},(_,i)=>({text:'Item '+i,children:[]}))},{newTab:true});});
  await page.locator('#nm-import-name-list input').first().fill('Keep my name');await page.locator('#nm615-import-modal [data-nm615=split]').click();
  await expect(page.locator('#nm615-import-modal')).toBeVisible();await expect(page.locator('#nm-import-name-list input').first()).toHaveValue('Keep my name');expect(await page.evaluate(()=>neuroMapApp.tabs.length)).toBe(20);
  await page.locator('#nm615-import-modal [data-nm615=cancel]').click();expect(await page.evaluate(()=>qaCapacity)).toBe(-1);
 });
 test('R03 long Markdown labels survive import and export without the legacy 500-character truncation',async({page})=>{
  const result=await page.evaluate(async()=>{const a=neuroMapApp,text='LongUnicode α '.repeat(700).trim();await a.importFile(new File(['# Document\n- '+text],'long.md'),{newTab:true});const first=a.state.root.children[0].text;const markdown=a.io.serializeNodeToMarkdown(a.state.root);await a.importFile(new File([markdown],'again.md'),{newTab:true});return {same:first===text,roundtrip:a.state.root.children[0].text===text,length:first.length};});expect(result.same).toBe(true);expect(result.roundtrip).toBe(true);expect(result.length).toBeGreaterThan(500);
 });
 test('R02 large unstructured clipboard text keeps the existing readable chunked import',async({page})=>{
  await page.evaluate(()=>{window.qaPlain='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(500);neuroMapApp.nm66PasteOutline(qaPlain);});await page.locator('#btn-confirm-paste-newtab').click();await page.locator('#gl-import-mode').selectOption('one');await page.locator('#gl-paste-studio').getByRole('button',{name:'Crea 1 mappe',exact:true}).click();await expect(page.locator('#paste-modal')).toBeHidden();
  const result=await page.evaluate(()=>{const children=neuroMapApp.state.root.children;return {same:children.map(n=>n.text).join('')===qaPlain,count:children.length,max:Math.max(...children.map(n=>n.text.length))};});expect(result.same).toBe(true);expect(result.count).toBeGreaterThan(10);expect(result.max).toBeLessThanOrEqual(500);
 });
 for(const style of ['neon','buzan','xmind8','radial'])test(`R00 dense multiline map remains collision-free at minimum spacing: ${style}`,async({page})=>{
  const result=await page.evaluate(style=>{const a=neuroMapApp;a.importHierarchy({text:'Epitelio',children:Array.from({length:8},(_,i)=>({text:'Classificazione '+i,children:Array.from({length:8},(_,j)=>({text:(j%2?'spessore\n70–120 µm\n':'Forma ')+('cellule '.repeat(j%5+1)),fontSize:j%3?null:32,children:[{text:'Proprietà '+j,children:[]}]}))}))},{newTab:true});a.state.compactness=55;a.state.branchGapX=30;a.state.branchStyle=style;a.recalculateAndRender();const ms=[...a.layout.nodeLayoutMap.values()],pairs=[];for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++)if(Math.abs(ms[i].x-ms[j].x)<(ms[i].width+ms[j].width)/2-1&&Math.abs(ms[i].y-ms[j].y)<(ms[i].height+ms[j].height)/2-1)pairs.push([i,j]);return {count:ms.length,collisions:pairs.length};},style);expect(result.count).toBeGreaterThan(120);expect(result.collisions).toBe(0);
 });
});
