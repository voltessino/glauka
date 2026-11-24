package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// Reliable desktop handoff is shared by macOS and Windows. A read merely
// reserves a stable delivery ID; only explicit confirmation removes the
// file. A failed delivery can be excluded while other documents are opened.
func (s *service) externalPending(w http.ResponseWriter, r *http.Request) {
	if !s.secure(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var request struct {
		Exclude []string `json:"exclude"`
	}
	if !readJSON(w, r, &request, 8192) {
		return
	}
	if len(request.Exclude) > 64 {
		responseJSON(w, 400, response{Message: "Troppe esclusioni"})
		return
	}
	excluded := make(map[string]bool)
	for _, id := range request.Exclude {
		excluded[id] = true
	}
	s.mu.Lock()
	if s.externalDeliveries == nil {
		s.externalDeliveries = make(map[string]string)
	}
	path, id := "", ""
	for _, candidate := range s.externalQueue {
		candidateID := ""
		for key, value := range s.externalDeliveries {
			if value == candidate {
				candidateID = key
				break
			}
		}
		if candidateID == "" {
			candidateID = randomToken()
			s.externalDeliveries[candidateID] = candidate
		}
		if !excluded[candidateID] {
			path, id = candidate, candidateID
			break
		}
	}
	s.mu.Unlock()
	if path == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("X-Glauka-Delivery-ID", id)
	w.Header().Set("X-NeuroMap-Filename", base64.RawURLEncoding.EncodeToString([]byte(filepath.Base(path))))
	w.Header().Set("X-NeuroMap-Path", base64.RawURLEncoding.EncodeToString([]byte(path)))
	w.Header().Set("Cache-Control", "no-store")
	file, err := os.Open(path)
	if err != nil {
		responseJSON(w, http.StatusConflict, response{Message: "Il file selezionato non è più accessibile. Riprova oppure scegli di saltarlo."})
		return
	}
	defer file.Close()
	fi, err := file.Stat()
	if err != nil || !fi.Mode().IsRegular() || fi.Size() < 0 || fi.Size() > 100<<20 {
		responseJSON(w, http.StatusConflict, response{Message: "Il file selezionato non è più accessibile o è troppo grande."})
		return
	}
	if !s.authorizedPath(path) {
		if err = s.approvePath(path); err != nil {
			w.Header().Set("X-Glauka-Path-Warning", "1")
		}
	}
	s.mu.Lock()
	unchanged := s.externalDeliveries[id] == path
	s.mu.Unlock()
	if !unchanged {
		responseJSON(w, http.StatusConflict, response{Message: "La coda documenti è cambiata. Riprova."})
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-NeuroMap-Filename", base64.RawURLEncoding.EncodeToString([]byte(filepath.Base(path))))
	w.Header().Set("X-NeuroMap-Path", base64.RawURLEncoding.EncodeToString([]byte(path)))
	w.Header().Set("Content-Length", fmt.Sprint(fi.Size()))
	_, _ = io.CopyN(w, file, fi.Size())
}

func (s *service) externalConfirm(w http.ResponseWriter, r *http.Request) {
	if !s.secure(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID     string `json:"id"`
		Action string `json:"action"`
	}
	if !readJSON(w, r, &req, 1024) {
		return
	}
	if len(req.ID) != 43 || (req.Action != "imported" && req.Action != "skip") {
		responseJSON(w, http.StatusBadRequest, response{Message: "Conferma documento non valida"})
		return
	}
	s.mu.Lock()
	if req.ID == s.externalLastConfirmedID {
		s.mu.Unlock()
		responseJSON(w, http.StatusOK, response{OK: true})
		return
	}
	path, known := s.externalDeliveries[req.ID]
	index := -1
	for i, queued := range s.externalQueue {
		if queued == path {
			index = i
			break
		}
	}
	if !known || index < 0 {
		s.mu.Unlock()
		responseJSON(w, http.StatusConflict, response{Message: "Conferma non corrispondente al documento richiesto"})
		return
	}
	s.externalQueue = append(s.externalQueue[:index], s.externalQueue[index+1:]...)
	s.externalLastConfirmedID = req.ID
	delete(s.externalDeliveries, req.ID)
	s.mu.Unlock()
	responseJSON(w, http.StatusOK, response{OK: true})
}
