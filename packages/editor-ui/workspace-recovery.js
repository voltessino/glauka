/* Local recovery transport and bounded validation. No background polling or network. */
(function (root) {
  "use strict";
  const LIMIT = 32 * 1024 * 1024,
    MAX_TABS = 512,
    pending = new Map();
  function validate(data) {
    if (
      !data ||
      !Array.isArray(data.tabs) ||
      !data.tabs.length ||
      data.tabs.length > MAX_TABS
    )
      throw Error("Copia di recupero non valida.");
    const tabIds = new Set();
    let total = 0;
    for (const tab of data.tabs) {
      if (!tab || typeof tab !== "object" || !tab.root)
        throw Error("Scheda di recupero non valida.");
      if (tab.id != null) {
        if (typeof tab.id !== "string" || tabIds.has(tab.id))
          throw Error("ID delle schede non validi.");
        tabIds.add(tab.id);
      }
      for (const key of ["images", "relationships"])
        if (tab[key] != null && !Array.isArray(tab[key]))
          throw Error("Metadati di recupero non validi.");
      const ids = new Set(),
        stack = [{ node: tab.root, depth: 0 }];
      while (stack.length) {
        const { node, depth } = stack.pop();
        if (
          !node ||
          typeof node !== "object" ||
          Array.isArray(node) ||
          typeof node.text !== "string" ||
          depth > 256 ||
          ++total > 50000
        )
          throw Error("Struttura di recupero non valida o troppo grande.");
        if (node.id != null) {
          if (typeof node.id !== "string" || ids.has(node.id))
            throw Error("ID dei concetti non validi.");
          ids.add(node.id);
        }
        if (node.children != null && !Array.isArray(node.children))
          throw Error("Rami di recupero non validi.");
        for (const child of node.children || [])
          stack.push({ node: child, depth: depth + 1 });
      }
    }
    for (const key of ["studyCards", "learningAttempts", "learningPlans"])
      if (data[key] != null && !Array.isArray(data[key]))
        throw Error("Dati di studio non validi.");
    return data;
  }
  function checkSize(json) {
    if (
      typeof json !== "string" ||
      json.length > LIMIT ||
      (json.length > LIMIT / 3 &&
        new TextEncoder().encode(json).byteLength > LIMIT)
    )
      throw Error("Copia di recupero oltre il limite di 32 MB.");
  }
  function decode(json) {
    checkSize(json);
    return validate(JSON.parse(json));
  }
  function nativeResult(id, ok, value) {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    clearTimeout(job.timer);
    ok
      ? job.resolve(value)
      : job.reject(
          Error("Copia di recupero non disponibile. Esporta un backup."),
        );
  }
  function requestId(crypto = root.crypto) {
    if (crypto?.randomUUID) return crypto.randomUUID();
    if (!crypto?.getRandomValues)
      throw Error("Aggiorna Android System WebView per salvare i progetti.");
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    // Match crypto.randomUUID() even on WebViews without that API.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
  }
  function call(method, value) {
    return new Promise((resolve, reject) => {
      const id = "recovery_" + requestId(),
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error("Copia di recupero non completata."));
        }, 30000);
      pending.set(id, { resolve, reject, timer });
      try {
        if (value === undefined) root.GlaukaRecovery[method](id);
        else root.GlaukaRecovery[method](value, id);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }
  // Keep state outside the frozen transport surface.
  let usedPrevious = false;
  const nativeBridge = root.GlaukaRecovery
    ? Object.freeze({
        async readWorkspace() {
          const value = await call("read");
          if (!value) return null;
          checkSize(value.json);
          usedPrevious = value.previous === true;
          return value.json;
        },
        writeWorkspace(json) {
          checkSize(json);
          return call("write", json);
        },
        discardWorkspace() {
          return call("discard");
        },
        get usedPrevious() {
          return usedPrevious;
        },
      })
    : null;
  function camera(raw, min = 0.001) {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      ![raw.x, raw.y, raw.zoom].every(Number.isFinite)
    )
      return null;
    return {
      x: Math.max(-100000000, Math.min(100000000, raw.x)),
      y: Math.max(-100000000, Math.min(100000000, raw.y)),
      zoom: Math.max(min, Math.min(3.5, raw.zoom)),
    };
  }
  root.NeuroMapRecovery = {
    requestId,
    camera,
    LIMIT,
    MAX_TABS,
    validate,
    decode,
    nativeResult,
    bridge: nativeBridge,
  };
  if (typeof module === "object" && module.exports)
    module.exports = root.NeuroMapRecovery;
})(globalThis);
