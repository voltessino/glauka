"""Static safety checks for the one-command local Windows Android APK builder.

These tests do not compile an APK, run PowerShell, or contact GitHub.
Run: python -m unittest scripts/release/test_build_android_local.py
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts/release/build_android_local.ps1"
GUIDE = ROOT / "docs/ANDROID_APK_WINDOWS.md"


class AndroidLocalBuildScriptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = SOURCE.read_text(encoding="utf-8")
        cls.guide = GUIDE.read_text(encoding="utf-8")

    def test_updates_only_main_without_destroying_changes(self):
        self.assertIn("$branch -ne 'main'", self.script)
        self.assertIn("git -C $repo status --porcelain", self.script)
        self.assertIn("git -C $repo pull --ff-only origin main", self.script)
        self.assertIn("$branch -ne 'main' -and -not $PreviewBranch", self.script)
        self.assertIn("$PreviewBranch -and -not $SkipUpdate", self.script)
        self.assertIn("'Glauka-Android-preview-'", self.script)
        self.assertNotIn("git reset --hard", self.script)
        self.assertNotIn("git clean -fd", self.script)

    def test_stages_fresh_editor_outside_checkout(self):
        self.assertIn("'scripts/release/prepare.py' 'android' $stage", self.script)
        self.assertIn("$stage.StartsWith($repo +", self.script)
        self.assertIn("'Glauka-Android-Stage-'", self.script)
        self.assertIn("'app\\build\\outputs\\apk\\debug\\app-debug.apk'", self.script)

    def test_pinned_gradle_and_integrity(self):
        self.assertIn("gradle-8.9-bin.zip", self.script)
        self.assertIn(
            "d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab",
            self.script,
        )
        self.assertIn("Get-FileHash -Path $zip -Algorithm SHA256", self.script)
        self.assertIn("if ($actual -ne $gradleHash)", self.script)
        self.assertIn(":app:assembleDebug", self.script)

    def test_stabilization_gate_mandatory_without_switch(self):
        # The historical -RunTests switch is harmless but must never gate tests.
        self.assertNotIn("if ($RunTests) {", self.script)
        self.assertIn("Step 'Test JavaScript obbligatori", self.script)
        self.assertIn("& $npm test", self.script)
        self.assertIn("':app:testDebugUnitTest' ':app:assembleDebug'", self.script)
        self.assertIn("verified_native_java_tests(Path(sys.argv[1]))", self.script)
        self.assertLess(self.script.index("& $npm test"),
                        self.script.index("'scripts/release/prepare.py'"))
        self.assertLess(self.script.index("':app:testDebugUnitTest'"),
                        self.script.index("verified_native_java_tests(Path(sys.argv[1]))"))
        self.assertLess(self.script.index("verified_native_java_tests(Path(sys.argv[1]))"),
                        self.script.index("Copy-Item -LiteralPath $built"))
        self.assertIn("$revisionAfter -ne $revisionFull", self.script)
        self.assertIn("$dirtyAfter", self.script)
        self.assertIn("if ($sha -ne [string]$verifiedIdentity.sha256)", self.script)
        self.assertIn("$final + '.partial'", self.script)

    def test_platform_and_output_requirements(self):
        self.assertIn("platforms\\android-35\\android.jar", self.script)
        self.assertIn("Android\\Android Studio\\jbr", self.script)
        self.assertIn("WriteAllText", self.script)
        self.assertIn("Glauka-Android-main-", self.script)
        self.assertIn("Glauka-APK", self.script)
        self.assertIn("glauka-apk-build.log", self.script)
        self.assertIn("'.sha256.txt'", self.script)
        self.assertNotIn("GitHub Actions", self.script.split("\n", 3)[-1])

    def test_documentation_explains_prerequisites_and_output(self):
        for token in (
            "Android Studio",
            "Android 15 / API 35",
            "build_android_local.ps1",
            "prepare.py android",
            "app-debug.apk",
            "Glauka-APK",
            "debug",
        ):
            self.assertIn(token, self.guide)


if __name__ == "__main__":
    unittest.main()
