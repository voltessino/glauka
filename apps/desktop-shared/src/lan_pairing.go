package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	lanSessionTTL      = 3 * time.Minute
	maxLanTransferSize = 32 << 20
	maxLanHelloFails   = 6
)

type lanChunk struct {
	Index    int             `json:"index"`
	Total    int             `json:"total"`
	IV       string          `json:"iv"`
	Data     string          `json:"data"`
	Manifest json.RawMessage `json:"manifest,omitempty"`
}

type lanSession struct {
	id           string
	mode         string // "send" (PC->Phone) or "receive" (Phone->PC)
	host         string
	port         int
	token        string
	certPin      string
	expiresAt    time.Time
	senderJwk    json.RawMessage
	senderDevice string
	peerJwk      json.RawMessage
	peerDevice   string
	paired       bool
	localApprove bool
	peerApprove  bool
	helloFails   int
	state        string // offering | paired | transferring | accepted | rejected | cancelled | expired
	totalChunks  int
	totalBytes   int
	chunks       map[int]lanChunk
	server       *http.Server
	ln           net.Listener
	mu           sync.Mutex
}

type lanPairingManager struct {
	mu      sync.Mutex
	current *lanSession
}

func randomPairingCode(length int) (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buf := make([]byte, length)
	out := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		out[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(out), nil
}

func isPrivateLANIPv4(ip net.IP) bool {
	ip4 := ip.To4()
	if ip4 == nil || ip4.IsLoopback() || ip4.IsLinkLocalUnicast() || ip4.IsMulticast() {
		return false
	}
	if ip4[0] == 10 {
		return true
	}
	if ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31 {
		return true
	}
	if ip4[0] == 192 && ip4[1] == 168 {
		return true
	}
	return false
}

func detectLANIPv4() string {
	// Query default outbound route locally without sending any packet.
	if conn, err := net.DialTimeout("udp4", "8.8.8.8:80", 200*time.Millisecond); err == nil {
		localAddr, ok := conn.LocalAddr().(*net.UDPAddr)
		_ = conn.Close()
		if ok && localAddr != nil && isPrivateLANIPv4(localAddr.IP) {
			return localAddr.IP.To4().String()
		}
	}
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if (iface.Flags&net.FlagUp) == 0 || (iface.Flags&net.FlagLoopback) != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip != nil && isPrivateLANIPv4(ip) {
					return ip.To4().String()
				}
			}
		}
	}
	return "127.0.0.1"
}

func generateEphemeralTLSCert(hostIP string) (tls.Certificate, string, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, "", err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 62))
	if err != nil {
		return tls.Certificate{}, "", err
	}
	now := time.Now().Add(-time.Minute)
	ips := []net.IP{net.ParseIP("127.0.0.1")}
	if parsed := net.ParseIP(hostIP); parsed != nil && !parsed.IsLoopback() {
		ips = append(ips, parsed)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          serial,
		NotBefore:             now,
		NotAfter:              now.Add(15 * time.Minute),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           ips,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, "", err
	}
	sum := sha256.Sum256(der)
	pin := hex.EncodeToString(sum[:])
	cert := tls.Certificate{
		Certificate: [][]byte{der},
		PrivateKey:  key,
	}
	return cert, pin, nil
}

func (m *lanPairingManager) stopLocked() {
	if m.current == nil {
		return
	}
	sess := m.current
	m.current = nil
	sess.close("cancelled")
}

func (sess *lanSession) close(nextState string) {
	sess.mu.Lock()
	if nextState != "" && sess.state != "accepted" {
		sess.state = nextState
	}
	srv := sess.server
	ln := sess.ln
	if nextState != "accepted" {
		sess.chunks = nil
	}
	sess.mu.Unlock()
	if srv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		_ = srv.Shutdown(ctx)
		cancel()
	} else if ln != nil {
		_ = ln.Close()
	}
}

func (sess *lanSession) checkExpiredLocked() bool {
	if time.Now().After(sess.expiresAt) {
		sess.state = "expired"
		return true
	}
	return false
}

func (sess *lanSession) validToken(provided string) bool {
	p := strings.ToUpper(strings.TrimSpace(provided))
	t := strings.ToUpper(sess.token)
	return len(p) > 0 && len(p) == len(t) && subtle.ConstantTimeCompare([]byte(p), []byte(t)) == 1
}

