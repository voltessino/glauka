package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	neturl "net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

//go:embed resources/index.html resources/icon.ico bridge.js cloud_panel.js cloud_panel.css cloud_modules.js cloud_reader.js cloud_library_ui.js cloud_sync_ui.js resources/pdfjs/* resources/mathjax/* resources/ocr/* resources/locales/*
var content embed.FS

const maxWorkspace = 80 << 20
const maxAIRequest = 3 << 20
const maxAIResponse = 6 << 20

type service struct {
	secret                  string
	cspNonce                string
	configDir               string
	mu                      sync.Mutex
	active                  map[string]*activeAIRequest
	shutdownOnce            sync.Once
	shutdownCh              chan struct{}
	workspaceMu             sync.Mutex
	projectSaveMu           sync.Mutex
	lastHeartbeat           atomic.Int64
	windows                 desktopWindowState
	ipcToken                string
	externalQueue           []string
	externalDeliveries      map[string]string
	nativeSelection         map[string]nativeOpenFile
	nativeSelectionAt       time.Time
	externalLastConfirmedID string
	approvedPaths           map[string]bool
	lanPair                 lanPairingManager
}

type response struct {
	RecoveredPrevious bool   `json:"recoveredPrevious,omitempty"`
	Message           string `json:"message,omitempty"`
	JSON              string `json:"json,omitempty"`
	Saved             bool   `json:"saved,omitempty"`
	OK                bool   `json:"ok,omitempty"`
	Status            int    `json:"status,omitempty"`
	StatusText        string `json:"statusText,omitempty"`
	Body              string `json:"body,omitempty"`
	BodyBase64        bool   `json:"bodyBase64,omitempty"`
	ContentType       string `json:"contentType,omitempty"`
}

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func dataDir() string {
	if v := os.Getenv("APPDATA"); v != "" {
		return filepath.Join(v, "NeuroMap Architect")
	}
	d, e := os.UserConfigDir()
	if e != nil {
		d = os.TempDir()
	}
	base := filepath.Join(d, "NeuroMap Architect")
	// Preserve every existing public Mac workspace and credential path.
	// Only private Developer builds receive an isolated root.
	if runtime.GOOS == "darwin" && developerEdition() {
		return filepath.Join(base, "Developer")
	}
	return base
}

// All callers in this process share the lock, including workspace autosave,
// project saves and approved-path metadata. The staging and replacement paths
// must never be reused by another writer before the replacement has completed.
var atomicFileMu sync.Mutex

func atomicFile(path string, data []byte) error {
	atomicFileMu.Lock()
	defer atomicFileMu.Unlock()
	unlock, err := lockAtomicReplacement(path)
	if err != nil {
		return err
	}
	defer unlock()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	// A unique sibling staging file prevents independent app instances from
	// truncating or renaming each other's in-progress save.
	if info, err := os.Lstat(path); err == nil && !info.Mode().IsRegular() {
		return fmt.Errorf("save destination is not a regular file: %s", path)
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".glauka.pending-*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err := os.Rename(tmp, path); err != nil {
		// Windows may not replace an existing file with Rename. Stage the old
		// file aside, install the new one, roll back on error. Never delete
		// the user's only saved copy in the error path.
		backup := path + ".replace-pending"
		// A previous interrupted replacement may have left the only old copy
		// here. Keep it for recovery instead of deleting it on a retry.
		if _, statErr := os.Lstat(backup); !errors.Is(statErr, os.ErrNotExist) {
			return fmt.Errorf("replacement recovery file already exists or is inaccessible: %s", backup)
		}
		if moveErr := os.Rename(path, backup); moveErr != nil {
			_ = os.Remove(tmp)
			return err
		}
		if installErr := os.Rename(tmp, path); installErr != nil {
			if rollbackErr := os.Rename(backup, path); rollbackErr != nil {
				return fmt.Errorf("%w; previous copy retained at %s: %v", installErr, backup, rollbackErr)
			}
			return installErr
		}
		_ = os.Remove(backup)
	}
	return nil
}
func responseJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func readJSON(w http.ResponseWriter, r *http.Request, v any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(v); err != nil {
		responseJSON(w, 400, response{Message: "Richiesta non valida o troppo grande."})
		return false
	}
	// Reject concatenated JSON documents. A single request must represent
	// exactly one operation and must not hide trailing instructions.
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		responseJSON(w, 400, response{Message: "Richiesta JSON con dati aggiuntivi."})
		return false
	}
	return true
}

