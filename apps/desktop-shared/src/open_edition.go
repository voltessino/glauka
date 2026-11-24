package main

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strings"
	"time"
)

type activeAIRequest struct{}
type aiAudio struct{}

func developerEdition() bool { return false }

func (s *service) productStatus() map[string]any {
	return map[string]any{"plan": "open", "edition": "open-source"}
}

func verifyTarget(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil {
		return nil, errors.New("Endpoint non valido")
	}
	name := strings.Trim(strings.ToLower(u.Hostname()), "[]")
	if u.Scheme != "https" && !(u.Scheme == "http" && (name == "localhost" || name == "127.0.0.1" || name == "::1")) {
		return nil, errors.New("HTTPS richiesto")
	}
	return u, nil
}

func validatedAIDial(ctx context.Context, network, address string, _ bool) (net.Conn, error) {
	return (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, network, address)
}
