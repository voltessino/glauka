package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQALocalPrivilegedEndpointOriginAndSessionToken(t *testing.T) {
	svc := &service{secret: "session-token"}
	tests := []struct {
		name, token, origin, fetchSite, method string
		want                                   int
	}{
		{"same_origin", "session-token", "http://127.0.0.1:43117", "same-origin", http.MethodPost, 200},
		{"native_same_origin_no_fetch", "session-token", "", "", http.MethodPost, 200},
		{"fresh_top_level", "session-token", "", "none", http.MethodPost, 200},
		{"missing_token", "", "", "", http.MethodPost, 403},
		{"tampered_token", "session-tokeN", "", "", http.MethodPost, 403},
		{"cross_site", "session-token", "", "cross-site", http.MethodPost, 403},
		{"same_site_wrong_origin", "session-token", "", "same-site", http.MethodPost, 403},
		{"origin_wrong_port", "session-token", "http://127.0.0.1:44444", "same-origin", http.MethodPost, 403},
		{"origin_null", "session-token", "null", "", http.MethodPost, 403},
		{"wrong_method", "session-token", "", "", http.MethodGet, 405},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, "http://127.0.0.1:43117/__desktop/test", nil)
			r.Header.Set("X-NeuroMap-Session", tc.token)
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			if tc.fetchSite != "" {
				r.Header.Set("Sec-Fetch-Site", tc.fetchSite)
			}
			w := httptest.NewRecorder()
			allowed := svc.secure(w, r)
			if allowed != (tc.want == 200) {
				t.Fatalf("allowed=%v, want status %d", allowed, tc.want)
			}
			if !allowed && w.Code != tc.want {
				t.Fatalf("got HTTP %d, want %d", w.Code, tc.want)
			}
		})
	}
}

func TestQALoopbackAndCrossSiteDocumentRestrictions(t *testing.T) {
	secureHandler := localOnlyHeaders("nonce", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	cases := []struct {
		host, site string
		status     int
	}{
		{"127.0.0.1:43117", "none", 204},
		{"127.0.0.1:43117", "same-origin", 204},
		{"127.0.0.1:43117", "cross-site", 403},
		{"localhost:43117", "none", 403},
		{"remote.example:43117", "none", 403},
	}
	for _, tc := range cases {
		r := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43117/index.html", nil)
		r.Host = tc.host
		r.Header.Set("Sec-Fetch-Site", tc.site)
		w := httptest.NewRecorder()
		secureHandler.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Errorf("%s (%s): got %d, want %d", tc.host, tc.site, w.Code, tc.status)
		}
	}
}

func TestQASingleJSONOnly(t *testing.T) {
	tests := []struct {
		payload string
		ok      bool
	}{
		{`{"test":true}`, true},
		{"{\"test\":true}  \n ", true},
		{`{"test":true} {"second":true}`, false},
		{`{"test":true} garbage`, false},
		{`{"test":true`, false},
	}
	for _, tc := range tests {
		r := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:43117/api", strings.NewReader(tc.payload))
		w := httptest.NewRecorder()
		var parsed map[string]any
		if success := readJSON(w, r, &parsed, 4096); success != tc.ok {
			t.Errorf("payload %q: got %v, expected %v", tc.payload, success, tc.ok)
		}
	}
}
func TestQAAPISecretNeverUsedAsCSPNonce(t *testing.T) {
	svc := &service{secret: "secret-token", cspNonce: "different-csp-nonce"}
	mux := svc.routes()
	// A malicious or unrelated local process cannot fetch the application
	// page to scrape the native API token without knowing the launch secret.
	unauth := httptest.NewRecorder()
	mux.ServeHTTP(unauth, httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43117/", nil))
	if unauth.Code != http.StatusForbidden {
		t.Fatalf("unauthenticated GET: %d", unauth.Code)
	}
	if strings.Contains(unauth.Body.String(), "secret-token") {
		t.Fatal("API session token leaked")
	}

	wrong := httptest.NewRecorder()
	mux.ServeHTTP(wrong, httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43117/?__nm_launch=invalid", nil))
	if wrong.Code != http.StatusForbidden {
		t.Fatalf("invalid bootstrap returned %d", wrong.Code)
	}

	bootstrap := httptest.NewRecorder()
	mux.ServeHTTP(bootstrap, httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43117/?__nm_launch=secret-token", nil))
	if bootstrap.Code != http.StatusSeeOther {
		t.Fatalf("launch returned %d", bootstrap.Code)
	}
	if bootstrap.Header().Get("Location") != "/" {
		t.Fatal("launch token not removed from URL")
	}
	cookies := bootstrap.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != "nm_local_ui" || !cookies[0].HttpOnly ||
		cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("bootstrap cookie not restricted as required")
	}
	r := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43117/", nil)
	r.AddCookie(cookies[0])
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	html := w.Body.String()
	if w.Code != 200 {
		t.Fatalf("authorized GET / returned %d", w.Code)
	}
	if !strings.Contains(html, `nonce="different-csp-nonce"`) {
		t.Fatal("missing isolated CSP nonce in page scripts")
	}
	if !strings.Contains(html, `<script id="glauka-theme-boot" nonce="different-csp-nonce">`) ||
		!strings.Contains(html, `<script id="glauka-startup-guard" nonce="different-csp-nonce">`) ||
		strings.Count(html, `<script nonce="different-csp-nonce">`) < 2 {
		t.Fatal("startup guard, app and native bridge must all keep their CSP nonce")
	}
	if strings.Contains(html, `nonce="secret-token"`) {
		t.Fatal("API bearer token used as script nonce")
	}

	// A stale session cookie from a previous launch is not sufficient.
	stale := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43117/", nil)
	stale.AddCookie(&http.Cookie{Name: "nm_local_ui", Value: "previous-session"})
	denied := httptest.NewRecorder()
	mux.ServeHTTP(denied, stale)
	if denied.Code != http.StatusForbidden {
		t.Fatalf("stale session accepted: %d", denied.Code)
	}
}
