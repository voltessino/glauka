/* Organize existing commands by task; keep the original elements and handlers. */
(function (root) {
  "use strict";
  const groups = [
    [
      "write",
      "✎",
      "Scrivi e importa",
      "Write and import",
      [
        "nm-tool-document",
        "nm-tool-outline",
        "nm-tool-sources",
        "nm-ocr-launch",
        "nm-capture-open",
      ],
    ],
    [
      "study",
      "◇",
      "Studia e ripassa",
      "Study and review",
      [
        "nm-tool-studio-panel",
        "btn-flashcards",
        "nm-tool-visual-study",
        "nm-tool-memory",
        "nm-tool-journey",
        "nm616-compare-open",
        "nm-tool-anki",
      ],
    ],
    [
      "organize",
      "▤",
      "Organizza e collega",
      "Organize and connect",
      [
        "nm-tool-atlas",
        "nm-tool-links",
        "nm-tool-database",
        "nm-tool-dashboard",
        "nm-tool-quality",
        "nm-exchange-open",
      ],
    ],
  ];
  const labels = {
    ocr: [
      "nm-ocr-launch",
      "Leggi testo dalle scansioni",
      "Read scanned pages",
      "Estrai il testo da PDF scansionati, rivedilo e aggiungilo alla mappa.",
      "Extract text from scanned PDFs, review it and add it to your map.",
    ],
    studio: [
      "nm-tool-studio-panel",
      "Pannello Studio a destra",
      "Right-side Study panel",
      "Ripeti a memoria, Quiz, Da ripassare, Piano d’esame e strumenti collegati.",
      "Recall concepts, Quiz, Review mistakes, Exam plan and linked study tools.",
    ],
    flashcards: [
      "btn-flashcards",
      "Flashcard",
      "Flashcards",
      "Crea flashcard manuali o AI, sfoglia il passato e ripassa con SM-2.",
      "Create manual or AI flashcards, browse past decks and review with SM-2.",
    ],
    visual: [
      "nm-tool-visual-study",
      "Ripassa sulle immagini",
      "Study with images",
      "Quiz sui punti di un’immagine · salva gli errori in Studio → Da ripassare.",
      "Quiz image hotspots · logs mistakes into Study → Review mistakes.",
    ],
    anki: [
      "nm-tool-anki",
      "Scambia domande con Anki",
      "Exchange cards with Anki",
      "Importa o esporta i tuoi mazzi di flashcard in formato TSV.",
      "Import or export flashcard decks in TSV format.",
    ],
    illustrations: [
      "btn-illustrate",
      "Cerca un’illustrazione online",
      "Find an illustration online",
      "Cerca un’icona online da associare al concetto selezionato.",
      "Search online for an icon to attach to the selected concept.",
    ],
    markers: [
      "nm62-toolbar-assets",
      "Simboli",
      "Symbols",
      "Aggiungi priorità, numeri e simboli al nodo selezionato.",
      "Add priorities, numbers and symbols to the selected node.",
    ],
    compare: [
      "nm616-compare-open",
      "Confronta due rami",
      "Compare two branches",
      "Affianca i concetti di due rami e trova le voci in comune.",
      "Show two branches side by side and find shared labels.",
    ],
    outline: [
      "nm-tool-outline",
      "Organizza i rami",
      "Organize branches",
      "Rinomina e riordina i concetti in un elenco.",
      "Rename and reorder concepts in a list.",
      "Una mappa grande è difficile da sistemare? Lavora sui rami come sulle voci di un indice.",
      "Hard to arrange a large map? Work with branches like entries in an outline.",
    ],
    atlas: [
      "nm-tool-atlas",
      "Cerca nelle mappe",
      "Search across maps",
      "Ritrova un concetto e collegalo ad altre mappe.",
      "Find a concept and link it to other maps.",
      "Cerchi dove hai già studiato «fegato»? Cerca nelle schede aperte e nelle mappe già indicizzate.",
      "Where did you study “liver”? Search open tabs and previously indexed maps.",
    ],
    journey: [
      "nm-tool-journey",
      "Leggi passo passo",
      "Read step by step",
      "Un concetto alla volta, con i suoi appunti.",
      "One concept at a time, together with its notes.",
      "Per preparare una spiegazione orale, scorri i concetti nell’ordine della mappa. Non è un quiz.",
      "To prepare an oral explanation, read concepts in map order. This is not a quiz.",
    ],
    radar: [
      "nm-tool-memory",
      "Scadenze dei ripassi",
      "Review schedule",
      "Calendario completo delle flashcard · collegato a Studio → Da ripassare.",
      "Full flashcard calendar · linked with Study → Review mistakes.",
      "Hai già usato le flashcard? Qui ritrovi cosa ripassare. Senza ripassi registrati non misura la preparazione.",
      "Already using flashcards? Find what is due here. Without recorded reviews it cannot assess your preparation.",
    ],
    sources: [
      "nm-tool-sources",
      "Consulta le fonti",
      "Consult sources",
      "Ritrova i PDF e i link associati ai concetti.",
      "Find PDFs and links attached to concepts.",
      "Vuoi verificare un concetto? Seleziona il nodo e ritrova il documento da cui proviene.",
      "Want to verify a concept? Select its node and find the document it came from.",
    ],
    document: [
      "nm-tool-document",
      "Scrivi appunti",
      "Write notes",
      "Aggiungi spiegazioni ai nodi senza allungare i titoli.",
      "Add explanations to nodes without long map labels.",
      "Lascia «Ittero» sulla mappa e scrivi definizione ed esempi negli appunti dello stesso nodo.",
      "Keep “Jaundice” on the map and write its definition and examples in the same node’s notes.",
    ],
    links: [
      "nm-tool-links",
      "Collega note e concetti",
      "Link notes and concepts",
      "Crea rimandi tra le note dei nodi.",
      "Create references between node notes.",
    ],
    database: [
      "nm-tool-database",
      "Organizza con tag e campi",
      "Organize with tags and fields",
      "Classifica i concetti e ritrovali con i filtri.",
      "Classify concepts and find them with filters.",
    ],
    dashboard: [
      "nm-tool-dashboard",
      "Riepilogo delle mappe",
      "Map overview",
      "Consulta attività e dati delle mappe aperte.",
      "View activity and data from open maps.",
    ],
    quality: [
      "nm-tool-quality",
      "Controlla la mappa",
      "Check your map",
      "Trova problemi nei dati e nei collegamenti.",
      "Find problems in data and references.",
    ],
  };
  const tr = (it, en) => (globalThis.GlaukaI18n?.pair(it,en) ?? ((document.documentElement.lang === "en" ? en : it)));
  const menuIcons = {
    add: "M12 4v16M4 12h16",
    file: "M5 3h9l5 5v13H5zM14 3v6h5",
    open: "M3 6h7l2 3h9l-3 11H3z",
    export: "M12 3v12M8 11l4 4 4-4M5 21h14",
    cloud: "M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 7 18",
    gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 12H2M22 12h-2M12 4V2M12 22v-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18",
    save: "M4 3h14l3 3v15H3V3zM7 3v7h10V3M7 21v-7h10v7",
    back: "M9 6 3 12l6 6M3 12h11a6 6 0 0 1 6 6",
    forward: "M15 6l6 6-6 6M21 12H10a6 6 0 0 0-6 6",
    delete: "M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 11v6M14 11v6",
    text: "M4 5h16M12 5v15M8 20h8",
    tree: "M12 3v7M4 10h16M4 10v10M12 10v10M20 10v10",
    picture: "M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M8 7h.1",
    spark: "M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    info: "M12 11v6M12 7h.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    keyboard:
      "M2 5h20v14H2zM6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 13h.1M10 13h.1M14 13h.1M18 13h.1M7 16h10",
    book: "M3 3h7l2 3 2-3h7v17h-7l-2 2-2-2H3zM12 6v16",
    key: "M14 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8M11 13l-8 8M5 19l-2-2M8 16l-2-2",
    copy: "M8 8h13v13H8zM3 16V3h13",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    clock: "M12 7v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    illustrationSearch:
      "M3 3h14v11M3 3v16h8M3 14l5-5 4 4M21 21l-4-4M19 14a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
    wand: "M3 21 16 8l3 3L6 24M15 3v4M21 5l-3 3M21 12h3M6 3v4M4 5h4",
    symbol: "M5 20h5v-4a7 7 0 1 1 4 0v4h5",
    formula: "M19 4H5l8 8-8 8h14M18 9h4M20 7v4",
    pen: "M4 20l1-5L17 3l4 4L9 19zM14 6l4 4M3 22h18",
    library: "M3 4h4v17H3zM10 4h4v17h-4zM16 5l4-1 4 16-4 1z",
    photoAdd: "M3 4h14v16H3zM3 16l5-5 6 6M8 8h.1M20 2v8M16 6h8",
  };
/* @neuromap-workspace-tools-curate */
  function install(App) {
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const out = bind.apply(this, args);
      curate();
      const fit = () => {
        const menu = document.getElementById("dropdown-tools");
        if (menu && !menu.classList.contains("hidden"))
          menu.style.maxHeight =
            Math.max(60, innerHeight - menu.getBoundingClientRect().top - 12) +
            "px";
      };
      document
        .getElementById("btn-menu-tools")
        ?.addEventListener("click", () => requestAnimationFrame(fit));
      root.addEventListener("resize", fit);
      let queued = false;
      const refresh = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          curate();
        });
      };
      for (const id of [
        "dropdown-view",
        "dropdown-tools",
        "dropdown-file",
        "dropdown-edit",
        "dropdown-insert",
        "dropdown-help",
      ]) {
        const menu = document.getElementById(id);
        if (menu)
          new MutationObserver(refresh).observe(menu, {
            childList: true,
            subtree: true,
          });
      }
      root.NeuroMapWorkspaceLocale?.watch(refresh);
      return out;
    };
  }
  root.NeuroMapWorkspaceTools = { install, curate, labels };
})(globalThis);
