  const MODULAR_PRESETS = Object.freeze({
    compact: Object.freeze({
      id: "compact",
      targetWords: 1000,
      maxWords: 1400,
    }),
    balanced: Object.freeze({
      id: "balanced",
      targetWords: 1800,
      maxWords: 2300,
    }),
    extended: Object.freeze({
      id: "extended",
      targetWords: 3000,
      maxWords: 3600,
    }),
  });
  const MODULAR_FORMATS = Object.freeze(["md", "txt", "html", "docx", "pdf"]);

  const TreeChunker = (function () {
    function countWords(text) {
      const s = String(text ?? "").trim();
      return s ? s.split(/\s+/).length : 0;
    }

    function nodeOwnWords(node) {
      return countWords(node?.text) + countWords(node?.notes);
    }

    function subtreeWordCount(root) {
      if (!root || typeof root !== "object") return 0;
      let total = 0;
      const stack = [{ n: root, d: 0 }];
      const seen = new Set();
      while (stack.length) {
        const { n, d } = stack.pop();
        if (!n || typeof n !== "object" || seen.has(n) || d > 100) continue;
        seen.add(n);
        total += nodeOwnWords(n);
        const kids = Array.isArray(n.children) ? n.children : [];
        for (let i = kids.length - 1; i >= 0; i--)
          stack.push({ n: kids[i], d: d + 1 });
      }
      return total;
    }

    function clonePreparedTree(node, prefix = "", numberIt = false, depth = 0, seen = new Set(), originSeq = { val: 0 }) {
      if (!node || typeof node !== "object" || seen.has(node) || depth > 100)
        return null;
      seen.add(node);
      const rawText = String(node.text ?? "");
      const exportNumber = depth > 0 ? prefix : "";
      const displayText =
        numberIt && exportNumber ? exportNumber + " " + rawText : rawText;
      const copy = {
        ...node,
        text: displayText,
        _rawText: rawText,
        _exportNumber: exportNumber,
        _originId: ++originSeq.val,
        children: [],
      };
      const kids = Array.isArray(node.children) ? node.children : [];
      const baseNum = prefix ? prefix.replace(/\.$/, "") : "";
      kids.forEach((child, idx) => {
        const num =
          depth === 0 ? idx + 1 + "." : baseNum + "." + (idx + 1);
        const cloned = clonePreparedTree(
          child,
          num,
          numberIt,
          depth + 1,
          seen,
          originSeq,
        );
        if (cloned) copy.children.push(cloned);
      });
      seen.delete(node);
      return copy;
    }

    function resolvePreset(name) {
      return MODULAR_PRESETS[name] || MODULAR_PRESETS.balanced;
    }

    function makeContinuationL1(l1Node, sliceChildren, isContinuation) {
      const baseTitle = String(l1Node.text || "");
      return {
        ...l1Node,
        text: isContinuation ? baseTitle + " (continua)" : baseTitle,
        notes: isContinuation ? "" : l1Node.notes,
        _isContinuation: isContinuation,
        children: sliceChildren,
      };
    }

    function buildGroupWordCount(preparedRoot, group) {
      let sum = group.includeRootNotes
        ? nodeOwnWords(preparedRoot)
        : countWords(preparedRoot.text);
      for (const item of group.l1) sum += subtreeWordCount(item);
      return sum;
    }

    function splitSingleRoot(
      root,
      {
        preset = "balanced",
        hierarchicalNumbering = true,
        includeHeader = true,
        extension = "md",
        numberOnly = false,
      } = {},
    ) {
      const cfg = resolvePreset(preset);
      const prepared = clonePreparedTree(root, "", !!hierarchicalNumbering);
      if (!prepared) throw Error("Albero mappa non valido.");
      const totalWords = subtreeWordCount(prepared);
      const kids = prepared.children || [];

      if (numberOnly || totalWords <= cfg.maxWords || !kids.length) {
        const name = safe(prepared._rawText || prepared.text) + "." + extension;
        return [
          {
            part_index: 1,
            total_parts: 1,
            suggested_filename: name,
            context_header: null,
            nodes_tree: prepared,
            word_count: totalWords,
          },
        ];
      }

      const target = cfg.targetWords;
      const max = cfg.maxWords;
      const rootBaseWords = nodeOwnWords(prepared);
      const rawGroups = [];
      let current = {
        includeRootNotes: true,
        l1: [],
        words: rootBaseWords,
      };

      const flushCurrent = () => {
        if (current.l1.length) rawGroups.push(current);
        current = {
          includeRootNotes: false,
          l1: [],
          words: countWords(prepared.text),
        };
      };

      for (const l1 of kids) {
        const w1 = subtreeWordCount(l1);
        if (w1 <= max) {
          if (
            current.l1.length > 0 &&
            (current.words >= target || current.words + w1 > max)
          ) {
            flushCurrent();
          }
          current.l1.push(l1);
          current.words += w1;
          continue;
        }

        // Rule 3: L1 subtree alone exceeds maxWords -> split its L2 children sequentially
        const l2List = l1.children || [];
        if (!l2List.length) {
          if (current.l1.length > 0) flushCurrent();
          current.l1.push(l1);
          current.words += w1;
          flushCurrent();
          continue;
        }

        if (current.l1.length > 0 && current.words >= Math.round(target * 0.5)) {
          flushCurrent();
        }
        const l1HeadWords = nodeOwnWords(l1);
        let l2Slice = [];
        let sliceWords = current.words + l1HeadWords;
        let sliceCount = 0;

        for (const l2 of l2List) {
          const w2 = subtreeWordCount(l2);
          if (
            l2Slice.length > 0 &&
            (sliceWords >= target || sliceWords + w2 > max)
          ) {
            current.l1.push(makeContinuationL1(l1, l2Slice, sliceCount > 0));
            flushCurrent();
            sliceCount++;
            l2Slice = [];
            sliceWords =
              countWords(prepared.text) +
              countWords(l1.text + " (continua)");
          }
          l2Slice.push(l2);
          sliceWords += w2;
        }
        if (l2Slice.length) {
          current.l1.push(makeContinuationL1(l1, l2Slice, sliceCount > 0));
          current.words = sliceWords;
        }
      }
      if (current.l1.length) rawGroups.push(current);

      for (const g of rawGroups) g.wordCount = buildGroupWordCount(prepared, g);

      // Rule 4: Anti-Orphan protection (< 25% of targetWords)
      const orphanThreshold = Math.round(target * 0.25);
      while (
        rawGroups.length > 1 &&
        rawGroups[rawGroups.length - 1].wordCount < orphanThreshold
      ) {
        const tail = rawGroups.pop();
        const prev = rawGroups[rawGroups.length - 1];
        for (const branch of tail.l1) {
          const lastPrev = prev.l1[prev.l1.length - 1];
          if (
            lastPrev &&
            branch._isContinuation &&
            lastPrev._originId === branch._originId
          ) {
            lastPrev.children = lastPrev.children.concat(branch.children || []);
          } else {
            prev.l1.push(branch);
          }
        }
        prev.wordCount = buildGroupWordCount(prepared, prev);
      }

      const totalParts = rawGroups.length;
      const pad = Math.max(2, String(totalParts).length);
      const mapTitle = prepared._rawText || prepared.text || "Mappa";
      const stem = safe(mapTitle);

      return rawGroups.map((group, idx) => {
        const partIndex = idx + 1;
        const nodesTree = {
          ...prepared,
          ...(group.includeRootNotes ? {} : { notes: "" }),
          children: group.l1,
        };
        const sections = group.l1.map((b) => String(b.text || "").trim());
        const prevGroup = idx > 0 ? rawGroups[idx - 1] : null;
        const prevLast = prevGroup
          ? prevGroup.l1[prevGroup.l1.length - 1]
          : null;
        const contextHeader =
          includeHeader && totalParts > 1
            ? {
                title: mapTitle,
                part_index: partIndex,
                total_parts: totalParts,
                partLabel: "Parte " + partIndex + " di " + totalParts,
                sections,
                previousLastSection: prevLast
                  ? String(prevLast.text || "").trim()
                  : null,
              }
            : null;
        const filename =
          totalParts === 1
            ? stem + "." + extension
            : String(partIndex).padStart(pad, "0") +
              "_" +
              stem +
              "_Parte" +
              partIndex +
              "." +
              extension;
        return {
          part_index: partIndex,
          total_parts: totalParts,
          suggested_filename: filename,
          context_header: contextHeader,
          nodes_tree: nodesTree,
          word_count: group.wordCount,
        };
      });
    }

    function chunkTabs(tabs, options = {}) {
      const list = Array.isArray(tabs) ? tabs : [];
      const ext = String(options.extension || "md").toLowerCase();
      const all = [];
      for (const tab of list) {
        const root = tab?.state?.root || tab?.root || tab;
        const chunks = splitSingleRoot(root, options);
        for (const chunk of chunks) all.push(chunk);
      }
      const total = all.length;
      const pad = Math.max(2, String(total).length);
      const seenNames = new Set();
      return all.map((chunk, idx) => {
        const globalIndex = idx + 1;
        const baseRaw =
          chunk.nodes_tree?._rawText || chunk.nodes_tree?.text || "Mappa";
        const stem = safe(baseRaw);
        let name =
          total === 1
            ? stem + "." + ext
            : String(globalIndex).padStart(pad, "0") +
              "_" +
              stem +
              "_Parte" +
              chunk.part_index +
              "." +
              ext;
        if (seenNames.has(name.toLowerCase())) {
          let n = 2;
          const noExt = name.slice(0, -(ext.length + 1));
          while (seenNames.has((noExt + "_" + n + "." + ext).toLowerCase())) n++;
          name = noExt + "_" + n + "." + ext;
        }
        seenNames.add(name.toLowerCase());
        return {
          ...chunk,
          suggested_filename: name,
        };
      });
    }

    function estimate(tabs, options = {}) {
      const list = Array.isArray(tabs) ? tabs : [];
      if (!list.length) return { files: 0, totalWords: 0, avgWords: 0 };
      const splitMode = options.splitMode || "single";
      if (splitMode === "modular") {
        const chunks = chunkTabs(list, { ...options, numberOnly: false });
        const totalWords = chunks.reduce((s, c) => s + c.word_count, 0);
        return {
          files: chunks.length,
          totalWords,
          avgWords: Math.round(totalWords / Math.max(1, chunks.length)),
        };
      }
      const roots = list.map((t) => t?.state?.root || t?.root || t);
      const wordCounts = roots.map(subtreeWordCount);
      const totalWords = wordCounts.reduce((a, b) => a + b, 0);
      const files = splitMode === "tabs" && roots.length > 1 ? roots.length : 1;
      return {
        files,
        totalWords,
        avgWords: Math.round(totalWords / Math.max(1, files)),
      };
    }

    return Object.freeze({
      PRESETS: MODULAR_PRESETS,
      FORMATS: MODULAR_FORMATS,
      countWords,
      subtreeWordCount,
      chunkTree: splitSingleRoot,
      chunkTabs,
      estimate,
    });
  })();
