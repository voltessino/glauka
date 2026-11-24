package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInterfaceLocalePreferenceIsBoundedAndAllowlisted(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "ui-locale.json")
	if readInterfaceLocale(dir) != defaultInterfaceLocale() {
		t.Fatal("missing preference")
	}
	for _, code := range []string{"it", "en", "de", "es", "fr", "pt", "ar", "zh-CN"} {
		_ = os.WriteFile(path, []byte(`{"locale":"`+code+`"}`), 0600)
		if readInterfaceLocale(dir) != code {
			t.Fatal(code)
		}
	}
	for _, data := range []string{`{"locale":"../../secrets"}`, `{"locale":"zh-TW"}`, `broken`, strings.Repeat(" ", 513)} {
		_ = os.WriteFile(path, []byte(data), 0600)
		if readInterfaceLocale(dir) != defaultInterfaceLocale() {
			t.Fatal("untrusted locale accepted")
		}
	}
}
func TestInterfaceLocaleWriteRequiresSessionAndDoesNotTouchProjects(t *testing.T) {
	dir := t.TempDir()
	s := &service{secret: strings.Repeat("a", 43), configDir: dir}
	mux := http.NewServeMux()
	s.interfaceLocaleRoutes(mux)
	project := filepath.Join(dir, "workspace-autosave.json")
	_ = os.WriteFile(project, []byte("user project"), 0600)
	for _, tc := range []struct {
		body, token string
		status      int
	}{{`{"locale":"ar"}`, "", 403}, {`{"locale":"../"}`, s.secret, 400}, {`{"locale":"zh-CN"}`, s.secret, 200}} {
		r := httptest.NewRequest("POST", "/__desktop/interface-locale/write", strings.NewReader(tc.body))
		r.Header.Set("X-NeuroMap-Session", tc.token)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if readInterfaceLocale(dir) != "zh-CN" {
		t.Fatal("choice not persisted")
	}
	data, _ := os.ReadFile(project)
	if string(data) != "user project" {
		t.Fatal("project changed")
	}
	for _, url := range []string{"/locales/source.json", "/locales/secret.json", "/locales/zh-TW.json"} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", url, nil))
		if w.Code != 404 {
			t.Fatal(url, w.Code)
		}
	}
}

func TestAppleLanguageIdentifiers(t *testing.T) {
	for input, want := range map[string]string{"zh-Hans-CN": "zh-CN", "de-DE": "de", "es_ES.UTF-8": "es", "ar-SA": "ar", "pt-BR": "pt", "fr-CA": "fr", "ja-JP": "en", "../../secrets": "en", "": "en"} {
		if got := interfaceLocaleFromIdentifier(input); got != want {
			t.Fatalf("%q: got %s, want %s", input, got, want)
		}
	}
}
