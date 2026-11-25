package main

import (
	"io"
	"net/http"
	"sync"
	"time"
)

// Each document has its own lease: a reload must not close the replacement page,
// and a late heartbeat from an unloading page must not resurrect its lease.
type desktopWindowLease struct {
	seen           time.Time
	hidden, closed bool
	sequence       uint64
	streams        int
}
type desktopWindowState struct {
	mu           sync.Mutex
	pages        map[string]desktopWindowLease
	closedAt     time.Time
	loadingUntil time.Time
	wake         chan struct{}
}

func (w *desktopWindowState) update(id, state string, hidden bool, now time.Time, sequence ...uint64) {
	if id == "" || len(id) > 100 {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.pages == nil {
		w.pages = make(map[string]desktopWindowLease)
	}
	for key, p := range w.pages {
		if p.closed && now.Sub(p.seen) > time.Minute {
			delete(w.pages, key)
		}
	}
	prior, known := w.pages[id]
	seq := prior.sequence + 1
	if len(sequence) > 0 && sequence[0] > 0 {
		seq = sequence[0]
		if known && seq <= prior.sequence {
			return
		}
	}
	if prior.closed && state != "open" {
		return
	}
	if !known && len(w.pages) >= 64 {
		oldest := ""
		var when time.Time
		for key, p := range w.pages {
			if p.closed && (oldest == "" || p.seen.Before(when)) {
				oldest = key
				when = p.seen
			}
		}
		if oldest == "" {
			return
		}
		delete(w.pages, oldest)
	}
	closed := state == "closed"
	if !closed {
		w.loadingUntil = time.Time{}
	}
	w.pages[id] = desktopWindowLease{seen: now, hidden: hidden, closed: closed, sequence: seq, streams: prior.streams}
	if closed {
		w.closedAt = now
		if w.wake != nil {
			close(w.wake)
			w.wake = nil
		}
	} else {
		w.closedAt = time.Time{}
	}
}
func (w *desktopWindowState) stopped(now, lastHeartbeat time.Time) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if now.Before(w.loadingUntil) {
		return false
	}
	open := false
	for _, p := range w.pages {
		if p.closed {
			continue
		}
		open = true
		if p.streams > 0 {
			return false
		}
		limit := 3 * time.Minute
		if p.hidden {
			limit = 15 * time.Minute
		}
		if now.Sub(p.seen) < limit {
			return false
		}
	}
	if !open && !w.closedAt.IsZero() {
		return now.Sub(w.closedAt) >= 3*time.Second
	}
	return now.Sub(lastHeartbeat) > 3*time.Minute
}
func (w *desktopWindowState) resume(now time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for id, p := range w.pages {
		if !p.closed {
			p.seen = now
			w.pages[id] = p
		}
	}
}
func (s *service) windowClosedRoute(w http.ResponseWriter, r *http.Request) {
	if !s.secure(w, r) {
		return
	}
	var q struct {
		WindowID string `json:"windowId"`
		Sequence uint64 `json:"sequence"`
	}
	if !readJSON(w, r, &q, 2048) {
		return
	}
	if q.WindowID == "" || len(q.WindowID) > 100 {
		responseJSON(w, 400, response{Message: "Identità finestra non valida"})
		return
	}
	s.windows.update(q.WindowID, "closed", false, time.Now(), q.Sequence)
	responseJSON(w, 200, response{OK: true})
}

// Launcher exit alone is not closure: Edge can hand the window to another PID.
func (s *service) waitForWindowExit(finished <-chan struct{}) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	lastTick := time.Now()
	for {
		select {
		case <-finished:
			finished = nil
		case now := <-ticker.C:
			if now.Sub(lastTick) > 30*time.Second {
				s.windows.resume(now)
				s.lastHeartbeat.Store(now.Unix())
			}
			lastTick = now
			if s.windows.stopped(now, time.Unix(s.lastHeartbeat.Load(), 0)) {
				return nil
			}
		}
	}
}

func (w *desktopWindowState) loading(now time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.loadingUntil = now.Add(20 * time.Second)
}

// A live authenticated HTTP stream is not subject to JavaScript timer throttling.
// Minimized/frozen app pages retain the backend without extending crash timeouts.
func (w *desktopWindowState) connect(id string, seq uint64, hidden bool, now time.Time) bool {
	w.update(id, "open", hidden, now, seq)
	w.mu.Lock()
	defer w.mu.Unlock()
	p, ok := w.pages[id]
	if !ok || p.closed || p.streams >= 2 {
		return false
	}
	p.streams++
	w.pages[id] = p
	return true
}
func (w *desktopWindowState) disconnected(id string, now time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	p, ok := w.pages[id]
	if !ok {
		return
	}
	if p.streams > 0 {
		p.streams--
	}
	if p.streams == 0 && !p.closed {
		p.seen = now
	}
	w.pages[id] = p
}
func (w *desktopWindowState) pageClosed(id string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	p, ok := w.pages[id]
	return !ok || p.closed
}
func (w *desktopWindowState) signal() <-chan struct{} {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.wake == nil {
		w.wake = make(chan struct{})
	}
	return w.wake
}
func (s *service) beginShutdown() {
	s.shutdownOnce.Do(func() {
		if s.shutdownCh != nil {
			close(s.shutdownCh)
		}
		s.mu.Lock()
		for _, active := range s.active {
			if active != nil && active.cancel != nil {
				active.cancel()
			}
		}
		s.mu.Unlock()
	})
}
func (s *service) windowLiveRoute(w http.ResponseWriter, r *http.Request) {
	if !s.secure(w, r) {
		return
	}
	var q struct {
		WindowID string `json:"windowId"`
		Sequence uint64 `json:"sequence"`
		Hidden   bool   `json:"hidden"`
	}
	if !readJSON(w, r, &q, 2048) {
		return
	}
	if !s.windows.connect(q.WindowID, q.Sequence, q.Hidden, time.Now()) {
		responseJSON(w, 409, response{Message: "Finestra non attiva"})
		return
	}
	defer func() { s.windows.disconnected(q.WindowID, time.Now()) }()
	controller := http.NewResponseController(w)
	// Clear the request read timeout for this intentionally long-lived response.
	_ = controller.SetReadDeadline(time.Time{})
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	if _, err := io.WriteString(w, ": NeuroMap window connected\n\n"); err != nil {
		return
	}
	if err := controller.Flush(); err != nil {
		return
	}
	tick := time.NewTicker(time.Second)
	defer tick.Stop()
	// Wake immediately on window close or backend shutdown instead of waiting for tick.
	for {
		if s.windows.pageClosed(q.WindowID) {
			return
		}
		wake := s.windows.signal()
		select {
		case <-r.Context().Done():
			return
		case <-s.shutdownCh:
			return
		case <-wake:
		case <-tick.C:
		}
	}
}
