"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function element(tag) {
  return {
    tag,
    id: "",
    className: "",
    hidden: false,
    textContent: "",
    type: "",
    value: "",
    placeholder: "",
    title: "",
    checked: false,
    children: [],
    dataset: {},
    style: {},
    attributes: {},
    listeners: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    append(...nodes) {
      for (const node of nodes) {
        node.parentElement = this;
        this.children.push(node);
      }
    },
    replaceChildren(...nodes) {
      this.children = [];
      if (nodes.length) this.append(...nodes);
    },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); },
    focus() { globalThis.document.activeElement = this; },
    remove() {
      const parent = this.parentElement;
      if (parent) parent.children = parent.children.filter((child) => child !== this);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const all = [];
      const walk = (node) => {
        all.push(node);
        for (const child of node.children || []) walk(child);
      };
      walk(this);
      return all.filter((node) => node !== this && matches(node, selector));
    },
    get offsetParent() { return this.hidden ? null : this.parentElement || {}; },
    get isConnected() { return true; }
  };
}

function matches(node, selector) {
  if (selector === "button") return node.tag === "button";
  if (selector === "button,input,select") return ["button", "input", "select"].includes(node.tag);
  if (selector === ".gl-settings-row") return node.className === "gl-settings-row";
  if (selector === ".gl-settings-copy") return node.className === "gl-settings-copy";
  if (selector === ".gl-settings-control") return node.className === "gl-settings-control";
  if (selector === ".tab-bar") return String(node.className).includes("tab-bar");
  if (selector.startsWith("[data-category=")) return node.dataset.category === selector.slice(16, -2);
  return false;
}

function treeFind(id, nodes) {
  for (const node of nodes) {
    if (!node) continue;
    if (node.id === id) return node;
    const found = treeFind(id, node.children || []);
    if (found) return found;
  }
  return null;
}

function installDocument() {
  const head = element("head");
  const body = element("body");
  const bar = element("div");
  bar.className = "tab-bar";
  body.append(bar);
  const menu = element("div");
  menu.id = "dropdown-file";
  body.append(menu);
  const document = {
    documentElement: { lang: "it", dataset: {} },
    head,
    body,
    activeElement: null,
    listeners: {},
    createElement: (tag) => element(tag),
    getElementById: (id) => treeFind(id, [head, body]),
    querySelector: (selector) => body.querySelector(selector),
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  };
  globalThis.document = document;
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
  return { document, data, bar };
}

