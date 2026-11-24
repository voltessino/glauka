const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');window.qaOpens=0;window.qaSaves=[];window.neuromapDesktop={developerEdition:true,readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),productStatus:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{},openProject:async()=>({cancelled:true}),openProjects:()=>{qaOpens++;return new Promise(resolve=>window.qaFinishOpen=resolve)},saveProject:async q=>{qaSaves.push(q);return {path:'C:\\Maps\\Study.neuromap',name:'Study.neuromap'}}};});
 await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.io);await page.locator('#mindmap-canvas').click({position:{x:500,y:400}});
});
test('Ctrl+O opens one native picker and repeated commands do not queue more dialogs',async({page})=>{
 await page.keyboard.press('Control+o');await page.waitForFunction(()=>window.qaOpens===1);await page.keyboard.press('Control+o');expect(await page.evaluate(()=>qaOpens)).toBe(1);
 await page.evaluate(()=>qaFinishOpen([]));await expect.poll(()=>page.evaluate(()=>!!neuroMapApp._nmNativeOpenPending)).toBe(false);await page.keyboard.press('Control+o');await expect.poll(()=>page.evaluate(()=>qaOpens)).toBe(2);await page.evaluate(()=>qaFinishOpen([]));
});
test('open failures release the command so the next attempt can start',async({page})=>{
 await page.evaluate(()=>{window.neuromapDesktop={...neuromapDesktop,openProjects:async()=>{throw Error('picker unavailable')}}});
 await page.keyboard.press('Control+o');await expect.poll(()=>page.evaluate(()=>!!neuroMapApp._nmNativeOpenPending)).toBe(false);
 await page.evaluate(()=>{window.neuromapDesktop={...neuromapDesktop,openProjects:async()=>{qaOpens++;return []}}});await page.keyboard.press('Control+o');await expect.poll(()=>page.evaluate(()=>qaOpens)).toBe(1);
});
test('Ctrl+S preserves file identity and the next save reuses its path',async({page})=>{
 await page.evaluate(()=>{const a=neuroMapApp;a.state.updateNodeText(a.state.root.id,'First revision');a.markChanged()});await page.keyboard.press('Control+s');await expect.poll(()=>page.evaluate(()=>qaSaves.length)).toBe(1);await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.isDirty)).toBe(false);
 await page.evaluate(()=>{const a=neuroMapApp;a.state.updateNodeText(a.state.root.id,'Second revision');a.markChanged()});await page.keyboard.press('Control+s');await expect.poll(()=>page.evaluate(()=>qaSaves.length)).toBe(2);
 const saves=await page.evaluate(()=>qaSaves.map(s=>({path:s.filePath,as:s.saveAs,text:JSON.parse(s.json).root.text})));expect(saves[0]).toEqual({path:null,as:false,text:'First revision'});expect(saves[1]).toEqual({path:'C:\\Maps\\Study.neuromap',as:false,text:'Second revision'});
});
