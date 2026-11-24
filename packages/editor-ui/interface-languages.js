/* Offline interface catalogs. Authored project content is never a translation target. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.GlaukaI18n = factory(root, /* @glauka-locale-source */ null);
})(globalThis, function createInterfaceLanguages(root, source) {
  "use strict";
  if (!source) return null;
  const supported = new Map(source.languages.map((l) => [l.code, l]));
  const normalize = (value) => {
    const code = String(value || "")
      .replace("_", "-")
      .toLowerCase();
    if (code.startsWith("zh")) return "zh-CN";
    const base = code.split("-")[0];
    return supported.has(base) ? base : "it";
  };
  const doc = root.document,
    storage = root.localStorage;
  const stored = () => {
    try {
      return storage?.getItem("nm6_locale");
    } catch {
      return null;
    }
  };
  const initial = normalize(
    root.neuromapDesktop?.initialLocale ||
      root.NMAndroid?.getInterfaceLocale?.() ||
      stored() ||
      (root.GlaukaMobile
        ? root.navigator?.languages?.[0] || root.navigator?.language || "en"
        : "it"),
  );
  const packs = new Map(
    ["it", "en"].map((code) => [
      code,
      Object.fromEntries(
        Object.entries(source.entries).map(([id, e]) => [id, e[code]]),
      ),
    ]),
  );
  const alias = (text) =>
    Object.prototype.hasOwnProperty.call(source.aliases, text)
      ? source.aliases[text]
      : undefined;
  const originals = new WeakMap(),
    attrOriginals = new WeakMap();
  let previousReverse = new Map(),
    reverseCode = "",
    activeReverse = new Map(),
    activePatterns = new Map(),
    previousPatterns = new Map(),
    activePrefixes = [],
    previousPrefixes = [],
    previousFragments = new Map();
  const affixes = new Map();
  function reverse() {
    const code = locale();
    if (reverseCode !== code) {
      previousReverse = activeReverse;
      previousPatterns = activePatterns;
      previousPrefixes = activePrefixes;
      previousFragments = new Map(
        [...activeReverse]
          .filter(([, id]) => affixes.has(id))
          .map(([text, id]) => [id, text]),
      );
      activeReverse = new Map();
      activePatterns = new Map();
      activePrefixes = [];
      for (const [id, text] of Object.entries(packs.get(code) || {})) {
        activeReverse.set(text, id);
        addPattern(activePatterns, activePrefixes, text, id);
      }
      reverseCode = code;
    }
    return activeReverse;
  }
  function sourceId(text) {
    return alias(text) || reverse().get(text) || previousReverse.get(text);
  }
  function canonical(raw) {
    const text = String(raw ?? ""),
      trim = text.trim();
    if (literals[locale()]?.has(trim)) return text;
    const id = sourceId(trim);
    if (id) return text.replace(trim, () => source.entries[id].en);
    const icon = trim.match(/^([\p{P}\p{S}\s]+)([\p{L}\p{N}][\s\S]*)$/u);
    if (icon && literals[locale()]?.has(icon[2])) return text;
    const suffix = icon && sourceId(icon[2]);
    if (suffix)
      return text.replace(trim, () => icon[1] + source.entries[suffix].en);
    const dynamic = resolveDynamic(trim, "en");
    return dynamic === null ? text : text.replace(trim, () => dynamic);
  }
  const literals = { it: new Set(), en: new Set() };
  for (const entry of Object.values(source.entries))
    if (entry.it !== entry.en) {
      literals.it.add(entry.it.trim());
      literals.en.add(entry.en.trim());
    }
  const patterns = new Map(),
    prefixes = [];
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function addPattern(map, list, text, id) {
    if (/\{\d+\}/.test(text)) {
      const slots = [],
        parts = text.split(/(\{\d+\})/g);
      const expression = parts
        .map((p) =>
          /^\{\d+\}$/.test(p)
            ? (slots.push(p.slice(1, -1)), "([\\s\\S]*?)")
            : escape(p),
        )
        .join("");
      const key = text.slice(0, text.indexOf("{")).slice(0, 2);
      if (!map.has(key)) map.set(key, []);
      map
        .get(key)
        .push({ regex: new RegExp("^" + expression + "$"), id, slots });
    } else if (text.endsWith(":")) list.push({ text, id });
  }
  for (const [text, id] of Object.entries(source.aliases))
    addPattern(patterns, prefixes, text, id);
  prefixes.sort((a, b) => b.text.length - a.text.length);
  const locale = () => normalize(doc?.documentElement?.lang || initial);
  const value = (id, code = locale()) =>
    packs.get(code)?.[id] ?? source.entries[id]?.[code === "it" ? "it" : "en"];
  function translate(raw, code = locale()) {
    const text = String(raw ?? ""),
      trim = text.trim();
    if (!trim || trim.length > 12000 || literals[code]?.has(trim)) return text;
    if (trim.includes("⌘+")) {
      const portable = trim.replace(/⌘\+/g, "Ctrl+"),
        shortcut = alias(portable);
      if (shortcut)
        return text.replace(trim, () =>
          String(value(shortcut, code)).replace(/Ctrl\+/g, "⌘+"),
        );
    }
    const id = sourceId(trim);
    if (id) return text.replace(trim, () => value(id, code) ?? trim);
    const icon = trim.match(/^([\p{P}\p{S}\s]+)([\p{L}\p{N}][\s\S]*)$/u);
    if (icon && literals[code]?.has(icon[2])) return text;
    const suffix = icon && sourceId(icon[2]);
    if (suffix) return text.replace(trim, () => icon[1] + value(suffix, code));
    const dynamic = resolveDynamic(trim, code);
    if (dynamic !== null) return text.replace(trim, () => dynamic);
    return text;
  }
  function resolveDynamic(trim, code) {
    reverse();
    const candidates = [patterns, activePatterns, previousPatterns].flatMap(
      (map) => [...(map.get(trim.slice(0, 2)) || []), ...(map.get("") || [])],
    );
    for (const p of candidates) {
      const match = p.regex.exec(trim);
      if (!match) continue;
      const slots = Object.fromEntries(
        p.slots.map((slot, i) => [slot, match[i + 1]]),
      );
      return (
        value(p.id, code)?.replace(
          /\{(\d+)\}/g,
          (_, i) => slots[i] ?? "{" + i + "}",
        ) ?? null
      );
    }
    for (const p of [...prefixes, ...activePrefixes, ...previousPrefixes])
      if (trim.startsWith(p.text + " "))
        return value(p.id, code) + trim.slice(p.text.length);
    for (const [id, fragment] of affixes) {
      const forms = new Set([
        ...fragment.sources,
        source.entries[id].it,
        source.entries[id].en,
        value(id),
        previousFragments.get(id),
      ]);
      for (const form of forms) {
        if (!form) continue;
        if (fragment.prefix && trim.startsWith(form + " "))
          return value(id, code) + trim.slice(form.length);
        if (fragment.suffix && trim.endsWith(" " + form))
          return trim.slice(0, -form.length) + value(id, code);
      }
    }
    return null;
  }
  function pair(it, en) {
    if (alias(String(it).trim()) || alias(String(en).trim())) {
      literals.it.add(String(it).trim());
      literals.en.add(String(en).trim());
    }
    const id = alias(String(en).trim()) || alias(String(it).trim());
    if (id && (/^\s|\s$/.test(String(it)) || /^\s|\s$/.test(String(en)))) {
      let fragment = affixes.get(id);
      if (!fragment)
        affixes.set(
          id,
          (fragment = { sources: new Set(), prefix: false, suffix: false }),
        );
      fragment.sources.add(String(it).trim());
      fragment.sources.add(String(en).trim());
      fragment.prefix ||= /\s$/.test(String(it)) || /\s$/.test(String(en));
      fragment.suffix ||= /^\s/.test(String(it)) || /^\s/.test(String(en));
    }
    const code = locale();
    if (code === "it") return it;
    if (code === "en") return en;
    const raw = en;
    return id
      ? String(raw).replace(String(raw).trim(), () => value(id))
      : translate(raw);
  }
  // Strong boundaries, including UI locations that show names or generated study content.
  const excluded =
    '[data-glauka-touch-owned],script,style,textarea,code,pre,svg,#glauka-language-select,#gl-settings-language,[data-glauka-language],#glauka-font-family,[contenteditable],input,[data-glauka-user-content],.tab-item,.tabs-list,.nm-android-preview-card strong,.ctx-header-node,#status-selected-node,.v4-explain-text,#nm67-notes-preview,.flash-heading,.spotlight-main,.spotlight-path,.spotlight-tab,#inline-editor-container,#nm-home-open-tabs,#nm-home-recent [data-action="open"],.nm-kn-text,.nm-kn-name,.nm-kn-authored,.nm-learn-question,.nm-learn-answer,.nm-learn-options,.nm-learn-authored,.nm-ai-evidence-answer,.nm-theme-content,.nm-view-title,.nm-view-timeline-label,.nm-timeline-title,.nm616-compare-label,.nm-ai-evidence-row,.nm-ai-diff-row del,.nm-ai-diff-row>div,.flash-breadcrumb,#nm67-notes-title';
  function translateDOM(scope = doc) {
    if (!doc || !scope) return;
    const walk = doc.createTreeWalker(scope, root.NodeFilter.SHOW_TEXT),
      nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const node of nodes) {
      if (!node.parentElement || node.parentElement.closest(excluded)) continue;
      const previous = originals.get(node),
        current = node.nodeValue;
      const raw =
        previous && (current === previous.out || current === previous.raw)
          ? previous.raw
          : canonical(current);
      // Italian uses the same word for Undo and Cancel; retain the command's meaning.
      const owned = node.parentElement;
      const out = owned.hasAttribute?.('data-glauka-ui-pair') && owned.dataset?.it != null
        ? pair(owned.dataset.it, owned.dataset.en) : node.parentElement.closest('[data-nm6-context="undo"]')
        ? pair("Annulla", "Undo") : translate(raw);
      originals.set(node, { raw, out });
      if (current !== out) node.nodeValue = out;
    }
    const selector = "[title],[placeholder],[aria-label],[alt]";
    for (const el of [
      ...(scope.matches?.(selector) ? [scope] : []),
      ...(scope.querySelectorAll?.(selector) || []),
    ]) {
      if (el.id !== "inline-editor-input" && el.closest(excluded.replace("textarea,", "").replace("input,", "")))
        continue;
      let entries = attrOriginals.get(el);
      if (!entries) attrOriginals.set(el, (entries = {}));
      for (const attr of ["title", "placeholder", "aria-label", "alt"]) {
        if((el.getAttribute("data-glauka-touch-attributes")||"").split(" ").includes(attr))continue;
        const current = el.getAttribute(attr);
        if (current === null) continue;
        const previous = entries[attr],
          raw =
            previous && (current === previous.out || current === previous.raw)
              ? previous.raw
              : canonical(current);
        const out = attr === 'aria-label' && el.hasAttribute?.('data-glauka-ui-pair')
          ? pair(el.dataset.itLabel, el.dataset.enLabel) : translate(raw);
        entries[attr] = { raw, out };
        if (out !== current) el.setAttribute(attr, out);
      }
    }
  }
  let observer,
    scheduled = false;
  const pendingRoots = new Set();
  function schedule(scope) {
    if (!scope?.isConnected && scope !== doc) return;
    pendingRoots.add(scope);
    if (scheduled) return;
    scheduled = true;
    root.requestAnimationFrame(() => {
      scheduled = false;
      const roots = pendingRoots.size > 40 ? [doc] : [...pendingRoots];
      pendingRoots.clear();
      for (const scope of roots)
        if (!roots.some((other) => other !== scope && other.contains?.(scope)))
          translateDOM(scope);
    });
  }
  function observe() {
    if (observer || !root.MutationObserver || !doc?.body) return;
    translateDOM();
    observer = new root.MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          if (
            originals.get(r.target)?.out === r.target.nodeValue ||
            r.target.parentElement?.closest(excluded)
          )
            continue;
          schedule(r.target.parentElement);
        } else if (r.type === "attributes") {
          if (
            attrOriginals.get(r.target)?.[r.attributeName]?.out !==
            r.target.getAttribute(r.attributeName)
          )
            schedule(r.target);
        } else
          for (const node of r.addedNodes) {
            const el = node.nodeType === 1 ? node : node.parentElement;
            if (el && !el.closest(excluded)) schedule(el);
          }
      }
    });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });
  }
  async function load(code) {
    if (packs.has(code)) return packs.get(code);
    const response = await root.fetch(
      "locales/" + encodeURIComponent(code) + ".json",
      { credentials: "same-origin", cache: "force-cache" },
    );
    if (!response.ok) throw Error("Could not load interface language");
    const pack = await response.json();
    if (
      Object.keys(pack).length !== Object.keys(source.entries).length ||
      Object.keys(source.entries).some(
        (id) => typeof pack[id] !== "string" || !pack[id],
      )
    )
      throw Error("Incomplete interface language");
    return pack;
  }
  function direction(code) {
    if (!doc) return;
    doc.documentElement.lang = code;
    doc.documentElement.dir = supported.get(code).dir;
    if (doc.body) doc.body.dataset.glaukaLocale = code;
  }
  let sequence = 0;
  async function setLanguage(input, persist = true) {
    const code = normalize(input),
      request = ++sequence,
      pack = await load(code);
    if (request !== sequence) return false;
    if (persist) {
      await root.neuromapDesktop?.writeInterfaceLocale?.(code);
      if (
        root.NMAndroid?.setInterfaceLocale &&
        !root.NMAndroid.setInterfaceLocale(code)
      )
        throw Error("Could not save interface language");
    }
    if (request !== sequence) return false;
    reverse();
    packs.set(code, pack);
    for (const key of packs.keys())
      if (key !== code && key !== "it" && key !== "en") packs.delete(key);
    try {
      storage?.setItem("nm6_locale", code);
    } catch {}
    direction(code);
    root.nm6ApplyLanguage?.();
    translateDOM();
    root.dispatchEvent?.(
      new root.CustomEvent("glauka:language-change", { detail: { code } }),
    );
    return true;
  }
  async function init() {
    await setLanguage(initial, false);
    if (doc?.readyState === "loading")
      doc.addEventListener("DOMContentLoaded", observe, { once: true });
    else observe();
  }
  const api = {
    languages: source.languages,
    normalize,
    locale,
    pair,
    translate,
    translateDOM,
    observe,
    setLanguage,
    init,
    inspect: () => ({
      locale: locale(),
      loadedCatalogs: [...packs.keys()],
      entries: Object.keys(source.entries).length,
    }),
  };
  if (doc) api.ready = init();
  return Object.freeze(api);
});
