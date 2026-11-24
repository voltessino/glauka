package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
)

func qaService(t *testing.T) *service {
	t.Helper()
	return &service{secret: "qa-session", configDir: t.TempDir(), active: make(map[string]*activeAIRequest)}
}

func qaSave(t *testing.T, s *service, path, content, token string, sheets []json.RawMessage) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]any{"json": content, "filePath": path, "xmindSheets": sheets})
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/__desktop/file/save", bytes.NewReader(body))
	r.Header.Set("X-NeuroMap-Session", token)
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	return w
}

func qaRead(t *testing.T, path string) []byte {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestQAInvalidSavesKeepOriginal(t *testing.T) {
	for _, tc := range []struct {
		name, ext, content, token string
		status                    int
	}{
		{"invalid JSON", ".neuromap", "{bad", "qa-session", 400},
		{"missing XMind sheets", ".xmind", "{}", "qa-session", 400},
		{"unsupported extension TXT", ".txt", "{}", "qa-session", 400},
		{"unsupported extension Markdown", ".md", "{}", "qa-session", 400},
		{"unsupported extension JSON", ".json", "{}", "qa-session", 400},
		{"unsupported extension OPML", ".opml", "{}", "qa-session", 400},
		{"invalid session", ".neuromap", "{}", "wrong-session", 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := qaService(t)
			path := filepath.Join(t.TempDir(), "original"+tc.ext)
			original := []byte(`{"root":{"text":"Keep original"}}`)
			if err := os.WriteFile(path, original, 0600); err != nil {
				t.Fatal(err)
			}
			if err := s.approvePath(path); err != nil {
				t.Fatal(err)
			}
			w := qaSave(t, s, path, tc.content, tc.token, nil)
			if w.Code != tc.status {
				t.Fatalf("status %d, want %d: %s", w.Code, tc.status, w.Body.String())
			}
			if !bytes.Equal(qaRead(t, path), original) {
				t.Fatal("rejected save changed original")
			}
		})
	}
}

func TestQAFiveProjectPathsDoNotCrossWrite(t *testing.T) {
	s := qaService(t)
	dir := t.TempDir()
	paths := make([]string, 5)
	for i := range paths {
		paths[i] = filepath.Join(dir, fmt.Sprintf("tab-%d.neuromap", i))
		if err := s.approvePath(paths[i]); err != nil {
			t.Fatal(err)
		}
	}
	for round := 0; round < 3; round++ {
		for i, path := range paths {
			content := fmt.Sprintf(`{"tab":%d,"round":%d,"notes":"α é 中文"}`, i, round)
			w := qaSave(t, s, path, content, s.secret, nil)
			if w.Code != 200 {
				t.Fatalf("tab %d status %d: %s", i, w.Code, w.Body.String())
			}
		}
	}
	for i, path := range paths {
		want := fmt.Sprintf(`{"tab":%d,"round":2,"notes":"α é 中文"}`, i)
		if string(qaRead(t, path)) != want {
			t.Fatalf("tab %d received another project's data", i)
		}
	}
}

func TestQABlockedBackupKeepsOriginalXMind(t *testing.T) {
	s := qaService(t)
	dir := t.TempDir()
	path := filepath.Join(dir, "original.xmind")
	original := []byte("opaque original bytes; not an authentic XMind fixture")
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "Glauka Backups"), []byte("block directory creation"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.approvePath(path); err != nil {
		t.Fatal(err)
	}
	w := qaSave(t, s, path, `{}`, s.secret, []json.RawMessage{json.RawMessage(`{"root":{"id":"r","text":"New","children":[]}}`)})
	if w.Code != 500 {
		t.Fatalf("expected failed backup to reject save: %d %s", w.Code, w.Body.String())
	}
	if !bytes.Equal(qaRead(t, path), original) {
		t.Fatal("original overwritten without backup")
	}
}

func TestQABlockedParentKeepsOriginalFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "map.neuromap")
	original := []byte(`{"version":"old"}`)
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if err := atomicFile(filepath.Join(path, "child.neuromap"), []byte(`{"version":"new"}`)); err == nil {
		t.Fatal("blocked parent error not reported")
	}
	if !bytes.Equal(qaRead(t, path), original) {
		t.Fatal("staging failure changed original")
	}
}

// Synthetic deterministic maps exercise the native metadata envelope, not
// compatibility with third-party XMind 8 or a complete editor round trip.
func TestQAThirtyXMindNativeEnvelopesKeepAllMetadata(t *testing.T) {
	for seed := 0; seed < 30; seed++ {
		t.Run(fmt.Sprint(seed), func(t *testing.T) {
			root := map[string]any{"id": "root", "text": fmt.Sprintf("Map %d α", seed), "notes": "Root note", "children": []any{}}
			children := []any{}
			for i := 0; i < 1+seed%9; i++ {
				children = append(children, map[string]any{"id": fmt.Sprintf("n%d", i), "parentId": "root", "text": fmt.Sprintf("Child %d", i), "notes": "α é 中文\nsecond line", "sidePinned": "left", "boundary": map[string]any{"title": "Boundary"}, "children": []any{}})
			}
			root["children"] = children
			sheet := map[string]any{"root": root, "thresholdY": 0, "balanceBias": seed % 101, "typographyScale": 1.2, "images": []any{map[string]any{"id": "free-image", "mode": "free", "src": "data:image/png;base64,iVBORw0KGgo=", "worldPos": map[string]any{"x": 15, "y": -25}}}, "relationships": []any{map[string]any{"id": "rel", "fromId": "root", "toId": "n0", "label": "Relation"}}, "studyCards": []any{map[string]any{"sourceNodeId": "n0", "answer": "Do not lose"}}}
			raw, err := json.Marshal(sheet)
			if err != nil {
				t.Fatal(err)
			}
			data, err := encodeXMind("{}", []json.RawMessage{raw})
			if err != nil {
				t.Fatal(err)
			}
			z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
			if err != nil {
				t.Fatal(err)
			}
			found := false
			for _, f := range z.File {
				if f.Name == "neuromap/workspace.json" {
					r, err := f.Open()
					if err != nil {
						t.Fatal(err)
					}
					b, err := io.ReadAll(r)
					r.Close()
					if err != nil {
						t.Fatal(err)
					}
					var envelope struct {
						Tabs []any `json:"tabs"`
					}
					var want any
					if err := json.Unmarshal(b, &envelope); err != nil {
						t.Fatal(err)
					}
					if err := json.Unmarshal(raw, &want); err != nil {
						t.Fatal(err)
					}
					if len(envelope.Tabs) != 1 || !reflect.DeepEqual(envelope.Tabs[0], want) {
						t.Fatal("native metadata changed")
					}
					found = true
				}
			}
			if !found {
				t.Fatal("native workspace missing")
			}
		})
	}
}

func TestQAConcurrentAtomicWritesKeepACompleteDocument(t *testing.T) {
	// The fixed .pending filename is shared by parallel save requests. A barrier
	// and sizeable distinct documents expose collisions without touching real data.
	const writers = 16
	path := filepath.Join(t.TempDir(), "concurrent.neuromap")
	if err := os.WriteFile(path, []byte(`{"initial":true}`), 0600); err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	errs := make(chan error, writers)
	payloads := make([][]byte, writers)
	var wg sync.WaitGroup
	for i := 0; i < writers; i++ {
		payloads[i] = []byte(fmt.Sprintf(`{"writer":%d,"padding":"%s"}`, i, strings.Repeat(string(rune('A'+i)), 256*1024+i*997)))
		wg.Add(1)
		go func(i int) { defer wg.Done(); <-start; errs <- atomicFile(path, payloads[i]) }(i)
	}
	close(start)
	wg.Wait()
	close(errs)
	failed := 0
	for err := range errs {
		if err != nil {
			failed++
		}
	}
	final, readErr := os.ReadFile(path)
	complete := false
	for _, p := range payloads {
		if bytes.Equal(final, p) {
			complete = true
		}
	}
	if failed > 0 || readErr != nil || !complete {
		t.Fatalf("concurrent saves: failed=%d/%d, readError=%v, completeDocument=%v, validJSON=%v", failed, writers, readErr, complete, json.Valid(final))
	}
}

