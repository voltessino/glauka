const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { coordinator, placeListMenu } = require("../workspace-layout.js");
test("switch is transactional: a draft blocks before any other panel is closed", () => {
  const c = coordinator();
  let first = true,
    draft = true,
    focused = 0;
  c.register("first", { isOpen: () => first, close: () => (first = false) });
  c.register("draft", {
    isOpen: () => draft,
    canLeave: () => false,
    close: () => (draft = false),
    focus: () => focused++,
  });
  assert.equal(c.claim("next"), false);
  assert.equal(first, true);
  assert.equal(draft, true);
  assert.equal(focused, 1);
});
test("switch closes an inspector restored by a study session without losing the target", () => {
  const c = coordinator();
  let inspector = false,
    study = true,
    target = true;
  c.register("inspector", {
    isOpen: () => inspector,
    close: () => (inspector = false),
  });
  c.register("study", {
    isOpen: () => study,
    close: () => {
      study = false;
      inspector = true;
    },
  });
  c.register("target", { isOpen: () => target, close: () => (target = false) });
  assert.equal(c.claim("target"), true);
  assert.deepEqual(
    { inspector, study, target },
    { inspector: false, study: false, target: true },
  );
});
test("a recording is left running when a panel switch is rejected", () => {
  const c = coordinator();
  let recording = true,
    closed = false;
  c.register("ai", {
    // A closed panel must report closed; otherwise the coordinator correctly
    // refuses to claim that the panel switch succeeded.
    isOpen: () => !closed,
    canLeave: () => !recording,
    close: () => (closed = true),
  });
  assert.equal(c.claim("inspector"), false);
  assert.equal(closed, false);
  recording = false;
  assert.equal(c.claim("inspector"), true);
  assert.equal(closed, true);
});

test("a draft reopened during a cascading close is protected and focused", () => {
  const c = coordinator();
  let first = true, draft = false, target = true, focused = 0, canLeave = false;
  c.register("first", { isOpen: () => first, close() { first = false; draft = true; } });
  c.register("draft", {
    isOpen: () => draft, canLeave: () => canLeave,
    close() { draft = false; }, focus() { focused++; },
  });
  c.register("target", { isOpen: () => target, close() { target = false; } });
  assert.equal(c.claim("target"), false);
  assert.equal(first, false);
  assert.equal(draft, true, "protected draft must remain open");
  assert.equal(target, true);
  assert.equal(focused, 1);
  canLeave = true;
  assert.equal(c.claim("target"), true);
  assert.equal(draft, false);
});
test("a panel that refuses to close cannot cause a false successful claim", () => {
  const c = coordinator();
  let attempts = 0;
  c.register("stuck", { isOpen: () => true, close() { attempts++; } });
  assert.equal(c.claim("new-panel"), false);
  assert.ok(attempts > 0 && attempts <= 2);
});

test("linked view closes before another inspector opens, without retaining a ghost overlay",()=>{
 const c=coordinator();
 let linkedOpen=true,inspectorOpen=false,closeCount=0;
 c.register("linked-view",{isOpen:()=>linkedOpen,close(){linkedOpen=false;closeCount++}});
 c.register("inspector",{isOpen:()=>inspectorOpen,close(){inspectorOpen=false}});
 assert.equal(c.claim("inspector"),true);
 inspectorOpen=true;
 assert.equal(linkedOpen,false);
 assert.equal(closeCount,1);
 assert.equal(c.claim("linked-view"),true);
 assert.equal(inspectorOpen,false);
});
test("blocked draft prevents switching to linked view without closing another panel",()=>{
 const c=coordinator();
 let layout=true,dirty=true,focusCount=0,closes=0;
 c.register("layout",{isOpen:()=>layout,close(){layout=false;closes++}});
 c.register("protected",{isOpen:()=>dirty,canLeave:()=>false,focus(){focusCount++},close(){dirty=false}});
 assert.equal(c.claim("linked-view"),false);
 assert.equal(layout,true);
 assert.equal(closes,0);
 assert.equal(focusCount,1);
});

test("Word-style list menu opens above a trigger near the viewport foot",()=>{
  const anchor={left:970,right:1090,top:690,bottom:730};
  const place=placeListMenu(anchor,190,{width:1100,height:780});
  assert.equal(place.side,"above");
  assert.ok(place.top+place.maxHeight<=anchor.top-5,"popup cannot cover its trigger");
  assert.ok(place.left+place.width<=1092);
  assert.ok(place.left>=8);
  assert.equal(place.maxHeight,190);
});
test("list menu stays below upper controls and clamps near screen edges",()=>{
  const top=placeListMenu({left:-40,right:25,top:20,bottom:55},190,
    {width:320,height:568});
  assert.equal(top.side,"below");
  assert.equal(top.left,8);
  assert.equal(top.width,240);
  assert.equal(top.top,60);
  const edge=placeListMenu({left:310,right:360,top:20,bottom:55},190,
    {width:320,height:568});
  assert.equal(edge.left,72,"horizontal clamp keeps popup within viewport");
  assert.ok(edge.left+edge.width<=312);
});
test("list menu remains scrollable on short viewports without overlapping trigger",()=>{
  const anchor={left:90,right:180,top:125,bottom:165};
  const place=placeListMenu(anchor,190,{width:280,height:250});
  assert.equal(place.side,"above","use larger free area");
  assert.ok(place.maxHeight<=112,"short viewport must cap menu scroll area");
  assert.ok(place.top+place.maxHeight<=anchor.top-5);
  const narrow=placeListMenu({left:3,right:20,top:5,bottom:35},160,
    {width:160,height:280});
  assert.equal(narrow.width,144);
  assert.ok(narrow.left+narrow.width<=152);
});
