'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Core = require('../core');
const Sync = require('../sync');

const sha256 = async (str) =>
  crypto.createHash('sha256').update(str, 'utf8').digest('hex');

const DEVICE_A = '018f3a5e-0000-7000-8000-000000000001';
const MAP_ID = '018f3a5e-0000-7000-8000-000000000010';

function makeMockProject(text = 'Central') {
  return {
    schema: Core.PROJECT_SCHEMA,
    root: { id: 'root-1', text, children: [] },
    images: [],
    relationships: []
  };
}

function createMockStorage() {
  const maps = new Map();
  const backups = [];
  return {
    maps,
    backups,
    async getMap(id) {
      return maps.get(id) || null;
    },
    async saveMap(id, project, manifest) {
      maps.set(id, { id, project, manifest });
    },
    async saveBackup(id, project, manifest) {
      backups.push({ id, project, manifest });
    }
  };
}

function createMockRemote() {
  const manifests = new Map();
  const payloads = new Map();
  const published = [];
  return {
    manifests,
    payloads,
    published,
    async fetchRemoteManifest(id) {
      return manifests.get(id) || null;
    },
    async fetchRemotePayload(id, hash) {
      return payloads.get(`${id}:${hash}`) || null;
    },
    async publishHandoff(handoff) {
      published.push(handoff);
      manifests.set(handoff.manifest.mapId, handoff.manifest);
      payloads.set(`${handoff.manifest.mapId}:${handoff.manifest.sha256}`, handoff.bytes);
    }
  };
}

