//go:build !windows

package main

import (
	"io"
	"os/exec"
)

func startDesktopBrowser(browser string, args []string) (func(), error) {
	cmd := exec.Command(browser, args...)
	cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return func() { _ = cmd.Wait() }, nil
}
