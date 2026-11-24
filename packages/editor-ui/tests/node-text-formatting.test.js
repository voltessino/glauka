const composeStateSource=require('./helpers/compose-state-source.cjs');
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
for (const platform of ["desktop-shared", "android"]) {
  test(
    platform +
      ": underline and subsequent-line indent paint actual text geometry",
    () => {
      const source = fs.readFileSync(
          path.join(__dirname, "../../../apps", platform, "editor/renderer.js"),
          "utf8",
        );
      const Renderer=vm.runInNewContext(source+'\nOrganicCanvasRenderer');
      const renderer=Object.create(Renderer.prototype);
      const calls = [],
        strokes = [],
        ctx = {
          fillText(text, x, y) {
            calls.push([text, x, y]);
          },
          measureText(text) {
            return { width: text.length * 8 };
          },
          save() {},
          restore() {},
          beginPath() {},
          moveTo(x, y) {
            strokes.push([x, y]);
          },
          lineTo() {},
          stroke() {},
        };
      renderer.drawIllustratedLabel(
        ctx,
        {
          text: "prima\nseconda",
          fontUnderline: true,
          labelAlign: "left",
          labelIndent: 24,
        },
        {
          lines: ["prima", "seconda"],
          x: 100,
          y: 50,
          textWidth: 80,
          fontSize: 16,
          lineHeight: 20,
        },
      );
      assert.equal(calls[1][1] - calls[0][1], 24);
      assert.equal(strokes.length, 2);
    },
  );
  test(
    platform +
      ": snapshots retain underlining without inventing styles on old nodes",
    () => {
      const context = {};
      vm.createContext(context);
      vm.runInContext(
        fs.readFileSync(
          path.join(__dirname, "../../../apps", platform, "editor/state.js"),
          "utf8",
        ) + "\nglobalThis.State=MindMapStateMachine;",
        context,
      );
      const root = context.State.cloneTree({
        id: "r",
        text: "root",
        children: [
          { id: "n", text: "test", fontUnderline: true, children: [] },
        ],
      });
      assert.equal(root.children[0].fontUnderline, true);
      assert.equal(Object.hasOwn(root, "fontUnderline"), false);
    },
  );
}
test("Markdown roundtrip preserves underlining together with list text and indent", () => {
  const C = require("../../map-core"),
    root = {
      text: "Root",
      fontUnderline: true,
      children: [
        {
          text: "1. primo\n2. secondo",
          labelIndent: 24,
          fontUnderline: true,
          children: [],
        },
      ],
    };
  assert.deepEqual(C.parseMarkdownExport(C.serializeMarkdown(root)), [root]);
});
