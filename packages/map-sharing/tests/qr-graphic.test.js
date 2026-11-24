"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const qr = require("../../editor-ui/editor-shared/qr-graphic.js");

test("a byte QR round-trips and refuses an oversized payload", () => {
  assert.equal(qr.capacity(1), 14);
  assert.equal(qr.maxBytes, qr.capacity(20));
  for (const text of ["A", "{\"v\":1}", "m".repeat(40), "k".repeat(qr.maxBytes)]) {
    const code = qr.encode(text);
    assert.ok(code && code.size >= 21);
    assert.equal(qr.decode(code), text);
  }
  assert.equal(qr.encode("z".repeat(qr.maxBytes + 1)), null);
});

test("the real pairing offer fits in one scannable code", async () => {
  const crypto = require("node:crypto");
  const Transfer = require("../../map-sharing/transfer");
  const sha256 = async (str) => crypto.createHash("sha256").update(str, "utf8").digest("hex");
  const sender = await Transfer.createSender({
    project: { schema: "NeuroMapArchitect-SingleTab-v6", root: { id: "r", text: "Mappa", children: [] }, images: [], relationships: [] },
    mapId: "018f3a5e-0000-7000-8000-000000000001",
    deviceId: "018f3a5e-0000-7000-8000-0000000000aa",
    sha256,
    ttlMs: 120000,
    now: () => Date.parse("2026-11-14T21:00:00.000Z")
  });
  const text = sender.qr();
  const code = qr.encode(text);
  assert.ok(code);
  assert.equal(qr.decode(code), text);
  assert.ok(text.length <= qr.maxBytes);
});

test("a damaged code is not accepted as the original message", () => {
  const text = "pairing-offer-0123456789";
  const code = qr.encode(text);
  const damaged = { version: code.version, size: code.size, modules: code.modules.slice() };
  damaged.modules[10 * code.size + 12] ^= 1;
  assert.throws(() => qr.decode(damaged));
});
