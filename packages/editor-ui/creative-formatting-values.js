  function clean(values, fields) {
    const out = {};
    for (const key of fields) {
      const v = values?.[key];
      const ranges = {
        strokeScale: [0.5, 3],
        branchGapX: [30, 220],
        compactness: [55, 145],
        balanceBias: [0, 100],
        typographyScale: [0.7, 1.65],
        defaultLabelWrapChars: [8, 60],
        fontSize: [9, 48],
        fontWeight: [400, 700],
        labelWrapChars: [8, 60],
        labelIndent: [0, 45],
      };
      const options = {
        branchStyle: [
          "neon",
          "buzan",
          "thickparents",
          "xmind8",
          "simple",
          "radial",
          "elbow",
          "straight",
          "arc",
        ],
        typographyPreset: [
          "uniform",
          "balanced",
          "pyramid",
          "branches",
          "compact",
        ],
        labelAlign: ["left", "center", "right"],
        fontFamily: ['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New'],
        activeThemeId: ["default", "neon", "forest", "sunset", "ocean", "prisma"],
        layoutMode: ["balanced", "clockwise", "fluid", "columns", "right", "left"],
      };
      if (
        ranges[key] &&
        Number.isFinite(v) &&
        v >= ranges[key][0] &&
        v <= ranges[key][1]
      )
        out[key] = v;
      else if (options[key]?.includes(v)) out[key] = v;
      else if (["fontItalic","fontUnderline","fontStrike"].includes(key) && typeof v === "boolean") out[key] = v;
      else if (["color","fontColor"].includes(key) && /^#[0-9a-f]{6}$/i.test(v)) out[key] = v;
      else if (
        key === "layoutDistribution" &&
        v &&
        typeof v.enabled === "boolean" &&
        Number.isFinite(v.height) &&
        v.height >= 480 &&
        v.height <= 100000000
      )
        out[key] = {
          enabled: v.enabled,
          height: v.height,
          // Preserve the adaptive continuation policy for future maps.
          // Formerly this discarded overflowMode, silently converting the
          // saved default back to the legacy multi-sector layout.
          ...(v.overflowMode === "expand" ? { overflowMode: "expand" } : {}),
          // Per-map floors and ancestor anchors are not future-map preferences.
          minimumHeight: 480,
        };
      else if (
        ["fontSize", "fontWeight", "labelWrapChars", "fontFamily", "fontColor"].includes(key) &&
        v === null
      )
        out[key] = null;
    }
    return out;
  }
  function load() {
    try {
      let raw = JSON.parse(localStorage.getItem(KEY) || "null");
      const out = {};
      if (!raw) {
        raw = {};
        const spacing = JSON.parse(
          localStorage.getItem("neuromap.editor.spacing.defaults.v1") || "{}",
        );
        const gap = Number(
            localStorage.getItem("neuromap.default.branchGapX.v6.11"),
          ),
          wrap = Number(localStorage.getItem("nm64_default_wrap_chars")),
          profile = localStorage.getItem("neuromap.typography.default.v6");
        if (Number.isFinite(spacing.branchGapX))
          raw.gap = { branchGapX: spacing.branchGapX };
        else if (gap >= 30 && gap <= 220) raw.gap = { branchGapX: gap };
        if (Number.isFinite(spacing.compactness))
          raw.vertical = { compactness: spacing.compactness };
        if (wrap >= 8 && wrap <= 60) raw.wrap = { defaultLabelWrapChars: wrap };
        if (profile) raw.profile = { typographyPreset: profile };
      }
      for (const s of specs)
        if (raw[s.id]) out[s.id] = clean(raw[s.id], s.fields);
        else if (Object.hasOwn(raw, s.id) && raw[s.id] === null)
          out[s.id] = null;
      return out;
    } catch {
      return {};
    }
  }
  function defaults(state, includeNodes = false) {
    const saved = load();
    // Style only freshly created maps; restored/imported documents do not enter defaults().
    if (!saved.palette && root.NeuroMapEditorPalettes?.prisma && state.root) {
      state.activeThemeId="prisma";
      state.root.color="#6441df";
      const palette=root.NeuroMapEditorPalettes.prisma;
      for(let i=0;i<(state.root.children||[]).length;i++){
        const pending=[state.root.children[i]];
        while(pending.length){const n=pending.pop();n.color=palette[i%palette.length];n.nodeShape="pill";pending.push(...(n.children||[]));}
      }
    }
    const base = {
      branchStyle: "xmind8",
      strokeScale: 1,
      branchGapX: 30,
      compactness: 55,
      balanceBias: 50,
      typographyPreset: "uniform",
      typographyScale: 1,
      defaultLabelWrapChars: 48,
      activeThemeId: "default",
      layoutMode: "clockwise",
      layoutDistribution: { enabled: true, height: 960, minimumHeight: 480, overflowMode: "expand" },
      ...state.constructor.originalMapDefaults,
    };
    for (const s of specs)
      if (s.kind === "map" && Object.hasOwn(saved, s.id))
        write(state, s, saved[s.id] || clean(base, s.fields), false);
    if (saved.wrap) state.wrapCustom = true;
    if (includeNodes) {
      const walk = (n) => {
        for (const s of specs)
          if (s.kind === "node") Object.assign(n, saved[s.id] || {});
        for (const c of n.children || []) walk(c);
      };
      if (state.root) walk(state.root);
    }
  }
  function rootSpec(spec) {
    return spec.id === "layout" || spec.id === "continuation";
  }
