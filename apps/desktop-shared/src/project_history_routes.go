package main

import (
	"net/http"
	"path/filepath"
)

// Native-only endpoints: localhost token and an already approved project
// path are both required. Recovery always produces a new sibling file.
func (s *service) projectHistoryRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/__desktop/file/history/list", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) { return }
		var req struct { FilePath string `json:"filePath"` }
		if !readJSON(w, r, &req, 4096) { return }
		if !projectExtension(req.FilePath) || !s.authorizedPath(req.FilePath) {
			responseJSON(w, http.StatusForbidden, response{Message: "Progetto non autorizzato"})
			return
		}
		s.projectSaveMu.Lock()
		versions, err := listProjectRevisions(s.configDir, req.FilePath)
		s.projectSaveMu.Unlock()
		if err != nil {
			responseJSON(w, 500, response{Message: "Cronologia non disponibile: " + err.Error()})
			return
		}
		responseJSON(w, 200, map[string]any{"filename": filepath.Base(req.FilePath), "versions": versions})
	})

 mux.HandleFunc("/__desktop/file/history/diff", func(w http.ResponseWriter, r *http.Request) {
  if !s.secure(w,r){return}
  var req struct {
   FilePath string `json:"filePath"`
   ID string `json:"id"`
  }
  if !readJSON(w,r,&req,8192){return}
  if !projectExtension(req.FilePath)||!s.authorizedPath(req.FilePath)||!projectHistoryID.MatchString(req.ID){
   responseJSON(w,http.StatusForbidden,response{Message:"Cronologia non autorizzata"});return
  }
  diff,err:=s.describeProjectHistory(req.FilePath,req.ID)
  if err!=nil{responseJSON(w,500,response{Message:"Confronto non disponibile: "+err.Error()});return}
  responseJSON(w,200,diff)
 })
 mux.HandleFunc("/__desktop/file/history/pin", func(w http.ResponseWriter,r *http.Request) {
  if !s.secure(w,r){return}
  var req struct {
   FilePath string `json:"filePath"`
   ID string `json:"id"`
   Pinned bool `json:"pinned"`
  }
  if !readJSON(w,r,&req,8192){return}
  if !projectExtension(req.FilePath)||!s.authorizedPath(req.FilePath)||!projectHistoryID.MatchString(req.ID){
   responseJSON(w,http.StatusForbidden,response{Message:"Versione non autorizzata"});return
  }
  s.projectSaveMu.Lock()
  err:=setProjectRevisionPinned(s.configDir,req.FilePath,req.ID,req.Pinned)
  s.projectSaveMu.Unlock()
  if err!=nil{responseJSON(w,400,response{Message:"Protezione versione non riuscita: "+err.Error()});return}
  responseJSON(w,200,map[string]any{"pinned":req.Pinned})
 })
	mux.HandleFunc("/__desktop/file/history/recover", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) { return }
		var req struct {
			FilePath string `json:"filePath"`
			ID       string `json:"id"`
		}
		if !readJSON(w, r, &req, 8192) { return }
		if !projectExtension(req.FilePath) || !s.authorizedPath(req.FilePath) {
			responseJSON(w, http.StatusForbidden, response{Message: "Progetto non autorizzato"})
			return
		}
		if !projectHistoryID.MatchString(req.ID) {
			responseJSON(w, 400, response{Message: "Versione non valida"})
			return
		}
		s.projectSaveMu.Lock()
		recovered, err := recoverProjectRevision(s.configDir, req.FilePath, req.ID)
		s.projectSaveMu.Unlock()
		if err != nil {
			responseJSON(w, 500, response{Message: "Recupero non riuscito: " + err.Error()})
			return
		}
		_ = s.approvePath(recovered)
		responseJSON(w, 200, map[string]any{"recoveredPath": recovered, "name": filepath.Base(recovered)})
	})
}
