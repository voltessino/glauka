const composeStateSource=require('./helpers/compose-state-source.cjs');
const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("./helpers/compose-rich-caption.cjs")();
test("safe ranges preserve text, strip arbitrary HTML styles and clamp hostile metadata", () => {
  const d = C.sanitize("cellule β e α", [
    {
      start: -5,
      end: 8,
      bold: true,
      color: "#AA00FF",
      font: "evil",
      url: "javascript:x",
    },
    { start: 8, end: 100, italic: true, color: "red;background:url(x)" },
  ]);
  assert.equal(d.text, "cellule β e α");
  assert.deepEqual(d.spans, [
    { start: 0, end: 8, bold: true, color: "#aa00ff" },
    { start: 8, end: d.text.length, italic: true },
  ]);
  assert.equal(C.sanitize("a".repeat(9000), []).text.length, C.MAX);
});
test("selected words support independent bold, italic, underline and colours", () => {
  let d = C.sanitize("insulina glucagone", []);
  d = C.apply(d, 0, 8, { bold: true, color: "#aa00ff" });
  d = C.apply(d, 9, 18, { italic: true, underline: true, color: "#0088ff" });
  assert.deepEqual(C.selectedStyle(d, 0, 8), { bold: true, color: "#aa00ff" });
  assert.equal(C.selectedStyle(d, 9, 18).underline, true);
  d = C.apply(d, 0, 8, { bold: false, color: null });
  assert.deepEqual(C.selectedStyle(d, 0, 8), {});
  assert.equal(d.text, "insulina glucagone");
});
test("editing and list prefixes shift style ranges without dropping coloured body words", () => {
  let d = C.apply(C.sanitize("insulina\nglucagone", []), 9, 18, {
    color: "#0088ff",
  });
  d = C.list(d, "number");
  assert.equal(d.text, "1. insulina\n2. glucagone");
  const from = d.text.indexOf("glucagone");
  assert.equal(C.selectedStyle(d, from, d.text.length).color, "#0088ff");
  d = C.list(d, "none");
  assert.equal(d.text, "insulina\nglucagone");
  assert.equal(C.selectedStyle(d, 9, 18).color, "#0088ff");
  d = C.edit(d, "nuova insulina\nglucagone");
  assert.equal(
    C.selectedStyle(d, d.text.indexOf("glucagone"), d.text.length).color,
    "#0088ff",
  );
});
for (const [line, next] of [
  ["a) testo", "\nb) "],
  ["1) testo", "\n2) "],
  ["1. testo", "\n2. "],
  ["- testo", "\n- "],
  ["• testo", "\n• "],
  ["* testo", "\n* "],
  ["z) testo", "\naa) "],
  ["i) testo", "\nii) "],
  ["h) testo\ni) testo", "\nj) "],
])
  test("automatic list continuation: " + line, () => {
    const r = C.continueList(line, line.length);
    assert.equal(r.insert, next);
    assert.equal(r.caret, line.length + next.length);
  });
test("empty list item ends the list and ordinary prose/hyphens stay ordinary text", () => {
  assert.deepEqual(C.continueList("1) prova\n2) ", 12), {
    start: 9,
    end: 12,
    insert: "",
    caret: 9,
  });
  for (const text of ["testo normale", "e-mail", "a)testo"])
    assert.equal(C.continueList(text, text.length), null);
});
test("layout wraps words and paints underline/colours without losing multiline content", () => {
  const calls = [],
    ctx = {
      font: "",
      save() {
        calls.push("save");
      },
      restore() {
        calls.push("restore");
      },
      measureText(text) {
        return { width: text.length * 6 };
      },
      fillText(text) {
        calls.push(text);
      },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {
        calls.push("underline");
      },
    };
  const d = C.apply(C.sanitize("uno\ndue", []), 0, 3, {
    underline: true,
    color: "#ff0000",
  });
  const lines = C.layout(ctx, d, 80);
  assert.equal(lines.length, 2);
  C.paint(ctx, d, { x: 0, y: 0, w: 92 });
  assert.ok(calls.includes("uno"));
  assert.ok(calls.includes("due"));
  assert.ok(calls.includes("underline"));
  assert.ok(C.height(ctx, d, 92) >= 42);
});

const MapCore = require("../../map-core");
test("PR132: pinned sides do not change the reported contiguous cut", () => {
  const nodes = Array.from({ length: 4 }, (_, i) => ({
    id: "n" + i,
    sidePinned: i === 0 ? "left" : i === 1 ? "right" : null,
  }));
  const before = JSON.stringify(nodes),
    metrics = MapCore.splitClockwise(nodes, [40, 40, 40, 40], 12, 50);
  assert.equal(metrics.splitIndex, 2);
  assert.equal(metrics.rightCount, 1);
  assert.deepEqual(metrics.rightIds, ["n1"]);
  assert.equal(JSON.stringify(nodes), before);
});
test("Roman lists continue through single-letter Roman numerals", () => {
  const text = "iv) Quarto\nv) Quinto";
  assert.equal(C.continueList(text, text.length).insert, "\nvi) ");
});
test("long multiline captions are measured in full instead of silently truncating at forty lines", () => {
  const ctx = {
    save() {},
    restore() {},
    measureText(text) {
      return { width: text.length * 6 };
    },
  };
  assert.equal(
    C.layout(ctx, C.sanitize(Array(60).fill("voce").join("\n")), 200).length,
    60,
  );
});
for (const platform of ["android", "desktop-shared"])
  test(platform + " snapshots preserve safe rich-caption metadata", () => {
    const fs = require("node:fs"),
      vm = require("node:vm"),
      path = require("node:path");
    const sandbox = { NeuroMapCaption: C };
    vm.createContext(sandbox);
    vm.runInContext(
      fs.readFileSync(
        path.join(__dirname, "../../../apps", platform, "editor/state.js"),
        "utf8",
      ) + "\nglobalThis.TestState=MindMapStateMachine;",
      sandbox,
    );
    const text = "Titolo lungo ".repeat(30),
      styles = [
        { start: 0, end: 6, bold: true, color: "#AA00FF", url: "javascript:x" },
      ];
    const result = sandbox.TestState.cloneImages([
      {
        id: "image",
        src: "data:image/png;base64,",
        caption: text,
        captionStyles: styles,
      },
    ])[0];
    assert.equal(result.caption, text);
    assert.deepEqual(JSON.parse(JSON.stringify(result.captionStyles)), [
      { start: 0, end: 6, bold: true, color: "#aa00ff" },
    ]);
  });
