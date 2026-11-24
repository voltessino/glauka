const composeStateSource=require('./helpers/compose-state-source.cjs');
// Shared Windows/macOS editor: regression and 1,000 deterministic virtual-user scenarios.
// These are source-level tests, not 1,000 actual people or native UI sessions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../../map-core');

// state.js is concatenated into a single desktop editor lexical scope in production.
// Compile the complete production source with only its constructor-time dependencies.
const source = composeStateSource('desktop-shared');
const MindMapStateMachine = new Function(
  'NeuroMapCore', 'nm70PreferredGap', 'localStorage',
  'HARMONIC_PALETTE', 'ColorUtils', 'THEME_PALETTES',
  source + '\nreturn MindMapStateMachine;'
)(
  Core, () => 150, {getItem: () => null},
  ['#6366f1', '#06b6d4', '#fb7185'], {lighten: color => color}, {}
);

function node(id, parentId = null, collapsed = false) {
  return {id, text: 'Nodo '+id, parentId, side: parentId ? 'right' : 'root',
    collapsed, children: []};
}
function state() {
  const s = new MindMapStateMachine();
  // Give each virtual user deterministic unique IDs when edits create nodes.
  let sequence = 0;
  s.generateId = prefix => (prefix || 'node') + '-test-' + ++sequence;
  return s;
}
function sample(seed = 0, nested = 2, extras = 1) {
  const s = state();
  const r = node('root-'+seed);
  const closed = node('closed-'+seed, r.id, true);
  let current = closed;
  for (let i = 0; i < nested; i++) {
    const next = node('hidden-'+seed+'-'+i, current.id, i % 3 === 0);
    current.children.push(next);
    current = next;
  }
  const hiddenLeaf = current;
  const doomed = node('doomed-'+seed, r.id);
  const removed = node('removed-'+seed, doomed.id);
  doomed.children.push(removed);
  for (let i = 0; i < extras; i++) {
    const extra = node('removed-extra-'+seed+'-'+i, doomed.id);
    doomed.children.push(extra);
  }
  const other = node('other-'+seed, r.id, seed%2===0);
  other.children = [node('other-hidden-'+seed, other.id)];
  const summary = node('summary-'+seed, r.id);
  summary.isSummary = true;
  summary.summaryTargetIds = [hiddenLeaf.id, removed.id];
  r.children = [closed, doomed, other, summary];
  s.root = r;
  s.selectedNodeId = r.id;
  s.selectedNodeIds = [r.id];
  s.images = [
    {id:'keep-img-'+seed, src:'data:image/png;base64,AAAA', mode:'attached', attachedNodeId:hiddenLeaf.id},
    {id:'remove-img-'+seed, src:'data:image/png;base64,AAAA', mode:'attached', attachedNodeId:removed.id},
    {id:'free-img-'+seed, src:'data:image/png;base64,AAAA', mode:'free'}
  ];
  s.relationships = [
    {id:'keep-rel-'+seed, fromId:r.id, toId:hiddenLeaf.id, label:'Resta'},
    {id:'remove-rel-'+seed, fromId:r.id, toId:removed.id, label:'Elimina'}
  ];
  return {s, r, closed, hiddenLeaf, doomed, removed, other, summary};
}

test('deleting an unrelated branch preserves images and relationships in collapsed branches', () => {
  const {s, closed, hiddenLeaf, doomed} = sample();
  assert.equal(s.getAllNodes().some(n => n.id === hiddenLeaf.id), false);
  assert.equal(s.deleteNode(doomed.id), true);
  assert.equal(closed.collapsed, true);
  assert.deepEqual(s.images.map(x=>x.id).sort(), ['free-img-0','keep-img-0']);
  assert.deepEqual(s.relationships.map(x=>x.id), ['keep-rel-0']);
  assert.equal(s.findNode(hiddenLeaf.id)?.id, hiddenLeaf.id);
});

test('only references belonging to the truly deleted subtree are removed', () => {
  const {s, hiddenLeaf, doomed, summary} = sample(7, 4, 3);
  assert.equal(s.deleteNode(doomed.id), true);
  assert.deepEqual(summary.summaryTargetIds, [hiddenLeaf.id]);
  assert.equal(s.images.some(i=>i.attachedNodeId==='removed-7'), false);
  assert.equal(s.relationships.some(r=>r.toId==='removed-7'), false);
  assert.equal(s.images.some(i=>i.attachedNodeId===hiddenLeaf.id), true);
});

