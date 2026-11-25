    document.head.append(style);
    const groups = {
      layout: { id: "layout", host: hud },
      style: { id: "style", host: sidebar },
    };
    let gesture = null;
    const finish = () => {
      gesture = null;
    };
    const states = (group) =>
      group.scope.value === "all"
        ? [...new Set(app.tabs.map((t) => t.state))]
        : [app.state];
    const nodes = (state) => targetNodes(state, groups.style.target.value);
    const available = (spec) => !!document.querySelector(spec.selector);
    const summary = (spec, resolveNodes = nodes) => {
      const group = layoutIDs.has(spec.id) ? groups.layout : groups.style;
      return summarizeSettings(spec, states(group), resolveNodes);
    };
    const begin = (element, group) => {
      if (
        !gesture ||
        gesture.element !== element ||
        gesture.source !== app.state
      )
        gesture = {
          element,
          source: app.state,
          states: states(group),
          nodes: new Map(),
          recorded: new Set(),
        };
      return gesture;
    };
    const mutate = (element, group, change, shouldChange = () => true, options) => {
      const tx = begin(element, group);
      let changed = false;
      for (const state of tx.states) {
        if (!app.tabs.some((t) => t.state === state)) continue;
        if (!tx.nodes.has(state)) tx.nodes.set(state, nodes(state));
        const targets = tx.nodes.get(state);
        if (!shouldChange(state, targets)) continue;
        if (!tx.recorded.has(state)) {
          state.pushHistory();
          tx.recorded.add(state);
        }
        change(state, targets);
        state.isDirty = true;
        changed = true;
      }
      if (changed) {
        for (const state of tx.recorded) {
          if (state !== app.state && options?.layout !== false) state._nmNeedsLayout = true;
        }
        if (tx.recorded.has(app.state)) app.markChanged(options);
        else {
          app.recalculateAndRender(false, options);
          app.scheduleSave();
        }
        app.nm54SyncSettings?.();
        app.renderTabBar();
        if(group.id==="layout")root.NeuroMapContinuation?.showGuides(app);
        else root.NeuroMapContinuation?.hideGuides(app);
      }
      refresh();
    };
    const applyNodes = (fn, field, value, element = null) => {
      const defaultsByField = {
        fontItalic: false,
        fontUnderline: false,
        fontStrike: false,
        fontWeight: 400,
        nodeShape: "plain",
        labelAlign: "center",
        labelIndent: 0,
      };
      mutate(
        element,
        groups.style,
        (_, targets) => targets.forEach(fn),
        (_, targets) =>
          targets.length > 0 &&
          (!field ||
            targets.some(
              (n) =>
                !valuesEqual(
                  n[field] ?? (Object.hasOwn(defaultsByField, field) ? defaultsByField[field] : null),
                  value,
                ),
            )),
        { layout: !paintOnlyNodeFields.has(field) },
      );
      if (!element) finish();
    };
    app.nmSettings = { finish, states, summary };
    app.nm70ScopeNodes = () => nodes(app.state);
    app.nm70ScopeAllNodes = () => states(groups.style).flatMap((state) => nodes(state));
    app.nm70BatchStyle = (_, fn) => {
      applyNodes(fn);
      return true;
    };
    app.nmSettingsApplyNode = (field, value) =>
      applyNodes((n) => (n[field] = value), field, value);
    // Legacy IDs remain as inert compatibility inputs for existing binders.
    const oldScope = document.getElementById("nm70-scope-panel");
    if (oldScope) oldScope.hidden = true;
    for (const selector of [
      ".nm70-gap-prefs",
      ".v6-default-row",
      ".nm64-default-wrap-row",
      ".nm64-wrap-note",
    ])
      document.querySelectorAll(selector).forEach((el) => (el.hidden = true));
    const oldCopy = document.getElementById("nm67-apply-all-styles");
    if (oldCopy) {
      oldCopy.hidden = true;
      if (oldCopy.nextElementSibling) oldCopy.nextElementSibling.hidden = true;
    }
    function select(id, options) {
      const el = document.createElement("select");
      el.id = id;
      for (const [value, it, en] of options) {
        const o = label(document.createElement("option"), it, en);
        o.value = value;
        el.append(o);
      }
      return el;
    }
    function field(it, en, control) {
      const el = document.createElement("label");
      el.append(note(it, en), control);
      return el;
    }
    function defaultsDialog(group) {
      finish();
      const { panel, close, valid } = root.NeuroMapCreativeModules.ui.dialog(
        app,
        "nm-settings-defaults",
        "Preferenze per il futuro",
        "Preferences for future items",
      );
      panel.append(
        note(
          "Scegli quali valori usare per nuove mappe o nuovi nodi. Le schede aperte non vengono modificate.",
          "Choose values for new maps or nodes. Open maps keep their settings.",
        ),
      );
      const entries = group.specs.map((spec) => ({ spec, ...summary(spec) })),
        checks = [];
      for (const entry of entries) {
        const line = document.createElement("label"),
          check = document.createElement("input");
        check.type = "checkbox";
        check.dataset.setting = entry.spec.id;
        check.disabled = entry.mixed || entry.empty;
        check.checked = !check.disabled;
        const text = note(
          entry.spec.it +
            (entry.spec.kind === "node" ? " · nuovi nodi" : " · nuove mappe"),
          entry.spec.en +
            (entry.spec.kind === "node" ? " · new nodes" : " · new maps"),
        );
        line.className = "nm-default-choice";
        line.append(check, text);
        if (!check.disabled) {
          const control = descriptors.find(
            (d) => d.spec === entry.spec && d.output,
          );
          const key = entry.spec.fields[0],
            value = entry.value[key];
          const selector =
            entry.spec.id === "branches"
              ? `[data-style="${value}"]`
              : entry.spec.id === "palette"
                ? `[data-theme-id="${value}"]`
                : entry.spec.id === "layout"
                  ? `[data-mode="${value}"]`
                  : null;
          let caption = selector
            ? document.querySelector(selector)?.textContent.trim()
            : control?.output.textContent;
          if (entry.spec.id === "continuation")
            caption = entry.value.layoutDistribution.enabled
              ? tr("Attiva", "On") +
                " · " +
                entry.value.layoutDistribution.height
              : tr("Disattiva", "Off");
          if (entry.spec.id === "profile")
            caption = document.getElementById("v6-preset-label")?.textContent;
          if (entry.spec.id === "root-gap")
            caption = Number(value) === 0 ? tr("Attaccato", "Attached") : value + " px";
          if (entry.spec.id === "font-style")
            caption =
              (entry.value.fontWeight >= 650
                ? tr("Grassetto", "Bold")
                : tr("Normale", "Regular")) +
              (entry.value.fontItalic ? tr(" e corsivo", " and italic") : "") +
              (entry.value.fontFamily ? " · " + entry.value.fontFamily : "");
          if (entry.spec.id === "node-shape")
            caption = document.querySelector(`#glauka-node-shape option[value="${value || "plain"}"]`)?.textContent?.trim() || (value || "plain");
          if (entry.spec.id === "align")
            caption = {
              left: tr("Sinistra", "Left"),
              center: tr("Centro", "Center"),
              right: tr("Destra", "Right"),
            }[value];
          if (!caption)
            caption =
              value == null ? tr("Automatico", "Automatic") : String(value);
          const current = document.createElement("span");
          current.className = "nm-default-value";
          current.textContent = caption;
          text.append(document.createElement("br"), current);
        }
        if (check.disabled)
          line.append(
            note(
              "Valori diversi: scegli prima un valore comune.",
              "Mixed values: choose a common value first.",
            ),
          );
        panel.append(line);
        checks.push({ check, entry });
      }
      const feedback = note("", "");
      feedback.setAttribute("role", "status");
      panel.append(feedback);
      const save = button(
        "nm-settings-save-defaults",
        "Salva preferenze",
        "Save preferences",
        () => {
          if (
            !valid() ||
            entries.some(
              (e) =>
                !valuesEqual(summary(e.spec), {
                  value: e.value,
                  mixed: e.mixed,
                  empty: e.empty,
                }),
            )
          ) {
            feedback.textContent = tr(
              "Le impostazioni sono cambiate. Riapri questo riepilogo.",
              "Settings changed. Reopen this review.",
            );
            return;
          }
          try {
            const saved = load();
            for (const { check, entry } of checks)
              if (check.checked && !check.disabled)
                saved[entry.spec.id] = entry.value;
            localStorage.setItem(KEY, JSON.stringify(saved));
            refresh();
            close();
            app.showToast(
              tr(
                "Preferenze salvate per le prossime creazioni.",
                "Preferences saved for future items.",
              ),
              "PREFERENZE",
            );
          } catch {
            feedback.textContent = tr(
              "Impossibile salvare le preferenze.",
              "Could not save preferences.",
            );
          }
        },
      );
      const update = () =>
        (save.disabled = !checks.some(
          (c) => c.check.checked && !c.check.disabled,
        ));
      checks.forEach((c) => (c.check.onchange = update));
      update();
      const reset = button(
        "nm-settings-reset-defaults",
        "Ripristina predefiniti originali",
        "Restore original defaults",
        () => {
          if (!valid()) return;
          try {
            const saved = load();
            for (const spec of group.specs) saved[spec.id] = null;
            localStorage.setItem(KEY, JSON.stringify(saved));
            refresh();
            close();
            app.showToast(
              tr(
                "Ripristinati i predefiniti per le prossime creazioni.",
                "Original defaults restored for future items.",
              ),
              "PREFERENZE",
            );
          } catch {
            feedback.textContent = tr(
              "Impossibile salvare le preferenze.",
              "Could not save preferences.",
            );
          }
        },
      );
      panel.append(save, reset);
    }
    for (const group of Object.values(groups)) {
      group.bar = document.createElement("section");
      group.bar.id = "nm-settings-" + group.id;
      group.bar.className = "nm-settings-toolbar nm6-skiptranslate";
      group.scope = select("nm-settings-scope-" + group.id, [
        ["current", "Questa scheda", "This map"],
        ["all", "Tutte le schede aperte", "All open maps"],
      ]);
      group.bar.append(field("Applica a:", "Apply to:", group.scope));
      if (group.id === "style") {
        group.target = select("nm-format-target", [
          ["selection", "Nodi selezionati", "Selected nodes"],
          ["subtree", "Ramo e discendenti", "Branch and descendants"],
          ["descendants", "Solo discendenti", "Descendants only"],
          ["map", "Tutti i nodi", "All nodes"],
          ...Array.from({ length: 8 }, (_, i) => [
            "level" + (i + 1),
            "Livello " + (i + 1),
            "Level " + (i + 1),
          ]),
        ]);
        group.bar.append(field("Elementi:", "Elements:", group.target));
        group.target.onchange = () => {
          finish();
          syncLegacy();
          refresh();
        };
      }
      group.save = button(
        "nm-settings-defaults-" + group.id,
        "Salva come predefiniti",
        "Save as defaults",
        () => defaultsDialog(group),
      );
      group.save.className = "nm-settings-default-button";
      group.save.dataset.icon = "☆";
      group.bar.append(group.save);
      group.scope.onchange = () => {
        finish();
        if (
          group.id === "style" &&
          group.scope.value === "all" &&
          ["selection", "subtree", "descendants"].includes(group.target.value)
        )
          group.target.value = "map";
        syncLegacy();
        refresh();
      };
      (
        group.host.querySelector(".hud-header,.inspector-header") ||
        group.host.firstElementChild
      ).after(group.bar);
    }
