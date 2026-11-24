/* NeuroMap Android 7.4 candidate: responsive touch-first extensions.
 * Every action is local; writes require an explicit tap. No desktop license UI.
 */
(function (root) {
  "use strict";
  const by = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  const TOOL_ICON_SHAPES = {
    capture: [
      ["path", { d: "M12 3v11" }],
      ["path", { d: "m8 10 4 4 4-4" }],
      ["path", { d: "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" }],
    ],
    documents: [
      ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }],
      ["path", { d: "M14 2v6h6" }],
      ["path", { d: "M8 13h8" }],
      ["path", { d: "M8 17h5" }],
    ],
    writing: [
      ["path", { d: "M12 20h9" }],
      ["path", { d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" }],
    ],
    sources: [
      ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
      ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }],
    ],
    atlas: [
      ["circle", { cx: "12", cy: "12", r: "9" }],
      ["path", { d: "M3 12h18" }],
      ["path", { d: "M12 3a13 13 0 0 1 0 18" }],
      ["path", { d: "M12 3a13 13 0 0 0 0 18" }],
    ],
    wiki: [
      ["path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }],
      ["path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" }],
    ],
    database: [
      ["ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }],
      ["path", { d: "M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" }],
      ["path", { d: "M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" }],
    ],
    dashboard: [
      ["rect", { x: "3", y: "3", width: "8", height: "8", rx: "2" }],
      ["rect", { x: "13", y: "3", width: "8", height: "5", rx: "2" }],
      ["rect", { x: "13", y: "10", width: "8", height: "11", rx: "2" }],
      ["rect", { x: "3", y: "13", width: "8", height: "8", rx: "2" }],
    ],
    image: [
      ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }],
      ["circle", { cx: "8.5", cy: "9", r: "1.5" }],
      ["path", { d: "m21 15-5-5L5 20" }],
    ],
    cards: [
      ["rect", { x: "3", y: "6", width: "15", height: "13", rx: "2.5" }],
      ["path", { d: "M7 3h11a3 3 0 0 1 3 3v10" }],
      ["path", { d: "m8.5 12.5 2 2 4-4" }],
    ],
    work: [
      ["path", { d: "m9 11 3 3L22 4" }],
      ["path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }],
    ],
    quality: [
      ["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }],
      ["path", { d: "m9 12 2 2 4-4" }],
    ],
    share: [
      ["circle", { cx: "18", cy: "5", r: "3" }],
      ["circle", { cx: "6", cy: "12", r: "3" }],
      ["circle", { cx: "18", cy: "19", r: "3" }],
      ["path", { d: "m8.6 13.5 6.8 4" }],
      ["path", { d: "m15.4 6.5-6.8 4" }],
    ],
    exchange: [
      ["path", { d: "m17 2 4 4-4 4" }],
      ["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
      ["path", { d: "m7 22-4-4 4-4" }],
      ["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }],
    ],
  };
  const svgGlyph = (id, fallback) => {
    const shapes = TOOL_ICON_SHAPES[id];
    const span = el("span", "nm74-tool-icon");
    span.setAttribute("aria-hidden", "true");
    if (!shapes) {
      span.textContent = fallback || "•";
      return span;
    }
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const [tag, attrs] of shapes) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.appendChild(node);
    }
    span.appendChild(svg);
    return span;
  };
  const srSummary = (a) => {
    const totals = { due: 0, scheduled: 0, reviewed: 0, unreviewed: 0 };
    if (!a?.state?.root) return totals;
    if (root.NeuroMapKnowledgeCore?.memoryRadar) {
      return root.NeuroMapKnowledgeCore.memoryRadar(
        a.state.root,
        a.studyCards || [],
        a.activeTabId || "",
      ).totals;
    }
    const byNode = new Map(),
      tabId = a.activeTabId || "";
    for (const c of Array.isArray(a.studyCards)
      ? a.studyCards.slice(0, 10000)
      : []) {
      if (
        c?.sourceTabId !== tabId ||
        typeof c.sourceNodeId !== "string" ||
        !c.sourceNodeId
      )
        continue;
      if (!byNode.has(c.sourceNodeId)) byNode.set(c.sourceNodeId, []);
      byNode.get(c.sourceNodeId).push(c);
    }
    const now = Date.now(),
      seen = new Set(),
      ids = new Set(),
      stack = [a.state.root];
    while (stack.length && ids.size < 50000) {
      const n = stack.pop();
      if (!n || typeof n !== "object" || seen.has(n)) continue;
      seen.add(n);
      const id = typeof n.id === "string" ? n.id : "";
      if (!id || ids.has(id)) continue;
      ids.add(id);
      let reviews = Math.max(0, Number(n.sr?.reviews) || 0),
        dueAt = Number(n.sr?.dueAt) || 0,
        observed = reviews > 0;
      for (const c of byNode.get(id) || []) {
        const cv = Math.max(0, Number(c.sr?.reviews) || 0);
        if (cv > 0) observed = true;
        const d = Number(c.sr?.dueAt) || 0;
        if (d > 0 && (dueAt === 0 || d < dueAt)) dueAt = d;
      }
      const key = !observed
        ? "unreviewed"
        : dueAt > 0 && dueAt <= now
          ? "due"
          : dueAt > now
            ? "scheduled"
            : "reviewed";
      totals[key]++;
      const ch = Array.isArray(n.children) ? n.children : [];
      for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
    }
    return totals;
  };
  const lang = () => document.documentElement.lang === "en";
  const t = (it, en) => root.GlaukaI18n?.pair(it, en) ?? (lang() ? en : it);
  const C = () => root.NeuroMapCaptureCore,
    D = () => root.NeuroMapDocumentImport,
    A = () => root.NeuroMapAnkiTSV,
    W = () => root.NeuroMapWorkCore,
    Q = () => root.NeuroMapQualityCore,
    H = () => root.NeuroMapShareHTML,
    Cal = () => root.NeuroMapTaskCalendar,
    V = () => root.NeuroMapVisualStudyCore,
    X = () => root.NeuroMapPortableExchange;
  const app = () => root.neuroMapApp;
  const MAX_REPORT = 100;
  function mount() {
    if (root.GlaukaAppReady && !root.neuroMapApp) {
      root.GlaukaAppReady.then((value) => {
        if (value) mount();
      });
      return;
    }
    if (by("nm74-overlay") || !app()) return;
    const rail =
      by("nm-android-menu-rail") || document.querySelector(".top-chrome");
    if (!rail) return;
    const open = el(
      "button",
      "nm74-launch",
      "✦ " + t("Studio & Strumenti", "Study & Tools"),
    );
    open.type = "button";
    open.id = "nm74-launch";
    open.setAttribute(
      "aria-label",
      t("Apri gli strumenti Glauka", "Open Glauka tools"),
    );
    const wideRail =
      document.querySelector(".topbar.nm-ribbon .toolbar-group") ||
      document.querySelector(".top-chrome") ||
      rail;
    const narrow = root.matchMedia("(max-width:850px)");
    const placeLaunch = () => {
      if (open.closest("#glauka-app-dock")) return;
      const host = narrow.matches ? rail : wideRail;
      host.insertBefore(open, host.firstElementChild);
    };
    placeLaunch();
    narrow.addEventListener("change", placeLaunch);
    const shade = el("div", "nm74-shade");
    shade.id = "nm74-overlay";
    shade.hidden = true;
    shade.setAttribute("role", "dialog");
    shade.setAttribute("aria-modal", "true");
    shade.setAttribute("aria-labelledby", "nm74-title");
    const pane = el("section", "nm74-sheet"),
      header = el("header", "nm74-head");
    const title = el("h2", "", t("Glauka · strumenti", "Glauka · tools"));
    title.id = "nm74-title";
    const exit = el("button", "nm74-close", "×");
    exit.type = "button";
    exit.setAttribute("aria-label", t("Chiudi", "Close"));
    header.append(title, exit);
    const nav = el("nav", "nm74-nav");
    nav.setAttribute("aria-label", t("Sezioni strumenti", "Tool sections"));
    const content = el("div", "nm74-content"),
      status = el("div", "nm74-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const tabs = [
      ["capture", "✎", () => t("Appunti rapidi", "Quick notes")],
      ["documents", "▤", () => t("Importa documenti", "Import documents")],
      ["writing", "✎", () => t("Scrivi dalla mappa", "Write from the map")],
      ["sources", "⌕", () => t("Citazioni PDF", "PDF quotations")],
      ["atlas", "◎", () => t("Cerca nelle mappe", "Search maps")],
      ["wiki", "↔", () => t("Note e collegamenti", "Notes and links")],
      ["database", "▦", () => t("Tag e proprietà", "Tags and properties")],
      ["dashboard", "▥", () => t("Riepilogo mappe", "Map overview")],
      ["image", "◉", () => t("Quiz con immagini", "Image quizzes")],
      ["cards", "▣", () => t("Flashcard", "Flashcards")],
      ["work", "▦", () => t("Attività e scadenze", "Tasks and deadlines")],
      ["quality", "◇", () => t("Controlla la mappa", "Check the map")],
      ["share", "↗", () => t("Condividi la mappa", "Share the map")],
      ["exchange", "⇄", () => t("Confronta copie", "Compare copies")],
    ];
    const groups = [
      [
        "Crea e raccogli",
        "Create and collect",
        ["capture", "documents", "writing"],
      ],
      ["Studia e ripassa", "Study and review", ["cards", "image", "sources"]],
      [
        "Organizza e ritrova",
        "Organize and find",
        ["atlas", "wiki", "database", "dashboard", "work"],
      ],
      [
        "Controlla e condividi",
        "Check and share",
        ["quality", "share", "exchange"],
      ],
    ];
    const hints = {
      capture: () =>
        t(
          "Salva un appunto o un link nella mappa.",
          "Save a note or link in the map.",
        ),
      documents: () =>
        t(
          "Trasforma PDF e documenti in nuovi rami.",
          "Turn PDFs and documents into new branches.",
        ),
      writing: () =>
        t(
          "Sviluppa un testo partendo dai concetti.",
          "Develop a text from your concepts.",
        ),
      cards: () =>
        t(
          "Importa ed esporta domande per il ripasso.",
          "Import and export review questions.",
        ),
      image: () =>
        t(
          "Ripassa riconoscendo parti di un’immagine.",
          "Review by identifying parts of an image.",
        ),
      sources: () =>
        t(
          "Collega una citazione alla pagina del PDF.",
          "Link a quotation to its PDF page.",
        ),
      atlas: () =>
        t(
          "Trova concetti e appunti nelle mappe aperte.",
          "Find concepts and notes in open maps.",
        ),
      wiki: () =>
        t(
          "Scrivi note e collega concetti tra loro.",
          "Write notes and connect concepts.",
        ),
      database: () =>
        t(
          "Aggiungi etichette e informazioni ai concetti.",
          "Add tags and information to concepts.",
        ),
      dashboard: () =>
        t(
          "Consulta una panoramica delle mappe aperte.",
          "See an overview of open maps.",
        ),
      work: () =>
        t(
          "Gestisci attività, date e avanzamento.",
          "Manage tasks, dates and progress.",
        ),
      quality: () =>
        t(
          "Trova collegamenti o dati da correggere.",
          "Find links or data that need attention.",
        ),
      share: () =>
        t(
          "Crea una pagina da condividere o un calendario.",
          "Create a shareable page or calendar.",
        ),
      exchange: () =>
        t(
          "Confronta una copia con la mappa attuale.",
          "Compare a copy with the current map.",
        ),
    };
    const backTools = el("button", "nm74-tools-back");
    backTools.id = "nm74-tools-back";
    backTools.type = "button";
    backTools.hidden = true;
    header.prepend(backTools);
    const groupLabels = [];
    for (const [it, en, ids] of groups) {
      const section = el("section", "nm74-tool-group"),
        heading = el("h3", "", t(it, en));
      section.append(heading);
      nav.append(section);
      groupLabels.push([heading, it, en]);
      section.dataset.tools = ids.join(" ");
    }
    function showCatalog() {
      nav.hidden = false;
      content.hidden = true;
      backTools.hidden = true;
      status.hidden = true;
      title.textContent = t("Studio e strumenti", "Study and tools");
    }
    function showCurrent() {
      nav.hidden = true;
      content.hidden = false;
      backTools.hidden = false;
      status.hidden = false;
      backTools.focus({ preventScroll: true });
      title.textContent =
        tabs.find((tab) => tab[0] === current)?.[2]() ||
        t("Studio e strumenti", "Study and tools");
    }
    backTools.addEventListener("click", () => {
      showCatalog();
      nav.querySelector('[data-section="' + current + '"]')?.focus();
    });
    let current = "",
      owner = null,
      tabId = "",
      closeFocus = null,
      pending = null,
      editorSession = null;
    // Quick Capture has unsaved fields but no full document editor session.
    const hasCaptureDraft = () =>
      current === "capture" &&
      [...content.querySelectorAll("input:not([type=file]),textarea")].some(
        (input) => String(input.value || "").trim(),
      );
    root.NeuroMapLifecycle?.registerDraft?.({
      hasPending: () => !shade.hidden && !!editorSession?.hasUnsaved?.(),
      confirmClose: async () => {
        const answer = await app()?.nmAsk({
          title: t("Modifiche non salvate", "Unsaved edits"),
          message: t(
            "Scartare le modifiche prima di uscire?",
            "Discard edits before quitting?",
          ),
          choices: [
            {
              value: "cancel",
              text: t("Continua a modificare", "Continue editing"),
            },
            { value: "discard", text: t("Scarta", "Discard"), danger: true },
          ],
        });
        if (answer !== "discard") return false;
        close(true);
        return true;
      },
    });
    const live = () =>
      !shade.hidden && app()?.state === owner && app()?.activeTabId === tabId;
    const message = (s) => {
      status.textContent = String(s || "");
    };
    const button = (label, act, primary = false) => {
      const b = el("button", primary ? "nm74-primary" : "", label);
      b.type = "button";
      b.addEventListener("click", act);
      return b;
    };
    const field = (label, tag = "input") => {
      const wrapper = el("label", "nm74-field"),
        caption = el("span", "", label),
        control = el(tag);
      wrapper.append(caption, control);
      content.append(wrapper);
      return control;
    };
    // Retain WebView's native file picker; show its action and filename separately.
    const fileField = (label, accept) => {
      const wrapper = el("div", "nm74-field nm74-file-field");
      const caption = el("span", "", label),
        picker = el("input", "nm74-native-file");
      picker.type = "file";
      picker.accept = accept;
      picker.setAttribute("aria-label", label);
      const choose = el(
        "button",
        "nm74-file-pick",
        t("▣ Scegli file", "▣ Choose file"),
      );
      choose.type = "button";
      const filename = el(
        "small",
        "nm74-file-name",
        t("Nessun file selezionato", "No file selected"),
      );
      choose.addEventListener("click", () => picker.click());
      picker.addEventListener("change", () => {
        filename.textContent =
          picker.files?.[0]?.name ||
          t("Nessun file selezionato", "No file selected");
      });
      wrapper.append(caption, picker, choose, filename);
      content.append(wrapper);
      return picker;
    };
    const note = (text) => content.append(el("p", "nm74-hint", text));
    const display = (item) => {
      const p = el("p", "nm74-result", item);
      content.append(p);
      return p;
    };
    const anchor = () =>
      app()?.state?.findNode?.(app().state.selectedNodeId) ||
      app()?.state?.root;
    const countNodes = () =>
      app()?.state?.getNodeCountIncludingCollapsed?.() || 0;
    const btnRow = (...items) => {
      const row = el("div", "nm74-actions");
      row.append(...items);
      content.append(row);
      return row;
    };
    function close(force = false) {
      if (!force && editorSession?.hasUnsaved?.()) {
        app()
          ?.nmAsk({
            title: t("Modifiche non salvate", "Unsaved changes"),
            message: t(
              "Scartare le modifiche prima di chiudere?",
              "Discard changes before closing?",
            ),
            choices: [
              {
                value: "cancel",
                text: t("Continua a modificare", "Continue editing"),
              },
              { value: "discard", text: t("Scarta", "Discard"), danger: true },
            ],
          })
          .then((answer) => {
            if (answer === "discard") close(true);
          });
        return;
      }
      editorSession = null;
      shade.hidden = true;
      owner = null;
      pending = null;
      current = "";
      if (closeFocus?.isConnected) closeFocus.focus();
    }
    function show(section) {
      current = section;
      showCurrent();
      pending = null;
      editorSession = null;
      message("");
      content.replaceChildren();
      for (const b of nav.querySelectorAll("button"))
        b.setAttribute("aria-selected", String(b.dataset.section === section));
      if (!live()) {
        message(
          t(
            "La scheda è cambiata. Riapri gli strumenti.",
            "Tab changed. Reopen tools.",
          ),
        );
        return;
      }
      const a = app();
      try {
        if (section === "capture") {
          note(
            t(
              "Incolla testo o un collegamento. Il nodo verrà creato solo quando confermi.",
              "Paste text or a link. The node is created only after confirmation.",
            ),
          );
          const title = field(t("Titolo (facoltativo)", "Title (optional)"));
          title.maxLength = 180;
          const url = field("URL HTTP(S)");
          url.type = "url";
          url.placeholder = "https://";
          url.maxLength = 2048;
          const text = field(t("Testo o appunti", "Text or notes"), "textarea");
          text.maxLength = 20000;
          text.rows = 5;
          btnRow(
            button(
              t(
                "Aggiungi sotto il nodo selezionato",
                "Add below selected node",
              ),
              () => {
                if (!live()) return;
                try {
                  const p = C().propose({
                    title: title.value,
                    url: url.value,
                    text: text.value,
                  });
                  const selected = anchor();
                  if (countNodes() >= 3500) throw Error("Limite 3500 nodi");
                  const child = a.state.addChildNode(selected.id, a.layout);
                  if (!child) throw Error("Unable to add child");
                  child.text = p.title;
                  child.notes = p.notes;
                  if (p.linkUrl) child.linkUrl = p.linkUrl;
                  a.markChanged();
                  a.scheduleSave();
                  message(
                    t("Appunto salvato nella mappa", "Note saved in map"),
                  );
                  title.value = "";
                  url.value = "";
                  text.value = "";
                } catch (e) {
                  message(e.message);
                }
              },
              true,
            ),
          );
        } else if (section === "documents") {
          btnRow(
            button(
              t("Leggi testo dalle scansioni…", "Read text from scans…"),
              () => {
                close(true);
                const run = async () => {
                  try {
                    if (root.NeuroMapOCREnsure?.open) await root.NeuroMapOCREnsure.open(a);
                    else a._nmOCR?.open();
                  } catch (error) {
                    a.showToast?.(error.message || String(error));
                  }
                };
                run();
              },
            ),
          );
          note(
            t(
              "Anteprima locale di PDF testuali, DOCX, Markdown o TXT. Nessun file viene caricato online.",
              "Local preview of text PDFs, DOCX, Markdown or TXT. Files are never uploaded.",
            ),
          );
          const picker = fileField(
            t("Scegli documento", "Choose document"),
            ".pdf,.docx,.md,.markdown,.txt",
          );
          const result = el("div", "nm74-results");
          content.append(result);
          const confirmLabel = el("label", "nm74-confirm"),
            verify = el("input");
          verify.type = "checkbox";
          confirmLabel.append(
            verify,
            document.createTextNode(
              " " +
                t(
                  "Ho verificato le pagine PDF rispetto all’originale",
                  "I verified the PDF pages against the original",
                ),
            ),
          );
          confirmLabel.hidden = true;
          content.append(confirmLabel);
          const apply = button(
            t("Aggiungi sotto il nodo selezionato", "Add below selected node"),
            () => {
              if (!pending || !live()) return;
              if (pending.kind === "pdf" && !verify.checked) {
                message(
                  t(
                    "Verifica il PDF prima di procedere",
                    "Verify the PDF first",
                  ),
                );
                return;
              }
              if (countNodes() + pending.count > 3500) {
                message(
                  t(
                    "Superato il limite di nodi della mappa",
                    "Map node limit exceeded",
                  ),
                );
                return;
              }
              try {
                const payload = JSON.parse(JSON.stringify(pending.root));
                // Dedicated copy of the proposal; no automatic replacements of existing nodes.
                let counter = 0;
                const stack = [payload];
                while (stack.length) {
                  const n = stack.pop();
                  n.id = "nm74import" + ++counter;
                  n.side = "right";
                  for (const c of n.children || []) stack.push(c);
                }
                a.pasteSelection({
                  kind: "nodes",
                  nodes: [payload],
                  images: [],
                  relationships: [],
                });
                a.scheduleSave();
                message(
                  t("Documento aggiunto alla mappa", "Document added to map"),
                );
                pending = null;
                apply.disabled = true;
              } catch (e) {
                message(e.message);
              }
            },
            true,
          );
          apply.disabled = true;
          btnRow(apply);
          picker.addEventListener("change", async () => {
            pending = null;
            apply.disabled = true;
            result.replaceChildren();
            verify.checked = false;
            const f = picker.files?.[0];
            if (!f) return;
            message(t("Lettura locale in corso…", "Reading locally…"));
            const selectedTab = a.activeTabId,
              selectedState = a.state;
            try {
              const p = await D().preview(f);
              if (
                !live() ||
                a.activeTabId !== selectedTab ||
                a.state !== selectedState
              )
                return;
              pending = p;
              confirmLabel.hidden = p.kind !== "pdf";
              apply.disabled = false;
              result.append(
                el(
                  "strong",
                  "",
                  p.title + " · " + p.count + t(" nodi", " nodes"),
                ),
              );
              const stack = [{ node: p.root, depth: 0 }];
              let shown = 0;
              while (stack.length && shown < 70) {
                const { node, depth } = stack.pop();
                const row = el("div", "nm74-outline", node.text);
                row.style.paddingInlineStart =
                  Math.min(depth, 7) * 11 + 8 + "px";
                result.append(row);
                shown++;
                for (let i = (node.children || []).length - 1; i >= 0; i--)
                  stack.push({ node: node.children[i], depth: depth + 1 });
              }
              message(
                p.warnings.join(" ") ||
                  t(
                    "Verifica la struttura prima di inserire.",
                    "Check the outline before adding.",
                  ),
              );
            } catch (e) {
              message(t("Non importabile: ", "Cannot import: ") + e.message);
            }
          });
        } else if (section === "writing") {
          const D = root.NeuroMapDocumentView;
          if (!D) throw Error("Document core unavailable");
          const chapters = D.project(a.state.root, { limit: 3500 });
          note(
            t(
              "Documento e mappa condividono gli stessi nodi. Le modifiche sono salvate con un solo Undo.",
              "Document and map share the same nodes. Edits are saved with one Undo step.",
            ),
          );
          const picker = field(t("Capitolo", "Chapter"), "select");
          const shown = chapters.slice(0, 100),
            selected =
              chapters.find((c) => c.id === a.state.selectedNodeId) ||
              chapters[0];
          if (!shown.some((c) => c.id === selected.id)) shown.push(selected);
          for (const row of shown) {
            const option = el(
              "option",
              "",
              "· ".repeat(Math.min(row.depth, 6)) + (row.title || "(empty)"),
            );
            option.value = row.id;
            picker.append(option);
          }
          picker.value = selected.id;
          if (chapters.length > 100)
            note(
              t(
                "Primi 100 capitoli e selezione corrente; usa la mappa per gli altri.",
                "First 100 chapters and current selection; use the map for other chapters.",
              ),
            );
          const title = field(t("Titolo", "Title"));
          title.value = selected.title;
          title.maxLength = 10000;
          const notes = field(
            t("Testo / Markdown", "Text / Markdown"),
            "textarea",
          );
          notes.value = selected.notes;
          notes.maxLength = 50000;
          notes.rows = 9;
          const changed = () =>
            title.value !== selected.title || notes.value !== selected.notes;
          editorSession = { hasUnsaved: changed };
          picker.addEventListener("change", async () => {
            if (changed()) {
              const answer = await a.nmAsk({
                title: t("Modifiche non salvate", "Unsaved edits"),
                message: t(
                  "Scartare le modifiche prima di cambiare capitolo?",
                  "Discard edits before changing chapter?",
                ),
                choices: [
                  { value: "cancel", text: t("Continua", "Continue") },
                  {
                    value: "discard",
                    text: t("Scarta", "Discard"),
                    danger: true,
                  },
                ],
              });
              if (answer !== "discard") {
                picker.value = selected.id;
                return;
              }
            }
            if (!live()) return;
            a.selectNode(picker.value);
            show("writing");
          });
          btnRow(
            button(
              t("Salva capitolo", "Save chapter"),
              () => {
                if (!live()) return;
                try {
                  const result = D.commit(owner, [
                    {
                      id: selected.id,
                      expectedTitle: selected.title,
                      expectedNotes: selected.notes,
                      title: title.value,
                      notes: notes.value,
                    },
                  ]);
                  if (result.changed) {
                    a.markChanged();
                    a.scheduleSave();
                  }
                  show("writing");
                  message(t("Capitolo sincronizzato", "Chapter synchronized"));
                } catch (error) {
                  message(String(error.message || error));
                }
              },
              true,
            ),
            button(t("Annulla", "Cancel"), () => show("writing")),
          );
          btnRow(
            button(t("Esporta testo JSONL", "Export JSONL text"), () => {
              if (!live() || changed()) {
                message(
                  t(
                    "Salva o annulla prima di esportare",
                    "Save or cancel before export",
                  ),
                );
                return;
              }
              try {
                const out = field(
                  t("Testo completo da copiare", "Complete text to copy"),
                  "textarea",
                );
                out.readOnly = true;
                out.rows = 8;
                out.value = D.exportText(owner.root);
                out.focus();
                out.select();
                message(
                  t(
                    "Testo copiabile; non sostituisce il file originale",
                    "Copyable text; not a replacement for the original project",
                  ),
                );
              } catch (error) {
                message(String(error.message || error));
              }
            }),
          );
        } else if (section === "sources") {
          note(
            t(
              "Scegli un PDF testuale, cerca un passaggio e selezionalo per collegare una citazione al nodo. Il documento originale non viene incorporato.",
              "Choose a text PDF, search and highlight a passage to link a citation. The original PDF is never embedded.",
            ),
          );
          const chooser = fileField(
            t("PDF locale", "Local PDF"),
            ".pdf,application/pdf",
          );
          const search = field(t("Cerca nel PDF", "Search PDF"));
          search.type = "search";
          search.disabled = true;
          const pages = el("div", "nm74-pagechips");
          content.append(pages);
          const textArea = field(
            t(
              "Testo estratto: seleziona il passaggio",
              "Extracted text: select a passage",
            ),
            "textarea",
          );
          textArea.readOnly = true;
          textArea.rows = 7;
          textArea.style.minHeight = "170px";
          const checkbox = el("label", "nm74-confirm"),
            checked = el("input");
          checked.type = "checkbox";
          checkbox.append(
            checked,
            document.createTextNode(
              " " +
                t(
                  "Ho confrontato questo testo con la pagina del PDF originale.",
                  "I compared the extracted text with the original PDF page.",
                ),
            ),
          );
          content.append(checkbox);
          const saved = display("");
          let loaded = null,
            selectedPage = 1,
            ownerNode = a.state.selectedNodeId,
            version = 0;
          function choosePage(p) {
            if (!loaded) return;
            selectedPage = p;
            const page = loaded.report.pages.find((x) => x.page === p);
            textArea.value = page?.text || "";
            pages
              .querySelectorAll("button")
              .forEach((btn) =>
                btn.setAttribute(
                  "aria-pressed",
                  String(Number(btn.dataset.page) === p),
                ),
              );
          }
          function hits() {
            pages.replaceChildren();
            if (!loaded) return;
            const q = search.value.trim(),
              items = q
                ? root.NeuroMapPdfText.search(loaded.report.pages, q)
                : loaded.report.pages
                    .filter((p) => p.text)
                    .slice(0, 50)
                    .map((p) => ({ page: p.page }));
            for (const item of items.slice(0, 50)) {
              const chip = button(t("Pag. ", "Page ") + item.page, () =>
                choosePage(item.page),
              );
              chip.className = "nm74-pagechip";
              chip.dataset.page = item.page;
              chip.setAttribute(
                "aria-pressed",
                String(item.page === selectedPage),
              );
              pages.append(chip);
            }
            if (!items.length)
              pages.append(
                el("small", "", t("Nessuna corrispondenza", "No matches")),
              );
          }
          search.addEventListener("input", hits);
          chooser.addEventListener("change", async () => {
            loaded = null;
            search.disabled = true;
            pages.replaceChildren();
            textArea.value = "";
            checked.checked = false;
            const file = chooser.files?.[0];
            if (!file) return;
            const maxMb = Math.max(
              1,
              Math.round((root.NeuroMapPdfText.MAX_BYTES || 512 * 1024 * 1024) / (1024 * 1024)),
            );
            if (
              !root.NeuroMapSourceCore.isPDF(file) ||
              file.size > root.NeuroMapPdfText.MAX_BYTES
            ) {
              message(
                t(
                  `PDF non valido o superiore a ${maxMb} MB`,
                  `Invalid PDF or over ${maxMb} MB`,
                ),
              );
              return;
            }
            const token = ++version;
            ownerNode = a.state.selectedNodeId;
            message(t("Lettura del PDF in corso…", "Reading PDF…"));
            try {
              const report = await root.NeuroMapPdfText.inspect(file, {
                includeDigest: true,
              });
              const digest =
                report.sha256 ||
                (await root.NeuroMapSourceCore.fingerprint(file));
              if (!live() || version !== token) return;
              loaded = { file, report, digest };
              selectedPage = report.pages.find((p) => p.text)?.page || 1;
              search.disabled = false;
              hits();
              choosePage(selectedPage);
              message(
                report.unreadablePages
                  ? t("Pagine non leggibili: ", "Unreadable pages: ") +
                      report.unreadablePages
                  : t(
                      "Seleziona alcune parole e verifica il PDF originale.",
                      "Select a passage and check the original PDF.",
                    ),
              );
            } catch (e) {
              message(e.message);
            }
          });
          btnRow(
            button(
              t("Collega citazione selezionata", "Link selected citation"),
              () => {
                if (!live() || !loaded) return;
                if (!checked.checked) {
                  message(
                    t(
                      "Verifica la pagina originale.",
                      "Verify the original page.",
                    ),
                  );
                  return;
                }
                if (a.state.selectedNodeId !== ownerNode) {
                  message(
                    t(
                      "Il nodo è cambiato. Riapri la fonte.",
                      "Node changed. Reopen source.",
                    ),
                  );
                  return;
                }
                const quote = textArea.value
                  .slice(textArea.selectionStart, textArea.selectionEnd)
                  .trim();
                if (!quote) {
                  message(
                    t(
                      "Seleziona il passaggio nel testo.",
                      "Highlight a passage in the text.",
                    ),
                  );
                  return;
                }
                const node = a.state.findNode(ownerNode);
                if (!node) return;
                const core = root.NeuroMapSourceCore;
                if (
                  core.normalizeAll(node.sourceRefs).length >= core.MAX_REFS
                ) {
                  message(
                    t(
                      "Raggiunto limite citazioni del nodo.",
                      "Citation limit reached.",
                    ),
                  );
                  return;
                }
                const item = core.normalize({
                  kind: "pdf",
                  id: core.newId(),
                  fileName: loaded.file.name,
                  sha256: loaded.digest,
                  title: loaded.file.name,
                  page: selectedPage,
                  quote: quote.slice(0, core.MAX_QUOTE),
                  createdAt: new Date().toISOString(),
                });
                if (!item) {
                  message(t("Fonte non valida", "Invalid source"));
                  return;
                }
                a.state.pushHistory();
                if (!core.attach(node, item)) {
                  a.state.undo();
                  message(
                    t(
                      "Impossibile aggiungere la fonte",
                      "Cannot attach source",
                    ),
                  );
                  return;
                }
                a.markChanged();
                a.scheduleSave();
                checked.checked = false;
                saved.textContent =
                  t(
                    "Citazione collegata al nodo: pagina ",
                    "Citation linked to node: page ",
                  ) + selectedPage;
              },
              true,
            ),
          );
        } else if (section === "atlas") {
          note(
            t(
              "Cerca nomi e appunti in tutte le schede aperte. Il risultato porta al nodo originale senza duplicare contenuti.",
              "Search names and notes across open tabs. Results navigate to the original node without duplicating data.",
            ),
          );
          const input = field(t("Cerca nelle mappe", "Search maps"));
          input.type = "search";
          input.placeholder = t(
            "Per esempio: fegato, circolo, anatomia",
            "For example: heart, circulation, anatomy",
          );
          const results = el("div", "nm74-results");
          content.append(results);
          const index = root.NeuroMapKnowledgeCore.indexTabs(a.tabs, 35000);
          display(
            index.records.length +
              t(
                " concetti indicizzati localmente",
                " locally indexed concepts",
              ),
          );
          function render() {
            results.replaceChildren();
            if (!input.value.trim()) return;
            for (const hit of root.NeuroMapKnowledgeCore.search(
              index,
              input.value,
              60,
            )) {
              const item = button(
                hit.title + " › " + hit.text.slice(0, 130),
                () => {
                  if (!live()) return;
                  const tab = a.tabs.find((x) => x.id === hit.tabId);
                  if (!tab?.state.findNode(hit.nodeId)) return;
                  close();
                  a.activateTab(hit.tabId);
                  a.selectNode(hit.nodeId);
                  a.teleportToNode?.(hit.nodeId, hit.tabId);
                },
              );
              item.className = "nm74-searchresult";
              results.append(item);
            }
            if (!results.children.length)
              results.append(
                el("small", "", t("Nessun risultato", "No result")),
              );
          }
          input.addEventListener("input", render);
          if (index.limitReached)
            message(
              t(
                "Indice parziale: limite 35.000 nodi",
                "Partial index: 35,000 node limit",
              ),
            );
        } else if (section === "wiki" || section === "database" || section === "dashboard") {
          const target = section;
          const mount = () => {
            if (current !== target || !live()) return;
            if (target === "wiki") {
              note(
                t(
                  "Note Markdown e collegamenti bidirezionali. Le modifiche richiedono conferma; nessuna nota viene duplicata.",
                  "Markdown notes and backlinks. Changes require confirmation; notes are never duplicated.",
                ),
              );
              editorSession = root.NeuroMapWikiUI.renderInto(content, a, {
                compact: true,
                onNavigate: () => close(true),
              });
            } else if (target === "database") {
              editorSession = root.NeuroMapKnowledgeDBUI.renderInto(content, a, {
                compact: true,
                onNavigate: () => close(true),
              });
            } else {
              editorSession = root.NeuroMapDashboardUI82.renderInto(content, a, {
                compact: true,
                onNavigate: () => close(true),
              });
            }
          };
          if (root.NeuroMapWikiUI && root.NeuroMapKnowledgeDBUI && root.NeuroMapDashboardUI82) mount();
          else {
            note(t("Caricamento strumenti Studio…", "Loading Studio tools…"));
            Promise.resolve(root.NeuroMapStudioToolsEnsure?.ensure?.())
              .then(mount)
              .catch((error) => message(error.message || String(error)));
          }
        } else if (section === "cards") {
          const totals = srSummary(a),
            kpiGrid = el("div", "nm74-kpi-grid");
          for (const [val, lbl] of [
            [totals.due, t("Da ripassare", "Due")],
            [totals.scheduled, t("Programmate", "Scheduled")],
            [totals.reviewed, t("Ripassate", "Reviewed")],
            [totals.unreviewed, t("Senza dati", "Unreviewed")],
          ]) {
            const card = el("div", "nm74-kpi-card");
            card.append(el("strong", "", String(val)), el("small", "", lbl));
            kpiGrid.append(card);
          }
          content.append(kpiGrid);
          btnRow(
            button(
              t("Ripassa / Quiz adesso", "Study / Quiz now"),
              () => {
                close(true);
                document.getElementById("btn-flashcards")?.click();
              },
              true,
            ),
          );
          note(
            t(
              "Compatibilità Anki: due colonne Front/Back in formato TSV. Non è un pacchetto .apkg.",
              "Anki compatibility: Front/Back TSV. This is not an .apkg package.",
            ),
          );
          const picker = fileField(
            t("Importa file TSV", "Import TSV file"),
            ".tsv,.txt",
          );
          const preview = display("");
          const importBtn = button(
            t("Conferma importazione", "Confirm import"),
            () => {
              if (!pending || !live()) return;
              const selected = anchor(),
                now = Date.now();
              let added = 0;
              const known = new Set(
                (a.studyCards || [])
                  .filter(
                    (c) =>
                      c.sourceTabId === tabId && c.sourceNodeId === selected.id,
                  )
                  .map(
                    (c) =>
                      c.question.toLowerCase() + "\0" + c.answer.toLowerCase(),
                  ),
              );
              for (const card of pending) {
                const key =
                  card.question.toLowerCase() +
                  "\0" +
                  card.answer.toLowerCase();
                if (known.has(key)) continue;
                known.add(key);
                a.studyCards.push({
                  id: a.state.generateId("card"),
                  question: card.question,
                  answer: card.answer,
                  sourceTabId: tabId,
                  sourceNodeId: selected.id,
                  sourceSignature: a.v5Signature?.(selected, a.state) || "",
                  breadcrumb: selected.text,
                  createdAt: now,
                  srStatus: 0,
                  sr: {
                    dueAt: 0,
                    lastReviewedAt: 0,
                    intervalDays: 0,
                    reviews: 0,
                    lapses: 0,
                  },
                });
                added++;
              }
              a.scheduleSave();
              message(
                added + t(" nuove carte importate", " new cards imported"),
              );
              pending = null;
              importBtn.disabled = true;
            },
            true,
          );
          importBtn.disabled = true;
          const exportBtn = button(
            t("Esporta flashcard Anki", "Export Anki flashcards"),
            () => {
              if (!live()) return;
              try {
                const data = A().exportTSV(
                  (a.studyCards || []).filter((c) => c.sourceTabId === tabId),
                );
                a.io.triggerDownload(
                  new Blob([data], {
                    type: "text/tab-separated-values;charset=utf-8",
                  }),
                  "neuromap-anki.tsv",
                );
                message(
                  t(
                    "Seleziona la destinazione sul dispositivo.",
                    "Choose where to save on the device.",
                  ),
                );
              } catch (e) {
                message(e.message);
              }
            },
          );
          btnRow(importBtn, exportBtn);
          picker.addEventListener("change", async () => {
            const f = picker.files?.[0];
            pending = null;
            importBtn.disabled = true;
            if (!f) return;
            if (f.size > A().MAX_BYTES) {
              message("Max 2 MB");
              return;
            }
            try {
              const data = A().parse(await f.text());
              if (!live()) return;
              pending = data;
              preview.textContent =
                data.length + t(" carte da importare", " cards to import");
              importBtn.disabled = false;
            } catch (e) {
              message(e.message);
            }
          });
        } else if (section === "work") {
          note(
            t(
              "Attività e prerequisiti. Le scadenze sono manuali, non vengono mai spostate automaticamente.",
              "Tasks and prerequisites. Deadlines are manual and never rescheduled automatically.",
            ),
          );
          const allTasks = W().candidates(a.state.root, 3500),
            nodes = allTasks.slice(0, 350);
          if (!nodes.some((n) => n.id === a.state.selectedNodeId)) {
            const current = allTasks.find(
              (n) => n.id === a.state.selectedNodeId,
            );
            if (current) nodes.push(current);
          }
          if (allTasks.length > nodes.length)
            note(
              t(
                "Mostrate le prime 350 attività e quella selezionata.",
                "Showing first 350 tasks and selected one.",
              ),
            );
          const selector = field(t("Attività", "Task"), "select");
          for (const node of nodes) {
            const o = el("option", "", node.path.slice(0, 110));
            o.value = node.id;
            selector.append(o);
          }
          if (nodes.some((x) => x.id === a.state.selectedNodeId))
            selector.value = a.state.selectedNodeId;
          const statusField = field(t("Stato", "Status"), "select");
          for (const [v, label] of [
            ["todo", t("Da fare", "To do")],
            ["doing", t("In corso", "In progress")],
            ["done", t("Completato", "Done")],
          ]) {
            const o = el("option", "", label);
            o.value = v;
            statusField.append(o);
          }
          const start = field(t("Inizio", "Start"));
          start.type = "date";
          const due = field(t("Scadenza", "Due date"));
          due.type = "date";
          const predecessor = field(t("Prerequisito", "Predecessor"), "select");
          const explain = display("");
          const sync = () => {
            const n = a.state.findNode(selector.value);
            if (!n) return;
            statusField.value = n.taskStatus || "todo";
            start.value = n.startDate || "";
            due.value = n.dueDate || "";
            predecessor.replaceChildren();
            for (const task of nodes) {
              if (task.id === n.id) continue;
              const o = el("option", "", task.path.slice(0, 100));
              o.value = task.id;
              predecessor.append(o);
            }
            explain.textContent =
              t("Prerequisiti: ", "Predecessors: ") +
              (n.taskDependsOn || [])
                .map((id) => a.state.findNode(id)?.text || "?")
                .join(", ");
          };
          selector.addEventListener("change", sync);
          sync();
          btnRow(
            button(
              t("Salva attività", "Save task"),
              () => {
                if (!live()) return;
                const node = a.state.findNode(selector.value);
                if (!node) return;
                if (start.value && due.value && start.value > due.value) {
                  message(
                    t(
                      "La data di inizio supera la scadenza",
                      "Start date exceeds due date",
                    ),
                  );
                  return;
                }
                a.state.pushHistory();
                node.taskStatus = statusField.value;
                node.startDate = start.value || undefined;
                node.dueDate = due.value || undefined;
                a.markChanged();
                a.scheduleSave();
                message(
                  t(
                    "Attività salvata (Undo disponibile)",
                    "Task saved (Undo available)",
                  ),
                );
              },
              true,
            ),
            button(
              t("Aggiungi / rimuovi prerequisito", "Toggle predecessor"),
              () => {
                if (!live()) return;
                const n = a.state.findNode(selector.value),
                  id = predecessor.value;
                if (!n || !id) return;
                const existing = W().cleanDependencies(n.taskDependsOn);
                const next = existing.includes(id)
                  ? existing.filter((x) => x !== id)
                  : existing.concat(id);
                if (a.state.setNodeTaskDependencies(n.id, next)) {
                  a.markChanged();
                  a.scheduleSave();
                  sync();
                  message(t("Prerequisiti aggiornati", "Predecessors updated"));
                } else
                  message(
                    a.state._androidDependencyError ||
                      t("Dipendenza non valida", "Invalid dependency"),
                  );
              },
            ),
          );
          const report = el("div", "nm74-results");
          content.append(report);
          for (const item of nodes
            .filter((x) => x.startDate || x.dueDate)
            .slice(0, 70)) {
            report.append(
              el(
                "div",
                "nm74-outline",
                item.path.slice(0, 90) +
                  " · " +
                  (item.startDate || "…") +
                  " → " +
                  (item.dueDate || "…"),
              ),
            );
          }
        } else if (section === "quality") {
          note(
            t(
              "Diagnostica offline e non distruttiva delle mappe aperte. I duplicati sono solo suggerimenti.",
              "Offline, non-destructive audit of open maps. Duplicate labels are suggestions only.",
            ),
          );
          const now = new Date(),
            today = [
              now.getFullYear(),
              String(now.getMonth() + 1).padStart(2, "0"),
              String(now.getDate()).padStart(2, "0"),
            ].join("-");
          const result = Q().inspect({
            tabs: a.tabs,
            studyCards: a.studyCards || [],
            today,
          });
          const totals = Q().summary(result);
          display(
            result.counts.nodes +
              t(" nodi · ", " nodes · ") +
              totals.error +
              t(" errori · ", " errors · ") +
              totals.warning +
              t(" verifiche · ", " warnings · ") +
              totals.info +
              t(" suggerimenti", " suggestions"),
          );
          const filter = field(t("Filtra segnalazioni", "Filter issues"));
          filter.type = "search";
          const report = el("div", "nm74-results");
          content.append(report);
          function render() {
            report.replaceChildren();
            const hits = result.items
              .filter((x) =>
                (x.label + " " + x.kind + " " + x.detail)
                  .toLowerCase()
                  .includes(filter.value.toLowerCase()),
              )
              .slice(0, MAX_REPORT);
            for (const issue of hits) {
              const row = el("div", "nm74-issue"),
                text = el(
                  "div",
                  "",
                  issue.label + " · " + issue.kind + " — " + issue.detail,
                );
              row.append(text);
              if (issue.nodeId) {
                const jump = button("↗", () => {
                  const target = a.tabs.find((x) => x.id === issue.tabId);
                  if (!target || !target.state.findNode(issue.nodeId)) return;
                  close();
                  a.activateTab(issue.tabId);
                  a.selectNode(issue.nodeId);
                  a.teleportToNode?.(issue.nodeId, issue.tabId);
                });
                jump.setAttribute("aria-label", t("Vai al nodo", "Go to node"));
                row.append(jump);
              }
              report.append(row);
            }
            if (result.truncated || result.items.length > MAX_REPORT)
              report.append(
                el(
                  "small",
                  "",
                  t(
                    "Mostrati i primi risultati; usa il filtro.",
                    "Showing first results; use search.",
                  ),
                ),
              );
          }
          filter.addEventListener("input", render);
          render();
          btnRow(
            button(t("Esporta report JSON", "Export JSON report"), () => {
              const copy = {
                format: "neuromap-quality-report-v1",
                items: result.items,
                counts: result.counts,
              };
              a.io.triggerDownload(
                new Blob([JSON.stringify(copy)], { type: "application/json" }),
                "neuromap-quality.json",
              );
              message(
                t(
                  "Contiene dati della mappa: condividilo con attenzione.",
                  "Contains map data: share carefully.",
                ),
              );
            }),
          );
        } else if (section === "share") {
          note(
            t(
              "HTML navigabile offline e calendario .ics. Note e URL esclusi per impostazione predefinita.",
              "Offline navigable HTML and .ics calendar. Notes and URLs are excluded by default.",
            ),
          );
          const notes = field(t("Includere le note?", "Include notes?"));
          notes.type = "checkbox";
          const links = field(
            t("Includere i link HTTP(S)?", "Include HTTP(S) URLs?"),
          );
          links.type = "checkbox";
          const output = (data, type, name) => {
            if (!live()) return;
            a.io.triggerDownload(new Blob([data], { type }), name);
            message(
              t(
                "File pronto: scegli una cartella sul dispositivo.",
                "Ready: choose a folder on your device.",
              ),
            );
          };
          btnRow(
            button(
              t("Esporta HTML", "Export HTML"),
              () => {
                try {
                  output(
                    H().render(a.state.root, {
                      notes: notes.checked,
                      links: links.checked,
                    }),
                    "text/html;charset=utf-8",
                    "neuromap-offline.html",
                  );
                } catch (e) {
                  message(e.message);
                }
              },
              true,
            ),
            button(t("Esporta calendario .ics", "Export calendar .ics"), () => {
              try {
                const p = Cal().render(a.state.root);
                output(
                  p.content,
                  "text/calendar;charset=utf-8",
                  "neuromap-tasks.ics",
                );
              } catch (e) {
                message(e.message);
              }
            }),
          );
          btnRow(
            button(
              t(
                "Apri Condividi / Trasferisci mappa (PC / Drive)…",
                "Open Share / Transfer map (PC / Drive)…",
              ),
              () => {
                close(true);
                if (a?._nmMapShare?.openStage) a._nmMapShare.openStage("save");
                else document.getElementById("nm-map-share")?.showModal?.();
              },
            ),
          );
        } else if (section === "exchange") {
          note(
            t(
              "Esporta una copia verificabile e confronta il progetto attivo. Non è sincronizzazione automatica.",
              "Export a verifiable copy and compare with the active map. Not automatic sync.",
            ),
          );
          btnRow(
            button(
              t(
                "Apri Condividi / Trasferisci mappa (PC / Drive)…",
                "Open Share / Transfer map (PC / Drive)…",
              ),
              () => {
                close(true);
                if (a?._nmMapShare?.openStage) a._nmMapShare.openStage("sync");
                else document.getElementById("nm-map-share")?.showModal?.();
              },
              true,
            ),
          );
          const picker = fileField(
            t("Copia JSON da confrontare", "JSON copy to compare"),
            ".json",
          );
          const report = display("");
          const openCopy = button(
            t("Apri copia in una nuova scheda", "Open copy in new tab"),
            async () => {
              if (!pending || !live()) return;
              try {
                const packet = pending;
                pending = null;
                openCopy.disabled = true;
                await a.importFile(
                  new File([JSON.stringify(packet.project)], "copy.neuromap", {
                    type: "application/json",
                  }),
                  { newTab: true },
                );
                close();
                a.showToast(
                  t("Copia separata aperta", "Separate copy opened"),
                  "SCAMBIO",
                );
              } catch (e) {
                message(e.message);
              }
            },
            true,
          );
          openCopy.disabled = true;
          btnRow(
            button(
              t("Esporta copia verificabile", "Export verified copy"),
              async () => {
                if (!live()) return;
                try {
                  const packet = await X().create(
                    a.io.buildSerializedProjectPayload(),
                  );
                  if (!live()) return;
                  const data = JSON.stringify(packet);
                  if (data.length > 11 * 1024 * 1024)
                    throw Error(
                      t(
                        "Copia troppo grande per il salvataggio Android (11 MB).",
                        "Copy too large for Android export (11 MB).",
                      ),
                    );
                  a.io.triggerDownload(
                    new Blob([data], { type: "application/json" }),
                    "neuromap-exchange.json",
                  );
                  message(t("Copia esportata", "Copy exported"));
                } catch (e) {
                  message(e.message);
                }
              },
            ),
            openCopy,
          );
          picker.addEventListener("change", async () => {
            pending = null;
            openCopy.disabled = true;
            const file = picker.files?.[0];
            if (!file) return;
            if (file.size > X().MAX_BYTES) {
              message("Max 25 MB");
              return;
            }
            try {
              const comparison = await X().inspect(
                await file.text(),
                a.io.buildSerializedProjectPayload(),
              );
              if (!live()) return;
              report.textContent =
                comparison.status +
                (comparison.differences
                  ? " · " + JSON.stringify(comparison.differences)
                  : "");
              pending = comparison;
              openCopy.disabled = comparison.status === "identical";
              message(
                t("Nessun file è stato sovrascritto.", "No file overwritten."),
              );
            } catch (e) {
              message(e.message);
            }
          });
        } else if (section === "image") {
          note(
            t(
              "Tocca un’immagine per associare un concetto; passa a Quiz per rivelare le etichette. Tutto resta nella mappa.",
              "Tap an image to link a concept; use Quiz to reveal labels. Everything stays in the map.",
            ),
          );
          const images = a.state.images || [],
            imageList = field(t("Immagine", "Image"), "select");
          for (let i = 0; i < images.length; i++) {
            const o = el("option", "", t("Immagine ", "Image ") + (i + 1));
            o.value = images[i].id;
            imageList.append(o);
          }
          const nodes = field(
            t("Nodo da collegare", "Concept to link"),
            "select",
          );
          for (const n of a.state.getAllNodes().slice(0, 1000)) {
            const o = el("option", "", n.text.slice(0, 100));
            o.value = n.id;
            nodes.append(o);
          }
          if (a.state.selectedNodeId) nodes.value = a.state.selectedNodeId;
          const frame = el("div", "nm74-image"),
            img = el("img");
          img.alt = t("Immagine della mappa", "Map image");
          frame.append(img);
          content.append(frame);
          let quiz = false;
          const desc = display("");
          const redraw = () => {
            frame.querySelectorAll("button").forEach((b) => b.remove());
            const entry = a.state.findImage(imageList.value);
            img.hidden = !entry;
            if (!entry) {
              desc.textContent = t(
                "Aggiungi prima un’immagine alla mappa",
                "Add an image to the map first",
              );
              return;
            }
            img.src = entry.src;
            const hotspots = V().normalize(entry.studyHotspots);
            for (let i = 0; i < hotspots.length; i++) {
              const h = hotspots[i],
                b = el("button", "nm74-dot", quiz ? "?" : String(i + 1));
              b.type = "button";
              b.style.left = 100 * h.x + "%";
              b.style.top = 100 * h.y + "%";
              b.setAttribute(
                "aria-label",
                quiz ? t("Rivela punto ", "Reveal point ") + (i + 1) : h.label,
              );
              b.onclick = (e) => {
                e.stopPropagation();
                desc.setAttribute("data-glauka-user-content", "");
                desc.textContent = a.state.findNode(h.nodeId)?.text || h.label;
                if (quiz) b.textContent = String(i + 1);
              };
              frame.append(b);
            }
            desc.textContent =
              hotspots.length + t(" punti collegati", " linked hotspots");
          };
          imageList.addEventListener("change", redraw);
          img.addEventListener("click", (e) => {
            if (!live() || quiz) return;
            const entry = a.state.findImage(imageList.value),
              n = a.state.findNode(nodes.value);
            if (!entry || !n) return;
            try {
              const { x, y } = V().locate(
                img.getBoundingClientRect(),
                e.clientX,
                e.clientY,
              );
              const next = V().add(entry.studyHotspots, {
                x,
                y,
                nodeId: n.id,
                label: n.text,
              });
              a.state.pushHistory();
              entry.studyHotspots = next;
              a.markChanged();
              a.scheduleSave();
              redraw();
            } catch (err) {
              message(err.message);
            }
          });
          btnRow(
            button(t("Passa a Quiz / Modifica", "Toggle Quiz / Edit"), () => {
              quiz = !quiz;
              redraw();
            }),
            button(t("Rimuovi ultimo punto", "Remove last hotspot"), () => {
              if (!live() || quiz) return;
              const entry = a.state.findImage(imageList.value);
              if (!entry) return;
              const set = V().normalize(entry.studyHotspots);
              if (!set.length) return;
              a.state.pushHistory();
              entry.studyHotspots = set.slice(0, -1);
              a.markChanged();
              a.scheduleSave();
              redraw();
            }),
          );
          redraw();
        }
      } catch (error) {
        message(
          t("Funzione non disponibile: ", "Feature unavailable: ") +
            String(error.message || error),
        );
      }
    }
    for (const [id, icon, label] of tabs) {
      const b = el("button", "nm74-tab");
      b.type = "button";
      b.dataset.section = id;
      const glyph = svgGlyph(id, icon),
        name = el("strong", "", label()),
        hint = el("small", "", hints[id]());
      b.append(glyph, name, hint);
      b.setAttribute("aria-selected", "false");
      b.addEventListener("click", async () => {
        if (id === current) {
          showCurrent();
          return;
        }
        if (editorSession?.hasUnsaved?.() || hasCaptureDraft()) {
          const answer = await app()?.nmAsk({
            title: t("Nota non salvata", "Unsaved note"),
            message: t(
              "Scartare le modifiche prima di cambiare sezione?",
              "Discard edits before switching tools?",
            ),
            choices: [
              {
                value: "cancel",
                text: t("Continua a modificare", "Continue editing"),
              },
              { value: "discard", text: t("Scarta", "Discard"), danger: true },
            ],
          });
          if (answer !== "discard") {
            showCurrent();
            return;
          }
        }
        show(id);
      });
      [...nav.children]
        .find((group) => group.dataset.tools.split(" ").includes(id))
        .append(b);
    }
    for (const group of nav.children)
      for (const id of group.dataset.tools.split(" "))
        group.append(group.querySelector('[data-section="' + id + '"]'));
    // Keep the daily actions visible; group the advanced catalogue below.
    const primaryTools=new Set(['capture','documents','sources','cards','dashboard']);
    const experimental=el('details','nm74-experimental');
    const experimentalLabel=el('summary','',t('Sperimentale · altri strumenti','Experimental · more tools'));
    const extra=el('div','nm74-experimental-links');
    const primary=el('section','nm74-primary-tools');
    for(const id of primaryTools)primary.append(nav.querySelector('[data-section="'+id+'"]'));
    for(const group of [...nav.children])extra.append(group);
    experimental.append(experimentalLabel,extra);
    nav.append(primary);
    nav.append(experimental);
    pane.append(header, nav, content, status);
    shade.append(pane);
    document.body.append(shade);
    const localize = () => {
      open.textContent = "✦ " + t("Studio & Strumenti", "Study & Tools");
      open.setAttribute(
        "aria-label",
        t("Apri gli strumenti Glauka", "Open Glauka tools"),
      );
      experimentalLabel.textContent=t('Sperimentale · altri strumenti','Experimental · more tools');
      backTools.textContent = "‹ " + t("Strumenti", "Tools");
      for (const [heading, it, en] of groupLabels)
        heading.textContent = t(it, en);
      title.textContent = nav.hidden
        ? tabs.find((tab) => tab[0] === current)?.[2]()
        : t("Studio e strumenti", "Study and tools");
      exit.setAttribute("aria-label", t("Chiudi", "Close"));
      nav.setAttribute("aria-label", t("Sezioni strumenti", "Tool sections"));
      for (const [id, icon, label] of tabs) {
        const b = nav.querySelector('[data-section="' + id + '"]');
        if (b) {
          b.querySelector("strong").textContent = label();
          b.querySelector("small").textContent = hints[id]();
        }
      }
    };
    new MutationObserver(() => {
      localize();
      // A live language change also refreshes the visible tools content,
      // except when that would discard an unsaved draft or a chosen file.
      const hasFile =
        !!content.querySelector("input[type=file]")?.files?.length;
      if (
        !shade.hidden &&
        nav.hidden &&
        current &&
        !editorSession?.hasUnsaved?.() &&
        !hasCaptureDraft() &&
        !pending &&
        !hasFile
      )
        show(current);
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    const showPanel = () => {
      if (!app()) return;
      localize();
      closeFocus = document.activeElement;
      owner = app().state;
      tabId = app().activeTabId;
      shade.hidden = false;
      showCatalog();
      exit.focus();
    };
    open.addEventListener("click", showPanel);
    exit.addEventListener("click", () => close());
    shade.addEventListener("pointerdown", (e) => {
      if (e.target === shade) close();
    });
    shade.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab") {
        const items = [
          ...pane.querySelectorAll(
            "button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])",
          ),
        ].filter((n) => n.getClientRects().length);
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      e.stopPropagation();
    });
    root.NeuroMapAndroid74 = {
      open: showPanel,
      close,
      show,
      hasPendingLanguageEdits: () =>
        !shade.hidden &&
        (!!editorSession?.hasUnsaved?.() ||
          hasCaptureDraft() ||
          !!pending ||
          !!content.querySelector("input[type=file]")?.files?.length),
    };
  }
  // Deferred scripts run while readyState is interactive, before the app and
  // mobile rail are created by the earlier WINDOW DOMContentLoaded listeners.
  if (document.readyState !== "complete")
    root.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})(globalThis);
