  function txt(root) {
    return (
      collect(root)
        .map(
          ({ node, level }) => "  ".repeat(level) + encodeTextLabel(node.text),
        )
        .join("\n") + "\n"
    );
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
        if (node.notes)
          out +=
            pad +
            '  <richcontent TYPE="NOTE"><html><body><p>' +
            esc(node.notes) +
            "</p></body></html></richcontent>\n";
      }
    }
    return out + "</map>\n";
  }
  function html(roots) {
    return (
      '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NeuroMap · Mappe esportate</title><style>' +
      ":root{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif}body{max-width:920px;margin:auto;padding:clamp(16px,4vw,42px);background:Canvas;color:CanvasText}header{padding:20px 0;border-bottom:1px solid #8885}h1{font-size:clamp(24px,4vw,42px);margin:0}small{opacity:.75}.map{margin:26px 0;padding:14px 22px;border:1px solid #8886;border-radius:16px;background:color-mix(in srgb,Canvas 96%,#7c8eff)}li{margin:8px 0}summary{cursor:pointer;font-weight:550;line-height:1.5}ul{margin:4px 0 0 4px;padding-left:22px;border-left:1px solid #8885}.notes{white-space:pre-wrap;opacity:.8;margin:4px 0 8px}summary:focus-visible{outline:2px solid #818cf8}" +
      "</style></head><body><header><h1>Le mie mappe</h1><small>NeuroMap · documento offline · " +
      roots.length +
      " mappe · sola lettura</small></header>" +
      roots.map(renderOutline).join("\n") +
      "<footer><small>Esportazione statica: immagini, posizioni e collegamenti grafici non inclusi.</small></footer></body></html>"
    );
  }
  function renderOutline(root) {
    function walk(node, level) {
      if (level > 100) throw Error("Albero troppo profondo.");
      let out = "<li><details open><summary>" + esc(node.text) + "</summary>";
      if (node.notes) out += '<p class="notes">' + esc(node.notes) + "</p>";
      if (node.children?.length) {
        out += "<ul>";
        for (const ch of node.children) out += walk(ch, level + 1);
        out += "</ul>";
      }
      return out + "</details></li>";
    }
    return (
      '<section class="map"><h2>' +
      esc(root.text) +
      "</h2>" +
      (root.notes ? '<p class="notes">' + esc(root.notes) + "</p>" : "") +
      "<ul>" +
      root.children.map((n) => walk(n, 1)).join("") +
      "</ul></section>"
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
  function docx(roots) {
    const wordRun = (text, bold = false, italic = false, underline = false, style = null) => {
      const format =
        bold || italic || underline || style?.fontFamily || style?.fontColor || style?.fontStrike || style?.fontSize
          ? "<w:rPr>" +
            (bold ? "<w:b/>" : "") +
            (italic ? "<w:i/>" : "") +
            (underline ? '<w:u w:val="single"/>' : "") +
            (style?.fontStrike ? '<w:strike/>' : '') +
            (['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New'].includes(style?.fontFamily) ? '<w:rFonts w:ascii="'+esc(style.fontFamily)+'" w:hAnsi="'+esc(style.fontFamily)+'"/>' : '') +
            (/^#[0-9a-f]{6}$/i.test(style?.fontColor||'') ? '<w:color w:val="'+style.fontColor.slice(1)+'"/>' : '') +
            (Number.isFinite(style?.fontSize) && style.fontSize>=9 && style.fontSize<=48 ? '<w:sz w:val="'+Math.round(style.fontSize*2)+'"/>' : '') +
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
    for (const root of roots) {
      blocks.push(
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
          wordRun(root.text, true, !!root.fontItalic, !!root.fontUnderline, root) +
          "</w:p>",
      );
      if (root.notes) blocks.push("<w:p>" + wordRun(root.notes) + "</w:p>");
      for (const { node, level } of collect(root).slice(1)) {
        const indent = Math.min(12000, Math.max(0, level - 1) * 400);
        const heading =
          level === 1 ? "Heading2" : level === 2 ? "Heading3" : null;
        blocks.push(
          "<w:p><w:pPr>" +
            (heading ? '<w:pStyle w:val="' + heading + '"/>' : "") +
            '<w:ind w:left="' +
            indent +
            '"/></w:pPr>' +
            wordRun(
              node.text,
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
              wordRun(node.notes) +
              "</w:p>",
          );
      }
    }
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
