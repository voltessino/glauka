/* Glauka phone/tablet workspace: app navigation and bottom sheets, not desktop menus. */
(function (root) {
  "use strict";
  const tr = (it, en) => root.GlaukaI18n?.pair(it, en) || it;
  const get = (id) => document.getElementById(id);
  const paths = {
    map: "M4 5h6v5H4zM14 14h6v5h-6zM7 10v7h7M10 7h7v7",
    add: "M12 5v14M5 12h14",
    edit: "m5 16 11-11 3 3-11 11H5zM14 7l3 3",
    study:
      "M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 6v14",
    style: "M5 7h14M5 17h14M9 4v6M15 14v6",
    ai: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM19 2v4M17 4h4",
    palette: "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-4-4-6-9-6zM7 9h.01M10 6h.01M15 7h.01",
    interface: "M3 4h18v16H3zM3 9h18M8 9v11M6 6h.01M9 6h.01",
    commands: "M5 6h14M5 12h14M5 18h14M8 3v6M16 9v6M10 15v6",
    language: "M3 5h12M9 3v2M5 8c1 4 4 7 8 9M13 5c-1 6-4 10-9 13M14 21l4-10 4 10M16 17h4",
    redo: "M16 5l5 5-5 5M21 10H11a6 6 0 0 0-6 6",
    focus: "M4 9V4h5M15 4h5v5M4 15v5h5M20 15v5h-5M12 8v8M8 12h8",
    more: "M12 5h.01M12 12h.01M12 19h.01",
    undo: "M8 5 3 10l5 5M3 10h10a6 6 0 0 1 6 6",
    close: "m6 6 12 12M18 6 6 18",
    folder: "M3 7V5h7l2 2h9v12H3z",
    save: "M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 15h10v6",
    share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
    cloud: "M17.5 19a4.5 4.5 0 0 0 .9-8.9A5.5 5.5 0 0 0 7.7 8.4 4 4 0 0 0 6.5 16h11z",
    history: "M12 8v4l3 2M3.05 11a9 9 0 1 1 .5 4M3 16v-5h5",
    image: "M3 4h18v16H3zM3 16l6-6 6 6 3-3 3 3M16 8h.01",
    search: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 6 6",
    export: "M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7",
    copy: "M8 8h12v12H8zM4 16V4h12",
    check: "m5 12 4 4L19 6",
    trash: "M4 7h16M9 7V4h6v3M7 7v13h10V7M10 10v7M14 10v7",
    branch: "M5 3v18M5 9h8l5-5M5 15h8l5 5",
    text: "M4 5h16M12 5v15M8 20h8",
    back: "m14 5-7 7 7 7",
    library: "M3 4h6l2 3h10v13H3zM7 12h4v4H7zM14 11l4 5h-6z",
    symbols: "M7 19H4v-4M4 19l5-5M14 5h6M17 2v6M14 14l6 6M20 14l-6 6",
    formula: "M3 5h12l-7 7 7 7H3M17 10l4 7M21 10l-4 7",
    pen: "m4 17 11-12 4 4L7 21H3zM13 7l4 4M3 21h7",
    archive: "M3 4h18v5H3zM5 9v11h14V9M9 13h6",
    outline: "M4 3h10l5 5v13H4zM14 3v6h5M7 12h3M7 16h3M13 12h3M13 16h3",
    // Compact 24px line illustrations: each view has its own legible silhouette.
    mindmap: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 7l2.5 3M7 17l2.5-3M17 7l-2.5 3M17 17l-2.5-3M3 4h4v4H3zM3 16h4v4H3zM17 4h4v4h-4zM17 16h4v4h-4z",
    orgchart: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
    "concept-tree": "M3 10h5v5H3zM16 3h5v5h-5zM16 16h5v5h-5zM8 12.5h4V5.5h4M12 12.5v6h4",
    "concept-network": "M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM20 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 7l3 4M17 5l-3 6M10 16l-4 3M14 16l4 2M7 7l10-2",
    flowchart: "M2 9h6v6H2zM9 12h0M13 8l4 4-4 4-4-4zM17 12h2M19 9h4v6h-4z",
    kanban: "M2 3h6v18H2zM9 3h6v18H9zM16 3h6v18h-6zM3.5 7h3M10.5 7h3M17.5 7h3M3.5 11h3M10.5 11h3M17.5 11h3M3.5 15h3M17.5 15h3",
    timeline: "M5 3v18M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM9 7h12M9 13h8M9 19h11",
    views: "M4 5h7v7H4zm9 0h7v7h-7zM4 14h7v5H4zm9 3h7v2h-7z",
  };
  const LINKED_VIEWS = [
    ["mindmap", "Mappa mentale", "Mind map"],
    ["orgchart", "Organigramma", "Organization chart"],
    ["concept-tree", "Albero concettuale", "Concept tree"],
    ["concept-network", "Rete concettuale", "Concept network"],
    ["flowchart", "Flusso di lavoro", "Workflow"],
    ["kanban", "Bacheca Kanban", "Kanban board"],
    ["timeline", "Linea del tempo", "Timeline"],
  ];
  const icon = (name) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
    (paths[name] || paths.map) +
    '"/></svg>';
  let layoutPanel;
  let mounted = false,
    sheet,
    content,
    heading,
    previousFocus,
    headerTitle,
    undoButton,
    styleScrim;
  const app = () => root.neuroMapApp;
  function labelButton(name, it, en, action, id) {
    const b = document.createElement("button");
    b.type = "button";
    if (id) b.id = id;
    b.innerHTML = icon(name);
    const span = document.createElement("span");
    span.textContent = tr(it, en);
    b.append(span);
    b.setAttribute("aria-label", span.textContent);
    b.addEventListener("click", action);
    b._glaukaLabel = { it, en };
    return b;
  }
  function refresh() {
    if (!mounted) return;
    const a = app();
    if (a) {
      const text = String(a.state.root?.text || tr("Senza titolo", "Untitled"));
      if (headerTitle.textContent !== text) headerTitle.textContent = text;
      undoButton.disabled = !a.state.undoStack.length;
      // The Views button uses the same large SVG as the active view.
      const chip = get("glauka-views-open");
      if (chip) {
        const currentId = String(a.state.root?.viewMode || "mindmap");
        const symbol = LINKED_VIEWS.some(([id]) => id === currentId)
          ? currentId : "views";
        if (chip.dataset.viewGlyph !== symbol) {
          chip.querySelector("svg")?.remove();
          chip.insertAdjacentHTML("afterbegin", icon(symbol));
          chip.dataset.viewGlyph = symbol;
        }
      }
    }
    for (const b of document.querySelectorAll("[data-glauka-app-label]")) {
      const pair = b._glaukaLabel;
      if (pair) {
        const text = tr(pair.it, pair.en);
        if (b.querySelector("span").textContent !== text)
          b.querySelector("span").textContent = text;
        if (b.getAttribute("aria-label") !== text)
          b.setAttribute("aria-label", text);
      }
    }
  }
  function close() {
    if (!sheet || sheet.hidden) return false;
    sheet.hidden = true;
    get('glauka-add-open')?.setAttribute('aria-expanded','false');
    get('glauka-views-open')?.setAttribute('aria-expanded','false');
    previousFocus?.focus?.({ preventScroll: true });
    return true;
  }
  function hideStyle() {
    const panel = get("inspector-sidebar");
    if (!panel || panel.classList.contains("collapsed")) return false;
    panel.classList.remove("nm-panel-minimized", "nm-panel-compact");
    panel.classList.add("collapsed");
    return true;
  }
  // Linked views call this so sheet/style never sit under the exclusive overlay.
  function dismissChrome() {
    const closedSheet = close();
    const closedStyle = hideStyle();
    const studio = get("nm74-overlay");
    let closedStudio = false;
    if (studio && !studio.hidden) {
      studio.hidden = true;
      closedStudio = true;
    }
    app()?.hideMenus?.();
    return closedSheet || closedStyle || closedStudio;
  }
  function invoke(action) {
    close();
    hideStyle();
    app()?.hideMenus?.();
    try {
      const result = action();
      if (result?.catch)
        result.catch((error) => app()?.showToast(error.message));
    } catch (error) {
      app()?.showToast(error.message);
    }
  }
  function source(id) {
    get(id)?.click();
  }
  function row(name, it, en, action, danger = false) {
    const b = labelButton(name, it, en, () => invoke(action));
    b.className = "glauka-app-action" + (danger ? " danger" : "");
    content.append(b);
    return b;
  }
  function dismissFeedback() {
    root.clearTimeout(app()?.toastTimer);
    get("toast-notification")?.classList.add("hidden");
    get("mobile-feedback")?.remove();
  }
  function open(it, en) {
    content?.classList.remove("glauka-options-menu");
    dismissFeedback();
    hideStyle();
    app()?.hideMenus?.();
    previousFocus = document.activeElement;
    content.replaceChildren();
    sheet._nmExpandPanel?.();
    heading.textContent = tr(it, en);
    get("glauka-add-open")?.setAttribute("aria-expanded", "false");
    get("glauka-views-open")?.setAttribute("aria-expanded", "false");
    sheet.hidden = false;
    requestAnimationFrame(() =>
      get("glauka-sheet-close").focus({ preventScroll: true }),
    );
  }
  function sectionLabel(it, en) {
    const title = document.createElement("h3");
    title.className = "glauka-app-section-title";
    title.textContent = tr(it, en);
    content.append(title);
  }
  function add() {
    open("Aggiungi alla mappa", "Add to map");
    get("glauka-add-open")?.setAttribute("aria-expanded", "true");
    sectionLabel("Rami", "Branches");
    row("branch", "Ramo figlio", "Child branch", () => app().addChild());
    row("branch", "Ramo allo stesso livello", "Sibling branch", () =>
      app().addSibling(),
    );
    sectionLabel("Immagini e simboli", "Images and symbols");
    row("image", "Immagine da file", "Image from file", () =>
      get("node-image-input")?.click(),
    );
    row("library", "Disegni e simboli", "Drawings and symbols", () =>
      source("nm62-toolbar-assets"),
    );
    row("symbols", "Lettere e simboli", "Letters and symbols", () =>
      source("nm-insert-symbols"),
    );
    row("formula", "Formula matematica", "Math formula", () =>
      source("nm-insert-formula"),
    );
    row("pen", "Disegna a mano libera", "Draw freehand", () =>
      source("nm-drawing-open"),
    );
    row("archive", "Disegni salvati", "Saved drawings", () =>
      source("nm-creative-library"),
    );
    sectionLabel("Dai tuoi appunti", "From your notes");
    const note = document.createElement("p");
    note.className = "glauka-app-note";
    note.textContent = tr(
      "Il testo conserva righe e titoli. Con AI puoi ricavare e riassumere i concetti.",
      "Text import keeps lines and headings. AI can extract and summarize concepts.",
    );
    content.append(note);
    row("outline", "Crea una mappa dal testo", "Create a map from text", () =>
      document.querySelector(".nm-android-text-action")?.click(),
    );
    row(
      "ai",
      "Crea e riassumi con AI",
      "Create and summarize with AI",
      () => {
        app().openAIStudio();
        app().aiStudio.chooseTask("text");
      },
    );
  }
  function exports() {
    open("Esporta la mappa", "Export map");
    // Android auto-backup is deliberately disabled to avoid uploading private maps
    // and AI secrets. Make the manual transfer path unmistakable.
    const reminder=document.createElement("p");
    reminder.className="glauka-backup-hint";
    reminder.textContent=tr(
      "Prima di disinstallare o cambiare telefono, salva un backup completo in una cartella sicura.",
      "Before uninstalling or switching phones, save a complete backup in a safe folder."
    );
    content.append(reminder);
    row("share", "Condividi o trasferisci (PC / Drive / HTML)…", "Share or transfer (PC / Drive / HTML)…", () => app()._nmMapShare?.open?.());
    row("image", "Immagine PNG", "PNG image", () => app().io.exportPNG());
    row("image", "Immagine SVG", "SVG image", () => app().io.exportSVG());
    row("text", "Documento Markdown", "Markdown document", () =>
      app().io.exportMarkdown(),
    );
    row("save", "Progetto JSON", "JSON project", () => app().io.exportJSON());
    row("copy", "Backup completo (prima di reinstallare)", "Full backup (before reinstalling)", () =>
      app().io.exportBatchWorkspaceJSON(),
    );
  }
  function formatRecentAge(ts) {
    const diff = Math.max(0, Date.now() - (Number(ts) || 0));
    if (diff < 60000) return tr("adesso", "just now");
    if (diff < 3600000) return Math.round(diff / 60000) + " min";
    if (diff < 86400000) return Math.round(diff / 3600000) + " h";
    try {
      return new Date(ts).toLocaleDateString(document.documentElement.lang === "en" ? "en-GB" : "it-IT", { day: "2-digit", month: "short" });
    } catch { return ""; }
  }
  function projects() {
    open("I tuoi progetti", "Your projects");
    const activeTab = app()?.tabs?.find((t) => t.id === app().activeTabId);
    const hasLinkedFile = !!(activeTab?.androidDocId && activeTab?.androidDocWritable);
    row("add", "Nuovo progetto", "New project", () => app().createNewTab());
    row("cloud", "Apri da Google Drive / File…", "Open from Google Drive / Files…", () =>
      root.NeuroMapLifecycle?.androidOpenProject
        ? root.NeuroMapLifecycle.androidOpenProject(null)
        : source("btn-import-files-new-tabs"),
    );
    row(
      "save",
      hasLinkedFile ? "Salva su Drive / File collegato" : "Salva il progetto",
      hasLinkedFile ? "Save to linked Drive / File" : "Save project",
      () => app().saveToFile(false),
    );
    if (hasLinkedFile) {
      row("copy", "Salva copia con nome…", "Save a copy as…", () => app().saveToFile(true));
    }
    row("share", "Condividi o trasferisci mappa…", "Share or transfer map…", () => app()._nmMapShare?.open?.());
    const recents = root.NeuroMapLifecycle?.recentAndroidFiles?.() || [];
    if (recents.length) {
      sectionLabel("File recenti (Drive / Dispositivo)", "Recent files (Drive / Device)");
      for (const item of recents.slice(0, 10)) {
        const b = labelButton(
          item.persistent || item.writable ? "cloud" : "history",
          item.name,
          item.name,
          () =>
            invoke(() =>
              item.docId && root.NeuroMapLifecycle?.androidOpenProject
                ? root.NeuroMapLifecycle.androidOpenProject(item.docId)
                : source("btn-import-files-new-tabs"),
            ),
        );
        b.className = "glauka-app-action glauka-recent-file";
        const meta = document.createElement("small");
        meta.className = "glauka-recent-meta";
        const badge = item.persistent ? "Drive / SAF" : tr("Locale", "Local");
        const age = formatRecentAge(item.updatedAt);
        meta.textContent = age ? badge + " · " + age : badge;
        b.append(meta);
        content.append(b);
      }
    }
    sectionLabel("Schede aperte", "Open maps");
    for (const tab of app().tabs) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "glauka-app-project";
      b.innerHTML = icon(tab.id === app().activeTabId ? "check" : tab.androidDocWritable ? "cloud" : "map");
      const title = document.createElement("span");
      title.setAttribute("data-glauka-user-content", "");
      title.textContent = tab.state.root?.text || tab.title;
      b.append(title);
      b.setAttribute("aria-current", String(tab.id === app().activeTabId));
      b.onclick = () => invoke(() => app().activateTab(tab.id));
      content.append(b);
    }
  }
  function layout() {
    open("Disposizione dei rami", "Branch arrangement");
    if (layoutPanel) {
      layoutPanel.classList.remove("hidden");
      content.append(layoutPanel);
      app().updateStatus();
    }
  }
  function focusSelected() {
    const a=app();
    const node=a?.state?.findNode?.(a.state.selectedNodeId) || a?.state?.root;
    const metric=node && a.layout?.getLayout?.(node.id);
    if(!metric){a?.fitToScreen?.();return;}
    const zoom=Math.min(1.6,Math.max(0.9,a.renderer.camera.zoom));
    const top=get('glauka-app-header')?.getBoundingClientRect().bottom ?? 0;
    const bottom=get('glauka-app-dock')?.getBoundingClientRect().top ?? innerHeight;
    const middle=bottom>top+160?(top+bottom)/2:innerHeight/2;
    a.renderer.camera.zoom=zoom;
    a.renderer.camera.x=innerWidth/2-metric.x*zoom;
    a.renderer.camera.y=middle-metric.y*zoom;
    a.updateStatus();
    a.requestRender();
    a.positionEditor?.();
  }
  function openLinkedViews() {
    open("Viste", "Views");
    content.classList.add("glauka-options-menu");
    get("glauka-views-open")?.setAttribute("aria-expanded", "true");
    for (const [id, it, en] of LINKED_VIEWS) {
      const choice = row(id, it, en, () => {
        const current = app();
        if (!current || !root.NeuroMapLinkedViews?.setMode) return;
        root.NeuroMapLinkedViews.setMode(current, id);
        refresh();
      });
      choice.classList.add("glauka-linked-view-action");
      if (String(app()?.state?.root?.viewMode || "mindmap") === id)
        choice.setAttribute("aria-current", "true");
    }
  }
  function more() {
    open("Opzioni", "Options");
    content.classList.add("glauka-options-menu");
    sectionLabel("Mappa", "Map");
    row("palette", "Aspetto della mappa", "Map appearance", () => source("btn-toggle-inspector"));
    row("branch", "Disposizione dei rami", "Branch arrangement", layout);
    row("focus", "Centra e ingrandisci il concetto", "Center and zoom to concept", focusSelected);
    sectionLabel("Viste", "Views");
    for (const [id, it, en] of LINKED_VIEWS) {
      const choice = row(id, it, en, () => {
        const current = app();
        if (!current || !root.NeuroMapLinkedViews?.setMode) return;
        root.NeuroMapLinkedViews.setMode(current, id);
        refresh();
      });
      choice.classList.add("glauka-linked-view-action");
      if (String(app()?.state?.root?.viewMode || "mindmap") === id)
        choice.setAttribute("aria-current", "true");
    }
    sectionLabel("Progetto", "Project");
    row("cloud", "Apri da Google Drive / File…", "Open from Google Drive / Files…", () =>
      root.NeuroMapLifecycle?.androidOpenProject
        ? root.NeuroMapLifecycle.androidOpenProject(null)
        : source("btn-import-files-new-tabs"),
    );
    row("save", "Salva il progetto", "Save project", () => app().saveToFile());
    row("share", "Condividi o trasferisci mappa…", "Share or transfer map…", () => app()._nmMapShare?.open?.());
    row("export", "Esporta e condividi", "Export and share", exports);
    row("copy", "Duplica il progetto", "Duplicate project", () => app().duplicateTab());
    sectionLabel("Strumenti", "Tools");
    row("ai", "Assistente AI", "AI assistant", () => app().openAIStudio());
    row("search", "Cerca nella mappa", "Search map", () =>
      source("btn-spotlight"),
    );
    row("commands", "Tutti i comandi", "All commands", () =>
      source("nm-android-command-open"),
    );
    row("redo", "Ripeti", "Redo", () => source("menu-redo"));
    sectionLabel("Impostazioni", "Settings");
    row("options", "Impostazioni complete…", "All settings…", () => root.NeuroMapSettingsCenter?.open?.());
    row("interface", "Aspetto dell’interfaccia", "Interface appearance", () => root.GlaukaAndroidStylePanel?.openInterface());
    row("language", "Lingua e impostazioni", "Language and settings", () => {
      source("nm74-launch");
      get("glauka-android-language")?.focus();
    });
    row("check", "Free / Pro", "Free / Pro", () =>
      source("nm6-plan-button"),
    );
  }
  function nodeAt(x, y) {
    const a = app(),
      hit = a?.findHit(x, y);
    if (hit?.type === "image" || hit?.type === "image-handle") {
      a.selectImage(hit.item.id);
      open("Immagine", "Image");
      row(
        "trash",
        "Rimuovi immagine",
        "Remove image",
        () => a.deleteSelected(),
        true,
      );
      return;
    }
    if (hit?.type === "node") a.selectNode(hit.item.id);
    open("Azioni del ramo", "Branch actions");
    row("edit", "Modifica testo", "Edit text", () => a.editSelected());
    sectionLabel("Rami", "Branches");
    row("branch", "Ramo figlio", "Child branch", () => a.addChild());
    row("branch", "Ramo allo stesso livello", "Sibling branch", () =>
      a.addSibling(),
    );
    row("copy", "Copia", "Copy", () => source("menu-copy"));
    row("style", "Testo e stile", "Text and style", () =>
      root.GlaukaAndroidStylePanel?.openNode(),
    );
    row(
      "trash",
      "Elimina ramo",
      "Delete branch",
      () => a.deleteSelected(),
      true,
    );
  }
  function back() {
    const shareModal = get("nm-map-share");
    if (shareModal && !shareModal.hidden) {
      shareModal.querySelector(".nm-share-close")?.click();
      return true;
    }
    if(get("gl-android-style-overlay")){root.GlaukaAndroidStylePanel?.close();return true;}
    const linked = get("nm-view-overlay");
    if (linked && !linked.hidden && root.NeuroMapLinkedViews?.setMode && app()) {
      root.NeuroMapLinkedViews.setMode(app(), "mindmap");
      return true;
    }
    if (close() || hideStyle()) return true;
    const preview = get("nm-android-root-preview");
    if (preview) {
      preview.querySelector('[data-action="cancel"]')?.click();
      return true;
    }
    const importer = get("nm-android-import-modal");
    if (importer && !importer.classList.contains("hidden")) {
      get("nm-android-cancel")?.click();
      return true;
    }
    const find = get("find-overlay");
    if (find && !find.classList.contains("hidden")) {
      source("find-close");
      return true;
    }
    return false;
  }
  async function mount() {
    if (root.GlaukaAppReady) await root.GlaukaAppReady;
    if (mounted || !app()) return;
    // Existing modules create their launchers after the shared app promise.
    const study = get("nm74-launch");
    if (!study) {
      requestAnimationFrame(mount);
      return;
    }
    layoutPanel = document.querySelector(".hud-bottom-left");
    mounted = true;
    document.body.classList.add("glauka-mobile-app");
    const header = document.createElement("header");
    header.id = "glauka-app-header";
    const project = labelButton(
      "map",
      "Progetti",
      "Projects",
      projects,
      "glauka-projects-open",
    );
    project.className = "glauka-project-switch";
    if (root.GlaukaBrand?.svg)
      project.querySelector("svg").outerHTML = root.GlaukaBrand.svg;
    headerTitle = document.createElement("strong");
    headerTitle.setAttribute("data-glauka-user-content", "");
    project.append(headerTitle);
    undoButton = labelButton(
      "undo",
      "Annulla",
      "Undo",
      () => source("menu-undo"),
      "glauka-undo",
    );
    undoButton.className = "glauka-icon-button";
    const options = labelButton(
      "more",
      "Opzioni",
      "Options",
      more,
      "glauka-options-open",
    );
    options.className = "glauka-icon-button";
    const aiButton=labelButton("ai","AI","AI",()=>app().openAIStudio(),"glauka-ai-open");
    aiButton.className="glauka-header-ai";
    header.append(project, aiButton, undoButton, options);
    const dock = document.createElement("nav");
    dock.id = "glauka-app-dock";
    dock.setAttribute(
      "aria-label",
      tr("Navigazione principale", "Main navigation"),
    );
    const fit = labelButton(
      "map",
      "Mappa",
      "Map",
      () => app().fitToScreen(),
      "glauka-map-fit",
    );
    const plus = labelButton("add", "Aggiungi", "Add", add, "glauka-add-open");
    plus.setAttribute("aria-controls", "glauka-app-sheet");
    plus.setAttribute("aria-expanded", "false");
    const edit = labelButton(
      "edit",
      "Modifica",
      "Edit",
      () => app().editSelected(),
      "glauka-edit",
    );
    study.className = "glauka-study-tab";
    study.addEventListener("click", dismissFeedback, true);
    const localizeStudy = () => {
      study.innerHTML =
        icon("study") + "<span>" + tr("Studio", "Study") + "</span>";
      study.setAttribute(
        "aria-label",
        tr("Studio e strumenti", "Study and tools"),
      );
    };
    new MutationObserver(() => {
      if (!study.querySelector("svg")) localizeStudy();
    }).observe(study, { childList: true });
    localizeStudy();
    const style = labelButton(
      "style",
      "Stile",
      "Style",
      () => source("btn-toggle-inspector"),
      "glauka-style-open",
    );
    dock.append(fit, plus, edit, study, style);
    const views = labelButton(
      "views",
      "Viste",
      "Views",
      openLinkedViews,
      "glauka-views-open",
    );
    views.className = "glauka-views-chip";
    views.setAttribute("aria-controls", "glauka-app-sheet");
    views.setAttribute("aria-expanded", "false");
    for (const b of [project, undoButton, options, fit, plus, edit, style, views])
      b.setAttribute("data-glauka-app-label", "");
    sheet = document.createElement("div");
    sheet.id = "glauka-app-sheet";
    sheet.hidden = true;
    const panel = document.createElement("section");
    panel.className = "glauka-sheet-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "glauka-sheet-title");
    const handle = document.createElement("div");
    handle.className = "glauka-sheet-handle";
    handle.setAttribute("aria-hidden", "true");
    const head = document.createElement("header");
    heading = document.createElement("h2");
    heading.id = "glauka-sheet-title";
    const exit = labelButton(
      "close",
      "Chiudi",
      "Close",
      close,
      "glauka-sheet-close",
    );
    exit.className = "glauka-icon-button";
    head.append(heading, exit);
    content = document.createElement("div");
    content.id = "glauka-sheet-content";
    panel.append(handle, head, content);
    sheet.append(panel);
    root.NeuroMapCreativeModules?.ui.makeCollapsible(sheet,panel,head);
    sheet.addEventListener("pointerdown", (e) => {
      if (e.target === sheet) close();
    });
    sheet.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
      if (e.key === "Tab") {
        const items = [...panel.querySelectorAll("button:not([disabled])")];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && i === items.length - 1) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    });
    styleScrim = document.createElement("div");
    styleScrim.id = "glauka-style-scrim";
    styleScrim.hidden = true;
    styleScrim.onclick = hideStyle;
    const inspector = get("inspector-sidebar");
    if (inspector) {
      const sync = () => {
        const active = !inspector.classList.contains("collapsed");
        styleScrim.hidden = !active || inspector.classList.contains("nm-panel-minimized");
        style.setAttribute("aria-expanded", String(active));
      };
      new MutationObserver(sync).observe(inspector, {
        attributes: true,
        attributeFilter: ["class"],
      });
      sync();
    }
    document.body.append(header, dock, views, sheet, styleScrim);
    const aiScrim = document.createElement("div");
    aiScrim.id = "glauka-ai-scrim";
    aiScrim.hidden = true;
    const hideAi = () => {
      get("nm-ai-studio")?.classList.add("hidden");
      get("ai-explain-panel")?.classList.add("hidden");
      syncAiScrim();
    };
    aiScrim.onclick = hideAi;
    const observedAi = new WeakSet();
    let syncQueued = false;
    const syncAiScrimNow = () => {
      const studio = get("nm-ai-studio");
      const explain = get("ai-explain-panel");
      if (studio && (studio.classList.contains("minimized") || studio.classList.contains("nm-panel-compact"))) {
        studio.classList.remove("minimized", "nm-panel-compact");
      }
      const active =
        (studio && !studio.classList.contains("hidden")) ||
        (explain && !explain.classList.contains("hidden"));
      aiScrim.hidden = !active;
      const expanded = String(!!(studio && !studio.classList.contains("hidden")));
      if (aiButton.getAttribute("aria-expanded") !== expanded) {
        aiButton.setAttribute("aria-expanded", expanded);
      }
    };
    const syncAiScrim = () => {
      if (syncQueued) return;
      syncQueued = true;
      queueMicrotask(() => {
        syncQueued = false;
        syncAiScrimNow();
      });
    };
    const observeAiElement = (id) => {
      const el = get(id);
      if (!el || observedAi.has(el)) return !!el;
      observedAi.add(el);
      new MutationObserver(syncAiScrim).observe(el, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return true;
    };
    document.body.append(aiScrim);
    observeAiElement("ai-explain-panel");
    observeAiElement("nm-ai-studio");
    syncAiScrimNow();
    aiButton.addEventListener("click", () => {
      observeAiElement("nm-ai-studio");
      syncAiScrim();
    });
    document.addEventListener("glauka:ai-panel-change", () => {
      observeAiElement("nm-ai-studio");
      syncAiScrim();
    });
    // Linked-view chrome may have mounted before the shell header existed.
    root.NeuroMapLinkedViews?.refresh?.(app());
    const oldStatus = app().updateStatus;
    app().updateStatus = function (...args) {
      const result = oldStatus.apply(this, args);
      refresh();
      return result;
    };
    root.addEventListener("glauka:language-change", () => {
      refresh();
      localizeStudy();
    });
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && e.target?.id !== "nm-boundary-title-input" && back()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    document.addEventListener(
      "contextmenu",
      (e) => {
        if (e.target === get("mindmap-canvas")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          nodeAt(e.clientX, e.clientY);
        }
      },
      true,
    );
    // Resize modal bounds to the visible viewport, including an explicitly opened IME.
    let viewportFrame = 0,
      baselineHeight = innerHeight,
      baselineWidth = innerWidth;
    const syncViewport = () => {
      viewportFrame = 0;
      const viewport = root.visualViewport;
      if (Math.abs(innerWidth - baselineWidth) > 80) {
        baselineWidth = innerWidth;
        baselineHeight = innerHeight;
      }
      baselineHeight = Math.max(baselineHeight, innerHeight);
      const height = viewport?.height || innerHeight,
        top = viewport?.offsetTop || 0;
      document.documentElement.style.setProperty(
        "--glauka-visible-height",
        height + "px",
      );
      document.documentElement.style.setProperty(
        "--glauka-visible-top",
        top + "px",
      );
      const editing = document.activeElement?.matches(
        "input,textarea,[contenteditable=true]",
      );
      document.body.classList.toggle(
        "glauka-keyboard-open",
        !!editing && baselineHeight - height > 120,
      );
    };
    const queueViewport = () => {
      if (!viewportFrame) viewportFrame = requestAnimationFrame(syncViewport);
    };
    root.visualViewport?.addEventListener("resize", queueViewport);
    root.visualViewport?.addEventListener("scroll", queueViewport);
    root.addEventListener("resize", queueViewport);
    document.addEventListener("focusin", queueViewport);
    document.addEventListener("focusout", queueViewport);
    syncViewport();
    const toolbar = get("nm-settings-style");
    if (toolbar && !toolbar.closest(".glauka-scope-options")) {
      const fold = document.createElement("details");
      fold.className = "glauka-scope-options";
      const summary = document.createElement("summary");
      summary.setAttribute(
        "aria-label",
        tr("Ambito e preferenze", "Scope and defaults"),
      );
      const scopeLabel = document.createElement("span");
      summary.append(scopeLabel);
      fold.append(summary);
      toolbar.before(fold);
      fold.append(toolbar);
      const syncScope = () => {
        scopeLabel.textContent = [
          get("nm-settings-scope-style"),
          get("nm-format-target"),
        ]
          .map((select) => select?.selectedOptions[0]?.textContent)
          .filter(Boolean)
          .join(" · ");
        summary.setAttribute(
          "aria-label",
          tr("Ambito e preferenze", "Scope and defaults"),
        );
      };
      toolbar.addEventListener("change", syncScope);
      root.addEventListener("glauka:language-change", syncScope);
      syncScope();
    }
    // Every legacy native popup has an app-sheet presentation, including search.
    get("toast-notification")?.setAttribute("role", "status");
    get("toast-notification")?.setAttribute("aria-live", "polite");
    get("file-import-input")?.addEventListener("change", (ev) => {
      const files = ev.target?.files;
      if (files?.length && root.NeuroMapLifecycle?.recordAndroidRecent) {
        for (const f of files) {
          if (f?.name) root.NeuroMapLifecycle.recordAndroidRecent({ name: f.name, docId: null, writable: false, persistent: false });
        }
      }
    });
    app().hideMenus();
    refresh();
  }
  root.GlaukaMobileShell = Object.freeze({
    mount,
    back,
    nodeAt,
    add,
    projects,
    more,
    dismissChrome,
  });
  if (document.readyState === "loading")
    root.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})(globalThis);