describe('F11.3 Personal Map Sync Engine', () => {
  test('initializes with expected states and rejects missing adapters', () => {
    assert.ok(Sync.SYNC_STATES);
    assert.equal(Sync.SYNC_STATES.IDLE, 'idle');
    assert.equal(Sync.SYNC_STATES.OFFLINE, 'offline');
    assert.equal(Sync.SYNC_STATES.CONFLICT, 'conflict');

    assert.throws(() => Sync.createPersonalSyncManager(), /Durable local storage adapter required/);
    assert.throws(() => Sync.createPersonalSyncManager({ storage: createMockStorage() }), /Remote transport required/);
    assert.throws(() => Sync.createPersonalSyncManager({
      storage: createMockStorage(),
      remote: createMockRemote()
    }), /SHA-256 implementation required/);
  });

  test('offline queueing saves local map and transitions state to OFFLINE without throwing', async () => {
    const storage = createMockStorage();
    const remote = createMockRemote();
    let online = false;
    const manager = Sync.createPersonalSyncManager({
      storage,
      remote,
      sha256,
      isOnline: () => online
    });

    assert.equal(manager.getState(), Sync.SYNC_STATES.OFFLINE);

    const project = makeMockProject('Offline Work');
    const res = await manager.enqueueLocalChange(MAP_ID, project, { deviceId: DEVICE_A, revision: 1 });

    assert.equal(res.queued, true);
    assert.equal(res.offline, true);
    assert.equal(manager.getPendingCount(), 1);

    // Map must be durably saved in local storage even when offline
    const local = await storage.getMap(MAP_ID);
    assert.ok(local);
    assert.equal(local.project.root.text, 'Offline Work');
    assert.equal(local.manifest.mapId, MAP_ID);

    // Remote must have received nothing yet
    assert.equal(remote.published.length, 0);

    // Calling sync while offline returns offline status gracefully
    const syncRes = await manager.syncMap(MAP_ID);
    assert.equal(syncRes.status, 'offline');
    assert.equal(manager.getState(), Sync.SYNC_STATES.OFFLINE);
  });

  test('flushes pending queue when transitioning from offline to online', async () => {
    const storage = createMockStorage();
    const remote = createMockRemote();
    let online = false;
    const manager = Sync.createPersonalSyncManager({
      storage,
      remote,
      sha256,
      isOnline: () => online
    });

    const project = makeMockProject('Queued Work');
    await manager.enqueueLocalChange(MAP_ID, project, { deviceId: DEVICE_A, revision: 1 });
    assert.equal(manager.getPendingCount(), 1);

    // Switch online
    online = true;
    const flushRes = await manager.flushQueue();

    assert.equal(flushRes.flushed, 1);
    assert.equal(manager.getPendingCount(), 0);
    assert.equal(manager.getState(), Sync.SYNC_STATES.SYNCED);

    // Remote now has the published handoff
    assert.equal(remote.published.length, 1);
    assert.equal(remote.published[0].manifest.mapId, MAP_ID);
  });

  test('fast-forward updates local map and creates a safety backup', async () => {
    const storage = createMockStorage();
    const remote = createMockRemote();
    const manager = Sync.createPersonalSyncManager({
      storage,
      remote,
      sha256,
      isOnline: () => true
    });

    // Local has Rev 1
    const p1 = makeMockProject('Version 1');
    const h1 = await Core.makeHandoff(p1, { mapId: MAP_ID, deviceId: DEVICE_A, revision: 1, sha256 });
    await storage.saveMap(MAP_ID, p1, h1.manifest);

    // Remote has Rev 2 (fast-forward candidate)
    const p2 = makeMockProject('Version 2 - Updated remotely');
    const h2 = await Core.makeHandoff(p2, {
      mapId: MAP_ID,
      deviceId: '018f3a5e-0000-7000-8000-000000000002',
      revision: 2,
      parentHash: h1.manifest.sha256,
      sha256
    });
    remote.manifests.set(MAP_ID, h2.manifest);
    remote.payloads.set(`${MAP_ID}:${h2.manifest.sha256}`, h2.bytes);

    // Sync
    const syncRes = await manager.syncMap(MAP_ID);
    assert.equal(syncRes.status, 'fast-forward-applied');
    assert.equal(syncRes.revision, 2);

    // Safety backup of Rev 1 was created
    assert.equal(storage.backups.length, 1);
    assert.equal(storage.backups[0].manifest.revision, 1);

    // Local storage now has Rev 2
    const updatedLocal = await storage.getMap(MAP_ID);
    assert.equal(updatedLocal.manifest.revision, 2);
    assert.equal(updatedLocal.project.root.text, 'Version 2 - Updated remotely');
  });

  test('conflict creates fork and never silently overwrites local uncommitted changes', async () => {
    const storage = createMockStorage();
    const remote = createMockRemote();
    const manager = Sync.createPersonalSyncManager({
      storage,
      remote,
      sha256,
      isOnline: () => true
    });

    // Local has Rev 1
    const p1 = makeMockProject('Version 1 Local');
    const h1 = await Core.makeHandoff(p1, { mapId: MAP_ID, deviceId: DEVICE_A, revision: 1, sha256 });
    await storage.saveMap(MAP_ID, p1, h1.manifest);

    // Remote has diverged (e.g. independently created Rev 1 with different content)
    const pRemote = makeMockProject('Version 1 Remote Divergent');
    const hRemote = await Core.makeHandoff(pRemote, {
      mapId: MAP_ID,
      deviceId: '018f3a5e-0000-7000-8000-000000000002',
      revision: 1,
      sha256
    });
    remote.manifests.set(MAP_ID, hRemote.manifest);
    remote.payloads.set(`${MAP_ID}:${hRemote.manifest.sha256}`, hRemote.bytes);

    // Sync
    const syncRes = await manager.syncMap(MAP_ID, { localDirty: true });
    assert.equal(syncRes.status, 'conflict');
    assert.equal(syncRes.action, 'fork-created');
    assert.ok(syncRes.conflictId.startsWith(`${MAP_ID}-conflict-`));
    assert.equal(manager.getState(), Sync.SYNC_STATES.CONFLICT);

    // Local original map was NOT overwritten!
    const localOriginal = await storage.getMap(MAP_ID);
    assert.equal(localOriginal.project.root.text, 'Version 1 Local');

    // Conflict copy exists separately in local storage
    const conflictFork = await storage.getMap(syncRes.conflictId);
    assert.ok(conflictFork);
    assert.equal(conflictFork.project.root.text, 'Version 1 Remote Divergent');

    // Conflict is tracked in manager
    const conflicts = manager.getActiveConflicts();
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].originalMapId, MAP_ID);
  });
});
