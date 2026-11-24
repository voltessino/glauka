package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
)

// Editor spacing preferences are app-level and never overwrite an existing map.
type editorPreferences struct {
	Compactness int `json:"compactness"`
	BranchGapX  int `json:"branchGapX"`
}

func validEditorPreferences(p editorPreferences) bool {
	return p.Compactness >= 55 && p.Compactness <= 145 && p.Compactness%5 == 0 &&
		p.BranchGapX >= 30 && p.BranchGapX <= 220 && p.BranchGapX%5 == 0
}
func (s *service) editorPreferencesRoutes(mux *http.ServeMux) {
	path := filepath.Join(s.configDir, "editor-preferences.json")
	mux.HandleFunc("/__desktop/editor-preferences/read", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		data, err := os.ReadFile(path)
		if errors.Is(err, os.ErrNotExist) {
			responseJSON(w, 200, response{})
			return
		}
		if err != nil || len(data) > 4096 {
			responseJSON(w, 500, response{Message: "Preferenze editor non leggibili"})
			return
		}
		var p editorPreferences
		if json.Unmarshal(data, &p) != nil || !validEditorPreferences(p) {
			responseJSON(w, 500, response{Message: "Preferenze editor non valide"})
			return
		}
		responseJSON(w, 200, response{JSON: string(data)})
	})
	mux.HandleFunc("/__desktop/editor-preferences/write", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var request struct {
			JSON string `json:"json"`
		}
		if !readJSON(w, r, &request, 4096) {
			return
		}
		var p editorPreferences
		if len(request.JSON) > 1024 || json.Unmarshal([]byte(request.JSON), &p) != nil || !validEditorPreferences(p) {
			responseJSON(w, 400, response{Message: "Valori di spaziatura non validi"})
			return
		}
		sanitized, _ := json.Marshal(p)
		if err := atomicFile(path, sanitized); err != nil {
			responseJSON(w, 500, response{Message: "Impossibile salvare le preferenze"})
			return
		}
		responseJSON(w, 200, response{Saved: true})
	})
}
