//go:build !darwin || !developer
package main
import "errors"
func macBetaEnabled() bool { return false }
func macBetaActivate(key string)(map[string]any,error){return nil,errors.New("Non disponibile")}
