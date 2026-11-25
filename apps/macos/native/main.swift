import Cocoa
import WebKit

// Native messages must work before the backend or web interface is available.
private enum GlaukaNativeLanguage {
    static let supported: Set<String> = ["it", "en", "de", "es", "fr", "pt", "ar", "zh-CN"]
    static func normalize(_ value: String) -> String {
        let base = value.lowercased().split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init) ?? "en"
        if base == "zh" { return "zh-CN" }
        return supported.contains(base) ? base : "en"
    }
    static let system = normalize(Locale.preferredLanguages.first ?? "en")
    static var current: String {
        guard let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return system }
        // The public edition retains its historical preferences; private
        // Developer copies use the isolated backend directory and WebKit ID.
        let relative = Bundle.main.bundleIdentifier?.hasSuffix(".developer") == true
            ? "NeuroMap Architect/Developer/ui-locale.json"
            : "NeuroMap Architect/ui-locale.json"
        let file = directory.appendingPathComponent(relative)
        guard let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 512,
              let data = try? Data(contentsOf: file),
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let code = value["locale"], supported.contains(code) else { return system }
        return code
    }
    static let messages: [String: [String: String]] = {
        guard let file = Bundle.main.url(forResource: "NativeMessages", withExtension: "json"),
              let data = try? Data(contentsOf: file),
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: [String: String]] else { return [:] }
        return value
    }()
    static func text(_ key: String) -> String { messages[current]?[key] ?? messages["en"]?[key] ?? "Glauka" }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var backend: Process?
    var closeAllowed = false
    var closeInProgress = false
    var pendingQuit = false
    private var trustedOrigin: URL?
    private var backendInput: FileHandle?
    private var pendingDocumentPaths: [String] = []
    private var documentRequestIDs: [String: String] = [:]
    private var activeDocumentID: String?
    private var documentDeliveryRetryCount = 0
    private var documentDeliveryTimeout: DispatchWorkItem?
    private let documentWriter = DispatchQueue(label: "it.glauka.macos.documents", qos: .utility)
    private var startupComplete = false
    private var startupTimeout: DispatchWorkItem?
    private var recoveryAlertOpen = false
    private var closeAttempt = 0
    private var closeTimeout: DispatchWorkItem?
    private var closeRecoveryAlertOpen = false

    // Only the exact port started by our own backend is a privileged origin.
    private func trustedPage(_ candidate: URL?) -> Bool {
        guard let url = candidate, let origin = trustedOrigin else { return false }
        return url.scheme == "http" && url.host == "127.0.0.1" && url.port == origin.port &&
               url.user == nil && url.password == nil
    }
    // Finder may deliver open events before applicationDidFinishLaunching.
    private let supportedDocuments: Set<String> = [
        "gk", "glk", "neuromap", "xmind", "json", "md",
        "markdown", "txt", "opml", "xml"
    ]
    func application(_ sender: NSApplication, openFile filename: String) -> Bool {
        return enqueueDocuments([filename]) > 0
    }
    func application(_ sender: NSApplication, openFiles filenames: [String]) {
        let count = enqueueDocuments(filenames)
        sender.reply(toOpenOrPrint: count > 0 ? .success : .failure)
    }
    @discardableResult
    private func enqueueDocuments(_ filenames: [String]) -> Int {
        var accepted = 0
        var overflow = 0
        for path in filenames {
            let url = URL(fileURLWithPath: path).standardizedFileURL
            guard supportedDocuments.contains(url.pathExtension.lowercased()) else { continue }
            if pendingDocumentPaths.contains(url.path) {
                accepted += 1
                continue
            }
            if pendingDocumentPaths.count >= 64 {
                overflow += 1
                continue
            }
            pendingDocumentPaths.append(url.path)
            accepted += 1
        }
        if overflow > 0 {
            // Tell the user about omitted documents instead of reporting
            // unconditional success when the bounded startup queue is full.
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.alertStyle = .warning
                alert.messageText = GlaukaNativeLanguage.text("tooManyDocuments")
                alert.informativeText = GlaukaNativeLanguage.text("openInBatches")
                alert.runModal()
            }
        }
        flushPendingDocuments()
        if window != nil { NSApp.activate(ignoringOtherApps: true) }
        return accepted
    }
    private func flushPendingDocuments() {
        guard activeDocumentID == nil,
              let path = pendingDocumentPaths.first,
              let input = backendInput, backend?.isRunning == true else { return }
        // Keep the same ID across retries; Go caches acknowledged IDs so
        // reconnecting after a lost reply never imports the map twice.
        let id = documentRequestIDs[path] ?? UUID().uuidString
        documentRequestIDs[path] = id
        guard let body = try? JSONSerialization.data(withJSONObject: ["id": id, "path": path]) else {
            documentDeliveryFailed(id: nil, reason: "invalid")
            return
        }
        activeDocumentID = id
        // The main thread never writes to a potentially full backend pipe.
        // Keep the queued path until Go positively acknowledges acceptance.
        documentWriter.async { [weak self] in
            do {
                try input.write(contentsOf: body + Data([10]))
            } catch {
                DispatchQueue.main.async { [weak self] in
                    self?.documentDeliveryFailed(id: id, reason: "channel")
                }
            }
        }
        let timer = DispatchWorkItem { [weak self] in
            self?.documentDeliveryFailed(id: id, reason: "timeout")
        }
        documentDeliveryTimeout = timer
        DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: timer)
    }
    private func documentDeliveryFailed(id: String?, reason: String) {
        guard (id == nil && activeDocumentID == nil) ||
              (id != nil && activeDocumentID == id) else { return }
        documentDeliveryTimeout?.cancel()
        documentDeliveryTimeout = nil
        activeDocumentID = nil
        if reason == "busy" && documentDeliveryRetryCount < 20 {
            documentDeliveryRetryCount += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                self?.flushPendingDocuments()
            }
            return
        }
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = GlaukaNativeLanguage.text("documentDeliveryFailed")
        alert.informativeText = GlaukaNativeLanguage.text("documentDeliveryHint")
        alert.addButton(withTitle: GlaukaNativeLanguage.text("documentRetry"))
        alert.addButton(withTitle: GlaukaNativeLanguage.text("documentSkip"))
        let answer = alert.runModal()
        documentDeliveryRetryCount = 0
        if answer == .alertSecondButtonReturn && !pendingDocumentPaths.isEmpty {
            let skipped = pendingDocumentPaths.removeFirst()
            documentRequestIDs.removeValue(forKey: skipped)
        }
        // A retry is explicit after a timeout, since Go might have accepted
        // the first request and its acknowledgement alone was interrupted.
        flushPendingDocuments()
    }
    private func receiveDocumentReply(id: String, ok: Bool, reason: String) {
        guard activeDocumentID == id else { return }  // stale/delayed ack
        if ok {
            documentDeliveryTimeout?.cancel()
            documentDeliveryTimeout = nil
            activeDocumentID = nil
            documentDeliveryRetryCount = 0
            if !pendingDocumentPaths.isEmpty {
                let accepted = pendingDocumentPaths.removeFirst()
                documentRequestIDs.removeValue(forKey: accepted)
            }
            flushPendingDocuments()
        } else {
            documentDeliveryFailed(id: id, reason: reason)
        }
    }
    private func beginBackendDiagnostics(_ errors: Pipe) {
        // Bounded, owner-only diagnostics. Read stderr continuously even after
        // the log reaches its cap, so a chatty service never blocks on a full pipe.
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        let subpath = Bundle.main.bundleIdentifier?.hasSuffix(".developer") == true
            ? "NeuroMap Architect/Developer/diagnostics"
            : "NeuroMap Architect/diagnostics"
        let logfile = directory?.appendingPathComponent(subpath).appendingPathComponent("backend.stderr.log")
        DispatchQueue.global(qos: .utility).async {
            var sink: FileHandle?
            if let file = logfile {
                do {
                    try FileManager.default.createDirectory(at: file.deletingLastPathComponent(),
                        withIntermediateDirectories: true,
                        attributes: [.posixPermissions: 0o700])
                    FileManager.default.createFile(atPath: file.path, contents: nil,
                        attributes: [.posixPermissions: 0o600])
                    try FileManager.default.setAttributes([.posixPermissions: 0o600],
                        ofItemAtPath: file.path)
                    sink = try FileHandle(forWritingTo: file)
                    sink?.truncateFile(atOffset: 0)
                } catch { sink = nil }
            }
            defer { sink?.closeFile() }
            var buffer = Data()
            var written = 0
            func recordLine(_ bytes: Data) {
                guard written < 64 * 1024, let line = String(data: bytes, encoding: .utf8) else { return }
                let lowered = line.lowercased()
                let secretHints = ["token", "password", "secret", "authorization",
                                   "bearer", "api-key", "apikey", "launch=",
                                   "cookie", "http://", "https://"]
                let clean = secretHints.contains(where: { lowered.contains($0) })
                    ? "[sensitive backend output omitted]"
                    : String(line.prefix(300))
                if let record = (clean + "\n").data(using: .utf8),
                   written + record.count <= 64 * 1024 {
                    sink?.write(record)
                    written += record.count
                }
            }
            while true {
                let chunk = errors.fileHandleForReading.readData(ofLength: 4096)
                if chunk.isEmpty { break }
                for byte in chunk {
                    if byte == 10 {
                        recordLine(buffer)
                        buffer.removeAll(keepingCapacity: true)
                    } else if buffer.count < 512 {
                        buffer.append(byte)
                    }
                }
            }
            // Go may exit without a terminal newline precisely when it
            // crashes; preserve the final bounded diagnostic fragment.
            if !buffer.isEmpty { recordLine(buffer) }
        }
    }
    // LaunchServices normally reuses an application, but users can still
    // start an identical .app from a second folder or direct executable.
    // Redirect Finder documents to the existing application before creating
    // another WebKit profile or backend process.
    private func forwardToRunningCopy() -> Bool {
        guard let bundleID = Bundle.main.bundleIdentifier else { return false }
        let pid = ProcessInfo.processInfo.processIdentifier
        guard let existing = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID)
            .first(where: { $0.processIdentifier != pid && !$0.isTerminated }) else { return false }
        let paths = pendingDocumentPaths
        if paths.isEmpty {
            existing.activate(options: [.activateIgnoringOtherApps])
            NSApp.terminate(nil)
            return true
        }
        guard let applicationURL = existing.bundleURL else {
            let alert = NSAlert()
            alert.alertStyle = .warning
            alert.messageText = GlaukaNativeLanguage.text("documentDeliveryFailed")
            alert.informativeText = GlaukaNativeLanguage.text("documentDeliveryHint")
            alert.runModal()
            NSApp.terminate(nil)
            return true
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.createsNewApplicationInstance = false
        configuration.activates = true
        NSWorkspace.shared.open(paths.map { URL(fileURLWithPath: $0) },
                                withApplicationAt: applicationURL,
                                configuration: configuration) { _, error in
            DispatchQueue.main.async {
                if let error = error {
                    NSAlert(error: error).runModal()
                }
                NSApp.terminate(nil)
            }
        }
        return true
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        // File-open Apple events may arrive just AFTER didFinishLaunching.
        // A duplicate launcher with no pending files should briefly defer
        // forwarding so those events are not silently lost on termination.
        if pendingDocumentPaths.isEmpty, let id = Bundle.main.bundleIdentifier,
           NSRunningApplication.runningApplications(withBundleIdentifier: id)
               .contains(where: {
                   $0.processIdentifier != ProcessInfo.processInfo.processIdentifier && !$0.isTerminated
               }) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                guard let self = self else { return }
                if self.forwardToRunningCopy() { return }
                self.launchBackendAndEditor()
            }
            return
        }
        if forwardToRunningCopy() { return }
        launchBackendAndEditor()
    }
    private func launchBackendAndEditor() {
        configureMenus()
        let appDir = Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS")
        let server = appDir.appendingPathComponent("neuromap-server")
        let proc = Process()
        proc.executableURL = server
        proc.arguments = ["--mac-server"]
        var environment = ProcessInfo.processInfo.environment
        environment["GLAUKA_SYSTEM_LANGUAGE"] = GlaukaNativeLanguage.system
        proc.environment = environment
        let pipe = Pipe()
        let commands = Pipe()
        proc.standardOutput = pipe
        proc.standardInput = commands
        let backendErrors = Pipe()
        proc.standardError = backendErrors
        do { try proc.run() } catch { NSAlert(error: error).runModal(); NSApp.terminate(nil); return }
        // Start after successful launch; a failed Process.run must not leave
        // behind a blocked diagnostics reader on an unopened pipe.
        beginBackendDiagnostics(backendErrors)
        backend = proc
        backendInput = commands.fileHandleForWriting
        flushPendingDocuments()
        // The Go service must print its localhost address within a bounded time.
        let watchdog = DispatchWorkItem { [weak self] in
            guard let self = self, !self.startupComplete else { return }
            self.startupComplete = true
            if self.backend?.isRunning == true { self.backend?.terminate() }
            let alert = NSAlert()
            alert.messageText = GlaukaNativeLanguage.text("serviceError")
            alert.informativeText = GlaukaNativeLanguage.text("startupTimeout")
            alert.runModal()
            self.closeAllowed = true
            NSApp.terminate(nil)
        }
        startupTimeout = watchdog
        DispatchQueue.main.asyncAfter(deadline: .now() + 30, execute: watchdog)
        let handle = pipe.fileHandleForReading
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            var buf = Data()
            while buf.count < 4096 {
                let part = handle.readData(ofLength: 1)
                if part.isEmpty || part == Data([10]) { break }
                buf.append(part)
            }
            guard let urlText = String(data: buf, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  let url = URL(string: urlText), url.scheme == "http", url.host == "127.0.0.1", url.port != nil,
                  url.user == nil, url.password == nil else {
                DispatchQueue.main.async { [weak self] in
                    guard let self = self, !self.startupComplete else { return }
                    self.startupComplete = true
                    self.startupTimeout?.cancel()
                    // Two users can launch the same bundle within milliseconds.
                    // If the primary Cocoa app appeared after our initial
                    // check, forward its Finder events rather than failing.
                    if self.forwardToRunningCopy() { return }
                    NSAlert(error: NSError(domain:"Glauka",code:1,userInfo:[NSLocalizedDescriptionKey:GlaukaNativeLanguage.text("serviceError")])).runModal()
                    self.closeAllowed = true
                    NSApp.terminate(nil)
                }
                return
            }
            DispatchQueue.main.async { [weak self] in
                guard let self = self, !self.startupComplete else { return }
                self.startupComplete = true
                self.startupTimeout?.cancel()
                self.show(url: url)
            }
            // After the one-time startup URL, stdout carries only bounded
            // JSON acknowledgements; no UI work is performed on this thread.
            var line = Data()
            while true {
                let part = handle.readData(ofLength: 1)
                if part.isEmpty { break }
                if part == Data([10]) {
                    if let json = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                       let id = json["id"] as? String, id.count == 36,
                       let ok = json["ok"] as? Bool {
                        let reason = (json["reason"] as? String) ?? ""
                        DispatchQueue.main.async { [weak self] in
                            self?.receiveDocumentReply(id: id, ok: ok, reason: reason)
                        }
                    }
                    line.removeAll(keepingCapacity: true)
                } else if line.count < 4096 {
                    line.append(part)
                } else {
                    // A malformed line must never exhaust memory.
                    line.removeAll(keepingCapacity: true)
                }
            }
            DispatchQueue.main.async { [weak self] in
                guard let self = self, let id = self.activeDocumentID else { return }
                self.documentDeliveryFailed(id: id, reason: "channel")
            }
        }
    }
    private func configureMenus() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "Glauka")
        let quit = NSMenuItem(title: GlaukaNativeLanguage.text("quit"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        quit.target = NSApp
        appMenu.addItem(quit)
        main.addItem(appItem)
        appItem.submenu = appMenu

        let fileItem = NSMenuItem()
        let file = NSMenu(title: GlaukaNativeLanguage.text("fileMenu"))
        let create = NSMenuItem(title: GlaukaNativeLanguage.text("newMap"), action: #selector(createMapFromMenu(_:)), keyEquivalent: "n")
        create.target = self
        file.addItem(create)
        let open = NSMenuItem(title: GlaukaNativeLanguage.text("openMap"), action: #selector(openMapFromMenu(_:)), keyEquivalent: "o")
        open.target = self
        file.addItem(open)
        let save = NSMenuItem(title: GlaukaNativeLanguage.text("saveMap"), action: #selector(saveMapFromMenu(_:)), keyEquivalent: "s")
        save.target = self
        file.addItem(save)
        let saveAll = NSMenuItem(title: GlaukaNativeLanguage.text("saveAll"), action: #selector(saveAllMapsFromMenu(_:)), keyEquivalent: "s")
        saveAll.keyEquivalentModifierMask = [.command, .shift]
        saveAll.target = self
        file.addItem(saveAll)
        file.addItem(.separator())
        file.addItem(NSMenuItem(title: GlaukaNativeLanguage.text("closeWindow"), action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
        main.addItem(fileItem)
        fileItem.submenu = file

        // Keep the existing editor's canvas shortcuts in WebKit. These menu
        // actions target the normal native text responder only.
        let editItem = NSMenuItem()
        let edit = NSMenu(title: GlaukaNativeLanguage.text("editMenu"))
        for (key, command) in [("cut", "cut:"), ("copy", "copy:"), ("paste", "paste:"), ("selectAll", "selectAll:")] {
            edit.addItem(NSMenuItem(title: GlaukaNativeLanguage.text(key), action: Selector((command)), keyEquivalent: ""))
        }
        main.addItem(editItem)
        editItem.submenu = edit

        let windowItem = NSMenuItem()
        let windows = NSMenu(title: GlaukaNativeLanguage.text("windowMenu"))
        windows.addItem(NSMenuItem(title: GlaukaNativeLanguage.text("minimize"), action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m"))
        main.addItem(windowItem)
        windowItem.submenu = windows
        NSApp.windowsMenu = windows
        NSApp.mainMenu = main
    }
    private func runEditorCommand(_ command: String) {
        guard let web = web, trustedPage(web.url) else { return }
        web.evaluateJavaScript(command, completionHandler: nil)
    }
    @objc private func createMapFromMenu(_ sender: Any?) {
        runEditorCommand("document.getElementById('btn-new-tab')?.click()")
    }
    @objc private func saveMapFromMenu(_ sender: Any?) {
        runEditorCommand("Promise.resolve(window.neuroMapApp?.saveToFile?.()).catch(console.error)")
    }
    @objc private func saveAllMapsFromMenu(_ sender: Any?) {
        runEditorCommand("Promise.resolve(window.neuroMapApp?.saveAllTabs?.()).catch(console.error)")
    }
    @objc private func openMapFromMenu(_ sender: Any?) {
        let chooser = NSOpenPanel()
        chooser.canChooseDirectories = false
        chooser.canChooseFiles = true
        chooser.allowsMultipleSelection = true
        chooser.allowedFileTypes = supportedDocuments.sorted()
        chooser.begin { [weak self] result in
            guard result == .OK else { return }
            self?.enqueueDocuments(chooser.urls.map { $0.path })
        }
    }
    private func showWebRecovery(_ reason: String) {
        guard !recoveryAlertOpen else { return }
        recoveryAlertOpen = true
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = GlaukaNativeLanguage.text("webFailure")
        alert.informativeText = reason + "\n" + GlaukaNativeLanguage.text("recoveryHint")
        alert.addButton(withTitle: GlaukaNativeLanguage.text("retry"))
        alert.addButton(withTitle: GlaukaNativeLanguage.text("close"))
        let selection = alert.runModal()
        recoveryAlertOpen = false
        if selection == .alertFirstButtonReturn {
            web?.reload()
        } else {
            closeAllowed = true
            NSApp.terminate(nil)
        }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showWebRecovery(GlaukaNativeLanguage.text("webCrash"))
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let cause = error as NSError
        if cause.domain == NSURLErrorDomain && cause.code == NSURLErrorCancelled { return }
        showWebRecovery(cause.localizedDescription)
    }

    func show(url: URL) {
        trustedOrigin = url
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "neuromapClipboard")
        config.userContentController.add(self, name: "neuromapOpenURL")
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.underPageBackgroundColor = NSColor.windowBackgroundColor
        window = NSWindow(contentRect: NSRect(x:0,y:0,width:1360,height:840), styleMask:[.titled,.closable,.miniaturizable,.resizable], backing:.buffered, defer:false)
        // Do not label the production application as a private Developer build.
        let version = (Bundle.main.object(forInfoDictionaryKey: "GlaukaReleaseVersion") as? String) ?? (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? ""
        let editionTitle = Bundle.main.bundleIdentifier?.hasSuffix(".developer") == true
            ? "Glauka Developer" : "Glauka"
        window.title = version.isEmpty ? editionTitle : editionTitle + " — " + version
        // Inherit the user's macOS appearance; the web canvas manages its own theme.
        window.colorSpace = NSColorSpace.sRGB
        window.center()
        window.minSize = NSSize(width: 720,height:500)
        window.contentView = web
        window.delegate = self
        window.makeKeyAndOrderFront(nil)
        web.load(URLRequest(url:url))
        NSApp.activate(ignoringOtherApps:true)
    }
    @available(macOS 12.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        guard origin.protocol == "http", origin.host == "127.0.0.1", frame.isMainFrame, type == .microphone,
              trustedPage(frame.request.url), let trusted = trustedOrigin, origin.port == trusted.port else { decisionHandler(.deny); return }
        decisionHandler(.prompt)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Never bypass host isolation for subframes. Only same-origin
        // application pages and their locally generated blob previews may load.
        // CSP remains defense in depth, not the sole authorization boundary.
        if navigationAction.targetFrame?.isMainFrame == false {
            guard let requested = navigationAction.request.url else { decisionHandler(.cancel); return }
            let blobOrigin = requested.scheme == "blob"
                ? URL(string: String(requested.absoluteString.dropFirst("blob:".count))) : nil
            if trustedPage(requested) || (requested.absoluteString == "about:blank") ||
               (blobOrigin != nil && trustedPage(blobOrigin)) {
                decisionHandler(.allow)
            } else { decisionHandler(.cancel) }
            return
        }
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if trustedPage(url) { decisionHandler(.allow); return }
        // Only explicit user clicks can open public web links in the default browser.
        // Never navigate the app to another process on 127.0.0.1 or to file/data/javascript URLs.
        if navigationAction.navigationType == .linkActivated &&
           (url.scheme == "https" || url.scheme == "http") &&
           url.host != "127.0.0.1" && url.host != "localhost" &&
           url.user == nil && url.password == nil {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url,
              (url.scheme == "https" || url.scheme == "http"),
              let host = url.host, !host.isEmpty, host != "127.0.0.1", host != "localhost",
              url.user == nil, url.password == nil else {
            return nil
        }
        NSWorkspace.shared.open(url)
        return nil
    }
    // The JS Save / Discard / Cancel dialog is still authoritative whenever
    // WebKit responds. If WebKit hangs, never terminate without a native choice.
    private func finishClose(allowed: Bool, attempt: Int) {
        guard closeInProgress, !closeRecoveryAlertOpen, attempt == closeAttempt else { return }
        closeTimeout?.cancel()
        closeTimeout = nil
        closeInProgress = false
        closeAllowed = allowed
        if pendingQuit {
            pendingQuit = false
            NSApp.reply(toApplicationShouldTerminate: allowed)
        } else if allowed {
            window?.performClose(nil)
        }
    }
    private func offerUnresponsiveClose(attempt: Int) {
        guard closeInProgress, attempt == closeAttempt, !closeRecoveryAlertOpen else { return }
        closeRecoveryAlertOpen = true
        // Invalidate any late web callback while a native answer is required.
        closeAttempt += 1
        closeTimeout?.cancel()
        closeTimeout = nil
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = GlaukaNativeLanguage.text("unresponsiveClose")
        alert.informativeText = GlaukaNativeLanguage.text("unsavedCloseWarning")
        alert.addButton(withTitle: GlaukaNativeLanguage.text("stayInApp"))
        alert.addButton(withTitle: GlaukaNativeLanguage.text("forceQuit"))
        let answer = alert.runModal()
        closeRecoveryAlertOpen = false
        closeInProgress = false
        let force = answer == .alertSecondButtonReturn
        closeAllowed = force
        if pendingQuit {
            pendingQuit = false
            NSApp.reply(toApplicationShouldTerminate: force)
        } else if force {
            window?.performClose(nil)
        }
    }
    func beginClose() {
        if closeRecoveryAlertOpen { return }
        if closeInProgress {
            // A second Close or Cmd+Q offers an immediate explicit escape.
            offerUnresponsiveClose(attempt: closeAttempt)
            return
        }
        guard let web = web else {
            closeAllowed = true
            if pendingQuit {
                pendingQuit = false
                NSApp.reply(toApplicationShouldTerminate: true)
            } else { NSApp.terminate(nil) }
            return
        }
        closeInProgress = true
        closeAttempt += 1
        let attempt = closeAttempt
        let watchdog = DispatchWorkItem { [weak self] in
            self?.offerUnresponsiveClose(attempt: attempt)
        }
        closeTimeout = watchdog
        // Saving a large workspace or interacting with a native Save dialog
        // can take time. Never interrupt it after a short fixed delay.
        DispatchQueue.main.asyncAfter(deadline: .now() + 90, execute: watchdog)
        Task { @MainActor [weak self] in
            guard let self = self else { return }
            let allowed: Bool
            do {
                let response = try await web.callAsyncJavaScript(
                    "return window.NeuroMapLifecycle ? await window.NeuroMapLifecycle.requestClose() : !window.neuroMapApp",
                    arguments: [:], in: nil, contentWorld: .page)
                allowed = (response as? Bool) == true
            } catch {
                guard self.closeInProgress, attempt == self.closeAttempt,
                      !self.closeRecoveryAlertOpen else { return }
                NSAlert(error: error).runModal()
                self.finishClose(allowed: false, attempt: attempt)
                return
            }
            self.finishClose(allowed: allowed, attempt: attempt)
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "neuromapOpenURL" {
            guard message.frameInfo.isMainFrame,
                  trustedPage(message.frameInfo.request.url),
                  let text = message.body as? String, text.utf8.count <= 2048,
                  let url = URL(string: text),
                  (url.scheme == "https" || url.scheme == "http"),
                  let host = url.host, !host.isEmpty, host != "127.0.0.1", host != "localhost",
                  url.user == nil, url.password == nil else { return }
            NSWorkspace.shared.open(url)
            return
        }
        guard message.frameInfo.isMainFrame, trustedPage(message.frameInfo.request.url),
              let body = message.body as? [String: Any], let id = body["id"] as? String,
              id.range(of: "^clip_[a-fA-F0-9-]{36}$", options: .regularExpression) != nil,
              let kind = body["kind"] as? String else { return }
        var result: [String: Any] = ["id": id]
        if kind == "png", let encoded = body["text"] as? String {
            if NeuroMapClipboard.writePNG(encoded) { result["text"] = "" }
            else { result["error"] = GlaukaNativeLanguage.text("clipboardError") }
        } else if kind == "read" { result["text"] = NeuroMapClipboard.read() }
        else if kind == "write", let text = body["text"] as? String, text.utf8.count <= 6_400_000 {
            if NeuroMapClipboard.write(text) { result["text"] = "" }
            else { result["error"] = GlaukaNativeLanguage.text("clipboardError") }
        } else { result["error"] = GlaukaNativeLanguage.text("clipboardInvalid") }
        guard let data = try? JSONSerialization.data(withJSONObject: result),
              let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.NeuroMapDesktopWorkflow.clipboardReply(" + json + ")", completionHandler: nil)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closeAllowed { return true }
        beginClose(); return false
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if closeAllowed || web == nil { return .terminateNow }
        pendingQuit = true
        beginClose(); return .terminateLater
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.runModal(); completionHandler()
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: GlaukaNativeLanguage.text("cancel"))
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert(); alert.messageText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: GlaukaNativeLanguage.text("cancel"))
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        input.stringValue = defaultText ?? ""
        alert.accessoryView = input
        completionHandler(alert.runModal() == .alertFirstButtonReturn ? input.stringValue : nil)
    }
    func windowWillClose(_ notification: Notification) { closeAllowed = true; NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) { if backend?.isRunning == true { backend?.terminate() } }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