// A loopback port is not an authentication boundary: another local process
// can read unauthenticated HTTP responses. Only the launched UI may bootstrap
// the bearer through a one-time URL, then a HttpOnly session cookie.
func (s *service) validSession(provided string) bool {
	return len(provided) == len(s.secret) &&
		subtle.ConstantTimeCompare([]byte(provided), []byte(s.secret)) == 1
}
func (s *service) secure(w http.ResponseWriter, r *http.Request) bool {
	drain := func() {
		if r.Body != nil {
			_, _ = io.Copy(io.Discard, io.LimitReader(r.Body, 65536))
		}
	}
	reject := func(status int, msg string) bool {
		drain()
		w.Header().Set("Connection", "close")
		http.Error(w, msg, status)
		return false
	}
	if r.Method != "POST" {
		return reject(405, "Method not allowed")
	}
	provided := r.Header.Get("X-NeuroMap-Session")
	if !s.validSession(provided) {
		return reject(403, "Unauthorized")
	}
	// Cross-origin pages must not invoke privileged native endpoints,
	// even if future Chromium versions alter Origin header behavior.
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
		return reject(http.StatusForbidden, "Cross-site request denied")
	}
	origin := r.Header.Get("Origin")
	if origin != "" && origin != "http://"+r.Host {
		return reject(403, "Origin not allowed")
	}
	return true
}

