'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Core = require('../core');

const sha256 = async (str) =>
  crypto.createHash('sha256').update(str, 'utf8').digest('hex');

const validUUID1 = '123e4567-e89b-12d3-a456-426614174000'; // v1-like structure, wait: UUID regex is /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i (v4 or v7)
const validUUIDv4_1 = 'a0000000-0000-4000-8000-000000000001';
const validUUIDv4_2 = 'b0000000-0000-4000-8000-000000000002';
const validUUIDv7_1 = '018f3a5e-0000-7000-8000-000000000001';
const validHash1 = 'a'.repeat(64);
const validHash2 = 'b'.repeat(64);

function makeValidProject(nodeCount = 3) {
  const root = { id: 'root-1', text: 'Central Idea', children: [] };
  for (let i = 1; i < nodeCount; i++) {
    root.children.push({ id: `child-${i}`, text: `Child Node ${i}`, children: [] });
  }
  return {
    schema: Core.PROJECT_SCHEMA,
    root,
    images: [],
    relationships: []
  };
}

describe('F11.0 Map Sharing Core', () => {
  describe('Constants and Exports', () => {
    test('exports expected constants and methods', () => {
      assert.equal(Core.SCHEMA, 'GlaukaMapHandoff-v1');
      assert.equal(Core.PROJECT_SCHEMA, 'NeuroMapArchitect-SingleTab-v6');
      assert.equal(Core.MAX_BYTES, 25 * 1024 * 1024);
      assert.equal(Core.MAX_NODES, 3500);
      assert.equal(typeof Core.assertProject, 'function');
      assert.equal(typeof Core.assertManifest, 'function');
      assert.equal(typeof Core.makeHandoff, 'function');
      assert.equal(typeof Core.verifyHandoff, 'function');
      assert.equal(typeof Core.reviewRevision, 'function');
    });
  });

  describe('assertProject', () => {
    test('accepts valid SingleTab-v6 project and returns frozen summary', () => {
      const p = makeValidProject(5);
      p.images = [{ id: 'img-1' }];
      p.relationships = [{ from: 'child-1', to: 'child-2' }];
      const summary = Core.assertProject(p);
      assert.equal(summary.rootId, 'root-1');
      assert.equal(summary.nodes, 5);
      assert.equal(summary.title, 'Central Idea');
      assert.equal(summary.images, 1);
      assert.ok(Object.isFrozen(summary));
    });

    test('rejects null, non-object, array or wrong schema', () => {
      assert.throws(() => Core.assertProject(null), /SingleTab-v6/);
      assert.throws(() => Core.assertProject('string'), /SingleTab-v6/);
      assert.throws(() => Core.assertProject([]), /SingleTab-v6/);
      assert.throws(() => Core.assertProject({ schema: 'other', root: { id: 'r', text: 'r', children: [] } }), /SingleTab-v6/);
    });

    test('rejects multi-tab workspaces', () => {
      const p = makeValidProject(2);
      p.tabs = [{ id: 'tab1' }];
      assert.throws(() => Core.assertProject(p), /SingleTab-v6 map, never a workspace/);
    });

    test('rejects invalid images or relationships type', () => {
      const p1 = makeValidProject(2);
      p1.images = 'not-an-array';
      assert.throws(() => Core.assertProject(p1), /Invalid Glauka images/);

      const p2 = makeValidProject(2);
      p2.relationships = {};
      assert.throws(() => Core.assertProject(p2), /Invalid Glauka relationships/);
    });

    test('rejects tree with duplicate IDs', () => {
      const p = {
        schema: Core.PROJECT_SCHEMA,
        root: {
          id: 'dup-id',
          text: 'Root',
          children: [
            { id: 'dup-id', text: 'Child with same ID', children: [] }
          ]
        }
      };
      assert.throws(() => Core.assertProject(p), /Invalid or cyclic Glauka tree/);
    });

    test('rejects cyclic trees', () => {
      const nodeA = { id: 'node-a', text: 'A', children: [] };
      const nodeB = { id: 'node-b', text: 'B', children: [nodeA] };
      nodeA.children.push(nodeB);
      const p = {
        schema: Core.PROJECT_SCHEMA,
        root: nodeA
      };
      assert.throws(() => Core.assertProject(p), /Invalid or cyclic Glauka tree/);
    });

    test('rejects invalid node IDs (empty, too long, control chars)', () => {
      const pEmpty = {
        schema: Core.PROJECT_SCHEMA,
        root: { id: '', text: 'R', children: [] }
      };
      assert.throws(() => Core.assertProject(pEmpty), /Invalid or cyclic Glauka tree/);

      const pLong = {
        schema: Core.PROJECT_SCHEMA,
        root: { id: 'x'.repeat(201), text: 'R', children: [] }
      };
      assert.throws(() => Core.assertProject(pLong), /Invalid or cyclic Glauka tree/);

      const pCtrl = {
        schema: Core.PROJECT_SCHEMA,
        root: { id: 'node\x00bad', text: 'R', children: [] }
      };
      assert.throws(() => Core.assertProject(pCtrl), /Invalid or cyclic Glauka tree/);
    });

    test('rejects missing text or non-array children', () => {
      const pNoText = {
        schema: Core.PROJECT_SCHEMA,
        root: { id: 'r', children: [] }
      };
      assert.throws(() => Core.assertProject(pNoText), /Invalid or cyclic Glauka tree/);

      const pBadChildren = {
        schema: Core.PROJECT_SCHEMA,
        root: { id: 'r', text: 'R', children: null }
      };
      assert.throws(() => Core.assertProject(pBadChildren), /Invalid or cyclic Glauka tree/);
    });

    test('enforces node limit of 3500 nodes', () => {
      const p3500 = makeValidProject(3500);
      assert.equal(Core.assertProject(p3500).nodes, 3500);

      const p3501 = makeValidProject(3501);
      assert.throws(() => Core.assertProject(p3501), /exceeds node limit/);
    });
  });

  describe('assertManifest', () => {
    function validManifest() {
      return {
        schema: Core.SCHEMA,
        mapId: validUUIDv4_1,
        deviceId: validUUIDv4_2,
        revision: 1,
        parentHash: null,
        sha256: validHash1,
        byteLength: 1024,
        createdAt: new Date().toISOString()
      };
    }

    test('accepts valid revision 1 manifest with null parentHash', () => {
      const m = validManifest();
      assert.equal(Core.assertManifest(m), m);
    });

    test('accepts valid revision 2+ manifest with valid parentHash', () => {
      const m = validManifest();
      m.revision = 2;
      m.parentHash = validHash2;
      assert.equal(Core.assertManifest(m), m);
    });

    test('accepts UUIDv7 for mapId and deviceId', () => {
      const m = validManifest();
      m.mapId = validUUIDv7_1;
      assert.equal(Core.assertManifest(m), m);
    });

    test('rejects manifest with extra or missing keys', () => {
      const mExtra = { ...validManifest(), extra: 123 };
      assert.throws(() => Core.assertManifest(mExtra), /Invalid Glauka handoff manifest/);

      const mMissing = validManifest();
      delete mMissing.byteLength;
      assert.throws(() => Core.assertManifest(mMissing), /Invalid Glauka handoff manifest/);
    });

    test('rejects wrong schema', () => {
      const m = { ...validManifest(), schema: 'WrongSchema-v1' };
      assert.throws(() => Core.assertManifest(m), /Invalid Glauka handoff manifest/);
    });

    test('rejects non-v4/v7 UUIDs or malformed UUIDs', () => {
      const m1 = { ...validManifest(), mapId: 'not-a-uuid' };
      assert.throws(() => Core.assertManifest(m1), /Invalid Glauka handoff manifest/);

      // v1 UUID (time-based) is rejected because pattern requires [47]
      const m2 = { ...validManifest(), mapId: '123e4567-e89b-12d3-a456-426614174000' };
      assert.throws(() => Core.assertManifest(m2), /Invalid Glauka handoff manifest/);
    });

    test('rejects invalid revision numbers', () => {
      assert.throws(() => Core.assertManifest({ ...validManifest(), revision: 0 }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), revision: -1 }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), revision: 1.5 }), /Invalid Glauka handoff manifest/);
    });

    test('rejects revision 1 with non-null parentHash or revision > 1 with null parentHash', () => {
      const m1 = { ...validManifest(), revision: 1, parentHash: validHash1 };
      assert.throws(() => Core.assertManifest(m1), /Invalid Glauka handoff manifest/);

      const m2 = { ...validManifest(), revision: 2, parentHash: null };
      assert.throws(() => Core.assertManifest(m2), /Invalid Glauka handoff manifest/);
    });

    test('rejects invalid hashes', () => {
      assert.throws(() => Core.assertManifest({ ...validManifest(), sha256: 'short' }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), sha256: 'g'.repeat(64) }), /Invalid Glauka handoff manifest/);
    });

    test('rejects invalid byteLength', () => {
      assert.throws(() => Core.assertManifest({ ...validManifest(), byteLength: 0 }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), byteLength: Core.MAX_BYTES + 1 }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), byteLength: '100' }), /Invalid Glauka handoff manifest/);
    });

    test('rejects malformed or non-ISO createdAt', () => {
      assert.throws(() => Core.assertManifest({ ...validManifest(), createdAt: 'not-a-date' }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), createdAt: '2026-11-06' }), /Invalid Glauka handoff manifest/);
      assert.throws(() => Core.assertManifest({ ...validManifest(), createdAt: '2026-11-06T20:00:00Z' }), /Invalid Glauka handoff manifest/); // must be 24 chars with milliseconds
    });
  });

  describe('makeHandoff and verifyHandoff', () => {
    test('creates and verifies a valid handoff package', async () => {
      const project = makeValidProject(10);
      const handoff = await Core.makeHandoff(project, {
        mapId: validUUIDv4_1,
        deviceId: validUUIDv4_2,
        revision: 1,
        sha256
      });

      assert.ok(Object.isFrozen(handoff));
      assert.ok(Object.isFrozen(handoff.manifest));
      assert.equal(handoff.manifest.schema, Core.SCHEMA);
      assert.equal(handoff.manifest.mapId, validUUIDv4_1);
      assert.equal(handoff.manifest.deviceId, validUUIDv4_2);
      assert.equal(handoff.manifest.revision, 1);
      assert.equal(handoff.manifest.parentHash, null);
      assert.equal(typeof handoff.manifest.sha256, 'string');
      assert.equal(handoff.manifest.sha256.length, 64);
      assert.equal(handoff.manifest.byteLength, Buffer.byteLength(handoff.bytes, 'utf8'));
      assert.equal(handoff.summary.nodes, 10);

      // Verify
      const verified = await Core.verifyHandoff({
        manifest: handoff.manifest,
        bytes: handoff.bytes,
        sha256
      });

      assert.ok(Object.isFrozen(verified));
      assert.deepEqual(verified.project, project);
      assert.equal(verified.summary.nodes, 10);
      assert.equal(verified.manifest.mapId, validUUIDv4_1);
    });

    test('makeHandoff fails if sha256 or UUIDs are missing', async () => {
      const project = makeValidProject(2);
      await assert.rejects(
        () => Core.makeHandoff(project, { mapId: 'invalid', deviceId: validUUIDv4_2, sha256 }),
        /Secure map\/device IDs/
      );
      await assert.rejects(
        () => Core.makeHandoff(project, { mapId: validUUIDv4_1, deviceId: validUUIDv4_2, sha256: null }),
        /Secure map\/device IDs/
      );
    });

    test('verifyHandoff rejects tampered byte length', async () => {
      const project = makeValidProject(2);
      const handoff = await Core.makeHandoff(project, {
        mapId: validUUIDv4_1,
        deviceId: validUUIDv4_2,
        sha256
      });

      await assert.rejects(
        () => Core.verifyHandoff({
          manifest: { ...handoff.manifest, byteLength: handoff.manifest.byteLength + 1 },
          bytes: handoff.bytes,
          sha256
        }),
        /byte length mismatch/
      );
    });

    test('verifyHandoff rejects tampered byte content (hash mismatch)', async () => {
      const project = makeValidProject(2);
      const handoff = await Core.makeHandoff(project, {
        mapId: validUUIDv4_1,
        deviceId: validUUIDv4_2,
        sha256
      });

      // Replace a character in bytes with another character of same byte length
      const tamperedBytes = handoff.bytes.replace('Child', 'Zhild');
      assert.equal(Buffer.byteLength(tamperedBytes, 'utf8'), handoff.manifest.byteLength);

      await assert.rejects(
        () => Core.verifyHandoff({
          manifest: handoff.manifest,
          bytes: tamperedBytes,
          sha256
        }),
        /integrity mismatch/
      );
    });

    test('verifyHandoff rejects invalid JSON', async () => {
      const brokenBytes = '{ "invalid json" ';
      const brokenDigest = await sha256(brokenBytes);
      const manifest = {
        schema: Core.SCHEMA,
        mapId: validUUIDv4_1,
        deviceId: validUUIDv4_2,
        revision: 1,
        parentHash: null,
        sha256: brokenDigest,
        byteLength: Buffer.byteLength(brokenBytes, 'utf8'),
        createdAt: new Date().toISOString()
      };

      await assert.rejects(
        () => Core.verifyHandoff({ manifest, bytes: brokenBytes, sha256 }),
        /Invalid Glauka JSON/
      );
    });
  });

  describe('reviewRevision Classifier', () => {
    function baseManifest(revision = 1, hash = validHash1, parent = null) {
      return {
        schema: Core.SCHEMA,
        mapId: validUUIDv4_1,
        deviceId: validUUIDv4_2,
        revision,
        parentHash: parent,
        sha256: hash,
        byteLength: 500,
        createdAt: new Date().toISOString()
      };
    }

    test('classifies incoming when local is null/undefined as new-map', () => {
      const inc = baseManifest(1, validHash1, null);
      const res = Core.reviewRevision(null, inc);
      assert.deepEqual(res, { status: 'new-map', mayReplace: false });
    });

    test('classifies different mapId as other-map', () => {
      const local = baseManifest(1, validHash1, null);
      const inc = { ...baseManifest(1, validHash1, null), mapId: validUUIDv7_1 };
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, { status: 'other-map', mayReplace: false });
    });

    test('classifies same hash as identical', () => {
      const local = baseManifest(1, validHash1, null);
      const inc = baseManifest(1, validHash1, null);
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, { status: 'identical', mayReplace: false });
    });

    test('classifies dirty local state as conflict', () => {
      const local = baseManifest(1, validHash1, null);
      const inc = baseManifest(2, validHash2, validHash1);
      const res = Core.reviewRevision(local, inc, { localDirty: true });
      assert.deepEqual(res, { status: 'conflict', mayReplace: false });
    });

    test('classifies lower incoming revision as stale', () => {
      const local = baseManifest(3, validHash1, validHash2);
      const inc = baseManifest(2, validHash2, 'c'.repeat(64));
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, { status: 'stale', mayReplace: false });
    });

    test('classifies equal revision with different hash as conflict', () => {
      const local = baseManifest(2, validHash1, validHash2);
      const inc = baseManifest(2, 'd'.repeat(64), validHash2);
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, { status: 'conflict', mayReplace: false });
    });

    test('classifies revision jump > 1 as history-gap', () => {
      const local = baseManifest(1, validHash1, null);
      const inc = baseManifest(3, validHash2, 'e'.repeat(64));
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, { status: 'history-gap', mayReplace: false });
    });

    test('classifies direct parent match (rev+1 and parentHash==local.sha256) as fast-forward-candidate', () => {
      const local = baseManifest(1, validHash1, null);
      const inc = baseManifest(2, validHash2, validHash1);
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, {
        status: 'fast-forward-candidate',
        mayReplace: false,
        requiresBackup: true,
        requiresLocalRecheck: true
      });
    });

    test('classifies rev+1 but divergent parentHash as conflict', () => {
      const local = baseManifest(1, validHash1, null);
      const inc = baseManifest(2, validHash2, 'f'.repeat(64));
      const res = Core.reviewRevision(local, inc);
      assert.deepEqual(res, { status: 'conflict', mayReplace: false });
    });
  });
});
