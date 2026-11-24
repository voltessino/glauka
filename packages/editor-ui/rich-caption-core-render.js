  function layout(ctx, doc, width, maxLines = MAX + 1, options = {}) {
    const format = captionFormat(options);
    const clean = sanitize(doc.text, doc.spans),
      signature = width + "|" + maxLines + "|" + format.fontSize + "|" + format.align + "|" + JSON.stringify(clean);
    let cache = layoutCaches.get(ctx);
    if (!cache) {
      cache = new Map();
      layoutCaches.set(ctx, cache);
    }
    if (cache.has(signature)) return cache.get(signature);
    ctx.save?.();
    const marks = unpack(clean.text, clean.spans),
      lines = [];
    width = Math.max(15, width);
    let line = { runs: [], width: 0 },
      wrapIndent = 0;
    const flush = (hard) => {
      lines.push(line);
      line = {
        runs: [],
        width: hard ? 0 : wrapIndent,
        indent: hard ? 0 : wrapIndent,
      };
    };
    let offset = 0;
    for (const match of clean.text.matchAll(/\n|[^\S\n]+|[^\s]+/g)) {
      const token = match[0],
        at = match.index;
      if (token === "\n") {
        flush(true);
        wrapIndent = 0;
        offset = at + 1;
        continue;
      }
      if (at === offset) {
        const m = marker(clean.text.slice(at).split("\n")[0]);
        if (m) {
          ctx.font = font(marks[at] || {}, format.fontSize);
          wrapIndent = Math.min(width / 3, ctx.measureText(m.prefix).width);
        }
      }
      const glyphs = [];
      let tokenWidth = 0,
        pos = at;
      for (const char of token) {
        const s = marks[pos] || {};
        ctx.font = font(s, format.fontSize);
        const w = ctx.measureText(char).width;
        glyphs.push({ char, style: s, width: w });
        tokenWidth += w;
        pos += char.length;
      }
      if (!token.trim() && !line.runs.length) continue;
      if (token.trim() && line.runs.length && line.width + tokenWidth > width)
        flush(false);
      for (const g of glyphs) {
        if (line.runs.length && line.width + g.width > width) flush(false);
        if (lines.length >= maxLines) break;
        const last = line.runs.at(-1);
        if (last && key(last.style) === key(g.style)) {
          last.text += g.char;
          last.width += g.width;
        } else line.runs.push({ text: g.char, style: g.style, width: g.width });
        line.width += g.width;
      }
      if (lines.length >= maxLines) break;
    }
    if (
      lines.length < maxLines &&
      (line.runs.length || !lines.length || clean.text.endsWith("\n"))
    )
      lines.push(line);
    ctx.restore?.();
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(signature, lines);
    return lines;
  }
  function paint(ctx, doc, rect, options = {}) {
    const format = captionFormat(options);
    const lines = layout(ctx, doc, Math.max(15, rect.w - 12), MAX + 1, format);
    const lineHeight = Math.max(15, Math.ceil(format.fontSize * 1.35));
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      const available = Math.max(15, rect.w - 12);
      const offset = format.align === 'center' ? (available - line.width) / 2
        : format.align === 'right' ? available - line.width : 0;
      let x = rect.x + 6 + Math.max(0, offset) + (line.indent || 0),
        y = rect.y + 6 + lineHeight / 2 + i * lineHeight;
      for (const run of line.runs) {
        ctx.font = font(run.style, format.fontSize);
        ctx.fillStyle = run.style.color || "#e5ecfc";
        ctx.fillText(run.text, x, y);
        if (run.style.underline) {
          ctx.beginPath();
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1;
          ctx.moveTo(x, y + lineHeight * .32);
          ctx.lineTo(x + run.width, y + lineHeight * .32);
          ctx.stroke();
        }
        x += run.width;
      }
    });
    ctx.restore();
  }
  function height(ctx, doc, width, options = {}) {
    const format = captionFormat(options);
    return doc.text
      ? layout(ctx, doc, Math.max(15, width - 12), MAX + 1, format).length *
        Math.max(15, Math.ceil(format.fontSize * 1.35)) + 12
      : 0;
  }
  const AUTO_LIST_KEY='glauka.text.automatic-lists.v1';
  let automaticLists;
