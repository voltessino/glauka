#!/usr/bin/env python3
"""Review committed Git history for high-confidence secrets without printing values.

Read only: no GitHub Actions, commits or network access. The output contains
commit IDs, file paths and finding categories, never matched credentials.
Findings require human triage: a sample fixture is not a proven leaked secret.
Uncommitted working-tree files and binary contents are not scanned.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
MARKER = "GLAUKA_AUDIT_COMMIT "
SENSITIVE_FILES = re.compile(r"(?i)\.(?:jks|keystore|p12|pfx|p8|pem|key)$")
PATTERNS = {
    "private-key-header": re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"),
    "github-token": re.compile(r"\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{30,}\b"),
    "openai-api-key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{25,}\b"),
    "google-api-key": re.compile(r"\bAIza[A-Za-z0-9_-]{35}\b"),
    "aws-access-key-id": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
}


def outside_repo(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError("Secret scan reports must be stored outside the Git checkout")
    return resolved


def redact_path(value: str) -> str:
    """Hide any credential-like material accidentally present in file names."""
    for pattern in PATTERNS.values():
        value = pattern.sub("[REDACTED]", value)
    return value


def inspect_patch(lines):
    """Yield deduplicated redacted findings from git-log --patch text."""
    commit = ""
    current = ""
    seen = set()
    for line in lines:
        if line.startswith(MARKER):
            commit = line[len(MARKER):].strip().split()[0]
            current = ""
            continue
        if line.startswith("+++ b/"):
            current = redact_path(line[6:].rstrip("\n"))
            if SENSITIVE_FILES.search(current):
                key = (commit, current, "sensitive-file-in-history")
                if key not in seen:
                    seen.add(key)
                    yield {"commit": commit, "path": current,
                           "category": "sensitive-file-in-history"}
            continue
        if not current or not line.startswith("+") or line.startswith("+++"):
            continue
        added = line[1:]
        for category, pattern in PATTERNS.items():
            if pattern.search(added):
                key = (commit, current, category)
                if key not in seen:
                    seen.add(key)
                    yield {"commit": commit, "path": current, "category": category}


def scan_history():
    command = [
        "git", "-c", "core.quotepath=false", "log", "--all", "--root",
        "--no-color", "--no-ext-diff", "--no-textconv", "--unified=0",
        "--pretty=format:" + MARKER + "%H%n", "--patch",
        "--", ".", ":(exclude)scripts/qa/test_scan_git_secrets.py",
    ]
    try:
        process = subprocess.Popen(command, cwd=ROOT, text=True,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL,
                                   errors="replace")
    except OSError as err:
        raise RuntimeError("Cannot start local Git history audit") from err
    assert process.stdout is not None
    try:
        findings = list(inspect_patch(process.stdout))
    finally:
        process.stdout.close()
    if process.wait() != 0:
        raise RuntimeError("Git history audit did not complete successfully")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path,
                        help="Optional JSON report path outside the repository")
    args = parser.parse_args()
    try:
        findings = scan_history()
        report = {
            "scope": "git log --all --root --patch; committed textual additions only",
            "binaryContentScanned": False,
            "uncommittedFilesScanned": False,
            "findings": findings,
            "requiresManualReview": bool(findings),
        }
        if args.report:
            output = outside_repo(args.report)
            output.parent.mkdir(parents=True, exist_ok=True)
            if output.exists():
                raise ValueError("Report already exists; refusing to overwrite")
            with output.open("x", encoding="utf-8") as stream:
                json.dump(report, stream, indent=2)
                stream.write("\n")
        print("Git history secrets review: " + str(len(findings)) + " suspicious file/category combinations")
        for entry in findings:
            print(entry["commit"][:12] + "  " + entry["path"] + "  " + entry["category"])
        if findings:
            print("Review findings manually; do not paste credentials into issues or logs.")
        return 0 if not findings else 2
    except (OSError, ValueError, RuntimeError) as err:
        print("Git secret scan failed: " + type(err).__name__, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
