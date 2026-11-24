package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEditorPreferencesBounds(t *testing.T) {
	for _, tc := range []struct {
		p    editorPreferences
		want bool
	}{
		{editorPreferences{Compactness: 55, BranchGapX: 30}, true},
		{editorPreferences{Compactness: 145, BranchGapX: 220}, true},
		{editorPreferences{Compactness: 95, BranchGapX: 85}, true},
		{editorPreferences{Compactness: 50, BranchGapX: 30}, false},
		{editorPreferences{Compactness: 90, BranchGapX: 10}, false},
		{editorPreferences{Compactness: 56, BranchGapX: 30}, false},
		{editorPreferences{Compactness: 55, BranchGapX: 31}, false},
	} {
		if got := validEditorPreferences(tc.p); got != tc.want {
			t.Errorf("validEditorPreferences(%+v) = %v; want %v", tc.p, got, tc.want)
		}
	}
}

func TestEditorPreferencesPersistAndRejectInvalidValues(t *testing.T) {
	dir := t.TempDir()
	s := &service{secret: "test-secret", configDir: dir}
	mux := http.NewServeMux()
	s.editorPreferencesRoutes(mux)
	request := func(route, jsonText string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", route, strings.NewReader(jsonText))
		r.Header.Set("X-NeuroMap-Session", "test-secret")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	before := request("/__desktop/editor-preferences/read", "{}")
	if before.Code != 200 || strings.Contains(before.Body.String(), "compactness") {
		t.Fatalf("expected empty preferences: %d %s", before.Code, before.Body.String())
	}
	good := request("/__desktop/editor-preferences/write", `{"json":"{\"compactness\":90,\"branchGapX\":95}"}`)
	if good.Code != 200 {
		t.Fatalf("write: %d %s", good.Code, good.Body.String())
	}
	saved, err := os.ReadFile(filepath.Join(dir, "editor-preferences.json"))
	if err != nil || !strings.Contains(string(saved), `"compactness":90`) {
		t.Fatalf("preferences missing: %s %v", saved, err)
	}
	bad := request("/__desktop/editor-preferences/write", `{"json":"{\"compactness\":10,\"branchGapX\":95}"}`)
	if bad.Code != 400 {
		t.Fatalf("invalid input accepted: %d", bad.Code)
	}
	after, err := os.ReadFile(filepath.Join(dir, "editor-preferences.json"))
	if err != nil || string(after) != string(saved) {
		t.Fatal("invalid write damaged saved preferences")
	}
	view := request("/__desktop/editor-preferences/read", "{}")
	if view.Code != 200 || !strings.Contains(view.Body.String(), "compactness") {
		t.Fatalf("could not read: %d %s", view.Code, view.Body.String())
	}
}
