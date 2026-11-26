'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const pack = require('../object-gallery-healthicons.js');
const Suggest = require('../inline-smart-suggest.js');

test('O(1) inverted index builds from real offline SVG pack and looks up tokens in under 1ms', () => {
  const index = Suggest.buildIndex({ svgItems: pack.ITEMS });
  assert.ok(index.size > 200, 'Expected inverted index to contain rich offline vocabulary');

  const t0 = performance.now();
  let hits = null;
  for (let i = 0; i < 100; i++) {
    hits = Suggest.lookup('Anatomia del cuore', 18, { index, mode: 'all' });
  }
  const avgMs = (performance.now() - t0) / 100;
  assert.ok(avgMs < 1.0, `Expected <1ms per lookup, got ${avgMs.toFixed(3)}ms`);
  assert.ok(hits.some((h) => h.kind === 'svg'), 'Expected vector SVG match for "cuore"');
});

test('shorthands, semantic symbols, and mode filters respect user preferences', () => {
  const index = Suggest.buildIndex({ svgItems: pack.ITEMS });

  // Shorthand arrow
  const arrowHits = Suggest.lookup('Causa ->', 8, { index, mode: 'all' });
  assert.equal(arrowHits[0].kind, 'shorthand');
  assert.equal(arrowHits[0].symbol, '→');
  const transformed = Suggest.applyTextTransform('Causa ->', 8, arrowHits[0]);
  assert.equal(transformed.text, 'Causa →');
  assert.equal(transformed.caret, 7);

  // Semantic prefix toggle without duplicating glyph
  const warnHits = Suggest.lookup('Massima attenzione', 18, { index, mode: 'symbols' });
  assert.ok(warnHits.length > 0 && warnHits.every((h) => h.kind !== 'svg'));
  const t1 = Suggest.applyTextTransform('Massima attenzione', 18, warnHits[0]);
  assert.equal(t1.text, '⚠ Massima attenzione');
  const t2 = Suggest.applyTextTransform(t1.text, t1.caret, warnHits[0]);
  assert.equal(t2.text, 'Massima attenzione');

  // SVG-only mode suppresses symbol chips
  const svgOnly = Suggest.lookup('attenzione al microscopio', 25, { index, mode: 'svg' });
  assert.ok(svgOnly.length > 0 && svgOnly.every((h) => h.kind === 'svg'));

  // Memory storage preference toggle
  const mem = new Map();
  const fakeStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
  assert.equal(Suggest.isEnabled(fakeStorage), true);
  Suggest.setEnabled(false, fakeStorage);
  assert.equal(Suggest.isEnabled(fakeStorage), false);
  assert.equal(Suggest.setMode('svg', fakeStorage), 'svg');
  assert.equal(Suggest.getMode(fakeStorage), 'svg');
});
