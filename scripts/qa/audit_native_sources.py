#!/usr/bin/env python3
"""Run native Java/Go QA locally (no GitHub Actions, no changes to user data)."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
GO = ROOT / "apps/desktop-shared/src"
ANDROID = ROOT / "apps/android/native"
JAVA = ANDROID / "app/src/main/java/it/neuromap/architect/preview"


def source_inventory():
    go = sorted((ROOT / "apps/desktop-shared/src").rglob("*.go"))
    go += sorted((ROOT / "apps/windows/installer").rglob("*.go"))
    java = sorted(ANDROID.rglob("*.java"))
    return {"go": go, "java": java}


def run_step(name, argv, cwd, report, env=None, timeout=900):
    entry = {"name": name, "command": argv, "cwd": str(cwd)}
    if not shutil.which(argv[0]):
        entry.update(status="FAIL", reason="Required command not installed")
        report["steps"].append(entry)
        return
    try:
        completed = subprocess.run(
            argv, cwd=cwd, env=env, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout, check=False,
        )
        entry["status"] = "PASS" if completed.returncode == 0 else "FAIL"
        entry["exit_code"] = completed.returncode
        # Keep output in the local report, never submit build logs to GitHub.
        entry["stdout_tail"] = completed.stdout[-8000:]
        entry["stderr_tail"] = completed.stderr[-8000:]
    except subprocess.TimeoutExpired:
        entry.update(status="FAIL", reason=f"Timed out after {timeout}s")
    except OSError as error:
        entry.update(status="FAIL", reason=str(error))
    report["steps"].append(entry)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=ROOT / "native-audit-report.json")
    parser.add_argument("--skip-cross", action="store_true", help="Skip Go Windows/macOS cross-compilation")
    parser.add_argument("--race", action="store_true", help="Run Go race-detector tests (requires a supported C toolchain)")
    parser.add_argument("--android-build", action="store_true", help="Also run Android local Gradle tests and debug APK build (requires Gradle and Android SDK)")
    args = parser.parse_args()
    sources = source_inventory()
    report = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "inventory": {
            "go_files": len(sources["go"]), "java_files": len(sources["java"]),
            "go_lines": sum(len(p.read_text(encoding="utf-8").splitlines()) for p in sources["go"]),
            "java_lines": sum(len(p.read_text(encoding="utf-8").splitlines()) for p in sources["java"]),
        },
        "steps": [],
        "notes": [
            "Static checks and compilation do not certify runtime correctness.",
            "Windows/macOS cross-compilation produces binaries but does not execute them.",
            "No GitHub Actions, repository push, release packaging, or user project data writes.",
        ],
    }
    with tempfile.TemporaryDirectory(prefix="glauka-native-qa-") as temporary:
        out = Path(temporary)
        run_step("go-test", ["go", "test", "-count=1", "./..."], GO, report)
        run_step("go-vet", ["go", "vet", "./..."], GO, report)
        if args.race:
            run_step("go-race", ["go", "test", "-race", "-count=1", "./..."], GO, report, timeout=1200)
        if not args.skip_cross:
            for target in ("windows", "darwin"):
                env = dict(os.environ, GOOS=target, GOARCH="amd64", CGO_ENABLED="0")
                run_step(f"go-cross-{target}",
                         ["go", "test", "-c", "-o", str(out / ("glauka-test-" + target)), "."],
                         GO, report, env)
        java_files = [JAVA / name for name in (
            "AndroidAiHostPolicy.java", "AndroidAssetPolicy.java",
            "AndroidAiJobLimiter.java")]
        run_step("javac-pure-native-policies",
                 ["javac", "-d", str(out), *map(str, java_files)], ROOT, report)
        if args.android_build:
            command = shutil.which("gradle")
            if command is None:
                report["steps"].append({
                    "name": "android-gradle", "status": "FAIL",
                    "reason": "Android build requested but local Gradle is not installed",
                })
            else:
                run_step("android-gradle",
                         [command, "--no-daemon", "testDebugUnitTest", "assembleDebug"],
                         ANDROID, report, timeout=1800)
    report_path = args.report.resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    for step in report["steps"]:
        print(f"{step['status']:4}  {step['name']}")
    print(f"Audit report: {report_path}")
    if any(x["status"] == "FAIL" for x in report["steps"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
