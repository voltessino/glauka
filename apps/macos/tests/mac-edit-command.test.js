"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "native");
const script = fs.readFileSync(path.join(root, "mac-edit.js"), "utf8");
const context = vm.createContext({
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  File: class File {
    constructor(bits, name, options) {
      this.bits = bits;
      this.name = name;
      this.type = options.type;
    }
  },
});
vm.runInContext(script, context);
const edit = context.GlaukaMacEdit;

function element(tag, options = {}) {
  return {
    disabled: !!options.disabled,
    readOnly: !!options.readOnly,
    hidden: !!options.hidden,
    isContentEditable: !!options.contentEditable,
    classList: { contains: (name) => (options.classes || []).includes(name) },
    getAttribute: (name) => (name === "type" ? options.type || "text" : null),
    matches: (selector) => selector === "input" && tag === "input",
    closest(selector) {
      if (options.dialog && selector.includes('role="dialog"')) return this;
      if (tag === "textarea" && selector.startsWith("textarea")) return this;
      if (tag === "input" && selector.startsWith("textarea")) return this;
      if (options.editable && selector.includes("contenteditable")) return this;
      return null;
    },
  };
}

function app() {
  const calls = [];
  return {
    calls,
    state: { selectedNodeId: "n1", selectedImageId: null },
    copySelection() { calls.push("copy"); },
    cutSelection() { calls.push("cut"); },
    selectAllBranches() { calls.push("selectAll"); },
    undo() { calls.push("undo"); },
    redo() { calls.push("redo"); },
    pasteSelection() { calls.push("paste-internal"); },
    nm66PasteOutline(text, html) { calls.push(["paste-text", text, html]); },
    io: { attachImageFileToNode(file, nodeId) { calls.push(["paste-image", file.type, nodeId]); } },
  };
}

test("canvas commands copy, cut, select and undo branches", () => {
  const map = app();
  const doc = { activeElement: element("canvas"), getElementById: () => null };
  assert.equal(edit.command(map, { name: "copy" }, doc), "copy");
  assert.equal(edit.command(map, { name: "cut" }, doc), "cut");
  assert.equal(edit.command(map, { name: "selectAll" }, doc), "selectAll");
  assert.equal(edit.command(map, { name: "undo", shift: false }, doc), "undo");
  assert.equal(edit.command(map, { name: "undo", shift: true }, doc), "redo");
  assert.deepEqual(map.calls, ["copy", "cut", "selectAll", "undo", "redo"]);
});

test("a text field, contenteditable child, or dialog asks for native editing", () => {
  const map = app();
  const doc = { activeElement: element("textarea"), getElementById: () => null };
  assert.equal(edit.command(map, { name: "copy" }, doc), "editing");
  doc.activeElement = element("input", { type: "text" });
  assert.equal(edit.command(map, { name: "paste", text: "esterno" }, doc), "editing");
  doc.activeElement = element("span", { contentEditable: true });
  assert.equal(edit.isEditingField(doc.activeElement), true);
  assert.equal(edit.command(map, { name: "cut" }, doc), "editing");
  doc.activeElement = element("div", { editable: true });
  assert.equal(edit.command(map, { name: "selectAll" }, doc), "editing");
  doc.activeElement = element("p", { dialog: true });
  assert.equal(edit.command(map, { name: "copy" }, doc), "editing");
  assert.equal(edit.command(map, { name: "selectAll" }, doc), "editing");
  assert.equal(edit.command(map, { name: "cut" }, doc), "ignored");
  assert.equal(edit.command(map, { name: "undo" }, doc), "ignored");
  assert.deepEqual(map.calls, []);
});

test("paste keeps Glauka branches, external text, and images apart", () => {
  const map = app();
  map.internalClipboard = { kind: "nodes" };
  map._clipboardPlain = "Ramo";
  const doc = { activeElement: element("canvas"), getElementById: () => null };
  assert.equal(edit.command(map, { name: "paste", text: "Ramo" }, doc), "paste-internal");
  assert.equal(edit.command(map, { name: "paste", text: "Testo esterno", html: "<p>Testo esterno</p>" }, doc), "paste-text");
  assert.equal(edit.command(map, { name: "paste", image: Buffer.from("png").toString("base64") }, doc), "paste-image");
  assert.deepEqual(map.calls[1], ["paste-text", "Testo esterno", "<p>Testo esterno</p>"]);
  assert.equal(map.calls[2][0], "paste-image");
  assert.equal(map.calls[2][1], "image/png");
  assert.equal(map.calls[2][2], "n1");
});

test("the shared editor already treats Command as the same modifier as Control", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../desktop-shared/editor/app-bind-ui.js"), "utf8");
  const modifier = source.indexOf("const mod=e.ctrlKey||e.metaKey;");
  assert.ok(modifier > 0);
  const copy = source.indexOf("if(mod&&e.key.toLowerCase()==='c')", modifier);
  assert.ok(copy > modifier);
  assert.ok(source.indexOf("if(inputFocused)", modifier) < copy);
});
