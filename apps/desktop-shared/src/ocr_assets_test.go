package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOCRAssetsRejectArbitraryFiles(t *testing.T) {
	s := &service{secret: "ocr-test"}
	for _, path := range []string{"/ocr/manifest.json", "/ocr/private-key", "/ocr/README.txt", "/ocr/unknown.js", "/ocr/ita.traineddata/other"} {
		req := httptest.NewRequest("GET", "http://127.0.0.1:43117"+path, nil)
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, req)
		if w.Code == 200 {
			t.Fatalf("arbitrary resource exposed: %s", path)
		}
	}
}
func TestStagedOCRAssetsCarryRestrictedWorkerPolicy(t *testing.T) {
	if _, err := content.ReadFile("resources/ocr/host-worker.js"); err != nil {
		t.Skip("source placeholder: this assertion runs on the fully staged build")
	}
	s := &service{secret: "ocr-test"}
	for _, name := range []string{"host-worker.js", "tesseract.min.js", "worker.min.js", "tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "ita.traineddata"} {
		req := httptest.NewRequest("GET", "http://127.0.0.1:43117/ocr/"+name, nil)
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, req)
		if w.Code != 200 || w.Body.Len() < 100 {
			t.Fatalf("missing staged OCR asset: %s status %d", name, w.Code)
		}
		if strings.Contains(w.Header().Get("Content-Security-Policy"), "'unsafe-eval'") {
			t.Fatal("JavaScript eval was enabled")
		}
		if w.Header().Get("Cross-Origin-Resource-Policy") != "same-origin" {
			t.Fatal("cross-origin OCR resource")
		}
	}
}