test("the window opens from the gear, the menu and the shortcut, then returns to the gear", () => {
  const { document, data } = installDocument();
  globalThis.NeuroMapAppSettings = require("../settings-center-core.js");
  require("../settings-center.js");
  globalThis.NeuroMapSettingsCenter.install();
  const gear = document.getElementById("gl-settings-quick");
  assert.equal(gear.getAttribute("aria-label"), "Impostazioni");
  assert.equal(gear.title, "Impostazioni");
  const menu = document.getElementById("menu-settings");
  assert.equal(menu.children[0].textContent, "Impostazioni…");
  gear.listeners.click[0]();
  assert.ok(document.getElementById("gl-settings-center"));
  const css = document.getElementById("gl-settings-css").textContent;
  assert.match(css, /#gl-settings-center \.gl-settings-row\{display:flex/);
  assert.doesNotMatch(css, /#gl-settings-row\{/);
  const sample = document.getElementById("gl-settings-body").querySelector(".gl-settings-row");
  assert.equal(sample.className, "gl-settings-row");
  assert.ok(sample.querySelector(".gl-settings-copy"));
  assert.ok(sample.querySelector(".gl-settings-control"));
  assert.equal(document.activeElement.id, "gl-settings-search");
  document.getElementById("gl-settings-search").value = "zoom";
  document.getElementById("gl-settings-search").listeners.input[0]();
  const navigation = document.getElementById("gl-settings-nav").querySelector('[data-category="navigation"]');
  assert.equal(navigation.hidden, false);
  assert.equal(document.getElementById("gl-settings-nav").querySelector('[data-category="cloud"]').hidden, true);
  const speed = document.getElementById("gl-settings-zoom-speed");
  speed.value = "3";
  speed.listeners.input[0]();
  assert.equal(JSON.parse(data.get("glauka.app.zoom.v1")).speed, 3);
  document.listeners.keydown[0]({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(document.getElementById("gl-settings-center"), null);
  assert.equal(document.activeElement.id, "gl-settings-quick");
  document.listeners.keydown[0]({
    key: ",", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
    target: { closest: () => null }, preventDefault() {}, stopPropagation() {}
  });
  assert.ok(document.getElementById("gl-settings-center"));
  document.listeners.keydown[0]({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  menu.listeners.click[0]();
  assert.ok(document.getElementById("gl-settings-center"));
});

test("appearance keeps one control for each interface preference", () => {
  const { document } = installDocument();
  globalThis.NeuroMapUISkinCore = require("../ui-skin-core.js");
  globalThis.NeuroMapUISkin = {
    get: () => ({ theme: "prisma", contrast: "normal", readability: "standard" }),
    set(value) { this.get = () => ({ theme: "prisma", contrast: "normal", readability: "standard", ...value }); }
  };
  globalThis.NeuroMapOrbit = {
    get: () => ({ enabled: true, accent: "auto", density: "comfortable" }),
    set(value) { const current = this.get(); this.get = () => ({ ...current, ...value }); }
  };
  globalThis.NeuroMapMotion = {
    get: () => ({ branches: true, interface: true, duration: 360, reduced: false }),
    set(value) { const current = this.get(); this.get = () => ({ ...current, ...value }); return this.get(); }
  };
  globalThis.NeuroMapAppSettings = require("../settings-center-core.js");
  require("../settings-center.js");
  globalThis.NeuroMapSettingsCenter.install();
  globalThis.NeuroMapSettingsCenter.close();
  document.getElementById("gl-settings-quick").listeners.click[0]();
  document.getElementById("gl-settings-nav").querySelector('[data-category="appearance"]').listeners.click[0]();
  const inside = (id) => {
    let node = document.getElementById(id);
    while (node) {
      if (node.id === "gl-settings-body") return true;
      node = node.parentElement;
    }
    return false;
  };
  assert.equal(inside("gl-settings-contrast"), true);
  assert.equal(inside("gl-settings-control-size"), true);
  assert.equal(inside("gl-settings-accent"), true);
  assert.equal(inside("gl-settings-panel-spacing"), true);
  assert.equal(inside("gl-settings-motion-interface"), true);
  assert.equal(document.getElementById("nm-ui-skin-settings"), null);
  assert.equal(document.getElementById("gl-settings-theme-prisma").getAttribute("aria-pressed"), "true");
  assert.equal(document.getElementById("gl-settings-theme-slate").getAttribute("aria-pressed"), "false");
  assert.equal(document.getElementById("gl-settings-edit-zoom"), null);
  document.getElementById("gl-settings-nav").querySelector('[data-category="navigation"]').listeners.click[0]();
  assert.ok(document.getElementById("gl-settings-edit-zoom"));
  document.getElementById("gl-settings-nav").querySelector('[data-category="editor"]').listeners.click[0]();
  assert.ok(document.getElementById("gl-settings-branch-motion"));
  assert.equal(document.getElementById("gl-settings-edit-zoom"), null);
});

test("settings do not store an API key in the page memory", () => {
  const source = fs.readFileSync(path.join(__dirname, "../settings-center.js"), "utf8");
  assert.match(source, /btn-ai-settings/);
  assert.match(source, /gl-cloud-quick/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^)]*apiKey/i);
  assert.match(source, /non viene scritta nella mappa/i);
  assert.doesNotMatch(source, /Ripristina lo zoom/);
});

test("saving, new-map sliders, privacy and about use the real controls", async () => {
  const { document, data } = installDocument();
  const saved = [];
  globalThis.NM611 = { preferences: () => ({ minutes: 0 }) };
  globalThis.neuroMapApp = {
    nm611ConfigureAutosave(minutes) { saved.push(minutes); },
    exportData() { saved.push("export"); },
    openSaveStatus() { saved.push("status"); },
    async nmAsk() { return "reset"; }
  };
  globalThis.NeuroMapUISkin = { set(value) { saved.push(["skin", value]); } };
  globalThis.NeuroMapOrbit = { set(value) { saved.push(["orbit", value]); } };
  globalThis.neuromapDesktop = { productStatus: async () => ({ plan: "free" }) };
  globalThis.NeuroMapAppSettings = require("../settings-center-core.js");
  require("../settings-center.js");
  const versions = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../versions.json"), "utf8"));
  document.documentElement.dataset.neuromapVersion = versions.windows.version;
  globalThis.NeuroMapSettingsCenter.install();
  globalThis.NeuroMapSettingsCenter.close();
  document.getElementById("gl-settings-quick").listeners.click[0]();
  document.getElementById("gl-settings-nav").querySelector('[data-category="general"]').listeners.click[0]();
  const autosave = document.getElementById("gl-settings-autosave-minutes");
  assert.equal(autosave.value, "0");
  assert.equal(autosave.children[0].textContent, "Solo copia di recupero continua (predefinito)");
  autosave.value = "5";
  autosave.listeners.change[0]();
  assert.deepEqual(saved, [5]);
  assert.equal(document.getElementById("gl-settings-nav").querySelector('[data-category="files"]').hidden, true);
  document.getElementById("gl-settings-nav").querySelector('[data-category="editor"]').listeners.click[0]();
  assert.equal(document.getElementById("gl-settings-compactness-value").textContent, "55%");
  assert.equal(document.getElementById("gl-settings-gap-value").textContent, "30 px");
  const compact = document.getElementById("gl-settings-new-map-compactness");
  compact.value = "80";
  compact.listeners.input[0]();
  assert.equal(document.getElementById("gl-settings-compactness-value").textContent, "80%");
  assert.equal(JSON.parse(data.get("neuromap.editor.spacing.defaults.v1")).compactness, 80);
  assert.equal(document.getElementById("gl-settings-import-size").value, "125");
  const buttons = [];
  const walk = (node) => {
    if (node.tag === "button") buttons.push(node.textContent);
    for (const child of node.children || []) walk(child);
  };
  walk(document.getElementById("gl-settings-body"));
  assert.equal(buttons.includes("Ripristina lo zoom"), false);
  document.getElementById("gl-settings-nav").querySelector('[data-category="privacy"]').listeners.click[0]();
  document.getElementById("gl-settings-export-backup").listeners.click[0]();
  assert.equal(saved.at(-1), "export");
  document.getElementById("gl-settings-open-recovery").listeners.click[0]();
  assert.equal(saved.at(-1), "status");
  await document.getElementById("gl-settings-reset-ui-prefs").listeners.click[0]();
  assert.deepEqual(saved.at(-2), ["skin", { theme: "prisma", contrast: "normal", readability: "standard" }]);
  assert.deepEqual(saved.at(-1), ["orbit", { accent: "auto", density: "comfortable" }]);
  assert.equal(data.has("glauka.app.zoom.v1"), false);
  document.getElementById("gl-settings-nav").querySelector('[data-category="about"]').listeners.click[0]();
  await Promise.resolve();
  assert.equal(document.getElementById("gl-settings-edition").textContent, versions.windows.version);
  assert.equal(document.getElementById("gl-settings-plan").textContent, "Free");
  const details = [];
  const readDetails = (node) => {
    if (node.tag === "dd") details.push(node.textContent);
    for (const child of node.children || []) readDetails(child);
  };
  readDetails(document.getElementById("gl-settings-body"));
  assert.equal(details.includes(`${versions.editor} (SingleTab-v6)`), true);
  assert.equal(details.includes("glauka.it"), true);
});
