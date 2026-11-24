const {test,expect}=require('@playwright/test');

// Synthetic fixtures: these tests do not certify native dialogs or legacy XMind files.
for(const target of ['desktop','android']){
  test.describe(`${target} data integrity`,()=>{
    test.beforeEach(async({page})=>{
      await page.setViewportSize(target==='android'?{width:390,height:844}:{width:1280,height:900});
      await page.goto(target==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
      await page.waitForFunction(()=>window.neuroMapApp?.importFile);
      await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
    });

    test('NOD012 INV004 INV007: deleting 40 descendants supports exact Undo and Redo',async({page})=>{
      const result=await page.evaluate(()=>{
        const a=window.neuroMapApp;
        a.importHierarchy({text:'QA root',children:[{text:'Branch',notes:'Keep me',children:Array.from({length:40},(_,i)=>({text:`Child ${i}`,notes:`Note ${i}`,children:[]}))},{text:'Untouched',children:[]}]},{newTab:true});
        a.selectNode(a.state.root.children[0].id);
        const snapshot=()=>a.state.createSnapshot();
        const before=snapshot();a.deleteSelected();const deleted=snapshot();
        const remaining=a.state.getAllNodes().length;
        a.undo();const restored=snapshot();a.redo();
        return {before,restored,deleted,redone:snapshot(),remaining};
      });
      expect(result.remaining).toBe(2);
      expect(result.restored).toEqual(result.before);
      expect(result.redone).toEqual(result.deleted);
    });

    test('CLP001 INV007: pasted branch keeps content and valid new IDs',async({page})=>{
      const result=await page.evaluate(()=>{
        const a=window.neuroMapApp;
        a.importHierarchy({text:'QA',children:[{text:'Source',notes:'Source note',children:[{text:'A',notes:'α é 中文',children:[]},{text:'B',children:[]}]},{text:'Target',children:[]}]},{newTab:true});
        const [source,target]=a.state.root.children;
        const content=n=>({text:n.text,notes:n.notes||'',children:n.children.map(content)});
        a.selectNode(source.id);const payload=a.copySelection(true);const original=JSON.stringify(payload);
        a.selectNode(target.id);a.pasteSelection(payload);
        const nodes=a.state.getAllNodes();
        return {expected:content(source),actual:target.children[0]?content(target.children[0]):null,unchanged:original===JSON.stringify(payload),unique:new Set(nodes.map(n=>n.id)).size===nodes.length,parents:nodes.every(n=>n.children.every(c=>c.parentId===n.id)),rootOrder:a.state.root.children.map(n=>n.text)};
      });
      expect(result.actual).toEqual(result.expected);
      expect(result.unchanged).toBe(true);expect(result.unique).toBe(true);expect(result.parents).toBe(true);
    });

    test('INV012: malformed JSON leaves tabs and current map untouched',async({page})=>{
      const result=await page.evaluate(async()=>{
        const a=window.neuroMapApp;
        const before=JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,state:a.state.createSnapshot()});
        let error='';try{await a.importFile(new File(['{"root":'],'broken.json'),{newTab:false});}catch(e){error=e.message;}
        const after=JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,state:a.state.createSnapshot()});
        return {rejected:!!error,unchanged:before===after};
      });
      expect(result).toEqual({rejected:true,unchanged:true});
    });

    test('TXT015: duplicate IDs in a workspace are rejected safely or regenerated',async({page})=>{
      const result=await page.evaluate(async()=>{
        const a=window.neuroMapApp;
        const before=JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,root:a.state.root});
        const root={id:'same',text:'Root',children:[{id:'same',text:'Child',children:[]}]};
        try{
          await a.importFile(new File([JSON.stringify({schema:'NeuroMapArchitect-WorkspaceBatch-v6',tabs:[{root}]})],'duplicate.json'));
        }catch(e){return {safe:before===JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,root:a.state.root}),rejected:true};}
        const nodes=a.state.getAllNodes();
        return {safe:new Set(nodes.map(n=>n.id)).size===nodes.length && nodes.every(n=>n.children.every(c=>c.parentId===n.id)),rejected:false};
      });
      expect(result.safe).toBe(true);
    });

    test('INV012: a rejected batch import does not partially add tabs',async({page})=>{
      const result=await page.evaluate(async()=>{
        const a=window.neuroMapApp;
        const before=JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,root:a.state.root});
        const tabs=[{root:{id:'valid',text:'Valid first sheet',children:[]}},{root:{id:'too-big',text:'Oversized second sheet',children:Array.from({length:3501},(_,i)=>({id:`n${i}`,text:`N ${i}`,children:[]}))}}];
        let rejected=false;
        try{await a.importFile(new File([JSON.stringify({schema:'NeuroMapArchitect-WorkspaceBatch-v6',tabs})],'batch.json'));}catch(e){rejected=true;}
        return {rejected,unchanged:before===JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,root:a.state.root})};
      });
      expect(result.rejected).toBe(true);expect(result.unchanged).toBe(true);
    });

    test('INV011: workspace export and import preserve tab order, notes and distribution',async({page})=>{
      const result=await page.evaluate(async()=>{
        const a=window.neuroMapApp;
        for(const text of ['First α','Second é']){
          a.importHierarchy({text,notes:'Root note',children:[{text:'Child',notes:'Child note',children:[]}]},{newTab:true});
          a.state.thresholdY=0;a.state.balanceBias=25;a.state.compactness=90;
        }
        let capture;const download=a.io.triggerDownload;
        a.io.triggerDownload=blob=>{capture=blob;};
        let payload;
        try{a.io.exportBatchWorkspaceJSON();payload=JSON.parse(await capture.text());}finally{a.io.triggerDownload=download;}
        const count=a.tabs.length;
        await a.importFile(new File([JSON.stringify(payload)],'roundtrip.json'));
        a.saveActiveTabSnapshot();
        const project=t=>({text:t.root.text,notes:t.root.notes||'',children:t.root.children.map(c=>({text:c.text,notes:c.notes||''})),thresholdY:t.thresholdY,balanceBias:t.balanceBias,compactness:t.compactness});
        return {expected:payload.tabs.map(project),actual:a.tabs.slice(count).map(t=>project(t.state))};
      });
      expect(result.actual).toEqual(result.expected);
    });

    test('INV012: invalid metadata or excess sheets reject the entire batch without side effects',async({page})=>{
      const results=await page.evaluate(async()=>{
        const a=window.neuroMapApp;
        const snapshot=()=>JSON.stringify({tabs:a.tabs.map(t=>t.id),active:a.activeTabId,state:a.state.createSnapshot(),dirty:a.state.isDirty,cards:a.studyCards});
        const good={root:{id:'r',text:'First',children:[]},studyCards:[{sourceNodeId:'r',answer:'Temporary card'}]};
        const batches=[
          [good,{root:{id:'b',text:'Bad metadata',children:[]},images:{}}],
          Array.from({length:21},(_,i)=>({root:{id:`r${i}`,text:`Sheet ${i}`,children:[]}})),
          [good,{root:null}]
        ];
        const results=[];
        for(const tabs of batches){
          const before=snapshot();let rejected=false;
          try{await a.importFile(new File([JSON.stringify({schema:'NeuroMapArchitect-WorkspaceBatch-v6',tabs})],'invalid.json'));}catch(e){rejected=true;}
          results.push({rejected,unchanged:before===snapshot()});
        }
        return results;
      });
      expect(results).toEqual(Array.from({length:3},()=>({rejected:true,unchanged:true})));
    });

    test('legacy batch without IDs still imports valid parent pointers',async({page})=>{
      const result=await page.evaluate(async()=>{
        const a=window.neuroMapApp;
        const tabs=[{root:{text:'Legacy',children:[{text:'Child',children:null}]},images:null,relationships:null,studyCards:null}];
        const count=await a.importFile(new File([JSON.stringify({schema:'NeuroMapArchitect-WorkspaceBatch-v6',tabs})],'legacy.json'));
        const [child]=a.state.root.children;
        return {count,root:a.state.root.text,child:child.text,unique:!!child.id && child.id!==a.state.root.id,parent:child.parentId===a.state.root.id};
      });
      expect(result).toEqual({count:2,root:'Legacy',child:'Child',unique:true,parent:true});
    });

    if(target==='desktop')test('single-project JSON also preserves a zero distribution threshold',async({page})=>{
      const value=await page.evaluate(async()=>{
        const data={root:{text:'Zero',children:[]},thresholdY:0};
        await window.neuroMapApp.importFile(new File([JSON.stringify(data)],'zero.neuromap'));
        return window.neuroMapApp.state.thresholdY;
      });
      expect(value).toBe(0);
    });
  });
}
