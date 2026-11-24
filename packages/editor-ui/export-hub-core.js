/* NeuroMap universal export: shared, offline and deterministic. */
(function (host, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  host.NeuroMapExportCore = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const MAX_TABS = 20,
    MAX_NODES = 24000,
    MAX_BYTES = 72 * 1024 * 1024;
  const encoder = new TextEncoder();
  const esc = (s) =>
    String(s ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
      .replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const attr = (s) =>
    esc(s)
      .replace(/\r/g, "&#13;")
      .replace(/\n/g, "&#10;")
      .replace(/\t/g, "&#9;");
  const safe = (s) =>
    String(s || "Mappa")
      .normalize("NFC")
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
      .trim()
      .slice(0, 85) || "Mappa";
  function selected(tabs, mode, ids, currentId) {
    if (!Array.isArray(tabs) || !tabs.length)
      throw Error("Nessuna scheda aperta.");
    if (mode === "current") {
      const current = tabs.find((t) => t.id === currentId);
      if (!current) throw Error("Scheda corrente non trovata.");
      return [current];
    }
    if (mode === "all") return tabs.slice();
    if (mode === "selected") {
      const set = new Set(ids || []);
      const picked = tabs.filter((t) => set.has(t.id));
      if (!picked.length) throw Error("Seleziona almeno una scheda.");
      return picked;
    }
    throw Error("Selezione schede sconosciuta.");
  }
  function inspect(tabs) {
    if (!tabs.length || tabs.length > MAX_TABS)
      throw Error("Esportazione: massimo 20 schede per operazione.");
    let total = 0;
    const summaries = [];
    for (const tab of tabs) {
      const root = tab.state?.root || tab.root;
      const stack = [{ n: root, depth: 0 }],
        seen = new Set();
      let count = 0;
      while (stack.length) {
        const { n, depth } = stack.pop();
        if (
          !n ||
          typeof n !== "object" ||
          typeof n.text !== "string" ||
          seen.has(n)
        )
          throw Error(
            "Struttura non valida o circolare in " + (root?.text || "mappa"),
          );
        seen.add(n);
        if (depth > 100) throw Error("Gerarchia oltre 100 livelli.");
        if (++count > 3500)
          throw Error(
            "Una mappa supera 3500 nodi: suddividila prima di esportarla.",
          );
        for (const c of n.children || [])
          stack.push({ n: c, depth: depth + 1 });
      }
      total += count;
      if (total > MAX_NODES)
        throw Error("Esportazione oltre 24000 nodi: seleziona meno schede.");
      summaries.push({ title: root.text, count });
    }
    return { nodes: total, maps: tabs.length, summaries };
  }
  function collect(root) {
    const rows = [],
      todo = [{ node: root, level: 0 }];
    while (todo.length) {
      const { node, level } = todo.pop();
      rows.push({ node, level });
      for (let i = (node.children || []).length - 1; i >= 0; i--)
        todo.push({ node: node.children[i], level: level + 1 });
    }
    return rows;
  }
  function encodeTextLabel(text) {
    const slash = String.fromCharCode(92),
      value = String(text);
    let out = "";
    for (let i = 0; i < value.length; i++) {
      const ch = value[i],
        code = value.charCodeAt(i);
      if (code === 13) {
        if (value.charCodeAt(i + 1) === 10) i++;
        out += slash + "n";
      } else if (code === 10) out += slash + "n";
      else if (code === 9) out += slash + "t";
      else if (code === 92) out += slash + slash;
      else out += ch;
    }
    out = out.replace(/^ +/, (space) => (slash + "s").repeat(space.length));
    if (out === "=== NEUROMAP TAB ===") out = slash + "=" + out.slice(1);
    return out || slash + "0";
  }
  function decodeTextLabel(text) {
    const slash = String.fromCharCode(92);
    if (text === slash + "0") return "";
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i],
        next = text[i + 1];
      if (ch === slash && [slash, "n", "t", "s", "="].includes(next)) {
        out +=
          next === "n"
            ? String.fromCharCode(10)
            : next === "t"
              ? String.fromCharCode(9)
              : next === "s"
                ? " "
                : next;
        i++;
      } else out += ch;
    }
    return out;
  }
/* @neuromap-export-hub-core-writers */
/* @neuromap-export-hub-core-parsers */
/* @neuromap-export-hub-core-render */
/* @neuromap-export-hub-core-pdf */
  return Object.freeze({
    selected,
    inspect,
    collect,
    txt,
    opml,
    freemind,
    html,
    zip,
    docx,
    render,
    pdf,
    parseFreeMind,
    parseTxtBatch,
    MAX_TABS,
    MAX_NODES,
  });
});
