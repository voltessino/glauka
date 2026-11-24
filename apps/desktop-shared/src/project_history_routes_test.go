package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func historyRequest(t *testing.T, s *service, endpoint string, request map[string]string, token string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(request)
	if err != nil { t.Fatal(err) }
	r := httptest.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if token != "" { r.Header.Set("X-NeuroMap-Session", token) }
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	return w
}

func TestTimeMachineNativeSaveAndHistoryRoutes(t *testing.T) {
	s := qaService(t)
	p := filepath.Join(t.TempDir(), "original.neuromap")
	old := `{"root":{"id":"one","text":"Old","children":[]}}`
	newContent := `{"root":{"id":"one","text":"New","children":[]}}`
	if err := os.WriteFile(p, []byte(old), 0600); err != nil { t.Fatal(err) }
	if err := s.approvePath(p); err != nil { t.Fatal(err) }

	if w := qaSave(t, s, p, newContent, s.secret, nil); w.Code != http.StatusOK {
		t.Fatalf("native project save: %d %s", w.Code, w.Body.String())
	}
	versions, err := listProjectRevisions(s.configDir, p)
	if err != nil || len(versions) != 1 { t.Fatalf("history: %v %+v", err, versions) }
	data, err := readProjectRevision(s.configDir, p, versions[0].ID)
	if err != nil || string(data) != old { t.Fatalf("original data not archived intact: %v", err) }

	list := historyRequest(t, s, "/__desktop/file/history/list", map[string]string{"filePath":p}, s.secret)
	if list.Code != http.StatusOK { t.Fatalf("history list %d %s",list.Code,list.Body.String()) }
	if unauthorized := historyRequest(t, s, "/__desktop/file/history/list", map[string]string{"filePath":p}, ""); unauthorized.Code != http.StatusForbidden {
		t.Fatalf("history exposed without token: %d",unauthorized.Code)
	}
	other := filepath.Join(t.TempDir(),"unknown.neuromap")
	if unauthorized := historyRequest(t, s, "/__desktop/file/history/list", map[string]string{"filePath":other}, s.secret); unauthorized.Code != http.StatusForbidden {
		t.Fatalf("history exposed for unapproved path: %d",unauthorized.Code)
	}
	if invalid := historyRequest(t, s, "/__desktop/file/history/recover", map[string]string{"filePath":p,"id":"../outside"}, s.secret); invalid.Code != http.StatusBadRequest {
		t.Fatalf("traversal accepted: %d",invalid.Code)
	}
	rec := historyRequest(t, s, "/__desktop/file/history/recover", map[string]string{"filePath":p,"id":versions[0].ID}, s.secret)
	if rec.Code != http.StatusOK { t.Fatalf("recover %d %s",rec.Code,rec.Body.String()) }
	var recovered struct {RecoveredPath string `json:"recoveredPath"`}
	if err:=json.Unmarshal(rec.Body.Bytes(),&recovered);err!=nil {t.Fatal(err)}
	if got,e:=os.ReadFile(recovered.RecoveredPath);e!=nil||string(got)!=old {t.Fatalf("recovered version differs: %v",e)}
	if got,e:=os.ReadFile(p);e!=nil||string(got)!=newContent {t.Fatalf("active project changed by recovery: %v",e)}
}
