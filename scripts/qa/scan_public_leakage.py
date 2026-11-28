#!/usr/bin/env python3
"""Fail-closed scan for personal paths, secrets, and private-repo leaks.

Modes:
  private — block personal home paths and high-confidence secrets (any checkout).
  public  — also block private monorepo download URLs / Developer private artifacts.

Never prints matched secret values; reports path + category only.
Untracked binary blobs are skipped by extension. Reports must stay outside Git
when written with --report.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKIP_DIR_NAMES = {
    ".git", "node_modules", ".venv", "__pycache__", "test-results",
    "playwright-report", "artifacts", "build", ".gradle", "dist",
}
SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".mp4", ".webm",
    ".woff", ".woff2", ".ttf", ".otf", ".pdf", ".zip", ".7z", ".rar",
    ".exe", ".dmg", ".apk", ".aab", ".msi", ".msix", ".jar", ".class",
    ".pyc", ".so", ".dll", ".dylib", ".bin", ".sqlite", ".db",
}
TEXT_SUFFIXES = {
    ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".json", ".md", ".txt",
    ".py", ".go", ".java", ".kt", ".gradle", ".xml", ".html", ".css",
    ".yml", ".yaml", ".toml", ".ini", ".cfg", ".ps1", ".sh", ".command",
    ".vtt", ".csv", ".svg", ".properties", ".gitignore", ".npmrc",
}

# Fixture / documentation placeholders that are intentionally not personal.
HOME_ALLOW = frozenset({
    "qa", "test", "person", "me", "example", "user", "runner", "admin",
    "ubuntu", "linux", "macos", "windows", "you", "someone", "account",
    "agent", "private", "exampleaccount", "nome", "tuo-nome", "alice",
})

# Capture only plausible account folder names (no dots/files, no regex debris).
PERSONAL_WIN = re.compile(
    r"(?i)(?:^|[^A-Za-z0-9_])(?:[A-Za-z]:)?[\\/]Users[\\/]([A-Za-z][A-Za-z0-9_-]{2,40})(?=[\\/\s\"'`\)]|$)"
)
PERSONAL_UNIX = re.compile(
    r"(?i)(?:^|[^A-Za-z0-9_])/Users/([A-Za-z][A-Za-z0-9_-]{2,40})(?=[/\s\"'`\)]|$)"
)
PERSONAL_HOME = re.compile(
    r"(?i)(?:^|[^A-Za-z0-9_])/home/([A-Za-z][A-Za-z0-9_-]{2,40})(?=[/\s\"'`\)]|$)"
)

SECRET_PATTERNS = {
    "private-key-header": re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"),
    "github-token": re.compile(r"\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{30,}\b"),
    "openai-api-key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{25,}\b"),
    "google-api-key": re.compile(r"\bAIza[A-Za-z0-9_-]{35}\b"),
    "aws-access-key-id": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
}

PUBLIC_LEAK_PATTERNS = {
    "private-download-url": re.compile(
        r"github\.com/voltessino/neuromap-android/(?:blob|tree)/downloads/",
        re.I,
    ),
    "private-developer-artifact": re.compile(
        r"(?:NeuroMap-Architect-.*-Developer\.(?:exe|dmg|zip)|"
        r"Glauka-Android-.*-private\.(?:apk|zip))",
        re.I,
    ),
    "private-raw-download": re.compile(
        r"neuromap-android/blob/downloads/[^)\s]+raw=true",
        re.I,
    ),
}

# Files that may discuss the private monorepo by name without download URLs.
# Still scanned for personal paths / secrets / download URLs.
SELF_SCANNER = "scripts/qa/scan_public_leakage.py"
SELF_TEST = "scripts/qa/test_scan_public_leakage.py"


def outside_repo(path: Path, root: Path) -> Path:
    resolved = path.expanduser().resolve()
    if resolved == root or root in resolved.parents:
        raise ValueError("Leakage reports must be stored outside the Git checkout")
    return resolved


def iter_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        try:
            rel_parts = path.relative_to(root).parts
        except ValueError:
            continue
        if any(part in SKIP_DIR_NAMES for part in rel_parts):
            continue
        if path.suffix.lower() in SKIP_SUFFIXES and path.suffix.lower() not in {".svg"}:
            continue
        yield path


def _is_test_fixture_path(rel: str) -> bool:
    name = Path(rel).name
    parts = Path(rel).parts
    if "tests" in parts or "test" in parts:
        return True
    if name.startswith("test_") or name.endswith("_test.py") or name.endswith("_test.go"):
        return True
    if name.endswith(".test.js") or name.endswith(".test.cjs") or name.endswith(".spec.js"):
        return True
    return False


def home_user_ok(name: str) -> bool:
    cleaned = name.strip().strip("\"'`")
    if not cleaned or cleaned in {".", ".."}:
        return True
    if cleaned.lower() in HOME_ALLOW:
        return True
    # UUID / machine placeholders
    if re.fullmatch(r"[0-9a-f-]{8,}", cleaned, re.I):
        return True
    return False


def find_personal_homes(text: str) -> list[str]:
    hits = []
    for pattern in (PERSONAL_WIN, PERSONAL_UNIX, PERSONAL_HOME):
        for match in pattern.finditer(text):
            user = match.group(1)
            if not home_user_ok(user):
                hits.append(user)
    return hits


def scan_text(rel: str, text: str, mode: str, *, tree_scan: bool = False) -> list[dict]:
    findings = []
    self_doc = rel in {SELF_SCANNER, SELF_TEST}
    # Tree scans skip intentional examples inside the scanner/tests; unit tests
    # still call find_personal_homes / scan_text(..., tree_scan=False) directly.
    if not (tree_scan and self_doc):
        for user in find_personal_homes(text):
            findings.append({"path": rel, "category": "personal-home-path", "detail": user})
    if not (tree_scan and self_doc):
        for category, pattern in SECRET_PATTERNS.items():
            if category == "private-key-header" and _is_test_fixture_path(rel):
                # Tests may assert on the header string without embedding a real key.
                continue
            if pattern.search(text):
                findings.append({"path": rel, "category": category, "detail": ""})
    if mode == "public" and not self_doc:
        for category, pattern in PUBLIC_LEAK_PATTERNS.items():
            if pattern.search(text):
                findings.append({"path": rel, "category": category, "detail": ""})
    # Deduplicate
    seen = set()
    out = []
    for item in findings:
        key = (item["path"], item["category"], item["detail"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def scan_tree(root: Path, mode: str) -> list[dict]:
    findings: list[dict] = []
    for path in iter_files(root):
        rel = path.relative_to(root).as_posix()
        suffix = path.suffix.lower()
        if suffix and suffix not in TEXT_SUFFIXES and path.name not in {
            "AGENTS.md", "README", "LICENSE", "CLA.md", "TRADEMARK.md",
            "Dockerfile", "Makefile",
        }:
            # Extensionless or unusual: still try small text files
            try:
                if path.stat().st_size > 1_500_000:
                    continue
            except OSError:
                continue
        try:
            if path.stat().st_size > 2_000_000:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        findings.extend(scan_text(rel, text, mode, tree_scan=True))
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode", choices=("private", "public"), default="private",
        help="private: PII/secrets. public: also private monorepo download leaks.",
    )
    parser.add_argument(
        "--root", type=Path, default=None,
        help="Tree to scan (default: this repository). Use export output for public gate.",
    )
    parser.add_argument("--report", type=Path, default=None,
                        help="Optional JSON report path outside the checkout.")
    args = parser.parse_args(argv)
    root = (args.root or ROOT).resolve()
    if not root.is_dir():
        print(f"Leakage scan: root not found: {root}", file=sys.stderr)
        return 2
    findings = scan_tree(root, args.mode)
    if args.report:
        report = outside_repo(args.report, ROOT)
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps({
            "mode": args.mode,
            "root": str(root),
            "findings": findings,
        }, indent=2) + "\n", encoding="utf-8")
    if findings:
        print(f"Leakage scan FAIL ({args.mode}): {len(findings)} finding(s)")
        for item in findings[:40]:
            detail = f" user={item['detail']}" if item["detail"] else ""
            print(f"  - {item['category']}: {item['path']}{detail}")
        if len(findings) > 40:
            print(f"  … {len(findings) - 40} more")
        return 1
    print(f"Leakage scan PASS ({args.mode}): no personal paths, secrets, or blocked leaks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
