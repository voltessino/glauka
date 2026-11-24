package main

// A private inherited pipe controls only NeuroMap's own Chromium window. No
// debugging TCP port, browser extension or access to the user's normal profile.
import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

type browserReply struct {
	result json.RawMessage
	err    error
}

const requestCloseScript = "(async()=>{if(!window.NeuroMapLifecycle)return null;return await window.NeuroMapLifecycle.requestClose()})()"

type browserPipe struct {
	reader  io.ReadCloser
	writer  io.WriteCloser
	mu      sync.Mutex
	next    int
	pending map[int]chan browserReply
	done    chan struct{}
	quit    sync.Once
}
type browserPacket struct {
	ID      int             `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Session string          `json:"sessionId,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   json.RawMessage `json:"error,omitempty"`
}

func newBrowserPipe(reader io.ReadCloser, writer io.WriteCloser) *browserPipe {
	p := &browserPipe{reader: reader, writer: writer, pending: make(map[int]chan browserReply), done: make(chan struct{})}
	go p.read()
	return p
}
func (p *browserPipe) close() {
	p.quit.Do(func() { close(p.done); _ = p.reader.Close(); _ = p.writer.Close() })
}
func (p *browserPipe) call(session, method string, params any) (json.RawMessage, error) {
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	p.mu.Lock()
	p.next++
	id := p.next
	reply := make(chan browserReply, 1)
	p.pending[id] = reply
	data, err := json.Marshal(browserPacket{ID: id, Session: session, Method: method, Params: raw})
	if err == nil {
		_, err = p.writer.Write(append(data, 0))
	}
	p.mu.Unlock()
	defer func() { p.mu.Lock(); delete(p.pending, id); p.mu.Unlock() }()
	if err != nil {
		return nil, err
	}
	var timeout <-chan time.Time
	if method != "Runtime.evaluate" {
		timer := time.NewTimer(30 * time.Second)
		defer timer.Stop()
		timeout = timer.C
	}
	// A user-owned Save dialog has no time limit; pipe closure still cancels it.
	select {
	case r := <-reply:
		return r.result, r.err
	case <-p.done:
		return nil, io.EOF
	case <-timeout:
		return nil, io.ErrNoProgress
	}
}
func (p *browserPipe) read() {
	defer p.close()
	r := bufio.NewReaderSize(p.reader, 65536)
	for {
		data, err := r.ReadBytes(0)
		if err != nil {
			return
		}
		if len(data) > 16<<20 {
			return
		}
		var packet browserPacket
		if json.Unmarshal(data[:len(data)-1], &packet) != nil {
			continue
		}
		if packet.ID != 0 {
			p.mu.Lock()
			reply := p.pending[packet.ID]
			p.mu.Unlock()
			if reply != nil {
				response := browserReply{result: packet.Result}
				if len(packet.Error) > 0 {
					var rejection struct {
						Code    int    `json:"code"`
						Message string `json:"message"`
					}
					_ = json.Unmarshal(packet.Error, &rejection)
					response.err = fmt.Errorf("desktop browser rejected command (%d): %s", rejection.Code, rejection.Message)
				}
				reply <- response
			}
			continue
		}
		switch packet.Method {
		case "Target.attachedToTarget":
			var event struct {
				Session string `json:"sessionId"`
				Target  struct {
					Type string `json:"type"`
				} `json:"targetInfo"`
			}
			if json.Unmarshal(packet.Params, &event) == nil {
				go func() {
					if event.Target.Type == "page" {
						_, _ = p.call(event.Session, "Page.enable", map[string]any{})
					}
					_, _ = p.call(event.Session, "Runtime.runIfWaitingForDebugger", map[string]any{})
				}()
			}
		case "Page.javascriptDialogOpening":
			var event struct {
				Type string `json:"type"`
			}
			if json.Unmarshal(packet.Params, &event) == nil && event.Type == "beforeunload" {
				go p.confirmClose(packet.Session)
			} else {
				go func() { _, _ = p.call(packet.Session, "Page.handleJavaScriptDialog", map[string]any{"accept": false}) }()
			}
		}
	}
}
func (p *browserPipe) confirmClose(session string) {
	// Cancel the browser-owned Leave prompt, then ask within the themed editor.
	// Lifecycle approval disables the second beforeunload warning before closing.
	if _, err := p.call(session, "Page.handleJavaScriptDialog", map[string]any{"accept": false}); err != nil {
		return
	}
	result, err := p.call(session, "Runtime.evaluate", map[string]any{"expression": requestCloseScript, "awaitPromise": true, "returnByValue": true, "userGesture": true})
	if err != nil {
		return
	}
	var answer struct {
		Result struct {
			Value *bool `json:"value"`
		} `json:"result"`
		Exception json.RawMessage `json:"exceptionDetails"`
	}
	if json.Unmarshal(result, &answer) != nil || len(answer.Exception) > 0 {
		return
	}
	if answer.Result.Value == nil {
		// A separate external page is not managed by NeuroMap's lifecycle.
		if _, err := p.call(session, "Page.disable", map[string]any{}); err != nil {
			return
		}
	} else if !*answer.Result.Value {
		return
	}
	_, _ = p.call(session, "Page.close", map[string]any{})
}
func (p *browserPipe) start() {
	_, _ = p.call("", "Target.setAutoAttach", map[string]any{"autoAttach": true, "waitForDebuggerOnStart": true, "flatten": true})
}
