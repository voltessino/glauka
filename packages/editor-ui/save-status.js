/* Shared save/recovery feedback. A recovery copy never clears project dirtiness. */
(function (root) {
  "use strict";
  function tracker() {
    let revision = 0,
      operation = 0,
      state = "unknown";
    return {
      pending() {
        revision++;
        state = "pending";
      },
      begin() {
        state = "saving";
        return { revision, operation: ++operation };
      },
      finish(job, ok) {
        if (job.operation === operation)
          state = ok
            ? job.revision === revision
              ? "ready"
              : "pending"
            : "error";
      },
      get state() {
        return state;
      },
    };
  }
  const tr = (it, en) =>
    globalThis.GlaukaI18n?.pair(it, en) ??
    (document.documentElement.lang === "en" ? en : it);
  function install(App, IO) {
    const recoveries = new WeakMap(),
      lastSavedAt = new WeakMap(),
      get = (a) => {
        if (!recoveries.has(a)) recoveries.set(a, tracker());
        return recoveries.get(a);
      };
    function refresh(a) {
      const button = a._nmSaveStatus;
      if (!button) return;
      const tab = a.tabs?.find((t) => t.id === a.activeTabId);
      if (!tab) return;
      const recState = get(a).state;
      if (recState === "ready") lastSavedAt.set(a, new Date());
      const file = tab._nmSavingFile
        ? tr("Salvataggio su file in corso…", "Saving file…")
        : tab.state.isDirty
          ? tr("Modifiche non ancora salvate su file", "Changes not yet saved to file")
          : tab.filePath || tab.fileHandle || tab._nmFileSaveConfirmed
            ? tr("Tutte le modifiche salvate su file", "All changes saved to file")
            : tr("Bozza in questa scheda (mai salvata su file)", "Draft tab (not yet saved to file)");
      const recovery = {
        unknown: tr(
          "Copia automatica locale attiva su questo dispositivo",
          "Local automatic recovery active on this device",
        ),
        pending: tr("Aggiornamento copia di recupero…", "Updating recovery copy…"),
        saving: tr("Salvataggio copia di recupero…", "Saving recovery copy…"),
        ready: tr("Copia di recupero aggiornata", "Recovery copy up to date"),
        error: tr(
          "Recupero non riuscito: esporta una copia",
          "Recovery failed: export a copy",
        ),
      }[recState];
      const label = {
        unknown: tr("Auto-salvataggio", "Auto-recovery"),
        pending: tr("Sincronizzo…", "Syncing…"),
        saving: tr("Salvataggio…", "Saving…"),
        ready: tr("Copia aggiornata", "Recovery up to date"),
        error: tr("Controlla il salvataggio", "Check your save"),
      }[recState];
      if (recState === "error" && button.dataset.recovery !== "error")
        a.showToast?.(recovery, tr("Salvataggio", "Save"));
      let labelSpan = button.querySelector?.(":scope > span.nm-save-status-label");
      if (!labelSpan && typeof document.createElement === "function") {
        labelSpan = document.createElement("span");
        labelSpan.className = "nm-save-status-label";
        for (const node of [...(button.childNodes || [])]) {
          if (node.nodeType === 3) node.remove();
        }
        button.append(labelSpan);
      }
      if (labelSpan) {
        if (labelSpan.textContent !== label) labelSpan.textContent = label;
      } else if (button.textContent !== label) {
        button.textContent = label;
      }
      button.title =
        tr("Scheda corrente: ", "Current tab: ") + file + ". " + recovery + ".";
      button.setAttribute("aria-label", button.title);
      button.dataset.recovery = recState;
      button._nmDescription = button.title;
      const indicator = a._nmSaveIndicator;
      if (indicator) {
        const symbols = {
          unknown: "✓",
          pending: "•",
          saving: "↻",
          ready: "✓",
          error: "!",
        };
        indicator.querySelector("b").textContent = symbols[recState];
        indicator.querySelector("span").textContent =
          recState === "ready"
            ? tab.state.isDirty
              ? tr("Recupero OK · salva file", "Recovery OK · save file")
              : tr("Recupero OK", "Recovery OK")
            : recState === "pending"
              ? tr("Salvataggio…", "Saving…")
              : recState === "error"
                ? tr("Errore backup", "Backup error")
                : tr("Protetto", "Protected");
        indicator.title = button.title;
        indicator.setAttribute("aria-label", label + ". " + button.title);
        indicator.dataset.recovery = recState;
        indicator.dataset.dirty = tab.state.isDirty ? "true" : "false";
      }
    }

    function openDialog(a, button) {
      refresh(a);
      const tab = a.tabs?.find((t) => t.id === a.activeTabId);
      const blocked = a._nmRecoveryBlocked === true;
      const recState = get(a).state;
      const savedTime = lastSavedAt.get(a);
      const tabsCount = (a.tabs || []).length;
      const timeLabel = savedTime
        ? savedTime.toLocaleTimeString(document.documentElement.lang === "en" ? "en-GB" : "it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : tr("in questa sessione", "this session");

      let modal = document.getElementById("nm-save-status-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "nm-save-status-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "nm-save-modal-title");
        modal.className = "nm-save-status-curtain nm6-skiptranslate";
        const style = document.createElement("style");
        style.id = "nm-save-status-modal-style";
        style.textContent = `
.nm-save-status-curtain:not([hidden]){position:fixed;inset:0;z-index:9400;display:grid;place-items:center;padding:16px;background:rgba(15,23,42,.56);backdrop-filter:blur(6px);box-sizing:border-box}
.nm-save-status-curtain[hidden]{display:none!important}
.nm-save-card{
  width:min(520px,100%);border-radius:18px;border:1px solid var(--nm-skin-stroke,#d7deed);
  background:var(--nm-skin-surface,#ffffff);color:var(--nm-skin-ink,#141926);
  box-shadow:0 24px 64px rgba(15,23,42,.26);overflow:hidden;
  font:13.5px/1.5 Inter,system-ui,-apple-system,sans-serif;
}
.nm-save-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--nm-skin-stroke,#d7deed)}
.nm-save-head-left{display:flex;align-items:center;gap:11px;min-width:0}
.nm-save-badge{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,#10b981 14%,transparent);color:#059669;border:1px solid color-mix(in srgb,#10b981 35%,transparent)}
.nm-save-badge[data-tone="warn"]{background:color-mix(in srgb,#f59e0b 15%,transparent);color:#d97706;border-color:color-mix(in srgb,#f59e0b 40%,transparent)}
.nm-save-badge[data-tone="error"]{background:color-mix(in srgb,#ef4444 15%,transparent);color:#dc2626;border-color:color-mix(in srgb,#ef4444 40%,transparent)}
.nm-save-head h2{margin:0;font-size:16px;font-weight:750;line-height:1.2}
.nm-save-sub{font-size:11.5px;color:var(--nm-skin-muted,#5c6680);display:block;margin-top:2px}
.nm-save-close{width:32px;height:32px;border-radius:9px;border:1px solid var(--nm-skin-stroke,#d7deed);background:var(--nm-skin-top,#f4f6fc);color:inherit;cursor:pointer;display:grid;place-items:center}
.nm-save-body{display:grid;gap:12px;padding:16px 18px}
.nm-save-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nm-save-tile{padding:10px 12px;border-radius:12px;border:1px solid var(--nm-skin-stroke,#d7deed);background:var(--nm-skin-top,#f4f6fc);display:grid;gap:4px;align-content:start}
.nm-save-tile small{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--nm-skin-muted,#5c6680)}
.nm-save-tile strong{font-size:12.5px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}
.nm-save-tile span{font-size:11.5px;color:var(--nm-skin-muted,#5c6680);line-height:1.35}
.nm-save-alert{padding:10px 12px;border-radius:11px;border:1px solid color-mix(in srgb,#ef4444 45%,transparent);background:color-mix(in srgb,#ef4444 9%,transparent);font-size:12px;line-height:1.45}
.nm-save-actions{display:grid;gap:8px}
.nm-save-action-btn{
  display:flex!important;align-items:center!important;gap:12px;width:100%;text-align:left;
  padding:11px 13px;border-radius:12px;border:1px solid var(--nm-skin-stroke,#d7deed);
  background:var(--nm-skin-top,#f4f6fc);color:var(--nm-skin-ink,#141926);cursor:pointer;
}
.nm-save-action-btn:hover{border-color:var(--nm-theme-focus,#7c5ce7)}
.nm-save-action-btn[data-primary="true"]{
  background:var(--nm-theme-action,#5b3fd0)!important;border-color:var(--nm-theme-action,#5b3fd0)!important;color:var(--nm-theme-on-action,#ffffff)!important;
}
.nm-save-action-btn[data-primary="true"] *{color:inherit!important}
.nm-save-action-btn[data-primary="true"] small{opacity:.9}
.nm-save-action-copy{display:grid;gap:1px;min-width:0;flex:1}
.nm-save-action-copy strong{font-size:13px;font-weight:700}
.nm-save-action-copy small{font-size:11.5px;color:var(--nm-skin-muted,#5c6680);line-height:1.35}
@media(max-width:540px){.nm-save-grid{grid-template-columns:1fr}}
        `;
        document.head.append(style);
        document.body.append(modal);
      }

      const prevFocus = document.activeElement;
      const closeModal = () => {
        modal.hidden = true;
        modal.replaceChildren();
        prevFocus?.focus?.();
      };

      modal.replaceChildren();
      const card = document.createElement("section");
      card.className = "nm-save-card";

      const head = document.createElement("header");
      head.className = "nm-save-head";
      const headLeft = document.createElement("div");
      headLeft.className = "nm-save-head-left";
      const badge = document.createElement("div");
      badge.className = "nm-save-badge";
      const isError = blocked || recState === "error";
      const isDirty = !!tab?.state?.isDirty;
      badge.dataset.tone = isError ? "error" : isDirty ? "warn" : "ok";
      badge.innerHTML = isError
        ? '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>'
        : '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>';

      const headCopy = document.createElement("div");
      const h2 = document.createElement("h2");
      h2.id = "nm-save-modal-title";
      h2.textContent = tr("Salvataggio e backup", "Saving and backup");
      const sub = document.createElement("span");
      sub.className = "nm-save-sub";
      sub.textContent = `${tab?.title || "Glauka"} · ${tabsCount} ${tr(tabsCount === 1 ? "scheda aperta" : "schede aperte", tabsCount === 1 ? "open tab" : "open tabs")}`;
      headCopy.append(h2, sub);
      headLeft.append(badge, headCopy);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "nm-save-close";
      closeBtn.setAttribute("aria-label", tr("Chiudi", "Close"));
      closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
      closeBtn.addEventListener("click", closeModal);
      head.append(headLeft, closeBtn);

      const body = document.createElement("div");
      body.className = "nm-save-body";

      if (blocked) {
        const alert = document.createElement("div");
        alert.className = "nm-save-alert";
        alert.textContent = tr(
          "Le copie automatiche precedenti non sono leggibili. Apri o esporta un backup dei progetti aperti prima di riprendere.",
          "Previous automatic recovery copies cannot be read. Open or export a backup of your open projects before resuming.",
        );
        body.append(alert);
      }

      const grid = document.createElement("div");
      grid.className = "nm-save-grid";

      const fileTile = document.createElement("div");
      fileTile.className = "nm-save-tile";
      const fileLabel = document.createElement("small");
      fileLabel.textContent = tr("File della mappa", "Map file");
      const fileStrong = document.createElement("strong");
      fileStrong.textContent = tab?.fileName || tr("Non ancora salvato su file", "Not saved to file yet");
      const fileDesc = document.createElement("span");
      fileDesc.textContent = isDirty
        ? tr("Ci sono modifiche recenti da salvare su file.", "Recent edits have not been written to the file yet.")
        : (tab?.filePath || tab?.fileHandle || tab?._nmFileSaveConfirmed)
          ? tr("Allineato con il file sul dispositivo.", "Synced with your saved file on disk.")
          : tr("Scegli Salva progetto per salvarla in .gk o .xmind.", "Choose Save project to write a .gk or .xmind file.");
      fileTile.append(fileLabel, fileStrong, fileDesc);

      const recTile = document.createElement("div");
      recTile.className = "nm-save-tile";
      const recLabel = document.createElement("small");
      recLabel.textContent = tr("Recupero automatico sul PC", "Local auto-recovery");
      const recStrong = document.createElement("strong");
      recStrong.textContent = recState === "error"
        ? tr("Errore salvataggio locale", "Local save error")
        : tr("Copia protetta sul dispositivo", "Protected on this device");
      const recDesc = document.createElement("span");
      recDesc.textContent = recState === "ready"
        ? tr("Ultimo aggiornamento: ", "Last saved: ") + timeLabel
        : tr("Conserva le schede aperte su questo dispositivo tra una sessione e l'altra.", "Keeps your open tabs safe across restarts on this device.");
      recTile.append(recLabel, recStrong, recDesc);

      grid.append(fileTile, recTile);
      body.append(grid);

      const actions = document.createElement("div");
      actions.className = "nm-save-actions";
      const addAction = (title, desc, iconPath, primary, onClick) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nm-save-action-btn";
        if (primary) b.dataset.primary = "true";
        const ic = document.createElement("span");
        ic.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPath}</svg>`;
        const cp = document.createElement("div");
        cp.className = "nm-save-action-copy";
        const st = document.createElement("strong");
        st.textContent = title;
        const sm = document.createElement("small");
        sm.textContent = desc;
        cp.append(st, sm);
        b.append(ic, cp);
        b.addEventListener("click", async () => {
          closeModal();
          await onClick();
          refresh(a);
        });
        actions.append(b);
      };

      addAction(
        tr("Salva progetto su file", "Save project to file"),
        tr("Salva subito la mappa corrente in un file .gk o .xmind.", "Write the current tab directly to a .gk or .xmind file."),
        '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
        !blocked,
        async () => {
          if (a.saveActiveTabSafe) await a.saveActiveTabSafe();
          else await a.saveProjectFile();
        },
      );

      if (root.GlaukaVersionHistory?.open && tab?.filePath) {
        addAction(
          tr("Cronologia versioni (Time Machine)", "Version history (Time Machine)"),
          tr("Confronta i salvataggi precedenti o apri una vecchia copia.", "Compare earlier file saves and open a separate copy."),
          '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
          false,
          async () => root.GlaukaVersionHistory.open(a),
        );
      }

      if (blocked) {
        addAction(
          tr("Apri un backup esistente", "Open an existing backup"),
          tr("Carica un file di backup salvato in precedenza.", "Load a previously exported backup file."),
          '<path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2z"/>',
          false,
          async () => {
            a.importMode = "new";
            document.getElementById("file-import-input")?.click();
          },
        );
      }

      addAction(
        blocked ? tr("Esporta backup completo e riprendi", "Export full backup and resume") : tr("Esporta backup completo di tutte le schede", "Export full backup of all tabs"),
        tr("Crea un file archivio con tutte le mappe aperte, utile per cambiare PC o tenere una copia esterna.", "Download one file with every open tab, ideal for moving PCs or safe off-device copies."),
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
        blocked,
        async () => {
          if ((await a.io.exportBatchWorkspaceJSON()) === true && blocked) {
            a._nmRecoveryBlocked = false;
            await a.persistWorkspace();
          }
        },
      );

      body.append(actions);
      card.append(head, body);
      modal.append(card);
      modal.hidden = false;
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };
      modal.onkeydown = (e) => {
        if (e.key === "Escape") { e.preventDefault(); closeModal(); }
      };
      closeBtn.focus();
    }

    const trackFile = (a, tab, task) => {
      if (!tab) return task();
      tab._nmSavingFile = (tab._nmSavingFile || 0) + 1;
      refresh(a);
      const finish = () => {
        tab._nmSavingFile--;
        refresh(a);
      };
      try {
        const out = task();
        if (out && typeof out.then === "function")
          return out.then(
            (value) => {
              finish();
              return value;
            },
            (error) => {
              finish();
              throw error;
            },
          );
        finish();
        return out;
      } catch (error) {
        finish();
        throw error;
      }
    };
    for (const key of ["saveProjectFile", "exportJSON"]) {
      const original = IO?.prototype[key];
      if (!original) continue;
      IO.prototype[key] = function (...args) {
        if (key === "exportJSON" && !root.NMAndroid?.saveProject)
          return original.apply(this, args);
        const a = this.app;
        return trackFile(
          a,
          a.tabs.find((t) => t.id === a.activeTabId),
          () => original.apply(this, args),
        );
      };
    }
    const desktop = root.NM614;
    if (desktop && !desktop._nmStatusTracked) {
      const original = desktop.performSave;
      desktop._nmStatusTracked = true;
      desktop.performSave = function (a, tab, ...args) {
        return trackFile(a, tab, () => original.call(this, a, tab, ...args));
      };
    }
    const schedule = App.prototype.scheduleSave;
    App.prototype.scheduleSave = function (...args) {
      get(this).pending();
      const out = schedule.apply(this, args);
      refresh(this);
      return out;
    };
    const persist = App.prototype.persistWorkspace;
    App.prototype.persistWorkspace = function (...args) {
      const tracking = get(this),
        job = tracking.begin();
      refresh(this);
      const finish = (ok) => {
        tracking.finish(job, ok === true);
        refresh(this);
        return ok;
      };
      try {
        const out = persist.apply(this, args);
        if (out && typeof out.then === "function")
          return out.then(finish, (error) => {
            finish(false);
            throw error;
          });
        return finish(out);
      } catch (error) {
        finish(false);
        throw error;
      }
    };
    root.NeuroMapSaveStatus.report = (a, ok) => {
      const t = get(a),
        job = t.begin();
      t.finish(job, ok);
      refresh(a);
    };
    const tabs = App.prototype.renderTabBar;
    App.prototype.renderTabBar = function (...args) {
      const out = tabs.apply(this, args);
      refresh(this);
      return out;
    };
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const out = bind.apply(this, args),
        a = this,
        menu = document.getElementById("dropdown-file");
      if (!menu) return out;
      const button = document.createElement("button");
      button.type = "button";
      button.id = "nm-save-status";
      button.setAttribute("aria-live", "polite");
      button.setAttribute("aria-atomic", "true");
      button.className = "dropdown-item nm6-skiptranslate";
      a._nmSaveStatus = button;
      const auto = document.getElementById("nm611-autosave-open");
      if (auto && auto.parentElement === menu) auto.after(button);
      else menu.append(button);
      refresh(a);
      button.addEventListener("click", () => {
        a.hideMenus?.();
        openDialog(a, button);
      });
      function mountIndicator() {
        if (a._nmSaveIndicator) return true;
        const mobile = document.getElementById("glauka-app-header"),
          desktop = document.getElementById("tabs-list")?.parentElement;
        if (root.GlaukaMobile && !mobile) return false;
        const host = mobile || desktop;
        if (!host) return false;
        const indicator = document.createElement("button");
        indicator.id = "glauka-save-indicator";
        indicator.type = "button";
        indicator.className = "glauka-save-indicator";
        indicator.innerHTML = '<b aria-hidden="true"></b><span></span>';
        indicator.addEventListener("click", () => openDialog(a, button));
        a._nmSaveIndicator = indicator;
        if (mobile)
          mobile.insertBefore(
            indicator,
            document.getElementById("glauka-undo"),
          );
        else
          host.insertBefore(indicator, document.getElementById("btn-new-tab"));
        if (!document.getElementById("glauka-save-feedback-style")) {
          const style = document.createElement("style");
          style.id = "glauka-save-feedback-style";
          style.textContent =
            ".glauka-save-indicator{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;min-height:36px;padding:5px 10px;border:1px solid var(--border-color,#ddd5ee);border-radius:10px;background:var(--panel-bg,#fff);color:var(--text-main,#30274c);font:inherit;font-size:12px;font-weight:600;cursor:pointer}.glauka-save-indicator b{font-size:15px;color:#059669}.glauka-save-indicator[data-dirty='true'] b{color:#d97706}.glauka-save-indicator[data-recovery='error']{border-color:#bf3f47;color:var(--text-main,#30274c);background:color-mix(in srgb,var(--panel-bg,#fff) 88%,#bf3f47 12%)}.glauka-save-indicator[data-recovery='error'] b{color:#dc2626}.glauka-save-indicator:focus-visible{outline:2px solid #7954e9;outline-offset:2px}body.glauka-mobile-app #glauka-save-indicator{width:44px;height:44px;min-height:44px;padding:4px;justify-content:center;background:#fff;color:#493d67;border-color:#ddd5ee}body.glauka-mobile-app #glauka-save-indicator span{display:none}@media(max-width:1100px){.glauka-save-indicator span{display:none}}";
          document.head.append(style);
        }
        refresh(a);
        return true;
      }
      if (!mountIndicator()) {
        const observer = new MutationObserver(() => {
          if (mountIndicator()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      new MutationObserver(() => refresh(a)).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
      });
      return out;
    };
  }
  root.NeuroMapSaveStatus = { tracker, install };
})(globalThis);
