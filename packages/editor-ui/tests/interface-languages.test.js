const { test } = require("node:test"),
  assert = require("node:assert/strict");
const create = require("../interface-languages");
function fixture(options = {}) {
  const languages = ["it", "en", "de", "es", "fr", "pt", "ar", "zh-CN"].map(
    (code) => ({ code, name: code, dir: code === "ar" ? "rtl" : "ltr" }),
  );
  const source = {
    languages,
    entries: {
      save: { it: "Salva", en: "Save" },
      destination: { it: "Destinazione: {0}", en: "Destination: {0}" },
    },
    aliases: {
      Salva: "save",
      Save: "save",
      "Destinazione: {0}": "destination",
      "Destination: {0}": "destination",
    },
  };
  const store = new Map(),
    doc = {
      documentElement: { lang: "it" },
      readyState: "complete",
      body: null,
      createTreeWalker: () => ({ nextNode: () => false }),
      querySelectorAll: () => [],
    };
  const fetches = [];
  const root = {
    document: doc,
    NodeFilter: { SHOW_TEXT: 4 },
    localStorage: {
      getItem: (k) => store.get(k),
      setItem: (k, v) => store.set(k, v),
    },
    fetch: async (url) => {
      fetches.push(url);
      const code = decodeURIComponent(
        url.split("/").pop().replace(".json", ""),
      );
      return {
        ok: true,
        json: async () => ({
          save: code + " save",
          destination: code + " destination: {0}",
        }),
      };
    },
    ...options,
  };
  return { api: create(root, source), doc, store, fetches, root };
}
test("changing repeatedly between eight languages retains source identity and only one foreign catalog", async () => {
  const { api, doc } = fixture();
  await api.ready;
  let label = "Save";
  for (const code of ["de", "es", "fr", "pt", "ar", "zh-CN", "en", "it"]) {
    await api.setLanguage(code);
    label = api.translate(label);
    assert.equal(
      label,
      code === "it" ? "Salva" : code === "en" ? "Save" : code + " save",
    );
    assert.ok(api.inspect().loadedCatalogs.length <= 3);
    assert.equal(doc.documentElement.dir, code === "ar" ? "rtl" : "ltr");
  }
});
test("format slots retain project titles and Arabic prose is never mistaken for an icon prefix", async () => {
  const { api } = fixture();
  await api.ready;
  await api.setLanguage("ar");
  assert.equal(api.translate("Destination: Save"), "ar destination: Save");
  assert.equal(api.translate("الوجهة: Save"), "الوجهة: Save");
  assert.equal(
    api.translate("An authored sentence not in the UI catalog"),
    "An authored sentence not in the UI catalog",
  );
});
test("failed native preference writes and incomplete catalogs preserve the active language", async () => {
  const f = fixture({
    neuromapDesktop: {
      writeInterfaceLocale: async () => {
        throw Error("Disk unavailable");
      },
    },
  });
  await f.api.ready;
  await assert.rejects(f.api.setLanguage("de"), /Disk unavailable/);
  assert.equal(f.doc.documentElement.lang, "it");
  assert.equal(f.store.get("nm6_locale"), "it");
  const g = fixture({
    fetch: async () => ({ ok: true, json: async () => ({ save: "x" }) }),
  });
  await g.api.ready;
  await assert.rejects(g.api.setLanguage("es"), /Incomplete/);
  assert.equal(g.doc.documentElement.lang, "it");
});
test("late catalog responses cannot override a newer language choice", async () => {
  let release;
  const slow = new Promise((r) => (release = r));
  const f = fixture({
    fetch: async (url) => {
      if (url.includes("de.")) await slow;
      return {
        ok: true,
        json: async () => ({ save: url, destination: "Destination: {0}" }),
      };
    },
  });
  await f.api.ready;
  const first = f.api.setLanguage("de");
  await f.api.setLanguage("es");
  release();
  assert.equal(await first, false);
  assert.equal(f.doc.documentElement.lang, "es");
});
test("dynamic messages round-trip across successive foreign catalogs without translating captured titles", async () => {
  const { api } = fixture();
  await api.ready;
  let message = "Destination: Save";
  for (const code of ["de", "es", "ar", "zh-CN", "en", "it"]) {
    await api.setLanguage(code);
    message = api.translate(message);
    assert.equal(
      message,
      code === "it"
        ? "Destinazione: Save"
        : code === "en"
          ? "Destination: Save"
          : code + " destination: Save",
    );
  }
});
test("composed UI fragments translate while filenames remain unchanged across repeated switches", async () => {
  const { api } = fixture();
  await api.ready;
  api.pair("Salva ", "Save ");
  let label = "Save My $& report.neuromap";
  for (const code of ["de", "es", "ar", "zh-CN", "en", "it"]) {
    await api.setLanguage(code);
    label = api.translate(label);
    assert.equal(
      label,
      (code === "it" ? "Salva" : code === "en" ? "Save" : code + " save") +
        " My $& report.neuromap",
    );
  }
});

