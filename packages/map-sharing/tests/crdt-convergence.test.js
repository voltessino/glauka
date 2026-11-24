'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CRDT = require('../crdt');

function createBaseTree() {
  return {
    id: 'root',
    text: 'Central Map',
    children: [
      {
        id: 'branch-1',
        text: 'Branch 1',
        children: [
          { id: 'sub-1', text: 'Sub 1', children: [] }
        ]
      },
      {
        id: 'branch-2',
        text: 'Branch 2',
        children: []
      }
    ]
  };
}

describe('F11.6 CRDT Convergence Engine', () => {
  describe('Tree Traversal and Invariants', () => {
    test('findNode and findParent identify elements correctly', () => {
      const root = createBaseTree();
      assert.equal(CRDT.findNode(root, 'sub-1').text, 'Sub 1');
      assert.equal(CRDT.findNode(root, 'missing'), null);

      assert.equal(CRDT.findParent(root, 'sub-1').id, 'branch-1');
      assert.equal(CRDT.findParent(root, 'branch-1').id, 'root');
      assert.equal(CRDT.findParent(root, 'root'), null);
    });

    test('isDescendant identifies hierarchy and prevents cyclic moves', () => {
      const root = createBaseTree();
      assert.equal(CRDT.isDescendant(root, 'branch-1', 'sub-1'), true);
      assert.equal(CRDT.isDescendant(root, 'sub-1', 'branch-1'), false);
      assert.equal(CRDT.isDescendant(root, 'branch-1', 'branch-2'), false);
      assert.equal(CRDT.isDescendant(root, 'branch-1', 'branch-1'), false);
    });
  });

  describe('Mathematical Convergence (Commutative, Associative, Idempotent)', () => {
    test('concurrent node additions converge to identical trees regardless of merge order', () => {
      const root = createBaseTree();

      const opsA = [
        {
          opId: 'op-a1',
          type: 'add_child',
          parentId: 'branch-1',
          node: { id: 'new-a1', text: 'From Client A', children: [] },
          lamport: 1,
          deviceId: 'dev-a'
        }
      ];

      const opsB = [
        {
          opId: 'op-b1',
          type: 'add_child',
          parentId: 'branch-2',
          node: { id: 'new-b1', text: 'From Client B', children: [] },
          lamport: 1,
          deviceId: 'dev-b'
        }
      ];

      // A merged with B
      const treeAB = CRDT.mergeOperations(root, opsA, opsB);
      // B merged with A
      const treeBA = CRDT.mergeOperations(root, opsB, opsA);

      // Must be strictly identical
      assert.deepEqual(treeAB, treeBA);

      // Both nodes must be present
      assert.ok(CRDT.findNode(treeAB, 'new-a1'));
      assert.ok(CRDT.findNode(treeAB, 'new-b1'));
    });

    test('concurrent text edit resolves deterministically via Lamport clock', () => {
      const root = createBaseTree();

      const opStale = [
        {
          opId: 'edit-1',
          type: 'edit_text',
          nodeId: 'sub-1',
          text: 'Stale Edit',
          lamport: 2,
          deviceId: 'dev-a'
        }
      ];

      const opFresh = [
        {
          opId: 'edit-2',
          type: 'edit_text',
          nodeId: 'sub-1',
          text: 'Winning Latest Edit',
          lamport: 3,
          deviceId: 'dev-b'
        }
      ];

      const mergedAB = CRDT.mergeOperations(root, opStale, opFresh);
      const mergedBA = CRDT.mergeOperations(root, opFresh, opStale);

      assert.equal(CRDT.findNode(mergedAB, 'sub-1').text, 'Winning Latest Edit');
      assert.deepEqual(mergedAB, mergedBA);
    });

    test('cycle creation attempt is safely rejected and preserves tree invariant', () => {
      const root = createBaseTree();

      // Attempt to move branch-1 under its own child sub-1
      const cyclicOp = [
        {
          opId: 'cycle-op',
          type: 'move_node',
          nodeId: 'branch-1',
          targetParentId: 'sub-1',
          lamport: 5,
          deviceId: 'dev-bad'
        }
      ];

      const resultTree = CRDT.mergeOperations(root, cyclicOp, []);

      // Cycle was rejected: branch-1 is still direct child of root
      assert.equal(CRDT.findParent(resultTree, 'branch-1').id, 'root');
      assert.equal(CRDT.findParent(resultTree, 'sub-1').id, 'branch-1');
    });

    test('idempotence: duplicate operations do not alter result', () => {
      const root = createBaseTree();
      const ops = [
        {
          opId: 'op-1',
          type: 'add_child',
          parentId: 'branch-2',
          node: { id: 'child-x', text: 'Item X', children: [] },
          lamport: 1,
          deviceId: 'dev-1'
        }
      ];

      const once = CRDT.mergeOperations(root, ops, []);
      const twice = CRDT.mergeOperations(root, ops, ops);

      assert.deepEqual(once, twice);
      assert.equal(CRDT.findParent(twice, 'child-x').children.length, 1);
    });
  });
});
