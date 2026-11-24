package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	_ "image/png"
	"net/http"
)

func decodeClipboardPNG(encoded string) ([]byte, image.Image, error) {
	if len(encoded) > 44*1024*1024 {
		return nil, nil, errors.New("Immagine troppo grande per gli appunti")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || !bytes.HasPrefix(data, []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
		return nil, nil, errors.New("PNG non valido")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || format != "png" || config.Width < 1 || config.Height < 1 || config.Width > 8192 || config.Height > 8192 || int64(config.Width)*int64(config.Height) > 40000000 {
		return nil, nil, errors.New("Dimensioni PNG non valide")
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	return data, img, err
}
func (s *service) clipboardPNGRoute(w http.ResponseWriter, r *http.Request) {
	if !s.secure(w, r) {
		return
	}
	var q struct {
		Data string `json:"data"`
	}
	if !readJSON(w, r, &q, 45*1024*1024) {
		return
	}
	data, img, err := decodeClipboardPNG(q.Data)
	if err == nil {
		err = writeClipboardPNG(data, img)
	}
	if err != nil {
		responseJSON(w, 400, response{Message: err.Error()})
		return
	}
	responseJSON(w, 200, response{OK: true})
}
