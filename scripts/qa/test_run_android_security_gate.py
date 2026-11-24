#!/usr/bin/env python3
"""Dry contract tests; never execute Android SDK, Gradle, npm or GitHub Actions."""
import tempfile
from pathlib import Path
import unittest
from run_android_security_gate import ROOT, outside_repo, commands


class AndroidSecurityGatePlanTests(unittest.TestCase):
    def test_reports_cannot_be_created_in_checkout(self):
        for path in (ROOT, ROOT / "artifacts" / "security", ROOT.parent):
            with self.subTest(path=path), self.assertRaises(ValueError):
                outside_repo(path)

    def test_quick_runs_five_independent_regression_gates(self):
        jobs = commands(full=False, device_tests=False, stage=Path(tempfile.gettempdir()) / "staged")
        self.assertEqual([job[0] for job in jobs],
                         ["audit-runner-selftest", "redacted-secret-scanner-selftest",
                          "android-security-source", "public-apk-policy", "issuer-path-policy"])
        self.assertFalse(any("gradle" in str(job) for job in jobs))

    def test_full_runs_staging_and_native_unit_build(self):
        stage = Path(tempfile.gettempdir()) / "glauka-android-audit-stage"
        jobs = commands(full=True, device_tests=False, stage=stage)
        self.assertEqual([j[0] for j in jobs][-2:], ["stage-android", "gradle-android"])
        self.assertIn("browser-svg-security", [j[0] for j in jobs])
        self.assertIn(":app:testDebugUnitTest", jobs[-1][1])
        self.assertIn(":app:assembleDebug", jobs[-1][1])

    def test_device_suite_is_explicit_not_silently_skipped(self):
        with self.assertRaises(ValueError):
            commands(full=False, device_tests=True, stage=Path(tempfile.gettempdir()))
        jobs = commands(full=True, device_tests=True, stage=Path(tempfile.gettempdir()))
        self.assertEqual(jobs[-1][0], "android-device")
        self.assertIn(":app:connectedDebugAndroidTest", jobs[-1][1])


if __name__ == "__main__":
    unittest.main()
