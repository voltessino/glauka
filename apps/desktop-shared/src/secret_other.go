//go:build !windows && !darwin

package main

import "errors"

func protectSecret(data []byte, decrypt bool) ([]byte, error) {
	return nil, errors.New("Protezione della chiave disponibile solo su Windows")
}
