  function render(
    tabs,
    fmt,
    { separate = false, serializeMarkdown, serializeJSON } = {},
  ) {
    const summary = inspect(tabs),
      roots = tabs.map((t) => t.state?.root || t.root),
      format = String(fmt).toLowerCase();
    const extensions = {
      md: "md",
      txt: "txt",
      opml: "opml",
      mm: "mm",
      html: "html",
      docx: "docx",
      json: "json",
      neuromap: "neuromap",
    };
    const ext = extensions[format];
    if (!ext) throw Error("Formato non supportato: " + format);
    const md = (root) => {
      if (typeof serializeMarkdown !== "function")
        throw Error("Serializer Markdown mancante.");
      return serializeMarkdown(root);
    };
    const json = (t) => {
      if (typeof serializeJSON !== "function")
        throw Error("Serializer JSON mancante.");
      return serializeJSON(t);
    };
    const single = (root, i) => {
      if (format === "md") return md(root);
      if (format === "txt") return "NEUROMAP-TXT-2\n" + txt(root);
      if (format === "opml") return opml([root]);
      if (format === "mm") return freemind(root);
      if (format === "html") return html([root]);
      if (format === "docx") return docx([root]);
      return JSON.stringify(json(tabs[i]), null, 2);
    };
    const names = dedup(
      roots.map((r) => r.text),
      ext,
    );
    if (separate && tabs.length > 1) {
      const files = tabs.map((t, i) => ({
        name: names[i],
        data: single(roots[i], i),
      }));
      return {
        name: "neuromap_" + format + "_" + tabs.length + "_schede.zip",
        data: zip(files),
        mime: "application/zip",
        summary,
        separate: true,
      };
    }
    let data;
    if (format === "md") {
      if (summary.nodes > 3500)
        throw Error(
          "Il Markdown unico supera 3500 nodi reimportabili: usa file separati ZIP.",
        );
      data = roots.map(md).join("\n\n---\n\n");
    } else if (format === "txt") {
      if (roots.length > 1 && summary.nodes > 3500)
        throw Error(
          "TXT multiplo oltre 3500 nodi reimportabili: usa ZIP separato.",
        );
      data =
        roots.length === 1
          ? "NEUROMAP-TXT-2\n" + txt(roots[0])
          : "NEUROMAP-TXT-MULTI-2\n" +
            roots.map(txt).join("\n=== NEUROMAP TAB ===\n");
    } else if (format === "opml") {
      if (roots.length > 1 && summary.nodes > 3500)
        throw Error(
          "OPML multiplo oltre 3500 nodi reimportabili: usa ZIP separato.",
        );
      data = opml(roots);
    } else if (format === "mm") {
      if (roots.length > 1)
        throw Error(
          "FreeMind .mm supporta una sola radice: scegli ZIP di file separati.",
        );
      data = freemind(roots[0]);
    } else if (format === "html") data = html(roots);
    else if (format === "docx") data = docx(roots);
    else if (format === "json" || format === "neuromap") {
      if (roots.length === 1) data = JSON.stringify(json(tabs[0]), null, 2);
      else {
        if (summary.nodes > 3500)
          throw Error(
            "Il backup JSON multiplo supera 3500 nodi reimportabili: usa ZIP separato.",
          );
        data = JSON.stringify(
          {
            schema: "NeuroMapArchitect-WorkspaceBatch-v6",
            exportedAt: new Date().toISOString(),
            tabs: tabs.map(json),
          },
          null,
          2,
        );
      }
    }
    const type = {
      md: "text/markdown;charset=utf-8",
      txt: "text/plain;charset=utf-8",
      opml: "text/x-opml;charset=utf-8",
      mm: "application/xml;charset=utf-8",
      html: "text/html;charset=utf-8",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      json: "application/json;charset=utf-8",
      neuromap: "application/json;charset=utf-8",
    }[format];
    return {
      name:
        roots.length === 1
          ? names[0]
          : "neuromap_" + tabs.length + "_schede." + ext,
      data,
      mime: type,
      summary,
      separate: false,
    };
  }

  // Portable PDF of the document outline. Rendered JPEG pages support Unicode
  // via canvas fonts and avoid platform-specific Latin-1 PDF font corruption.
