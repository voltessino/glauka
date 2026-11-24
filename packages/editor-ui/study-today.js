/* A short review uses the existing cards and SRS; no synthetic progress or network. */
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
  function install(App) {
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args),
        a = this,
        modal = document.getElementById("flash-modal");
      if (!modal || document.getElementById("glauka-study-today"))
        return result;
      const box = document.createElement("section");
      box.id = "glauka-study-today";
      box.className = "glauka-study-today";
      const title = document.createElement("strong"),
        counts = document.createElement("p"),
        action = document.createElement("button"),
        progress = document.createElement("small");
      action.type = "button";
      action.id = "glauka-study-start";
      progress.id = "glauka-study-session-progress";
      progress.setAttribute("role", "status");
      box.append(title, counts, action, progress);
      modal.querySelector(".v4-modal-head").after(box);
      const tools = document.createElement("details");
      tools.id = "glauka-study-tools";
      tools.className = "glauka-study-tools";
      const toolsTitle = document.createElement("summary");
      tools.append(toolsTitle);
      box.after(tools);
      for (const row of [...modal.querySelectorAll(".v5-study-top")].slice(
        0,
        2,
      ))
        tools.append(row);

      function refresh() {
        const value = summary(a);
        title.textContent = tr("Ripasso di oggi", "Today’s review");
        const reveal = document.getElementById("flash-reveal");
        if (reveal)
          reveal.textContent = a._flashShowAnswer
            ? tr("Nascondi risposta", "Hide answer")
            : tr("Mostra risposta", "Show answer");
        if (root.GlaukaMobile) {
          for (const [id, it, en] of [
            ["flash-rate-1", "Non so", "Don’t know"],
            ["flash-rate-2", "Incerto", "Unsure"],
            ["flash-rate-3", "Ricordo bene", "Remember well"],
          ]) {
            const control = document.getElementById(id);
            if (control) control.textContent = tr(it, en);
          }
        }
        const empty = modal.querySelector(".flash-empty");
        if (empty && a._nmBriefStudy)
          empty.textContent = tr(
            "Sessione completata. Puoi fare una pausa o continuare con le altre carte.",
            "Session complete. Take a break or continue with the remaining cards.",
          );

        toolsTitle.textContent = tr(
          "Crea con AI e gestisci le carte",
          "Create with AI and manage cards",
        );
        const updateRow =
          document.getElementById("v5-card-update")?.parentElement;
        const current = a.v5CurrentCard?.();
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
          (value.stale
            ? " · " + value.stale + " " + tr("da aggiornare", "need updating")
            : "");
        action.textContent = value.due
          ? tr("Inizia con 10 carte", "Start with 10 cards")
          : tr("Nessuna carta in scadenza", "No cards due");
        action.disabled = !value.due;
        progress.textContent = a._nmBriefStudy
          ? tr("Ripassate", "Reviewed") +
            " · " +
            Math.min(a._v5CardIndex || 0, a._v5Deck?.length || 0) +
            " / " +
            (a._v5Deck?.length || 0)
          : "";
      }
      action.addEventListener("click", () => {
        document.getElementById("flash-filter").value = "due";
        a.restartFlashcards();
        a._v5Deck = a._v5Deck.slice(0, 10);
        a._nmBriefStudy = true;
        a.renderFlashcard();
        document
          .getElementById("flash-flip-card")
          ?.focus({ preventScroll: true });
      });
      document.getElementById("flash-filter").addEventListener("change", () => {
        a._nmBriefStudy = false;
        refresh();
      });
      document.getElementById("flash-close").addEventListener("click", () => {
        a._nmBriefStudy = false;
      });
      const render = a.renderFlashcard;
      a.renderFlashcard = function (...args) {
        const result = render.apply(this, args);
        refresh();
        return result;
      };
      const open = a.openFlashcards;
      a.openFlashcards = function (...args) {
        this._nmBriefStudy = false;
        const result = open.apply(this, args);
        refresh();
        return result;
      };
      new MutationObserver(()=>{if(!modal.classList.contains("hidden"))a.renderFlashcard();else refresh();}).observe(document.documentElement, {
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
