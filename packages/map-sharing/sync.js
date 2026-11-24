/* F11.3 — Offline-first personal map sync engine.
 * No credentials, tokens or remote endpoints enter this module.
 * Operates on single maps with GlaukaMapHandoff-v1 manifests.
 * Never silently overwrites divergent or uncommitted local content.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlaukaMapPersonalSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const Core = typeof require === 'function' ? require('./core') : (globalThis.GlaukaMapSharingCore || {});

  const SYNC_STATES = Object.freeze({
    OFFLINE: 'offline',
    IDLE: 'idle',
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    CONFLICT: 'conflict',
    ERROR: 'error'
  });

  function createPersonalSyncManager({
    storage,
    remote,
    sha256,
    isOnline = () => true,
    now = () => new Date().toISOString(),
    onStateChange = () => {}
  } = {}) {
    if (!storage || typeof storage.getMap !== 'function' || typeof storage.saveMap !== 'function' ||
        typeof storage.saveBackup !== 'function') {
      throw Error('Durable local storage adapter required with getMap, saveMap and saveBackup');
    }
    if (!remote || typeof remote.fetchRemoteManifest !== 'function' ||
        typeof remote.fetchRemotePayload !== 'function' ||
        typeof remote.publishHandoff !== 'function') {
      throw Error('Remote transport required with fetchRemoteManifest, fetchRemotePayload, publishHandoff');
    }
    if (typeof sha256 !== 'function') {
      throw Error('SHA-256 implementation required');
    }

    let state = isOnline() ? SYNC_STATES.IDLE : SYNC_STATES.OFFLINE;
    const pendingQueue = new Map(); // mapId -> entry
    const activeConflicts = new Map(); // mapId -> conflict details

    function setState(newState, detail = {}) {
      state = newState;
      onStateChange({ state, detail });
    }

    async function enqueueLocalChange(mapId, project, { deviceId, revision = 1, parentHash = null } = {}) {
      Core.assertProject(project);
      const handoff = await Core.makeHandoff(project, {
        mapId,
        deviceId,
        revision,
        parentHash,
        sha256,
        createdAt: now()
      });

      // Save locally first immediately before queueing for sync
      await storage.saveMap(mapId, project, handoff.manifest);

      pendingQueue.set(mapId, {
        mapId,
        handoff,
        attempts: 0,
        queuedAt: now()
      });

      if (!isOnline()) {
        setState(SYNC_STATES.OFFLINE, { mapId, pending: pendingQueue.size });
        return { queued: true, offline: true, manifest: handoff.manifest };
      }

      setState(SYNC_STATES.PENDING, { mapId, pending: pendingQueue.size });
      return { queued: true, offline: false, manifest: handoff.manifest };
    }

    async function syncMap(mapId, { localDirty = false } = {}) {
      if (!isOnline()) {
        setState(SYNC_STATES.OFFLINE, { mapId });
        return { status: 'offline' };
      }

      setState(SYNC_STATES.SYNCING, { mapId });

      try {
        const localEntry = await storage.getMap(mapId);
        const remoteManifest = await remote.fetchRemoteManifest(mapId);

        // Case 1: Remote has no record of this map yet
        if (!remoteManifest) {
          const pending = pendingQueue.get(mapId);
          if (pending) {
            await remote.publishHandoff(pending.handoff);
            pendingQueue.delete(mapId);
            setState(SYNC_STATES.SYNCED, { mapId, revision: pending.handoff.manifest.revision });
            return { status: 'published', revision: pending.handoff.manifest.revision };
          }
          setState(SYNC_STATES.IDLE, { mapId });
          return { status: 'no-remote' };
        }

        // Case 2: Both local and remote exist -> review revision
        const localManifest = localEntry ? localEntry.manifest : null;
        const review = Core.reviewRevision(localManifest, remoteManifest, { localDirty });

        if (review.status === 'identical') {
          pendingQueue.delete(mapId);
          setState(SYNC_STATES.SYNCED, { mapId, revision: localManifest.revision });
          return { status: 'identical' };
        }

        if (review.status === 'fast-forward-candidate') {
          // Verify remote payload before applying
          const remoteBytes = await remote.fetchRemotePayload(mapId, remoteManifest.sha256);
          const verified = await Core.verifyHandoff({
            manifest: remoteManifest,
            bytes: remoteBytes,
            sha256
          });

          // Mandatory backup of current local version
          if (localEntry) {
            await storage.saveBackup(mapId, localEntry.project, localEntry.manifest);
          }

          // Recheck local hash before applying
          const freshLocal = await storage.getMap(mapId);
          if (freshLocal && freshLocal.manifest.sha256 !== localManifest.sha256) {
            setState(SYNC_STATES.CONFLICT, { mapId, reason: 'local-state-drifted' });
            return { status: 'conflict', reason: 'local-state-drifted' };
          }

          // Apply fast-forward safely
          await storage.saveMap(mapId, verified.project, verified.manifest);
          pendingQueue.delete(mapId);
          setState(SYNC_STATES.SYNCED, { mapId, revision: verified.manifest.revision });
          return { status: 'fast-forward-applied', revision: verified.manifest.revision };
        }

        if (review.status === 'conflict' || review.status === 'history-gap') {
          // Remote diverged from local -> DO NOT overwrite
          const remoteBytes = await remote.fetchRemotePayload(mapId, remoteManifest.sha256);
          const verifiedRemote = await Core.verifyHandoff({
            manifest: remoteManifest,
            bytes: remoteBytes,
            sha256
          });

          // Create conflict fork
          const conflictId = `${mapId}-conflict-${Date.now()}`;
          await storage.saveMap(conflictId, verifiedRemote.project, {
            ...verifiedRemote.manifest,
            mapId: conflictId
          });

          activeConflicts.set(mapId, {
            originalMapId: mapId,
            conflictMapId: conflictId,
            localManifest,
            remoteManifest
          });

          setState(SYNC_STATES.CONFLICT, { mapId, conflictId });
          return {
            status: 'conflict',
            action: 'fork-created',
            conflictId,
            localManifest,
            remoteManifest
          };
        }

        if (review.status === 'stale') {
          // Remote is older than local -> push local if pending
          const pending = pendingQueue.get(mapId);
          if (pending) {
            await remote.publishHandoff(pending.handoff);
            pendingQueue.delete(mapId);
            setState(SYNC_STATES.SYNCED, { mapId, revision: pending.handoff.manifest.revision });
            return { status: 'published-update', revision: pending.handoff.manifest.revision };
          }
          setState(SYNC_STATES.IDLE, { mapId });
          return { status: 'remote-stale' };
        }

        setState(SYNC_STATES.IDLE, { mapId });
        return { status: review.status };
      } catch (err) {
        setState(SYNC_STATES.ERROR, { mapId, error: err.message });
        return { status: 'error', error: err.message };
      }
    }

    async function flushQueue() {
      if (!isOnline() || pendingQueue.size === 0) return { flushed: 0 };
      let count = 0;
      for (const mapId of Array.from(pendingQueue.keys())) {
        const res = await syncMap(mapId);
        if (res.status === 'published' || res.status === 'published-update' || res.status === 'identical' || res.status === 'fast-forward-applied') {
          count++;
        }
      }
      return { flushed: count };
    }

    return Object.freeze({
      SYNC_STATES,
      getState: () => state,
      getPendingCount: () => pendingQueue.size,
      getActiveConflicts: () => Array.from(activeConflicts.values()),
      enqueueLocalChange,
      syncMap,
      flushQueue
    });
  }

  return Object.freeze({
    SYNC_STATES,
    createPersonalSyncManager
  });
});
