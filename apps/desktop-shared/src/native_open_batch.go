package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const maxNativeOpenFileBytes int64 = 100 << 20
const maxNativeOpenBatchBytes int64 = 100 << 20
const nativeSelectionLifetime = 15 * time.Minute

type nativeOpenFile struct {
	Filename    string           `json:"filename"`
	Path        string           `json:"path"`
	Size        int64            `json:"size"`
	ID          string           `json:"id,omitempty"`
	Error       *nativeOpenError `json:"error,omitempty"`
	Ignored     string           `json:"ignored,omitempty"`
	PathWarning bool             `json:"pathWarning,omitempty"`
	modified    time.Time
}
type nativeOpenError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *nativeOpenError) Error() string { return e.Message }

// Only native-picker selections get tickets. No HTTP endpoint accepts a path
// as a read grant. Responses contain metadata; bytes are streamed on demand.
func (s *service) prepareNativeSelection(paths []string) []nativeOpenFile {
	files := make([]nativeOpenFile, 0, len(paths))
	seen := make(map[string]bool)
	grants := []string{}
	var total int64
	for _, path := range paths {
		f := nativeOpenFile{Filename: filepath.Base(path), Path: path}
		key, err := approvedPathKey(path)
		switch {
		case !projectExtension(path):
			f.Error = &nativeOpenError{"unsupported", "Tipo di file non supportato"}
		case err != nil:
			f.Error = &nativeOpenError{"unreadable", "File non accessibile"}
		case seen[key]:
			f.Ignored = "duplicate"
		default:
			seen[key] = true
			info, err := os.Stat(path)
			if err != nil || !info.Mode().IsRegular() || info.Size() < 0 {
				f.Error = &nativeOpenError{"unreadable", "File non accessibile"}
			} else if info.Size() > maxNativeOpenFileBytes {
				f.Error = &nativeOpenError{"tooLarge", "File oltre il limite di 100 MB"}
			} else if total+info.Size() > maxNativeOpenBatchBytes {
				f.Error = &nativeOpenError{"batchSize", "Limite complessivo di 100 MB raggiunto"}
			} else {
				f.Size = info.Size()
				f.modified = info.ModTime()
				f.ID = randomToken()
				total += f.Size
				if !s.authorizedPath(path) {
					grants = append(grants, path)
				}
			}
		}
		files = append(files, f)
	}
	grantErr := s.approvePaths(grants)
	selected := make(map[string]nativeOpenFile)
	for i := range files {
		if files[i].ID != "" {
			files[i].PathWarning = grantErr != nil && !s.authorizedPath(files[i].Path)
			selected[files[i].ID] = files[i]
		}
	}
	s.mu.Lock()
	s.nativeSelection = selected
	s.nativeSelectionAt = time.Now()
	s.mu.Unlock()
	return files
}
func (s *service) readNativeSelection(w http.ResponseWriter, r *http.Request) {
	if !s.secure(w, r) {
		return
	}
	var q struct {
		ID string `json:"id"`
	}
	if !readJSON(w, r, &q, 512) {
		return
	}
	s.mu.Lock()
	f, ok := s.nativeSelection[q.ID]
	expired := time.Since(s.nativeSelectionAt) > nativeSelectionLifetime
	s.mu.Unlock()
	if !ok || len(q.ID) != 43 || expired {
		responseJSON(w, http.StatusGone, nativeOpenError{"expired", "Selezione scaduta: seleziona nuovamente il file"})
		return
	}
	file, err := os.Open(f.Path)
	if err != nil {
		responseJSON(w, http.StatusConflict, nativeOpenError{"unreadable", "File non più accessibile"})
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() != f.Size || !info.ModTime().Equal(f.modified) || info.Size() > maxNativeOpenFileBytes {
		responseJSON(w, http.StatusConflict, nativeOpenError{"changed", "Il file è cambiato: selezionalo nuovamente"})
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", fmt.Sprint(f.Size))
	if f.PathWarning {
		w.Header().Set("X-Glauka-Path-Warning", "1")
	}
	// A growing file cannot increase the selected memory budget. A shrinking
	// file yields an incomplete HTTP body, which the bridge reports as a failure.
	_, _ = io.CopyN(w, file, f.Size)
}
