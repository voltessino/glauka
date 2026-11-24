package main

import (
    "net/http"
    "net/http/httptest"
    "os"
    "path/filepath"
    "testing"
)

func TestDiscardWorkspaceRequiresAuthorizationAndNeverTouchesProjects(t *testing.T) {
    folder := t.TempDir()
    recovery := filepath.Join(folder, "workspace-autosave.json")
    project := filepath.Join(folder, "notes.neuromap")
    if err := os.WriteFile(recovery, []byte(`{"tabs":[{"root":{"text":"Unsaved"}}]}`), 0600); err != nil { t.Fatal(err) }
    if err := os.WriteFile(project, []byte("previously saved project"), 0600); err != nil { t.Fatal(err) }
    service := &service{secret:"discard-qa", configDir:folder}
    for _, tc := range []struct {token string; code int}{
        {"invalid", http.StatusForbidden},
        {"discard-qa", http.StatusOK},
        {"discard-qa", http.StatusOK}, // Repeated requests are idempotent.
    } {
        req := httptest.NewRequest(http.MethodPost, "/__desktop/workspace/discard", nil)
        req.Header.Set("X-NeuroMap-Session",tc.token)
        result := httptest.NewRecorder()
        service.routes().ServeHTTP(result,req)
        if result.Code != tc.code {t.Fatalf("response %d want %d: %s",result.Code,tc.code,result.Body.String())}
        _, err := os.Stat(recovery)
        if tc.code==http.StatusForbidden && err!=nil {t.Fatalf("unauthorized removal: %v",err)}
        if tc.code==http.StatusOK && !os.IsNotExist(err) {t.Fatalf("recovery not cleared: %v",err)}
    }
    bytes, err := os.ReadFile(project)
    if err!=nil || string(bytes)!="previously saved project" {t.Fatalf("saved project modified: %s %v",bytes,err)}
}
