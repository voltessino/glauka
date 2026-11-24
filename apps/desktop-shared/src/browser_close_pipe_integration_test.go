//go:build !windows

package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"testing"
	"time"
)

// Optional real Chromium test. Windows CRT handle inheritance still needs its
// native platform smoke test; this verifies the exact shared pipe protocol.
func TestBrowserPipeRealChromium(t *testing.T) {
	binary := os.Getenv("NEUROMAP_TEST_CHROMIUM")
	if binary == "" {
		t.Skip("set NEUROMAP_TEST_CHROMIUM for the real pipe test")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		io.WriteString(w, `<!doctype html><button>Activate</button><script>window.asked=0;window.allow=false;window.dirty=true;window.NeuroMapLifecycle={requestClose:async()=>{asked++;if(allow)dirty=false;return allow}};addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}})</script>`)
	}))
	defer server.Close()
	childRead, parentWrite, _ := os.Pipe()
	parentRead, childWrite, _ := os.Pipe()
	cmd := exec.Command(binary, "--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-pipe", "--user-data-dir="+t.TempDir(), "--app="+server.URL)
	cmd.ExtraFiles = []*os.File{childRead, childWrite}
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	childRead.Close()
	childWrite.Close()
	defer func() { cmd.Process.Kill(); cmd.Wait() }()
	p := newBrowserPipe(parentRead, parentWrite)
	defer p.close()
	p.start()
	var session string
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		raw, err := p.call("", "Target.getTargets", map[string]any{})
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Targets []struct {
				ID   string `json:"targetId"`
				Type string `json:"type"`
			} `json:"targetInfos"`
		}
		json.Unmarshal(raw, &result)
		for _, target := range result.Targets {
			if target.Type == "page" {
				raw, _ = p.call("", "Target.attachToTarget", map[string]any{"targetId": target.ID, "flatten": true})
				var attach struct {
					Session string `json:"sessionId"`
				}
				json.Unmarshal(raw, &attach)
				session = attach.Session
				break
			}
		}
		if session != "" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if session == "" {
		t.Fatal("no page attached")
	}
	eval := func(expr string) json.RawMessage {
		r, err := p.call(session, "Runtime.evaluate", map[string]any{"expression": expr, "returnByValue": true, "userGesture": true, "awaitPromise": true})
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	for time.Now().Before(deadline) {
		var r struct {
			Result struct {
				Value string `json:"value"`
			} `json:"result"`
		}
		json.Unmarshal(eval("document.readyState"), &r)
		if r.Result.Value == "complete" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	_, _ = p.call(session, "Page.enable", map[string]any{})
	_, _ = p.call(session, "Input.dispatchMouseEvent", map[string]any{"type": "mousePressed", "x": 20, "y": 20, "button": "left", "clickCount": 1})
	_, _ = p.call(session, "Input.dispatchMouseEvent", map[string]any{"type": "mouseReleased", "x": 20, "y": 20, "button": "left", "clickCount": 1})
	go p.call(session, "Page.close", map[string]any{})
	observed := false
	for time.Now().Before(deadline) {
		var r struct {
			Result struct {
				Value int `json:"value"`
			} `json:"result"`
		}
		json.Unmarshal(eval("window.asked"), &r)
		if r.Result.Value > 0 {
			observed = true
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !observed {
		t.Fatal("native close never reached the app confirmation")
	}
	eval("window.savedLifecycle=window.NeuroMapLifecycle;delete window.NeuroMapLifecycle")
	var unmanaged struct {
		Result struct {
			Subtype string `json:"subtype"`
		} `json:"result"`
	}
	if err := json.Unmarshal(eval(requestCloseScript), &unmanaged); err != nil || unmanaged.Result.Subtype != "null" {
		t.Fatal("a page without NeuroMap was treated as a cancelled app close")
	}
	eval("window.NeuroMapLifecycle=window.savedLifecycle;window.allow=true")
	go p.call(session, "Page.close", map[string]any{})
	// Page.close destroys the target while the browser pipe remains alive.
	closed := false
	for time.Now().Before(deadline) {
		raw, err := p.call("", "Target.getTargets", map[string]any{})
		if err != nil {
			closed = true
			break
		}
		var r struct {
			Targets []struct {
				Type string `json:"type"`
			} `json:"targetInfos"`
		}
		json.Unmarshal(raw, &r)
		pages := 0
		for _, target := range r.Targets {
			if target.Type == "page" {
				pages++
			}
		}
		if pages == 0 {
			closed = true
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !closed {
		t.Fatal("approved native close did not close the page")
	}
}
