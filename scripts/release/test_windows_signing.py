import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
from build_desktop import sign_windows, validate_signing


class WindowsSigningTests(unittest.TestCase):
    def test_unsigned_builds_remain_available_but_invalid_signing_requests_fail_early(self):
        validate_signing('windows', None)
        with patch('build_desktop.platform.system', return_value='Linux'):
            with self.assertRaises(ValueError):
                validate_signing('windows', 'a' * 40)
        with patch('build_desktop.platform.system', return_value='Windows'):
            for target, value in [('macos', 'a' * 40), ('windows', 'not-a-thumbprint'), ('windows', 'a' * 39 + ';')]:
                with self.assertRaises(ValueError):
                    validate_signing(target, value)
            validate_signing('windows', 'AB12' * 10)

    def test_signing_uses_sha256_timestamp_and_verifies_each_binary(self):
        with patch('build_desktop.run') as run:
            sign_windows(Path('program.exe'), 'a' * 40, 'sdk/signtool.exe')
        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(commands[0], ['sdk/signtool.exe', 'sign', '/sha1', 'a' * 40,
                                     '/s', 'My', '/fd', 'SHA256', '/tr',
                                     'http://timestamp.digicert.com', '/td', 'SHA256', Path('program.exe')])
        self.assertEqual(commands[1], ['sdk/signtool.exe', 'verify', '/pa', '/all', '/tw', Path('program.exe')])

    def test_invalid_or_untrusted_signatures_abort_without_unsigned_fallback(self):
        for fail_at in [0, 1]:
            failure = subprocess.CalledProcessError(1, 'signtool')
            with patch('build_desktop.run', side_effect=([failure] if fail_at == 0 else [None, failure])):
                with self.assertRaises(subprocess.CalledProcessError):
                    sign_windows(Path('program.exe'), 'a' * 40)
