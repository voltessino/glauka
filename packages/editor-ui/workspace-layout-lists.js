/* @neuromap-workspace-layout-lists-tools */
  function mount(app) {
    const style = document.createElement("style");
    style.id = "nm-workspace-layout-style";
    style.textContent = /* @neuromap-workspace-layout-styles */ "";
    document.head.append(style);
    document.body.classList.add("nm-workspace-v2");
    const sidebar = document.getElementById("inspector-sidebar");
    const appearancePark = () => {
      let park = document.getElementById("gl-appearance-park");
      if (!park) {
        park = document.createElement("div");
        park.id = "gl-appearance-park";
        park.hidden = true;
        document.body.append(park);
      }
      return park;
    };
    if (sidebar) {
      const park = appearancePark();
      for (const id of [
        "nm-motion-settings",
        "nm-ui-skin-settings",
        "nm-orbit-desktop-settings",
      ]) {
        const section = document.getElementById(id);
        if (section) park.append(section);
      }
      const mobileBackground = sidebar.querySelector(".glauka-map-background");
      if (!globalThis.GlaukaMobile && !mobileBackground) {
      let canvas = document.getElementById("gl-format-map-canvas");
      if (!canvas) {
        canvas = document.createElement("section");
        canvas.id = "gl-format-map-canvas";
        canvas.className = "inspector-section nm6-skiptranslate";
        const canvasTitle = document.createElement("h3");
        canvasTitle.className = "inspector-section-label";
        canvasTitle.id = "gl-format-map-canvas-title";
        const canvasNote = document.createElement("p");
        canvasNote.className = "gl-format-map-note";
        const labelCanvas = () => {
          canvasTitle.textContent = tr("Sfondo della mappa", "Map background");
          canvasNote.textContent = tr("Solo su questo computer.", "Only on this computer.");
        };
        labelCanvas();
        root.NeuroMapWorkspaceLocale?.watch(labelCanvas);
        canvas.append(canvasTitle, canvasNote);
      }
      if (!canvas.isConnected) park.append(canvas);
      const background = document.querySelector(".nm-theme-picker");
      if (background && !background.closest(".glauka-map-background")) canvas.append(background);
      const texture = document.getElementById("nm-map-refinements");
      if (texture && !texture.closest(".glauka-map-background")) canvas.append(texture);
      const gallery = document.getElementById("nm-map-presets");
      if (gallery && !sidebar.contains(gallery)) {
        const bodyHost = sidebar.querySelector(":scope > .nm-panel-body");
        const bar = (bodyHost || sidebar).querySelector(":scope > .nm-settings-toolbar");
        const header = sidebar.querySelector(".inspector-header");
        if (bar) bar.after(gallery);
        else if (bodyHost) bodyHost.prepend(gallery);
        else if (header) header.after(gallery);
        else sidebar.prepend(gallery);
      }
      }
      const interaction=document.createElement("details");
      interaction.id="gl-edit-interaction-preferences";
      interaction.className="nm-edit-interaction-preferences nm6-skiptranslate";
      const interactionTitle=document.createElement("summary");
      const editRow=document.createElement("label");editRow.className="nm-edit-zoom-choice";
      const editCheckbox=document.createElement("input");editCheckbox.type="checkbox";
      editCheckbox.id="gl-edit-auto-zoom";editCheckbox.setAttribute("aria-describedby","gl-edit-auto-zoom-hint");
      try{editCheckbox.checked=localStorage.getItem("glauka.edit.autofocus.v1")==="1"}catch{}
      const editLabel=document.createElement("span");
      const editHint=document.createElement("small");editHint.id="gl-edit-auto-zoom-hint";
      const syncEditLabel=()=>{
        interactionTitle.textContent=tr("Interazione · modifica dei nodi","Interaction · editing topics");
        editLabel.textContent=tr("Ingrandisci automaticamente quando modifico un nodo","Zoom in automatically while editing a topic");
        editHint.textContent=tr("Disattivato per impostazione iniziale. Il doppio clic modifica il testo senza spostare la mappa.",
          "Off by default. Double-click edits text without moving the map.");
      };
      syncEditLabel();root.NeuroMapWorkspaceLocale?.watch(syncEditLabel);
      editCheckbox.addEventListener("change",()=>{
        try{localStorage.setItem("glauka.edit.autofocus.v1",editCheckbox.checked?"1":"0")}
        catch{editCheckbox.checked=false;app.showToast?.(tr("Preferenza non salvata","Preference was not saved"),"GLAUKA")}
      });
      editRow.append(editCheckbox,editLabel);
      interaction.append(interactionTitle,editRow,editHint);
      appearancePark().append(interaction);
      document
        .getElementById("inspector-fontsize-slider")
        ?.closest("details")
        ?.setAttribute("open", "");
    }
    const aiButton = document.getElementById("btn-ai-settings"),
      book =
        document.getElementById("nm-learn-trigger") ||
        document.getElementById("nm-learn-open"),
      dock = document.getElementById("nm614-right-dock");
    if (aiButton && dock) {
      if (book && book.parentElement === dock) book.after(aiButton);
      else dock.append(aiButton);
      const labelAI = () => {
        const text = tr("Assistente AI", "AI assistant");
        aiButton.setAttribute("aria-label", text);
        aiButton.title = text;
      };
      labelAI();
      root.NeuroMapWorkspaceLocale?.watch(labelAI);
    }
    const styleButton = document.getElementById("btn-toggle-inspector");
    if (styleButton) {
      const labelStyle = () => {
        const text = tr("Formato", "Format");
        styleButton.setAttribute("aria-label", text);
        styleButton.title = text;
        const name = styleButton.querySelector("span");
        if (name) name.textContent = text;
      };
      labelStyle();
      root.NeuroMapWorkspaceLocale?.watch(labelStyle);
      styleButton.addEventListener("click",event=>{
        // If a photo/chart is selected, the Style dock entry should not open
        // an empty duplicate "Text and style" window behind its own panel.
        if(!app.state?.selectedImageId)return;
        event.preventDefault();event.stopImmediatePropagation();
        document.getElementById("inspector-sidebar")?.classList.add("collapsed");
        app.updateImageControls?.();
        document.getElementById("image-controls")?.focus?.({preventScroll:true});
      },true);
    }
    const insert = mountInsert(app, dock, book, aiButton);
    mountLists(app);
    mountTextConnection(app);
    mountTextLayout(app);

    const navigation = document.getElementById("nm614-navigation-flyout");
    const contextActions = document.getElementById("nm616-context-actions");
    if (contextActions) contextActions.hidden = true;
    const layoutTitle = document.querySelector(".hud-title");
    const labelLayout = () => {
      if (layoutTitle)
        layoutTitle.textContent = tr("Disposizione della mappa", "Map layout");
    };
    labelLayout();
    root.NeuroMapWorkspaceLocale?.watch(labelLayout);
    const zoom = document.querySelector(".zoom-bar");
    if (zoom && !document.getElementById("nm-fit-map")) {
      const fit = document.createElement("button");
      fit.id = "nm-fit-map";
      fit.type = "button";
      fit.textContent = "⤢";
      const translate = () => {
        const text = tr("Adatta vista mappa", "Fit map to window");
        fit.setAttribute("aria-label", text);
        fit.title = text;
      };
      translate();
      root.NeuroMapWorkspaceLocale?.watch(translate);
      fit.addEventListener("click", () => app.fitWholeMap());
      zoom.prepend(fit);
    }
    // Inner galleries hand the wheel back to the panel at either boundary.
    for (const panel of [
      sidebar,
      document.querySelector(".hud-bottom-left"),
    ].filter(Boolean))
      panel.addEventListener(
        "wheel",
        (event) => {
          if (
            event.ctrlKey ||
            event.metaKey ||
            event.defaultPrevented ||
            !event.deltaY
          )
            return;
          let el = event.target instanceof Element ? event.target : null;
          while (el && el !== panel) {
            const css = getComputedStyle(el);
            if (
              /auto|scroll/.test(css.overflowY) &&
              el.scrollHeight > el.clientHeight + 1
            ) {
              const remaining =
                event.deltaY > 0
                  ? el.scrollHeight - el.clientHeight - el.scrollTop
                  : el.scrollTop;
              if (remaining <= 1) {
                event.preventDefault();
                const scroller = panel.querySelector(":scope > .nm-panel-body") || panel;
                scroller.scrollTop +=
                  event.deltaY *
                  (event.deltaMode === 1
                    ? 16
                    : event.deltaMode === 2
                      ? scroller.clientHeight
                      : 1);
                return;
              }
              return;
            }
            el = el.parentElement;
          }
        },
        { passive: false },
      );
    const state = coordinator();
    states.set(app, state);
    const inspector = document.getElementById("inspector-sidebar"),
      imageControls = document.getElementById("image-controls"),
      knowledge = document.getElementById("nm-knowledge-panel"),
      ai = document.getElementById("nm-ai-studio"),
      learn = document.getElementById("nm-learn-panel"),
      layout = document.querySelector(".hud-bottom-left");
    const open = (el) =>
      !!el &&
      !el.hidden &&
      !el.classList.contains("hidden") &&
      !el.classList.contains("collapsed");
    if (insert)
      state.register("insert", {
        isOpen: () => open(insert),
        close: () => {
          insert.hidden = true;
          document
            .getElementById("nm-open-insert")
            .setAttribute("aria-expanded", "false");
        },
      });
    if (navigation)
      state.register("navigation", {
        isOpen: () => open(navigation),
        close: () => document.getElementById("nm614-open-navigation")?.click(),
      });
    if (inspector)
      state.register("inspector", {
        isOpen: () => open(inspector),
        close: () => document.getElementById("btn-close-inspector")?.click(),
      });
    if (imageControls)
      state.register("image", {
        isOpen: () => open(imageControls),
        close: () => imageControls.classList.add("hidden"),
      });
    if (knowledge)
      state.register("knowledge", {
        isOpen: () => open(knowledge),
        // Hiding keeps the live draft DOM and its original document owner.
        canLeave: () => true,
        close: () => app._nmKnowledge.close(),
        focus: () =>
          knowledge
            .querySelector("input.nm-kn-edit,#nm-kn-chapter-text")
            ?.focus(),
      });
    if (ai)
      state.register("ai", {
        isOpen: () => open(ai),
        // Background work retains its UI and continues when hidden.
        canLeave: () => true,
        close: () => ai.classList.add("hidden"),
        focus: () => app.aiStudio.stop.focus(),
      });
    if (layout)
      state.register("layout", {
        isOpen: () => open(layout),
        close: () => document.getElementById("v6-hide-layout")?.click(),
      });
    // The linked-view overlay must participate in the SAME mutually exclusive
    // window coordinator. Closing it uses the existing back action, preserving
    // camera restoration, document history and secondary-pane semantics.
    // Register even before the linked-view module creates its DOM.
    // Looking up the element lazily prevents a module-order race.
    state.register("linked-view", {
      isOpen: () => {
        const linkedView = document.getElementById("nm-view-overlay");
        return !!linkedView && !linkedView.hidden;
      },
      close: () => {
        const linkedView = document.getElementById("nm-view-overlay");
        if (!linkedView || linkedView.hidden) return;
        // Commit the active editor before hiding either canvas. Waiting for a
        // deferred render can otherwise strand edits behind the next panel.
        document.querySelector("#nm-view-stage .nm-view-edit")?.blur();
        document.querySelector("#nm-dual-stage .nm-view-edit")?.blur();
        const back = document.getElementById("nm-view-back");
        // Keep the existing camera restoration / Undo path. In a paired
        // alternate view the first Back closes the secondary presentation.
        back?.click();
        if (app.state?.root?.viewMode !== "mindmap") back?.click();
        linkedView.hidden = true;
        // The view render is deferred. Leaving the old "was open" mark makes
        // that later render treat this close as the Back button and reopen
        // the layout panel on top of the panel that just claimed the space.
        linkedView.dataset.nmWasOpen = "0";
      },
    });
    state.register("drawing", {
      isOpen: () => open(document.getElementById("nm-drawing-toolbar")),
      canLeave: () => !app._nmDraw?.path,
      close: () => root.NeuroMapCreativeModules.drawing.stopDrawing(app),
    });
    state.register("markers", {
      isOpen: () => open(document.getElementById("nm62-assets")) ||
        !!document.getElementById("nm-creative-library-hub"),
      close: () => {
        app.nm62CloseAssets();
        document.getElementById("nm-creative-library-hub")?.remove();
      },
    });
    if (learn)
      state.register("learn", {
        isOpen: () => open(learn),
        close: () => learn.querySelector("#nm-learn-close")?.click(),
      });
    document.getElementById("btn-toggle-inspector")?.addEventListener(
      "click",
      (event) => {
        const blocked =
          app._nmKnowledge?.hasDraft?.() || app.aiStudio?.busy === true;
        if (!open(inspector) && (blocked || !claim(app, "inspector"))) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
    for (const id of ["v6-show-layout", "v6-toggle-layout"])
      document.getElementById(id)?.addEventListener(
        "click",
        (event) => {
          if (!open(layout) && !claim(app, "layout")) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        true,
      );
    // Cover contextual openings made directly by existing selection handlers.
    const panels = new Map(
      [
        [inspector, "inspector"],
        [imageControls, "image"],
        [knowledge, "knowledge"],
        [ai, "ai"],
        [learn, "learn"],
        [layout, "layout"],
        [insert, "insert"],
        [navigation, "navigation"],
      ].filter(([el]) => el),
    );
    mountPanelResizeHandles([inspector,knowledge,ai,learn,layout,imageControls,insert,navigation]);
    const syncDock = () => {
      for (const [panel, id] of [
        [inspector, "btn-toggle-inspector"],
        [navigation, "nm614-open-navigation"],
        [ai, "btn-ai-settings"],
        [learn, book?.id],
        [insert, "nm-open-insert"],
        [document.getElementById("find-overlay"), "btn-spotlight"],
      ]) {
        const button = document.getElementById(id);
        if (!button || !panel) continue;
        button.setAttribute("aria-controls", panel.id);
        button.setAttribute("aria-expanded", String(open(panel)));
      }
    };
    const searchPanel = document.getElementById("find-overlay");
    if (searchPanel)
      new MutationObserver(syncDock).observe(searchPanel, {
        attributes: true,
        attributeFilter: ["hidden", "class"],
      });
    syncDock();
    let previous = new Map([...panels].map(([el]) => [el, open(el)]));
    const observer = new MutationObserver((records) => {
      const opened = [...new Set(records.map((r) => r.target))].filter(
        (el) => open(el) && !previous.get(el),
      );
      for (const el of opened)
        if (!claim(app, panels.get(el))) {
          if (el === inspector) el.classList.add("collapsed");
          else if (el === ai || el === imageControls) el.classList.add("hidden");
          else if (el === knowledge) app._nmKnowledge.close();
          else if (el === layout)
            document.getElementById("v6-hide-layout")?.click();
          else if (el === insert) {
            insert.hidden = true;
            document
              .getElementById("nm-open-insert")
              .setAttribute("aria-expanded", "false");
          } else if (el === navigation)
            document.getElementById("nm614-open-navigation")?.click();
          else learn.querySelector("#nm-learn-close")?.click();
        }
      previous = new Map([...panels].map(([el]) => [el, open(el)]));
      syncDock();
    });
    for (const el of panels.keys())
      observer.observe(el, {
        attributes: true,
        attributeFilter: ["class", "hidden"],
      });
    const measure = () => {
      const bottom =
          document.querySelector(".top-chrome")?.getBoundingClientRect()
            .bottom || 84,
        footer = document
          .querySelector(".hud-bottom-right")
          ?.getBoundingClientRect();
      document.body.style.setProperty(
        "--nm-workspace-top",
        Math.ceil(bottom + 12) + "px",
      );
      document.body.style.setProperty(
        "--nm-workspace-bottom",
        Math.ceil(
          footer?.height > 0 ? Math.max(12, innerHeight - footer.top + 12) : 12,
        ) + "px",
      );
    };
    new ResizeObserver(measure).observe(document.querySelector(".top-chrome"));
    root.addEventListener("resize", measure);
    measure();
    const plan = document.getElementById("nm6-plan-button"),
      help = document.getElementById("dropdown-help");
    if (plan && help && !document.getElementById("nm-license-menu")) {
      help.append(plan);
      plan.classList.remove("tab-action-btn");
      plan.classList.add("dropdown-item");
      const labelPlan = () =>
        plan.setAttribute(
          "aria-label",
          tr("Piano e licenza", "Plan and license"),
        );
      labelPlan();
      root.NeuroMapWorkspaceLocale?.watch(labelPlan);
    }
    const status = document.querySelector(".status-pill"),
      options = document.getElementById("nm616-nav-options");
    if (status && options) {
      const help = document.getElementById("dropdown-help");
      if (help) {
        const hidden = document.createElement("div");
        hidden.hidden = true;
        hidden.id = "nm-internal-status";
        hidden.append(status);
        document.body.append(hidden);
      }
    }
    const toast = document.getElementById("toast-notification");
    if (toast) {
      const dismiss = document.createElement("button");
      dismiss.id = "nm-toast-dismiss";
      dismiss.type = "button";
      dismiss.textContent = "×";
      dismiss.setAttribute(
        "aria-label",
        tr("Chiudi notifica", "Dismiss notification"),
      );
      dismiss.addEventListener("click", () => {
        clearTimeout(app.toastTimer);
        toast.classList.add("hidden");
      });
      toast.append(dismiss);
      const action = document.createElement("button");
      action.id = "nm-toast-save-action";
      action.type = "button";
      action.hidden = true;
      action.textContent = tr("Apri File", "Open File");
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        toast.classList.add("hidden");
        document.getElementById("btn-menu-file")?.click();
      });
      toast.append(action);
      root.NeuroMapWorkspaceLocale?.watch(() => {
        dismiss.setAttribute(
          "aria-label",
          tr("Chiudi notifica", "Dismiss notification"),
        );
        action.textContent = tr("Apri File", "Open File");
      });
    }
    icons();
    root.NeuroMapWorkspaceLocale?.watch(icons);
    // Keep the selected object's name and available controls together.
    const title = () => {
      const span = inspector?.querySelector(
        ".inspector-header .inspector-title span",
      );
      if (!span) return;
      const labels = {
        node: ["Formato", "Format"],
        boundary: ["Recinto", "Boundary"],
        relationship: ["Collegamento", "Relationship"],
        image: ["Immagine", "Image"],
        graphic: ["Disegno", "Drawing"],
      };
      const pair = labels[inspector.dataset.nmSelection] || labels.node;
      span.textContent = tr(...pair);
    };
    if (inspector)
      new MutationObserver(title).observe(inspector, {
        attributes: true,
        attributeFilter: ["data-nm-selection"],
      });
    root.NeuroMapWorkspaceLocale?.watch(title);
    title();
  }
