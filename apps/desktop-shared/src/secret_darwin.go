//go:build darwin

package main

import (
    "context"
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "errors"
    "time"
    "os/exec"
    "strings"
)

const keychainService = "com.neuromap.architect.mac.beta.secret"

func macKeychainService() string {
    // Preserve the historical Release key. Private Developer testing must not
    // share or overwrite the public application's encryption identity.
    if developerEdition() { return keychainService + ".developer" }
    return keychainService
}

// security -i reads commands from a private pipe. A freshly generated AES key
// must never appear as a process argument (ps/Activity Monitor can show argv).
// Account/service are fixed literals; encoded is strict Base64 (no spaces).
func keychainCreateScript(service, encoded string) string {
    return "add-generic-password -a NeuroMap -s " + service + " -w " + encoded + "\n"
}

// security(1) returns a nonzero status for both missing items and access
// failures. Only an explicit errSecItemNotFound allows creation of a key;
// an inaccessible existing key must NEVER be silently replaced.
func missingKeychainItem(output []byte) bool {
    message := strings.ToLower(string(output))
    return strings.Contains(message, "-25300") ||
        strings.Contains(message, "errsecitemnotfound") ||
        strings.Contains(message, "the specified item could not be found in the keychain")
}

func decodeMacSecretKey(out []byte) ([]byte, error) {
    key, decodeErr := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out)))
    if decodeErr != nil || len(key) != 32 {
        return nil, errors.New("La chiave Glauka nel Portachiavi non è valida; rifiutata la sostituzione")
    }
    return key, nil
}

func readMacSecretKey() ([]byte, bool, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
    defer cancel()
    out, err := exec.CommandContext(ctx, "security", "find-generic-password",
        "-a", "NeuroMap", "-s", macKeychainService(), "-w").CombinedOutput()
    if err != nil {
        if missingKeychainItem(out) { return nil, false, nil }
        return nil, false, errors.New("Portachiavi macOS non disponibile o accesso negato; credenziali conservate")
    }
    key, decodeErr := decodeMacSecretKey(out)
    if decodeErr != nil { return nil, true, decodeErr }
    return key, true, nil
}

func macSecretKey() ([]byte, error) {
    key, found, err := readMacSecretKey()
    if err != nil || found { return key, err }

    key = make([]byte, 32)
    if _, err = rand.Read(key); err != nil { return nil, err }
    // Do NOT use -U: an item created in a concurrent process (or becoming
    // accessible again) must never be overwritten with a different key.
    encoded := base64.StdEncoding.EncodeToString(key)
    ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
    defer cancel()
    command := exec.CommandContext(ctx, "security", "-i")
    command.Stdin = strings.NewReader(keychainCreateScript(macKeychainService(), encoded))
    // Interactive security(1) may return zero even when a command inside
    // fails. Never consider creation successful without reading it back.
    _, _ = command.CombinedOutput()

    // A concurrent first launch may have created the item in the meantime.
    // Use that key only, never blindly trust the locally generated candidate.
    existing, exists, readErr := readMacSecretKey()
    if readErr == nil && exists { return existing, nil }
    return nil, errors.New("Impossibile creare la chiave nel Portachiavi senza sovrascrivere credenziali esistenti")
}

func protectSecret(data []byte, decrypt bool) ([]byte, error) {
    if len(data) == 0 { return []byte{}, nil }
    key, err := macSecretKey()
    if err != nil { return nil, err }
    block, err := aes.NewCipher(key)
    if err != nil { return nil, err }
    gcm, err := cipher.NewGCM(block)
    if err != nil { return nil, err }
    if decrypt {
        if len(data) < gcm.NonceSize() { return nil, errors.New("Chiave cifrata non valida") }
        return gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
    }
    nonce := make([]byte, gcm.NonceSize())
    if _, err := rand.Read(nonce); err != nil { return nil, err }
    return gcm.Seal(nonce, nonce, data, nil), nil
}