var safeIconPiece = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$`)

func illustrationUpstreamURL(kind, query, prefix, name string) (string, error) {
	q := strings.TrimSpace(query)
	if len(q) > 100 {
		return "", errors.New("Termine di ricerca troppo lungo")
	}
	switch kind {
	case "translate":
		if q == "" {
			return "", errors.New("Termine di traduzione vuoto")
		}
		return "https://api.mymemory.translated.net/get?q=" + neturl.QueryEscape(q) + "&langpair=it%7Cen", nil
	case "search":
		if q == "" {
			return "", errors.New("Ricerca vuota")
		}
		return "https://api.iconify.design/search?query=" + neturl.QueryEscape(q) + "&prefixes=fluent-emoji-flat%2Cnoto&limit=6", nil
	case "svg":
		if !(prefix == "fluent-emoji-flat" || prefix == "noto") || !safeIconPiece.MatchString(name) {
			return "", errors.New("Identificativo SVG non consentito")
		}
		return "https://api.iconify.design/" + prefix + "/" + name + ".svg", nil
	default:
		return "", errors.New("Tipo di richiesta non valido")
	}
}

// localOnlyHeaders rejects DNS rebinding through attacker-controlled Host headers.
// Browsers use http://127.0.0.1:<ephemeral port>, never a public hostname.
func localOnlyHeaders(nonce string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		drain := func() {
			if r.Body != nil {
				_, _ = io.Copy(io.Discard, io.LimitReader(r.Body, 65536))
			}
		}
		host, _, err := net.SplitHostPort(r.Host)
		if err != nil || host != "127.0.0.1" {
			drain()
			w.Header().Set("Connection", "close")
			http.Error(w, "Invalid desktop origin", http.StatusForbidden)
			return
		}
		if site := r.Header.Get("Sec-Fetch-Site"); site == "cross-site" &&
			r.URL.Path != "/favicon.ico" &&
			!(r.Method == http.MethodGet && r.URL.Path == "/__desktop/cloud/oauth/callback") {
			drain()
			w.Header().Set("Connection", "close")
			http.Error(w, "Cross-site navigation denied", http.StatusForbidden)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; base-uri 'none'; object-src 'none'; frame-src blob:; form-action 'none'; frame-ancestors 'none'; script-src 'nonce-"+nonce+"' 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'unsafe-inline'; media-src 'self' blob:; img-src 'self' data: blob: https://api.iconify.design; connect-src 'self' https://api.iconify.design https://api.mymemory.translated.net; font-src 'self' data:")
		next.ServeHTTP(w, r)
	})
}

func (s *service) routes() *http.ServeMux {
	mux := http.NewServeMux()
	s.interfaceLocaleRoutes(mux)
	page, _ := content.ReadFile("resources/index.html")
	bridge, _ := content.ReadFile("bridge.js")
	cloudPanel, _ := content.ReadFile("cloud_panel.js")
	cloudStyles, _ := content.ReadFile("cloud_panel.css")
	cloudModules, _ := content.ReadFile("cloud_modules.js")
	cloudReader, _ := content.ReadFile("cloud_reader.js")
	cloudLibrary, _ := content.ReadFile("cloud_library_ui.js")
	cloudSyncUI, _ := content.ReadFile("cloud_sync_ui.js")
	bridgeStr := strings.ReplaceAll(string(bridge), "{{TOKEN}}", s.secret)
	bridgeStr = strings.ReplaceAll(bridgeStr, "{{DEV_EDITION}}", fmt.Sprint(developerEdition()))
	// CSP nonces and the API bearer token have different security purposes.
	// Reusing one secret here would unnecessarily couple script permission to
	// native file/AI authorization. Both are random per process launch.
	cspNonce := s.cspNonce
	if cspNonce == "" {
		cspNonce = randomToken()
	}
	// The very first theme bootstrap is an inline named script. Without its
	// nonce, the native CSP blocks it and a saved dark theme flashes white.
	modified := strings.Replace(string(page), `<script id="glauka-theme-boot">`, `<script id="glauka-theme-boot" nonce="`+cspNonce+`">`, 1)
	modified = strings.Replace(modified, `<script id="glauka-startup-guard">`, `<script id="glauka-startup-guard" nonce="`+cspNonce+`">`, 1)
	modified = strings.Replace(modified, "<script>", "<script nonce=\""+cspNonce+"\">", 1)
	modified = strings.Replace(modified, "</head>", "<style>"+string(cloudStyles)+"</style>\n<script nonce=\""+cspNonce+"\">"+bridgeStr+"</script>\n<script nonce=\""+cspNonce+"\">"+string(cloudModules)+"</script>\n<script nonce=\""+cspNonce+"\">"+string(cloudReader)+"</script>\n<script nonce=\""+cspNonce+"\">"+string(cloudLibrary)+"</script>\n<script nonce=\""+cspNonce+"\">"+string(cloudSyncUI)+"</script>\n<script nonce=\""+cspNonce+"\">"+string(cloudPanel)+"</script>\n</head>", 1)
	if developerEdition() {
		modified = strings.Replace(modified, "<title>Glauka</title>", "<title>Glauka — Developer</title>", 1)
	}
	ico, _ := content.ReadFile("resources/icon.ico")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// The initial UI navigation is explicitly launched with this one-time
		// capability. Never put the API bearer in a public GET / response.
		// After login, remove the capability from the URL immediately.
		if supplied := r.URL.Query().Get("__nm_launch"); supplied != "" {
			if !s.validSession(supplied) {
				http.Error(w, "Invalid application launch", http.StatusForbidden)
				return
			}
			http.SetCookie(w, &http.Cookie{
				Name: "nm_local_ui", Value: s.secret, Path: "/",
				HttpOnly: true, SameSite: http.SameSiteStrictMode,
			})
			w.Header().Set("Cache-Control", "no-store")
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		cookie, err := r.Cookie("nm_local_ui")
		if err != nil || !s.validSession(cookie.Value) {
			http.Error(w, "NeuroMap UI session required", http.StatusForbidden)
			return
		}
		if r.Header.Get("Sec-Fetch-Dest") == "document" {
			s.windows.loading(time.Now())
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = io.WriteString(w, s.localizedInterfacePage(modified))
	})
	// Explicit allowlist: trusted offline PDF.js display module/worker and image/color decoders.
	// The browser is forbidden from fetching arbitrary files in resources.
	mux.HandleFunc("/pdfjs/", func(w http.ResponseWriter, r *http.Request) {
		allowed := map[string]string{
			"/pdfjs/pdf.mjs":                         "text/javascript; charset=utf-8",
			"/pdfjs/pdf.worker.mjs":                  "text/javascript; charset=utf-8",
			"/pdfjs/wasm/jbig2_nowasm_fallback.js":   "text/javascript; charset=utf-8",
			"/pdfjs/wasm/openjpeg_nowasm_fallback.js":"text/javascript; charset=utf-8",
			"/pdfjs/wasm/jbig2.wasm":                 "application/wasm",
			"/pdfjs/wasm/openjpeg.wasm":              "application/wasm",
			"/pdfjs/wasm/qcms_bg.wasm":               "application/wasm",
		}
		mimeType, ok := allowed[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		data, err := content.ReadFile("resources" + r.URL.Path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", mimeType)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(data)
	})
	// MathJax stays off the first paint; formulas load this one allowlisted file.
	mux.HandleFunc("/mathjax/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/mathjax/mathjax.js" {
			http.NotFound(w, r)
			return
		}
		data, err := content.ReadFile("resources/mathjax/mathjax.js")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(data)
	})
	mux.HandleFunc("/ocr/", func(w http.ResponseWriter, r *http.Request) {
		allowed := map[string]string{
			"tesseract.min.js": "text/javascript", "worker.min.js": "text/javascript", "host-worker.js": "text/javascript",
			"tesseract-core-lstm.wasm.js": "text/javascript", "tesseract-core-simd-lstm.wasm.js": "text/javascript", "ita.traineddata": "application/octet-stream",
		}
		name := strings.TrimPrefix(r.URL.Path, "/ocr/")
		mime, ok := allowed[name]
		if !ok {
			http.NotFound(w, r)
			return
		}
		data, err := content.ReadFile("resources/ocr/" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", mime)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'")
		_, _ = w.Write(data)
	})
	mux.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/x-icon")
		_, _ = w.Write(ico)
	})
	mux.HandleFunc("/__desktop/external/submit", s.acceptInstanceSubmission)
	mux.HandleFunc("/__desktop/external/pending", s.externalPending)
	mux.HandleFunc("/__desktop/external/confirm", s.externalConfirm)
	mux.HandleFunc("/__desktop/external/read", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		s.mu.Lock()
		filePath := ""
		if len(s.externalQueue) > 0 {
			filePath = s.externalQueue[0]
			s.externalQueue = s.externalQueue[1:]
			for id,path:=range s.externalDeliveries{if path==filePath{delete(s.externalDeliveries,id)}}
		}
		s.mu.Unlock()
		if filePath == "" {
			w.WriteHeader(204)
			return
		}
		fi, err := os.Stat(filePath)
		if err != nil || !fi.Mode().IsRegular() || fi.Size() > 100*1024*1024 {
			responseJSON(w, 400, response{Message: "Impossibile aprire il progetto associato"})
			return
		}
		data, err := os.ReadFile(filePath)
		if err != nil {
			responseJSON(w, 500, response{Message: "Impossibile leggere il progetto"})
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Cache-Control", "no-store")
		if err := s.approvePath(filePath); err != nil {
			// A read-only open must still succeed when the preferences folder
			// is full or read-only. Tell the UI that Save As may be required.
			w.Header().Set("X-Glauka-Path-Warning","1")
		}
		w.Header().Set("X-NeuroMap-Filename", base64.RawURLEncoding.EncodeToString([]byte(filepath.Base(filePath))))
		w.Header().Set("X-NeuroMap-Path", base64.RawURLEncoding.EncodeToString([]byte(filePath)))
		_, _ = w.Write(data)
	})
	mux.HandleFunc("/__desktop/heartbeat", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var q struct {
			WindowID string `json:"windowId"`
			Sequence uint64 `json:"sequence"`
			State    string `json:"state"`
			Hidden   bool   `json:"hidden"`
		}
		if !readJSON(w, r, &q, 2048) {
			return
		}
		now := time.Now()
		s.lastHeartbeat.Store(now.Unix())
		s.windows.update(q.WindowID, q.State, q.Hidden, now, q.Sequence)
		responseJSON(w, 200, response{OK: true})
	})
	mux.HandleFunc("/__desktop/clipboard/png", s.clipboardPNGRoute)
	mux.HandleFunc("/__desktop/window/closed", s.windowClosedRoute)
	mux.HandleFunc("/__desktop/window/live", s.windowLiveRoute)

	s.editorPreferencesRoutes(mux)
	// Native Time Machine endpoints are restricted to approved project paths.
	s.projectHistoryRoutes(mux)
	// Optional Cloud Sync: local-only durable staging and queue, no tokens.
	s.cloudLocalRoutes(mux)
	// Native browser OAuth callback is separately state-bound; tokens stay sealed.
	s.cloudOAuthRoutes(mux)
	// Server-side authenticated cloud HTTP; token never crosses bridge boundary.
	s.cloudTransportRoutes(mux)
	// Optional on-demand local neural TTS model manager (0 MB bundled in binary).
	// Keyless online voice. Offline playback stays on the neural route above.
	// Optional Glauka Studio companion plugin connector (127.0.0.1:3940 loopback + local manifest).
	mux.HandleFunc("/__desktop/settings/read", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		data, err := os.ReadFile(filepath.Join(s.configDir, "ai-settings.json"))
		if errors.Is(err, os.ErrNotExist) {
			responseJSON(w, 200, response{})
			return
		}
		if err != nil || len(data) > 65536 {
			responseJSON(w, 500, response{Message: "Impostazioni AI non disponibili"})
			return
		}
		responseJSON(w, 200, response{JSON: string(data)})
	})
	mux.HandleFunc("/__desktop/settings/write", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var input struct {
			JSON string `json:"json"`
		}
		if !readJSON(w, r, &input, 65536) {
			return
		}
		var settings map[string]json.RawMessage
		if len(input.JSON) > 65000 || json.Unmarshal([]byte(input.JSON), &settings) != nil {
			responseJSON(w, 400, response{Message: "Configurazione non valida"})
			return
		}
		delete(settings, "apiKey")
		delete(settings, "key")
		data, _ := json.Marshal(settings)
		if err := atomicFile(filepath.Join(s.configDir, "ai-settings.json"), data); err != nil {
			responseJSON(w, 500, response{Message: "Scrittura impostazioni fallita"})
			return
		}
		responseJSON(w, 200, response{Saved: true})
	})
	mux.HandleFunc("/__desktop/workspace/read", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		path := filepath.Join(s.configDir, "workspace-autosave.json")
		s.workspaceMu.Lock()
		payload, previous, err := readRecovery(path)
		s.workspaceMu.Unlock()
		if err != nil {
			responseJSON(w, 500, response{Message: "Backup non disponibile: esporta i progetti aperti prima di riprendere."})
			return
		}
		responseJSON(w, 200, response{JSON: string(payload), RecoveredPrevious: previous})
	})
	mux.HandleFunc("/__desktop/workspace/write", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var input struct {
			JSON string `json:"json"`
		}
		if !readJSON(w, r, &input, maxWorkspace+4096) {
			return
		}
		var doc struct {
			Tabs []json.RawMessage `json:"tabs"`
		}
		if len(input.JSON) > maxWorkspace || json.Unmarshal([]byte(input.JSON), &doc) != nil || len(doc.Tabs) == 0 || len(doc.Tabs) > 100 {
			responseJSON(w, 400, response{Message: "Workspace non valido o superiore a 80 MB"})
			return
		}
		s.workspaceMu.Lock()
		err := writeRecovery(filepath.Join(s.configDir, "workspace-autosave.json"), []byte(input.JSON))
		s.workspaceMu.Unlock()
		if err != nil {
			responseJSON(w, 500, response{Message: "Impossibile scrivere il backup"})
			return
		}
		responseJSON(w, 200, response{Saved: true})
	})
	// Explicit "Non salvare" is not an autosave: remove ONLY the volatile
	// workspace recovery snapshot, never a user-authored .neuromap/.xmind file.
	// The UI must await its queued writes BEFORE requesting this operation.
	mux.HandleFunc("/__desktop/workspace/discard", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		s.workspaceMu.Lock()
		err := discardRecovery(filepath.Join(s.configDir, "workspace-autosave.json"))
		s.workspaceMu.Unlock()
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			responseJSON(w, 500, response{Message: "Impossibile annullare il recupero temporaneo"})
			return
		}
		responseJSON(w, 200, response{OK: true})
	})
	mux.HandleFunc("/__desktop/product/status", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) { return }
		responseJSON(w, 200, s.productStatus())
	})
	mux.HandleFunc("/__desktop/file/open-many", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		paths, err := desktopMultiOpenDialog()
		if err != nil {
			responseJSON(w, 500, response{Message: err.Error()})
			return
		}
		if len(paths) == 0 {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if len(paths) > maxNativeOpenFiles {
			responseJSON(w, 400, response{Message: "Seleziona massimo 30 file per volta"})
			return
		}
		responseJSON(w, 200, map[string]any{"files": s.prepareNativeSelection(paths)})
	})
	mux.HandleFunc("/__desktop/file/read-selected", s.readNativeSelection)
	// Fixed upstream hosts; the desktop bridge never accepts arbitrary URLs.
	mux.HandleFunc("/__desktop/illustration", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var q struct {
			Kind   string `json:"kind"`
			Query  string `json:"query"`
			Prefix string `json:"prefix"`
			Name   string `json:"name"`
		}
		if !readJSON(w, r, &q, 2048) {
			return
		}
		url, err := illustrationUpstreamURL(q.Kind, q.Query, q.Prefix, q.Name)
		if err != nil {
			responseJSON(w, 400, response{Message: err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			responseJSON(w, 400, response{Message: "Richiesta icona non valida"})
			return
		}
		req.Header.Set("User-Agent", "NeuroMap-Architect/6.2")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			responseJSON(w, 502, response{Message: "Servizio illustrazioni non raggiungibile: " + err.Error()})
			return
		}
		defer res.Body.Close()
		if res.StatusCode < 200 || res.StatusCode >= 300 {
			responseJSON(w, 502, response{Message: fmt.Sprintf("Servizio Iconify/Traduzione: HTTP %d", res.StatusCode)})
			return
		}
		body, err := io.ReadAll(io.LimitReader(res.Body, 120001))
		if err != nil || len(body) > 120000 {
			responseJSON(w, 502, response{Message: "Risposta iconografia troppo grande"})
			return
		}
		responseJSON(w, 200, map[string]string{"payload": string(body)})
	})
	// Native open preserves the full file identity, unlike <input type=file>.
	mux.HandleFunc("/__desktop/file/open", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		path, err := desktopFileDialog(false, "")
		if err != nil {
			responseJSON(w, 500, response{Message: err.Error()})
			return
		}
		if path == "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if !projectExtension(path) {
			responseJSON(w, 400, response{Message: "Estensione non supportata"})
			return
		}
		fi, err := os.Stat(path)
		if err != nil || !fi.Mode().IsRegular() || fi.Size() > 100<<20 {
			responseJSON(w, 400, response{Message: "File non valido o troppo grande"})
			return
		}
		file, err := os.Open(path)
		if err != nil {
			responseJSON(w, 500, response{Message: err.Error()})
			return
		}
		defer file.Close()
		if err := s.approvePath(path); err != nil {
			w.Header().Set("X-Glauka-Path-Warning","1")
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("X-NeuroMap-Filename", base64.RawURLEncoding.EncodeToString([]byte(filepath.Base(path))))
		w.Header().Set("X-NeuroMap-Path", base64.RawURLEncoding.EncodeToString([]byte(path)))
		w.Header().Set("Cache-Control", "no-store")
		_, _ = io.Copy(w, file)
	})
	mux.HandleFunc("/__desktop/file/recent/list", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		responseJSON(w, 200, map[string]any{"files": s.listRecentApprovedProjects(20)})
	})
	mux.HandleFunc("/__desktop/file/recent/open", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var req struct {
			Path string `json:"path"`
		}
		if !readJSON(w, r, &req, 8192) {
			return
		}
		if !projectExtension(req.Path) || !s.authorizedPath(req.Path) {
			responseJSON(w, http.StatusForbidden, response{Message: "Percorso recente non autorizzato"})
			return
		}
		fi, err := os.Stat(req.Path)
		if errors.Is(err, os.ErrNotExist) {
			responseJSON(w, http.StatusNotFound, response{Message: "Il file recente non si trova più in quella posizione"})
			return
		}
		if err != nil || !fi.Mode().IsRegular() || fi.Size() > maxNativeOpenFileBytes {
			responseJSON(w, http.StatusBadRequest, response{Message: "File recente non valido o troppo grande"})
			return
		}
		file, err := os.Open(req.Path)
		if err != nil {
			responseJSON(w, http.StatusInternalServerError, response{Message: "Impossibile leggere il file recente"})
			return
		}
		defer file.Close()
		absPath, err := filepath.Abs(req.Path)
		if err != nil {
			absPath = filepath.Clean(req.Path)
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("X-NeuroMap-Filename", base64.RawURLEncoding.EncodeToString([]byte(filepath.Base(absPath))))
		w.Header().Set("X-NeuroMap-Path", base64.RawURLEncoding.EncodeToString([]byte(absPath)))
		w.Header().Set("Cache-Control", "no-store")
		_, _ = io.Copy(w, file)
	})
	mux.HandleFunc("/__desktop/file/export", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var q struct {
			Filename string `json:"filename"`
			Base64   string `json:"base64"`
		}
		if !readJSON(w, r, &q, maxWorkspace+maxWorkspace/3) {
			return
		}
		name := filepath.Base(q.Filename)
		if name == "" || name == "." || len(name) > 200 {
			name = "NeuroMap-export.json"
		}
		ext := strings.ToLower(filepath.Ext(name))
		allowed := map[string]bool{".png": true, ".svg": true, ".md": true, ".json": true, ".opml": true, ".xml": true, ".txt": true, ".html": true, ".ics": true, ".pdf": true, ".docx": true, ".zip": true, ".mm": true, ".neuromap": true, ".gk": true, ".glk": true}
		if !allowed[ext] {
			responseJSON(w, 400, response{Message: "Formato export non consentito"})
			return
		}
		data, err := base64.StdEncoding.DecodeString(q.Base64)
		if err != nil || len(data) > maxWorkspace {
			responseJSON(w, 400, response{Message: "Export non valido"})
			return
		}
		dest, err := desktopExportDialog(name)
		if err != nil {
			responseJSON(w, 500, response{Message: err.Error()})
			return
		}
		if dest == "" {
			responseJSON(w, 200, map[string]any{"cancelled": true})
			return
		}
		// Prevent overwriting projects or executables when changing the suffix.
		if !allowed[strings.ToLower(filepath.Ext(dest))] {
			responseJSON(w, 400, response{Message: "Estensione export non consentita"})
			return
		}
		if err = atomicFile(dest, data); err != nil {
			responseJSON(w, 500, response{Message: err.Error()})
			return
		}
		responseJSON(w, 200, map[string]any{"cancelled": false, "name": filepath.Base(dest)})
	})
	mux.HandleFunc("/__desktop/file/save", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var q struct {
			JSON        string            `json:"json"`
			Filename    string            `json:"filename"`
			FilePath    string            `json:"filePath"`
			SaveAs      bool              `json:"saveAs"`
			XMindSheets []json.RawMessage `json:"xmindSheets"`
		}
		if !readJSON(w, r, &q, maxWorkspace+maxWorkspace/3) {
			return
		}
		if len(q.JSON) > maxWorkspace || !json.Valid([]byte(q.JSON)) {
			responseJSON(w, 400, response{Message: "Progetto JSON non valido o troppo grande"})
			return
		}
		dest := ""
		if !q.SaveAs && q.FilePath != "" && s.authorizedPath(q.FilePath) {
			dest = q.FilePath
		}
		if dest == "" {
			name := filepath.Base(q.Filename)
			if name == "" || name == "." || !projectSaveExtension(name) {
				name = "Nuova mappa.gk"
			}
			var err error
			dest, err = desktopFileDialog(true, name)
			if err != nil {
				responseJSON(w, 500, response{Message: err.Error()})
				return
			}
			if dest == "" {
				responseJSON(w, 200, map[string]any{"cancelled": true})
				return
			}
		}
		if !projectSaveExtension(dest) {
			responseJSON(w, 400, response{Message: "Usa .gk o .xmind per il salvataggio"})
			return
		}
		// Keep the first-original backup and its following write in the same
		// transaction; simultaneous XMind saves must not race to create it.
		s.projectSaveMu.Lock()
		defer s.projectSaveMu.Unlock()
		var data []byte
		var err error
		if strings.EqualFold(filepath.Ext(dest), ".xmind") {
			if len(q.XMindSheets) == 0 {
				responseJSON(w, 400, response{Message: "Impossibile salvare XMind: nessuna scheda"})
				return
			}
			data, err = encodeXMind(q.JSON, q.XMindSheets)
			if err == nil {
				err = backupOriginalXMind(dest)
			}
		} else {
			data = []byte(q.JSON)
		}
		if err == nil {
			// Archive the previous bytes before replacing a saved project.
			_, err = stageProjectRevision(s.configDir, dest, data)
		}
		if err == nil {
			err = atomicFile(dest, data)
		}
		if err != nil {
			responseJSON(w, 500, response{Message: "Salvataggio non riuscito: " + err.Error()})
			return
		}
		// Retention runs only after a successful save and cannot turn success into failure.
		if pruneErr := pruneProjectRevisions(s.configDir, dest); pruneErr != nil {
			log.Printf("Time Machine retention warning: %v", pruneErr)
		}
		grantErr := s.approvePath(dest)
		result := map[string]any{"cancelled": false, "path": dest, "name": filepath.Base(dest), "pathRemembered": grantErr == nil}
		if grantErr != nil {
			// Do not report the *project write* as failed: the bytes are already
			// durable. Explicitly warn that the next save may require Save As.
			result["warning"] = "File salvato, ma autorizzazione al percorso non memorizzata. Il prossimo salvataggio potrebbe richiedere Salva con nome."
		}
		responseJSON(w, 200, result)
	})
	mux.HandleFunc("/__desktop/secret/read", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		enc, err := os.ReadFile(filepath.Join(s.configDir, "ai-key.dpapi"))
		if errors.Is(err, os.ErrNotExist) {
			responseJSON(w, 200, map[string]any{"remember": false})
			return
		}
		if err != nil || len(enc) > 8192 {
			responseJSON(w, 500, response{Message: "Impossibile leggere la chiave salvata"})
			return
		}
		plain, err := protectSecret(enc, true)
		if err != nil {
			responseJSON(w, 500, response{Message: "Impossibile sbloccare la chiave con questo account Windows"})
			return
		}
		responseJSON(w, 200, map[string]any{"remember": true, "key": string(plain)})
	})
	mux.HandleFunc("/__desktop/secret/write", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var q struct {
			Key      string `json:"key"`
			Remember bool   `json:"remember"`
		}
		if !readJSON(w, r, &q, 10000) {
			return
		}
		file := filepath.Join(s.configDir, "ai-key.dpapi")
		if !q.Remember || strings.TrimSpace(q.Key) == "" {
			if err := os.Remove(file); err != nil && !errors.Is(err, os.ErrNotExist) {
				responseJSON(w, 500, response{Message: err.Error()})
				return
			}
			responseJSON(w, 200, response{Saved: true})
			return
		}
		if len(q.Key) > 4000 {
			responseJSON(w, 400, response{Message: "Chiave API troppo lunga"})
			return
		}
		protected, err := protectSecret([]byte(strings.TrimSpace(q.Key)), false)
		if err == nil {
			err = atomicFile(file, protected)
		}
		if err != nil {
			responseJSON(w, 500, response{Message: "Impossibile proteggere la chiave: " + err.Error()})
			return
		}
		responseJSON(w, 200, response{Saved: true})
	})
	s.registerLanPairingRoutes(mux)
	return mux
}

func findBrowser() string {
	var list []string
	for _, env := range []string{"PROGRAMFILES(X86)", "PROGRAMFILES", "LOCALAPPDATA"} {
		if v := os.Getenv(env); v != "" {
			list = append(list, filepath.Join(v, "Microsoft", "Edge", "Application", "msedge.exe"))
			list = append(list, filepath.Join(v, "Google", "Chrome", "Application", "chrome.exe"))
		}
	}
	for _, p := range list {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	for _, program := range []string{"msedge.exe", "chrome.exe", "msedge", "google-chrome", "chromium"} {
		if p, err := exec.LookPath(program); err == nil {
			return p
		}
	}
	return ""
}

func run() error {
	dir := dataDir()
	testServer := len(os.Args) > 1 && (os.Args[1] == "--test-server" || os.Args[1] == "--mac-server")
	macNativeServer := runtime.GOOS == "darwin" && len(os.Args) > 1 && os.Args[1] == "--mac-server"
	if !testServer || macNativeServer {
		primary, release, err := acquireAppInstance(dir, developerEdition())
		if err != nil { return err }
		defer release()
		if !primary {
			if macNativeServer {
				// Fail closed: Cocoa/LaunchServices forwards secondary Finder events.
				// Never start a second backend against the same recovery journal.
				return errors.New("Un'altra copia di Glauka è già in esecuzione. Attiva la finestra esistente.")
			}
			// Windows Explorer opened a document while Glauka was already running.
			sent,err := forwardPathsToRunningInstance(dir,forwardedPaths(os.Args))
			if err == nil || sent>0 { focusExistingGlaukaWindow(developerEdition()) }
			return err
		}
	}
	s := &service{secret: randomToken(), ipcToken: randomToken(), cspNonce: randomToken(),
		configDir: dir, active: map[string]*activeAIRequest{}, shutdownCh: make(chan struct{})}
	s.loadPaths()
	noteStoreMigration(s.configDir)
	s.externalQueue = append(s.externalQueue,forwardedPaths(os.Args)...)
	s.lastHeartbeat.Store(time.Now().Unix())
	// Stable loopback origin retains browser preferences and file permissions.
	preferredPort := 43117
	if developerEdition() {
		preferredPort = 43118
	}
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", preferredPort))
	if err != nil {
		if runtime.GOOS == "windows" && !testServer {
			// Do not create an extra desktop window against a pre-upgrade
			// instance that has no single-instance mutex/IPC endpoint yet.
			return fmt.Errorf("Glauka (o un altro programma) utilizza già la porta %d. Chiudi l'eventuale vecchia versione di Glauka e riprova: %w", preferredPort, err)
		}
		ln, err = net.Listen("tcp", "127.0.0.1:0")
	}
	if err != nil {
		return fmt.Errorf("Impossibile avviare il servizio locale: %w", err)
	}
	server := &http.Server{Handler: localOnlyHeaders(s.cspNonce, s.routes()), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 120 * time.Second, IdleTimeout: 65 * time.Second, MaxHeaderBytes: 1 << 18}
	defer func() {
		s.beginShutdown()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
		_ = server.Close()
	}()
	go func() { _ = server.Serve(ln) }()
	if runtime.GOOS == "windows" && !testServer {
		// Record only the limited-capability IPC token, never the UI session secret.
		if err := writeInstanceEndpoint(dir, ln.Addr().(*net.TCPAddr).Port, s.ipcToken); err != nil {
			return err
		}
		defer removeInstanceEndpoint(dir, s.ipcToken)
	}
	// Launch token is not available through unauthenticated GET requests;
	// the browser receives it only in its own startup URL. A 303 replaces
	// that URL with "/" after installing a process-lifetime HttpOnly cookie.
	url := "http://" + ln.Addr().String() + "/?__nm_launch=" + s.secret
	if len(os.Args) > 1 && (os.Args[1] == "--test-server" || os.Args[1] == "--mac-server") {
		fmt.Println(url)
		if os.Args[1] == "--mac-server" {
			// Finder-selected documents arrive exclusively through the native
			// launcher's private stdin pipe and reuse the authenticated UI queue.
			go s.readMacNativeOpens(os.Stdin)
			return s.waitForWindowExit(nil)
		}
		select {}
	}
	if runtime.GOOS == "windows" {
		return runNativeDesktop(url, s.configDir)
	}
	browser := findBrowser()
	if browser == "" {
		return errors.New("Microsoft Edge non trovato. Installa o ripristina Edge/Chrome e riprova.")
	}
	profileName := "browser-profile"
	if developerEdition() {
		profileName = "browser-profile-developer"
	}
	// If the preferred port is already in use, an isolated Chromium profile
	// avoids handing a new window to an unrelated server from another instance.
	if ln.Addr().(*net.TCPAddr).Port != preferredPort {
		profileName = fmt.Sprintf("%s-%d", profileName, ln.Addr().(*net.TCPAddr).Port)
	}
	profile := filepath.Join(s.configDir, profileName)
	if err := os.MkdirAll(profile, 0700); err != nil {
		return err
	}
	waitForBrowser, err := startDesktopBrowser(browser, desktopBrowserArgs(url, profile))
	if err != nil {
		return fmt.Errorf("Impossibile aprire il browser desktop: %w", err)
	}
	finished := make(chan struct{})
	go func() { waitForBrowser(); close(finished) }()
	return s.waitForWindowExit(finished)
}
func main() {
	if runtime.GOOS == "windows" && len(os.Args) > 1 && os.Args[1] == "--uninstall" {
		doUninstall()
		return
	}
	if err := run(); err != nil {
		log.Print(err)
		showError(err.Error())
	}
}

// projectExtension describes input formats supported by the importer. These
// are NOT all native save formats: saving a project into an import-only file
// (such as .txt/.md/.json) would overwrite it with Glauka JSON without warning.
func projectExtension(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".gk", ".glk", ".neuromap", ".xmind", ".json", ".md", ".markdown", ".txt", ".opml", ".xml":
		return true
	}
	return false
}

// projectSaveExtension only accepts native project containers. Other formats
// use the explicit export endpoint, preserving their expected file contents.
func projectSaveExtension(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".gk", ".glk", ".neuromap", ".xmind":
		return true
	}
	return false
}
