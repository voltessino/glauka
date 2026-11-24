    function syncButtons() {
      const img = item(app),
        d =
          draft?.owner === app.state && draft.id === img?.id
            ? draft.doc
            : img
              ? docOf(img)
              : { text: "", spans: [] },
        range = selection(),
        active = C.selectedStyle(d, range.start, range.end);
      for (const b of buttons)
        b.setAttribute("aria-pressed", String(!!active[b.dataset.style]));
      colour.value = active.color || "#e5ecfc";
      list.value = C.listKind(d.text);
      if (!list.value) list.value = "none";
    }
    for (const [key, it, en, symbolIt, symbolEn] of [
      ["bold", "Grassetto", "Bold", "G", "B"],
      ["italic", "Corsivo", "Italic", "C", "I"],
      ["underline", "Sottolineato", "Underline", "S", "U"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "nm-caption-" + key;
      b.dataset.style = key;
      buttons.push(b);
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        const d = ensure();
        if (!d) return;
        const r = selection(),
          s = C.selectedStyle(d.doc, r.start, r.end);
        d.doc = C.apply(d.doc, r.start, r.end, { [key]: !s[key] });
        commit(d.doc);
        preview();
        field.focus();
        field.setSelectionRange(r.start, r.end);
      });
      b._translate = () => {
        b.textContent = tr(symbolIt, symbolEn);
        b.title = tr(it, en);
        b.setAttribute("aria-label", tr(it, en));
      };
      tools.append(b);
    }
    const colourLabel = document.createElement("label");
    colourLabel.className = "nm-caption-colour";
    const colour = document.createElement("input");
    colour.type = "color";
    colour.id = "nm-caption-color";
    colour.value = "#e5ecfc";
    colourLabel.append(colour);
    tools.append(colourLabel);
    colour.addEventListener("change", () => {
      const value = colour.value,
        d = ensure();
      if (!d) return;
      const r = selection();
      d.doc = C.apply(d.doc, r.start, r.end, { color: value });
      commit(d.doc);
      preview();
    });
    const list = document.createElement("select");
    list.id = "nm-caption-list";
    for (const [value, it, en] of [
      ["none", "Nessun elenco", "No list"],
      ["disc", "• Punti pieni", "• Solid dots"],
      ["circle", "○ Cerchi", "○ Circles"],
      ["square", "▪ Quadrati", "▪ Squares"],
      ["dash", "– Trattini", "– Dashes"],
      ["number", "1. Numeri", "1. Numbers"],
      ["letter", "a. Lettere", "a. Letters"],
      ["roman", "i. Numeri romani", "i. Roman numerals"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.dataset.it = it;
      option.dataset.en = en;
      list.append(option);
    }
    tools.append(list);
    list.addEventListener("change", () => {
      const d = ensure();
      if (!d) return;
      try {
        d.doc = C.list(d.doc, list.value);
        field.value = d.doc.text;
        lastRange = { start: 0, end: 0 };
        commit(d.doc);
        preview();
      } catch (error) {
        app.showToast?.(
          tr(
            "Didascalia troppo lunga: accorciala prima di aggiungere l’elenco.",
            "Caption too long: shorten it before adding a list.",
          ),
          "ERRORE",
        );
      }
    });
    // Image-only paragraph layout: no node-style toolbar is needed.
    const paragraph = document.createElement("div");
    paragraph.className = "nm-caption-layout";
    const alignLabel = document.createElement("div");
    alignLabel.className = "nm-media-field";
    const alignTitle = document.createElement("span");
    const align = document.createElement("select");
    align.id = "nm-caption-align";
    align.style.display = "none";
    for (const [value, it, en] of [
      ["left", "A sinistra", "Left"],
      ["center", "Centrato", "Center"],
      ["right", "A destra", "Right"],
    ]) {
      const option = document.createElement("option");
      option.value = value; option.dataset.it = it; option.dataset.en = en;
      align.append(option);
    }
    const alignButtonsGroup = document.createElement("div");
    alignButtonsGroup.className = "nm-caption-align-buttons";
    alignButtonsGroup.setAttribute("role", "group");
    const alignSvgs = {
      left: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
      center: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
      right: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
    };
    const alignButtons = [];
    for (const [value, it, en] of [
      ["left", "Allinea a sinistra", "Align left"],
      ["center", "Centra il testo", "Center text"],
      ["right", "Allinea a destra", "Align right"],
    ]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.align = value;
      btn.innerHTML = alignSvgs[value];
      btn.dataset.it = it;
      btn.dataset.en = en;
      btn.addEventListener("click", () => {
        align.value = value;
        changeLayout("captionAlign", value);
      });
      alignButtonsGroup.append(btn);
      alignButtons.push(btn);
    }
    alignLabel.append(alignTitle, alignButtonsGroup, align);
    const sizeLabel = document.createElement("label");
    sizeLabel.className = "nm-media-field";
    const sizeTitle = document.createElement("span");
    const size = document.createElement("input");
    size.type = "range"; size.id = "nm-caption-font-size";
    size.min = "9"; size.max = "36"; size.step = "1";
    const sizeValue = document.createElement("output");
    sizeValue.id = "nm-caption-size-value";
    sizeLabel.append(sizeTitle, size, sizeValue);
    paragraph.append(alignLabel, sizeLabel);
