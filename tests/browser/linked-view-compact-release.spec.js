const {test,expect}=require('@playwright/test');

// Run locally without GitHub Actions:
// npx playwright test tests/browser/linked-view-compact-release.spec.js --workers=1
async function boot(page,width,height=900){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>Boolean(window.neuroMapApp?.nmSettings&&window.NeuroMapLinkedViews));
  await page.evaluate(()=>{
    window.NeuroMapHome?.close?.();
    document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden'));
  });
  await page.addStyleTag({content:'*{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
for(const width of [720,960,1280,1440]){
  test('compact view menus stay bounded and do not stretch toolbar at '+width+'px',async({page})=>{
    await boot(page,width);
    const overlay=page.locator('#nm-view-overlay'),header=page.locator('#nm-view-overlay .nm-view-header');
    const before=await header.boundingBox();
    const appearance=page.locator('#nm-view-appearance');
    await appearance.locator('summary').first().click();
    await expect(appearance).toHaveAttribute('open','');
    const palette=page.locator('#nm-view-appearance .nm-appearance-fields');
    await expect(palette).toBeVisible();
    const after=await header.boundingBox(),o=await overlay.boundingBox(),p=await palette.boundingBox();
    expect(after.height).toBeLessThanOrEqual(before.height+4);
    expect(p.x).toBeGreaterThanOrEqual(o.x-1);
    expect(p.x+p.width).toBeLessThanOrEqual(o.x+o.width+1);
    expect(p.y).toBeGreaterThanOrEqual(o.y-1);
    expect(p.y+p.height).toBeLessThanOrEqual(o.y+o.height+1);
    await page.keyboard.press('Escape');
    await expect(appearance).not.toHaveAttribute('open','');
    await expect(overlay).toBeVisible(); // Esc closes only the menu.
    const exportMenu=page.locator('#nm-view-export-menu');
    await exportMenu.locator('summary').first().click();
    await expect(exportMenu).toHaveAttribute('open','');
    for(const id of ['nm-view-export-svg','nm-view-export-png1','nm-view-export-png2','nm-view-export-pdf'])
      await expect(page.locator('#'+id)).toBeVisible();
    const e=await page.locator('#nm-view-export-actions').boundingBox();
    expect(e.x).toBeGreaterThanOrEqual(o.x-1);
    expect(e.x+e.width).toBeLessThanOrEqual(o.x+o.width+1);
    await appearance.locator('summary').first().click();
    await expect(exportMenu).not.toHaveAttribute('open','');
    await expect(appearance).toHaveAttribute('open','');
    const scroller=await page.locator('#nm-view-scroller').boundingBox();
    await page.locator('#nm-view-scroller').click({position:{x:scroller.width-18,y:scroller.height-18}});
    await expect(appearance).not.toHaveAttribute('open','');
  });
}
test('native WebKit pinch on unrelated chrome is not captured by the linked view',async({page})=>{
  await boot(page,1280);
  const result=await page.evaluate(()=>{
    const control=document.createElement('button');
    control.textContent='Unrelated UI gesture fixture';
    document.body.append(control);
    const dispatch=(type,scale)=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,'scale',{value:scale});
      control.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const start=dispatch('gesturestart',1);
    const change=dispatch('gesturechange',1.4);
    const end=dispatch('gestureend',1.4);
    control.remove();
    return {start,change,end};
  });
  expect(result).toEqual({start:false,change:false,end:false});
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
});
test('modified Escape does not dismiss an active linked view',async({page})=>{
  await boot(page,1280);
  for(const modifier of ['Control','Meta','Alt','Shift']){
    const result=await page.evaluate(modifier=>{
      const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,
        ctrlKey:modifier==='Control',metaKey:modifier==='Meta',
        altKey:modifier==='Alt',shiftKey:modifier==='Shift'});
      document.getElementById('nm-view-overlay').dispatchEvent(event);
      return event.defaultPrevented;
    },modifier);
    expect(result).toBe(false);
    await expect(page.locator('#nm-view-overlay')).toBeVisible();
    expect(await page.evaluate(()=>window.neuroMapApp.state.root.viewMode)).toBe('orgchart');
  }
});
test('native pinch and Ctrl-wheel over a select never zoom linked canvas',async({page})=>{
  await boot(page,1280);
  const result=await page.evaluate(()=>{
    const overlay=document.getElementById('nm-view-overlay');
    const status=document.getElementById('nm-view-zoom-status');
    const select=document.createElement('select');
    const option=document.createElement('option');option.value='a';option.textContent='A';
    select.append(option);overlay.append(select);
    const before=status.textContent;
    const emit=(type,extra={})=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.assign(event,extra);select.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const start=emit('gesturestart',{scale:1,clientX:10,clientY:10});
    const change=emit('gesturechange',{scale:1.5,clientX:10,clientY:10});
    const end=emit('gestureend',{scale:1.5,clientX:10,clientY:10});
    const wheel=emit('wheel',{ctrlKey:true,metaKey:false,deltaMode:0,deltaY:-100,clientX:10,clientY:10});
    const unchanged=status.textContent===before;
    select.remove();
    return {start,change,end,wheel,unchanged};
  });
  expect(result).toEqual({start:false,change:false,end:false,wheel:false,unchanged:true});
});
test('one Ctrl zoom keydown in the primary scroller applies exactly one zoom step',async({page})=>{
  await boot(page,1280);
  const result=await page.evaluate(()=>{
    const scroller=document.getElementById('nm-view-scroller');
    const stage=document.getElementById('nm-view-stage');
    const status=document.getElementById('nm-view-zoom-status');
    const before=status.textContent;
    stage.dispatchEvent(new KeyboardEvent('keydown',{
      key:'+',ctrlKey:true,bubbles:true,cancelable:true
    }));
    return {before,after:status.textContent,within:scroller.contains(stage)};
  });
  expect(result.within).toBe(true);
  expect(result.before).toBe('100%');
  expect(result.after).toBe('120%');
});
test('Ctrl/Cmd zoom shortcut changes only the focused linked canvas',async({page})=>{
  await boot(page,1280);
  const result=await page.evaluate(()=>{
    const outside=document.createElement('button');outside.textContent='External tool';
    document.body.append(outside);
    const stage=document.getElementById('nm-view-stage');
    const status=document.getElementById('nm-view-zoom-status');
    const before=status.textContent;
    const fire=(target,keys)=>{
      const event=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,
        key:'+',...keys});
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const unrelatedCtrl=fire(outside,{ctrlKey:true});
    const unrelatedCmd=fire(outside,{metaKey:true});
    const unchanged=status.textContent===before;
    const inside=fire(stage,{ctrlKey:true});
    const changed=status.textContent!==before;
    outside.remove();
    return {unrelatedCtrl,unrelatedCmd,unchanged,inside,changed};
  });
  expect(result).toEqual({unrelatedCtrl:true,unrelatedCmd:true,
    unchanged:true,inside:true,changed:true});
});
test('Ctrl/Cmd keyboard zoom does not hijack decision modal or select',async({page})=>{
 await boot(page,1280);
 const result=await page.evaluate(()=>{
   const stage=document.getElementById('nm-view-stage');
   const status=document.getElementById('nm-view-zoom-status');
   const picker=document.createElement('select');
   const modal=document.createElement('div');modal.id='nm-decision-overlay';
   stage.append(picker,modal);
   const before=status.textContent;
   const fire=(target,keys)=>{
     const event=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'+',...keys});
     target.dispatchEvent(event);return event.defaultPrevented;
   };
   const pickerCtrl=fire(picker,{ctrlKey:true});
   const modalCmd=fire(modal,{metaKey:true});
   const unchanged=status.textContent===before;
   picker.remove();modal.remove();
   return {pickerCtrl,modalCmd,unchanged};
 });
 expect(result).toEqual({pickerCtrl:true,modalCmd:true,unchanged:true});
});
test('Ctrl/Cmd-wheel on unrelated panels or text inputs does not get swallowed',async({page})=>{
  await boot(page,1280);
  const result=await page.evaluate(()=>{
    const stage=document.getElementById('nm-view-stage');
    const outside=document.createElement('button');
    outside.textContent='Other tool';
    document.body.append(outside);
    const field=document.createElement('input');
    stage.append(field);
    const status=document.getElementById('nm-view-zoom-status');
    const before=status.textContent;
    const fire=(target,keys)=>{
      const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,
        deltaY:-100,clientX:250,clientY:150,...keys});
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const outsideCtrl=fire(outside,{ctrlKey:true});
    const outsideCmd=fire(outside,{metaKey:true});
    const inputCtrl=fire(field,{ctrlKey:true});
    const unchanged=status.textContent===before;
    const insideCtrl=fire(stage,{ctrlKey:true});
    const zoomed=status.textContent!==before;
    field.remove();outside.remove();
    return {outsideCtrl,outsideCmd,inputCtrl,unchanged,insideCtrl,zoomed};
  });
  expect(result).toEqual({outsideCtrl:false,outsideCmd:false,
    inputCtrl:false,unchanged:true,insideCtrl:true,zoomed:true});
});

