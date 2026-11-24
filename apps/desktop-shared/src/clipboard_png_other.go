//go:build !windows

package main

import (
	"errors"
	"image"
)

func writeClipboardPNG(data []byte, img image.Image) error {
	return errors.New("Usa gli appunti nativi del sistema")
}
