package main

import (
	"bytes"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func testLanTLSClient(expectedPin string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // Verified explicitly via VerifyPeerCertificate pin below.
				VerifyPeerCertificate: func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
					if len(rawCerts) == 0 {
						return errors.New("missing cert")
					}
					sum := sha256.Sum256(rawCerts[0])
					if hex.EncodeToString(sum[:]) != expectedPin {
						return errors.New("cert pin mismatch")
					}
					return nil
				},
			},
		},
	}
}

func TestLanPairingSendAndReceiveLifecycle(t *testing.T) {
	mgr := &lanPairingManager{}
	senderJwk := json.RawMessage(`{"kty":"EC","crv":"P-256","x":"abc","y":"def"}`)
	startRes, err := mgr.start("send", senderJwk, "PC Test")
	if err != nil {
		t.Fatalf("start failed: %v", err)
	}
	defer func() {
		mgr.mu.Lock()
		mgr.stopLocked()
		mgr.mu.Unlock()
	}()
	port := startRes["port"].(int)
	token := startRes["token"].(string)
	pin := startRes["certPin"].(string)
	sessionID := startRes["sessionId"].(string)
	host := startRes["host"].(string)

	client := testLanTLSClient(pin)
	base := fmt.Sprintf("https://%s:%d", host, port)

	// Wrong token rejected cleanly
	badResp, err := client.Post(base+"/f11/v1/hello", "application/json", bytes.NewBufferString(`{"token":"WRONG1","publicJwk":{"kty":"EC","crv":"P-256","x":"1","y":"2"}}`))
	if err != nil {
		t.Fatalf("bad hello request failed: %v", err)
	}
	_ = badResp.Body.Close()
	if badResp.StatusCode != 403 {
		t.Fatalf("expected 403 for bad token, got %d", badResp.StatusCode)
	}

	// Valid peer hello succeeds
	goodBody := fmt.Sprintf(`{"token":%q,"publicJwk":{"kty":"EC","crv":"P-256","x":"px","y":"py"},"deviceName":"Phone"}`, token)
	helloResp, err := client.Post(base+"/f11/v1/hello", "application/json", bytes.NewBufferString(goodBody))
	if err != nil {
		t.Fatalf("valid hello failed: %v", err)
	}
	_ = helloResp.Body.Close()
	if helloResp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", helloResp.StatusCode)
	}

	// Both approve & sender pushes encrypted chunk
	_, err = mgr.approveAndPush(sessionID, []lanChunk{{Index: 0, Total: 1, IV: "iv0", Data: "cipher0"}}, "approve")
	if err != nil {
		t.Fatalf("approveAndPush failed: %v", err)
	}
	decBody := fmt.Sprintf(`{"token":%q,"decision":"approve"}`, token)
	decResp, err := client.Post(base+"/f11/v1/decision", "application/json", bytes.NewBufferString(decBody))
	if err != nil {
		t.Fatalf("decision approve failed: %v", err)
	}
	_ = decResp.Body.Close()
	if decResp.StatusCode != 200 {
		t.Fatalf("expected 200 on decision, got %d", decResp.StatusCode)
	}

	chReq := fmt.Sprintf(`{"token":%q,"index":0}`, token)
	chResp, err := client.Post(base+"/f11/v1/chunk", "application/json", bytes.NewBufferString(chReq))
	if err != nil {
		t.Fatalf("chunk fetch failed: %v", err)
	}
	var got lanChunk
	if err := json.NewDecoder(chResp.Body).Decode(&got); err != nil {
		t.Fatalf("decode chunk failed: %v", err)
	}
	_ = chResp.Body.Close()
	if got.Data != "cipher0" {
		t.Fatalf("unexpected chunk data %q", got.Data)
	}
}
