package main

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClipboardPNGRejectsInvalidPayloadAndPreservesAlpha(t *testing.T) {
	for _, bad := range []string{"", "not-base64", base64.StdEncoding.EncodeToString([]byte("not a png"))} {
		if _, _, err := decodeClipboardPNG(bad); err == nil {
			t.Fatal("accepted invalid PNG")
		}
	}
	img := image.NewNRGBA(image.Rect(0, 0, 3, 2))
	img.SetNRGBA(1, 1, color.NRGBA{R: 23, G: 42, B: 240, A: 100})
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	data, decoded, err := decodeClipboardPNG(base64.StdEncoding.EncodeToString(out.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, out.Bytes()) || decoded.Bounds() != img.Bounds() {
		t.Fatal("changed PNG")
	}
	if got := color.NRGBAModel.Convert(decoded.At(1, 1)).(color.NRGBA); got != img.NRGBAAt(1, 1) {
		t.Fatalf("lost alpha: %v", got)
	}
}
func TestClipboardPNGRequiresAuthenticatedLocalRequest(t *testing.T) {
	s := qaService(t)
	for _, origin := range []string{"https://evil.example", "http://127.0.0.1"} {
		r := httptest.NewRequest("POST", "http://127.0.0.1/__desktop/clipboard/png", strings.NewReader(`{"data":"invalid"}`))
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		s.clipboardPNGRoute(w, r)
		if w.Code == 200 {
			t.Fatal("unauthenticated clipboard write")
		}
	}
}
