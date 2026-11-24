package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "os"
    "path/filepath"
    "regexp"
    "strings"
)

var macOpenRequestID = regexp.MustCompile(`^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$`)

type macOpenRequest struct {
    ID   string `json:"id,omitempty"`
    Path string `json:"path"`
}

type macOpenReply struct {
    ID     string `json:"id"`
    OK     bool   `json:"ok"`
    Reason string `json:"reason,omitempty"`
}

// Finder events arrive through the Cocoa launcher's private stdin pipe.
// The very first stdout line has already carried the backend URL. Subsequent
// stdout lines acknowledge each request so that Swift never drops documents
// merely because the Go queue was full or the pipe was closed.
func (s *service) readMacNativeOpens(input io.Reader) {
    s.readMacNativeOpensWithReplies(input, os.Stdout)
}

func (s *service) readMacNativeOpensWithReplies(input io.Reader, replies io.Writer) {
    scanner := bufio.NewScanner(input)
    scanner.Buffer(make([]byte, 0, 1024), 16*1024)
    // Accepted request IDs remain idempotent even after the browser has
    // removed the document from its queue. A lost acknowledgement may be
    // retried by Swift without importing the same document twice.
    acceptedIDs := make(map[string]string)
    for scanner.Scan() {
        var event macOpenRequest
        if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
            // A damaged envelope without a known ID cannot be acknowledged.
            log.Print("Mac document-open channel received malformed envelope")
            continue
        }
        status := ""
        if macOpenRequestID.MatchString(event.ID) {
            if previous, ok := acceptedIDs[event.ID]; ok {
                if previous == event.Path { status = "accepted" } else { status = "invalid" }
            }
        }
        if status == "" {
            status = s.macNativeOpenStatus(event.Path)
            if status == "accepted" && macOpenRequestID.MatchString(event.ID) {
                if len(acceptedIDs) >= 1024 { clear(acceptedIDs) }
                acceptedIDs[event.ID] = event.Path
            }
        }
        // Old single-path callers remain compatible. New launchers send a
        // per-request UUID and only remove their item upon an explicit ack.
        if macOpenRequestID.MatchString(event.ID) {
            response := macOpenReply{ID: event.ID, OK: status == "accepted"}
            if !response.OK { response.Reason = status }
            payload, _ := json.Marshal(response)
            if _, err := fmt.Fprintln(replies, string(payload)); err != nil {
                log.Print("Mac document-open acknowledgement failed")
                return
            }
        }
    }
    if err := scanner.Err(); err != nil {
        log.Printf("Mac document-open channel closed: %v", err)
    }
}

func (s *service) macNativeOpenStatus(path string) string {
    if path == "" || len(path) > 4096 || !filepath.IsAbs(path) || !projectExtension(path) {
        return "invalid"
    }
    path = filepath.Clean(path)
    info, err := os.Stat(path)
    if err != nil || !info.Mode().IsRegular() || info.Size() < 0 || info.Size() > 100<<20 {
        return "invalid"
    }
    s.mu.Lock()
    defer s.mu.Unlock()
    for _, existing := range s.externalQueue {
        // macOS can have case-sensitive APFS volumes.
        if existing == path {
            return "accepted"
        }
    }
    if len(s.externalQueue) >= 64 {
        return "busy"
    }
    s.externalQueue = append(s.externalQueue, path)
    return "accepted"
}

// Retained for old native-open callers and existing Go regression tests.
func (s *service) queueMacNativeOpen(path string) bool {
    return strings.EqualFold(s.macNativeOpenStatus(path), "accepted")
}