test('WebKit gesturechange on another panel does not zoom the linked view',async({page})=>{
 await boot(page,1280);
 const outcome=await page.evaluate(()=>{
   const stage=document.getElementById('nm-view-stage');
   const status=document.getElementById('nm-view-zoom-status');
   const outside=document.createElement('button');document.body.append(outside);
   const fire=(type,target,scale)=>{
     const event=new Event(type,{bubbles:true,cancelable:true});
     Object.defineProperty(event,'scale',{value:scale});
     target.dispatchEvent(event);
     return event.defaultPrevented;
   };
   const start=fire('gesturestart',stage,1),before=status.textContent;
   const externalChange=fire('gesturechange',outside,1.6);
   const unchanged=status.textContent===before;
   const externalEnd=fire('gestureend',outside,1.6);
   const restart=fire('gesturestart',stage,1);
   const internalChange=fire('gesturechange',stage,1.3);
   const changed=status.textContent!==before;
   fire('gestureend',stage,1.3);outside.remove();
   return {start,externalChange,unchanged,externalEnd,restart,internalChange,changed};
 });
 expect(outcome).toEqual({start:true,externalChange:false,unchanged:true,
   externalEnd:false,restart:true,internalChange:true,changed:true});
});
test('WebKit gestureend outside linked view is not swallowed after canvas pinch',async({page})=>{
 await boot(page,1280);
 const outcome=await page.evaluate(()=>{
   const stage=document.getElementById('nm-view-stage');
   const outside=document.createElement('button');document.body.append(outside);
   const fire=(type,target,scale)=>{
     const event=new Event(type,{bubbles:true,cancelable:true});
     Object.defineProperty(event,'scale',{value:scale});
     target.dispatchEvent(event);
     return event.defaultPrevented;
   };
   const start=fire('gesturestart',stage,1);
   const externalEnd=fire('gestureend',outside,1.2);
   const nextStart=fire('gesturestart',stage,1);
   const insideEnd=fire('gestureend',stage,1);
   outside.remove();
   return {start,externalEnd,nextStart,insideEnd};
 });
 expect(outcome).toEqual({start:true,externalEnd:false,nextStart:true,insideEnd:true});
});
test('late WebKit gestureend after closing a view never locks subsequent zoom',async({page})=>{
  await boot(page,1280);
  const output=await page.evaluate(async()=>{
    const stage=document.getElementById('nm-view-stage'),app=window.neuroMapApp;
    const gesture=(type,scale)=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,'scale',{value:scale});
      stage.dispatchEvent(event);
    };
    gesture('gesturestart',1);
    window.NeuroMapLinkedViews.setMode(app,'mindmap');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    gesture('gestureend',1.3); // emitted after the view was removed
    window.NeuroMapLinkedViews.setMode(app,'orgchart');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const before=document.getElementById('nm-view-zoom-status').textContent;
    stage.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,
      ctrlKey:true,deltaY:-110,deltaMode:0,clientX:280,clientY:240}));
    const after=document.getElementById('nm-view-zoom-status').textContent;
    return {before,after};
  });
  expect(output.after).not.toBe(output.before);
});
test('switching linked views closes open flyouts and keeps the canvas available',async({page})=>{
  await boot(page,1280);
  await page.locator('#nm-view-appearance > summary').click();
  await expect(page.locator('#nm-view-appearance')).toHaveAttribute('open','');
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'kanban'));
  await expect(page.locator('#nm-view-appearance')).not.toHaveAttribute('open','');
  await expect(page.locator('#nm-view-scroller')).toBeVisible();
  await page.locator('#nm-view-export-menu > summary').click();
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'timeline'));
  await expect(page.locator('#nm-view-export-menu')).not.toHaveAttribute('open','');
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'mindmap'));
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
});
test('opening linked view releases competing side panels through the workspace coordinator',async({page})=>{
  await boot(page,1280);
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'mindmap'));
  await page.locator('#btn-toggle-inspector').click();
  const inspector=page.locator('#inspector-sidebar');
  await expect(inspector).toBeVisible();
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'concept-tree'));
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(inspector).not.toBeVisible();
});

