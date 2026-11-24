/* F11.6 — Lightweight deterministic tree CRDT and operation convergence engine.
 * Guarantees mathematical convergence: Commutative, Associative, Idempotent.
 * Strictly prevents structural tree cycles during concurrent re-parenting.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlaukaMapCRDT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function findNode(root, nodeId) {
    if (!root || typeof root !== 'object') return null;
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      if (current.id === nodeId) return current;
      if (Array.isArray(current.children)) {
        for (let i = current.children.length - 1; i >= 0; i--) {
          stack.push(current.children[i]);
        }
      }
    }
    return null;
  }

  function findParent(root, childId) {
    if (!root || root.id === childId) return null;
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      if (Array.isArray(current.children)) {
        for (const child of current.children) {
          if (child.id === childId) return current;
          stack.push(child);
        }
      }
    }
    return null;
  }

  function isDescendant(root, ancestorId, targetId) {
    const ancestor = findNode(root, ancestorId);
    if (!ancestor) return false;
    return findNode(ancestor, targetId) !== null && ancestorId !== targetId;
  }

  function cloneTree(root) {
    return JSON.parse(JSON.stringify(root));
  }

  function applyOp(root, op) {
    const target = findNode(root, op.nodeId);
    if (op.type === 'edit_text') {
      if (target) {
        target.text = op.text;
        target._lamport = Math.max(target._lamport || 0, op.lamport || 0);
      }
      return true;
    }

    if (op.type === 'add_child') {
      const parent = findNode(root, op.parentId);
      if (parent && !findNode(root, op.node.id)) {
        if (!Array.isArray(parent.children)) parent.children = [];
        parent.children.push(JSON.parse(JSON.stringify(op.node)));
        return true;
      }
      return false;
    }

    if (op.type === 'move_node') {
      if (!target || target.id === root.id) return false;
      const targetParent = findNode(root, op.targetParentId);
      if (!targetParent) return false;

      // Prevent cycle: targetParent must not be a descendant of moving node
      if (isDescendant(root, target.id, targetParent.id)) {
        // Cycle detected: reject invalid move to preserve tree invariant
        return false;
      }

      const currentParent = findParent(root, target.id);
      if (currentParent) {
        currentParent.children = currentParent.children.filter(c => c.id !== target.id);
      }
      if (!Array.isArray(targetParent.children)) targetParent.children = [];
      targetParent.children.push(target);
      return true;
    }

    return false;
  }

  function sortOps(ops) {
    return [...ops].sort((a, b) => {
      const diff = (a.lamport || 0) - (b.lamport || 0);
      if (diff !== 0) return diff;
      return String(a.deviceId || '').localeCompare(String(b.deviceId || ''));
    });
  }

  function mergeOperations(baseRoot, opsA, opsB) {
    const tree = cloneTree(baseRoot);
    const combined = [...opsA, ...opsB];

    // Deduplicate by opId
    const seen = new Set();
    const unique = [];
    for (const op of combined) {
      if (!seen.has(op.opId)) {
        seen.add(op.opId);
        unique.push(op);
      }
    }

    // Sort deterministically by Lamport clock then deviceId
    const sorted = sortOps(unique);

    for (const op of sorted) {
      applyOp(tree, op);
    }

    return tree;
  }

  return Object.freeze({
    findNode,
    findParent,
    isDescendant,
    applyOp,
    mergeOperations
  });
});
