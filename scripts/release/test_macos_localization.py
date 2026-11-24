"""Packaging contracts for native messages before WKWebView can start."""
import json
from pathlib import Path
import plistlib
import re
import unittest
import sys
import subprocess
import shutil

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/release"))
from macos_version import macos_bundle_build
NATIVE = ROOT / 'apps/macos/native'


class MacLocalizationTests(unittest.TestCase):
    def test_native_messages_and_microphone_permissions_cover_every_language(self):
        messages = json.loads((NATIVE / 'NativeMessages.json').read_text())
        source = json.loads((ROOT / 'packages/editor-ui/locales/source.json').read_text())
        self.assertEqual(set(messages), {item['code'] for item in source['languages']})
        keys = set(messages['en'])
        for code, pack in messages.items():
            self.assertEqual(set(pack), keys)
            self.assertTrue(all(isinstance(value, str) and value.strip() for value in pack.values()))
            text = (NATIVE / f'{code}.lproj/InfoPlist.strings').read_text()
            value = re.fullmatch(r'"NSMicrophoneUsageDescription" = (".*");\n', text)
            self.assertIsNotNone(value, code)
            self.assertEqual(json.loads(value[1]), pack['microphone'])
        swift = (NATIVE / 'main.swift').read_text()
        self.assertTrue(set(re.findall(r'GlaukaNativeLanguage.text\("([^"]+)"\)', swift)) <= keys)
        self.assertIn('GLAUKA_SYSTEM_LANGUAGE', swift)
        self.assertNotIn('.darkAqua', swift)

    def test_all_packagers_copy_native_language_resources_and_current_bundle_identity(self):
        info = plistlib.loads((NATIVE / 'Info.plist').read_bytes())
        self.assertEqual(info['CFBundleExecutable'], 'Glauka')
        for filename in ['scripts/release/build_desktop.py', 'scripts/release/build_macos_cross.py', '.github/workflows/build-macos-6151.yml']:
            text = (ROOT / filename).read_text()
            self.assertIn('NativeMessages.json', text, filename)
            self.assertIn('*.lproj', text, filename)
        cross = (ROOT / 'scripts/release/build_macos_cross.py').read_text()
        self.assertNotIn("output/'NeuroMap Architect.app'", cross)
        self.assertIn("mac/'Glauka'", cross)
        self.assertIn("version.split('-',1)[0]", cross)
        self.assertIn("backend_only=True, developer=True", cross)

    def test_native_menu_finder_recovery_and_release_metadata(self):
        swift = (NATIVE / 'main.swift').read_text()
        go = (ROOT / 'apps/desktop-shared/src/main.go').read_text()
        native_queue = (ROOT / 'apps/desktop-shared/src/mac_native_open.go').read_text()
        dialog = (ROOT / 'apps/desktop-shared/src/dialog_darwin.go').read_text()
        manifest = json.loads((ROOT / 'versions.json').read_text())
        plist = plistlib.loads((NATIVE / 'Info.plist').read_bytes())
        stage = (ROOT / 'scripts/release/prepare.py').read_text()
        self.assertEqual(plist['GlaukaReleaseVersion'], manifest['macos']['version'])
        self.assertEqual(plist['CFBundleVersion'], macos_bundle_build(manifest['macos']['version']))
        self.assertIn("info['GlaukaReleaseVersion'] = release", stage)
        self.assertIn('forInfoDictionaryKey: "GlaukaReleaseVersion"', swift)
        self.assertNotIn('window.appearance = NSAppearance(named: .aqua)', swift)
        self.assertIn('func application(_ sender: NSApplication, openFiles', swift)
        self.assertIn('func application(_ sender: NSApplication, openFile', swift)
        self.assertIn('proc.standardInput = commands', swift)
        self.assertIn('go s.readMacNativeOpens(os.Stdin)', go)
        self.assertIn('scanner.Buffer(make([]byte, 0, 1024), 16*1024)', native_queue)
        self.assertIn('len(s.externalQueue) >= 64', native_queue)
        self.assertIn('info.Size() > 100<<20', native_queue)
        self.assertIn('startupTimeout = watchdog', swift)
        self.assertIn('webViewWebContentProcessDidTerminate', swift)
        self.assertIn('didFailProvisionalNavigation', swift)
        self.assertIn('NSApp.mainMenu = main', swift)
        self.assertNotIn('quotedAppleScript', dialog)
        self.assertIn('message (item 1 of argv)', dialog)

    def test_additional_native_mac_safety_contracts(self):
        swift = (NATIVE / 'main.swift').read_text()
        dialog = (ROOT / 'apps/desktop-shared/src/dialog_file_darwin.go').read_text()
        keychain = (ROOT / 'apps/desktop-shared/src/secret_darwin.go').read_text()
        gate = (ROOT / 'scripts/release/verify_signed_macos.sh').read_text()
        stage = (ROOT / 'scripts/release/prepare.py').read_text()
        native = (ROOT / 'apps/desktop-shared/src/main.go').read_text()
        self.assertIn('app="$build_dir/Glauka.app"', gate)
        self.assertNotIn('NeuroMap Architect.app', gate)
        self.assertIn("info['CFBundleVersion'] = macos_bundle_build(release)", stage)
        self.assertIn('if closeInProgress {', swift)
        self.assertIn('offerUnresponsiveClose(attempt: closeAttempt)', swift)
        self.assertIn('DispatchQueue.main.asyncAfter(deadline: .now() + 90', swift)
        self.assertIn('attempt == closeAttempt', swift)
        self.assertIn('NSApp.reply(toApplicationShouldTerminate: force)', swift)
        self.assertIn('alert.addButton(withTitle: GlaukaNativeLanguage.text("stayInApp"))', swift)
        self.assertIn('closeTimeout?.cancel()', swift)
        self.assertIn('"markdown", "txt", "opml", "xml"', swift)
        self.assertIn('pendingDocumentPaths.count >= 64', swift)
        self.assertIn('tooManyDocuments', swift)
        self.assertIn('".markdown", ".txt", ".opml", ".xml"', native)
        self.assertIn('ASCII character 0', dialog)
        self.assertIn('strings.TrimSuffix(string(b), "\\n")', dialog)
        self.assertIn('parseMacSelection(out)', dialog)
        self.assertNotIn('strings.TrimSpace(out)', dialog)
        self.assertIn('missingKeychainItem(out)', keychain)
        self.assertIn('if err != nil || found { return key, err }', keychain)
        self.assertIn('existing, exists, readErr := readMacSecretKey()', keychain)
        self.assertNotIn('"-U"', keychain)
        messages = json.loads((NATIVE / 'NativeMessages.json').read_text())
        for locale, entries in messages.items():
            for name in ('unresponsiveClose', 'unsavedCloseWarning', 'stayInApp',
                         'forceQuit', 'tooManyDocuments', 'openInBatches'):
                self.assertTrue(entries.get(name), (locale, name))

    def test_swift_go_document_ack_is_async_bounded_and_locally_diagnosable(self):
        swift = (NATIVE / 'main.swift').read_text()
        backend = (ROOT / 'apps/desktop-shared/src/mac_native_open.go').read_text()
        native = (ROOT / 'apps/desktop-shared/src/main.go').read_text()
        messages = json.loads((NATIVE / 'NativeMessages.json').read_text())
        for marker in (
            'private let documentWriter = DispatchQueue(',
            'documentWriter.async {',
            'activeDocumentID = id',
            'private func receiveDocumentReply(',
            'DispatchQueue.main.asyncAfter(deadline: .now() + 15',
            'let part = handle.readData(ofLength: 1)',
            'self?.receiveDocumentReply(id: id, ok: ok, reason: reason)',
            'documentDeliveryRetryCount < 20',
            'documentDeliveryFailed',
            'backend.stderr.log',
            'written < 64 * 1024',
            'posixPermissions: 0o600',
        ):
            self.assertIn(marker, swift, marker)
        self.assertNotIn('proc.standardError = FileHandle.nullDevice', swift)
        self.assertIn('readMacNativeOpensWithReplies(input, os.Stdout)', backend)
        self.assertIn('fmt.Fprintln(replies, string(payload))', backend)
        self.assertIn('if len(s.externalQueue) >= 64', backend)
        self.assertIn('return "busy"', backend)
        self.assertIn('if runtime.GOOS == "darwin" && developerEdition()', native)
        for lang, dictionary in messages.items():
            for key in ('documentDeliveryFailed', 'documentDeliveryHint',
                        'documentRetry', 'documentSkip'):
                self.assertTrue(dictionary.get(key), (lang, key))

    def test_keychain_isolated_and_secret_never_appears_in_process_arguments(self):
        keychain = (ROOT / 'apps/desktop-shared/src/secret_darwin.go').read_text()
        builder = (ROOT / 'scripts/release/build_desktop.py').read_text()
        edition = (ROOT / 'scripts/release/macos_edition.py').read_text()
        swift = (NATIVE / 'main.swift').read_text()
        for marker in (
            'exec.CommandContext(ctx, "security", "-i")',
            'command.Stdin = strings.NewReader(keychainCreateScript(',
            'existing, exists, readErr := readMacSecretKey()',
            'return keychainService + ".developer"',
        ):
            self.assertIn(marker, keychain)
        self.assertNotIn('"-w", encoded', keychain)
        self.assertNotIn('"-U"', keychain)
        self.assertIn('stage_macos_edition(dest/\'mac\', developer)', builder)
        self.assertIn('PUBLIC_BUNDLE_ID + ".developer"', edition)
        self.assertIn('"NeuroMap Architect/Developer/ui-locale.json"', swift)

    def test_mac_single_instance_and_all_developer_packages(self):
        src = ROOT / "apps/desktop-shared/src"
        main = (src / "main.go").read_text()
        darwin = (src / "instance_darwin.go").read_text()
        other = (src / "instance_other.go").read_text()
        swift = (NATIVE / "main.swift").read_text()
        builder = (ROOT / "scripts/release/build_desktop.py").read_text()
        cross = (ROOT / "scripts/release/build_macos_cross.py").read_text()
        reuse = (ROOT / "scripts/release/build_macos_reusing_shell.py").read_text()
        self.assertIn("macNativeServer := runtime.GOOS", main)
        self.assertIn("if !testServer || macNativeServer", main)
        self.assertIn("//go:build darwin", darwin)
        self.assertIn("syscall.Flock", darwin)
        self.assertIn("LOCK_EX|syscall.LOCK_NB", darwin)
        self.assertIn("//go:build !windows && !darwin", other)
        self.assertIn("forwardToRunningCopy()", swift)
        self.assertIn("NSRunningApplication.runningApplications(withBundleIdentifier:", swift)
        self.assertIn("configuration.createsNewApplicationInstance = false", swift)
        self.assertIn("withApplicationAt: applicationURL", swift)
        self.assertIn("'Glauka Developer.app' if developer else 'Glauka.app'", builder)
        self.assertIn("app = output/'Glauka Developer.app'", cross)
        self.assertIn("app=output/'Glauka Developer.app'", reuse)
        self.assertIn("recordLine(buffer)", swift)
        self.assertIn("if !buffer.isEmpty { recordLine(buffer) }", swift)

    @unittest.skipUnless(shutil.which("node"), "Node is required for the actual bridge contract tests")
    def test_cross_platform_external_import_needs_editor_ack(self):
        # Evaluate the production bridge/controller. Do not require a particular
        # queue-removal expression, grant rollback spelling, or read primitive.
        result = subprocess.run([
            "node", "--test",
            "packages/editor-ui/tests/desktop-external-handoff.test.js",
            "packages/editor-ui/tests/native-external-burst.test.js",
            "packages/editor-ui/tests/native-open-transactions.test.js",
        ], cwd=ROOT, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
