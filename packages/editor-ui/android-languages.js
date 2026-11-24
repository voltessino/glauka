/* Android uses the same offline catalogs; native option names stay recognizable. */
(function (root) {
  "use strict";
  function field(id) {
    const locale = root.GlaukaI18n,
      box = document.createElement("div");
    box.className = "glauka-language-field";
    const label = document.createElement("label"),
      select = document.createElement("select");
    label.htmlFor = id;
    select.id = id;
    select.dir = "ltr";
    select.setAttribute("data-glauka-language", "");
    for (const language of locale.languages) {
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = language.name;
      option.lang = language.code;
      option.dir = language.dir;
      select.append(option);
    }
    const update = () => {
      label.textContent = locale.pair(
        "Lingua dell’interfaccia",
        "Interface language",
      );
      select.setAttribute("aria-label", label.textContent);
      select.value = locale.locale();
    };
    select.addEventListener("change", async () => {
      if (root.NeuroMapAndroid74?.hasPendingLanguageEdits?.()) {
        update();
        root.neuroMapApp?.showToast(locale.pair(
          'Completa o annulla le modifiche prima di cambiare lingua.',
          'Save or cancel current edits before changing the language.',
        ));
        return;
      }
      select.disabled = true;
      try {
        await locale.setLanguage(select.value);
      } catch (error) {
        root.neuroMapApp?.showToast(
          locale.pair(
            "Impossibile caricare la lingua. La lingua precedente è stata mantenuta.",
            "Could not load the language. Your previous language was kept.",
          ),
        );
      } finally {
        select.disabled = false;
        update();
      }
    });
    root.addEventListener("glauka:language-change", update);
    update();
    box.append(label, select);
    return box;
  }
  function mount() {
    if (!root.GlaukaI18n) return;
    root.GlaukaLanguageMenu?.mount();
    const welcome = document.querySelector("#nm6-welcome section");
    if (welcome && !document.getElementById("glauka-welcome-language"))
      welcome.prepend(field("glauka-welcome-language"));
    function settings() {
      const panel = document.querySelector("#nm74-overlay .nm74-sheet");
      if (panel && !document.getElementById("glauka-android-language")) {
        panel.append(field("glauka-android-language"));
        return true;
      }
      return false;
    }
    if (!settings()) {
      const observer = new MutationObserver(() => {
        if (settings()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    const brand = document.querySelector(".brand-Mini");
    if (brand) {
      brand.setAttribute("aria-label", "Glauka");
      const icon = brand.querySelector(".brand-icon");
      if (icon) icon.innerHTML = root.GlaukaBrand?.svg || "";
      for (const node of brand.childNodes)
        if (node.nodeType === 3 && node.nodeValue.includes("NeuroMap"))
          node.nodeValue = node.nodeValue.replace(
            /NeuroMap(?: Architect)?/g,
            "Glauka",
          );
    }
  }
  root.GlaukaAndroidLanguages = Object.freeze({ mount });
})(globalThis);