func TestQAConcurrentHTTPSavesKeepACompleteDocument(t *testing.T) {
	s := qaService(t)
	path := filepath.Join(t.TempDir(), "concurrent.neuromap")
	if err := s.approvePath(path); err != nil {
		t.Fatal(err)
	}
	const writers = 16
	payloads := make([][]byte, writers)
	for i := range payloads {
		payloads[i] = []byte(fmt.Sprintf(`{"writer":%d,"padding":"%s"}`, i, strings.Repeat(string(rune('A'+i)), 256*1024+i*997)))
	}
	start := make(chan struct{})
	statuses := make(chan int, writers)
	var wg sync.WaitGroup
	for i := range payloads {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			statuses <- qaSave(t, s, path, string(payloads[i]), s.secret, nil).Code
		}(i)
	}
	close(start)
	wg.Wait()
	close(statuses)
	failed := 0
	for code := range statuses {
		if code != http.StatusOK {
			failed++
		}
	}
	final, err := os.ReadFile(path)
	complete := false
	for _, p := range payloads {
		if bytes.Equal(final, p) {
			complete = true
		}
	}
	if failed != 0 || err != nil || !complete {
		t.Fatalf("HTTP saves: non200=%d/%d, readError=%v, completeDocument=%v, validJSON=%v", failed, writers, err, complete, json.Valid(final))
	}
}

func TestQAConcurrentXMindSavesPreserveOriginalBackup(t *testing.T) {
	s := qaService(t)
	path := filepath.Join(t.TempDir(), "concurrent.xmind")
	initialSheet := json.RawMessage(`{"root":{"id":"r","text":"Original","children":[]}}`)
	original, err := encodeXMind("{}", []json.RawMessage{initialSheet})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.approvePath(path); err != nil {
		t.Fatal(err)
	}
	const writers = 8
	start := make(chan struct{})
	statuses := make(chan int, writers)
	var wg sync.WaitGroup
	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sheet := json.RawMessage(fmt.Sprintf(`{"root":{"id":"r","text":"Writer %d","children":[]}}`, i))
			<-start
			statuses <- qaSave(t, s, path, "{}", s.secret, []json.RawMessage{sheet}).Code
		}(i)
	}
	close(start)
	wg.Wait()
	close(statuses)
	for code := range statuses {
		if code != http.StatusOK {
			t.Fatalf("concurrent XMind save status %d", code)
		}
	}
	if !bytes.Equal(qaRead(t, xmindBackupDestination(path)), original) {
		t.Fatal("first original backup changed")
	}
	final := qaRead(t, path)
	z, err := zip.NewReader(bytes.NewReader(final), int64(len(final)))
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range z.File {
		r, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		_, err = io.Copy(io.Discard, r)
		r.Close()
		if err != nil {
			t.Fatalf("incomplete ZIP entry %s: %v", f.Name, err)
		}
	}
}

// Import and native save intentionally have different format allowlists:
// exporters must not silently overwrite a plain-text/Markdown/JSON document.
func TestQANativeSaveAllowlistDoesNotRestrictImport(t *testing.T) {
	for _, ext := range []string{".txt", ".md", ".markdown", ".json", ".opml", ".xml"} {
		if !projectExtension("import"+ext) {
			t.Fatalf("import unexpectedly blocked: %s", ext)
		}
		if projectSaveExtension("project"+ext) {
			t.Fatalf("import-only extension accepted by native save: %s", ext)
		}
	}
	for _, ext := range []string{".gk", ".glk", ".neuromap", ".xmind"} {
		if !projectExtension("import"+ext) || !projectSaveExtension("project"+ext) {
			t.Fatalf("native project extension not supported: %s", ext)
		}
	}
}
