  async function pdf(tabs, { separate = false } = {}) {
    const summary = inspect(tabs);
    if (typeof document === "undefined")
      throw Error("PDF requires a browser canvas.");
    const pages = [],
      roots = tabs.map((t) => t.state?.root || t.root);
    const W = 960,
      H = 1358,
      M = 66,
      leading = 28;
    const lineWrap = (ctx, text, width) => {
      const words = String(text || "")
          .replace(/\r\n?/g, "\n")
          .split(/(\s+)/),
        lines = [];
      let line = "";
      for (const word of words) {
        if (word.includes("\n")) {
          for (const chunk of word.split("\n")) {
            if (line) {
              lines.push(line);
              line = "";
            }
            if (chunk) line = chunk;
          }
          continue;
        }
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
      return lines.length ? lines : [""];
    };
    async function pagesFor(roots) {
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
        ctx.fillStyle = "#1e293b";
        ctx.font = "16px system-ui,sans-serif";
        ctx.fillText("NeuroMap · Export", M, H - 40);
        y = M + 16;
        page++;
        if (page > 120)
          throw Error(
            "PDF oltre 120 pagine: scegli file separati o meno schede.",
          );
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
      for (const root of roots) {
        if (!ctx) open();
        if (y > H - M - 110) {
          await close();
          open();
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
          const indent = Math.min(260, Math.max(0, level - 1) * 17),
            x = M + indent;
          const parts = [
            { text: node.text, bold: true },
            ...(node.notes ? [{ text: node.notes, bold: false }] : []),
          ].filter((part) => part.text);
          for (const part of parts) {
            if (!ctx) open();
            ctx.font =
              (part.bold ? "600 17px" : "14px") + " system-ui,sans-serif";
            ctx.fillStyle = part.bold ? "#1f2937" : "#64748b";
            const lineWidth = W - M - x - 6,
              lines = lineWrap(
                ctx,
                (part.bold ? "• " : "") + part.text,
                lineWidth,
              );
            for (const text of lines) {
              if (y > H - M - 45) {
                await close();
                open();
                ctx.fillStyle = part.bold ? "#1f2937" : "#64748b";
                ctx.font =
                  (part.bold ? "600 17px" : "14px") + " system-ui,sans-serif";
              }
              ctx.fillText(text, x, y);
              y += part.bold ? leading : 23;
            }
          }
          y += 3;
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
    if (separate && roots.length > 1) {
      const names = dedup(
          roots.map((r) => r.text),
          "pdf",
        ),
        files = [];
      for (let i = 0; i < roots.length; i++)
        files.push({ name: names[i], data: build(await pagesFor([roots[i]])) });
      return {
        name: "neuromap_pdf_" + roots.length + "_schede.zip",
        data: zip(files),
        mime: "application/zip",
        summary,
        separate: true,
      };
    }
    return {
      name:
        roots.length === 1
          ? safe(roots[0].text) + ".pdf"
          : "neuromap_" + roots.length + "_schede.pdf",
      data: build(await pagesFor(roots)),
      mime: "application/pdf",
      summary,
      separate: false,
    };
  }
