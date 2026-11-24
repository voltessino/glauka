(function (root) {
  "use strict";
  function mount() {
    const locale = root.GlaukaI18n;
    // Desktop and the shared settings window own the language choice.
    // The Tools menu must not grow a second copy of the same control.
    if (root.NeuroMapSettingsCenter || !locale || document.getElementById("glauka-language-select"))
      return;
    const host = document.getElementById("dropdown-tools");
    if (!host) return;
    const field = document.createElement("div");
    field.className = "glauka-language-field nm6-skiptranslate";
    const label = document.createElement("label");
    label.htmlFor = "glauka-language-select";
    const select = document.createElement("select");
    select.id = "glauka-language-select";
    select.dir = "ltr";
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
      const previous = locale.locale();
      select.disabled = true;
      try {
        await locale.setLanguage(select.value);
      } catch (error) {
        select.value = previous;
        root.neuroMapApp?.showToast?.(
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
    field.append(label, select);
    host.append(field);
    update();
    root.addEventListener("glauka:language-change", update);
    new MutationObserver(update).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
  root.GlaukaLanguageMenu = Object.freeze({ mount });
})(globalThis);
