//go:build !windows

package main

import "errors"

func runNativeDesktop(address, configDir string) error {
	return errors.New("Glauka uses its platform native launcher")
}
