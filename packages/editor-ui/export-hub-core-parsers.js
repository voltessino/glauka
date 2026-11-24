  function dedup(names, ext) {
    const seen = new Set();
    return names.map((title) => {
      let name = safe(title),
        candidate = name + "." + ext,
        n = 2;
      while (seen.has(candidate.toLowerCase()))
        candidate = name + "_" + n++ + "." + ext;
      seen.add(candidate.toLowerCase());
      return candidate;
    });
  }
  function parseFreeMind(source) {
    if (typeof DOMParser === "undefined")
      throw Error("Parser XML non disponibile.");
    const xml = new DOMParser().parseFromString(
      String(source),
      "application/xml",
    );
    if (
      xml.querySelector("parsererror") ||
      xml.documentElement.localName !== "map"
    )
      throw Error("File FreeMind .mm non valido.");
    const root = [...xml.documentElement.children].find(
      (n) => n.localName === "node",
    );
    if (!root) throw Error("La mappa FreeMind non contiene nodi.");
    let count = 0;
    function parseNode(el, depth = 0) {
      if (depth > 100 || ++count > 3500)
        throw Error("Mappa FreeMind troppo grande.");
      const notes = [...el.children].find(
        (e) =>
          e.localName === "richcontent" && e.getAttribute("TYPE") === "NOTE",
      );
      const n = { text: el.getAttribute("TEXT") || "Nodo", children: [] };
      if (["left", "right"].includes(el.getAttribute("POSITION")))
        n.sidePinned = el.getAttribute("POSITION");
      if (notes) n.notes = notes.textContent || "";
      for (const child of el.children)
        if (child.localName === "node")
          n.children.push(parseNode(child, depth + 1));
      return n;
    }
    return parseNode(root);
  }
  function parseTxtBatch(source) {
    const str = String(source || "").replace(/\r\n?/g, "\n");
    const header = str.match(/^NEUROMAP-TXT-(?:MULTI-)?([12])\n/);
    if (!header) return null;
    const pieces = str
      .slice(header[0].length)
      .split(/^\s*=== NEUROMAP TAB ===\s*$/m);
    if (!pieces.length || pieces.length > 20)
      throw Error("Numero schede TXT non valido.");
    let total = 0;
    return pieces.map((piece) => {
      const lines = piece.split("\n").filter((l) => l.trim()),
        stack = [];
      let root;
      for (const line of lines) {
        const spaces = line.match(/^ */)[0].length;
        if (spaces % 2 !== 0) throw Error("Indentazione TXT non valida.");
        const depth = spaces / 2,
          text =
            header[1] === "2"
              ? decodeTextLabel(line.slice(spaces))
              : line.slice(spaces);
        if (depth > 100 || ++total > 3500)
          throw Error("TXT multiplo troppo grande: usa ZIP.");
        const n = { text, children: [] };
        if (!root) {
          if (depth !== 0) throw Error("Radice TXT non valida.");
          root = n;
          stack.push(n);
          continue;
        }
        if (depth === 0 || depth > stack.length)
          throw Error("Gerarchia TXT non valida.");
        const parent = stack[depth - 1];
        parent.children.push(n);
        stack[depth] = n;
        stack.length = depth + 1;
      }
      if (!root) throw Error("Scheda TXT vuota.");
      return root;
    });
  }