test('requesting inspector while a linked view is active leaves exactly one panel visible',async({page})=>{
  await boot(page,1280);
  await page.evaluate(()=>document.getElementById('btn-toggle-inspector').click());
  const overlay=page.locator('#nm-view-overlay'),inspector=page.locator('#inspector-sidebar');
  await expect(inspector).toBeVisible();
  await expect(overlay).toBeHidden();
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.viewMode)).toBe('mindmap');
});
test('opening another tool after a dual view closes both linked panes safely',async({page})=>{
  await boot(page,1280);
  await page.locator('#nm-view-split').click();
  await expect(page.locator('#nm-dual-pane')).toBeVisible();
  await page.evaluate(()=>document.getElementById('btn-toggle-inspector').click());
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  await expect(page.locator('#inspector-sidebar')).toBeVisible();
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.viewMode)).toBe('mindmap');
});

test('compact split Kanban keeps task label, add button, status and date in separate lanes',async({page})=>{
  await boot(page,1440);
  const taskId=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    // Use the canonical importer so the task has a real parent and generated ID.
    app.importHierarchy({
      text:'Compact-view verification',
      children:[{text:'A long task title that should remain accessible when visually shortened',
        children:[]}]
    },{newTab:true});
    const node=app.state.root.children[0];
    node.taskStatus='todo';node.startDate='2026-11-01';node.dueDate='2026-11-04';
    app.recalculateAndRender();
    window.NeuroMapLinkedViews.setMode(app,'orgchart');
    return node.id;
  });
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('kanban');
  const card=page.locator('#nm-dual-stage .nm-kanban-card[data-node-id="'+taskId+'"]');
  await expect(card).toBeVisible();
  await expect(card.locator('select')).toBeVisible();
  await expect(card.locator('.nm-view-title')).toBeVisible();
  // WebKit's automation quads can be empty for a line-clamped span even
  // though it paints correctly. Measure its actual DOM rectangle.
  const [title,add,select,date]=await card.evaluate(e=>['.nm-view-title','.nm-view-add','select','.nm-kanban-date'].map(selector=>e.querySelector(selector).getBoundingClientRect().toJSON()));
  for(const rect of [title,add,select,date]){expect(rect.width).toBeGreaterThan(0);expect(rect.height).toBeGreaterThan(0)}
  const crosses=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  expect(crosses(title,select)).toBe(false);
  expect(crosses(add,select)).toBe(false);
  expect(crosses(select,date)).toBe(false);
  await expect(card.locator('.nm-view-title')).toHaveAttribute('title',/A long task title/);
});