test("inherited object property names remain ordinary text", async () => {
  const { api } = fixture();
  await api.ready;
  await api.setLanguage("de");
  for (const text of ["constructor", "toString", "__proto__"]) {
    assert.equal(api.translate(text), text);
    assert.equal(api.pair(text, text), text);
  }
});
test("foreign-language Mac hints keep Command while ordinary filenames are not rewritten", async () => {
  const source = {
    languages: ["it", "en", "de"].map((code) => ({ code, dir: "ltr" })),
    entries: { paste: { it: "Incolla (Ctrl+V)", en: "Paste (Ctrl+V)" } },
    aliases: { "Incolla (Ctrl+V)": "paste", "Paste (Ctrl+V)": "paste" },
  };
  const api = create(
    {
      fetch: async () => ({
        ok: true,
        json: async () => ({ paste: "Einfügen (Ctrl+V)" }),
      }),
    },
    source,
  );
  await api.setLanguage("de", false);
  assert.equal(api.translate("Paste (⌘+V)", "de"), "Einfügen (⌘+V)");
  assert.equal(
    api.translate("Report ⌘+V.neuromap", "de"),
    "Report ⌘+V.neuromap",
  );
});

test("Android starts in the device language when no preference exists", async () => {
  const { api, doc } = fixture({
    GlaukaMobile: true,
    navigator: { languages: ["zh-CN"], language: "zh-CN" },
  });
  await api.ready;
  assert.equal(doc.documentElement.lang, "zh-CN");
});
test("Android native preference wins and a failed native write leaves the language unchanged", async () => {
  const attempts = [];
  const { api, doc } = fixture({
    GlaukaMobile: true,
    navigator: { language: "es" },
    NMAndroid: {
      getInterfaceLocale: () => "de",
      setInterfaceLocale: (code) => {
        attempts.push(code);
        return false;
      },
    },
  });
  await api.ready;
  assert.equal(doc.documentElement.lang, "de");
  await assert.rejects(api.setLanguage("ar"), /save interface language/);
  assert.deepEqual(attempts, ["ar"]);
  assert.equal(doc.documentElement.lang, "de");
});

test("icon-prefixed explicit labels retain their wording when aliases share a translation", async () => {
  const source = {
    languages: ["it", "en"].map((code) => ({ code, dir: "ltr" })),
    entries: { search: { it: "Cerca una mappa", en: "Search maps" } },
    aliases: {
      "Cerca nelle mappe": "search",
      "Search maps": "search",
      "Cerca una mappa": "search",
    },
  };
  const api = create(
    {
      document: {
        documentElement: { lang: "it" },
        body: null,
        querySelectorAll: () => [],
        createTreeWalker: () => ({ nextNode: () => false }),
      },
      NodeFilter: { SHOW_TEXT: 4 },
    },
    source,
  );
  await api.ready;
  const label = api.pair("Cerca nelle mappe", "Search maps");
  assert.equal(api.translate("◎ " + label), "◎ Cerca nelle mappe");
  await api.setLanguage("en");
  assert.equal(
    api.translate("◎ " + api.pair("Cerca nelle mappe", "Search maps")),
    "◎ Search maps",
  );
});
