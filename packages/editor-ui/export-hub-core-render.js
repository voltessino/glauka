  function render(
    tabs,
    fmt,
    {
      separate = false,
      splitMode,
      preset = "balanced",
      hierarchicalNumbering,
      chunks: providedChunks,
      serializeMarkdown,
      serializeJSON,
    } = {},
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
    const isModularFormat = MODULAR_FORMATS.includes(format);
    const effectiveMode = splitMode || (separate ? "tabs" : "single");
    const isCleanTextFormat = format === "md" || format === "txt";
    if (
      tabs.length > 1 &&
      !separate &&
      effectiveMode === "single" &&
      ["md", "txt", "opml", "json", "neuromap"].includes(format) &&
      summary.nodes > 3500
    ) {
      throw Error(
        format.toUpperCase() +
          " unico oltre 3500 nodi reimportabili: usa ZIP separato o Moduli bilanciati.",
      );
    }
    const useChunkPipeline =
      isModularFormat &&
      (isCleanTextFormat ||
        effectiveMode === "modular" ||
        !!providedChunks ||
        (!!hierarchicalNumbering && effectiveMode === "single") ||
        (!!hierarchicalNumbering && effectiveMode === "tabs"));

    if (useChunkPipeline) {
      const numbered =
        typeof hierarchicalNumbering === "boolean"
          ? hierarchicalNumbering
          : effectiveMode === "modular";
      const chunks =
        Array.isArray(providedChunks) && providedChunks.length
          ? providedChunks
          : TreeChunker.chunkTabs(tabs, {
              preset,
              hierarchicalNumbering: numbered,
              includeHeader: effectiveMode === "modular",
              extension: ext,
              numberOnly: effectiveMode !== "modular",
            });
      const renderChunkContent = (chunk) => {
        if (format === "md") return markdownChunk(chunk);
        if (format === "txt") return txtChunk(chunk);
        if (format === "html")
          return html([chunk.nodes_tree], {
            structuredHeadings: true,
            chunks: [chunk],
          });
        if (format === "docx")
          return docx([chunk.nodes_tree], {
            structuredHeadings: true,
            chunks: [chunk],
          });
        return txtChunk(chunk);
      };
      const mimeMap = {
        md: "text/markdown;charset=utf-8",
        txt: "text/plain;charset=utf-8",
        html: "text/html;charset=utf-8",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const renderedFiles = chunks.map((chunk) => ({
        name: chunk.suggested_filename,
        data: renderChunkContent(chunk),
        mime: mimeMap[format],
        chunk,
      }));
      if (effectiveMode === "modular" && renderedFiles.length > 1) {
        return {
          name: "neuromap_" + format + "_moduli_" + renderedFiles.length + ".zip",
          data: zip(renderedFiles),
          mime: "application/zip",
          summary,
          separate: true,
          modular: true,
          files: renderedFiles,
          chunks,
        };
      }
      if ((effectiveMode === "tabs" || separate) && tabs.length > 1 && renderedFiles.length > 1) {
        return {
          name: "neuromap_" + format + "_" + renderedFiles.length + "_schede.zip",
          data: zip(renderedFiles),
          mime: "application/zip",
          summary,
          separate: true,
          modular: false,
          files: renderedFiles,
          chunks,
        };
      }
      // Single file (either compact map <= maxWords OR File unico)
      let combined;
      if (renderedFiles.length === 1) combined = renderedFiles[0].data;
      else if (format === "md" || format === "txt")
        combined = renderedFiles.map((f) => f.data).join("\n\n---\n\n");
      else if (format === "html")
        combined = html(
          chunks.map((c) => c.nodes_tree),
          { structuredHeadings: true, chunks },
        );
      else
        combined = docx(
          chunks.map((c) => c.nodes_tree),
          { structuredHeadings: true, chunks },
        );
      return {
        name:
          chunks.length === 1
            ? renderedFiles[0].name
            : "neuromap_" + tabs.length + "_schede." + ext,
        data: combined,
        mime: mimeMap[format],
        summary,
        separate: false,
        modular: effectiveMode === "modular",
        files: renderedFiles,
        chunks,
      };
    }

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
            tabs: tabs.map((t, i) => {
              const payload = json(t);
              return payload && typeof payload === "object"
                ? {
                    ...(t.id ? { id: t.id } : {}),
                    title: payload.root?.text || roots[i]?.text || t.title || "Mappa",
                    ...payload,
                  }
                : payload;
            }),
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
