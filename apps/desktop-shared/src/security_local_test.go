package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDesktopRejectsDNSRebindingHost(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	secured := localOnlyHeaders("test-nonce", mux)
	for _, tt := range []struct {
		host string
		code int
	}{
		{"attacker.example:43117", 403}, {"localhost:43117", 403}, {"127.0.0.1:43117", 200},
	} {
		req := httptest.NewRequest("GET", "http://127.0.0.1:43117/", nil)
		req.Host = tt.host
		resp := httptest.NewRecorder()
		secured.ServeHTTP(resp, req)
		if resp.Code != tt.code {
			t.Fatalf("host %s expected %d got %d", tt.host, tt.code, resp.Code)
		}
		if resp.Code == 200 {
			csp := resp.Header().Get("Content-Security-Policy")
			if !strings.Contains(csp, "script-src 'nonce-test-nonce'") || strings.Contains(csp, "'unsafe-eval'") || strings.Contains(csp, "script-src 'unsafe-inline'") {
				t.Errorf("unsafe CSP: %s", csp)
			}
		}
	}
}
