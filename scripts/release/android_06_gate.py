#!/usr/bin/env python3
"""Local-only Android 0.6 preflight. Never launches GitHub Actions."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
def run(cmd, cwd=ROOT) -> None:
    print("+", " ".join(map(str, cmd)), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=ROOT / "apps/android/native",
                        help="Path to staged native Gradle project (after prepare.py android)")
    parser.add_argument("--release", action="store_true",
                        help="Also build signed, minified AAB using external keystore")
    parser.add_argument("--connected", action="store_true",
                        help="Run instrumentation on a locally connected emulator/device")
    parser.add_argument("--format", action="store_true",
                        help="Check Android Java sources with installed google-java-format")
    args = parser.parse_args()
    version = json.loads((ROOT / "versions.json").read_text(encoding="utf-8"))["android"]
    if type(version["version_code"]) is not int or version["version_code"]<1 or not isinstance(version["version"],str) or not version["version"]:
        raise SystemExit("Invalid canonical Android version metadata")
    stage = args.project.resolve()
    if (stage / "versions.json").is_file() and json.loads((stage/"versions.json").read_text())["android"]!=version:
        raise SystemExit("Staged Android version differs from versions.json: prepare a fresh build")
    if not (stage / "versions.json").is_file():
        # Direct builds read ../../../versions.json. Staged builds use root versions.json.
        assert (stage / "../../../versions.json").resolve().is_file()
    if args.format:
        tool = shutil.which("google-java-format")
        if not tool:
            raise SystemExit("Install google-java-format and rerun with --format")
        sources = sorted(str(f) for f in (stage / "app/src").rglob("*.java"))
        run([tool, "--dry-run", "--set-exit-if-changed", *sources])
    run(["node", "--test", "packages/editor-ui/tests/android-release-guard.test.js",
         "packages/editor-ui/tests/shared-module-shadow.test.js"])
    cases = sorted(str(p.relative_to(ROOT)) for p in ROOT.glob("packages/cloud-sync/tests/*.test.js"))
    run(["node", "--test", *cases])
    gradle = shutil.which("gradle") or shutil.which("gradle.bat")
    if not gradle:
        raise SystemExit("Gradle 8.9/JDK17/Android SDK35 required; no native build was run")
    tasks = ["testDebugUnitTest", "assembleDebug"]
    if args.connected:
        tasks.append("connectedDebugAndroidTest")
    if args.release:
        # Gradle refuses unsigned release tasks; no credentials are written here.
        tasks.append("bundleRelease")
    run([gradle, "--no-daemon", *tasks], cwd=stage)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
