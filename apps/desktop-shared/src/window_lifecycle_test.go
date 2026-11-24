package main

import (
	"bufio"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestClosedWindowStopsQuicklyButReloadDoesNot(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	w.update("old", "open", false, now)
	w.update("old", "closed", false, now)
	if w.stopped(now.Add(time.Second), now) {
		t.Fatal("no reload/write grace")
	}
	if !w.stopped(now.Add(4*time.Second), now) {
		t.Fatal("closed backend retained")
	}
	w.update("new", "open", false, now.Add(2*time.Second))
	if w.stopped(now.Add(4*time.Second), now) {
		t.Fatal("reload shut down")
	}
	w.update("old", "alive", false, now.Add(3*time.Second))
	w.update("new", "closed", false, now.Add(4*time.Second))
	if !w.stopped(now.Add(8*time.Second), now) {
		t.Fatal("late heartbeat resurrected closed page")
	}
}
func TestOtherWindowsHiddenHeartbeatsAndResumeRemainAlive(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	w.update("a", "open", false, now)
	w.update("b", "open", true, now)
	w.update("a", "closed", false, now)
	if w.stopped(now.Add(4*time.Minute), now) {
		t.Fatal("hidden live page expired too soon")
	}
	w.resume(now.Add(time.Hour))
	if w.stopped(now.Add(time.Hour+time.Minute), now) {
		t.Fatal("sleep resume expired page")
	}
	w.update("b", "closed", true, now.Add(time.Hour+2*time.Minute))
	if !w.stopped(now.Add(time.Hour+3*time.Minute), now) {
		t.Fatal("last window did not release backend")
	}
}
func TestCrashWithoutCloseHasBoundedRecoveryTimeout(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	w.update("a", "open", false, now)
	if w.stopped(now.Add(time.Minute), now) {
		t.Fatal("heartbeat jitter expired page")
	}
	if !w.stopped(now.Add(4*time.Minute), now) {
		t.Fatal("crash backend retained")
	}
}
func TestCloseEndpointRequiresSessionAndValidWindowIdentity(t *testing.T) {
	s := &service{secret: "window-test", configDir: t.TempDir()}
	for _, tc := range []struct {
		token, body string
		status      int
	}{{"", `{"windowId":"a"}`, 403}, {s.secret, `{}`, 400}, {s.secret, `{"windowId":"a"}`, 200}} {
		r := httptest.NewRequest(http.MethodPost, "/__desktop/window/closed", strings.NewReader(tc.body))
		r.Header.Set("X-NeuroMap-Session", tc.token)
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("got %d want %d: %s", w.Code, tc.status, w.Body.String())
		}
	}
}
func TestOutOfOrderOpenAndLoadingReloadDoNotTerminateTheNewPage(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	w.update("a", "open", false, now, 1)
	w.loading(now.Add(time.Second))
	w.update("a", "closed", false, now.Add(2*time.Second), 3)
	if w.stopped(now.Add(8*time.Second), now) {
		t.Fatal("slow reload lost its bootstrap grace")
	}
	w.update("a", "open", false, now.Add(9*time.Second), 1)
	w.update("b", "open", false, now.Add(10*time.Second), 1)
	w.update("b", "closed", false, now.Add(11*time.Second), 2)
	if !w.stopped(now.Add(15*time.Second), now) {
		t.Fatal("out of order open resurrected a closed document")
	}
}
func TestRapidReloadsKeepTheLatestWindowRegistered(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	for i := 0; i < 150; i++ {
		id := time.Duration(i).String()
		w.update(id, "open", false, now, 1)
		w.update(id, "closed", false, now, 2)
	}
	w.update("latest", "open", false, now, 1)
	if w.stopped(now.Add(5*time.Second), now) {
		t.Fatal("tombstones displaced a live page")
	}
	if len(w.pages) > 64 {
		t.Fatal("unbounded page records")
	}
}

func TestConcurrentHeartbeatsCannotResurrectTheClosedDocument(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	w.update("a", "open", false, now, 1)
	var pending sync.WaitGroup
	for i := 0; i < 25; i++ {
		pending.Add(1)
		go func(seq uint64) { defer pending.Done(); w.update("a", "alive", false, now, seq) }(uint64(i + 2))
	}
	w.update("a", "closed", false, now, 100)
	pending.Wait()
	if !w.stopped(now.Add(4*time.Second), now) {
		t.Fatal("late concurrent heartbeat revived document")
	}
}

func TestLiveStreamRetainsFrozenWindowsAndStillAllowsClose(t *testing.T) {
	now := time.Now()
	var w desktopWindowState
	if !w.connect("a", 1, true, now) {
		t.Fatal("not connected")
	}
	if w.stopped(now.Add(48*time.Hour), now) {
		t.Fatal("frozen live page expired")
	}
	w.update("a", "closed", true, now, 2)
	if !w.stopped(now.Add(4*time.Second), now) {
		t.Fatal("stream prevented explicit close")
	}
	w.disconnected("a", now)
	if w.connect("a", 1, true, now) {
		t.Fatal("stale connection reopened page")
	}
}
func TestWindowStreamClearsReadDeadlineAndEndsOnConfirmedClose(t *testing.T) {
	s := &service{secret: "stream-test", configDir: t.TempDir()}
	server := httptest.NewUnstartedServer(s.routes())
	server.Config.ReadTimeout = 100 * time.Millisecond
	server.Start()
	defer server.Close()
	req, _ := http.NewRequest(http.MethodPost, server.URL+"/__desktop/window/live", strings.NewReader(`{"windowId":"a","sequence":1}`))
	req.Header.Set("X-NeuroMap-Session", s.secret)
	response, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal(response.StatusCode)
	}
	reader := bufio.NewReader(response.Body)
	if _, err = reader.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	time.Sleep(200 * time.Millisecond)
	if s.windows.stopped(time.Now().Add(time.Hour), time.Now()) {
		t.Fatal("live HTTP lease disappeared")
	}
	closeReq, _ := http.NewRequest(http.MethodPost, server.URL+"/__desktop/window/closed", strings.NewReader(`{"windowId":"a","sequence":2}`))
	closeReq.Header.Set("X-NeuroMap-Session", s.secret)
	closed, err := server.Client().Do(closeReq)
	if err != nil {
		t.Fatal(err)
	}
	closed.Body.Close()
	done := make(chan error, 1)
	go func() { _, err := io.ReadAll(reader); done <- err }()
	select {
	case err = <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("live stream did not finish")
	}
}
