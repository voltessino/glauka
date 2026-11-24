package main

import (
	"bufio"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"
)

func TestBrowserPipeCloseChoices(t *testing.T) {
	for _, save := range []bool{false, true} {
		t.Run(map[bool]string{false: "cancel", true: "save-or-discard"}[save], func(t *testing.T) {
			fromBrowser, toBackend := io.Pipe()
			fromBackend, toBrowser := io.Pipe()
			p := newBrowserPipe(fromBrowser, toBrowser)
			defer p.close()
			go p.confirmClose("own-window")
			r := bufio.NewReader(fromBackend)
			methods := []string{}
			go func() {
				defer toBackend.Close()
				for {
					line, err := r.ReadBytes(0)
					if err != nil {
						return
					}
					var packet browserPacket
					if json.Unmarshal(line[:len(line)-1], &packet) != nil {
						return
					}
					methods = append(methods, packet.Method)
					value := json.RawMessage(`{}`)
					if packet.Method == "Runtime.evaluate" {
						data, _ := json.Marshal(map[string]any{"result": map[string]any{"value": save}})
						value = data
					}
					data, _ := json.Marshal(browserPacket{ID: packet.ID, Result: value})
					_, _ = toBackend.Write(append(data, 0))
					if packet.Method == "Runtime.evaluate" && !save || packet.Method == "Page.close" {
						return
					}
				}
			}()
			select {
			case <-p.done:
			case <-time.After(3 * time.Second):
				t.Fatal("close pipeline stalled")
			}
			want := 2
			if save {
				want = 3
			}
			if len(methods) != want || methods[0] != "Page.handleJavaScriptDialog" || methods[1] != "Runtime.evaluate" {
				t.Fatalf("unexpected close commands: %v", methods)
			}
		})
	}
}

func TestBrowserPipeReturnsProtocolErrors(t *testing.T) {
	read, send := io.Pipe()
	defer send.Close()
	receive, write := io.Pipe()
	p := newBrowserPipe(read, write)
	defer p.close()
	go func() {
		r := bufio.NewReader(receive)
		line, err := r.ReadBytes(0)
		if err != nil {
			return
		}
		var packet browserPacket
		_ = json.Unmarshal(line[:len(line)-1], &packet)
		data, _ := json.Marshal(browserPacket{ID: packet.ID, Error: json.RawMessage(`{"code":-32000,"message":"Target closed"}`)})
		_, _ = send.Write(append(data, 0))
	}()
	if _, err := p.call("closed-page", "Page.enable", map[string]any{}); err == nil || !strings.Contains(err.Error(), "Target closed") {
		t.Fatal("rejected command was reported as successful")
	}
}
func TestBrowserPipeUnmanagedPageRestoresBrowserClose(t *testing.T) {
	read, send := io.Pipe()
	receive, write := io.Pipe()
	p := newBrowserPipe(read, write)
	defer p.close()
	methods := make(chan []string, 1)
	go func() {
		r := bufio.NewReader(receive)
		var seen []string
		for {
			line, err := r.ReadBytes(0)
			if err != nil {
				return
			}
			var packet browserPacket
			_ = json.Unmarshal(line[:len(line)-1], &packet)
			seen = append(seen, packet.Method)
			result := json.RawMessage(`{}`)
			if packet.Method == "Runtime.evaluate" {
				result = json.RawMessage(`{"result":{"type":"object","subtype":"null","value":null}}`)
			}
			data, _ := json.Marshal(browserPacket{ID: packet.ID, Result: result})
			_, _ = send.Write(append(data, 0))
			if packet.Method == "Page.close" {
				methods <- seen
				return
			}
		}
	}()
	go p.confirmClose("external-page")
	select {
	case got := <-methods:
		if len(got) != 4 || got[2] != "Page.disable" || got[3] != "Page.close" {
			t.Fatalf("external close did not restore browser handling: %v", got)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("external close stalled")
	}
}
