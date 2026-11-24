"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../node-text-core");
test("only known local font families and six-digit colors reach canvas or XML", () => {
  for (const fontFamily of C.FONTS) {
    assert.equal(C.family({ fontFamily }), fontFamily);
    assert.ok(!C.svgFamily({ fontFamily }).includes('"'));
  }
  for (const fontFamily of [
    '"><script>',
    null,
    "url(https://example.org/x)",
    "Arial; color:red",
  ])
    assert.equal(C.family({ fontFamily }), "Inter");
  assert.equal(C.color({ fontColor: "#8b2355" }), "#8b2355");
  for (const fontColor of ["red", "#fff", "url(x)", '#123456"', {}])
    assert.equal(C.color({ fontColor }), null);
});
