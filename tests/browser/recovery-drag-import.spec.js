const {test,expect}=require('@playwright/test');
async function open(page,target){
  await page.setViewportSize({width:1280,height:900});
  await page.goto(target==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.io);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
}
async function seed(page,options={}){
  return page.evaluate(options=>{
    const a=window.neuroMapApp;
    a.importHierarchy({text:'Root',children:[{text:'Source',notes:'Do not lose α',children:[{text:'Descendant',children:[]}]},{text:'Target',children:[{text:'Existing',children:[]}]},{text:'Third',children:[]},{text:'Fourth',children:[]}]},{newTab:true});
    const [s,t]=a.state.root.children;
    s.sidePinned=options.side||'right';t.sidePinned=options.opposite?'left':s.sidePinned;
    t.collapsed=!!options.collapsed;
    a.state.branchStyle=options.style||'organic';a.recalculateAndRender();a.fitToScreen();
    a.selectNode(s.id);
    if(options.zoom){const sm=a.layout.getLayout(s.id),tm=a.layout.getLayout(t.id),z=options.zoom;Object.assign(a.renderer.camera,{zoom:z,x:innerWidth/2-(sm.x+tm.x)/2*z,y:innerHeight/2-(sm.y+tm.y)/2*z});a.requestRender();}
    window.qaDrag={source:s.id,target:t.id,descendant:s.children[0].id};
    return window.qaDrag;
  },options);
}
async function drag(page,source,target,edge=0,nest=false){
  const position=async id=>page.evaluate(({id,edge})=>{const a=window.neuroMapApp,m=a.layout.getLayout(id),p=a.renderer.worldToScreen(m.x,m.y);return {x:p.x,y:p.y+edge*m.height*a.renderer.camera.zoom};},{id,edge:id===target?edge:0});
  const start=await position(source),end=await position(target);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  // Alt is pressed after pointerdown: this is an intentional change of parent,
  // not an ordinary sibling reorder. Touch users can dwell on the hotspot.
  if(nest)await page.keyboard.down('Alt');
  await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
  if(nest)await page.keyboard.up('Alt');
}
const formats=[
  ['md','# Root\n- A\n  - A1\n  - A2\n- B\n- C\n- D\n- E\n- F'],
  ['markdown','# Root\n## A\n### A1\n### A2\n## B\n## C\n## D\n## E\n## F'],
  ['txt','Root\n  A\n    A1\n    A2\n  B\n  C\n  D\n  E\n  F'],
  ['text','Root\r\n\tA\r\n\t\tA1\r\n\t\tA2\r\n\tB\r\n\tC\r\n\tD\r\n\tE\r\n\tF'],
  ['opml','<?xml version="1.0"?><opml version="2.0"><body><outline text="Root"><outline text="A"><outline text="A1"/><outline text="A2"/></outline><outline text="B"/><outline text="C"/><outline text="D"/><outline text="E"/><outline text="F"/></outline></body></opml>'],
  ['json',JSON.stringify({root:{text:'Root',children:['A','B','C','D','E','F'].map((text,i)=>({text,children:i?[]:[{text:'A1',children:[]},{text:'A2',children:[]}]}))}})],
];
for(const target of ['desktop','android'])test.describe(`${target} recovery, drag and import order`,()=>{
  test.beforeEach(async({page})=>open(page,target));
  for(const [name,options] of [['same side right',{}],['same side left',{side:'left'}],['opposite sides',{opposite:true}],['collapsed target',{collapsed:true}],['radial layout',{style:'radial'}],['zoom 50%',{zoom:.5}],['zoom 200%',{zoom:2}]]){
    test(`Alt + sibling center explicitly nests a child: ${name}`,async({page})=>{
      const ids=await seed(page,options);
      const before=await page.evaluate(()=>window.neuroMapApp.state.createSnapshot());
      await drag(page,ids.source,ids.target,0,true);
      const result=await page.evaluate(()=>{const a=window.neuroMapApp,s=a.state.findNode(window.qaDrag.source),t=a.state.findNode(window.qaDrag.target);return {parent:s.parentId,children:t.children.map(c=>c.id),descendant:s.children[0].id,notes:s.notes,collapsed:t.collapsed};});
      expect(result.parent).toBe(ids.target);expect(result.children.at(-1)).toBe(ids.source);
      expect(result.descendant).toBe(ids.descendant);expect(result.notes).toBe('Do not lose α');expect(result.collapsed).toBe(false);
      const moved=await page.evaluate(()=>window.neuroMapApp.state.createSnapshot());
      await page.evaluate(()=>window.neuroMapApp.undo());expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(before);
      await page.evaluate(()=>window.neuroMapApp.redo());expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(moved);
    });
  }
  test('dropping just below the box reorders siblings without changing their parent',async({page})=>{
    const ids=await seed(page);
    await drag(page,ids.source,ids.target,.65);
    const result=await page.evaluate(()=>{const a=window.neuroMapApp,s=a.state.findNode(window.qaDrag.source);return {parent:s.parentId,root:a.state.root.id,order:a.state.root.children.map(n=>n.text)};});
    expect(result.parent).toBe(result.root);expect(result.order).toEqual(['Target','Source','Third','Fourth']);
  });
  test('self and descendant targets cannot create cycles or detach the branch',async({page})=>{
    const ids=await seed(page);
    const before=await page.evaluate(()=>window.neuroMapApp.state.createSnapshot());
    await drag(page,ids.source,ids.descendant);
    expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(before);
    const rejected=await page.evaluate(()=>{const a=window.neuroMapApp,{source,descendant}=window.qaDrag;return [a.v5ReparentNode(source,source,false,true),a.v5ReparentNode(source,descendant,false,true),a.v5ReparentNode(a.state.root.id,source,false,true)];});
    expect(rejected).toEqual([false,false,false]);
  });
  test('Escape and pointer cancellation preserve the tree',async({page})=>{
    const ids=await seed(page),before=await page.evaluate(()=>window.neuroMapApp.state.createSnapshot());
    const points=await page.evaluate(()=>{const a=window.neuroMapApp;return [window.qaDrag.source,window.qaDrag.target].map(id=>{const m=a.layout.getLayout(id);return a.renderer.worldToScreen(m.x,m.y);});});
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
    expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(before);
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:8});
    await page.evaluate(()=>{const a=window.neuroMapApp;a.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:a._v5Candidate.pointerId,bubbles:true}));});await page.mouse.up();
    expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(before);
  });
  for(const [ext,content] of formats)test(`${ext} file preserves hierarchy and clockwise primary order across distribution changes`,async({page})=>{
    await page.evaluate(({ext,content})=>{window.qaImport=window.neuroMapApp.importFile(new File([content],'source.'+ext),{newTab:true});},{ext,content});
    if(target==='android'&&['md','markdown','txt','text'].includes(ext))await page.locator('#nm-android-root-preview [data-action=create]').click();
    const result=await page.evaluate(async()=>{
      await window.qaImport;const a=window.neuroMapApp,sequence=[];
      // Android retains a filename container around imported document headings.
      const conceptRoot=a.state.root.text==='source'?a.state.root.children[0]:a.state.root;
      for(const bias of [0,25,50,75,100]){a.state.balanceBias=bias;a.state.thresholdY=bias;a.recalculateAndRender();sequence.push({source:a.state.root.children.map(n=>n.text),visual:NeuroMapCore.visualOrder(a.state.root.children,a.layout).map(n=>n.text)});}
      return {root:conceptRoot.text,concepts:conceptRoot.children.map(n=>n.text),first:conceptRoot.children[0].children.map(n=>n.text),sequence};
    });
    expect(result.root).toBe('Root');expect(result.concepts).toEqual(['A','B','C','D','E','F']);expect(result.first).toEqual(['A1','A2']);
    for(const entry of result.sequence){expect(entry.source).toEqual(target==='android'&&['md','markdown','txt','text'].includes(ext)?['Root']:['A','B','C','D','E','F']);expect(entry.visual).toEqual(entry.source);}
  });
  test('flat plain text places all six concepts clockwise, including all-left and all-right layouts',async({page})=>{
    await page.evaluate(()=>{window.qaImport=window.neuroMapApp.importFile(new File(['A\nB\nC\nD\nE\nF'],'flat.txt'),{newTab:true});});
    if(target==='android')await page.locator('#nm-android-root-preview [data-action=create]').click();
    const orders=await page.evaluate(async()=>{await window.qaImport;const a=window.neuroMapApp;return [0,25,50,75,100].map(bias=>{a.state.balanceBias=bias;a.recalculateAndRender();return NeuroMapCore.visualOrder(a.state.root.children,a.layout).map(n=>n.text);});});
    for(const order of orders)expect(order).toEqual(['A','B','C','D','E','F']);
  });
  test('OPML with several top-level outlines keeps every concept',async({page})=>{
    const parsed=await page.evaluate(()=>window.neuroMapApp.parseTextHierarchy('<opml><body><outline text="First"/><outline text="Second"/><outline text="Third"/></body></opml>','opml').root);
    expect(parsed.children.map(n=>n.text)).toEqual(['First','Second','Third']);
  });
  for(const kind of ['content.json','content.xml'])test(`XMind ${kind} imports every sheet and preserves clockwise concept order`,async({page})=>{
    const encoded=require('./fixtures/xmind.json')[kind];
    const before=await page.evaluate(encoded=>{const a=window.neuroMapApp,start=a.tabs.length;window.qaXDone=false;window.qaXImport=a.importFile(new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],'external.xmind'),{newTab:true}).finally(()=>window.qaXDone=true);return start;},encoded);
    if(target==='android')for(let i=0;i<2;i++){
      await page.waitForFunction(()=>window.qaXDone||!!document.querySelector('#nm-android-root-preview:not(.hidden)'));
      if(await page.evaluate(()=>window.qaXDone))break;
      await page.locator('#nm-android-root-preview [data-action=create]').click();
    }
    const maps=await page.evaluate(async start=>{await window.qaXImport;const a=window.neuroMapApp;return a.tabs.slice(start).map(t=>({title:t.state.root.text,concepts:t.state.root.children.map(n=>n.text)}));},before);
    expect(maps).toEqual(['Root','Second map'].map(title=>({title,concepts:['A','B','C','D','E','F']})));
  });
  for(const kind of ['invalid-json','invalid-xml'])test(`XMind ${kind} rejects a broken later sheet without partially importing`,async({page})=>{
    const result=await page.evaluate(async encoded=>{const a=window.neuroMapApp,before=a.tabs.map(t=>t.id);let error='';try{await a.importFile(new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],'broken.xmind'),{newTab:true});}catch(e){error=e.message;}return {before,after:a.tabs.map(t=>t.id),error};},require('./fixtures/xmind.json')[kind]);
    expect(result.error).not.toBe('');expect(result.after).toEqual(result.before);
  });
  test('1000-node map survives 120 moves, Undo/Redo, serialization and reload',async({page})=>{
    test.setTimeout(60000);
    const result=await page.evaluate(()=>{
      const a=window.neuroMapApp;
      a.importHierarchy({text:'Large',children:Array.from({length:20},(_,i)=>({text:`Branch ${i}`,children:Array.from({length:49},(_,j)=>({text:`Node ${i}/${j}`,notes:`Note α ${j}`,children:[]}))}))},{newTab:true});
      const ids=a.state.root.children.map(n=>n.id),leaf=a.state.root.children[0].children[0].id;
      const initial=a.state.createSnapshot(),started=performance.now();
      for(let i=0;i<120;i++){a.v5ReparentNode(leaf,ids[(i+1)%20],false,true);a.undo();a.redo();}
      const nodes=a.state.getAllNodes(),content=nodes.map(n=>[n.id,n.parentId,n.text,n.notes]);
      a.persistWorkspace();return {count:nodes.length,unique:new Set(nodes.map(n=>n.id)).size,parents:nodes.every(n=>n.children.every(c=>c.parentId===n.id)),content,elapsedMs:performance.now()-started};
    });
    expect(result.count).toBe(1001);expect(result.unique).toBe(1001);expect(result.parents).toBe(true);
    await page.reload();await page.waitForFunction(()=>window.neuroMapApp?.state?.root?.text==='Large');
    expect(await page.evaluate(()=>window.neuroMapApp.state.getAllNodes().map(n=>[n.id,n.parentId,n.text,n.notes]))).toEqual(result.content);
  });
  test('last completed browser backup survives page close and a new page',async({page,context})=>{
    await seed(page);const before=await page.evaluate(()=>{const a=window.neuroMapApp;a.state.root.notes='Recovered α';a.persistWorkspace();return a.state.createSnapshot().root;});
    await page.close();const restored=await context.newPage();await open(restored,target);
    expect(await restored.evaluate(()=>window.neuroMapApp.state.createSnapshot().root)).toEqual(before);
  });
  test('portrait/landscape viewport changes retain edited content and selection',async({page})=>{
    const ids=await seed(page),before=await page.evaluate(()=>window.neuroMapApp.state.createSnapshot());
    for(const size of [{width:390,height:844},{width:844,height:390},{width:390,height:844}]){
      await page.setViewportSize(size);
      expect(await page.evaluate(()=>window.neuroMapApp.state.createSnapshot())).toEqual(before);
    }
  });
  test('legacy JSON missing optional metadata opens without losing hierarchy',async({page})=>{
    const tree=await page.evaluate(async()=>{const a=window.neuroMapApp;await a.importFile(new File([JSON.stringify({root:{text:'Legacy',children:[{text:'Child'}]}})],'old.neuromap'),{newTab:true});return {root:a.state.root.text,child:a.state.root.children[0].text,images:a.state.images,relationships:a.state.relationships};});
    expect(tree).toEqual({root:'Legacy',child:'Child',images:[],relationships:[]});
  });
});
