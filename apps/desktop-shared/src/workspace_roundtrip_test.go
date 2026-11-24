package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func qaWorkspaceRequest(t *testing.T, s *service, route, content string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"json": content})
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/__desktop/workspace/"+route, bytes.NewReader(body))
	r.Header.Set("X-NeuroMap-Session", s.secret)
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	return w
}

func qaWorkspaceRead(t *testing.T, s *service) string {
	t.Helper()
	w := qaWorkspaceRequest(t, s, "read", "")
	if w.Code != http.StatusOK {
		t.Fatalf("read %d: %s", w.Code, w.Body.String())
	}
	var result response
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result.JSON
}

func TestQAWorkspaceAutosaveSurvivesServiceRestart(t *testing.T) {
	s := qaService(t)
	doc := `{"version":3,"activeTabId":"tab-two","studyCards":[{"sourceTabId":"tab-two","sourceNodeId":"c","answer":"α é 中文"}],"tabs":[{"id":"tab-one","root":{"id":"r1","text":"First","children":[]}},{"id":"tab-two","thresholdY":0,"root":{"id":"r2","text":"Second","notes":"Root note","children":[{"id":"c","text":"Child","children":[]}]},"images":[{"id":"img","attachedNodeId":"c","src":"data:image/png;base64,fixture"}],"relationships":[{"fromId":"r2","toId":"c","label":"Link"}]}]}`
	w := qaWorkspaceRequest(t, s, "write", doc)
	if w.Code != http.StatusOK {
		t.Fatalf("write %d: %s", w.Code, w.Body.String())
	}
	// A new service and session read the same isolated directory. This models a
	// clean backend restart, not a crash or native WebView lifecycle.
	restarted := qaService(t)
	restarted.configDir = s.configDir
	restarted.secret = "new-session"
	if got := qaWorkspaceRead(t, restarted); got != doc {
		t.Fatal("workspace bytes changed across restart")
	}
}

func TestQARejectedAutosaveKeepsLastValidWorkspace(t *testing.T) {
	s := qaService(t)
	original := `{"version":3,"tabs":[{"root":{"text":"Original","children":[]}}]}`
	if w := qaWorkspaceRequest(t, s, "write", original); w.Code != http.StatusOK {
		t.Fatal(w.Body.String())
	}
	tooMany := `{"tabs":[` + strings.Repeat(`{},`, 100) + `{}]}`
	for _, bad := range []string{`{broken`, `{"tabs":[]}`, tooMany} {
		w := qaWorkspaceRequest(t, s, "write", bad)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
		if qaWorkspaceRead(t, s) != original {
			t.Fatal("invalid autosave changed last valid workspace")
		}
	}
}
