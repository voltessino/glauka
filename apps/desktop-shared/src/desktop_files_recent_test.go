package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRecentApprovedProjectsSortedDescendingByModTimeAndSecured(t *testing.T) {
	dir := t.TempDir()
	s := &service{secret: "recent-secret", configDir: dir, active: make(map[string]*activeAIRequest)}

	baseTime := time.Now().Add(-24 * time.Hour)
	var expectedOrder []string
	var paths []string
	for i := 0; i < 12; i++ {
		p := filepath.Join(dir, fmt.Sprintf("map-%02d.gk", i))
		if err := os.WriteFile(p, []byte(fmt.Sprintf(`{"root":{"id":"r","text":"Map %02d","children":[]}}`, i)), 0600); err != nil {
			t.Fatal(err)
		}
		mt := baseTime.Add(time.Duration(i) * time.Minute)
		if err := os.Chtimes(p, mt, mt); err != nil {
			t.Fatal(err)
		}
		paths = append(paths, p)
	}
	if err := s.approvePaths(paths); err != nil {
		t.Fatal(err)
	}
	// Missing file and non-project file should never appear even if present.
	deleted := filepath.Join(dir, "deleted.gk")
	if err := os.WriteFile(deleted, []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	_ = s.approvePath(deleted)
	_ = os.Remove(deleted)

	// Unapproved file on disk must never appear or open.
	unapproved := filepath.Join(dir, "secret-other.gk")
	if err := os.WriteFile(unapproved, []byte(`{"root":{"text":"Unapproved"}}`), 0600); err != nil {
		t.Fatal(err)
	}

	routes := s.routes()

	req := httptest.NewRequest(http.MethodPost, "/__desktop/file/recent/list", bytes.NewReader([]byte("{}")))
	req.Header.Set("X-NeuroMap-Session", s.secret)
	rec := httptest.NewRecorder()
	routes.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("recent list status %d: %s", rec.Code, rec.Body.String())
	}
	var listed struct {
		Files []recentProjectFile `json:"files"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	for i := 11; i >= 0; i-- {
		expectedOrder = append(expectedOrder, fmt.Sprintf("map-%02d.gk", i))
	}
	if len(listed.Files) != len(expectedOrder) {
		t.Fatalf("got %d files, want %d", len(listed.Files), len(expectedOrder))
	}
	for i, want := range expectedOrder {
		if listed.Files[i].Filename != want {
			t.Fatalf("index %d: got %s, want %s", i, listed.Files[i].Filename, want)
		}
		if i > 0 && listed.Files[i-1].ModTimeMs < listed.Files[i].ModTimeMs {
			t.Fatalf("not sorted descending at %d: %d < %d", i, listed.Files[i-1].ModTimeMs, listed.Files[i].ModTimeMs)
		}
	}

	// Unapproved path open must fail 403.
	badBody, _ := json.Marshal(map[string]string{"path": unapproved})
	badReq := httptest.NewRequest(http.MethodPost, "/__desktop/file/recent/open", bytes.NewReader(badBody))
	badReq.Header.Set("X-NeuroMap-Session", s.secret)
	badRec := httptest.NewRecorder()
	routes.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusForbidden {
		t.Fatalf("unapproved recent open status %d, want 403", badRec.Code)
	}

	// Deleted approved path open must fail 404.
	missBody, _ := json.Marshal(map[string]string{"path": deleted})
	missReq := httptest.NewRequest(http.MethodPost, "/__desktop/file/recent/open", bytes.NewReader(missBody))
	missReq.Header.Set("X-NeuroMap-Session", s.secret)
	missRec := httptest.NewRecorder()
	routes.ServeHTTP(missRec, missReq)
	if missRec.Code != http.StatusNotFound {
		t.Fatalf("deleted recent open status %d, want 404", missRec.Code)
	}

	// Approved file opens cleanly with binary body.
	okBody, _ := json.Marshal(map[string]string{"path": paths[11]})
	okReq := httptest.NewRequest(http.MethodPost, "/__desktop/file/recent/open", bytes.NewReader(okBody))
	okReq.Header.Set("X-NeuroMap-Session", s.secret)
	okRec := httptest.NewRecorder()
	routes.ServeHTTP(okRec, okReq)
	if okRec.Code != 200 || !bytes.Contains(okRec.Body.Bytes(), []byte("Map 11")) {
		t.Fatalf("approved recent open failed: %d %s", okRec.Code, okRec.Body.String())
	}
}
