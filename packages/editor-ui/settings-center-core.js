/* App-level zoom preference. Never written into a map document. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NeuroMapAppSettings = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const KEY = "glauka.app.zoom.v1";
  // Speed 2 keeps the historic mouse-wheel step of 0.0013.
  const MOUSE_UNIT = 0.00065;
  const TRACKPAD_GAIN = 0.0013;
  const LINKED_UNIT = 0.001;
  const LINKED_TRACKPAD = 0.002;

  function storage() {
    try { return globalThis.localStorage || null; } catch { return null; }
  }
  function clampSpeed(value) {
    const number = Math.round(Number(value) * 10) / 10;
    if (!Number.isFinite(number)) return 2;
    return Math.max(0.5, Math.min(3, number));
  }
  function read() {
    let data = null;
    try { data = JSON.parse(storage()?.getItem(KEY) || "null"); } catch { data = null; }
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    return {
      speed: clampSpeed(data.speed == null ? 2 : data.speed),
      animate: data.animate !== false,
      cursor: data.cursor !== false
    };
  }
  function write(partial) {
    const next = read();
    if (partial && typeof partial === "object") {
      if ("speed" in partial) next.speed = clampSpeed(partial.speed);
      if (typeof partial.animate === "boolean") next.animate = partial.animate;
      if (typeof partial.cursor === "boolean") next.cursor = partial.cursor;
    }
    try { storage()?.setItem(KEY, JSON.stringify(next)); } catch { /* the screen still uses the value */ }
    return read();
  }
  function reset() {
    try { storage()?.removeItem(KEY); } catch { /* ignore */ }
    return read();
  }
  // Mouse wheel uses the slider. Trackpad and pinch keep a fixed precise step.
  function wheelGain(kind) {
    if (kind === "trackpad" || kind === "pinch") return TRACKPAD_GAIN;
    return MOUSE_UNIT * read().speed;
  }
  function linkedGain(kind) {
    if (kind === "trackpad" || kind === "pinch") return LINKED_TRACKPAD;
    return LINKED_UNIT * read().speed;
  }
  const TTS_MODE_KEY = "glauka.explain.ttsMode.v1";
  const TTS_VOICES_KEY = "glauka.quickRead.ttsVoices.v1";
  const TTS_MODES = ["edge", "neural", "glauka-studio", "api", "native"];
  const TTS_DEFAULTS = {
    edge: "isabella",
    neural: "piper-it-paola",
    "glauka-studio": "default",
    api: "coral",
    native: ""
  };
  const TTS_VOICE_CATALOG = {
    edge: [
      ["isabella", "Isabella (IT · HD femminile)", "Isabella (IT · HD female)"],
      ["diego", "Diego (IT · HD maschile)", "Diego (IT · HD male)"],
      ["jenny", "Jenny (EN · HD femminile)", "Jenny (EN · HD female)"],
      ["andrew", "Andrew (EN · HD maschile)", "Andrew (EN · HD male)"]
    ],
    neural: [
      ["piper-it-paola", "Paola · Italiano (~63 MB)", "Paola · Italian (~63 MB)"],
      ["piper-it-riccardo", "Riccardo · Italiano (~28 MB)", "Riccardo · Italian (~28 MB)"],
      ["piper-en-amy", "Amy · English (~63 MB)", "Amy · English (~63 MB)"],
      ["piper-en-ryan", "Ryan · English (~120 MB)", "Ryan · English (~120 MB)"]
    ],
    api: [
      ["coral", "Coral (calda e naturale)", "Coral (warm & natural)"],
      ["nova", "Nova (chiara)", "Nova (clear)"],
      ["sage", "Sage (espressiva)", "Sage (expressive)"],
      ["alloy", "Alloy (neutra)", "Alloy (neutral)"],
      ["echo", "Echo (maschile)", "Echo (male)"],
      ["onyx", "Onyx (profonda)", "Onyx (deep)"],
      ["shimmer", "Shimmer (brillante)", "Shimmer (bright)"],
      ["autumn", "Autumn (Groq)", "Autumn (Groq)"],
      ["diana", "Diana (Groq)", "Diana (Groq)"],
      ["daniel", "Daniel (Groq)", "Daniel (Groq)"]
    ]
  };
  function readQuickVoices() {
    let parsed = null;
    try { parsed = JSON.parse(storage()?.getItem(TTS_VOICES_KEY) || "null"); } catch { parsed = null; }
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
  function availableQuickModes(rootObj = globalThis, appObj = rootObj?.neuroMapApp) {
    const desk = rootObj?.neuromapDesktop;
    const studio = appObj?.aiStudio;
    return [
      ...(desk?.edgeTts || studio ? ["edge"] : []),
      ...(desk?.neuralTts ? ["neural"] : []),
      ...(desk?.glaukaStudio ? ["glauka-studio"] : []),
      ...(studio ? ["api"] : []),
      "native"
    ];
  }
  function normalizeQuickMode(raw) {
    const val = raw === "voicestudio" ? "glauka-studio" : String(raw || "");
    return TTS_MODES.includes(val) ? val : "";
  }
  function readQuickSpeech(rootObj = globalThis, appObj = rootObj?.neuroMapApp) {
    const modes = availableQuickModes(rootObj, appObj);
    const savedRaw = normalizeQuickMode(storage()?.getItem(TTS_MODE_KEY));
    const defaultMode = appObj?.aiStudio?._neuralStatus?.installed && modes.includes("neural")
      ? "neural"
      : modes.includes("edge")
        ? "edge"
        : modes.includes("glauka-studio")
          ? "glauka-studio"
          : "native";
    const mode = savedRaw && modes.includes(savedRaw) ? savedRaw : defaultMode;
    const voices = readQuickVoices();
    const fallbackVoice = mode === "edge" && String(rootObj?.document?.documentElement?.lang || "").toLowerCase().startsWith("en")
      ? "jenny"
      : (TTS_DEFAULTS[mode] || "");
    const voice = typeof voices[mode] === "string" && voices[mode] ? voices[mode] : fallbackVoice;
    return { mode, voice, voices, availableModes: modes };
  }
  function writeQuickSpeech({ mode, voice } = {}) {
    const nextMode = normalizeQuickMode(mode);
    if (nextMode) {
      try { storage()?.setItem(TTS_MODE_KEY, nextMode); } catch { /* ignore */ }
    }
    if (typeof voice === "string") {
      const activeMode = nextMode || normalizeQuickMode(storage()?.getItem(TTS_MODE_KEY)) || "edge";
      const map = { ...readQuickVoices(), [activeMode]: voice };
      try { storage()?.setItem(TTS_VOICES_KEY, JSON.stringify(map)); } catch { /* ignore */ }
    }
    return readQuickSpeech();
  }
  const quickSpeech = Object.freeze({
    MODE_KEY: TTS_MODE_KEY,
    VOICES_KEY: TTS_VOICES_KEY,
    CATALOG: TTS_VOICE_CATALOG,
    availableModes: availableQuickModes,
    read: readQuickSpeech,
    write: writeQuickSpeech
  });
  return Object.freeze({
    KEY, read, write, reset, zoom: read, zoomSpeed: () => read().speed,
    wheelGain, linkedGain, clampSpeed, quickSpeech
  });
});
