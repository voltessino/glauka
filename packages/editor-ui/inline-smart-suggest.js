/* Offline O(1) inline symbol & vector SVG smart suggestions while editing a node.
 * Zero network requests, zero startup cost (lazy inverted index), 180ms debounce,
 * and zero interception of Enter / Tab / Escape / Arrow navigation keys.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NeuroMapInlineSuggest = api;
})(globalThis, function (root) {
  "use strict";

  const PREF_ENABLED_KEY = "glauka.edit.smartSuggest.v1";
  const PREF_MODE_KEY = "glauka.edit.smartSuggestMode.v1"; // "all" | "symbols" | "svg"
  const DEBOUNCE_MS = 180;
  const MAX_SUGGESTIONS = 4;

  const STOPWORDS = new Set([
    "il", "lo", "la", "gli", "le", "un", "una", "uno", "di", "del", "dello", "della",
    "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "da", "dal",
    "nel", "nella", "nei", "nelle", "con", "per", "tra", "fra", "che", "non", "piu",
    "come", "sono", "alla", "questo", "questa", "the", "and", "for", "with", "from",
    "into", "over", "under", "your", "this", "that",
  ]);

  const SHORTHANDS = [
    ["<->", "↔", "Doppia freccia", "Two-way"],
    ["<=>", "↔", "Doppia freccia", "Two-way"],
    ["-->", "→", "Freccia", "Arrow"],
    ["<--", "←", "Freccia sin.", "Left arrow"],
    ["->", "→", "Freccia", "Arrow"],
    ["=>", "⇒", "Implica", "Implies"],
    ["<-", "←", "Da", "From"],
    ["!=", "≠", "Diverso", "Not equal"],
    [">=", "≥", "Maggiore/ug.", "Greater/eq"],
    ["<=", "≤", "Minore/ug.", "Less/eq"],
    ["+-", "±", "Più/meno", "Plus/minus"],
    ["~=", "≈", "Circa", "Approx"],
  ];

  const SYMBOL_TRIGGERS = [
    { symbol: "⚠", it: "Attenzione", en: "Warning", placement: "prefix", words: ["attenzione", "pericolo", "rischio", "allarme", "critico", "causa", "warning", "danger", "risk", "alert"] },
    { symbol: "❗", it: "Importante", en: "Important", placement: "prefix", words: ["importante", "urgente", "nota", "ricorda", "essenziale", "chiave", "important", "urgent", "key", "crucial"] },
    { symbol: "✓", it: "Completato", en: "Done", placement: "prefix", words: ["fatto", "completato", "corretto", "verificato", "vero", "risolto", "done", "completed", "verified", "correct"] },
    { symbol: "✗", it: "Escluso", en: "Excluded", placement: "prefix", words: ["errore", "falso", "vietato", "errato", "escluso", "error", "wrong", "false"] },
    { symbol: "❓", it: "Domanda", en: "Question", placement: "prefix", words: ["domanda", "dubbio", "ipotesi", "perche", "quesito", "question", "doubt", "why", "hypothesis"] },
    { symbol: "💡", it: "Idea / Esempio", en: "Idea / Example", placement: "prefix", words: ["idea", "esempio", "spunto", "intuizione", "consiglio", "example", "insight", "tip"] },
    { symbol: "🎯", it: "Obiettivo", en: "Goal", placement: "prefix", words: ["obiettivo", "scopo", "traguardo", "target", "goal", "focus", "milestone"] },
    { symbol: "❶", it: "Priorità 1", en: "Priority 1", placement: "prefix", words: ["priorita", "primo", "fase1", "step1", "priority", "first"] },
    { symbol: "❷", it: "Priorità 2", en: "Priority 2", placement: "prefix", words: ["secondo", "fase2", "step2", "second"] },
    { symbol: "❸", it: "Priorità 3", en: "Priority 3", placement: "prefix", words: ["terzo", "fase3", "step3", "third"] },
    { symbol: "α", it: "Alfa", en: "Alpha", placement: "inline", words: ["alfa", "alpha"] },
    { symbol: "β", it: "Beta", en: "Beta", placement: "inline", words: ["beta"] },
    { symbol: "γ", it: "Gamma", en: "Gamma", placement: "inline", words: ["gamma"] },
    { symbol: "Δ", it: "Delta / Variaz.", en: "Delta / Change", placement: "inline", words: ["delta", "variazione"] },
    { symbol: "θ", it: "Theta", en: "Theta", placement: "inline", words: ["theta", "teta"] },
    { symbol: "λ", it: "Lambda", en: "Lambda", placement: "inline", words: ["lambda"] },
    { symbol: "π", it: "Pi greco", en: "Pi", placement: "inline", words: ["pigreco"] },
    { symbol: "∑", it: "Somma", en: "Sum", placement: "inline", words: ["somma", "sommatoria", "totale", "sum"] },
    { symbol: "∞", it: "Infinito", en: "Infinity", placement: "inline", words: ["infinito", "infinity"] },
    { symbol: "√", it: "Radice", en: "Root", placement: "inline", words: ["radice", "sqrt"] },
  ];

  function normalizeWord(raw) {
    return String(raw || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function isEnabled(storage = root.localStorage) {
    try {
      const v = storage?.getItem?.(PREF_ENABLED_KEY);
      return v == null ? true : v !== "0";
    } catch {
      return true;
    }
  }

  function setEnabled(enabled, storage = root.localStorage) {
    try {
      storage?.setItem?.(PREF_ENABLED_KEY, enabled ? "1" : "0");
    } catch {}
  }

  function getMode(storage = root.localStorage) {
    try {
      const m = storage?.getItem?.(PREF_MODE_KEY) || "all";
      return m === "symbols" || m === "svg" ? m : "all";
    } catch {
      return "all";
    }
  }

  function setMode(mode, storage = root.localStorage) {
    const clean = mode === "symbols" || mode === "svg" ? mode : "all";
    try {
      storage?.setItem?.(PREF_MODE_KEY, clean);
    } catch {}
    return clean;
  }

  function buildIndex(sources = {}) {
    const symbolMap = new Map();
    const svgMap = new Map();

    const addSymbol = (token, entry) => {
      if (!token || token.length < 2) return;
      let list = symbolMap.get(token);
      if (!list) {
        list = [];
        symbolMap.set(token, list);
      }
      if (!list.some((x) => x.symbol === entry.symbol)) {
        list.push(entry);
      }
    };

    for (const item of SYMBOL_TRIGGERS) {
      for (const w of item.words) {
        addSymbol(normalizeWord(w), {
          kind: "symbol",
          symbol: item.symbol,
          it: item.it,
          en: item.en,
          placement: item.placement,
        });
      }
    }

    const markers = sources.markers || root.NeuroMapMarkers?.entries || [];
    for (const m of markers) {
      if (!m?.symbol) continue;
      for (const label of [m.it, m.en]) {
        for (const part of String(label || "").split(/\s+/)) {
          const norm = normalizeWord(part);
          if (norm.length >= 4 && !STOPWORDS.has(norm)) {
            addSymbol(norm, {
              kind: "symbol",
              symbol: m.symbol,
              it: m.it || m.symbol,
              en: m.en || m.symbol,
              placement: "prefix",
            });
          }
        }
      }
    }

    const packItems = sources.svgItems || root.GlaukaObjectGalleryPack?.ITEMS || [];
    const tempSvgBuckets = new Map();

    const pushCandidate = (token, item, weight) => {
      if (!token || token.length < 3 || STOPWORDS.has(token)) return;
      let bucket = tempSvgBuckets.get(token);
      if (!bucket) {
        bucket = [];
        tempSvgBuckets.set(token, bucket);
      }
      const existing = bucket.find((b) => b.id === item.id);
      if (existing) {
        if (weight > existing.weight) existing.weight = weight;
        return;
      }
      bucket.push({
        kind: "svg",
        id: item.id,
        it: item.it || item.id,
        en: item.en || item.id,
        category: item.category || "ideas",
        weight: weight + (String(item.id).startsWith("gl-") ? 15 : 0),
      });
    };

    for (const item of packItems) {
      if (!item?.id) continue;
      const itFull = normalizeWord(item.it);
      const enFull = normalizeWord(item.en);
      if (itFull.length >= 3) pushCandidate(itFull, item, 100);
      if (enFull.length >= 3) pushCandidate(enFull, item, 95);

      for (const part of String(item.it || "").split(/[\s/_-]+/)) {
        const norm = normalizeWord(part);
        if (norm.length >= 3) pushCandidate(norm, item, 80);
      }
      for (const part of String(item.en || "").split(/[\s/_-]+/)) {
        const norm = normalizeWord(part);
        if (norm.length >= 3) pushCandidate(norm, item, 75);
      }
      for (const kw of String(item.keywords || "").split(/[\s,/_-]+/)) {
        const norm = normalizeWord(kw);
        if (norm.length >= 3) pushCandidate(norm, item, 55);
      }
    }

    for (const [token, bucket] of tempSvgBuckets.entries()) {
      bucket.sort((a, b) => b.weight - a.weight);
      svgMap.set(token, bucket.slice(0, 3));
    }

    return { symbolMap, svgMap, size: symbolMap.size + svgMap.size };
  }

  let sharedIndex = null;
  function getIndex() {
    if (!sharedIndex) {
      sharedIndex = buildIndex();
    }
    return sharedIndex;
  }

  function extractTokenWindow(text, caretPos) {
    const raw = String(text || "");
    const pos = typeof caretPos === "number" && caretPos >= 0 ? Math.min(raw.length, caretPos) : raw.length;
    const before = raw.slice(0, pos);

    let matchedShorthand = null;
    for (const [seq, sym, it, en] of SHORTHANDS) {
      if (before.endsWith(seq)) {
        matchedShorthand = {
          kind: "shorthand",
          sequence: seq,
          symbol: sym,
          it,
          en,
          start: pos - seq.length,
          end: pos,
        };
        break;
      }
    }

    const wordMatch = before.match(/([A-Za-zÀ-ÿ0-9]{2,32})(?:\s+([A-Za-zÀ-ÿ0-9]{3,32}))?\s*$/);
    let lastWord = "";
    let compound = "";
    let wordStart = pos;
    let wordEnd = pos;
    if (wordMatch) {
      if (wordMatch[2]) {
        lastWord = normalizeWord(wordMatch[2]);
        compound = normalizeWord(wordMatch[1] + wordMatch[2]);
        const idx = before.lastIndexOf(wordMatch[2]);
        wordStart = idx >= 0 ? idx : pos;
        wordEnd = wordStart + wordMatch[2].length;
      } else if (wordMatch[1]) {
        lastWord = normalizeWord(wordMatch[1]);
        const idx = before.lastIndexOf(wordMatch[1]);
        wordStart = idx >= 0 ? idx : pos;
        wordEnd = wordStart + wordMatch[1].length;
      }
    }
    return { matchedShorthand, lastWord, compound, wordStart, wordEnd };
  }

  function lookup(text, caretPos, opts = {}) {
    const mode = opts.mode || getMode();
    const index = opts.index || getIndex();
    const { matchedShorthand, lastWord, compound, wordStart, wordEnd } = extractTokenWindow(text, caretPos);
    const out = [];
    const seenKeys = new Set();

    const pushUnique = (item) => {
      const key = item.kind + ":" + (item.id || item.symbol);
      if (seenKeys.has(key) || out.length >= MAX_SUGGESTIONS) return;
      seenKeys.add(key);
      out.push(item);
    };

    if (mode !== "svg" && matchedShorthand) {
      pushUnique(matchedShorthand);
    }

    if (mode !== "svg") {
      for (const token of [compound, lastWord]) {
        if (!token || token.length < 2) continue;
        const symHits = index.symbolMap.get(token);
        if (symHits) {
          for (const hit of symHits.slice(0, 2)) {
            pushUnique({ ...hit, wordStart, wordEnd });
          }
        }
      }
    }

    if (mode !== "symbols") {
      for (const token of [compound, lastWord]) {
        if (!token || token.length < 3) continue;
        const svgHits = index.svgMap.get(token);
        if (svgHits) {
          const maxSvg = mode === "svg" ? 4 : 3;
          for (const hit of svgHits.slice(0, maxSvg)) {
            pushUnique(hit);
          }
          if (out.length >= MAX_SUGGESTIONS) break;
        }
      }
    }

    return out;
  }

  function togglePrefixSymbol(text, symbol) {
    const cur = String(text || "");
    const prefix = symbol + " ";
    if (cur === symbol) return "";
    if (cur.startsWith(prefix)) return cur.slice(prefix.length);
    return symbol + (cur ? " " + cur : "");
  }

  function applyTextTransform(value, caretPos, suggestion) {
    const raw = String(value || "");
    const pos = typeof caretPos === "number" ? Math.min(raw.length, Math.max(0, caretPos)) : raw.length;
    if (suggestion.kind === "shorthand") {
      const start = Math.max(0, suggestion.start ?? (pos - suggestion.sequence.length));
      const end = Math.min(raw.length, suggestion.end ?? pos);
      const nextText = raw.slice(0, start) + suggestion.symbol + raw.slice(end);
      return { text: nextText, caret: start + suggestion.symbol.length };
    }
    if (suggestion.kind === "symbol") {
      if (suggestion.placement === "inline") {
        const start = Math.max(0, suggestion.wordStart ?? pos);
        const end = Math.min(raw.length, suggestion.wordEnd ?? pos);
        const nextText = raw.slice(0, start) + suggestion.symbol + raw.slice(end);
        return { text: nextText, caret: start + suggestion.symbol.length };
      }
      const nextText = togglePrefixSymbol(raw, suggestion.symbol);
      const delta = nextText.length - raw.length;
      return { text: nextText, caret: Math.max(0, pos + delta) };
    }
    return { text: raw, caret: pos };
  }

  function mountDomController() {
    if (typeof document === "undefined" || root.__nmInlineSuggestMounted) return;
    root.__nmInlineSuggestMounted = true;

    let bar = null;
    let timer = null;
    let dismissedNodeId = null;
    let undoSnapshotNodeId = null;
    let activeSuggestions = [];

    const tr = (it, en) => {
      const lang = root.GlaukaI18n?.locale?.() || document.documentElement?.lang || "it";
      return String(lang).toLowerCase().startsWith("en") ? en : it;
    };

    function ensureBar() {
      if (bar) return bar;
      bar = document.createElement("div");
      bar.id = "nm-inline-smart-suggest";
      bar.className = "nm-inline-smart-suggest nm6-skiptranslate";
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", tr("Suggerimenti simboli e illustrazioni", "Symbol and illustration suggestions"));
      bar.hidden = true;
      bar.addEventListener("pointerdown", (e) => {
        // Never blur #inline-editor-input when tapping a suggestion chip!
        e.preventDefault();
        e.stopPropagation();
      });
      document.body.append(bar);
      return bar;
    }

    function hideBar() {
      clearTimeout(timer);
      timer = null;
      activeSuggestions = [];
      if (bar) {
        bar.hidden = true;
        bar.replaceChildren();
      }
    }

    function positionBar() {
      if (!bar || bar.hidden) return;
      const container = document.getElementById("inline-editor-container");
      if (!container || container.classList.contains("hidden")) {
        hideBar();
        return;
      }
      const rect = container.getBoundingClientRect();
      const vw = root.visualViewport?.width || root.innerWidth || 1024;
      const vh = root.visualViewport?.height || root.innerHeight || 768;
      const barWidth = Math.min(vw - 16, Math.max(180, bar.offsetWidth || 260));
      const barHeight = bar.offsetHeight || 34;
      let left = rect.left + rect.width / 2 - barWidth / 2;
      left = Math.max(8, Math.min(vw - barWidth - 8, left));
      let top = rect.bottom + 6;
      if (top + barHeight > vh - 12) {
        top = Math.max(8, rect.top - barHeight - 6);
      }
      bar.style.left = `${Math.round(left)}px`;
      bar.style.top = `${Math.round(top)}px`;
    }

    function applyChip(suggestion) {
      const app = root.neuroMapApp;
      const field = document.getElementById("inline-editor-input");
      if (!app || !field || !app.editorNodeId) return;
      const node = app.state?.findNode?.(app.editorNodeId);
      if (!node) return;

      if (suggestion.kind === "shorthand" || suggestion.kind === "symbol") {
        const res = applyTextTransform(field.value, field.selectionStart, suggestion);
        field.value = res.text;
        try {
          field.setSelectionRange(res.caret, res.caret);
        } catch {}
        if (app.layout) app.layout.editingLabel = { id: node.id, text: field.value };
        app.scheduleInlineRelayout?.();
        field.focus({ preventScroll: true });
        scheduleLookup();
        return;
      }

      if (suggestion.kind === "svg") {
        const core = root.NeuroMapCreativeCore;
        if (!core?.objectArt) return;
        const size = node.id === app.state?.root?.id ? 180 : 100;
        const nextArt = core.objectArt({ id: suggestion.id, size });
        if (!nextArt) return;
        if (undoSnapshotNodeId !== node.id) {
          app.state?.pushHistory?.();
          undoSnapshotNodeId = node.id;
        }
        node.objectArt = node.objectArt?.id === suggestion.id ? null : nextArt;
        app.markChanged?.();
        app.recalculateAndRender?.();
        app.positionEditor?.();
        field.focus({ preventScroll: true });
        renderSuggestions(activeSuggestions);
      }
    }

    function renderSuggestions(items) {
      if (!items.length) {
        hideBar();
        return;
      }
      const el = ensureBar();
      const app = root.neuroMapApp;
      const node = app?.editorNodeId ? app.state?.findNode?.(app.editorNodeId) : null;
      el.replaceChildren();

      for (const item of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nm-inline-suggest-chip";
        btn.dataset.kind = item.kind;
        const labelText = tr(item.it, item.en);
        btn.title = labelText;
        btn.setAttribute("aria-label", labelText);

        if (item.kind === "svg") {
          const active = node?.objectArt?.id === item.id;
          btn.setAttribute("aria-pressed", String(active));
          const iconSpan = document.createElement("span");
          iconSpan.className = "nm-inline-suggest-svg";
          iconSpan.setAttribute("aria-hidden", "true");
          const bodyMarkup = root.GlaukaObjectGalleryPack?.body?.(item.id) || "";
          if (bodyMarkup) {
            iconSpan.innerHTML = `<svg viewBox="0 0 240 240" width="18" height="18" aria-hidden="true">${bodyMarkup}</svg>`;
          }
          const txt = document.createElement("span");
          txt.className = "nm-inline-suggest-label";
          txt.textContent = labelText;
          btn.append(iconSpan, txt);
        } else {
          const glyph = document.createElement("span");
          glyph.className = "nm-inline-suggest-glyph";
          glyph.textContent = item.symbol;
          const txt = document.createElement("span");
          txt.className = "nm-inline-suggest-label";
          txt.textContent = labelText;
          btn.append(glyph, txt);
        }

        btn.addEventListener("click", () => applyChip(item));
        el.append(btn);
      }

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "nm-inline-suggest-dismiss";
      closeBtn.textContent = "×";
      const closeLabel = tr("Nascondi suggerimenti", "Hide suggestions");
      closeBtn.title = closeLabel;
      closeBtn.setAttribute("aria-label", closeLabel);
      closeBtn.addEventListener("click", () => {
        dismissedNodeId = root.neuroMapApp?.editorNodeId || "__dismissed__";
        hideBar();
      });
      el.append(closeBtn);

      el.hidden = false;
      positionBar();
    }

    function runLookupNow() {
      timer = null;
      if (!isEnabled()) {
        hideBar();
        return;
      }
      const app = root.neuroMapApp;
      const field = document.getElementById("inline-editor-input");
      const container = document.getElementById("inline-editor-container");
      if (!app?.editorNodeId || !field || !container || container.classList.contains("hidden")) {
        hideBar();
        return;
      }
      if (dismissedNodeId === app.editorNodeId) return;
      activeSuggestions = lookup(field.value, field.selectionStart, { mode: getMode() });
      renderSuggestions(activeSuggestions);
    }

    function scheduleLookup() {
      clearTimeout(timer);
      if (!isEnabled()) {
        hideBar();
        return;
      }
      timer = setTimeout(runLookupNow, DEBOUNCE_MS);
    }

    function attachInputListeners() {
      const field = document.getElementById("inline-editor-input");
      const container = document.getElementById("inline-editor-container");
      if (!field || !container || field._nmSmartSuggestBound) return false;
      field._nmSmartSuggestBound = true;

      field.addEventListener("input", () => {
        scheduleLookup();
      });

      field.addEventListener("blur", () => {
        hideBar();
      });

      const obs = new MutationObserver(() => {
        if (container.classList.contains("hidden")) {
          dismissedNodeId = null;
          undoSnapshotNodeId = null;
          hideBar();
        } else if (bar && !bar.hidden) {
          positionBar();
        }
      });
      obs.observe(container, { attributes: true, attributeFilter: ["class", "style"] });
      return true;
    }

    if (!attachInputListeners()) {
      document.addEventListener("DOMContentLoaded", () => attachInputListeners(), { once: true });
    }
  }

  if (typeof document !== "undefined") {
    mountDomController();
  }

  return {
    PREF_ENABLED_KEY,
    PREF_MODE_KEY,
    normalizeWord,
    isEnabled,
    setEnabled,
    getMode,
    setMode,
    buildIndex,
    lookup,
    applyTextTransform,
    mountDomController,
  };
});
