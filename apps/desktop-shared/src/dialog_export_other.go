//go:build !windows

package main

func desktopExportDialog(suggested string) (string, error) { return desktopFileDialog(true, suggested) }
