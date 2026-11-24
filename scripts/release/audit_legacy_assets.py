#!/usr/bin/env python3
"""Read-only verification of the seven archived Glauka source packages.

The packages are intentionally no longer part of active main. Their exact
Git blobs remain reachable through sourceCommit in the repository history.
Requires a full local clone; a shallow clone must fetch its history first.
No GitHub Actions, deletion, archive extraction or network access.
"""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/maintenance/legacy-source-archives.json"
ACTIVE_ASSETS = ("apps/website/media/glauka-feature-tour.mp4",)
HEX40 = re.compile(r"[0-9a-f]{40}\Z")


def validate_manifest(data):
    if not isinstance(data, dict) or data.get("formatVersion") != 1:
        raise ValueError("Invalid historical archive manifest")
    commit = data.get("sourceCommit")
    if not isinstance(commit, str) or not HEX40.fullmatch(commit):
        raise ValueError("Invalid source commit")
    files = data.get("archives")
    if not isinstance(files, list) or len(files) != 7:
        raise ValueError("Expected exactly seven archived files")
    paths = set()
    for item in files:
        if not isinstance(item, dict):
            raise ValueError("Invalid archived file entry")
        name, sha, size = item.get("path"), item.get("blobSha"), item.get("bytes")
        if (not isinstance(name, str) or "/legacy/" not in name
                or name.startswith("/") or "\\" in name
                or any(part in ("", ".", "..") for part in name.split("/"))
                or not name.endswith((".zip", ".zip.b64", ".tar.gz.b64"))
                or name in paths or not isinstance(sha, str)
                or not HEX40.fullmatch(sha)
                or isinstance(size, bool) or not isinstance(size, int) or size < 0):
            raise ValueError("Unsafe or duplicated historical archive entry")
        paths.add(name)
    if sum(item["bytes"] for item in files) != data.get("totalBytes"):
        raise ValueError("Archive byte total does not match")
    return files


def git(root, *args):
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", check=False)


def verify_archive(root, commit, item, runner=git):
    path, sha, size = item["path"], item["blobSha"], item["bytes"]
    historical = runner(root, "ls-tree", commit, "--", path)
    expected = "100644 blob " + sha + "\t" + path
    if historical.returncode or historical.stdout.rstrip("\n") != expected:
        return False, "historical path/blob mismatch or missing shallow history"
    actual = runner(root, "cat-file", "-s", sha)
    if actual.returncode or actual.stdout.strip() != str(size):
        return False, "historical blob missing or size mismatch"
    tracked = runner(root, "ls-files", "--", path)
    if tracked.returncode or tracked.stdout.strip():
        return False, "archive is still tracked in the active checkout"
    return True, "available in Git history"


def audit(root=ROOT, manifest=MANIFEST, runner=git, output=print):
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        files = validate_manifest(data)
    except (ValueError, OSError, TypeError) as error:
        output("ERROR: archive manifest invalid: " + str(error))
        return 2
    failures = 0
    for item in files:
        ok, message = verify_archive(root, data["sourceCommit"], item, runner)
        output(("OK" if ok else "ERROR") + ": " + item["path"] + " — " + message)
        failures += not ok
    for asset in ACTIVE_ASSETS:
        if not (root / asset).is_file():
            output("ERROR: active site asset missing: " + asset)
            failures += 1
    if failures:
        output("Archive check failed. For shallow clones, fetch the complete Git history.")
    else:
        output("All 7 archives are recoverable from Git history. No files changed.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(audit())