test('short mobile split offers scrollable access to both diagrams without compressed toolbars',async({page})=>{
  await boot(page,720,480);
  await page.locator('#nm-view-split').click();
  const panels=page.locator('#nm-linked-panels'),primary=page.locator('#nm-view-scroller');
  const secondary=page.locator('#nm-dual-pane');
  await expect(secondary).toBeVisible();
  const geometry=await page.evaluate(()=>{
    const panels=document.getElementById('nm-linked-panels');
    const first=document.getElementById('nm-view-scroller');
    const second=document.getElementById('nm-dual-pane');
    return {
      overflow:getComputedStyle(panels).overflowY,
      primaryHeight:first.getBoundingClientRect().height,
      secondaryHeight:second.getBoundingClientRect().height,
      scrollDistance:panels.scrollHeight-panels.clientHeight
    };
  });
  expect(geometry.overflow).toBe('auto');
  expect(geometry.primaryHeight).toBeGreaterThanOrEqual(198);
  expect(geometry.secondaryHeight).toBeGreaterThanOrEqual(218);
  expect(geometry.scrollDistance).toBeGreaterThan(0);
  await panels.evaluate(el=>{el.scrollTop=el.scrollHeight});
  await expect(secondary.locator('#nm-dual-scroller')).toBeVisible();
  await expect(primary).toHaveCount(1);
});


