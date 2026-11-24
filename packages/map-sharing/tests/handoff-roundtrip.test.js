'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Sharing = require('../core');

const sha256 = async (str) =>
  crypto.createHash('sha256').update(str, 'utf8').digest('hex');

const PC_DEVICE_ID = '018f3a5e-0000-7000-8000-0000000000aa';
const ANDROID_DEVICE_ID = '018f3a5e-0000-7000-8000-0000000000bb';
const MAP_ID = '018f3a5e-0000-7000-8000-000000000001';

function createRealisticMap() {
  return {
    schema: Sharing.PROJECT_SCHEMA,
    savedAt: '2026-11-06T20:00:00.000Z',
    activeThemeId: 'graphite',
    layout: {
      activeThemeId: 'graphite',
      branchStyle: 'rounded',
      compactness: 80,
      branchGapX: 95
    },
    root: {
      id: 'root-strategy',
      text: 'Strategia Prodotto Glauka 2026 🚀',
      children: [
        {
          id: 'branch-arch',
          text: 'Architettura & Modularità',
          children: [
            { id: 'sub-core', text: 'map-core + editor-shared', children: [] },
            { id: 'sub-security', text: 'Isolamento IPC & CSP Rigorosa', children: [] }
          ]
        },
        {
          id: 'branch-views',
          text: 'Sette Viste Collegate',
          children: [
            { id: 'sub-org', text: 'F10a Organigramma Professionale', children: [] },
            { id: 'sub-flow', text: 'Flusso di Lavoro & Kanban', children: [] },
            { id: 'sub-time', text: 'Linea del Tempo Zoomabile', children: [] }
          ]
        },
        {
          id: 'branch-sharing',
          text: 'F11 Condivisione Singola Mappa',
          children: [
            { id: 'sub-handoff', text: 'Handoff Locale Crittografico PC ↔ Android', children: [] },
            { id: 'sub-conflict', text: 'Classificatore Conflitti Determinista', children: [] }
          ]
        }
      ]
    },
    images: [
      { id: 'img-1', name: 'diagramma-architettura.svg', mime: 'image/svg+xml', data: '<svg></svg>' }
    ],
    relationships: [
      { id: 'rel-1', from: 'sub-core', to: 'sub-handoff', label: 'Integrità crittografica' }
    ]
  };
}

