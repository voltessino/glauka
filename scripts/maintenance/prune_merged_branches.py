#!/usr/bin/env python3
"""Review and optionally prune *verified* merged NeuroMap branches via GitHub REST.

Dry-run by default. Never launches GitHub Actions. Requires an owner-scoped token
in GH_TOKEN or GITHUB_TOKEN. Only deletes refs that are merged/ancestor and
unchanged since review. Preserves distribution and exceptional branches.
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_REPO = "voltessino/neuromap-android"
CONFIRM = "DELETE-REVIEWED-BRANCHES"
PRESERVE = {"main", "macos-private-preview", "feat/desktop-spacing-images-links"}
PRESERVE_PREFIX = ("downloads/", "download/", "backup/", "archive/", "release/", "safety/", "build/")


def api(repo, token, path, method="GET"):
    url = f"https://api.github.com/repos/{repo}/{path}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "NeuroMap-safe-branch-audit"}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers, method=method), timeout=25) as response:
        return json.load(response) if method != "DELETE" else None


def pages(repo, token, path):
    output = []
    for page in range(1, 21):
        sep = "&" if "?" in path else "?"
        batch = api(repo, token, path + sep + f"per_page=100&page={page}")
        output.extend(batch)
        if len(batch) < 100:
            return output
    raise RuntimeError("Pagination limit reached; refusing incomplete audit")


def decide(repo, token, branch, pull_requests, default):
    name = branch["name"]
    if name == default or name in PRESERVE or name.startswith(PRESERVE_PREFIX) or branch.get("protected"):
        return False, "protected / distribution / backup / exception"
    # Even merged ancestors may be referenced by an open PR: preserve them.
    if any(name in ((p.get("head") or {}).get("ref"), (p.get("base") or {}).get("ref"))
           for p in pull_requests if p.get("state") == "open"):
        return False, "referenced by an open pull request"
    try:
        comparison = api(
            repo, token,
            f"compare/{urllib.parse.quote(default, safe='')}...{urllib.parse.quote(name, safe='')}"
        )
        if comparison.get("ahead_by") == 0 and comparison.get("status") in ("behind", "identical"):
            return True, "verified ancestor of default branch"
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        return False, "comparison unavailable: manual review required"
    # A squashed/rebased PR may contain still-exclusive commits. Never
    # auto-prune those, even when the PR itself is marked merged.
    return False, "unique commits: manual review required"



def approved_refs(path):
    """Require an explicit, independently reviewed branch + exact SHA allowlist."""
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise RuntimeError("Cannot read approved branches JSON") from error
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("Approval file must be a nonempty JSON list")
    approved = set()
    for row in rows:
        if (not isinstance(row, dict) or not isinstance(row.get("branch"), str)
                or not row["branch"] or not isinstance(row.get("sha"), str)
                or not re.fullmatch(r"[0-9a-fA-F]{40}", row["sha"])):
            raise RuntimeError("Each approval needs an exact branch and 40-character SHA")
        pair = (row["branch"], row["sha"].lower())
        if pair in approved:
            raise RuntimeError("Duplicate branch approval: " + row["branch"])
        approved.add(pair)
    return approved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--apply", action="store_true", help="Actually delete eligible refs")
    parser.add_argument("--confirm", default="", help="Required with --apply: " + CONFIRM)
    parser.add_argument("--approved-file", type=Path, default=None,
                        help="Explicit JSON list of individually approved {branch, sha} pairs")
    parser.add_argument("--json-report", type=Path, default=None,
                        help="Export a dry-run review JSON to an explicit path outside the checkout")
    args = parser.parse_args()
    if args.apply and args.confirm != CONFIRM:
        parser.error("Deletion requires --apply --confirm " + CONFIRM)
    if args.apply and args.approved_file is None:
        parser.error("Deletion requires --approved-file with exact branch SHA pairs")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        parser.error("Set GH_TOKEN/GITHUB_TOKEN locally; never paste the token into chat")
    repo_info = api(args.repo, token, "")
    default = repo_info["default_branch"]
    branches = pages(args.repo, token, "branches")
    prs = pages(args.repo, token, "pulls?state=open")
    accepted, held = [], []
    review = []
    for branch in branches:
        approved, reason = decide(args.repo, token, branch, prs, default)
        print(f"{'CANDIDATE' if approved else 'KEEP':10} {branch['name']:<48} {branch['commit']['sha'][:12]}  {reason}")
        review.append({"branch": branch["name"], "sha": branch["commit"]["sha"],
                       "candidate": approved, "reason": reason})
        (accepted if approved else held).append(branch)
    print(f"\n{len(accepted)} eligible / {len(held)} preserved. "
          + ("Applying explicit deletion." if args.apply else "DRY RUN: NO CHANGES."))
    if args.json_report:
        payload = {"repository": args.repo, "base": default, "dry_run": not args.apply,
                   "total": len(review), "candidates": len(accepted),
                   "preserved": len(held), "branches": review}
        args.json_report.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                                    encoding="utf-8")
        print(f"Review report saved: {args.json_report}")
    if not args.apply:
        return
    approvals = approved_refs(args.approved_file)
    candidates = {(b["name"], b["commit"]["sha"].lower()) for b in accepted}
    unknown = approvals - candidates
    if unknown:
        raise RuntimeError("Approval is stale, protected or not a verified ancestor: " +
                           ", ".join(sorted(name for name, _ in unknown)))
    for branch in accepted:
        name = branch["name"]
        if (name, branch["commit"]["sha"].lower()) not in approvals:
            continue
        encoded = urllib.parse.quote(name, safe="/")
        current = api(args.repo, token, "git/ref/heads/" + encoded)
        if current["object"]["sha"] != branch["commit"]["sha"]:
            raise RuntimeError(f"{name} changed since audit; stopping without deleting it")
        api(args.repo, token, "git/refs/heads/" + encoded, method="DELETE")
        print(f"Deleted verified merged branch: {name}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError) as error:
        print(f"Stopped safely: {error}", file=sys.stderr)
        sys.exit(1)