for(const width of [720,1280])test('saved layout flyout stays contained and exclusive at '+width+'px',async({page})=>{
  await boot(page,width);
  const overlay=page.locator('#nm-view-overlay'),header=overlay.locator('.nm-view-header');
  const before=await header.boundingBox();
  const layout=page.locator('#nm-project-view-options');
  await layout.locator('summary').first().click();
  await expect(layout).toHaveAttribute('open','');
  const popup=page.locator('#nm-workspace-controls');
  await expect(popup).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  // WebKit's protocol visibility/quads can be stale inside a scrolled
  // details flyout. Require real painted geometry AND pointer reachability.
  const select=page.locator('#nm-workspace-layouts');
  await expect.poll(()=>select.evaluate(e=>{
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.visibility==='visible'&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;
  })).toBe(true);
  const h=await header.boundingBox(),o=await overlay.boundingBox(),p=await popup.boundingBox();
  expect(h.height).toBeLessThanOrEqual(before.height+4);
  expect(p.x).toBeGreaterThanOrEqual(o.x-1);
  expect(p.x+p.width).toBeLessThanOrEqual(o.x+o.width+1);
  expect(p.y+p.height).toBeLessThanOrEqual(o.y+o.height+1);
  await page.locator('#nm-view-appearance > summary').click();
  await expect(layout).not.toHaveAttribute('open','');
  await expect(page.locator('#nm-view-appearance')).toHaveAttribute('open','');
  await page.keyboard.press('Escape');
  await expect(page.locator('#nm-view-appearance')).not.toHaveAttribute('open','');
  await expect(overlay).toBeVisible();
});


for(const width of [720,960,1280])test('opened flyouts receive pointer events outside the scrolling header at '+width+'px',async({page})=>{
  await boot(page,width,800);
  // Bounding boxes alone cannot detect clipping by header overflow/z-index.
  const views=[
    ['#nm-view-appearance > summary','#nm-view-appearance .nm-appearance-fields'],
    ['#nm-view-export-menu > summary','#nm-view-export-actions'],
    ['#nm-project-view-options > summary','#nm-workspace-controls'],
  ];
  for(const [summary,popup] of views){
    await page.locator(summary).click();
    await expect(page.locator(popup)).toBeVisible();
    const hit=await page.locator(popup).evaluate(element=>{
      const rect=element.getBoundingClientRect();
      const x=Math.min(innerWidth-1,Math.max(0,rect.left+Math.min(20,rect.width/2)));
      const y=Math.min(innerHeight-1,Math.max(0,rect.top+Math.min(20,rect.height/2)));
      return {
        inViewport:rect.width>30&&rect.height>20&&rect.top>=0&&rect.bottom<=innerHeight+1,
        hit:element.contains(document.elementFromPoint(x,y)),
        x,y,top:rect.top,bottom:rect.bottom,
      };
    });
    expect(hit.inViewport,'flyout must remain inside the viewport: '+popup).toBe(true);
    expect(hit.hit,'scrolling toolbar must not clip or cover '+popup).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator(popup)).toBeHidden();
  }
});

