/* Image captions: plain-text editing, safe range formatting and a live canvas preview. */
(function (root) {
  "use strict";
  const C = root.NeuroMapCaption;
  function mount({ app, panel, setImage, props, item, tr }) {
    let draft = null,
      lastRange = { start: 0, end: 0 };
    const label = document.createElement("label");
    label.className = "nm-media-field";
    const title = document.createElement("span"),
      field = document.createElement("textarea");
    field.id = "nm-img-caption";
    field.rows = 3;
    field.maxLength = C.MAX;
    label.append(title, field);
    const tools = document.createElement("div");
    tools.className = "nm-caption-toolbar";
    tools.setAttribute("role", "toolbar");
    const buttons = [];
    function selection() {
      const length = field.value.length,
        start = Math.min(length, lastRange.start),
        end = Math.min(length, lastRange.end);
      return start === end ? { start: 0, end: length } : { start, end };
    }
    const docOf = (img) =>
      C.sanitize(props(img).caption, props(img).captionStyles);
    function ensure() {
      const img = item(app);
      if (!img || img.graphic) return null;
      if (!draft || draft.owner !== app.state || draft.id !== img.id)
        draft = { owner: app.state, id: img.id, doc: docOf(img) };
      if (field.value !== draft.doc.text)
        draft.doc = C.edit(draft.doc, field.value);
      return draft;
    }
    function preview() {
      if (!draft) return;
      app.renderer._nmCaptionDraft = { ...draft };
      app.requestRender();
      syncButtons();
    }
    function commit(doc, target = item(app), owner = app.state) {
      if (!target || target.graphic || owner !== app.state) return;
      const old = docOf(target),
        ctx = app.renderer.ctx,
        w = Number(target.width) || 135,
        format = {align:props(target).captionAlign,fontSize:props(target).captionFontSize},
        delta = C.height(ctx, doc, w, format) - C.height(ctx, old, w, format);
      setImage(
        app,
        (p) => {
          p.caption = doc.text;
          p.captionStyles = doc.spans;
        },
        target,
        owner,
        { height: Math.max(16, (Number(target.height) || 100) + delta) },
      );
    }
    function flush(save = true) {
      if (!draft) return;
      const current = draft;
      draft = null;
      delete app.renderer._nmCaptionDraft;
      const img = current.owner.findImage(current.id);
      if (save && img) commit(current.doc, img, current.owner);
      else if (img && current.owner === app.state)
        field.value = docOf(img).text;
      app.requestRender();
    }
    function capture() {
      lastRange = { start: field.selectionStart, end: field.selectionEnd };
      syncButtons();
    }
/* @neuromap-caption-editor-buttons */
/* @neuromap-caption-editor-layout */
    function sync() {
      const img = item(app);
      if (!img) return;
      if (!draft || draft.owner !== app.state || draft.id !== img.id) {
        field.value = docOf(img).text;
        draft = null;
        delete app.renderer._nmCaptionDraft;
        lastRange = { start: 0, end: 0 };
      } else if (
        document.activeElement !== field &&
        field.value !== draft.doc.text
      )
        field.value = draft.doc.text;
      const p = props(img);
      if(document.activeElement!==align)align.value=p.captionAlign;
      for (const btn of alignButtons) {
        const active = btn.dataset.align === (p.captionAlign || "center");
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      }
      if(document.activeElement!==size)size.value=String(p.captionFontSize);
      sizeValue.textContent=String(p.captionFontSize)+" px";
      syncButtons();
    }
    function translate() {
      title.textContent = tr(
        "Titolo / descrizione sotto la foto",
        "Title / caption under the photo",
      );
      alignTitle.textContent=tr("Allineamento didascalia","Caption alignment");
      alignButtonsGroup.setAttribute("aria-label", alignTitle.textContent);
      for (const btn of alignButtons) {
        const text = tr(btn.dataset.it, btn.dataset.en);
        btn.setAttribute("aria-label", text);
        btn.title = text;
      }
      sizeTitle.textContent=tr("Dimensione testo didascalia","Caption text size");
      align.setAttribute("aria-label",alignTitle.textContent);
      size.setAttribute("aria-label",sizeTitle.textContent);
      for(const option of align.options)
        option.textContent=tr(option.dataset.it,option.dataset.en);
      field.placeholder = tr(
        "Descrivi questa immagine…",
        "Describe this image…",
      );
      for (const b of buttons) b._translate();
      const text = tr("Colore del testo", "Text colour");
      colour.setAttribute("aria-label", text);
      colourLabel.title = text;
      list.setAttribute(
        "aria-label",
        tr("Elenco della didascalia", "Caption list"),
      );
      for (const option of list.options)
        option.textContent = tr(option.dataset.it, option.dataset.en);
      tools.setAttribute(
        "aria-label",
        tr("Formato della didascalia", "Caption format"),
      );
      help.textContent = tr(
        "Seleziona le parole da formattare. Puoi attivare gli elenchi automatici nelle altre opzioni del testo. Ctrl+Invio conferma.",
        "Select words to format. You can enable automatic lists in the text options. Ctrl+Enter confirms.",
      );
    }
    app._nmCaptionPanel = { flush, sync, commit };
    translate();
    sync();
    return { sync, translate, flush, commit };
  }
  root.NeuroMapCaptionEditor = { mount };
})(globalThis);