test('deleting inside a closed branch cleans its references without affecting hidden siblings', () => {
  const {s, other, hiddenLeaf} = sample(11, 3, 2);
  assert.equal(s.deleteNode(hiddenLeaf.id), true);
  assert.equal(s.findNode(hiddenLeaf.id), null);
  assert.equal(s.images.some(i=>i.attachedNodeId===hiddenLeaf.id), false);
  assert.equal(s.relationships.some(r=>r.toId===hiddenLeaf.id), false);
  assert.equal(s.findNode(other.children[0].id)?.id, other.children[0].id);
});

test('Undo and Redo restore complete snapshots including attached metadata', () => {
  const {s, doomed} = sample(42, 6, 5);
  const before = JSON.stringify(s.createSnapshot());
  s.deleteNode(doomed.id);
  const after = JSON.stringify(s.createSnapshot());
  assert.notEqual(before, after);
  assert.equal(s.undo(), true);
  assert.equal(JSON.stringify(s.createSnapshot()), before);
  assert.equal(s.redo(), true);
  assert.equal(JSON.stringify(s.createSnapshot()), after);
});

test('1,000 independent seeded edit/delete/undo/redo/serialization workflows', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const {s, hiddenLeaf, doomed, summary, closed} = sample(seed, 2 + seed%9, 1 + seed%7);
    const start = JSON.stringify(s.createSnapshot());
    assert.equal(s.updateNodeText(hiddenLeaf.id, 'Modificato '+seed), true);
    const edited = JSON.stringify(s.createSnapshot());
    assert.equal(s.deleteNode(doomed.id), true, 'delete seed='+seed);
    const deleted = JSON.stringify(s.createSnapshot());
    assert.equal(closed.collapsed, true, 'closed remains collapsed seed='+seed);
    assert.deepEqual(s.images.map(i=>i.id).sort(),
      ['free-img-'+seed,'keep-img-'+seed].sort(), 'attachments seed='+seed);
    assert.deepEqual(s.relationships.map(r=>r.id), ['keep-rel-'+seed], 'links seed='+seed);
    assert.deepEqual(summary.summaryTargetIds, [hiddenLeaf.id], 'summaries seed='+seed);
    const copy = MindMapStateMachine.cloneTree(s.root);
    assert.equal(Core.validateWorkspaceTabs([{root:copy, images:s.images, relationships:s.relationships}]) > 0, true);
    assert.equal(s.undo(), true);
    assert.equal(JSON.stringify(s.createSnapshot()), edited, 'undo seed='+seed);
    assert.equal(s.redo(), true);
    assert.equal(JSON.stringify(s.createSnapshot()), deleted, 'redo seed='+seed);
    assert.equal(s.undo(), true);
    assert.equal(s.undo(), true);
    assert.equal(JSON.stringify(s.createSnapshot()), start, 'undo initial seed='+seed);
  }
});

test('near-3,500-node collapsed map preserves attachments without excessive recursion', () => {
  const {s, closed, doomed} = sample(9999, 1, 0);
  const extraCount = 3489;
  for (let i=0; i<extraCount; i++) closed.children.push(node('wide-'+i,closed.id));
  const last=closed.children[closed.children.length-1];
  s.images.push({id:'wide-image',src:'data:image/png;base64,AAAA',mode:'attached',attachedNodeId:last.id});
  s.relationships.push({id:'wide-link',fromId:s.root.id,toId:last.id,label:'Large'});
  assert.equal(Core.validateWorkspaceTabs([{root:s.root}]) <= 3500, true);
  assert.equal(s.deleteNode(doomed.id), true);
  assert.equal(s.images.some(i=>i.id==='wide-image'), true);
  assert.equal(s.relationships.some(r=>r.id==='wide-link'), true);
  assert.equal(s.undo(), true);
  assert.equal(s.findNode(doomed.id)?.id, doomed.id);
});


