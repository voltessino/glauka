package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestClassifyLinkTargetRejectsUnsafeSchemes(t *testing.T) {
	for _, raw := range []string{"javascript:alert(1)", "data:text/html,hi", "vbscript:msg", "file://evil.example/secret", "../secret.txt", "relative.txt", ""} {
		if _, err := classifyLinkTarget(raw); err == nil {
			t.Fatal("accepted", raw)
		}
	}
	web, err := classifyLinkTarget("https://example.com/guida")
	if err != nil || web.Kind != "web" || web.Executable || web.Value != "https://example.com/guida" {
		t.Fatal(web, err)
	}
}

func TestClassifyLinkTargetKeepsFilesAndFlagsPrograms(t *testing.T) {
	dir := t.TempDir()
	note := filepath.Join(dir, "appunti.txt")
	if err := os.WriteFile(note, []byte("ciao"), 0600); err != nil {
		t.Fatal(err)
	}
	got, err := classifyLinkTarget(note)
	if err != nil || got.Kind != "file" || got.Executable || got.Value != note {
		t.Fatal(got, err)
	}
	program := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(program, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	flagged, err := classifyLinkTarget(program)
	if err != nil || !flagged.Executable {
		t.Fatal(flagged, err)
	}
	href := fileLinkHref(note)
	round, err := classifyLinkTarget(href)
	if err != nil || !strings.EqualFold(round.Value, note) {
		t.Fatal(href, round, err)
	}
}

func TestWorkspaceBatchFileSurvivesSave(t *testing.T) {
	s := qaService(t)
	path := filepath.Join(t.TempDir(), "mappe.gk")
	if err := os.WriteFile(path, []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.approvePath(path); err != nil {
		t.Fatal(err)
	}
	content := `{"schema":"NeuroMapArchitect-WorkspaceBatch-v6","activeTabId":"a","tabs":[{"id":"a","root":{"text":"Uno","notes":"Nota","linkUrl":"https://example.com/a","children":[]}},{"id":"b","root":{"text":"Due","children":[]}}]}`
	w := qaSave(t, s, path, content, "qa-session", nil)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	got := string(qaRead(t, path))
	if !strings.Contains(got, "NeuroMapArchitect-WorkspaceBatch-v6") || !strings.Contains(got, "https://example.com/a") || !strings.Contains(got, "Nota") {
		t.Fatal(got)
	}
}

func TestOpenLinkBlocksUnsafeTargetsAndPrograms(t *testing.T) {
	s := qaService(t)
	post := func(body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/__desktop/file/open-link", strings.NewReader(body))
		r.Header.Set("X-NeuroMap-Session", "qa-session")
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, r)
		return w
	}
	blocked := post(`{"target":"javascript:alert(1)"}`)
	if blocked.Code != 400 {
		t.Fatal(blocked.Code, blocked.Body.String())
	}
	dir := t.TempDir()
	program := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(program, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(program)
	if err != nil {
		t.Fatal(err)
	}
	asked := post(`{"target":` + string(encoded) + `}`)
	if asked.Code != 200 || !strings.Contains(asked.Body.String(), `"needsConfirm":true`) {
		t.Fatal(asked.Code, asked.Body.String())
	}
}
