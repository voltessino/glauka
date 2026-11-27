/* Shared theme-aware Export Studio UI. One file-menu entry, three selection scopes. */
(function (host) {
  "use strict";
  const Core = host.NeuroMapExportCore;
  if (!Core) return;
  const phrases = new Map();
  const t = (it, en) => {
    phrases.set(it, [it, en]);
    phrases.set(en, [it, en]);
    return host.GlaukaI18n?.pair(it,en)??(document.documentElement.lang === "en" ? en : it);
  };
  const translated = (text) => {
    const pair = phrases.get(text);
    return pair ? t(...pair) : text;
  };
  const el = (tag, cls, label) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (label !== undefined) n.textContent = label;
    return n;
  };
  function install() {
    const app = host.neuroMapApp,
      menu = document.getElementById("dropdown-file");
    if (!app || !menu || app._nmExportHub) return;
    const css = el("style");
    css.id = "nm-export-hub-style";
    css.textContent = /* @neuromap-export-css */ "";
    document.head.append(css);
    const shade = el("div", "nm-export-shade");
    shade.hidden = true;
    const panel = el("section", "nm-export-dialog");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "nm-export-title");
    const head = el("header", "nm-export-heading"),
      logo = el("div", "nm-export-logo", "⇧"),
      heads = el("div"),
      title = el("h2", null, t("Esporta il progetto", "Export your project")),
      subtitle = el(
        "p",
        null,
        t("Un’unica finestra, tutti i formati.", "One place for all formats."),
      ),
      close = el("button", "nm-export-close", "×");
    title.id = "nm-export-title";
    heads.append(title, subtitle);
    close.type = "button";
    close.setAttribute("aria-label", t("Chiudi", "Close"));
    head.append(logo, heads, close);
    const scopeGroup = el("div", "nm-export-group"),
      scopeLabel = el(
        "span",
        "nm-export-label",
        t("Quali schede?", "Which maps?"),
      ),
      segments = el("div", "nm-export-segments");
    const scopes = new Map();
    let scope = "current",
      separate = false,
      userSeparate = false,
      splitMode = "single",
      densityPreset = "balanced",
      numberingEnabled = false,
      numberingTouched = false,
      deliveryMode =
        host.neuromapDesktop?.saveExportFolder ||
        typeof host.showDirectoryPicker === "function"
          ? "folder"
          : "zip",
      selectedIds = new Set(),
      busy = false,
      oldFocus = null,
      lastError = "";
    segments.setAttribute("role", "group");
    segments.setAttribute("aria-label", scopeLabel.textContent);
    for (const [id, label] of [
      ["current", t("Questa", "Current")],
      ["selected", t("Selezionate", "Selected")],
      ["all", t("Tutte", "All")],
    ]) {
      const button = el("button", null, label);
      button.type = "button";
      scopes.set(id, button);
      segments.append(button);
      button.addEventListener("click", () => {
        scope = id;
        if (scope === "selected" && !selectedIds.size)
          selectedIds.add(app.activeTabId);
        drawTabs();
        update();
      });
    }
    const tabs = el("div", "nm-export-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", t("Scegli le schede", "Choose maps"));
    scopeGroup.append(scopeLabel, segments, tabs);
    const formatGroup = el("div", "nm-export-group"),
      formatLabel = el("label", "nm-export-label", t("Formato", "Format")),
      format = el("select", "nm-export-select");
    format.id = "nm-export-format";
    formatLabel.htmlFor = format.id;
    for (const [value, label] of [
      ["md", "Markdown · .md"],
      ["txt", t("Testo · .txt", "Text · .txt")],
      ["opml", "OPML · .opml"],
      ["mm", "FreeMind / Freeplane · .mm"],
      ["html", "HTML · .html"],
      ["docx", "Word · .docx"],
      ["pdf", t("PDF documento · .pdf", "PDF document · .pdf")],
      [
        "pdf-graphic",
        t("PDF grafico · mappa mentale", "Graphical PDF · mind map"),
      ],
      ["json", "JSON · .json"],
      ["neuromap", "NeuroMap · .neuromap"],
      ["svg", "SVG · .svg"],
      ["png", t("PNG · mappa mentale", "PNG · mind map")],
    ]) {
      if (value === "pdf-graphic" && typeof app.io.exportPDF !== "function")
        continue;
      const opt = el("option", null, label);
      opt.value = value;
      format.append(opt);
    }
    formatGroup.append(formatLabel, format);
    const filesGroup = el("div", "nm-export-group"),
      filesLabel = el(
        "span",
        "nm-export-label",
        t("Come esportare?", "Output files"),
      ),
      layout = el("div", "nm-export-segments nm-export-two"),
      one = el("button", null, t("Un file unico", "One file")),
      zip = el("button", null, t("Separati · ZIP", "Separate · ZIP"));
    one.type = zip.type = "button";
    layout.append(one, zip);
    filesGroup.append(filesLabel, layout);
    const structure = el("details", "nm-export-structure");
    structure.open = true;
    const structureSummary = el(
        "summary",
        null,
        t("Suddivisione e Struttura", "Splitting & Structure"),
      ),
      structureBody = el("div", "nm-export-structure-body"),
      modeRow = el("label", "nm-export-structure-row"),
      modeLabel = el("span", null, t("Modalità", "Mode")),
      splitSelect = el("select", "nm-export-select");
    splitSelect.id = "nm-export-split-mode";
    modeLabel.htmlFor = splitSelect.id;
    const optSingle = el("option", null, t("File unico", "Single file"));
    optSingle.value = "single";
    const optTabs = el("option", null, t("Dividi per schede", "Split by map"));
    optTabs.value = "tabs";
    const optModular = el(
      "option",
      null,
      t(
        "Moduli bilanciati (Consigliato per studio e AI)",
        "Balanced modules (Recommended for study and AI)",
      ),
    );
    optModular.value = "modular";
    splitSelect.append(optSingle, optTabs, optModular);
    modeRow.append(modeLabel, splitSelect);

    const densityRow = el("label", "nm-export-structure-row"),
      densityLabel = el("span", null, t("Densità moduli", "Module density")),
      densitySelect = el("select", "nm-export-select");
    densitySelect.id = "nm-export-density";
    densityLabel.htmlFor = densitySelect.id;
    for (const [val, it, en] of [
      ["compact", "Compatto (~1.000 parole)", "Compact (~1,000 words)"],
      ["balanced", "Bilanciato (~1.800 parole)", "Balanced (~1,800 words)"],
      ["extended", "Esteso (~3.000 parole)", "Extended (~3,000 words)"],
    ]) {
      const o = el("option", null, t(it, en));
      o.value = val;
      densitySelect.append(o);
    }
    densitySelect.value = "balanced";
    densityRow.hidden = true;
    densityRow.append(densityLabel, densitySelect);

    const numberingWrap = el("label", "nm-export-checkbox"),
      numberingCheck = el("input");
    numberingCheck.type = "checkbox";
    numberingCheck.id = "nm-export-numbering";
    const numberingText = el(
      "span",
      null,
      t(
        "Numera gerarchicamente le sezioni (1., 1.1, ...)",
        "Number sections hierarchically (1., 1.1, ...)",
      ),
    );
    numberingWrap.append(numberingCheck, numberingText);

    const deliveryRow = el("label", "nm-export-structure-row"),
      deliveryLabel = el(
        "span",
        null,
        t("Destinazione file multipli", "Multiple files output"),
      ),
      deliverySelect = el("select", "nm-export-select");
    deliverySelect.id = "nm-export-delivery";
    deliveryLabel.htmlFor = deliverySelect.id;
    const optFolder = el(
      "option",
      null,
      t("Sottocartella dedicata (Consigliato)", "Dedicated subfolder (Recommended)"),
    );
    optFolder.value = "folder";
    const optZip = el("option", null, t("Archivio .zip", "Archive .zip"));
    optZip.value = "zip";
    const canSaveFolder =
      typeof host.neuromapDesktop?.saveExportFolder === "function" ||
      typeof host.showDirectoryPicker === "function";
    if (!canSaveFolder) {
      optFolder.disabled = true;
      optFolder.title = t(
        "Su questo dispositivo usa Archivio .zip",
        "Use .zip archive on this device",
      );
    }
    deliverySelect.append(optFolder, optZip);
    deliverySelect.value = canSaveFolder ? "folder" : "zip";
    deliveryRow.hidden = true;
    deliveryRow.append(deliveryLabel, deliverySelect);

    const chunkEstimate = el("p", "nm-export-chunk-estimate");
    chunkEstimate.id = "nm-export-chunk-estimate";
    structureBody.append(
      modeRow,
      densityRow,
      numberingWrap,
      deliveryRow,
      chunkEstimate,
    );
    structure.append(structureSummary, structureBody);
    const hint = el("p", "nm-export-note"),
      actions = el("footer", "nm-export-actions"),
      status = el("span", "nm-export-status"),
      cancel = el("button", null, t("Annulla", "Cancel")),
      run = el("button", "nm-export-run", t("Esporta", "Export"));
    cancel.type = run.type = "button";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    actions.append(status, cancel, run);
    const visual = el("section", "nm-export-visual");
    visual.hidden = true;
    const controls = el("div", "nm-export-visual-controls");
/* @neuromap-export-hub-ui-panel */
  host.NeuroMapExportHub = { install };
  window.addEventListener("DOMContentLoaded", () => setTimeout(install, 0));
})(globalThis);
