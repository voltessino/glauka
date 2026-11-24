#!/usr/bin/env python3
"""Run the reviewed Android security checks locally, never GitHub Actions.

Quick mode runs scoped source regression tests. --full additionally runs the
existing structure, Node, staged Gradle/JVM and APK debug compilation gates.
--device-tests also requires a connected Android device/emulator. Every
command produces a separate log and a machine-readable summary OUTSIDE Git.
No APK created here is a public/release APK.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MAX_RUN_SECONDS = 45 * 60


def outside_repo(path: Path) -> Path:
    value = path.expanduser().resolve()
    if value == ROOT or ROOT in value.parents or value in ROOT.parents:
        raise ValueError("Select a report directory outside the repository")
    return value


def commands(*, full: bool, device_tests: bool, stage: Path) -> list[tuple[str, list[str], Path]]:
    if device_tests and not full:
        raise ValueError("--device-tests requires --full")
    jobs = [
        ("audit-runner-selftest", [sys.executable, "-m", "unittest", "discover",
             "-s", "scripts/qa", "-p", "test_run_android_security_gate.py", "-v"], ROOT),
        ("redacted-secret-scanner-selftest", [sys.executable, "-m", "unittest", "discover",
             "-s", "scripts/qa", "-p", "test_scan_git_secrets.py", "-v"], ROOT),
        ("android-security-source", ["node", "--test",
             "packages/editor-ui/tests/android-prepublication-security.test.js"], ROOT),
        ("public-apk-policy", [sys.executable, "-m", "unittest", "discover",
             "-s", "scripts/release", "-p", "test_verify_android_public.py", "-v"], ROOT),
        ("issuer-path-policy", [sys.executable, "-m", "unittest", "discover",
             "-s", "scripts/licensing", "-p", "test_issue_paths.py", "-v"], ROOT),
    ]
    if full:
        npm = "npm.cmd" if os.name == "nt" else "npm"
        npx = "npx.cmd" if os.name == "nt" else "npx"
        gradle = "gradle.bat" if os.name == "nt" else "gradle"
        jobs.extend([
            ("structure", [npm, "run", "test:structure"], ROOT),
            ("node-all", [npm, "test"], ROOT),
            ("python-release-suite", [sys.executable, "-m", "unittest",
                 "discover", "-s", "scripts/release", "-p", "test_*.py", "-v"], ROOT),
            ("browser-svg-security", [npx, "playwright", "test", "--config",
                 "playwright.security.config.js"], ROOT),
            ("stage-android", [sys.executable, "scripts/release/prepare.py",
                "android", str(stage)], ROOT),
            ("gradle-android", [gradle, "--no-daemon", "--max-workers=2",
                ":app:testDebugUnitTest", ":app:assembleDebug"], stage),
        ])
    if device_tests:
        gradle = "gradle.bat" if os.name == "nt" else "gradle"
        jobs.append(("android-device", [gradle, "--no-daemon", "--max-workers=2",
                    ":app:connectedDebugAndroidTest"], stage))
    return jobs


def read_git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True,
                                       stderr=subprocess.DEVNULL, timeout=10).strip()
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return "unavailable"


def audit(*, output: Path, full: bool, device_tests: bool) -> int:
    output = outside_repo(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use a new/empty report directory; never overwrite old evidence")
    output.mkdir(parents=True, exist_ok=True)
    stage = output / "android-staged"
    plan = commands(full=full, device_tests=device_tests, stage=stage)
    report = {
        "sourceRevision": read_git("rev-parse", "HEAD"),
        "sourceDirty": bool(read_git("status", "--porcelain")),
        "mode": "device" if device_tests else "full" if full else "quick",
        "publicReleaseReady": False,
        "note": "Checks cover this checkout only. Public signing and cloud OAuth require separate real-device verification.",
        "steps": [],
        "result": "incomplete",
    }

    try:
        for name, argv, cwd in plan:
            logfile = output / (name + ".log")
            step = {"name": name, "command": argv, "log": logfile.name,
                    "status": "not-run"}
            report["steps"].append(step)
            with logfile.open("w", encoding="utf-8") as sink:
                try:
                    outcome = subprocess.run(argv, cwd=cwd, stdout=sink,
                                             stderr=subprocess.STDOUT,
                                             env={**os.environ, "PYTHONUTF8": "1"},
                                             check=False, timeout=MAX_RUN_SECONDS)
                    step["exitCode"] = outcome.returncode
                    step["status"] = "passed" if outcome.returncode == 0 else "failed"
                except (OSError, subprocess.TimeoutExpired) as error:
                    step["status"] = "failed"
                    step["error"] = type(error).__name__
                    sink.write("\nUnable to complete command: " + type(error).__name__ + "\n")
            if step["status"] != "passed":
                report["result"] = "failed"
                break
        else:
            report["result"] = "passed"
    finally:
        (output / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Android security audit: " + report["result"])
    print("Evidence: " + str(output / "report.json"))
    if report["result"] == "passed":
        print("Reminder: quick/full checks do not authorize public APK distribution.")
    return 0 if report["result"] == "passed" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", action="store_true", help="Run Node and Gradle native gates as well")
    parser.add_argument("--device-tests", action="store_true",
                        help="Run instrumentation tests; requires --full and attached device/emulator")
    parser.add_argument("--output", type=Path, help="New report directory outside Git")
    args = parser.parse_args()
    try:
        destination = args.output or Path(tempfile.mkdtemp(prefix="glauka-android-security-"))
        return audit(output=destination, full=args.full, device_tests=args.device_tests)
    except ValueError as error:
        parser.error(str(error))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
