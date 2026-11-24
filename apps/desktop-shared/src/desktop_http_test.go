package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDesktopSavePreservesOriginalXMindExtensionAndMakesSafetyCopy(t *testing.T) {
	d := t.TempDir()
	path := filepath.Join(d, "Anatomia.xmind")
	original := []byte("original raw XMind 8 ZIP from user")
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	s := &service{secret: "test-secret", configDir: d, active: make(map[string]*activeAIRequest)}
	if err := s.approvePath(path); err != nil {
		t.Fatal(err)
	}
	if !s.authorizedPath(path) {
		t.Fatal("approved path unavailable")
	}
	sheet := json.RawMessage(`{"title":"Anatomia","root":{"id":"root","text":"Anatomia","children":[{"id":"n1","text":"Braccio","children":[]}]},"images":[]}`)
	body, _ := json.Marshal(map[string]any{"json": "{\"root\":{\"text\":\"Anatomia\"}}", "filePath": path, "filename": "Anatomia.xmind", "saveAs": false, "xmindSheets": []json.RawMessage{sheet}})
	req := httptest.NewRequest(http.MethodPost, "/__desktop/file/save", bytes.NewReader(body))
	req.Header.Set("X-NeuroMap-Session", s.secret)
	response := httptest.NewRecorder()
	s.routes().ServeHTTP(response, req)
	if response.Code != 200 {
		t.Fatalf("save response %d: %s", response.Code, response.Body.String())
	}
	var result struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Path != path || result.Name != "Anatomia.xmind" {
		t.Fatalf("path changed: %+v", result)
	}
	output, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	z, err := zip.NewReader(bytes.NewReader(output), int64(len(output)))
	if err != nil {
		t.Fatalf("not an XMind ZIP: %v", err)
	}
	if len(z.File) < 4 {
		t.Fatal("XMind archive missing entries")
	}
	old, err := os.ReadFile(xmindBackupDestination(path))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(old, original) {
		t.Fatal("original not preserved in safety backup")
	}
}
