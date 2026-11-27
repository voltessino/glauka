  async function pdf(
    tabs,
    {
      separate = false,
      splitMode,
      preset = "balanced",
      hierarchicalNumbering,
      chunks: providedChunks,
    } = {},
  ) {
    const summary = inspect(tabs);
    if (typeof document === "undefined")
      throw Error("PDF requires a browser canvas.");
    const effectiveMode = splitMode || (separate ? "tabs" : "single");
    const structured =
      effectiveMode === "modular" ||
      !!providedChunks ||
      !!hierarchicalNumbering;
    const chunks = structured
      ? Array.isArray(providedChunks) && providedChunks.length
        ? providedChunks
        : TreeChunker.chunkTabs(tabs, {
            preset,
            hierarchicalNumbering:
              typeof hierarchicalNumbering === "boolean"
                ? hierarchicalNumbering
                : effectiveMode === "modular",
            includeHeader: effectiveMode === "modular",
            extension: "pdf",
            numberOnly: effectiveMode !== "modular",
          })
      : null;
    const roots = chunks
      ? chunks.map((c) => c.nodes_tree)
      : tabs.map((t) => t.state?.root || t.root);
    const W = 960,
      H = 1358,
      M = 66,
      leading = 28;
    const lineWrap = (ctx, text, width) => {
      const paragraphs = String(text || "")
        .replace(/\r\n?/g, "\n")
        .split("\n");
      const lines = [];
      for (const para of paragraphs) {
        if (!para.trim()) {
          lines.push("");
          continue;
        }
        const words = para.split(/(\s+)/);
        let line = "";
        for (const word of words) {
          if (!word) continue;
          if (!line && /^\s+$/.test(word)) continue;
          if (ctx.measureText(word).width > width) {
            if (line) {
              lines.push(line.trimEnd());
              line = "";
            }
            for (const char of word) {
              if (line && ctx.measureText(line + char).width > width) {
                lines.push(line);
                line = "";
              }
              line += char;
            }
            continue;
          }
          if (ctx.measureText(line + word).width > width && line) {
            lines.push(line.trimEnd());
            line = word.trimStart();
          } else line += word;
        }
        if (line) lines.push(line.trimEnd());
      }
      return lines.length ? lines : [""];
    };
    async function pagesFor(targetRoots, targetChunks = null) {
      const images = [];
      let canvas = null,
        ctx = null,
        y = 0,
        page = 0;
      function open() {
        canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw Error("Canvas PDF non disponibile.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        page++;
        if (page > 120)
          throw Error(
            "PDF oltre 120 pagine: scegli file separati o meno schede.",
          );
        ctx.fillStyle = "#475569";
        ctx.font = "16px system-ui,sans-serif";
        ctx.fillText("Glauka · Export · Pag. " + page, M, H - 40);
        y = M + 16;
      }
      async function close() {
        if (!canvas) return;
        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(Error("Codifica pagina PDF fallita.")),
            "image/jpeg",
            0.9,
          ),
        );
        images.push(new Uint8Array(await blob.arrayBuffer()));
        canvas.width = 1;
        canvas.height = 1;
        canvas = null;
        ctx = null;
      }
      for (let rIdx = 0; rIdx < targetRoots.length; rIdx++) {
        const root = targetRoots[rIdx];
        const chunk = targetChunks ? targetChunks[rIdx] : null;
        if (rIdx > 0 && ctx) {
          await close();
          open();
        }
        if (!ctx) open();
        if (y > H - M - 110) {
          await close();
          open();
        }
        const h = chunk?.context_header;
        if (h && (h.total_parts || 1) > 1) {
          ctx.fillStyle = "#eef2ff";
          ctx.fillRect(M, y - 16, W - 2 * M, 68);
          ctx.fillStyle = "#312e81";
          ctx.font = "bold 14px system-ui,sans-serif";
          ctx.fillText(String(h.title || "Mappa") + " — " + h.partLabel, M + 10, y + 2);
          ctx.fillStyle = "#475569";
          ctx.font = "13px system-ui,sans-serif";
          const secLine = lineWrap(ctx, "Sezioni: " + (h.sections || []).join(" · "), W - 2 * M - 20)[0] || "";
          ctx.fillText(secLine, M + 10, y + 22);
          if (h.previousLastSection)
            ctx.fillText("Continua da: " + h.previousLastSection, M + 10, y + 40);
          y += 76;
        }
        ctx.fillStyle = "#4f46e5";
        ctx.font = "bold 27px system-ui,sans-serif";
        const titleLines = lineWrap(ctx, root.text, W - 2 * M);
        for (const text of titleLines) {
          if (y > H - M - 40) {
            await close();
            open();
            ctx.fillStyle = "#4f46e5";
            ctx.font = "bold 27px system-ui,sans-serif";
          }
          ctx.fillText(text, M, y);
          y += 39;
        }
        y += 18;
        for (const { node, level } of [
          ...(root.notes
            ? [{ node: { text: "", notes: root.notes }, level: 1 }]
            : []),
          ...collect(root).slice(1),
        ]) {
          const isH2 = structured && level === 1 && node.text;
          const isH3 = structured && level === 2 && node.text;
          const indent = structured
            ? isH2
              ? 0
              : isH3
                ? 8
                : Math.min(260, Math.max(0, level - 2) * 17)
            : Math.min(260, Math.max(0, level - 1) * 17);
          const x = M + indent;
          const parts = [
            { text: node.text, bold: true, heading: isH2 ? 2 : isH3 ? 3 : 0 },
            ...(node.notes ? [{ text: node.notes, bold: false, heading: 0 }] : []),
          ].filter((part) => part.text);
          for (const part of parts) {
            if (!ctx) open();
            const fontSpec =
              part.heading === 2
                ? "bold 21px system-ui,sans-serif"
                : part.heading === 3
                  ? "bold 17px system-ui,sans-serif"
                  : (part.bold ? "600 17px" : "14px") + " system-ui,sans-serif";
            const fillColor =
              part.heading === 2
                ? "#1e1b4b"
                : part.heading === 3
                  ? "#334155"
                  : part.bold
                    ? "#1f2937"
                    : "#64748b";
            ctx.font = fontSpec;
            ctx.fillStyle = fillColor;
            const prefix = part.bold && !part.heading ? "• " : "";
            const lineWidth = W - M - x - 6,
              lines = lineWrap(ctx, prefix + part.text, lineWidth);
            for (const text of lines) {
              if (y > H - M - 45) {
                await close();
                open();
                ctx.fillStyle = fillColor;
                ctx.font = fontSpec;
              }
              ctx.fillText(text, x, y);
              y += part.heading === 2 ? 30 : part.bold ? leading : 23;
            }
          }
          y += isH2 ? 6 : 3;
        }
        y += 34;
      }
      await close();
      return images;
    }
    function build(images) {
      const parts = [],
        offsets = [];
      let cursor = 0;
      function write(str) {
        const b = bytes(str);
        parts.push(b);
        cursor += b.length;
      }
      function binary(arr) {
        parts.push(arr);
        cursor += arr.length;
      }
      function obj(id, str) {
        offsets[id] = cursor;
        write(id + " 0 obj\n" + str + "\nendobj\n");
      }
      write("%PDF-1.4\n%NeuroMap\n");
      const ids = [],
        pageW = 595.28,
        pageH = 841.89;
      for (let i = 0; i < images.length; i++) {
        const data = images[i],
          imageId = 4 + i * 3,
          contentId = imageId + 1,
          pageId = imageId + 2;
        offsets[imageId] = cursor;
        write(
          imageId +
            " 0 obj\n<< /Type /XObject /Subtype /Image /Width " +
            W +
            " /Height " +
            H +
            " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            data.length +
            " >>\nstream\n",
        );
        binary(data);
        write("\nendstream\nendobj\n");
        const drawing =
          "q\n" + pageW + " 0 0 " + pageH + " 0 0 cm\n/Im0 Do\nQ\n";
        obj(
          contentId,
          "<< /Length " +
            encoder.encode(drawing).length +
            " >>\nstream\n" +
            drawing +
            "endstream",
        );
        obj(
          pageId,
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
            pageW +
            " " +
            pageH +
            "] /Resources << /XObject << /Im0 " +
            imageId +
            " 0 R >> >> /Contents " +
            contentId +
            " 0 R >>",
        );
        ids.push(pageId);
      }
      obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
      obj(
        2,
        "<< /Type /Pages /Kids [" +
          ids.map((i) => i + " 0 R").join(" ") +
          "] /Count " +
          ids.length +
          " >>",
      );
      obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
      const xref = cursor,
        last = 3 + images.length * 3;
      write("xref\n0 " + (last + 1) + "\n0000000000 65535 f \n");
      for (let i = 1; i <= last; i++)
        write(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
      write(
        "trailer\n<< /Size " +
          (last + 1) +
          " /Root 1 0 R >>\nstartxref\n" +
          xref +
          "\n%%EOF",
      );
      return concat(parts);
    }
    if (effectiveMode === "modular" && chunks && chunks.length > 1) {
      const files = [];
      for (let i = 0; i < chunks.length; i++)
        files.push({
          name: chunks[i].suggested_filename,
          data: build(await pagesFor([chunks[i].nodes_tree], [chunks[i]])),
          mime: "application/pdf",
          chunk: chunks[i],
        });
      return {
        name: "neuromap_pdf_moduli_" + chunks.length + ".zip",
        data: zip(files),
        mime: "application/zip",
        summary,
        separate: true,
        modular: true,
        files,
        chunks,
      };
    }
    if (separate && roots.length > 1) {
      const names = dedup(
          roots.map((r) => r.text),
          "pdf",
        ),
        files = [];
      for (let i = 0; i < roots.length; i++)
        files.push({
          name: chunks ? chunks[i].suggested_filename : names[i],
          data: build(await pagesFor([roots[i]], chunks ? [chunks[i]] : null)),
          mime: "application/pdf",
          ...(chunks ? { chunk: chunks[i] } : {}),
        });
      return {
        name: "neuromap_pdf_" + roots.length + "_schede.zip",
        data: zip(files),
        mime: "application/zip",
        summary,
        separate: true,
        files,
        ...(chunks ? { chunks } : {}),
      };
    }
    return {
      name:
        chunks && chunks.length === 1
          ? chunks[0].suggested_filename
          : roots.length === 1
            ? safe(roots[0].text) + ".pdf"
            : "neuromap_" + roots.length + "_schede.pdf",
      data: build(await pagesFor(roots, chunks)),
      mime: "application/pdf",
      summary,
      separate: false,
      modular: effectiveMode === "modular",
      ...(chunks ? { chunks } : {}),
    };
  }
