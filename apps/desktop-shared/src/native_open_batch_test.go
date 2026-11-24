package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func nativeBatchService(t *testing.T) (*service, string) {
	t.Helper()
	dir := t.TempDir()
	return &service{secret: "qa-batch-session", configDir: dir, active: map[string]*activeAIRequest{}}, dir
}
func batchFile(t *testing.T, dir, name string, size int64) string {
	t.Helper()
	p := filepath.Join(dir, name)
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	if size > 0 {
		if err = f.Truncate(size); err != nil {
			t.Fatal(err)
		}
	}
	if err = f.Close(); err != nil {
		t.Fatal(err)
	}
	return p
}
func selectedRequest(s *service, id, session string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(map[string]string{"id": id})
	r := httptest.NewRequest("POST", "/__desktop/file/read-selected", bytes.NewReader(body))
	r.Header.Set("X-NeuroMap-Session", session)
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	return w
}
func TestNativeSelectionErrorsAreIndependentAndDuplicatePathsAreSkipped(t *testing.T) {
	s, dir := nativeBatchService(t)
	a := batchFile(t, dir, "à 中文.gk", 3)
	b := batchFile(t, dir, "b.md", 2)
	files := s.prepareNativeSelection([]string{a, filepath.Join(dir, "missing.gk"), batchFile(t, dir, "blocked.exe", 1), a, b})
	if len(files) != 5 || files[0].ID == "" || files[4].ID == "" || files[1].Error.Code != "unreadable" || files[2].Error.Code != "unsupported" || files[3].Ignored != "duplicate" {
		t.Fatalf("wrong independent outcomes: %+v", files)
	}
	for _, i := range []int{0, 4} {
		if out := selectedRequest(s, files[i].ID, s.secret); out.Code != 200 {
			t.Fatalf("valid file blocked: %d %s", out.Code, out.Body.String())
		}
	}
}
func TestNativeSelection100MiBLimitsDoNotAbortSmallLaterFiles(t *testing.T) {
	s, dir := nativeBatchService(t)
	a := batchFile(t, dir, "large.gk", 90<<20)
	tooBig := batchFile(t, dir, "too-big.gk", (100<<20)+1)
	overflow := batchFile(t, dir, "overflow.gk", 11<<20)
	small := batchFile(t, dir, "small.gk", 1)
	files := s.prepareNativeSelection([]string{a, tooBig, overflow, small})
	if files[0].ID == "" || files[1].Error.Code != "tooLarge" || files[2].Error.Code != "batchSize" || files[3].ID == "" {
		t.Fatalf("size limits aborted valid files: %+v", files)
	}
}
func TestNativeTicketRequiresSessionAndDoesNotAuthorizeFreeFormPaths(t *testing.T) {
	s, dir := nativeBatchService(t)
	p := batchFile(t, dir, "map.gk", 3)
	f := s.prepareNativeSelection([]string{p})[0]
	if out := selectedRequest(s, f.ID, ""); out.Code != 403 {
		t.Fatalf("unauthenticated ticket read: %d", out.Code)
	}
	if out := selectedRequest(s, strings.Repeat("x", 43), s.secret); out.Code != 410 {
		t.Fatalf("unknown ticket: %d", out.Code)
	}
	if out := selectedRequest(s, p, s.secret); out.Code != 410 {
		t.Fatalf("raw path accepted as read grant: %d", out.Code)
	}
}
func TestNativeReadableFilesSurviveFailedDurablePathGrant(t *testing.T) {
	s, dir := nativeBatchService(t)
	p := batchFile(t, dir, "map.gk", 3)
	blocked := batchFile(t, dir, "not-a-directory", 1)
	s.configDir = blocked
	f := s.prepareNativeSelection([]string{p})[0]
	out := selectedRequest(s, f.ID, s.secret)
	if f.ID == "" || !f.PathWarning || out.Code != 200 || out.Header().Get("X-Glauka-Path-Warning") != "1" {
		t.Fatalf("readable file was blocked: %+v %d", f, out.Code)
	}
	if s.authorizedPath(p) {
		t.Fatal("failed durable grant left write authority in memory")
	}
}
func TestNativeTicketRejectsFilesChangedAfterSelection(t *testing.T) {
	s, dir := nativeBatchService(t)
	p := batchFile(t, dir, "map.gk", 3)
	f := s.prepareNativeSelection([]string{p})[0]
	if err := os.WriteFile(p, []byte("changed"), 0600); err != nil {
		t.Fatal(err)
	}
	if out := selectedRequest(s, f.ID, s.secret); out.Code != 409 {
		t.Fatalf("changed file read: %d", out.Code)
	}
}
func TestNativeBatchGrantsRollbackTogetherWithoutLosingOlderAuthority(t *testing.T) {
	s, dir := nativeBatchService(t)
	old := batchFile(t, dir, "old.gk", 1)
	if err := s.approvePath(old); err != nil {
		t.Fatal(err)
	}
	a := batchFile(t, dir, "a.gk", 1)
	b := batchFile(t, dir, "b.gk", 1)
	s.configDir = batchFile(t, dir, "blocked-dir", 1)
	if err := s.approvePaths([]string{a, b}); err == nil {
		t.Fatal("expected write failure")
	}
	if !s.authorizedPath(old) || s.authorizedPath(a) || s.authorizedPath(b) {
		t.Fatal("grant rollback lost old authority or retained new authority")
	}
}
