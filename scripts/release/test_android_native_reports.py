"""Fail-closed Android Gradle test-report checks, no SDK or device required."""
from pathlib import Path
import tempfile
import unittest

from build_android_local import verified_native_java_tests


class VerifiedNativeJavaTests(unittest.TestCase):
    def write_report(self, folder, name, tests, failures=0, errors=0, skipped=0):
        (folder / ('TEST-' + name + '.xml')).write_text(
            f'<testsuite tests="{tests}" failures="{failures}" '
            f'errors="{errors}" skipped="{skipped}"/>', encoding='utf-8')

    def test_valid_reports_count_all_cases(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            self.write_report(folder, 'One', 4)
            self.write_report(folder, 'Two', 3, skipped=1)
            self.assertEqual(verified_native_java_tests(folder), 7)

    def test_missing_xml_does_not_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'missing'):
                verified_native_java_tests(Path(temp))

    def test_zero_tests_does_not_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            self.write_report(folder, 'Empty', 0)
            with self.assertRaisesRegex(ValueError, 'No native'):
                verified_native_java_tests(folder)

    def test_all_skipped_does_not_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            self.write_report(folder, 'Skipped', 5, skipped=5)
            with self.assertRaisesRegex(ValueError, 'No native'):
                verified_native_java_tests(folder)

    def test_failing_report_does_not_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            self.write_report(folder, 'Failed', 2, failures=1)
            with self.assertRaisesRegex(ValueError, 'failed'):
                verified_native_java_tests(folder)

    def test_corrupt_or_inconsistent_reports_do_not_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            file = folder / 'TEST-Bad.xml'
            for content in (
                '<testsuite tests="oops" failures="0" errors="0"/>',
                '<testsuite tests="1" failures="0" errors="0" skipped="2"/>',
                '<testsuites tests="1" failures="0" errors="0"/>',
                '<testsuite',
            ):
                with self.subTest(content=content):
                    file.write_text(content, encoding='utf-8')
                    with self.assertRaisesRegex(ValueError, 'Invalid'):
                        verified_native_java_tests(folder)


if __name__ == '__main__':
    unittest.main()
