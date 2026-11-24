  function unpack(text, spans) {
    const marks = Array.from({ length: text.length }, () => ({}));
    for (const span of (Array.isArray(spans) ? spans : []).slice(
      0,
      MAX_SPANS,
    )) {
      const from = Math.max(
          0,
          Math.min(text.length, Math.floor(Number(span?.start) || 0)),
        ),
        to = Math.max(
          from,
          Math.min(text.length, Math.floor(Number(span?.end) || 0)),
        );
      const value = style(span);
      for (let i = from; i < to; i++) marks[i] = value;
    }
    return marks;
  }
  function pack(text, marks) {
    const spans = [];
    let start = 0;
    while (start < text.length) {
      const value = style(marks[start]),
        signature = key(value);
      let end = start + 1;
      while (end < text.length && key(marks[end]) === signature) end++;
      if (Object.keys(value).length) spans.push({ start, end, ...value });
      start = end;
    }
    return spans.slice(0, MAX_SPANS);
  }
  function sanitize(text, spans) {
    text = String(text || "")
      .replace(/\r\n?/g, "\n")
      .slice(0, MAX);
    return { text, spans: pack(text, unpack(text, spans)) };
  }
  function replace(doc, start, end, insert, insertStyle) {
    const clean = sanitize(doc.text, doc.spans),
      from = Math.max(0, Math.min(clean.text.length, start)),
      to = Math.max(from, Math.min(clean.text.length, end));
    insert = String(insert);
    if (clean.text.length - (to - from) + insert.length > MAX)
      throw Error("CAPTION_TOO_LONG");
    const marks = unpack(clean.text, clean.spans),
      inherit =
        insertStyle === undefined
          ? marks[Math.max(0, from - 1)] || {}
          : style(insertStyle),
      text = clean.text.slice(0, from) + insert + clean.text.slice(to);
    return {
      text,
      spans: pack(text, [
        ...marks.slice(0, from),
        ...Array.from({ length: insert.length }, () => inherit),
        ...marks.slice(to),
      ]),
    };
  }
  function edit(doc, text) {
    text = String(text).replace(/\r\n?/g, "\n").slice(0, MAX);
    const old = doc.text;
    let from = 0;
    while (from < old.length && from < text.length && old[from] === text[from])
      from++;
    let end = old.length,
      nextEnd = text.length;
    while (end > from && nextEnd > from && old[end - 1] === text[nextEnd - 1]) {
      end--;
      nextEnd--;
    }
    return replace(doc, from, end, text.slice(from, nextEnd));
  }
  function apply(doc, start, end, patch) {
    const clean = sanitize(doc.text, doc.spans),
      marks = unpack(clean.text, clean.spans);
    start = Math.max(0, Math.min(clean.text.length, start));
    end = Math.max(start, Math.min(clean.text.length, end));
    for (let i = start; i < end; i++) {
      const next = { ...marks[i] };
      for (const k of ["bold", "italic", "underline", "color"])
        if (k in patch) {
          if (patch[k] === false || patch[k] === null) delete next[k];
          else next[k] = patch[k];
        }
      marks[i] = style(next);
    }
    return { text: clean.text, spans: pack(clean.text, marks) };
  }
  function selectedStyle(doc, start, end) {
    const marks = unpack(doc.text, doc.spans),
      part = marks.slice(start, end);
    if (!part.length) return {};
    const out = {};
    for (const k of ["bold", "italic", "underline", "color"])
      if (part[0]?.[k] && part.every((s) => s[k] === part[0][k]))
        out[k] = part[0][k];
    return out;
  }
  function marker(line) {
    const m = String(line).match(
      /^([ \t]*)([•●○◦▪■–*\-]|\d{1,6}[.)]|[a-zA-Z]{1,4}[.)])(?:([ \t]+)|$)/,
    );
    if (!m) return null;
    const token = m[2],
      kind = /^\d/.test(token)
        ? "number"
        : /^[a-z]/i.test(token)
          ? "letter"
          : /^[–*\-]$/.test(token)
            ? "dash"
            : /[○◦]/.test(token)
              ? "circle"
              : /[▪■]/.test(token)
                ? "square"
                : "disc";
    return {
      indent: m[1],
      token,
      prefix: m[0],
      body: String(line).slice(m[0].length),
      kind,
    };
  }
  function letters(n, upper = false) {
    let result = "";
    do {
      n--;
      result = String.fromCharCode(97 + (n % 26)) + result;
      n = Math.floor(n / 26);
    } while (n > 0);
    return upper ? result.toUpperCase() : result;
  }
  function letterNumber(s) {
    return [...s.toLowerCase()].reduce(
      (n, c) => n * 26 + c.charCodeAt(0) - 96,
      0,
    );
  }
  function roman(n) {
    let result = "";
    for (const [value, glyph] of [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ])
      while (n >= value && result.length < 20) {
        result += glyph;
        n -= value;
      }
    return result;
  }
  function romanNumber(s) {
    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let n = 0;
    const upper = s.toUpperCase();
    for (let i = 0; i < upper.length; i++)
      n +=
        (values[upper[i]] || 0) < (values[upper[i + 1]] || 0)
          ? -values[upper[i]]
          : values[upper[i]] || 0;
    return roman(n) === upper ? n : null;
  }
  function continueList(text, start, end = start) {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1,
      lineEnd = text.indexOf("\n", start),
      line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd),
      m = marker(line);
    if (!m || start < lineStart + m.prefix.length) return null;
    if (!m.body.trim())
      return {
        start: lineStart,
        end: lineStart + m.prefix.length,
        insert: m.indent,
        caret: lineStart + m.indent.length,
      };
    let next = m.token;
    if (m.kind === "number")
      next = String(Number.parseInt(m.token, 10) + 1) + m.token.at(-1);
    else if (m.kind === "letter") {
      const token = m.token.slice(0, -1),
        previous = marker(
          text
            .slice(0, Math.max(0, lineStart - 1))
            .split("\n")
            .at(-1) || "",
        ),
        r = romanNumber(token),
        alphabetic =
          previous?.kind === "letter" &&
          letterNumber(previous.token.slice(0, -1)) + 1 === letterNumber(token);
      next =
        (r &&
        !alphabetic &&
        (token.length > 1 ||
          token.toLowerCase() === "i" ||
          (previous?.kind === "letter" &&
            romanNumber(previous.token.slice(0, -1)) === r - 1))
          ? token === token.toUpperCase()
            ? roman(r + 1)
            : roman(r + 1).toLowerCase()
          : letters(letterNumber(token) + 1, token === token.toUpperCase())) +
        m.token.at(-1);
    }
    const insert = "\n" + m.indent + next + " ";
    return { start, end, insert, caret: start + insert.length };
  }
  function listKind(text) {
    const lines = String(text)
      .split("\n")
      .filter((s) => s.trim());
    if (!lines.length) return "none";
    const kinds = lines.map((line) => marker(line)?.kind || "none");
    if (
      kinds.every((k) => k === "letter") &&
      lines.every(
        (line, i) => romanNumber(marker(line).token.slice(0, -1)) === i + 1,
      )
    )
      return "roman";
    return kinds.every((k) => k === kinds[0]) ? kinds[0] : "mixed";
  }
  function list(doc, kind) {
    if (
      ![
        "none",
        "disc",
        "circle",
        "square",
        "dash",
        "number",
        "letter",
        "roman",
      ].includes(kind)
    )
      return sanitize(doc.text, doc.spans);
    const changes = [];
    let offset = 0,
      index = 0;
    for (const line of doc.text.split("\n")) {
      if (line.trim()) {
        index++;
        const old = marker(line),
          indent = old?.indent || line.match(/^[ \t]*/)[0],
          glyph =
            { disc: "•", circle: "○", square: "▪", dash: "–" }[kind] ||
            (kind === "number"
              ? index + "."
              : kind === "letter"
                ? letters(index) + "."
                : roman(index).toLowerCase() + ".");
        changes.push({
          start: offset + indent.length,
          end: offset + (old?.prefix.length || indent.length),
          insert: kind === "none" ? "" : glyph + " ",
        });
      }
      offset += line.length + 1;
    }
    let result = sanitize(doc.text, doc.spans);
    for (const change of changes.reverse())
      result = replace(result, change.start, change.end, change.insert, {});
    return result;
  }
  const captionFormat = (options = {}) => ({
    align: ['left', 'center', 'right'].includes(options?.align) ? options.align : 'left',
    fontSize: Number.isInteger(options?.fontSize) && options.fontSize >= 9 && options.fontSize <= 36
      ? options.fontSize : 11,
  });
  function font(s, size = 11) {
    return (
      (s.italic ? "italic " : "") +
      (s.bold ? "700 " : "400 ") +
      size + "px Inter, system-ui, sans-serif"
    );
  }
  const layoutCaches = new WeakMap();
