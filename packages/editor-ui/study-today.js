/* Flashcard Studio: today's due deck, searchable past/all archive, manual composer and SM-2 intervals. */
(function (root) {
  "use strict";
  const tr = (it, en) =>
    root.GlaukaI18n?.pair(it, en) ??
    (document.documentElement.lang === "en" ? en : it);

  function summary(app, now = Date.now()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    let due = 0,
      stale = 0,
      reviewed = 0,
      total = 0;
    for (const card of Array.isArray(app.studyCards) ? app.studyCards : []) {
      if (!card || typeof card !== "object") continue;
      total++;
      const last = card.sr?.lastReviewedAt;
      if (Number.isFinite(last) && last >= start.getTime() && last <= now)
        reviewed++;
      if (app.v5Staleness(card) !== "fresh") {
        stale++;
        continue;
      }
      const dueAt =
        Number.isFinite(card.sr?.dueAt) && card.sr.dueAt > 0
          ? card.sr.dueAt
          : 0;
      if (dueAt <= now) due++;
    }
    return { due, stale, reviewed, total };
  }

  function formatDate(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return "";
    try {
      return new Date(ts).toLocaleDateString(
        root.GlaukaI18n?.locale?.() || tr("it-IT", "en-US"),
        { day: "numeric", month: "short", year: "numeric" },
      );
    } catch {
      return "";
    }
  }

  function install(App) {
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args),
        a = this,
        modal = document.getElementById("flash-modal");
      if (!modal || document.getElementById("glauka-study-today"))
        return result;

      const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
      };

      const modalHeadTitle = modal.querySelector(".v4-modal-head strong");
      const modalHeadSub = modal.querySelector(".v4-modal-head small");

      // Hero strip with due/reviewed/total summary + primary action + quick compose button.
      const box = el("section", "glauka-study-today");
      box.id = "glauka-study-today";
      const infoWrap = el("div", "glauka-today-info");
      const title = el("strong"),
        counts = el("p"),
        progress = el("small");
      progress.id = "glauka-study-session-progress";
      progress.setAttribute("role", "status");
      infoWrap.append(title, counts, progress);

      const ctaWrap = el("div", "glauka-today-ctas");
      const action = el("button", "glauka-today-start");
      action.type = "button";
      action.id = "glauka-study-start";
      const quickAdd = el("button", "glauka-today-add");
      quickAdd.type = "button";
      quickAdd.id = "glauka-flash-new-quick";
      ctaWrap.append(action, quickAdd);
      box.append(infoWrap, ctaWrap);
      modal.querySelector(".v4-modal-head").after(box);

      // View switcher tabs: Study | Archive & Past (N) | Create card.
      const nav = el("div", "glauka-flash-tabs");
      nav.id = "glauka-flash-tabs";
      nav.setAttribute("role", "tablist");
      const tabStudy = el("button", "is-active");
      const tabLib = el("button");
      const tabCompose = el("button");
      for (const b of [tabStudy, tabLib, tabCompose]) {
        b.type = "button";
        b.setAttribute("role", "tab");
      }
      nav.append(tabStudy, tabLib, tabCompose);
      box.after(nav);

      // AI & JSON archive collapsible drawer (kept visible on Study view).
      const tools = el("details", "glauka-study-tools");
      tools.id = "glauka-study-tools";
      const toolsTitle = el("summary");
      tools.append(toolsTitle);
      const studyPane = el("div", "glauka-flash-pane");
      studyPane.id = "glauka-flash-pane-study";
      nav.after(studyPane);

      const scopeEl = document.getElementById("v5-study-scope");
      const countInput = document.getElementById("v5-study-count");
      const countOldWrap = countInput?.closest(".v5-study-count");
      const genBtn = document.getElementById("v5-generate-cards");
      const regenBtn = document.getElementById("v5-regenerate-stale");
      const exportBtn = document.getElementById("v5-export-cards");
      const importBtn = document.getElementById("v5-import-cards");
      const importFileEl = document.getElementById("v5-import-file");
      const removeCardBtn = document.getElementById("v5-remove-card");

      const topRows = [...modal.querySelectorAll(".v5-study-top")];
      for (const row of topRows.slice(0, 2)) row.hidden = true;

      // Move all original Study controls cleanly inside studyPane while retaining every ID.
      const statusNode = document.getElementById("v5-study-status");
      const filterRow = modal.querySelector(".v4-filter-row");
      const flipCard = document.getElementById("flash-flip-card");
      const sourceSlot = document.getElementById("flash-source-slot");
      const revealRow = modal.querySelector(".v4-flash-actions");
      const ratingRow = document.getElementById("flash-rating");
      const updateRow = document.getElementById("v5-card-update")?.parentElement;
      const footRow = modal.querySelector(".v4-modal-foot");
      const captionRow = modal.querySelector(".v4-caption");

      // Linear progress bar appended inside filterRow.
      const meter = el("div", "glauka-flash-meter");
      const meterFill = el("span");
      meter.append(meterFill);

      // Floating utility bar directly above the card for audio, quick edit & delete (outside button#flash-flip-card).
      const cardTools = el("div", "glauka-card-tools");
      cardTools.id = "glauka-card-tools";
      const speakBtn = el("button", "glauka-card-tool-btn");
      speakBtn.type = "button";
      speakBtn.id = "glauka-flash-speak";
      const editCardBtn = el("button", "glauka-card-tool-btn");
      editCardBtn.type = "button";
      editCardBtn.id = "glauka-flash-edit-current";
      cardTools.append(speakBtn, editCardBtn);
      if (removeCardBtn) {
        removeCardBtn.classList.remove("v4-secondary");
        removeCardBtn.classList.add("glauka-card-tool-btn", "glauka-card-tool-danger");
        cardTools.append(removeCardBtn);
      }

      // Empty-state quick actions shown when deck has 0 cards.
      const emptyCtas = el("div", "glauka-empty-ctas");
      emptyCtas.id = "glauka-empty-actions";
      const emptyCreateBtn = el("button", "v4-primary");
      emptyCreateBtn.type = "button";
      const emptyGoogleBtn = el("button", "v4-secondary");
      emptyGoogleBtn.type = "button";
      const emptyAiBtn = el("button", "v4-secondary");
      emptyAiBtn.type = "button";
      emptyCtas.append(emptyCreateBtn, emptyGoogleBtn, emptyAiBtn);

      // Clean 2-column AI + Google AI Mode generator with preset quantity pills inside #glauka-study-tools.
      const toolsBody = el("div", "glauka-tools-body");
      const genConfig = el("div", "glauka-gen-config");
      const scopeField = el("div", "glauka-gen-field");
      const scopeLabel = el("span", "glauka-gen-label");
      scopeField.append(scopeLabel);
      if (scopeEl) {
        if (!scopeEl.querySelector('option[value="selectedTabs"]')) {
          const optMulti = el("option", "", tr("Più schede (scegli)…", "Multiple maps (choose)…"));
          optMulti.value = "selectedTabs";
          const allOpt = scopeEl.querySelector('option[value="all"]');
          if (allOpt) allOpt.before(optMulti);
          else scopeEl.append(optMulti);
        }
        scopeField.append(scopeEl);
      }

      const countField = el("div", "glauka-gen-field glauka-gen-count-field");
      const countLabel = el("span", "glauka-gen-label");
      const countControls = el("div", "glauka-count-controls");
      const countPillsWrap = el("div", "glauka-count-pills");
      const countPills = [5, 10, 15, 20].map((num) => {
        const b = el("button", "glauka-count-pill", String(num));
        b.type = "button";
        b.dataset.count = String(num);
        countPillsWrap.append(b);
        return b;
      });
      countControls.append(countPillsWrap);
      if (countInput) {
        countInput.min = "3";
        countInput.max = "30";
        if (!countInput.value || Number(countInput.value) === 7) countInput.value = "10";
        countInput.classList.add("glauka-count-input");
        countControls.append(countInput);
      }
      if (countOldWrap) countOldWrap.hidden = true;
      countField.append(countLabel, countControls);
      genConfig.append(scopeField, countField);

      const genGrid = el("div", "glauka-gen-grid");

      const apiCard = el("div", "glauka-gen-card");
      const apiHead = el("div", "glauka-gen-head");
      const apiTitle = el("strong");
      const apiBadge = el("span", "glauka-method-pill");
      apiHead.append(apiTitle, apiBadge);
      const apiHint = el("p", "glauka-gen-hint");
      const apiActions = el("div", "glauka-gen-actions");
      if (genBtn) apiActions.append(genBtn);
      if (regenBtn) apiActions.append(regenBtn);
      apiCard.append(apiHead, apiHint, apiActions);

      const googleSection = el("div", "glauka-gen-card glauka-google-box");
      googleSection.id = "glauka-google-box";
      const googleHead = el("div", "glauka-gen-head");
      const googleTitle = el("strong");
      const googleBadge = el("span", "glauka-google-pill");
      googleHead.append(googleTitle, googleBadge);
      const googleHint = el("p", "glauka-gen-hint");
      const googleBtns = el("div", "glauka-gen-actions");
      const googleOpenBtn = el("button", "v4-primary");
      googleOpenBtn.type = "button";
      googleOpenBtn.id = "glauka-flash-google-ai";
      const googleCopyBtn = el("button", "v4-secondary");
      googleCopyBtn.type = "button";
      googleCopyBtn.id = "glauka-flash-google-copy";
      googleBtns.append(googleOpenBtn, googleCopyBtn);
      const googlePasteArea = el("div", "glauka-google-paste");
      googlePasteArea.id = "glauka-google-paste";
      const googleTextarea = el("textarea");
      googleTextarea.id = "glauka-google-paste-text";
      googleTextarea.rows = 2;
      const googleImportBtn = el("button", "v4-primary");
      googleImportBtn.type = "button";
      googleImportBtn.id = "glauka-google-paste-import";
      googlePasteArea.append(googleTextarea, googleImportBtn);
      googleSection.append(googleHead, googleHint, googleBtns, googlePasteArea);

      genGrid.append(apiCard, googleSection);

      const archiveBar = el("div", "glauka-tools-archive");
      const archiveLabel = el("span", "glauka-tools-archive-label");
      const archiveBtns = el("div", "glauka-tools-archive-btns");
      if (exportBtn) archiveBtns.append(exportBtn);
      if (importBtn) archiveBtns.append(importBtn);
      if (importFileEl) archiveBtns.append(importFileEl);
      archiveBar.append(archiveLabel, archiveBtns);

      const sheetPicker = el("div", "glauka-sheet-picker");
      sheetPicker.id = "glauka-sheet-picker";
      sheetPicker.hidden = true;
      const sheetPickerHead = el("div", "glauka-sheet-picker-head");
      const sheetPickerTitle = el("span");
      const sheetPickerActions = el("div", "glauka-sheet-picker-actions");
      const sheetAllBtn = el("button", "glauka-sheet-quick-btn");
      sheetAllBtn.type = "button";
      const sheetActiveBtn = el("button", "glauka-sheet-quick-btn");
      sheetActiveBtn.type = "button";
      sheetPickerActions.append(sheetAllBtn, sheetActiveBtn);
      sheetPickerHead.append(sheetPickerTitle, sheetPickerActions);
      const sheetChipsWrap = el("div", "glauka-sheet-chips");
      sheetPicker.append(sheetPickerHead, sheetChipsWrap);

      toolsBody.append(genConfig, sheetPicker, genGrid, archiveBar);
      tools.append(toolsBody);

      if (filterRow) studyPane.append(filterRow, meter);
      if (flipCard) {
        studyPane.append(cardTools, flipCard);
        if (sourceSlot) studyPane.append(sourceSlot);
        studyPane.append(emptyCtas);
      }
      if (revealRow) studyPane.append(revealRow);
      if (ratingRow) studyPane.append(ratingRow);
      if (updateRow) studyPane.append(updateRow);
      if (footRow) studyPane.append(footRow);
      studyPane.append(tools);
      if (statusNode) studyPane.append(statusNode);
      if (captionRow) studyPane.append(captionRow);

      // Pane 2: Archive & Past cards browser.
      const libPane = el("div", "glauka-flash-pane glauka-flash-library");
      libPane.id = "glauka-flash-library";
      libPane.hidden = true;
      const libToolbar = el("div", "glauka-lib-toolbar");
      const libSearch = el("input");
      libSearch.type = "search";
      libSearch.id = "glauka-lib-search";
      const libFilter = el("select");
      libFilter.id = "glauka-lib-filter";
      for (const [val, it, en] of [
        ["all", "Tutte (passate e presenti)", "All (past & current)"],
        ["due", "In scadenza / nuove", "Due / unseen"],
        ["review", "Difficili (da ripassare)", "Needs review"],
        ["good", "Consolidate", "Confident"],
        ["other", "Di altre mappe / passate", "From other / closed maps"],
        ["active", "Solo questa mappa", "Current map only"],
      ]) {
        const opt = el("option", "", tr(it, en));
        opt.value = val;
        libFilter.append(opt);
      }
      const libAddBtn = el("button", "v4-primary glauka-lib-add");
      libAddBtn.type = "button";
      libToolbar.append(libSearch, libFilter, libAddBtn);
      const libCount = el("div", "glauka-lib-meta");
      const libList = el("div", "glauka-lib-list");
      libList.id = "glauka-lib-list";
      libPane.append(libToolbar, libCount, libList);
      studyPane.after(libPane);

      // Pane 3: Manual Composer & Quick Editor.
      const composePane = el("div", "glauka-flash-pane glauka-flash-compose");
      composePane.id = "glauka-flash-compose";
      composePane.hidden = true;
      const composeHead = el("strong", "glauka-compose-title");
      const composeNode = el("div", "glauka-compose-node");
      const qLabel = el("label", "v4-field");
      const qCaption = el("span");
      const qInput = el("input");
      qInput.type = "text";
      qInput.id = "glauka-compose-q";
      qInput.maxLength = 240;
      qLabel.append(qCaption, qInput);

      const aLabel = el("label", "v4-field");
      const aCaption = el("span");
      const aInput = el("textarea");
      aInput.id = "glauka-compose-a";
      aInput.rows = 4;
      aInput.maxLength = 700;
      aLabel.append(aCaption, aInput);

      const composeActions = el("div", "glauka-compose-actions");
      const saveBtn = el("button", "v4-primary");
      saveBtn.type = "button";
      saveBtn.id = "glauka-compose-save";
      const saveAnotherBtn = el("button", "v4-secondary");
      saveAnotherBtn.type = "button";
      saveAnotherBtn.id = "glauka-compose-save-another";
      const cancelComposeBtn = el("button", "v4-secondary");
      cancelComposeBtn.type = "button";
      composeActions.append(saveBtn, saveAnotherBtn, cancelComposeBtn);
      composePane.append(composeHead, composeNode, qLabel, aLabel, composeActions);
      libPane.after(composePane);

      let activeView = "study";
      let editingCardId = null;

      function currentTargetBreadcrumb() {
        const tab = a.tabs?.find?.((t) => t.id === a.activeTabId);
        const node = tab?.state?.findNode?.(tab?.state?.selectedNodeId) || tab?.state?.root;
        if (!node) return tr("Mappa corrente", "Current map");
        const parts = [];
        let cur = node;
        while (cur && parts.length < 4) {
          parts.unshift(cur.text);
          cur = tab.state.findNode(cur.parentId);
        }
        const title = String(tab.title || tr("Mappa", "Map")).trim();
        if (parts.length && String(parts[0] || "").trim().toLocaleLowerCase() === title.toLocaleLowerCase()) {
          parts.shift();
        }
        return [title, ...parts].filter(Boolean).join(" › ");
      }

      function renderArchive() {
        const query = libSearch.value.trim().toLocaleLowerCase();
        const kind = libFilter.value || "all";
        const now = Date.now();
        const allCards = Array.isArray(a.studyCards) ? a.studyCards.filter((c) => c && typeof c === "object") : [];
        const tabMap = new Map((a.tabs || []).map((t) => [t.id, t]));
        const items = allCards
          .filter((c) => {
            const tab = tabMap.get(c.sourceTabId);
            const stale = a.v5Staleness(c) !== "fresh";
            const dueAt = Number.isFinite(c.sr?.dueAt) && c.sr.dueAt > 0 ? c.sr.dueAt : 0;
            if (kind === "active" && c.sourceTabId !== a.activeTabId) return false;
            if (kind === "other" && tab) return false;
            if (kind === "review" && c.srStatus !== 1 && c.srStatus !== 2) return false;
            if (kind === "good" && c.srStatus !== 3) return false;
            if (kind === "due" && (stale || dueAt > now)) return false;
            if (query) {
              const hay = [
                c.question,
                c.answer,
                c.breadcrumb,
                tab?.title || "",
              ]
                .join(" ")
                .toLocaleLowerCase();
              if (!hay.includes(query)) return false;
            }
            return true;
          })
          .sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0));

        libCount.textContent =
          items.length +
          " " +
          tr("flashcard mostrate su", "flashcards shown out of") +
          " " +
          allCards.length;
        libList.replaceChildren();
        if (!items.length) {
          const empty = el(
            "div",
            "glauka-lib-empty",
            allCards.length
              ? tr(
                  "Nessuna flashcard corrisponde alla ricerca.",
                  "No flashcards match this search.",
                )
              : tr(
                  "Non ci sono ancora flashcard salvate. Creane una qui o generala con AI!",
                  "No saved flashcards yet. Create one right now or generate from a map!",
                ),
          );
          libList.append(empty);
          return;
        }
        for (const card of items.slice(0, 120)) {
          const tab = tabMap.get(card.sourceTabId);
          const node = a.v5FindStudyNode?.(card);
          const row = el("article", "glauka-lib-row");
          const top = el("div", "glauka-lib-row-top");
          const badge = el("span", "glauka-lib-badge");
          if (!tab) {
            badge.dataset.tone = "past";
            badge.textContent = tr("Mappa passata", "Past map");
          } else if (card.srStatus === 3) {
            badge.dataset.tone = "good";
            badge.textContent = tr("Consolidata", "Confident");
          } else if (card.srStatus === 1 || card.srStatus === 2) {
            badge.dataset.tone = "warn";
            badge.textContent = tr("Da ripassare", "Needs review");
          } else {
            badge.dataset.tone = "new";
            badge.textContent = card.manual ? tr("Manuale", "Manual") : tr("Nuova", "New");
          }
          const crumb = el(
            "small",
            "glauka-lib-crumb",
            a.v5FormatCardBreadcrumb
              ? a.v5FormatCardBreadcrumb(card)
              : (tab?.title || tr("Scheda non aperta", "Map closed")) +
                  " › " +
                  (card.breadcrumb || tr("Concetto", "Concept")),
          );
          const date = formatDate(card.sr?.lastReviewedAt || card.createdAt);
          if (date) crumb.textContent += " · " + date;
          top.append(badge, crumb);

          const qText = el("div", "glauka-lib-q", card.question);
          const aText = el("div", "glauka-lib-a", card.answer);
          const rowActions = el("div", "glauka-lib-actions");

          const studyOne = el("button", "v4-secondary", tr("▶ Studia", "▶ Study"));
          studyOne.type = "button";
          studyOne.addEventListener("click", () => {
            const filterEl = document.getElementById("flash-filter");
            if (filterEl) filterEl.value = "all";
            a._nmBriefStudy = false;
            a.restartFlashcards();
            const idx = (a._v5Deck || []).findIndex((x) => x.id === card.id);
            if (idx >= 0) a._v5CardIndex = idx;
            setView("study");
            a.renderFlashcard();
          });

          const editOne = el("button", "v4-secondary", tr("✎ Modifica", "✎ Edit"));
          editOne.type = "button";
          editOne.addEventListener("click", () => openComposer(card));

          const jumpOne = el("button", "v4-secondary", tr("🎯 Nodo", "🎯 Node"));
          jumpOne.type = "button";
          jumpOne.disabled = !node;
          jumpOne.addEventListener("click", () => {
            if (!node) return;
            modal.classList.add("hidden");
            a.teleportToNode?.(card.sourceNodeId, card.sourceTabId);
          });

          const delOne = el("button", "v4-secondary glauka-lib-del", "🗑");
          delOne.type = "button";
          delOne.title = tr("Elimina flashcard", "Delete flashcard");
          delOne.setAttribute("aria-label", delOne.title);
          delOne.addEventListener("click", () => {
            if (!confirm(tr("Eliminare questa flashcard e la sua cronologia?", "Delete this flashcard and its review history?")))
              return;
            a.studyCards = (a.studyCards || []).filter((x) => x.id !== card.id);
            a.scheduleSave();
            a.restartFlashcards();
            renderArchive();
          });

          rowActions.append(studyOne, editOne, jumpOne, delOne);
          row.append(top, qText, aText, rowActions);
          libList.append(row);
        }
      }

      function openComposer(cardToEdit = null) {
        editingCardId = cardToEdit?.id || null;
        if (cardToEdit) {
          qInput.value = cardToEdit.question || "";
          aInput.value = cardToEdit.answer || "";
          composeNode.textContent =
            tr("Concetto: ", "Concept: ") +
            (cardToEdit.breadcrumb || tr("Mappa salvata", "Saved map"));
        } else {
          qInput.value = "";
          aInput.value = "";
          composeNode.textContent =
            tr("Collegata a: ", "Linked to: ") + currentTargetBreadcrumb();
        }
        setView("compose");
        requestAnimationFrame(() => qInput.focus());
      }

      function saveComposed(keepAdding) {
        const question = qInput.value.trim();
        const answer = aInput.value.trim();
        if (!question || !answer) {
          a.showToast?.(
            tr(
              "Inserisci sia la domanda che la risposta.",
              "Enter both the question and the answer.",
            ),
            "FLASHCARD",
          );
          return;
        }
        if (editingCardId) {
          const updated = a.v5UpdateManualCard?.(editingCardId, { question, answer });
          if (updated) {
            editingCardId = null;
            a.restartFlashcards();
            a.showToast?.(tr("Flashcard aggiornata", "Flashcard updated"), "FLASHCARD");
            setView("study");
          }
          return;
        }
        const created = a.v5CreateManualCard?.({ question, answer });
        if (!created) return;
        const filterEl = document.getElementById("flash-filter");
        if (filterEl && filterEl.value !== "due" && filterEl.value !== "all")
          filterEl.value = "due";
        a.restartFlashcards();
        const idx = (a._v5Deck || []).findIndex((x) => x.id === created.id);
        if (idx >= 0) a._v5CardIndex = idx;
        a.renderFlashcard();
        a.showToast?.(tr("Flashcard salvata nel mazzo", "Flashcard saved to deck"), "FLASHCARD");
        if (keepAdding) {
          qInput.value = "";
          aInput.value = "";
          qInput.focus();
        } else {
          setView("study");
        }
      }

      function setView(view) {
        activeView = view;
        studyPane.hidden = view !== "study";
        libPane.hidden = view !== "library";
        composePane.hidden = view !== "compose";
        tabStudy.classList.toggle("is-active", view === "study");
        tabLib.classList.toggle("is-active", view === "library");
        tabCompose.classList.toggle("is-active", view === "compose");
        tabStudy.setAttribute("aria-selected", String(view === "study"));
        tabLib.setAttribute("aria-selected", String(view === "library"));
        tabCompose.setAttribute("aria-selected", String(view === "compose"));
        if (view === "library") renderArchive();
        if (view === "compose" && !editingCardId) {
          composeNode.textContent =
            tr("Collegata a: ", "Linked to: ") + currentTargetBreadcrumb();
        }
        refresh();
      }

      function refresh() {
        const value = summary(a);
        const current = a.v5CurrentCard?.();
        const deckLen = a._v5Deck?.length || 0;
        const cardPos = current ? (a._v5CardIndex || 0) + 1 : 0;

        if (modalHeadTitle)
          modalHeadTitle.textContent = tr(
            "🎴 Flashcard · Studio & Ripasso",
            "🎴 Flashcards · Study & Review",
          );
        if (modalHeadSub)
          modalHeadSub.textContent = tr(
            "Mazzi SM-2 · creazione manuale o AI · archivio di tutte le mappe",
            "SM-2 decks · manual or AI creation · saved across every map",
          );
        modal.setAttribute(
          "aria-label",
          tr("Flashcard · Studio e Ripasso", "Flashcards · Study & Review"),
        );

        tabStudy.textContent = tr("▶ Studia", "▶ Study");
        tabLib.textContent =
          tr("🗂 Archivio & Passato", "🗂 Archive & Past") + ` (${value.total})`;
        tabCompose.textContent = editingCardId
          ? tr("✎ Modifica card", "✎ Edit card")
          : tr("＋ Nuova card", "＋ New card");

        title.textContent = tr("Ripasso di oggi", "Today’s review");
        const reveal = document.getElementById("flash-reveal");
        if (reveal)
          reveal.textContent = a._flashShowAnswer
            ? tr("Nascondi risposta", "Hide answer")
            : tr("Mostra risposta", "Show answer");

        // Show predicted SM-2 intervals directly inside the 3 rating buttons.
        const r1 = document.getElementById("flash-rate-1");
        const r2 = document.getElementById("flash-rate-2");
        const r3 = document.getElementById("flash-rate-3");
        if (current && a.v5NextReviewLabel) {
          if (r1) r1.textContent = `1 · ${tr("Non so", "Don’t know")} · ${a.v5NextReviewLabel(current, 1)}`;
          if (r2) r2.textContent = `2 · ${tr("Incerto", "Unsure")} · ${a.v5NextReviewLabel(current, 2)}`;
          if (r3) r3.textContent = `3 · ${tr("Consolidato", "Confident")} · ${a.v5NextReviewLabel(current, 3)}`;
        } else if (root.GlaukaMobile) {
          for (const [id, it, en] of [
            ["flash-rate-1", "Non so", "Don’t know"],
            ["flash-rate-2", "Incerto", "Unsure"],
            ["flash-rate-3", "Ricordo bene", "Remember well"],
          ]) {
            const control = document.getElementById(id);
            if (control) control.textContent = tr(it, en);
          }
        }

        const pct = deckLen ? Math.round((cardPos / deckLen) * 100) : 0;
        meterFill.style.width = `${pct}%`;

        cardTools.hidden = !current;
        speakBtn.textContent = tr("🔊 Ascolta", "🔊 Listen");
        editCardBtn.textContent = tr("✎ Modifica", "✎ Edit");
        if (removeCardBtn) {
          removeCardBtn.textContent = tr("🗑 Elimina", "🗑 Delete");
          removeCardBtn.disabled = !current;
        }

        emptyCtas.hidden = Boolean(current || value.total > 0);
        emptyCreateBtn.textContent = tr("＋ Crea la prima flashcard", "＋ Create first flashcard");
        emptyGoogleBtn.textContent = tr("🔍 Gratis con Google AI Mode", "🔍 Free with Google AI Mode");
        emptyAiBtn.textContent = tr("✨ Genera con API AI", "✨ Generate with AI API");

        const empty = modal.querySelector(".flash-empty");
        if (empty && a._nmBriefStudy)
          empty.textContent = tr(
            "Sessione completata! Ottimo lavoro: fai una pausa o cambia filtro per ripassare altre carte.",
            "Session complete! Great work: take a break or change filter to review more cards.",
          );

        const wantedCount = Math.min(30, Math.max(3, Number(countInput?.value) || 10));
        for (const p of countPills) {
          const active = Number(p.dataset.count) === wantedCount;
          p.classList.toggle("is-active", active);
          p.setAttribute("aria-pressed", active ? "true" : "false");
        }

        const openTabs = Array.isArray(a.tabs) ? a.tabs.filter((t) => t?.state?.root) : [];
        const validIds = new Set(openTabs.map((t) => t.id));
        if (!Array.isArray(a._v5SelectedTabIds) || !a._v5SelectedTabIds.some((id) => validIds.has(id))) {
          a._v5SelectedTabIds = openTabs.length ? [a.activeTabId && validIds.has(a.activeTabId) ? a.activeTabId : openTabs[0].id] : [];
        } else {
          a._v5SelectedTabIds = a._v5SelectedTabIds.filter((id) => validIds.has(id));
        }
        const pickedSet = new Set(a._v5SelectedTabIds);
        if (scopeEl) {
          const scopeLabels = {
            active: tr("Mappa intera", "Current map"),
            selected: tr("Ramo selezionato", "Selected branch"),
            node: tr("Nodo selezionato", "Selected node"),
            selectedTabs: tr("Più schede (scegli)…", "Multiple maps (choose)…"),
            all: tr("Tutte le schede (max 8)", "All maps (max 8)"),
          };
          for (const opt of scopeEl.options) {
            if (scopeLabels[opt.value]) opt.textContent = scopeLabels[opt.value];
          }
        }
        const scopeVal = scopeEl?.value || "active";
        sheetPicker.hidden = scopeVal !== "selectedTabs";
        sheetAllBtn.textContent = tr("Tutte", "All");
        sheetActiveBtn.textContent = tr("Solo attiva", "Active only");
        sheetChipsWrap.replaceChildren();
        for (const t of openTabs.slice(0, 16)) {
          const checked = pickedSet.has(t.id);
          const chip = el("button", "glauka-sheet-chip" + (checked ? " is-checked" : ""), (checked ? "✓ " : "") + (t.title || tr("Mappa", "Map")));
          chip.type = "button";
          chip.dataset.tabId = t.id;
          chip.setAttribute("aria-pressed", checked ? "true" : "false");
          chip.addEventListener("click", () => {
            const cur = new Set(a._v5SelectedTabIds || []);
            if (cur.has(t.id) && cur.size > 1) cur.delete(t.id);
            else cur.add(t.id);
            a._v5SelectedTabIds = [...cur];
            refresh();
          });
          sheetChipsWrap.append(chip);
        }
        const targetCount = scopeVal === "all"
          ? Math.min(8, openTabs.length)
          : scopeVal === "selectedTabs"
            ? Math.min(8, Math.max(1, pickedSet.size))
            : 1;
        sheetPickerTitle.textContent = tr(
          `Schede incluse (${targetCount}):`,
          `Included maps (${targetCount}):`,
        );

        toolsTitle.textContent = tr(
          "✨ Crea flashcard con AI o Google · Archivio JSON",
          "✨ Create flashcards with AI or Google · JSON Archive",
        );
        scopeLabel.textContent = tr("Ambito", "Scope");
        countLabel.textContent = tr("Numero di flashcard", "Number of flashcards");
        apiTitle.textContent = tr("La tua AI · API", "Your AI · API");
        apiBadge.textContent = tr("Diretta", "Direct");
        apiHint.textContent = targetCount > 1
          ? tr(
              `Genera ~${wantedCount} flashcard distribuite su ${targetCount} schede.`,
              `Generates ~${wantedCount} flashcards across ${targetCount} maps.`,
            )
          : tr(
              "Usa il tuo modello configurato in AI Settings.",
              "Uses your configured AI Settings provider.",
            );
        if (genBtn) {
          genBtn.textContent = tr(
            `✨ Genera ${wantedCount} flashcard`,
            `✨ Generate ${wantedCount} flashcards`,
          );
        }
        if (regenBtn) regenBtn.textContent = tr("↻ Aggiorna obsolete", "↻ Refresh outdated");
        googleTitle.textContent = tr("Google AI Mode", "Google AI Mode");
        googleBadge.textContent = tr("0 crediti API", "0 API credits");
        googleHint.textContent = targetCount > 1
          ? tr(
              `Apri Google con prompt per ${wantedCount} flashcard su ${targetCount} schede.`,
              `Open Google with a ${wantedCount}-card prompt across ${targetCount} maps.`,
            )
          : tr(
              `Apri Google con prompt per ${wantedCount} flashcard, poi incolla sotto.`,
              `Open Google with a ${wantedCount}-card prompt, then paste below.`,
            );
        googleOpenBtn.textContent = tr(
          `🔍 Apri Google (${wantedCount})`,
          `🔍 Open Google (${wantedCount})`,
        );
        googleCopyBtn.textContent = tr("📋 Copia prompt", "📋 Copy prompt");
        googleTextarea.placeholder = tr(
          "Incolla le flashcard (D | R o D:/R:)…",
          "Paste flashcards (Q | A or Q:/A:)…",
        );
        googleImportBtn.textContent = tr("✓ Importa", "✓ Import");
        archiveLabel.textContent = tr("Archivio locale:", "Local deck:");
        if (exportBtn) exportBtn.textContent = tr("↓ Esporta", "↓ Export");
        if (importBtn) importBtn.textContent = tr("↑ Importa", "↑ Import");
        if (updateRow)
          updateRow.hidden = !current || a.v5Staleness(current) === "fresh";

        counts.textContent =
          value.due +
          " " +
          tr("da ripassare", "due") +
          " · " +
          value.reviewed +
          " " +
          tr("ripassate oggi", "reviewed today") +
          " · " +
          value.total +
          " " +
          tr("in archivio", "saved") +
          (value.stale
            ? " · " + value.stale + " " + tr("da aggiornare", "need updating")
            : "");

        action.disabled = false;
        if (value.due > 0) {
          action.textContent = tr("▶ Studia 10 scadenze", "▶ Study 10 due");
        } else if (value.total > 0) {
          action.textContent = tr("▶ Ripassa mazzo", "▶ Review deck") + ` (${value.total})`;
        } else {
          action.textContent = tr("＋ Nuova flashcard", "＋ New flashcard");
        }
        quickAdd.hidden = value.total === 0;
        quickAdd.textContent = tr("＋ Crea card", "＋ Add card");

        progress.textContent = a._nmBriefStudy
          ? tr("Ripassate", "Reviewed") +
            " · " +
            Math.min(a._v5CardIndex || 0, deckLen) +
            " / " +
            deckLen
          : "";

        // Keep Archive & Compose copy localized live.
        libSearch.placeholder = tr(
          "Cerca domanda, risposta, mappa o ramo…",
          "Search question, answer, map or branch…",
        );
        libAddBtn.textContent = tr("＋ Aggiungi card", "＋ Add card");
        composeHead.textContent = editingCardId
          ? tr("Modifica questa flashcard", "Edit this flashcard")
          : tr("Nuova flashcard manuale (offline)", "New manual flashcard (offline)");
        qCaption.textContent = tr("Domanda (Fronte)", "Question (Front)");
        qInput.placeholder = tr("Es. Cosa collega la valvola mitrale?", "E.g. What does the mitral valve connect?");
        aCaption.textContent = tr("Risposta (Retro)", "Answer (Back)");
        aInput.placeholder = tr("Scrivi una risposta chiara e sintetica…", "Write a clear, concise answer…");
        saveBtn.textContent = editingCardId
          ? tr("✓ Salva modifiche", "✓ Save changes")
          : tr("✓ Salva nel mazzo", "✓ Save to deck");
        saveAnotherBtn.hidden = Boolean(editingCardId);
        saveAnotherBtn.textContent = tr("✓ Salva e aggiungi un'altra", "✓ Save & add another");
        cancelComposeBtn.textContent = tr("Annulla", "Cancel");

        const filterSelect = document.getElementById("flash-filter");
        if (filterSelect) {
          const mapLabels = {
            due: [tr("In scadenza / mai studiate", "Due / unseen")],
            all: [tr("Tutte le flashcard salvate (incluse passate)", "All saved flashcards (past & current)")],
            active: [tr("Solo questa mappa", "Current map only")],
            subtree: [tr("Solo sotto-albero selezionato", "Selected branch only")],
            review: [tr("Difficili (Non so / Incerto)", "Difficult (Don’t know / Unsure)")],
            stale: [tr("Da aggiornare (mappa modificata)", "Need updating (map changed)")],
          };
          for (const opt of filterSelect.options) {
            if (mapLabels[opt.value]) opt.textContent = mapLabels[opt.value][0];
          }
        }
      }

      tabStudy.addEventListener("click", () => {
        editingCardId = null;
        setView("study");
      });
      tabLib.addEventListener("click", () => {
        editingCardId = null;
        setView("library");
      });
      tabCompose.addEventListener("click", () => openComposer(null));
      quickAdd.addEventListener("click", () => openComposer(null));
      libAddBtn.addEventListener("click", () => openComposer(null));
      emptyCreateBtn.addEventListener("click", () => openComposer(null));
      emptyGoogleBtn.addEventListener("click", () => {
        tools.open = true;
        a.v5OpenGoogleAIModeFlashcards?.();
        googleSection.scrollIntoView?.({ block: "nearest" });
      });
      emptyAiBtn.addEventListener("click", () => {
        tools.open = true;
        tools.scrollIntoView?.({ block: "nearest" });
      });
      scopeEl?.addEventListener("change", () => refresh());
      sheetAllBtn.addEventListener("click", () => {
        a._v5SelectedTabIds = (a.tabs || []).filter((t) => t?.state?.root).slice(0, 8).map((t) => t.id);
        refresh();
      });
      sheetActiveBtn.addEventListener("click", () => {
        a._v5SelectedTabIds = a.activeTabId ? [a.activeTabId] : [];
        refresh();
      });
      for (const pill of countPills) {
        pill.addEventListener("click", () => {
          if (countInput) countInput.value = pill.dataset.count || "10";
          refresh();
        });
      }
      countInput?.addEventListener("input", () => refresh());
      countInput?.addEventListener("change", () => {
        if (countInput) {
          const clamped = Math.min(30, Math.max(3, Number(countInput.value) || 10));
          countInput.value = String(clamped);
        }
        refresh();
      });
      googleOpenBtn.addEventListener("click", () => {
        tools.open = true;
        a.v5OpenGoogleAIModeFlashcards?.();
      });
      googleCopyBtn.addEventListener("click", () => {
        const scope = document.getElementById("v5-study-scope")?.value || "active";
        const count = document.getElementById("v5-study-count")?.value || 10;
        const built = a.v5BuildGoogleCardsPrompt?.(scope, count);
        if (!built) return;
        try {
          navigator.clipboard?.writeText?.(built.fullPrompt)?.catch?.(() => {});
        } catch {}
        a.showToast?.(
          tr("Prompt copiato: incollalo in Google AI Mode o nel tuo assistente", "Prompt copied: paste it into Google AI Mode or your assistant"),
          "FLASHCARD",
        );
      });
      googleImportBtn.addEventListener("click", () => {
        const scope = document.getElementById("v5-study-scope")?.value || "active";
        const added = a.v5ImportTextCards?.(googleTextarea.value, scope) || 0;
        if (!added) {
          a.showToast?.(
            tr(
              "Nessuna flashcard riconosciuta. Usa righe «Domanda | Risposta» o «D: … / R: …».",
              "No flashcards recognized. Use 'Question | Answer' or 'Q: ... / A: ...' lines.",
            ),
            "FLASHCARD",
          );
          return;
        }
        googleTextarea.value = "";
        const filterEl = document.getElementById("flash-filter");
        if (filterEl) filterEl.value = "due";
        a.restartFlashcards?.();
        setView("study");
        a.showToast?.(
          added + " " + tr("flashcard aggiunte al mazzo!", "flashcards added to deck!"),
          "FLASHCARD",
        );
      });

      speakBtn.addEventListener("click", () => a.v5SpeakFlashcard?.());
      editCardBtn.addEventListener("click", () => {
        const cur = a.v5CurrentCard?.();
        if (cur) openComposer(cur);
      });

      saveBtn.addEventListener("click", () => saveComposed(false));
      saveAnotherBtn.addEventListener("click", () => saveComposed(true));
      cancelComposeBtn.addEventListener("click", () => {
        editingCardId = null;
        setView("study");
      });

      libSearch.addEventListener("input", () => renderArchive());
      libFilter.addEventListener("change", () => renderArchive());

      action.addEventListener("click", () => {
        const val = summary(a);
        if (val.due > 0) {
          document.getElementById("flash-filter").value = "due";
          a.restartFlashcards();
          a._v5Deck = a._v5Deck.slice(0, 10);
          a._nmBriefStudy = true;
          setView("study");
          a.renderFlashcard();
          document
            .getElementById("flash-flip-card")
            ?.focus({ preventScroll: true });
        } else if (val.total > 0) {
          document.getElementById("flash-filter").value = "all";
          a.restartFlashcards();
          a._nmBriefStudy = false;
          setView("study");
          a.renderFlashcard();
          document
            .getElementById("flash-flip-card")
            ?.focus({ preventScroll: true });
        } else {
          openComposer(null);
        }
      });

      document.getElementById("flash-filter").addEventListener("change", () => {
        a._nmBriefStudy = false;
        a.restartFlashcards?.();
      });
      document.getElementById("flash-close").addEventListener("click", () => {
        a._nmBriefStudy = false;
        editingCardId = null;
      });

      const render = a.renderFlashcard;
      a.renderFlashcard = function (...args) {
        const out = render.apply(this, args);
        refresh();
        return out;
      };
      const open = a.openFlashcards;
      a.openFlashcards = function (...args) {
        this._nmBriefStudy = false;
        editingCardId = null;
        const out = open.apply(this, args);
        setView("study");
        return out;
      };
      new MutationObserver(() => {
        if (!modal.classList.contains("hidden")) a.renderFlashcard();
        else refresh();
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
      });

      refresh();
      return result;
    };
  }

  root.GlaukaStudyToday = { summary, install };
  if (typeof module === "object" && module.exports)
    module.exports = root.GlaukaStudyToday;
})(globalThis);