const composeAppSource=require('./helpers/compose-app-source.cjs');
const appSource = composeAppSource('desktop-shared');
const NeuroMapApp = new Function('MindMapStateMachine', appSource + '\nreturn NeuroMapApp;')(MindMapStateMachine);
// This source-level regression follows the extraction, preserving the runtime order.
const navigationStudySource = fs.readFileSync(path.join(__dirname, '../../../apps/desktop-shared/editor/navigation-ai-actions.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '../../../apps/desktop-shared/editor/navigation-study.js'), 'utf8');
function appFor(s) {
  const app = Object.create(NeuroMapApp.prototype);
  const toasts = [];
  app.state = s;
  app.closeEditor = () => {};
  app.markChanged = () => {};
  app.showToast = message => toasts.push(message);
  return {app, toasts};
}

test('logical traversal includes collapsed descendants without changing the visible selection API', () => {
  const {s, hiddenLeaf} = sample(303, 5, 2);
  assert.equal(s.getAllNodes().some(n=>n.id===hiddenLeaf.id), false);
  assert.equal(s.getAllNodesIncludingCollapsed().some(n=>n.id===hiddenLeaf.id), true);
  assert.equal(s.getAllNodesIncludingCollapsed().length, 8 + 4 + 2); // 8 baseline, four extra descendants, two doomed extras
});

test('Windows Delete/multi-selection preserves attachments and links in unrelated closed branches', () => {
  const {s, hiddenLeaf, doomed, summary} = sample(304, 3, 2);
  s.selectedNodeId=doomed.id;
  s.selectedNodeIds=[doomed.id];
  const before=JSON.stringify(s.createSnapshot());
  const {app}=appFor(s);
  app.deleteSelected();
  assert.equal(s.findNode(doomed.id), null);
  assert.deepEqual(s.images.map(i=>i.id).sort(), ['free-img-304','keep-img-304']);
  assert.deepEqual(s.relationships.map(r=>r.id), ['keep-rel-304']);
  assert.deepEqual(summary.summaryTargetIds, [hiddenLeaf.id]);
  assert.equal(s.undo(), true);
  assert.equal(JSON.stringify(s.createSnapshot()), before);
});

test('paste refuses 3,500-node overflow even if most existing nodes are collapsed', () => {
  const {s, closed} = sample(305, 1, 1);
  for(let i=0;i<3480;i++)closed.children.push(node('extra-'+i,closed.id));
  const original = s.getAllNodesIncludingCollapsed().length;
  assert.equal(original < 3500, true);
  assert.equal(s.getAllNodes().length < 20, true);
  const copied = {kind:'nodes',nodes:[{id:'copy-root',text:'Copy',children:Array.from({length:25},(_,i)=>({id:'copy-'+i,text:'Child',children:[]}))}]};
  s.selectedNodeId=s.root.id;
  s.selectedNodeIds=[s.root.id];
  const {app,toasts}=appFor(s);
  app.pasteSelection(copied);
  assert.equal(s.getAllNodesIncludingCollapsed().length, original);
  assert.equal(s.undoStack.length, 0);
  assert.equal(toasts.some(x=>x.includes('3500')), true);
});

test('AI branch generation checks the same full logical node count', () => {
  assert.match(navigationStudySource, /getAllNodesIncludingCollapsed\(\)\.length\+total>3500/);
});


test('1,000 independent multi-select Delete and Undo scenarios preserve hidden data', () => {
  for (let seed=0; seed<1000; seed++) {
    const {s,hiddenLeaf,doomed,summary} = sample(seed + 20000, 2 + seed%7, 1 + seed%4);
    s.selectedNodeId=doomed.id;
    s.selectedNodeIds=[doomed.id,summary.id];
    const before=JSON.stringify(s.createSnapshot());
    const {app}=appFor(s);
    app.deleteSelected();
    assert.equal(s.findNode(doomed.id),null,'removed targeted subtree seed='+seed);
    assert.equal(s.findNode(summary.id),null,'removed targeted summary seed='+seed);
    assert.equal(s.findNode(hiddenLeaf.id)?.id,hiddenLeaf.id,'hidden logical node seed='+seed);
    assert.deepEqual(s.images.map(i=>i.id).sort(),
      ['free-img-'+(seed+20000),'keep-img-'+(seed+20000)].sort(),'images seed='+seed);
    assert.deepEqual(s.relationships.map(r=>r.id),
      ['keep-rel-'+(seed+20000)],'relationships seed='+seed);
    assert.equal(s.undo(),true);
    assert.equal(JSON.stringify(s.createSnapshot()),before,'Undo seed='+seed);
  }
});
