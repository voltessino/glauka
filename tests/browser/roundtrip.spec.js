const {test,expect}=require('@playwright/test');

async function open(page,target){
  await page.setViewportSize(target==='android'?{width:390,height:844}:{width:1280,height:900});
  await page.addInitScript(()=>{
    window.qaRoundtripSnapshot=()=>{
      const a=window.neuroMapApp,p=a.io.buildSerializedProjectPayload();
      const paths=new Map();
      const tree=(n,path='root')=>{
        paths.set(n.id,path);
        return {text:n.text,notes:n.notes||'',collapsed:!!n.collapsed,sidePinned:n.sidePinned||null,boundary:n.boundary||null,children:n.children.map((c,i)=>tree(c,path+'/'+i))};
      };
      const root=tree(p.root);
      return {root,thresholdY:p.thresholdY,strokeScale:p.strokeScale,typographyScale:p.typographyScale,
        images:p.images.map(({id,attachedNodeId,...image})=>({...image,attachedNode:attachedNodeId?paths.get(attachedNodeId)||'MISSING':null})),
        relationships:p.relationships.map(({id,fromId,toId,...rel})=>({...rel,from:paths.get(fromId)||'MISSING',to:paths.get(toId)||'MISSING'})),
        cards:p.studyCards.map(c=>({question:c.question,answer:c.answer,node:paths.get(c.sourceNodeId)||'MISSING',srStatus:c.srStatus}))};
    };
  });
  await page.goto(target==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.io?.buildSerializedProjectPayload);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
}

async function seed(page){
  return page.evaluate(()=>{
    const a=window.neuroMapApp;
    a.importHierarchy({text:'Roundtrip α é',notes:'Root note\nsecond line',children:[
      {text:'Left',notes:'中文 note',sidePinned:'left',boundary:{title:'Boundary QA'},children:[{text:'Grandchild',children:[]}]},
      {text:'Right',notes:'Other note',sidePinned:'right',children:[]}
    ]},{newTab:true});
    const [left,right]=a.state.root.children;
    left.collapsed=true;
    const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=';
    a.state.images=[{id:'qa-attached',src,width:80,height:60,mode:'attached',attachedNodeId:left.id,aspectLocked:true,zLayer:'front',offset:{dx:12,dy:-90},worldPos:{x:0,y:0}},
      {id:'qa-free',src,width:45,height:45,mode:'free',aspectLocked:true,zLayer:'back',worldPos:{x:190,y:-70}}];
    a.state.relationships=[{id:'qa-rel',fromId:left.id,toId:right.id,label:'Link α',color:'#f43f5e'}];
    a.studyCards.push({id:'qa-card',sourceNodeId:left.id,sourceTabId:a.activeTabId,question:'Question α?',answer:'Answer é',sourceSignature:a.v5Signature(left,a.state),srStatus:2});
    a.state.thresholdY=0;a.state.strokeScale=1.3;a.state.typographyScale=1.2;
    a.recalculateAndRender();a.saveActiveTabSnapshot();
    return window.qaRoundtripSnapshot();
  });
}

for(const target of ['desktop','android'])test.describe(`${target} roundtrip`,()=>{
  test.beforeEach(async({page})=>open(page,target));

  test('single NeuroMap project restores notes, attached/free images, links and study cards',async({page})=>{
    const before=await seed(page);
    const after=await page.evaluate(async()=>{
      const a=window.neuroMapApp,p=a.io.buildSerializedProjectPayload();
      await a.importFile(new File([JSON.stringify(p)],'project.neuromap'),{newTab:true});
      return window.qaRoundtripSnapshot();
    });
    expect(after).toEqual(before);
  });

  test('workspace export restores attachments and references in the correct tab',async({page})=>{
    const before=await seed(page);
    const after=await page.evaluate(async()=>{
      const a=window.neuroMapApp,original=a.io.triggerDownload;let blob;
      a.io.triggerDownload=value=>{blob=value;};
      try{a.io.exportBatchWorkspaceJSON();}finally{a.io.triggerDownload=original;}
      await a.importFile(new File([await blob.text()],'workspace.json'),{newTab:true});
      return window.qaRoundtripSnapshot();
    });
    expect(after).toEqual(before);
  });

  test('autosave and reload retain the active map, attachments, references and zero threshold',async({page})=>{
    const before=await seed(page);
    const tabs=await page.evaluate(()=>{
      const a=window.neuroMapApp;a.persistWorkspace();
      return {count:a.tabs.length,active:a.activeTabId};
    });
    await page.reload();await page.waitForFunction(()=>window.neuroMapApp?.state?.root);
    const after=await page.evaluate(()=>({snapshot:window.qaRoundtripSnapshot(),count:window.neuroMapApp.tabs.length,active:window.neuroMapApp.activeTabId}));
    expect(after.count).toBe(tabs.count);expect(after.active).toBe(tabs.active);expect(after.snapshot).toEqual(before);
  });

  test('Markdown export and reimport retain hierarchy, order, multiline labels and backslashes',async({page})=>{
    const expected=await page.evaluate(async()=>{
      const a=window.neuroMapApp;
      const expected={text:'QA α',children:[{text:'Line one\nLine two',children:[{text:'C:\\notes\\file',children:[]}]},{text:'Last é',children:[]},{text:'Long '.repeat(80).trim(),children:[]}]};
      a.importHierarchy(expected,{newTab:true});
      let blob;const original=a.io.triggerDownload;a.io.triggerDownload=value=>{blob=value;};
      try{a.io.exportMarkdown();}finally{a.io.triggerDownload=original;}
      const markdown=await blob.text();
      window.qaMarkdownImport=a.importFile(new File([markdown],'roundtrip.md'),{newTab:true});
      return expected;
    });
    if(target==='android')await page.locator('#nm-android-root-preview [data-action="create"]').click();
    const actual=await page.evaluate(async()=>{
      await window.qaMarkdownImport;
      const tree=n=>({text:n.text,children:n.children.map(tree)});
      return tree(window.neuroMapApp.state.root);
    });
    expect(actual).toEqual(expected);
  });

  test('batch Markdown reopens every map in the exported order',async({page})=>{
    const expected=await page.evaluate(async()=>{
      const a=window.neuroMapApp;
      a.importHierarchy({text:'Root only',children:[]},{newTab:true});
      a.importHierarchy({text:'Batch first',children:[{text:'Child α',children:[]}]},{newTab:true});
      a.importHierarchy({text:'Batch second',children:[{text:'C:\\notes',children:[]}]},{newTab:true});
      const tree=n=>({text:n.text,children:n.children.map(tree)});
      const trees=a.tabs.map(t=>tree(t.state.root));
      let blob;const original=a.io.triggerDownload;a.io.triggerDownload=value=>{blob=value;};
      try{a.io.exportBatchMarkdown();}finally{a.io.triggerDownload=original;}
      window.qaBatchStart=a.tabs.length;
      window.qaMarkdownImport=a.importFile(new File([await blob.text()],'batch.md'),{newTab:true});
      return trees;
    });
    if(target==='desktop')await page.locator('#nm615-import-modal [data-nm615=split]').click();
    if(target==='android')for(const root of expected)if(root.children.length)await page.locator('#nm-android-root-preview [data-action="create"]').click();
    const actual=await page.evaluate(async()=>{
      await window.qaMarkdownImport;
      const a=window.neuroMapApp,tree=n=>({text:n.text,children:n.children.map(tree)});
      return a.tabs.slice(window.qaBatchStart).map(t=>tree(t.state.root));
    });
    expect(actual).toEqual(expected);
  });
});
