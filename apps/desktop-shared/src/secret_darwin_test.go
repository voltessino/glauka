//go:build darwin

package main

import (
    "bytes"
    "encoding/base64"
    "strings"
    "os"
    "testing"
)

func TestMacKeychainOnlyCreatesOnExplicitNotFound(t *testing.T) {
    missing := []string{
        "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.",
        "security: SecItemCopyMatching: -25300",
        "errSecItemNotFound",
    }
    for _, message := range missing {
        if !missingKeychainItem([]byte(message)) {
            t.Fatalf("not-found result unrecognized: %q", message)
        }
    }
    inaccessible := []string{
        "security: SecKeychainSearchCopyNext: User interaction is not allowed.",
        "security: SecKeychainSearchCopyNext: -25308",
        "security: SecKeychainSearchCopyNext: -25293",
        "security: Authorization denied",
        "",
    }
    for _, message := range inaccessible {
        if missingKeychainItem([]byte(message)) {
            t.Fatalf("access error must not cause key replacement: %q", message)
        }
    }
}

func TestMacKeychainRejectsInvalidStoredSecret(t *testing.T) {
    correct := bytes.Repeat([]byte{0x4a}, 32)
    decoded, err := decodeMacSecretKey([]byte(base64.StdEncoding.EncodeToString(correct) + "\n"))
    if err != nil || !bytes.Equal(correct, decoded) {
        t.Fatalf("valid stored key: %v", err)
    }
    for _, content := range []string{"not-base64", "", "YWJj", base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 31))} {
        if _, err := decodeMacSecretKey([]byte(content)); err == nil {
            t.Fatalf("accepted damaged or short key: %q", content)
        }
    }
}

func TestMacKeychainCodeDoesNotRequestOverwrite(t *testing.T) {
    // The real-system test must use a disposable Keychain and account.
    // Here fail closed when the production source accidentally reintroduces -U.
    sourceBytes, err := os.ReadFile("secret_darwin.go")
    source := string(sourceBytes)
    if err != nil { t.Fatal(err) }
    if strings.Contains(source, "\"-U\"") {
        t.Fatal("security add-generic-password -U would destroy existing encrypted credentials")
    }
}

func TestMacKeychainCreateUsesPrivateStdinNeverProcessArguments(t *testing.T) {
    key := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0x37},32))
    script := keychainCreateScript("com.neuromap.architect.mac.beta.secret", key)
    if !strings.Contains(script, "-w "+key+"\n") {
        t.Fatal("keychain stdin command did not include the generated key")
    }
    source, err := os.ReadFile("secret_darwin.go")
    if err != nil { t.Fatal(err) }
    text := string(source)
    if !strings.Contains(text, `exec.CommandContext(ctx, "security", "-i")`) {
        t.Fatal("keychain password is not delivered through the private stdin pipe")
    }
    if !strings.Contains(text, "command.Stdin = strings.NewReader(") {
        t.Fatal("Keychain command is missing private stdin")
    }
    if !strings.Contains(text, "existing, exists, readErr := readMacSecretKey()") {
        t.Fatal("Keychain creation result must be verified against the stored key")
    }
    if strings.Contains(text, `"-w", encoded`) || strings.Contains(text, `"-U"`) {
        t.Fatal("Keychain can expose or overwrite a stored encryption key")
    }
}

func TestMacKeychainDevelopersHaveDistinctService(t *testing.T) {
    if macKeychainService() != keychainService && 
       macKeychainService() != keychainService+".developer" {
        t.Fatal("Mac Keychain service changed unexpectedly")
    }
}
