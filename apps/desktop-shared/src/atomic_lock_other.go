//go:build !windows

package main

// POSIX rename replaces the destination atomically; unique staging files keep
// independent writers separate. Windows additionally needs a replacement lock.
func lockAtomicReplacement(path string) (func(), error) { return func() {}, nil }
