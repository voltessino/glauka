# Glauka — historical release gate and penetration-test handoff

Historical snapshot from 24 October. Tool availability, local build evidence and main have since changed; see [current release preparation](../qa/2026-10-29-release-hardening.md). This historical report does not describe the current execution environment.

**Date:** 2026-10-24 (Europe/Rome)  
**Decision:** BLOCKED / NOT VERIFIED FOR PUBLIC RELEASE.

This status is explicit to prevent accidental claims of "full build successful", "independently penetration-tested" or "signed installation verified" when only source and mock/unit results are available.

## Evidence and execution environment

- The repository is private `voltessino/neuromap-android`. GitHub connector authorizes source reads/writes, but the execution container cannot resolve/reach `github.com` for a checkout. No complete repository clone is present in that container.
- Available runner is Linux with Go 1.23.2, Node 22.16.0 and Python 3.13.5; no Windows host, macOS/Xcode signing/notary tools or signing certificate identity is available.
- GitHub release list returned no releases. No `.exe`, `.dmg` or `.app` artifacts were supplied for actual signature inspection.
- **Consequently:** no complete native build, full Playwright suite, real Windows Authenticode trust check, Apple Gatekeeper notarization check, or independent external pentest has been executed. This must NOT be reported as a pass.

## Critical source finding mitigated (requires compiled regression verification)

**Unauthenticated loopback UI leaked the native session bearer.** Previously any local process could GET `http://127.0.0.1:port/` and receive the inline desktop bridge with its `X-NeuroMap-Session` bearer. A local attacker could then make authenticated filesystem/licensing/AI API requests. Loopback binding and Origin checks did not stop direct local HTTP clients.

Source mitigation in `apps/desktop-shared/src/main.go`:
- The native UI starts with a random `?__nm_launch=<token>` bootstrap capability.
- The initial visit sets a same-site, HttpOnly, process-session cookie and immediately redirects to `/`, removing the launch token from the browser address.
- Both `/` and `/index.html` reject requests without the correct current-session cookie or initial bootstrap, and the public response cannot reveal the API bearer.
- Privileged POST routes still require the separate explicit bearer header. Existing local Host, Origin, `Sec-Fetch-Site`, CSP, no-frame and request-size controls remain.
- Existing real-browser QA launch scripts were adapted to follow the cookie bootstrap.
- Tests in `apps/desktop-shared/src/security_hardening_test.go` check anonymous 403, wrong bootstrap, strict HttpOnly cookie, valid bootstrap, invalid stale cookie and distinct CSP nonce.

**Residual risk:** the startup URL still carries a short-lived in-memory capability visible to processes that can read the app's process command line or control its WebView. OS process compromise or same-user malware cannot be reliably stopped by loopback cookies. A dedicated native authenticated IPC design would further narrow this. No machine-client can guarantee the executable's reverse-engineering resistance.

## Real verification tools committed (not yet executed against signed artifacts)

- `scripts/qa/pentest_loopback.py <backend>`: runs the real backend with a temporary isolated profile, attempts anonymous file/secret/AI API access, Host spoofing, cross-site bearer reuse, expired cookies and bad bootstraps, then checks the valid browser bootstrap. Prints no credentials and performs no authorized destructive write.
- `scripts/release/verify_signed_windows.ps1 -BuildDirectory <build>`: verifies manifest SHA256, non-Developer edition, OS-trusted Authenticode on *both* portable and installer executables, matching publisher certificate fingerprint and timestamp via Windows SDK SignTool. Fails on any missing artifact or mismatch.
- `scripts/release/verify_signed_macos.sh <build/output>`: validates artifact hashes, strict Developer ID signature, Gatekeeper approval, notarization tickets/stapling on app and DMG.
- `scripts/release/build_desktop.py` invokes the security smoke suite on a locally runnable backend and then the signature trust checks for public Windows/macOS builds. No GitHub Actions are invoked.

## Local signing and build commands

From a **clean checkout** on a properly configured Windows machine (actual Windows SDK certificate in CurrentUser/My):
```powershell
python scripts/release/build_desktop.py windows ..\NeuroMap-Signed-Release --windows-sign-thumbprint YOUR_40_HEX_CERT_THUMBPRINT --license-url https://YOUR-PUBLISHED-LICENSE-HOST.example
powershell -NoProfile -File scripts/release/verify_signed_windows.ps1 -BuildDirectory ..\NeuroMap-Signed-Release
```
The build also runs Go tests (both editions) and the loopback abuse smoke suite. For full Node/Playwright and packaging tests, use the local wrapper `scripts/release/build_windows_local.ps1` with `-SignThumbprint`, `-LicenseURL` and a **clean working tree**. Developer test binaries must never be shipped to customers.

From a **clean checkout** on macOS with valid Developer ID and notarytool Keychain profile:
```bash
python3 scripts/release/build_desktop.py macos ../NeuroMap-Mac-Signed --mac-sign-identity 'Developer ID Application: YOUR ENTITY (TEAMID)' --mac-notary-profile YOUR_PROFILE --license-url https://YOUR-PUBLISHED-LICENSE-HOST.example
bash scripts/release/verify_signed_macos.sh ../NeuroMap-Mac-Signed/output
```

Do not share signing private keys or Apple App Store/Developer credentials in source control or conversation.

## Independent third-party penetration test: required scope / acceptance

An **external professional assessor not involved in writing the code** must inspect a reproducible signed build and current source, document methodology and raw evidence, then deliver signed findings with severity, reproduction steps and retest verdict. Suggested minimum attack scope:

1. Unauthenticated/replayed local service access, random-port collisions and token exposure in argv, cookies, crash dumps and logs.
2. Drive-by browser and DNS-rebinding attempts; CSRF, WebView origin confusion, iframe and CSP bypass.
3. Hostile `.neuromap`, `.xmind`, PDF (including 200-page malicious scans), OPML, DOCX, Markdown/HTML and image payloads for XSS, parser denial of service, zip bombs and path traversal.
4. AI endpoint SSRF against cloud metadata, IPv4/IPv6 transition and NAT64 networks, redirects, credential leakage and connection timeouts.
5. Native file selection, approved-path persistence, unsafe symlinks, filesystem race/swap, installer/upgrade/uninstall privilege changes and permissions.
6. Pro licensing: bypass attempts against **production binaries only**, offline tampering and server-side authorization / replay protection.
7. Supply-chain dependency integrity, reproducibility/SBOM, downloaded OCR models and malicious update channels.
8. Secrets at rest and in-process on Windows/macOS, sandboxing, update signatures, code-signing key custody and binary substitution.

**Release acceptance:** all critical/high findings resolved and retested, the real Windows and macOS build/integration tests passing, real signing/notarization acceptance on target OS, and external assessor evidence delivered. Until then: **BLOCKED**.
