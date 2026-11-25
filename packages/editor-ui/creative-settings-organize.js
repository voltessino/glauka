  function organize(hud, sidebar) {
    const section = (host, it, en) => {
      const el = document.createElement("section");
      el.className = "nm-settings-section";
      el.append(note(it, en));
      host.append(el);
      return el;
    };
    const move = (host, selector) => {
      const el = document.querySelector(selector);
      if (el) host.append(el);
    };
    const mode = section(hud, "Disposizione", "Arrangement");
    move(mode, "#nm-layout-modes");
    move(mode, "#threshold-slider");
    // Put the full distribution row back together after moving its input.
    const distribution = document.getElementById("threshold-slider");
    if (distribution) {
      const row = hud.querySelector(".slider-row");
      if (row) {
        row.append(distribution);
        mode.append(row);
      }
    }
    move(mode, "#nm-distribution-controls");
    const spacing = section(hud, "Spaziatura", "Spacing");
    move(spacing, ".nm67-compact-row");
    for (const [id, it, en, min, max, step, value, out] of [
      [
        "nm67-compact-slider",
        "Distanza tra i rami",
        "Distance between branches",
        55,
        145,
        5,
        100,
        "nm67-compact-readout",
      ],
      [
        "nm68-branch-gap",
        "Distanza fra nodo e sottorami",
        "Distance from node to children",
        30,
        220,
        5,
        150,
        "nm68-gap-value",
      ],
    ]) {
      let input = document.getElementById(id),
        row = input?.closest(".slider-row");
      if (!input) {
        input = document.createElement("input");
        Object.assign(input, { id, type: "range", min, max, step, value });
      }
      if (!row) {
        row = document.createElement("div");
        row.className = "slider-row";
        row.append(note(it, en));
        const obsoleteHint = input.nextElementSibling;
        if (obsoleteHint?.matches("p.nm54-hint")) obsoleteHint.remove();
        const labelBefore = input.previousElementSibling;
        if (labelBefore?.matches("label.nm68-row")) labelBefore.remove();
        const output =
          document.getElementById(out) || document.createElement("output");
        output.id = out;
        row.append(output, input);
      }
      const caption = row.querySelector("small,span:not([id]),label");
      if (caption) label(caption, it, en);
      spacing.append(row);
      input.setAttribute("aria-label", tr(it, en));
    }
    // Map-wide text wrapping is a specialized setting; show it only on request.
    // Keep the original input and its scope/persistence handlers intact.
    const text = document.createElement("details");
    text.className = "nm-settings-section nm-layout-text-more nm6-skiptranslate";
    const textTitle = document.createElement("summary");
    textTitle.dataset.it = "Testo a capo della mappa";
    textTitle.dataset.en = "Map text wrapping";
    textTitle.textContent = tr(textTitle.dataset.it, textTitle.dataset.en);
    text.append(textTitle);
    hud.append(text);
    move(text, ".nm54-hud-wrap");
    for (const row of hud.querySelectorAll(".slider-row")) {
      row.classList.add("nm-setting-control");
      const input = row.querySelector("input"),
        out = row.querySelector("output,[id$=readout]");
      if (out) row.append(out);
      if (input) row.append(input);
    }
    hud
      .querySelectorAll(".meter-group,.nm67-balance-note")
      .forEach((el) => (el.hidden = true));
    if (!sidebar.querySelector(".nm70-inspector-accordion")) {
      const original = [
        ...sidebar.querySelectorAll(":scope > .inspector-section"),
      ];
      if (original.length >= 2) {
        const [node, map] = original;
        const fold = (it, en) => {
          const box = document.createElement("details"),
            head = document.createElement("summary"),
            body = document.createElement("div");
          box.className = "nm70-inspector-accordion nm-settings-accordion";
          head.append(note(it, en));
          body.className = "nm70-inspector-body";
          box.append(head, body);
          map.before(box);
          return { box, body };
        };
        const type = fold("Testo e stile", "Text and style"),
          hierarchy = fold("Gerarchia tipografica", "Text hierarchy"),
          colors = fold("Colori e palette", "Colors and palettes");
        type.box.open = true;
        const swatches = node.querySelector("#inspector-swatch-grid"),
          custom = node.querySelector(".custom-color-row");
        for (const item of [swatches?.previousElementSibling, swatches, custom])
          if (item) colors.body.append(item);
        type.body.append(node);
        const shape = map
          .querySelector("#nm54-style-grid")
          ?.closest(".nm54-control");
        if (shape) {
          shape.id = shape.id || "gl-branches-control";
          let park = document.getElementById("gl-appearance-park");
          if (!park) {
            park = document.createElement("div");
            park.id = "gl-appearance-park";
            park.hidden = true;
            document.body.append(park);
          }
          park.append(shape);
        }
        const palette = map.querySelector(".theme-grid");
        for (const item of [palette?.previousElementSibling, palette])
          if (item) colors.body.append(item);
        hierarchy.body.append(...map.children);
        map.remove();
      }
    }
    // Reuse the desktop accordions; Android gets equivalent sections around its original controls.
    for (const host of [hud, sidebar]) host.classList.add("nm-settings-panel");
    for (const input of sidebar.querySelectorAll('input[type="range"]')) {
      const row = document.createElement("div"),
        previous = input.previousElementSibling;
      row.className = "nm-setting-control";
      input.before(row);
      if (previous?.matches(".inspector-control-row,.nm54-row,.nm68-row"))
        row.append(previous);
      row.append(input);
    }
  }
