  function txt(root) {
    return (
      collect(root)
        .map(
          ({ node, level }) => "  ".repeat(level) + encodeTextLabel(node.text),
        )
        .join("\n") + "\n"
    );
  }
  function formatChunkHeaderLines(header) {
    if (!header || (header.total_parts || 1) <= 1) return [];
    const lines = [
      String(header.title || "Mappa") + " — " + header.partLabel,
      "Sezioni principali: " +
        ((header.sections && header.sections.length
          ? header.sections.join(" · ")
          : "—")),
    ];
    if (header.previousLastSection)
      lines.push("Continua da: " + header.previousLastSection);
    return lines;
  }
  function txtChunk(chunk) {
    const out = [];
    const headerLines = formatChunkHeaderLines(chunk?.context_header);
    if (headerLines.length) {
      out.push("=== " + headerLines[0] + " ===");
      for (let i = 1; i < headerLines.length; i++) out.push(headerLines[i]);
      out.push("");
    }
    const root = chunk?.nodes_tree || chunk;
    for (const { node, level } of collect(root)) {
      out.push("  ".repeat(level) + String(node.text ?? ""));
      if (node.notes) {
        const pad = "  ".repeat(level + 1);
        for (const nl of String(node.notes).replace(/\r\n?/g, "\n").split("\n"))
          if (nl.trim()) out.push(pad + nl.trimEnd());
      }
    }
    return out.join("\n") + "\n";
  }
  function markdownChunk(chunk) {
    const lines = [];
    const header = chunk?.context_header;
    if (header && (header.total_parts || 1) > 1) {
      lines.push("> **" + String(header.title || "Mappa") + " — " + header.partLabel + "**");
      lines.push(
        "> Sezioni principali: " +
          ((header.sections && header.sections.length
            ? header.sections.join(" · ")
            : "—")),
      );
      if (header.previousLastSection)
        lines.push("> Continua da: " + header.previousLastSection);
      lines.push("");
    }
    const root = chunk?.nodes_tree || chunk;
    for (const { node, level } of collect(root)) {
      let label = String(node.text ?? "").replace(/[\r\n]+/g, " ").trim() || "Nodo";
      if ((node.fontWeight || 0) >= 600 && node.fontItalic) label = "***" + label + "***";
      else if ((node.fontWeight || 0) >= 600) label = "**" + label + "**";
      else if (node.fontItalic) label = "*" + label + "*";
      const href = safeHref(node?.linkUrl);
      if (href) label += " (" + href + ")";
      if (level === 0) lines.push("# " + label);
      else if (level === 1) lines.push("", "## " + label);
      else if (level === 2) lines.push("", "### " + label);
      else lines.push("  ".repeat(level - 3) + "- " + label);
      if (node.notes) {
        const noteIndent = level >= 3 ? "  ".repeat(level - 2) : "";
        for (const nl of String(node.notes).replace(/\r\n?/g, "\n").split("\n"))
          lines.push(noteIndent + "> " + nl);
      }
    }
    return lines.join("\n") + "\n";
  }
  function opml(roots) {
    let out =
      '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head><title>NeuroMap export</title></head>\n<body>\n';
    for (const root of roots) {
      const todo = [{ node: root, close: false, depth: 1 }];
      while (todo.length) {
        const r = todo.pop(),
          n = r.node,
          pad = "  ".repeat(Math.min(r.depth, 32));
        if (r.close) {
          out += pad + "</outline>\n";
          continue;
        }
        const children = n.children || [];
        out +=
          pad +
          '<outline text="' +
          attr(n.text) +
          '"' +
          (n.notes ? ' _note="' + attr(n.notes) + '"' : "") +
          (children.length ? ">" : " />") +
          "\n";
        if (children.length) {
          todo.push({ node: n, close: true, depth: r.depth });
          for (let i = children.length - 1; i >= 0; i--)
            todo.push({ node: children[i], close: false, depth: r.depth + 1 });
        }
      }
    }
    return out + "</body>\n</opml>\n";
  }
  function freemind(root) {
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n<map version="1.0.1">\n';
    const todo = [{ node: root, close: false, level: 0 }];
    while (todo.length) {
      const { node, close, level } = todo.pop(),
        pad = "  ".repeat(Math.min(level + 1, 40));
      if (close) {
        out += pad + "</node>\n";
        continue;
      }
      const kids = node.children || [];
      const attrs =
        ' TEXT="' +
        attr(node.text) +
        '"' +
        (level === 1 && node.sidePinned
          ? ' POSITION="' + attr(node.sidePinned) + '"'
          : "");
      out +=
        pad +
        "<node" +
        attrs +
        (kids.length || node.notes ? ">" : " />") +
        "\n";
      if (kids.length || node.notes) {
        todo.push({ node, close: true, level });
        for (let i = kids.length - 1; i >= 0; i--)
          todo.push({ node: kids[i], close: false, level: level + 1 });
        if (node.notes) {
          const noteLines = String(node.notes).replace(/\r\n?/g, "\n").split("\n");
          out +=
            pad +
            '  <richcontent TYPE="NOTE"><html><body>' +
            noteLines.map((line) => "<p>" + esc(line) + "</p>").join("") +
            "</body></html></richcontent>\n";
        }
      }
    }
    return out + "</map>\n";
  }
  function safeHref(raw) {
    const value = String(raw || "").trim();
    return /^(?:https?:|mailto:)/i.test(value) ? value : "";
  }
  function html(roots, options = {}) {
    const chunks = Array.isArray(options?.chunks) ? options.chunks : null;
    const renderRoots = chunks ? chunks.map((c) => c.nodes_tree) : roots;
    const countLabel =
      renderRoots.length === 1 ? "1 mappa" : renderRoots.length + " mappe";
    const docTitle =
      renderRoots.length === 1
        ? esc(renderRoots[0]?.text || "Glauka") + " · Glauka"
        : "Glauka · Mappe esportate";
    const toc =
      renderRoots.length > 1 && !chunks
        ? '<nav class="toc" aria-label="Indice delle mappe"><strong>Indice</strong><ul>' +
          renderRoots
            .map(
              (r, i) =>
                '<li><a href="#map-' +
                i +
                '">' +
                esc(r?.text || "Mappa " + (i + 1)) +
                "</a></li>",
            )
            .join("") +
          "</ul></nav>"
        : "";
    const body = chunks
      ? chunks.map((ch, i) => renderStructuredHtmlChunk(ch, i)).join("\n")
      : renderRoots.map((r, i) => renderOutline(r, i)).join("\n");
    return (
      '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      docTitle +
      "</title><style>" +
      ":root{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif}body{max-width:920px;margin:auto;padding:clamp(16px,4vw,42px);background:Canvas;color:CanvasText}header{padding:20px 0;border-bottom:1px solid #8885}h1{font-size:clamp(24px,4vw,42px);margin:0}small{opacity:.75}.toc,.chunk-context{margin:16px 0;padding:12px 16px;border:1px solid #8884;border-radius:12px;background:color-mix(in srgb,Canvas 94%,#6366f1)}.chunk-context p{margin:4px 0;font-size:.92em}.toc ul{margin:8px 0 0;padding-left:20px;border-left:none}.map{margin:26px 0;padding:14px 22px;border:1px solid #8886;border-radius:16px;background:color-mix(in srgb,Canvas 96%,#7c8eff)}.map h2{font-size:1.45em;margin:14px 0 6px}.map h3{font-size:1.18em;margin:10px 0 4px}li{margin:6px 0}summary{cursor:pointer;font-weight:550;line-height:1.5}ul{margin:4px 0 0 4px;padding-left:22px;border-left:1px solid #8885}.notes{white-space:pre-wrap;opacity:.82;margin:4px 0 8px}.node-link{margin-left:8px;font-size:.86em;word-break:break-word}summary:focus-visible{outline:2px solid #818cf8}" +
      "</style></head><body><header><h1>" +
      (renderRoots.length === 1
        ? esc(renderRoots[0]?.text || "Mappa")
        : "Le mie mappe") +
      "</h1><small>Glauka · documento offline · " +
      (chunks && chunks[0]?.context_header
        ? esc(chunks[0].context_header.partLabel)
        : countLabel) +
      " · sola lettura</small></header>" +
      toc +
      body +
      "<footer><small>Esportazione statica: immagini, posizioni e collegamenti grafici non inclusi.</small></footer></body></html>"
    );
  }
  function renderStructuredHtmlChunk(chunk, index = 0) {
    const root = chunk?.nodes_tree || chunk;
    const h = chunk?.context_header;
    const headerHtml =
      h && (h.total_parts || 1) > 1
        ? '<aside class="chunk-context" aria-label="Contesto della parte"><p><strong>' +
          esc(h.title || "Mappa") +
          " — " +
          esc(h.partLabel) +
          "</strong></p><p>Sezioni principali: " +
          esc((h.sections || []).join(" · ")) +
          "</p>" +
          (h.previousLastSection
            ? "<p>Continua da: " + esc(h.previousLastSection) + "</p>"
            : "") +
          "</aside>"
        : "";
    function walkList(node, level) {
      if (level > 100) throw Error("Albero troppo profondo.");
      let out = "<li>" + formatHtmlLabel(node);
      if (node.notes) out += '<p class="notes">' + esc(node.notes) + "</p>";
      const kids = Array.isArray(node.children) ? node.children : [];
      if (kids.length) {
        out += "<ul>";
        for (const ch of kids) out += walkList(ch, level + 1);
        out += "</ul>";
      }
      return out + "</li>";
    }
    let body = "<h1>" + formatHtmlLabel(root) + "</h1>";
    if (root?.notes) body += '<p class="notes">' + esc(root.notes) + "</p>";
    for (const l1 of Array.isArray(root?.children) ? root.children : []) {
      body += "<h2>" + formatHtmlLabel(l1) + "</h2>";
      if (l1.notes) body += '<p class="notes">' + esc(l1.notes) + "</p>";
      for (const l2 of Array.isArray(l1.children) ? l1.children : []) {
        body += "<h3>" + formatHtmlLabel(l2) + "</h3>";
        if (l2.notes) body += '<p class="notes">' + esc(l2.notes) + "</p>";
        const l3 = Array.isArray(l2.children) ? l2.children : [];
        if (l3.length)
          body += "<ul>" + l3.map((n) => walkList(n, 3)).join("") + "</ul>";
      }
    }
    return '<section class="map" id="map-' + index + '">' + headerHtml + body + "</section>";
  }
  function formatHtmlLabel(node) {
    let label = esc(node?.text ?? "");
    if (node?.fontUnderline) label = "<u>" + label + "</u>";
    if (node?.fontStrike) label = "<s>" + label + "</s>";
    if (node?.fontItalic) label = "<em>" + label + "</em>";
    if ((node?.fontWeight || 0) >= 600) label = "<strong>" + label + "</strong>";
    const href = safeHref(node?.linkUrl);
    if (href)
      label +=
        ' <a class="node-link" href="' +
        esc(href) +
        '" target="_blank" rel="noopener noreferrer">[' +
        esc(href) +
        "]</a>";
    return label;
  }
  function renderOutline(root, index = 0) {
    const kids = Array.isArray(root?.children) ? root.children : [];
    function walk(node, level) {
      if (level > 100) throw Error("Albero troppo profondo.");
      let out =
        "<li><details open><summary>" + formatHtmlLabel(node) + "</summary>";
      if (node.notes) out += '<p class="notes">' + esc(node.notes) + "</p>";
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length) {
        out += "<ul>";
        for (const ch of children) out += walk(ch, level + 1);
        out += "</ul>";
      }
      return out + "</details></li>";
    }
    return (
      '<section class="map" id="map-' +
      index +
      '"><h2>' +
      formatHtmlLabel(root) +
      "</h2>" +
      (root?.notes ? '<p class="notes">' + esc(root.notes) + "</p>" : "") +
      (kids.length ? "<ul>" + kids.map((n) => walk(n, 1)).join("") + "</ul>" : "") +
      "</section>"
    );
  }
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  function crc32(u8) {
    let c = 0xffffffff;
    for (const n of u8) c = crcTable[(c ^ n) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function le16(n) {
    return [n & 255, (n >>> 8) & 255];
  }
  function le32(n) {
    return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  }
  function bytes(data) {
    return typeof data === "string"
      ? encoder.encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  }
  function concat(parts) {
    let size = parts.reduce((v, p) => v + p.length, 0);
    if (size > MAX_BYTES)
      throw Error("Archivio oltre 72 MB. Seleziona meno schede.");
    let out = new Uint8Array(size),
      off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  function zip(files) {
    if (!Array.isArray(files) || !files.length || files.length > 200)
      throw Error("Archivio vuoto o troppi file.");
    const locals = [],
      dirs = [],
      names = new Set();
    let offset = 0;
    for (const file of files) {
      let name = String(file.name || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (
        !name ||
        name.includes("../") ||
        name.includes("/..") ||
        names.has(name)
      )
        throw Error("Nome file archivio non valido o duplicato.");
      names.add(name);
      const filename = encoder.encode(name),
        body = bytes(file.data),
        crc = crc32(body);
      if (filename.length > 65535 || body.length > 0xffffffff)
        throw Error("File ZIP troppo grande.");
      const flags = 2048,
        method = 0,
        local = new Uint8Array([
          80,
          75,
          3,
          4,
          ...le16(20),
          ...le16(flags),
          ...le16(method),
          ...le16(0),
          ...le16(0),
          ...le32(crc),
          ...le32(body.length),
          ...le32(body.length),
          ...le16(filename.length),
          ...le16(0),
        ]);
      const central = new Uint8Array([
        80,
        75,
        1,
        2,
        ...le16(20),
        ...le16(20),
        ...le16(flags),
        ...le16(method),
        ...le16(0),
        ...le16(0),
        ...le32(crc),
        ...le32(body.length),
        ...le32(body.length),
        ...le16(filename.length),
        ...le16(0),
        ...le16(0),
        ...le16(0),
        ...le16(0),
        ...le32(0),
        ...le32(offset),
      ]);
      locals.push(local, filename, body);
      dirs.push(central, filename);
      offset += local.length + filename.length + body.length;
    }
    const centralLength = dirs.reduce((s, p) => s + p.length, 0),
      count = files.length;
    const end = new Uint8Array([
      80,
      75,
      5,
      6,
      ...le16(0),
      ...le16(0),
      ...le16(count),
      ...le16(count),
      ...le32(centralLength),
      ...le32(offset),
      ...le16(0),
    ]);
    return concat([...locals, ...dirs, end]);
  }
  function docxInkColor(raw, allowLight = false) {
    if (!/^#[0-9a-f]{6}$/i.test(raw || "")) return "";
    const hex = raw.slice(1).toLowerCase();
    const r = parseInt(hex.slice(0, 2), 16),
      g = parseInt(hex.slice(2, 4), 16),
      b = parseInt(hex.slice(4, 6), 16);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum <= 185) return hex;
    if (!allowLight) return "";
    // Darken light canvas ink so nodes exported from dark mode remain readable on white pages.
    const factor = 96 / Math.max(lum, 1);
    const dr = Math.max(15, Math.min(180, Math.round(r * factor)));
    const dg = Math.max(23, Math.min(180, Math.round(g * factor)));
    const db = Math.max(42, Math.min(180, Math.round(b * factor)));
    return [dr, dg, db].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function docx(roots, options = {}) {
    const chunks = Array.isArray(options?.chunks) ? options.chunks : null;
    const renderRoots = chunks ? chunks.map((c) => c.nodes_tree) : roots;
    const structured = !!(chunks || options?.structuredHeadings);
    const wordRun = (text, bold = false, italic = false, underline = false, style = null, opts = {}) => {
      const fontFamily = ["Inter", "Arial", "Verdana", "Georgia", "Times New Roman", "Courier New"].includes(style?.fontFamily)
        ? style.fontFamily
        : "";
      const ink = opts.color || docxInkColor(style?.fontColor, opts.allowLight !== false);
      const size = opts.sz || (Number.isFinite(style?.fontSize) && style.fontSize >= 9 && style.fontSize <= 48 ? Math.round(style.fontSize * 2) : 0);
      const hasRPr =
        fontFamily || bold || italic || style?.fontStrike || ink || size || underline;
      // ECMA-376 CT_RPr requires rFonts -> b -> i -> strike -> color -> sz -> u order.
      const format = hasRPr
        ? "<w:rPr>" +
          (fontFamily ? '<w:rFonts w:ascii="' + esc(fontFamily) + '" w:hAnsi="' + esc(fontFamily) + '"/>' : "") +
          (bold ? "<w:b/>" : "") +
          (italic ? "<w:i/>" : "") +
          (style?.fontStrike ? "<w:strike/>" : "") +
          (ink ? '<w:color w:val="' + ink + '"/>' : "") +
          (size ? '<w:sz w:val="' + size + '"/>' : "") +
          (underline ? '<w:u w:val="single"/>' : "") +
          "</w:rPr>"
        : "";
      const chunks = String(text ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n");
      return (
        "<w:r>" +
        format +
        chunks
          .map(
            (line, i) =>
              (i ? "<w:br/>" : "") +
              '<w:t xml:space="preserve">' +
              esc(line) +
              "</w:t>",
          )
          .join("") +
        "</w:r>"
      );
    };
    const blocks = [];
    renderRoots.forEach((root, mapIndex) => {
      if (mapIndex > 0) blocks.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      const chHeader = chunks ? chunks[mapIndex]?.context_header : options?.contextHeader;
      if (chHeader && (chHeader.total_parts || 1) > 1) {
        const headerLines = formatChunkHeaderLines(chHeader);
        for (const hl of headerLines) {
          blocks.push(
            '<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="EEF2FF"/><w:spacing w:after="60"/></w:pPr>' +
              wordRun(hl, hl === headerLines[0], false, false, null, { color: "312E81", sz: 20 }) +
              "</w:p>",
          );
        }
      }
      blocks.push(
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
          wordRun(root.text, true, !!root.fontItalic, !!root.fontUnderline, root, { allowLight: false }) +
          "</w:p>",
      );
      if (root.notes)
        blocks.push(
          '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>' +
            wordRun(root.notes, false, false, false, null, { color: "475569", sz: 20 }) +
            "</w:p>",
        );
      for (const { node, level } of collect(root).slice(1)) {
        const indent = Math.min(12000, Math.max(0, level - 1) * 400);
        const heading =
          level === 1 ? "Heading2" : level === 2 ? "Heading3" : null;
        const label = structured && level >= 3 ? "• " + String(node.text ?? "") : node.text;
        blocks.push(
          "<w:p><w:pPr>" +
            (heading ? '<w:pStyle w:val="' + heading + '"/>' : "") +
            '<w:ind w:left="' +
            indent +
            '"/></w:pPr>' +
            wordRun(
              label,
              (node.fontWeight || 0) >= 600,
              !!node.fontItalic,
              !!node.fontUnderline,
              node,
            ) +
            "</w:p>",
        );
        if (node.notes)
          blocks.push(
            '<w:p><w:pPr><w:ind w:left="' +
              (indent + 400) +
              '"/></w:pPr>' +
              wordRun(node.notes, false, false, false, null, { color: "475569", sz: 20 }) +
              "</w:p>",
          );
      }
    });
    const document =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      blocks.join("") +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1200" w:bottom="1440" w:left="1200"/></w:sectPr></w:body></w:document>';
    const styles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="130"/></w:pPr><w:rPr><w:b/><w:color w:val="4F46E5"/><w:sz w:val="34"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="27"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="100" w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>' +
      "</w:styles>";
    return zip([
      {
        name: "[Content_Types].xml",
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      },
      {
        name: "_rels/.rels",
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      },
      { name: "word/document.xml", data: document },
      { name: "word/styles.xml", data: styles },
      {
        name: "word/_rels/document.xml.rels",
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      },
    ]);
  }
