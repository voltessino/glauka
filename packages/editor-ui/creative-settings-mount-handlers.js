    function syncLegacy() {
      const legacy = document.getElementById("nm70-style-scope"),
        all = document.getElementById("nm612-all-tab-scope");
      if (legacy) legacy.value = groups.style.target.value;
      if (all) all.checked = false;
    }
    organize(hud, sidebar);
    const chrome = document.querySelector(".top-chrome");
    const size = () => {
      if (hud.classList.contains("nm-panel-compact") || hud.classList.contains("nm-panel-minimized")) {
        hud.style.bottom = "";
        hud.style.maxHeight = "";
        return;
      }
      const rect = hud.getBoundingClientRect();
      let bottom = 12;
      for (const el of document.querySelectorAll(
        ".hud-bottom-right,#mobile-dock",
      )) {
        const r = el.getBoundingClientRect();
        if (r.height && r.width && r.left < rect.right && r.right > rect.left)
          bottom = Math.max(bottom, innerHeight - r.top + 8);
      }
      hud.style.bottom = bottom + "px";
      hud.style.maxHeight =
        Math.max(
          80,
          innerHeight -
            (chrome?.getBoundingClientRect().bottom || 90) -
            bottom -
            16,
        ) + "px";
    };
    size();
    root.addEventListener("resize", size);
    new MutationObserver(size).observe(hud, {
      attributes: true,
      attributeFilter: ["class"],
    });
    if (chrome) new ResizeObserver(size).observe(chrome);

    for (const group of Object.values(groups)) {
      const header = group.host.querySelector(".hud-header,.inspector-header");
      if (header) {
        const bodyHost = group.host.querySelector(":scope > .nm-panel-body");
        if (bodyHost) bodyHost.prepend(group.bar);
        else header.after(group.bar);
      }
      if (header) {
        const placeBar = () => {
          if (group.bar.closest(".glauka-scope-options")) return;
          const bodyHost = group.host.querySelector(":scope > .nm-panel-body");
          if (bodyHost) {
            if (group.bar.parentElement !== bodyHost || bodyHost.firstElementChild !== group.bar)
              bodyHost.prepend(group.bar);
          } else if (header.nextElementSibling !== group.bar) {
            header.after(group.bar);
          }
        };
        const observer = new MutationObserver(placeBar);
        observer.observe(group.host, { childList: true });
        placeBar();
      }
      group.host.addEventListener("keydown", (e) => {
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key !== "Escape" &&
          e.target.closest("button,input,select,summary,a")
        )
          e.stopPropagation();
      });
    }
    for (const group of Object.values(groups))
      group.specs = specs.filter(
        (s) =>
          available(s) &&
          (layoutIDs.has(s.id) ? group.id === "layout" : group.id === "style"),
      );
    const descriptors = [
      ["threshold-slider", "balance", "balanceBias", 1, "threshold-readout"],
      [
        "menu-threshold-slider",
        "balance",
        "balanceBias",
        1,
        "menu-threshold-val",
      ],
      [
        "nm67-compact-slider",
        "vertical",
        "compactness",
        1,
        "nm67-compact-readout",
      ],
      ["nm68-branch-gap", "gap", "branchGapX", 1, "nm68-gap-value"],
      [
        "nm54-map-wrap-slider",
        "wrap",
        "defaultLabelWrapChars",
        1,
        "nm54-map-wrap-label",
      ],
      ["nm63-stroke-range", "stroke", "strokeScale", 1, "nm63-stroke-value"],
      [
        "v5-font-scale",
        "scale",
        "typographyScale",
        0.01,
        "v5-font-scale-value",
      ],
      [
        "inspector-fontsize-slider",
        "font-size",
        "fontSize",
        1,
        "inspector-fontsize-val",
      ],
      ["nm54-wrap-slider", "node-wrap", "labelWrapChars", 1, "nm54-wrap-label"],
      ["nm68-text-indent", "indent", "labelIndent", 1, "nm68-indent-value"],
      [
        "nm-distribution-height",
        "continuation",
        "layoutDistribution",
        1,
        "nm-distribution-limit-value",
      ],
    ]
      .map(([id, specID, key, factor, output]) => ({
        element: document.getElementById(id),
        spec: specs.find((s) => s.id === specID),
        key,
        factor,
        output: document.getElementById(output),
      }))
      .filter((d) => d.element);
    const byID = new Map(descriptors.map((d) => [d.element.id, d]));
    function handle(e) {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (e.type === "input" || e.type === "change") {
        const d = byID.get(el.id);
        if (d) {
          if (el.disabled) {
            e.stopImmediatePropagation();
            return;
          }
          const value = Number(el.value) * d.factor,
            group = layoutIDs.has(d.spec.id) ? groups.layout : groups.style;
          if (!Number.isFinite(value)) return;
          e.stopImmediatePropagation();
          if (d.spec.kind === "node")
            applyNodes((n) => (n[d.key] = value), d.key, value, el);
          else
            mutate(
              el,
              group,
              (state) => {
                if (d.key === "layoutDistribution")
                  state.root.layoutDistribution = {
                    ...(state.root.layoutDistribution || { enabled: false }),
                    height: Math.max(
                      Number(state.root.layoutDistribution?.minimumHeight) ||
                        480,
                      value,
                    ),
                  };
                else {
                  state[d.key] = value;
                  if (d.key === "balanceBias") state.thresholdY = value;
                  if (d.key === "defaultLabelWrapChars")
                    state.wrapCustom = true;
                }
              },
              (state) =>
                d.key === "layoutDistribution"
                  ? state.root.layoutDistribution?.height !==
                    Math.max(
                      state.root.layoutDistribution?.minimumHeight || 480,
                      value,
                    )
                  : state[d.key] !== value,
              { layout: d.key !== "strokeScale" },
            );
          if (e.type === "change") finish();
          return;
        }
        if (el.id === "inspector-color-picker") {
          e.stopImmediatePropagation();
          applyNodes((n) => (n.color = el.value), "color", el.value, el);
          if (e.type === "change") finish();
          return;
        }
        if (el.id === "v5-font-preset") {
          e.stopImmediatePropagation();
          setMap("profile", { typographyPreset: el.value });
          return;
        }
      }
      if (e.type !== "click") return;
      if (innerWidth < 700) {
        if (el.closest("#v6-show-layout")) sidebar.classList.add("collapsed");
        if (
          el.closest("#btn-toggle-inspector") &&
          sidebar.classList.contains("collapsed")
        ) {
          hud.classList.add("hidden");
          document.getElementById("v6-show-layout")?.classList.remove("hidden");
        }
      }

      const mode = el.closest("#nm-layout-modes [data-mode]");
      if (mode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMode(mode.dataset.mode);
        return;
      }
      const branch = el.closest("#nm54-style-grid [data-style]");
      if (branch) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMap("branches", { branchStyle: branch.dataset.style });
        const picker=document.getElementById('nm54-branch-picker');
        if(picker){picker.open=false;picker.querySelector('summary')?.focus({preventScroll:true});}
        return;
      }
      const theme = el.closest(".theme-grid [data-theme-id]");
      if (theme) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMap("palette", { activeThemeId: theme.dataset.themeId });
        return;
      }
      const preset = el.closest("[data-v6-preset]");
      if (preset) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMap("profile", { typographyPreset: preset.dataset.v6Preset });
        document.getElementById("v6-preset-menu")?.classList.add("hidden");
        document
          .getElementById("v6-preset-trigger")
          ?.setAttribute("aria-expanded", "false");
        return;
      }
      const align = el.closest("[data-nm68-align]");
      if (align) {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyNodes(
          (n) => (n.labelAlign = align.dataset.nm68Align),
          "labelAlign",
          align.dataset.nm68Align,
        );
        return;
      }
      const swatch = el.closest("#inspector-swatch-grid .color-swatch");
      if (swatch) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const color = swatch.dataset.color || swatch.style.backgroundColor;
        applyNodes((n) => (n.color = color), "color", color);
        return;
      }
      const reset = el.closest("#v5-font-reset,#v5-reset-map-fonts");
      if (reset) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (reset.id === "v5-font-reset")
          applyNodes((n) => (n.fontSize = null), "fontSize", null);
        else {
          mutate(
            null,
            groups.style,
            (state) => state.getAllNodes().forEach((n) => (n.fontSize = null)),
            (state) => state.getAllNodes().some((n) => n.fontSize != null),
          );
          finish();
        }
        return;
      }
    }
    function setMap(id, value) {
      const spec = specs.find((s) => s.id === id);
      mutate(
        null,
        layoutIDs.has(id) ? groups.layout : groups.style,
        (state) => write(state, spec, value, false),
        (state) => !valuesEqual(stateValues(state, spec), value),
      );
      app.v6SyncFonts?.();
      const caption = document.getElementById("v6-preset-label");
      if (caption && root.NeuroMapLocale)
        caption.textContent = root.NeuroMapLocale.translate(
          caption.textContent,
          document.documentElement.lang,
        );
      finish();
    }
    function setMode(mode) {
      mutate(
        null,
        groups.layout,
        (state) => layoutMode(app, state, mode),
        (state) =>
          (state.root.layoutDistribution?.enabled
            ? "clockwise"
            : state.root.layoutMode || "balanced") !== mode || (mode==='balanced'&&state.root.layoutBalanceMode!=='geometry'),
      );
      app.layout._preferredViews?.clear();
      finish();
    }
    for (const name of ["input", "change", "click"])
      root.addEventListener(name, handle, true);
    root.addEventListener(
      "pointerdown",
      (e) => {
        if (gesture?.element !== e.target) finish();
        if (byID.has(e.target.id)) {
          e.stopImmediatePropagation();
          if(root.NeuroMapContinuation?.isGuideControl(e.target)){
            app._distributionGuideHeld = true;
            root.NeuroMapContinuation.showGuides(app);
          }else root.NeuroMapContinuation?.hideGuides(app);
        }
      },
      true,
    );
    root.addEventListener(
      "keydown",
      (e) => {
        if (
          byID.has(e.target.id) &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key !== "Escape"
        )
          e.stopImmediatePropagation();
      },
      true,
    );
    for (const group of Object.values(groups))
      group.bar.addEventListener("keydown", (e) => e.stopPropagation());
    root.addEventListener("blur", finish);
    root.addEventListener("pointercancel", finish);
    function refresh() {
      const saved = load();
      const memo = new Map(), targets = new Map();
      const resolveNodes = (state) => {
        if (!targets.has(state)) targets.set(state, nodes(state));
        return targets.get(state);
      };
      const summarize = (spec) => {
        if (!memo.has(spec.id)) memo.set(spec.id, summary(spec, resolveNodes));
        return memo.get(spec.id);
      };
      for (const group of Object.values(groups)) {
        if (!group.specs) continue;
        const checks = group.specs.filter((s) => saved[s.id]);
        const same =
          checks.length > 0 &&
          checks.every((s) => {
            const now = summarize(s);
            return (
              !now.mixed && !now.empty && valuesEqual(saved[s.id], now.value)
            );
          });
        group.save.dataset.icon = same ? "★" : "☆";
        group.save.setAttribute("aria-pressed", String(same));
        group.save.title = same
          ? tr(
              "Questi valori corrispondono ai tuoi predefiniti",
              "These values match your defaults",
            )
          : tr(
              "Scegli i predefiniti per le prossime creazioni",
              "Choose defaults for future items",
            );
        group.scope.title = tr(
          "Solo le impostazioni modificate successivamente.",
          "Only settings changed from now on.",
        );
        group.scope.setAttribute("aria-label", tr("Applica a:", "Apply to:"));
        if (group.id === "style") {
          group.bar.hidden =
            !!sidebar.dataset.nmSelection &&
            sidebar.dataset.nmSelection !== "node";
          group.target.title = tr(
            "Destinatari di testo e colore; gli stili della mappa valgono per tutta la scheda.",
            "Targets for text and color; map styles affect the whole map.",
          );
          group.target.setAttribute(
            "aria-label",
            tr("Elementi da formattare", "Elements to format"),
          );
          for (const option of group.target.options)
            option.disabled =
              group.scope.value === "all" &&
              ["selection", "subtree", "descendants"].includes(option.value);
        }
      }
      for (const d of descriptors) {
        const result = summarize(d.spec);
        if (d.spec.kind === "node") d.element.disabled = result.empty;
        d.element.dataset.mixed = String(result.mixed);
        d.element.setAttribute(
          "aria-description",
          result.mixed
            ? tr(
                "Valori diversi. Modifica solo questo parametro per uniformarlo.",
                "Mixed values. Change this parameter to make it common.",
              )
            : "",
        );
        if (d.output) {
          if (result.empty)
            d.output.textContent = tr("Nessuna selezione", "No selection");
          else if (result.mixed)
            d.output.textContent = tr("Valori diversi", "Mixed values");
          else {
            const value = result.value[d.key];
            if (d.key !== "layoutDistribution" && value == null)
              d.output.textContent = tr("Automatico", "Automatic");
            else if (d.key !== "layoutDistribution") {
              if (document.activeElement !== d.element)
                d.element.value = String(value / d.factor);
              d.output.textContent =
                d.key === "typographyScale" || d.key === "strokeScale"
                  ? Math.round(value * 100) + "%"
                  : d.key === "balanceBias"
                    ? value === 50
                      ? tr("Auto 50%", "Auto 50%")
                      : value + "%"
                    : d.key === "compactness"
                      ? value + "%"
                      : d.key === "branchGapX" ||
                          d.key === "fontSize" ||
                          d.key === "labelIndent"
                        ? value + " px"
                        : String(value);
            }
          }
          d.output.classList.toggle("nm-mixed-value", result.mixed);
        }
      }
    }
    app.nmFormatRefresh = refresh;
    app.nmFormatLocale = () => {
      for (const group of Object.values(groups)) locale(group.bar);
      for (const el of document.querySelectorAll(".nm-settings-section"))
        locale(el);
      for (const el of document.querySelectorAll(".nm-settings-accordion"))
        locale(el);
      refresh();
    };
    new MutationObserver(app.nmFormatLocale).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    syncLegacy();
    app.nmFormatLocale();