func (sess *lanSession) lanHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/f11/v1/hello", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			responseJSON(w, 405, response{Message: "Method not allowed"})
			return
		}
		var req struct {
			Token      string          `json:"token"`
			PublicJwk  json.RawMessage `json:"publicJwk"`
			DeviceName string          `json:"deviceName"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 32*1024)).Decode(&req); err != nil {
			responseJSON(w, 400, response{Message: "Richiesta pairing non valida"})
			return
		}
		sess.mu.Lock()
		defer sess.mu.Unlock()
		if sess.checkExpiredLocked() {
			responseJSON(w, 410, response{Message: "Sessione scaduta"})
			return
		}
		if sess.helloFails >= maxLanHelloFails {
			sess.state = "cancelled"
			responseJSON(w, 429, response{Message: "Troppi tentativi errati"})
			return
		}
		if !sess.validToken(req.Token) {
			sess.helloFails++
			responseJSON(w, 403, response{Message: "Codice collegamento errato"})
			return
		}
		if sess.paired || sess.state != "offering" {
			responseJSON(w, 409, response{Message: "Sessione già collegata"})
			return
		}
		if len(req.PublicJwk) < 10 || len(req.PublicJwk) > 2048 {
			responseJSON(w, 400, response{Message: "Chiave pubblica non valida"})
			return
		}
		name := strings.TrimSpace(req.DeviceName)
		if len(name) > 40 {
			name = name[:40]
		}
		sess.peerJwk = req.PublicJwk
		sess.peerDevice = name
		sess.paired = true
		sess.state = "paired"
		responseJSON(w, 200, map[string]any{
			"ok":           true,
			"mode":         sess.mode,
			"senderJwk":    sess.senderJwk,
			"senderDevice": sess.senderDevice,
			"certPin":      sess.certPin,
		})
	})
	mux.HandleFunc("/f11/v1/decision", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			responseJSON(w, 405, response{Message: "Method not allowed"})
			return
		}
		var req struct {
			Token    string `json:"token"`
			Decision string `json:"decision"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 8*1024)).Decode(&req); err != nil {
			responseJSON(w, 400, response{Message: "Richiesta non valida"})
			return
		}
		sess.mu.Lock()
		if sess.checkExpiredLocked() {
			sess.mu.Unlock()
			responseJSON(w, 410, response{Message: "Sessione scaduta"})
			return
		}
		if !sess.validToken(req.Token) {
			sess.mu.Unlock()
			responseJSON(w, 403, response{Message: "Token rifiutato"})
			return
		}
		switch req.Decision {
		case "approve":
			if !sess.paired {
				sess.mu.Unlock()
				responseJSON(w, 409, response{Message: "Dispositivo non ancora collegato"})
				return
			}
			sess.peerApprove = true
		case "accept", "reject", "cancel":
			sess.state = map[string]string{"accept": "accepted", "reject": "rejected", "cancel": "cancelled"}[req.Decision]
		default:
			sess.mu.Unlock()
			responseJSON(w, 400, response{Message: "Decisione sconosciuta"})
			return
		}
		reply := map[string]any{
			"state":        sess.state,
			"localApprove": sess.localApprove,
			"peerApprove":  sess.peerApprove,
			"totalChunks":  sess.totalChunks,
		}
		shouldClose := req.Decision == "reject" || req.Decision == "cancel" || req.Decision == "accept"
		sess.mu.Unlock()
		responseJSON(w, 200, reply)
		if shouldClose {
			go func() {
				time.Sleep(300 * time.Millisecond)
				sess.close("")
			}()
		}
	})
	mux.HandleFunc("/f11/v1/chunk", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			responseJSON(w, 405, response{Message: "Method not allowed"})
			return
		}
		var req struct {
			Token    string          `json:"token"`
			Index    int             `json:"index"`
			Total    int             `json:"total,omitempty"`
			IV       string          `json:"iv,omitempty"`
			Data     string          `json:"data,omitempty"`
			Manifest json.RawMessage `json:"manifest,omitempty"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 256*1024)).Decode(&req); err != nil {
			responseJSON(w, 400, response{Message: "Blocco non valido"})
			return
		}
		sess.mu.Lock()
		defer sess.mu.Unlock()
		if sess.checkExpiredLocked() {
			responseJSON(w, 410, response{Message: "Sessione scaduta"})
			return
		}
		if !sess.validToken(req.Token) {
			responseJSON(w, 403, response{Message: "Token rifiutato"})
			return
		}
		if !sess.peerApprove || !sess.localApprove {
			responseJSON(w, 403, response{Message: "Conferma del codice su entrambi i dispositivi richiesta"})
			return
		}
		if sess.mode == "send" {
			ch, ok := sess.chunks[req.Index]
			if !ok {
				if sess.totalChunks == 0 {
					responseJSON(w, 202, map[string]any{"pending": true})
					return
				}
				responseJSON(w, 404, response{Message: "Blocco non trovato"})
				return
			}
			sess.state = "transferring"
			responseJSON(w, 200, ch)
			return
		}
		// mode == "receive" (Phone pushes encrypted chunks to Desktop)
		if req.Total < 1 || req.Total > 2048 || req.Index < 0 || req.Index >= req.Total {
			responseJSON(w, 400, response{Message: "Indice blocco non valido"})
			return
		}
		addBytes := len(req.IV) + len(req.Data) + len(req.Manifest)
		if sess.totalBytes+addBytes > maxLanTransferSize {
			responseJSON(w, 413, response{Message: "Mappa troppo grande per il trasferimento diretto"})
			return
		}
		if sess.chunks == nil {
			sess.chunks = make(map[int]lanChunk)
		}
		if _, dup := sess.chunks[req.Index]; !dup {
			sess.totalBytes += addBytes
		}
		sess.chunks[req.Index] = lanChunk{
			Index:    req.Index,
			Total:    req.Total,
			IV:       req.IV,
			Data:     req.Data,
			Manifest: req.Manifest,
		}
		sess.totalChunks = req.Total
		sess.state = "transferring"
		if len(sess.chunks) == sess.totalChunks {
			sess.state = "accepted"
		}
		responseJSON(w, 200, map[string]any{"received": len(sess.chunks), "total": sess.totalChunks})
	})
	return mux
}

func (m *lanPairingManager) start(mode string, senderJwk json.RawMessage, deviceName string) (map[string]any, error) {
	if mode != "send" && mode != "receive" {
		return nil, errors.New("Modalità collegamento non valida")
	}
	if len(senderJwk) < 10 || len(senderJwk) > 2048 {
		return nil, errors.New("Chiave sessione mancante")
	}
	ip := detectLANIPv4()
	cert, pin, err := generateEphemeralTLSCert(ip)
	if err != nil {
		return nil, err
	}
	code, err := randomPairingCode(6)
	if err != nil {
		return nil, err
	}
	ln, err := tls.Listen("tcp", ":0", &tls.Config{
		MinVersion:   tls.VersionTLS12,
		Certificates: []tls.Certificate{cert},
	})
	if err != nil {
		return nil, fmt.Errorf("Impossibile aprire la porta Wi-Fi locale: %w", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	name := strings.TrimSpace(deviceName)
	if len(name) > 40 {
		name = name[:40]
	}
	sess := &lanSession{
		id:           randomToken(),
		mode:         mode,
		host:         ip,
		port:         port,
		token:        code,
		certPin:      pin,
		expiresAt:    time.Now().Add(lanSessionTTL),
		senderJwk:    senderJwk,
		senderDevice: name,
		state:        "offering",
		chunks:       make(map[int]lanChunk),
		ln:           ln,
	}
	sess.server = &http.Server{
		Handler:           sess.lanHandler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	m.mu.Lock()
	m.stopLocked()
	m.current = sess
	m.mu.Unlock()

	go func() {
		_ = sess.server.Serve(ln)
	}()
	go func() {
		time.Sleep(lanSessionTTL + 2*time.Second)
		sess.close("expired")
	}()
	return map[string]any{
		"active":     true,
		"sessionId":  sess.id,
		"mode":       sess.mode,
		"host":       sess.host,
		"port":       sess.port,
		"token":      sess.token,
		"certPin":    sess.certPin,
		"expiresAt":  sess.expiresAt.UTC().Format(time.RFC3339),
	}, nil
}

func (m *lanPairingManager) poll(sessionID string) (map[string]any, error) {
	m.mu.Lock()
	sess := m.current
	m.mu.Unlock()
	if sess == nil || (sessionID != "" && sess.id != sessionID) {
		return map[string]any{"active": false, "state": "expired"}, nil
	}
	sess.mu.Lock()
	defer sess.mu.Unlock()
	sess.checkExpiredLocked()
	return map[string]any{
		"active":         sess.state != "expired" && sess.state != "cancelled" && sess.state != "rejected",
		"sessionId":      sess.id,
		"mode":           sess.mode,
		"state":          sess.state,
		"paired":         sess.paired,
		"peerJwk":        sess.peerJwk,
		"peerDevice":     sess.peerDevice,
		"localApprove":   sess.localApprove,
		"peerApprove":    sess.peerApprove,
		"totalChunks":    sess.totalChunks,
		"receivedChunks": len(sess.chunks),
	}, nil
}

func (m *lanPairingManager) approveAndPush(sessionID string, chunks []lanChunk, decision string) (map[string]any, error) {
	m.mu.Lock()
	sess := m.current
	m.mu.Unlock()
	if sess == nil || (sessionID != "" && sess.id != sessionID) {
		return nil, errors.New("Sessione non attiva")
	}
	sess.mu.Lock()
	defer sess.mu.Unlock()
	if sess.checkExpiredLocked() {
		return nil, errors.New("Sessione scaduta")
	}
	if decision == "cancel" || decision == "reject" {
		sess.state = map[string]string{"reject": "rejected", "cancel": "cancelled"}[decision]
		go func() { sess.close("") }()
		return map[string]any{"ok": true, "state": sess.state}, nil
	}
	if !sess.paired {
		return nil, errors.New("Nessun telefono collegato")
	}
	sess.localApprove = true
	if len(chunks) > 0 {
		if sess.chunks == nil {
			sess.chunks = make(map[int]lanChunk)
		}
		for _, ch := range chunks {
			addBytes := len(ch.IV) + len(ch.Data) + len(ch.Manifest)
			if sess.totalBytes+addBytes > maxLanTransferSize {
				return nil, errors.New("Mappa troppo grande per il trasferimento")
			}
			sess.totalBytes += addBytes
			sess.chunks[ch.Index] = ch
			sess.totalChunks = ch.Total
		}
	}
	return map[string]any{
		"ok":           true,
		"state":        sess.state,
		"localApprove": sess.localApprove,
		"peerApprove":  sess.peerApprove,
	}, nil
}

func (m *lanPairingManager) pullChunks(sessionID string) (map[string]any, error) {
	m.mu.Lock()
	sess := m.current
	m.mu.Unlock()
	if sess == nil || (sessionID != "" && sess.id != sessionID) {
		return nil, errors.New("Sessione non attiva")
	}
	sess.mu.Lock()
	defer sess.mu.Unlock()
	if sess.totalChunks == 0 || len(sess.chunks) < sess.totalChunks {
		return nil, errors.New("Trasferimento non ancora completato")
	}
	out := make([]lanChunk, 0, sess.totalChunks)
	for i := 0; i < sess.totalChunks; i++ {
		ch, ok := sess.chunks[i]
		if !ok {
			return nil, errors.New("Blocco mancante")
		}
		out = append(out, ch)
	}
	sess.chunks = nil
	sess.state = "accepted"
	go func() {
		time.Sleep(250 * time.Millisecond)
		sess.close("")
	}()
	return map[string]any{"ok": true, "chunks": out}, nil
}

func (s *service) registerLanPairingRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/__desktop/lan/start", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var req struct {
			Mode       string          `json:"mode"`
			SenderJwk  json.RawMessage `json:"senderJwk"`
			DeviceName string          `json:"deviceName"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 16*1024)).Decode(&req); err != nil {
			responseJSON(w, 400, response{Message: "Richiesta non valida"})
			return
		}
		res, err := s.lanPair.start(req.Mode, req.SenderJwk, req.DeviceName)
		if err != nil {
			responseJSON(w, 400, response{Message: err.Error()})
			return
		}
		responseJSON(w, 200, res)
	})
	mux.HandleFunc("/__desktop/lan/poll", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req)
		res, err := s.lanPair.poll(req.SessionID)
		if err != nil {
			responseJSON(w, 400, response{Message: err.Error()})
			return
		}
		responseJSON(w, 200, res)
	})
	mux.HandleFunc("/__desktop/lan/push", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var req struct {
			SessionID string     `json:"sessionId"`
			Decision  string     `json:"decision"`
			Chunks    []lanChunk `json:"chunks"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, maxLanTransferSize+65536)).Decode(&req); err != nil {
			responseJSON(w, 400, response{Message: "Dati trasferimento non validi"})
			return
		}
		res, err := s.lanPair.approveAndPush(req.SessionID, req.Chunks, req.Decision)
		if err != nil {
			responseJSON(w, 400, response{Message: err.Error()})
			return
		}
		responseJSON(w, 200, res)
	})
	mux.HandleFunc("/__desktop/lan/pull", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req)
		res, err := s.lanPair.pullChunks(req.SessionID)
		if err != nil {
			responseJSON(w, 400, response{Message: err.Error()})
			return
		}
		responseJSON(w, 200, res)
	})
	mux.HandleFunc("/__desktop/lan/stop", func(w http.ResponseWriter, r *http.Request) {
		if !s.secure(w, r) {
			return
		}
		s.lanPair.mu.Lock()
		s.lanPair.stopLocked()
		s.lanPair.mu.Unlock()
		responseJSON(w, 200, response{OK: true})
	})
}
