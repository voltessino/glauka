//go:build !windows && !darwin

package main

import "errors"

func desktopFileDialog(save bool, suggested string) (string, error) {
	return "", errors.New("Il selettore nativo è disponibile su Windows")
}

func desktopMultiOpenDialog() ([]string, error) {
	return nil, errors.New("Il selettore multi-file è disponibile su Windows")
}
