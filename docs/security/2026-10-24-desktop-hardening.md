# NeuroMap Architect — Desktop security hardening / threat model
Date: 2026-10-24. Scope: Go desktop backend, Windows/macOS desktop distribution and WKWebView host.

## Security promises: what is and isn't possible

No application running on a customer's device can keep all its bundled executable and JavaScript source entirely secret from a user with physical or administrative access. NeuroMap includes its HTML/JS editor in client builds and currently serves it to an on-device rendering engine. A motivated attacker can inspect or reverse engineer parts of it. Obfuscation and stripping symbols raise casual effort but are not an authorization boundary. **Never embed license-signing private keys, service-provider master secrets, or commercially critical secrets in this client.** Keep production signing keys and valuable paid server functionality on infrastructure controlled by the publisher.

What can be meaningfully defended: stealing other users' files through the loopback HTTP service, cross-origin web attacks, unauthorized Pro activation in public distributions, unsafe upstream requests, malicious updates, tampered installers, and excessive privileges in the native host.

## Implemented in main

1. **Mac trust boundary** — Native WKWebView main-page navigation now checks exact `http://127.0.0.1:<allocated-port>` scheme/host/port against the backend URL delivered by the launcher. Privileged clipboard and open-URL message handlers and microphone permission use this origin. Main-frame `file:`, `data:`, `javascript:`, alternate loopback ports and script-driven external redirects are blocked. Only user-clicked public HTTPS/HTTP links may open externally.
2. **Go local HTTP** — A 256-bit random API bearer is checked in constant time; the separate per-launch CSP nonce is not reused as the API secret. Local API endpoints retain strict POST, local Host, Origin, `Sec-Fetch-Site`, anti-framing CSP and response-body size limits. JSON decoders reject a second concatenated JSON object or trailing non-whitespace commands.
3. **Paid licensing** — Public builds no longer include the hardcoded macOS beta key (Go build tags `darwin && developer`). Mac public activation follows the authenticated licensing server path, like Windows. Production license endpoint is compiled in with `--license-url` and ignores environment overrides; a Free build with no pinned endpoint cannot magically activate Pro.
4. **SSRF protections** — AI connector validates DNS addresses at connection time, rejects private/loopback addresses and now additional special-purpose/transition/documentation ranges. No arbitrary unverified IP dial is allowed for a public upstream. Local development API connections follow the separately allowed loopback policy.
5. **Build separation** — `scripts/release/build_desktop.py` produces production builds without `-tags developer` by default. `--developer` deliberately enables test-only Pro privileges and must never be distributed. Build manifests explicitly record edition, developer entitlement, signing and `distributionReady`.
6. **Signed distribution** — Windows offers optional Authenticode verification against a supplied certificate, including the executable and its installer; unsigned artifacts are flagged not ready. A public macOS release now requires a Developer ID Application certificate and Apple notarytool Keychain profile, signs with hardened runtime, notarizes the app and DMG and staples/validates tickets. A private Mac test build remains ad hoc with `--developer`. Signing/notarization steps have not been executed in this connector environment.
7. **Supply chain** — Existing pinned SHA-512/SHA-256 download checks for PDF.js, Tesseract engine and Italian language data are retained. PDF/OCR run locally on-device.

## Local build commands

**Windows test-only Developer** (unlocked Pro features; never send to customers):
```powershell
python scripts/release/build_desktop.py windows ..\NeuroMap-Build --developer
```

**Windows public/release** (replace placeholders with your real code-signing certificate and licensed HTTPS server):
```powershell
python scripts/release/build_desktop.py windows ..\NeuroMap-Release --windows-sign-thumbprint YOUR_40_HEX_CERT_THUMBPRINT --license-url https://YOUR-LICENSE-SERVER.example
```

**macOS private Developer** (ad hoc signing, no external signing secrets):
```bash
python3 scripts/release/build_desktop.py macos ../NeuroMap-Mac-Build --developer
```

**macOS public/release** (requires actual Apple Developer ID and notarytool profile):
```bash
python3 scripts/release/build_desktop.py macos ../NeuroMap-Mac-Release --mac-sign-identity "Developer ID Application: YOUR ORGANIZATION (TEAMID)" --mac-notary-profile YOUR_NOTARY_PROFILE --license-url https://YOUR-LICENSE-SERVER.example
```

Never put certificate private keys, actual API credentials or notary passwords in scripts, source control or chat.

## Tests committed

- `apps/desktop-shared/src/security_hardening_test.go`: native token, Origin/Fetch Metadata, Host, CSP nonce isolation and JSON decoder.
- `apps/desktop-shared/src/security_upstream_test.go`: blocked reserved and accepted public AI destination IPs.
- `scripts/release/test_security_distribution.py`: explicit Developer tags, private Mac beta, pinned licensing, strict macOS origin, signed/notarized distribution.

## Pending validation and residual risk

- Execute `go test ./...` on both production and Developer builds, and full browser/installer tests. Build/test actual Windows portable/installer and signed/notarized macOS app. None of those executions occurred through the GitHub connector.
- Public binaries remain reverse-engineerable: app editor is bundled JavaScript and Go/Swift executables can be decompiled. Further intellectual-property protection should put premium models, license authority and irreplaceable logic on a trusted service, rather than promising impossible anti-extraction.
- The Windows desktop runtime still launches Edge/Chrome in app mode. An embedded native-host replacement would reduce browser integration and is a distinct architectural project.
- An attacker already executing arbitrary code with the same OS user privileges can inspect a localhost webview and its in-memory bearer token. Preventing same-user process attacks requires OS-level isolation and a native IPC bridge; a random localhost port or minified JS alone is not sufficient.
- macOS Keychain/Windows DPAPI protect locally stored secrets at rest, but a compromised running process can still misuse in-memory keys. Audit update channels, certificate renewal, code-signing key storage, provenance/SBOM, transitive dependencies, and server-side rate limits/revocation separately.
- Validate security on installed signed builds with penetration tests and independent review before calling it production-hardened. No claim of absolute security or uncopyable source code is made.