describe('MASTER-C2 / F11: PC ↔ Android Single-Map Handoff Roundtrip', () => {
  test('PC creates handoff package and Android receives, validates and verifies 100% roundtrip fidelity', async () => {
    const originalProject = createRealisticMap();

    // 1. PC side: user triggers "Condividi singola mappa"
    const pcHandoff = await Sharing.makeHandoff(originalProject, {
      mapId: MAP_ID,
      deviceId: PC_DEVICE_ID,
      revision: 1,
      parentHash: null,
      sha256
    });

    assert.ok(pcHandoff.manifest);
    assert.equal(pcHandoff.manifest.schema, 'GlaukaMapHandoff-v1');
    assert.equal(pcHandoff.manifest.mapId, MAP_ID);
    assert.equal(pcHandoff.manifest.deviceId, PC_DEVICE_ID);
    assert.equal(pcHandoff.manifest.revision, 1);
    assert.equal(pcHandoff.manifest.parentHash, null);
    assert.equal(pcHandoff.summary.nodes, 11);
    assert.equal(pcHandoff.summary.images, 1);
    assert.equal(pcHandoff.summary.title, 'Strategia Prodotto Glauka 2026 🚀');

    // 2. Simulated transport payload (JSON transmission string / QR payload / local Wi-Fi transfer)
    const transportEnvelope = JSON.stringify({
      manifest: pcHandoff.manifest,
      bytes: pcHandoff.bytes
    });

    // 3. Android side receives the packet
    const receivedPacket = JSON.parse(transportEnvelope);

    // Android reviews against local Android storage where this map does not yet exist
    const initialReview = Sharing.reviewRevision(null, receivedPacket.manifest);
    assert.equal(initialReview.status, 'new-map');
    assert.equal(initialReview.mayReplace, false);

    // Android verifies cryptographic checksum and byte length
    const androidVerified = await Sharing.verifyHandoff({
      manifest: receivedPacket.manifest,
      bytes: receivedPacket.bytes,
      sha256
    });

    assert.ok(androidVerified.project);
    assert.deepEqual(androidVerified.project, originalProject);
    assert.equal(androidVerified.summary.nodes, 11);
    assert.equal(androidVerified.summary.rootId, 'root-strategy');
    assert.equal(androidVerified.summary.title, 'Strategia Prodotto Glauka 2026 🚀');
    assert.equal(androidVerified.project.relationships.length, 1);
    assert.equal(androidVerified.project.relationships[0].label, 'Integrità crittografica');
  });

  test('Android modifies map and hands revision 2 back to PC, which verifies fast-forward candidate', async () => {
    const originalProject = createRealisticMap();

    // PC Rev 1
    const pcHandoffRev1 = await Sharing.makeHandoff(originalProject, {
      mapId: MAP_ID,
      deviceId: PC_DEVICE_ID,
      revision: 1,
      sha256
    });

    // Android imports Rev 1
    const androidMap = JSON.parse(pcHandoffRev1.bytes);

    // Android user adds a node on mobile: "Collaudo Mobile Android Touch"
    androidMap.root.children[2].children.push({
      id: 'sub-touch-tested',
      text: 'Collaudo Mobile Android Touch',
      children: []
    });

    // Android creates Revision 2
    const androidHandoffRev2 = await Sharing.makeHandoff(androidMap, {
      mapId: MAP_ID,
      deviceId: ANDROID_DEVICE_ID,
      revision: 2,
      parentHash: pcHandoffRev1.manifest.sha256,
      sha256
    });

    assert.equal(androidHandoffRev2.manifest.revision, 2);
    assert.equal(androidHandoffRev2.manifest.parentHash, pcHandoffRev1.manifest.sha256);
    assert.equal(androidHandoffRev2.summary.nodes, 12);

    // PC receives Revision 2 while PC local state is clean at Revision 1
    const pcReview = Sharing.reviewRevision(pcHandoffRev1.manifest, androidHandoffRev2.manifest, { localDirty: false });
    assert.equal(pcReview.status, 'fast-forward-candidate');
    assert.equal(pcReview.mayReplace, false); // Host must back up before replacing
    assert.equal(pcReview.requiresBackup, true);
    assert.equal(pcReview.requiresLocalRecheck, true);

    // PC verifies payload integrity
    const pcVerified = await Sharing.verifyHandoff({
      manifest: androidHandoffRev2.manifest,
      bytes: androidHandoffRev2.bytes,
      sha256
    });

    assert.equal(pcVerified.summary.nodes, 12);
    assert.equal(pcVerified.project.root.children[2].children[2].text, 'Collaudo Mobile Android Touch');
  });

  test('Simultaneous conflicting edits on PC and Android are detected and refuse silent overwrite', async () => {
    const originalProject = createRealisticMap();

    // Base Rev 1
    const baseHandoff = await Sharing.makeHandoff(originalProject, {
      mapId: MAP_ID,
      deviceId: PC_DEVICE_ID,
      revision: 1,
      sha256
    });

    // Case A: PC has unsaved local changes (localDirty: true) when incoming Rev 2 arrives
    const incomingRev2 = {
      ...baseHandoff.manifest,
      revision: 2,
      parentHash: baseHandoff.manifest.sha256,
      sha256: 'c'.repeat(64)
    };
    const dirtyConflict = Sharing.reviewRevision(baseHandoff.manifest, incomingRev2, { localDirty: true });
    assert.equal(dirtyConflict.status, 'conflict');
    assert.equal(dirtyConflict.mayReplace, false);

    // Case B: Both PC and Android created Revision 2 independently (forked revision)
    const localRev2 = {
      ...baseHandoff.manifest,
      revision: 2,
      parentHash: baseHandoff.manifest.sha256,
      sha256: 'd'.repeat(64)
    };
    const forkedConflict = Sharing.reviewRevision(localRev2, incomingRev2, { localDirty: false });
    assert.equal(forkedConflict.status, 'conflict');
    assert.equal(forkedConflict.mayReplace, false);
  });

  test('Transmission faults and tampering fail closed immediately', async () => {
    const originalProject = createRealisticMap();
    const handoff = await Sharing.makeHandoff(originalProject, {
      mapId: MAP_ID,
      deviceId: PC_DEVICE_ID,
      revision: 1,
      sha256
    });

    // 1. Corrupted bit / character in transit (same byte length)
    const tamperedBytes = handoff.bytes.replace('Strategia', 'Ztrategia');
    await assert.rejects(
      () => Sharing.verifyHandoff({ manifest: handoff.manifest, bytes: tamperedBytes, sha256 }),
      /integrity mismatch/
    );

    // 2. Truncated packet
    const truncatedBytes = handoff.bytes.slice(0, -10);
    await assert.rejects(
      () => Sharing.verifyHandoff({ manifest: handoff.manifest, bytes: truncatedBytes, sha256 }),
      /byte length mismatch/
    );

    // 3. Foreign mapId
    const otherMapManifest = {
      ...handoff.manifest,
      mapId: '018f3a5e-0000-7000-8000-000000000999'
    };
    const otherReview = Sharing.reviewRevision(handoff.manifest, otherMapManifest);
    assert.equal(otherReview.status, 'other-map');
    assert.equal(otherReview.mayReplace, false);
  });
});
