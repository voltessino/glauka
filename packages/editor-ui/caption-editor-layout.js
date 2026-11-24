    function changeLayout(key, value) {
      const target = item(app);
      if (!target || target.graphic) return;
      flush(true);
      const p = props(target), doc = docOf(target);
      const oldHeight = C.height(app.renderer.ctx, doc, Number(target.width) || 135,
        {align:p.captionAlign,fontSize:p.captionFontSize});
      const next = {...p,[key]:value};
      const newHeight = C.height(app.renderer.ctx, doc, Number(target.width) || 135,
        {align:next.captionAlign,fontSize:next.captionFontSize});
      setImage(app, x => { x[key] = value; }, target, app.state,
        {height:Math.max(16,(Number(target.height)||100)+newHeight-oldHeight)});
      sync();
    }
    align.addEventListener("change", () => changeLayout("captionAlign",align.value));
    size.addEventListener("input", () => { sizeValue.textContent = size.value + " px"; });
    // One Undo snapshot per completed adjustment, not one per mouse pixel.
    size.addEventListener("change", () => changeLayout("captionFontSize",Number(size.value)));
    const help = document.createElement("small");
    help.className = "nm-caption-help";
    panel.append(label, tools, paragraph, help);
    field.addEventListener("focus", () => {
      ensure();
      capture();
    });
    field.addEventListener("select", capture);
    field.addEventListener("keyup", capture);
    field.addEventListener("pointerup", capture);
    field.addEventListener("input", () => {
      const d = ensure();
      if (!d) return;
      lastRange = { start: field.selectionStart, end: field.selectionEnd };
      preview();
    });
    field.addEventListener("change", () => flush(true));
    C.bindListInput(field);
    field.addEventListener("keydown", (e) => {
      if(e.isComposing||e.keyCode===229)return;
      const mod = e.ctrlKey || e.metaKey,
        key = e.key.toLowerCase();
      if (mod && ["b", "i", "u"].includes(key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        capture();
        buttons
          .find(
            (b) =>
              b.dataset.style ===
              { b: "bold", i: "italic", u: "underline" }[key],
          )
          .click();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        flush(true);
        app.saveToFile(e.shiftKey);
        return;
      }
      if (mod && key === "o") {
        e.preventDefault();
        e.stopImmediatePropagation();
        flush(true);
        document.getElementById("btn-import-files-new-tabs")?.click();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        flush(false);
        field.blur();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        flush(true);
        field.blur();
      }
      e.stopPropagation();
    });
