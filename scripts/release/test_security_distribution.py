"""Security gates for local production builds. No network/CI credentials needed."""
from pathlib import Path
import ast
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = (ROOT / 'scripts/release/build_desktop.py').read_text(encoding='utf8')
MAC = (ROOT / 'apps/macos/native/main.swift').read_text(encoding='utf8')
PRODUCT = (ROOT / 'apps/desktop-shared/src/product_license.go').read_text(encoding='utf8')
BETA = (ROOT / 'apps/desktop-shared/src/mac_beta.go').read_text(encoding='utf8')
BETA_STUB = (ROOT / 'apps/desktop-shared/src/mac_beta_other.go').read_text(encoding='utf8')


class SecureReleaseTests(unittest.TestCase):
    def test_developer_is_never_the_default(self):
        tree = ast.parse(SCRIPT)
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'build')
        args = function.args
        defaults = dict(zip([a.arg for a in args.args][-len(args.defaults):], args.defaults))
        self.assertIsInstance(defaults['developer'], ast.Constant)
        self.assertIs(defaults['developer'].value, False)
        self.assertIn("edition_tags = ['-tags', 'developer'] if developer else []", SCRIPT)
        self.assertIn("parser.add_argument('--developer'", SCRIPT)
        self.assertIn("'developerEntitlement': bool(developer)", SCRIPT)

    def test_public_macos_release_must_be_signed_and_notarized(self):
        self.assertIn("if target == 'macos' and not developer and not backend_only:", SCRIPT)
        self.assertIn("if not mac_sign_identity or not mac_notary_profile:", SCRIPT)
        self.assertIn("'--options', 'runtime', '--timestamp'", SCRIPT)
        self.assertIn("'notarytool', 'submit'", SCRIPT)
        self.assertIn("'stapler', 'validate'", SCRIPT)
        self.assertIn("'distributionReady':", SCRIPT)

    def test_macos_beta_key_not_in_public_build(self):
        self.assertTrue(BETA.startswith('//go:build darwin && developer'))
        self.assertTrue(BETA_STUB.startswith('//go:build !darwin || !developer'))
        self.assertNotIn('return macBetaActivate(key)', PRODUCT)
        self.assertNotIn('voltes', BETA)
        self.assertIn('verifyLicense(key', PRODUCT)

    def test_public_license_url_is_build_pinned(self):
        self.assertIn("parser.add_argument('--license-url'", SCRIPT)
        self.assertIn('releaseLicenseURL=', SCRIPT)
        self.assertIn('if base == "" && developerEdition()', PRODUCT)

    def test_native_macos_bridges_use_exact_loopback_port(self):
        self.assertIn('private func trustedPage(_ candidate: URL?) -> Bool', MAC)
        self.assertIn('url.port == origin.port', MAC)
        self.assertIn('trustedPage(message.frameInfo.request.url)', MAC)
        self.assertIn('navigationAction.navigationType == .linkActivated', MAC)
        self.assertIn('decisionHandler(.cancel)', MAC)


if __name__ == '__main__':
    unittest.main()