// S3b release checks: run against the real app canvas in Chromium AND WebKit.
// These fixtures do not assume that a pure geometry unit test proves the UI.
test('large flat organigram projects into a bounded live canvas without extra hierarchy',async({page})=>{
  await boot(page,1280);
  const expected=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    app.state.root.children=Array.from({length:100},(_,i)=>({
      id:'flat-report-'+i,parentId:app.state.root.id,
      text:'Collaboratore '+i,children:[]
    }));
    app.state.relationships=[];
    app.markChanged();
    window.NeuroMapLinkedViews.refresh(app);
    return JSON.stringify(app.state.root.children);
  });
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(101);
  const vertical=await page.evaluate(()=>{
    const app=window.neuroMapApp,core=window.NeuroMapViewCore;
    const original=JSON.stringify(app.state.root.children);
    const layout=core.project(app.state.root,'orgchart');
    const byId=new Map(layout.nodes.map(n=>[n.id,n]));
    return {width:layout.width,height:layout.height,
      nodes:layout.nodes.length,edges:layout.edges.length,
      direct:layout.nodes.slice(1).every(n=>n.depth===1&&n.parentId===app.state.root.id),
      path:core.path(byId.get(app.state.root.id),byId.get('flat-report-99'),'orgchart'),
      unchanged:JSON.stringify(app.state.root.children)===original};
  });
  expect(vertical.width).toBeLessThan(5000);
  expect(vertical.height).toBeLessThan(5000);
  expect(vertical.nodes).toBe(101);
  expect(vertical.edges).toBe(100);
  expect(vertical.direct).toBe(true);
  expect(vertical.path).toContain(' V');
  expect(vertical.unchanged).toBe(true);
  await page.evaluate(()=>{
    const app=window.neuroMapApp;
    app.state.root.viewAppearance=window.NeuroMapViewAppearance.update(
      app.state.root.viewAppearance,'orgchart',{orientation:'horizontal'});
    window.NeuroMapLinkedViews.refresh(app);
  });
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(101);
  const horizontal=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    return window.NeuroMapViewCore.project(app.state.root,'orgchart',
      {orientation:'horizontal'});
  });
  expect(horizontal.orientation).toBe('horizontal');
  expect(horizontal.width).toBeLessThan(5000);
  expect(horizontal.height).toBeLessThan(5000);
  expect(horizontal.edges).toHaveLength(100);
  expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root.children)))
    .toBe(expected);
});

test('grouped conceptual tree renders 500 leaves with intact sections and SVG connectors',async({page})=>{
  await boot(page,1280);
  const before=await page.evaluate(()=>{
    const app=window.neuroMapApp,id=app.state.root.id;
    app.state.root.children=Array.from({length:25},(_,g)=>({
      id:'taxonomy-section-'+g,parentId:id,text:'Sezione '+g,
      children:Array.from({length:20},(_,i)=>({
        id:'taxonomy-leaf-'+g+'-'+i,parentId:'taxonomy-section-'+g,
        text:'Concetto '+i,children:[]
      }))
    }));
    app.state.relationships=[];
    app.markChanged();
    window.NeuroMapLinkedViews.setMode(app,'concept-tree');
    return JSON.stringify(app.state.root.children);
  });
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(526);
  await expect(page.locator('#nm-view-lines > path')).toHaveCount(525);
  const geometry=await page.evaluate(()=>{
    const app=window.neuroMapApp,view=window.NeuroMapViewCore;
    const layout=view.project(app.state.root,'concept-tree');
    const by=new Map(layout.nodes.map(n=>[n.id,n]));
    const root=by.get(app.state.root.id);
    return {width:layout.width,height:layout.height,
      nodes:layout.nodes.length,edges:layout.edges.length,
      groups:app.state.root.children.every(n=>n.children.length===20),
      rootLinks:app.state.root.children.every(n=>
        view.path(root,by.get(n.id),'concept-tree').startsWith('M')),
      source:JSON.stringify(app.state.root.children)};
  });
  expect(geometry.nodes).toBe(526);
  expect(geometry.edges).toBe(525);
  expect(geometry.width).toBeLessThan(5000);
  expect(geometry.height).toBeLessThan(8000);
  expect(geometry.width*geometry.height).toBeLessThanOrEqual(24e6);
  expect(geometry.groups).toBe(true);
  expect(geometry.rootLinks).toBe(true);
  expect(geometry.source).toBe(before);
});

