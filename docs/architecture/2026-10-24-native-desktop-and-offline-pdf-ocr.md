# NeuroMap desktop: native close, independent window, local PDF and OCR
Date: 2026-10-24. This is an architecture decision record, not a release certification.

## User-facing requirement
- Closing a dirty map or quitting shows three explicit choices: **Salva / Non salvare / Annulla** (English: Save / Don't Save / Cancel). Cancel keeps the window and data. Save must wait for completed project writes. Don't Save must not overwrite any project file.
- Windows and macOS launch as their **own applications**, without opening Microsoft Edge, Chrome, Safari, or an ordinary browser tab.
- Text-layer PDFs and scanned PDFs are processed **offline**, within the installed app, without a CDN or uploading source files.
- No GitHub Actions are required for building or QA.

## Verified baseline
- **Windows:** Go launcher currently calls `findBrowser()` and `startDesktopBrowser()` to run `msedge.exe` or Chrome with `--app=<localhost URL>`. It depends on an installed browser and can still show browser-owned close prompts. This does **not** satisfy the independent native-window requirement.
- **macOS:** Swift `NSApplication/NSWindow` embeds `WKWebView` (system WebKit), waits for `NeuroMapLifecycle.requestClose()` on Close and Cmd+Q, and hosts the Go backend locally. Safari is not launched. WebKit is still a rendering engine, not a separate browser app.
- **PDF.js 6.4.299:** bundled Mozilla modules (Apache-2.0) served from local app resources; used for text/outline extraction and PDF rasterization. Not an external PDF service.
- **OCR:** local Italian Tesseract compiled to WebAssembly; WASM worker plus locally staged language assets, no network required at runtime. It executes inside the embedded rendering engine and is **not** yet a standalone OS-native library.

## 2026-10-24 close behavior implemented
- Shared lifecycle uses three explicit localized choices. Failed or cancelled saves prevent close. After native approval, a second `beforeunload` dialog is suppressed.
- Explicit Don't Save waits for queued temporary writes, then invokes the authenticated local `workspace/discard` endpoint, which removes **only** `workspace-autosave.json` (not any user-selected project file); legacy localStorage fallback is also removed.
- App tab-close dialog is localized and uses the same three choices.
- Unexpected navigation in a browser-run editor still receives a standard browser `beforeunload` protection; JavaScript cannot replace that native browser prompt with arbitrary application UI.

## Required Windows replacement: do not silently switch to WebView2
To remove dependence on **installed Edge/Chrome**, the Windows build needs a first-party OS window hosting an **app-bundled rendering runtime**, such as a pinned, signed CEF/Chromium distribution. Chromium would remain the internal rendering engine, but the user would not launch or need Edge/Chrome. The app installer must ship and verify all runtime binaries, native dependencies, and licenses, and launch the embedded window rather than `findBrowser()`. No insecure silent executable downloads at app startup. This is a substantial packaging and native-host project, not completed by the close-dialog changes.

If the stricter requirement is **no web engine whatsoever**, CEF, Electron, and WebView2 do not qualify. NeuroMap's HTML/CSS/JS map editor must be ported to a native GUI toolkit, PDF.js replaced by a native PDF parser/renderer (e.g. PDFium with reviewed license/build), and Tesseract compiled/linked into the desktop applications. This is a full renderer rewrite with independent performance/security qualification.

## Validation gate before release
1. Windows installed app launches without Edge/Chrome installed (CEF-bundled architecture only), uses only NeuroMap-owned windows and system pickers, no browser-owned leave-site dialogs.
2. macOS Close, Cmd+Q, Save/Don't Save/Cancel and cancelled file picker behave correctly. Original `.xmind`/`.neuromap` files remain intact on Don't Save.
3. No pending autosave can revive explicitly discarded changes. Accidental crash (without user choice) still keeps recovery.
4. Offline PDF: 200-page selectable-text PDF, bookmarks, error/cancel handling and worker cleanup. OCR: real Italian scans, column/table order, quality warnings, search; source bytes never transmitted.
5. Explicit firewall/network-denial run on Windows and macOS; downloaded runtime modules/assets are disallowed.
6. Builds/installer, Go and Swift compilation, WebKit/Chromium UI, real OS QA, app signing/notarization are independently verified. **No new Windows CEF host, native Tesseract backend, or EXE/DMG is claimed by this record.**
