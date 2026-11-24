'use strict';
const composeStateSource = require('./helpers/compose-state-source.cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const work = require('../work-core');

const identity = state => {
  const rows = [];
  const walk = (node, parentId) => {
    rows.push({id: node.id, text: node.text, color: node.color || '', parentId});
    for (const child of node.children || []) walk(child, node.id);
  };
  walk(state.root, null);
  return rows;
};

const modes = ['orgchart', 'concept-tree', 'concept-network', 'flowchart', 'kanban', 'timeline', 'mindmap'];

for (const platform of ['desktop-shared', 'android']) {
  const source = composeStateSource(platform);
  const State = new Function('NeuroMapWorkCore', 'nm70PreferredGap', 'nm64PreferredWrap',
    source + '\nreturn MindMapStateMachine;')(work, () => 150, () => 48);

  test(platform + ': view history and metadata undo keep ids, text and #6441df', () => {
    const state = new State();
    state.root = {
      id: 'map-root', text: 'Mappa Centrale', color: '#6441df', side: 'root', children: [
        {id: 'branch-a', text: '1. Strategia e Visione', color: '#6441df', parentId: 'map-root', children: []},
        {id: 'branch-b', text: 'Obiettivi Q4', color: '#0ea5e9', parentId: 'map-root', children: []}
      ]
    };
    const before = identity(state);
    const saved = JSON.stringify(State.cloneTree(state.root));
    for (const mode of modes) {
      state.pushHistory();
      state.root.viewMode = mode;
    }
    assert.equal(state.undoStack.length, modes.length);
    assert.deepEqual(identity(state), before);
    assert.equal(state.root.text, 'Mappa Centrale');
    assert.equal(state.root.color, '#6441df');
    for (let i = 0; i < modes.length; i++) assert.equal(state.undo(), true);
    assert.equal(state.root.viewMode, undefined);
    assert.equal(state.undoStack.length, 0);
    assert.deepEqual(identity(state), before);
    assert.equal(JSON.stringify(State.cloneTree(state.root)), saved);
    for (let i = 0; i < modes.length; i++) assert.equal(state.redo(), true);
    // The snapshot keeps the six linked views and stores the map view as absent.
    assert.equal(state.root.viewMode, undefined);
    assert.equal(State.cloneTree(state.root).viewMode, undefined);
    assert.deepEqual(identity(state), before);
    assert.equal(state.undo(), true);
    assert.equal(state.root.viewMode, 'timeline');
    assert.deepEqual(identity(state), before);
    state.redo();
    for (let i = 0; i < modes.length; i++) state.undo();
    assert.equal(state.setNodeWorkMetadata('branch-a', {
      taskStatus: 'doing', startDate: '2026-11-01', dueDate: '2026-11-10'
    }), true);
    assert.equal(state.undoStack.length, 1);
    assert.equal(state.findNode('branch-a').taskStatus, 'doing');
    assert.deepEqual(identity(state), before);
    assert.equal(state.undo(), true);
    assert.equal(state.findNode('branch-a').taskStatus, undefined);
    assert.equal(state.findNode('branch-a').text, '1. Strategia e Visione');
    assert.equal(state.root.color, '#6441df');
    assert.equal(state.redo(), true);
    assert.equal(state.findNode('branch-a').dueDate, '2026-11-10');
    const round = JSON.parse(JSON.stringify(State.cloneTree(state.root)));
    assert.equal(round.id, 'map-root');
    assert.equal(round.text, 'Mappa Centrale');
    assert.equal(round.color, '#6441df');
    assert.equal(round.children[0].id, 'branch-a');
    assert.equal(round.children[0].taskStatus, 'doing');
    assert.equal(round.children[1].id, 'branch-b');
    assert.equal(round.children[1].color, '#0ea5e9');
  });
}
