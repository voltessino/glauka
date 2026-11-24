  function menuIcon(id) {
    if(/^(?:nm-tool-(?:document|outline|sources|memory|links|database|dashboard|quality|journey|visual-study|anki|atlas|studio-panel)|nm-ocr-launch|nm-capture-open|nm-exchange-open|btn-flashcards|nm616-compare-open|nm-group-(?:write|study|organize)|menu-new-tab|btn-duplicate-tab|btn-import-files-new-tabs|menu-open-recent|menu-save-file|menu-save-file-as|menu-project-history|menu-save-all-tabs|nm611-autosave-open|nm-save-status|gl-cloud-open|menu-settings|btn-import-file-current|btn-import-paste|menu-new-map|menu-close-tab)$/.test(id)&&root.NeuroMapMenuUX?.icon)return root.NeuroMapMenuUX.icon(id);

    const specific =
      id === "menu-iconify-single"
        ? "illustrationSearch"
        : id === "menu-iconify-bulk"
          ? "wand"
          : id === "menu-add-image"
            ? "photoAdd"
            : /symbol/.test(id)
              ? "symbol"
              : /formula/.test(id)
                ? "formula"
                : /drawing|draw/.test(id)
                  ? "pen"
                  : /library/.test(id)
                    ? "library"
                    : /history/.test(id)
                      ? "clock"
                      : null;
    const kind =
      specific ||
      (/export|share/.test(id)
        ? "export"
        : /cloud/.test(id)
          ? "cloud"
          : /settings|pref/.test(id)
            ? "gear"
            : /license|plan/.test(id)
        ? "key"
        : /about/.test(id)
          ? "info"
          : /shortcuts/.test(id)
            ? "keyboard"
            : /guide/.test(id)
              ? "book"
              : /save-status|autosave/.test(id)
                ? "clock"
                : /save/.test(id)
                  ? "save"
                  : /open|import/.test(id)
                    ? "open"
                    : /duplicate|copy/.test(id)
                      ? "copy"
                      : /new|add/.test(id)
                        ? "add"
                        : /undo/.test(id)
                          ? "back"
                          : /redo/.test(id)
                            ? "forward"
                            : /delete|clear/.test(id)
                              ? "delete"
                              : /rename|text/.test(id)
                                ? "text"
                                : /child|sibling|branch/.test(id)
                                  ? "tree"
                                  : /illustr|image|gallery/.test(id)
                                    ? "picture"
                                    : /ai|formula|symbol/.test(id)
                                      ? "spark"
                                      : /find|search|atlas/.test(id)
                                        ? "search"
                                        : /view|layout|center|zoom|screen|zen/.test(
                                              id,
                                            )
                                          ? "eye"
                                          : "grid");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("nm-menu-symbol", "nm-workspace-icon");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", menuIcons[kind]);
    svg.append(path);
    return svg;
  }
  function curateMenus() {
    const help = document.getElementById("dropdown-help"),
      plan = document.getElementById("nm6-plan-button");
    if (help && plan && !document.getElementById("nm-license-menu")) {
      const hidden = document.createElement("div");
      hidden.hidden = true;
      hidden.id = "nm-plan-action-original";
      hidden.append(plan);
      document.body.append(hidden);
      const action = document.createElement("button");
      action.type = "button";
      action.id = "nm-license-menu";
      action.className = "dropdown-item nm6-skiptranslate";
      action.addEventListener("click", () => {
        root.neuroMapApp?.hideMenus?.();
        plan.click();
      });
      help.append(action);
    }
    const special = [
      ["nm-license-menu", "Licenza…", "License…"],
      ["btn-shortcuts", "Scorciatoie da tastiera", "Keyboard shortcuts"],
      ["nm7-guide-open", "Primi passi", "First steps"],
    ];
    for (const [id, it, en] of special) {
      const b = document.getElementById(id);
      if (!b) continue;
      let label = b.querySelector(".nm-command-label");
      if (!label) {
        label = document.createElement("span");
        label.className = "nm-command-label";
        b.replaceChildren(label);
      }
      const text = tr(it, en);
      if (label.textContent !== text) label.textContent = text;
      b.setAttribute("aria-label", text);
    }
    for (const name of ["file", "edit", "insert", "view", "tools", "help"]) {
      const menu = document.getElementById("dropdown-" + name);
      if (!menu) continue;
      menu.classList.add("nm-command-menu");
      for (const b of menu.querySelectorAll("button.dropdown-item")) {
        b.classList.add("nm-command-item");
        if(b.querySelector(':scope>svg.nm-semantic-menu-icon'))
          b.querySelectorAll(':scope>svg.nm-workspace-icon:not(.nm-semantic-menu-icon)').forEach(icon=>icon.remove());
        if (!b.querySelector(":scope>svg")) b.prepend(menuIcon(b.id));
        else b.querySelector(":scope>svg").classList.add("nm-menu-symbol");
      }
    }
  }
  function curate() {
    const menu = document.getElementById("dropdown-tools"),
      view = document.getElementById("dropdown-view");
    if (!menu || !view) return;
    if (!document.getElementById("nm-tool-studio-panel")) {
      const studioBtn = document.createElement("button");
      studioBtn.type = "button";
      studioBtn.id = "nm-tool-studio-panel";
      studioBtn.className = "dropdown-item";
      studioBtn.textContent = tr("Pannello Studio a destra", "Right-side Study panel");
      studioBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        root.neuroMapApp?.hideMenus?.();
        if (root.neuroMapApp?._nmLearning?.open) root.neuroMapApp._nmLearning.open();
        else document.getElementById("nm-learn-open")?.click();
      });
      menu.prepend(studioBtn);
    }
    if (!document.getElementById("nm-task-tools-style")) {
      const style = document.createElement("style");
      style.id = "nm-task-tools-style";
      style.textContent = `
body .dropdown-panel.nm-command-menu{color:var(--nm-ui-ink,#edf2fa);background:var(--nm-ui-surface,#101b31)!important;border:1px solid var(--nm-ui-line,#33445f);border-radius:10px;padding:7px;box-shadow:0 12px 32px #0006;font:13px system-ui}
body .nm-command-menu .dropdown-section-title{padding:9px 9px 5px;font:600 11px/1.4 system-ui;letter-spacing:0;text-transform:none;color:var(--nm-ui-muted,#afbdd3)}
body .nm-command-menu .nm-command-item{min-height:40px;border:0!important;border-radius:7px;padding:9px;font:13px/1.4 system-ui!important;color:inherit;background:transparent!important;gap:10px;white-space:normal!important;text-align:left}
body .nm-command-menu .nm-command-item:not(.nm-task-command){display:flex;align-items:center;justify-content:flex-start}
body .nm-command-menu .nm-command-item:hover{background:var(--nm-ui-hover,#24354d)!important}
body .nm-command-menu .nm-command-item>span:first-of-type{flex:1;min-width:0;white-space:normal!important}
body .nm-command-menu .nm-menu-symbol{width:18px;height:18px;flex:0 0 18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;color:var(--nm-ui-muted,#afbdd3)}
body .nm-command-menu .kbd-key{margin-left:auto;font:10px ui-monospace,monospace;flex:none}
body .nm-command-menu .dropdown-divider{margin:6px 4px;border-color:var(--nm-ui-line,#33445f)}
body #dropdown-help.nm-command-menu{width:290px;min-width:0}
#nm-plan-action-original[hidden]{display:none!important}
body #dropdown-tools{width:355px!important;max-width:calc(100vw - 20px);max-height:calc(100dvh - 120px);overflow-y:auto;box-sizing:border-box}
.nm-task-tools{border-bottom:1px solid var(--nm-ui-line,#7184a333);padding:3px 0}
.nm-task-tools>summary{display:flex;align-items:center;gap:9px;cursor:pointer;padding:12px 9px;min-height:44px;box-sizing:border-box;list-style:none;font:600 13px system-ui}
.nm-task-tools>summary::-webkit-details-marker{display:none}.nm-task-tools>summary::after{content:'⌄';margin-left:auto}.nm-task-tools[open]>summary::after{content:'⌃'}
.nm-task-tools .dropdown-item{white-space:normal!important;overflow-wrap:anywhere;line-height:1.4;padding:10px 12px;font-size:12px;min-height:42px}
.nm-task-command-label{display:block;font-weight:650}.nm-task-command-hint{display:block;color:var(--nm-ui-muted,var(--text-secondary,#5c6680));font-size:11px;line-height:1.4;margin-top:3px;font-weight:400}
.nm-task-tools>summary:focus-visible{outline:2px solid #69cfff;outline-offset:-3px;border-radius:8px}
#dropdown-tools .nm-fast-canvas-control{display:flex;width:100%;gap:8px;box-sizing:border-box;white-space:normal;margin:5px 0;border:0;box-shadow:none;font:12px system-ui}
#dropdown-tools #nm-fast-canvas-stats{display:block;max-width:100%;font-size:10px;padding:6px;white-space:normal}#dropdown-tools #nm-fast-canvas-stats[hidden]{display:none}
`;
      document.head.append(style);
    }
    for (const [key, icon, it, en, ids] of groups) {
      let section = document.getElementById("nm-tools-" + key);
      if (!section) {
        section = document.createElement("details");
        section.id = "nm-tools-" + key;
        section.className = "nm-task-tools nm6-skiptranslate";
        section.open = key === "write";
        const summary = document.createElement("summary");
        section.append(summary);
        menu.append(section);
      }
      const summary = section.firstElementChild,
        text = tr(it, en);
      if (summary.textContent !== text){summary.textContent=text;summary.prepend(menuIcon("nm-group-"+key));}
      for (const id of ids) {
        const control = document.getElementById(id);
        if (control && control.parentElement !== section)
          section.append(control);
      }
      section.hidden = !ids.some(
        (id) => document.getElementById(id)?.parentElement === section,
      );
    }
    for (const [id, it, en, hintIt, hintEn] of Object.values(labels)) {
      const command = document.getElementById(id);
      if (!command || command.classList.contains("nm-insert-tool")) continue;
      let name = command.querySelector(".nm-task-command-label"),
        hint = command.querySelector(".nm-task-command-hint");
      if (!name || !hint) {
        name = document.createElement("span");
        hint = document.createElement("span");
        name.className = "nm-task-command-label";
        hint.className = "nm-task-command-hint";
        command.replaceChildren(name, hint);
        command.classList.add("nm6-skiptranslate");
      }
      command.classList.add("nm-task-command");
      const text = tr(it, en),
        description = tr(hintIt, hintEn);
      if (name.textContent !== text) name.textContent = text;
      if (hint.textContent !== description) hint.textContent = description;
      if (command.getAttribute("aria-label") !== text)
        command.setAttribute("aria-label", text);
      // The visible description replaces another hover-only explanation.
      if (command.hasAttribute("title")) command.removeAttribute("title");
    }
    curateMenus();
    const sections = groups
      .map((g) => document.getElementById("nm-tools-" + g[0]))
      .filter(Boolean);
    let anchor = [...menu.children].find((el) => !sections.includes(el));
    for (const section of sections.slice().reverse()) {
      if (section.nextElementSibling !== anchor)
        menu.insertBefore(section, anchor || null);
      anchor = section;
    }
    const legacyTitle = menu.querySelector(".dropdown-section-title");
    if (legacyTitle) {
      const flat = [...menu.children].some((el) =>
        el.matches("button.dropdown-item"),
      );
      legacyTitle.hidden = !flat;
      const text = tr("Altri strumenti", "More tools");
      if (legacyTitle.textContent !== text) legacyTitle.textContent = text;
    }
    const toggle = document.getElementById("nm-fast-canvas-toggle");
    const control = toggle?.closest("label") || toggle;
    if (control && control.parentElement?.id !== "gl-settings-park") {
      let park = document.getElementById("gl-settings-park");
      if (!park) {
        park = document.createElement("div");
        park.id = "gl-settings-park";
        park.hidden = true;
        document.body.append(park);
      }
      park.append(control);
      const stats = document.getElementById("nm-fast-canvas-stats");
      if (stats) park.append(stats);
      document.getElementById("nm-performance-heading")?.remove();
      document.getElementById("gl-fast-canvas-help")?.remove();
    }
  }
