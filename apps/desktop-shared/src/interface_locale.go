package main

import (
	"encoding/json"
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

func supportedInterfaceLocale(code string) bool {
	switch code {
	case "it", "en", "de", "es", "fr", "pt", "ar", "zh-CN":
		return true
	}
	return false
}
func readInterfaceLocale(config string) string {
	data, err := os.ReadFile(filepath.Join(config, "ui-locale.json"))
	if err != nil || len(data) > 512 {
		return defaultInterfaceLocale()
	}
	var preference struct {
		Locale string `json:"locale"`
	}
	if json.Unmarshal(data, &preference) != nil || !supportedInterfaceLocale(preference.Locale) {
		return defaultInterfaceLocale()
	}
	return preference.Locale
}

var interfaceCatalog struct {
	sync.Mutex
	code    string
	aliases map[string]string
	pack    map[string]string
}

func interfaceText(text, code string) string {
	interfaceCatalog.Lock()
	defer interfaceCatalog.Unlock()
	if interfaceCatalog.aliases == nil {
		data, _ := content.ReadFile("resources/locales/source.json")
		var source struct {
			Aliases map[string]string `json:"aliases"`
		}
		_ = json.Unmarshal(data, &source)
		interfaceCatalog.aliases = source.Aliases
	}
	if interfaceCatalog.code != code {
		data, _ := content.ReadFile("resources/locales/" + code + ".json")
		interfaceCatalog.pack = nil
		_ = json.Unmarshal(data, &interfaceCatalog.pack)
		interfaceCatalog.code = code
	}
	trim := strings.TrimSpace(text)
	id := interfaceCatalog.aliases[trim]
	if translated, ok := interfaceCatalog.pack[id]; ok {
		return strings.Replace(text, trim, translated, 1)
	}
	return text
}
func nativeInterfaceText(text string) string {
	return interfaceText(text, readInterfaceLocale(dataDir()))
}
func (s *service) interfaceLocaleRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/locales/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", 405)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/locales/")
		code := strings.TrimSuffix(name, ".json")
		if name != code+".json" || !supportedInterfaceLocale(code) {
			http.NotFound(w, r)
			return
		}
		data, err := content.ReadFile("resources/locales/" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Cache-Control", "private, max-age=0, must-revalidate")
		_, _ = w.Write(data)
	})
	mux.HandleFunc("/__desktop/interface-locale/write", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var request struct {
			Locale string `json:"locale"`
		}
		if !readJSON(w, r, &request, 1024) {
			return
		}
		if !supportedInterfaceLocale(request.Locale) {
			responseJSON(w, 400, response{Message: "Unsupported interface language"})
			return
		}
		data, _ := json.Marshal(request)
		if err := atomicFile(filepath.Join(s.configDir, "ui-locale.json"), data); err != nil {
			responseJSON(w, 500, response{Message: "Could not save interface language"})
			return
		}
		responseJSON(w, 200, response{Saved: true})
	})
}
func (s *service) localizedInterfacePage(page string) string {
	code := readInterfaceLocale(s.configDir)
	encoded, _ := json.Marshal(code)
	page = strings.Replace(page, `/* @glauka-initial-locale */ "it"`, string(encoded), 1)
	direction := "ltr"
	if code == "ar" {
		direction = "rtl"
	}
	page = strings.Replace(page, `<html class="glauka-booting" lang="it"`, `<html class="glauka-booting" lang="`+code+`" dir="`+direction+`"`, 1)
	messages := map[string]string{"slow": interfaceText("Avvio più lungo del previsto. Puoi riprovare.", code)}
	boot, _ := json.Marshal(messages)
	page = strings.Replace(page, `/* @glauka-boot-messages */ {}`, string(boot), 1)
	for _, text := range []string{"Prepariamo il tuo spazio…", "Riprova"} {
		page = strings.Replace(page, ">"+text+"</", ">"+html.EscapeString(interfaceText(text, code))+"</", 1)
	}
	return page
}
