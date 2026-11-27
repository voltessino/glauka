#!/usr/bin/env python3
"""Synchronize every tracked version reference from versions.json (single source of truth).

Edit versions.json once, then run `python scripts/release/sync_versions.py` (or `--check`).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import plistlib
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from macos_version import macos_bundle_build  # noqa: E402


def windows_numeric_parts(version: str) -> dict[str, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?", version)
    if not match:
        raise ValueError(f"Invalid version string: {version!r}")
    numeric = [int(v) for v in match.groups()[:3]]
    suffix = match.group(4) or ""
    numeric.append(int(suffix.rsplit(".", 1)[-1]) if re.search(r"\.\d+$", suffix) else 0)
    if any(v > 65535 for v in numeric):
        raise ValueError(f"Windows version component out of range: {version!r}")
    return dict(zip(("Major", "Minor", "Patch", "Build"), numeric))


def _update_text(path: Path, expected: str, *, check: bool, changed: list[Path]) -> None:
    current = path.read_text(encoding="utf-8")
    if current != expected:
        changed.append(path)
        if not check:
            path.write_text(expected, encoding="utf-8", newline="\n")


def _update_sig_text(path: Path, expected: str, *, check: bool, changed: list[Path]) -> None:
    current = path.read_text(encoding="utf-8-sig")
    if current != expected:
        changed.append(path)
        if not check:
            path.write_text(expected, encoding="utf-8-sig", newline="\n")


def _replace_once(pattern: str, repl: str, text: str, label: str) -> str:
    updated, count = re.subn(pattern, repl, text)
    if count != 1:
        raise ValueError(f"Expected 1 match for {label}, found {count}")
    return updated


def sync_versions(root: Path = ROOT, *, check: bool = False) -> list[Path]:
    manifest = json.loads((root / "versions.json").read_text(encoding="utf-8"))
    editor_ver = str(manifest["editor"])
    win_ver = str(manifest["windows"]["version"])
    mac_ver = str(manifest["macos"]["version"])
    android_ver = str(manifest["android"]["version"])
    win_parts = windows_numeric_parts(win_ver)
    changed: list[Path] = []

    # Normalize derived fields inside versions.json itself when editor/desktop changes.
    desired_manifest = dict(manifest)
    desired_manifest["android"] = dict(manifest["android"])
    desired_manifest["android"]["mobile_tools"] = f"{editor_ver} offline preview"
    desired_manifest["android"]["shared_modules_version"] = editor_ver
    _update_text(
        root / "versions.json",
        json.dumps(desired_manifest, indent=2, ensure_ascii=False) + "\n",
        check=check,
        changed=changed,
    )

    pkg_path = root / "package.json"
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    pkg["version"] = editor_ver
    _update_text(
        pkg_path,
        json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
        check=check,
        changed=changed,
    )

    lock_path = root / "package-lock.json"
    if lock_path.is_file():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        lock["version"] = editor_ver
        if isinstance(lock.get("packages"), dict) and isinstance(lock["packages"].get(""), dict):
            lock["packages"][""]["version"] = editor_ver
        _update_text(
            lock_path,
            json.dumps(lock, indent=2, ensure_ascii=False) + "\n",
            check=check,
            changed=changed,
        )

    for rel, ver in (
        ("apps/desktop-shared/editor/shell-dictionary.js", win_ver),
        ("apps/android/editor/shell-dictionary.js", android_ver),
    ):
        p = root / rel
        body = _replace_once(
            r"(?m)^const NM_PRODUCT_VERSION='[^']*';$",
            f"const NM_PRODUCT_VERSION='{ver}';",
            p.read_text(encoding="utf-8"),
            rel,
        )
        _update_text(p, body, check=check, changed=changed)

    desktop_files = root / "apps/desktop-shared/src/desktop_files.go"
    _update_text(
        desktop_files,
        _replace_once(
            r'(?m)^(var xmindCreatorVersion = )"[^"]*"$',
            rf'\g<1>"{win_ver}"',
            desktop_files.read_text(encoding="utf-8"),
            "desktop_files.go",
        ),
        check=check,
        changed=changed,
    )

    store_dist = root / "apps/desktop-shared/src/store_distribution.go"
    _update_text(
        store_dist,
        _replace_once(
            r'report\["releaseNotes"\] = "Glauka [0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.+-]+)? ',
            f'report["releaseNotes"] = "Glauka {win_ver} ',
            store_dist.read_text(encoding="utf-8"),
            "store_distribution.go",
        ),
        check=check,
        changed=changed,
    )

    for rel in (
        "apps/desktop-shared/src/versioninfo.json",
        "apps/windows/installer/versioninfo.json",
    ):
        vp = root / rel
        meta = json.loads(vp.read_text(encoding="utf-8"))
        for key in ("FileVersion", "ProductVersion"):
            meta["FixedFileInfo"][key] = dict(win_parts)
            meta["StringFileInfo"][key] = win_ver
        _update_text(
            vp,
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
            check=check,
            changed=changed,
        )

    ui_ps1 = root / "apps/windows/installer/install_ui.ps1"
    ui_txt = _replace_once(
        r"(?m)^(\$script:installerVersion=)'[^']*'$",
        rf"\g<1>'{win_ver}'",
        ui_ps1.read_text(encoding="utf-8-sig"),
        "install_ui.ps1 assignment",
    )
    ui_txt = _replace_once(
        r'Text="\d+\.\d+\.\d+(?:-[0-9A-Za-z.+-]+)?"',
        f'Text="{win_ver}"',
        ui_txt,
        "install_ui.ps1 XAML label",
    )
    _update_sig_text(ui_ps1, ui_txt, check=check, changed=changed)

    inst_go = root / "apps/windows/installer/main.go"
    _update_text(
        inst_go,
        _replace_once(
            r"Glauka-Installer-[0-9A-Za-z.+-]+\.log",
            f"Glauka-Installer-{win_ver}.log",
            inst_go.read_text(encoding="utf-8"),
            "installer/main.go",
        ),
        check=check,
        changed=changed,
    )

    plist_path = root / "apps/macos/native/Info.plist"
    raw_plist = plist_path.read_bytes()
    info = plistlib.loads(raw_plist)
    info["GlaukaReleaseVersion"] = mac_ver
    info["CFBundleShortVersionString"] = mac_ver.split("-", 1)[0]
    info["CFBundleVersion"] = macos_bundle_build(mac_ver)
    new_plist = plistlib.dumps(info)
    if plistlib.loads(raw_plist) != plistlib.loads(new_plist):
        changed.append(plist_path)
        if not check:
            plist_path.write_bytes(new_plist)

    rel_cfg = root / "apps/website/release-config.js"
    if rel_cfg.is_file():
        cfg = rel_cfg.read_text(encoding="utf-8")
        cfg = _replace_once(
            r"(/\* Public Glauka )\d+\.\d+\.\d+( desktop and Android Free )\d+\.\d+\.\d+( APK downloads\.)",
            rf"\g<1>{win_ver}\g<2>{android_ver}\g<3>",
            cfg,
            "release-config banner",
        )
        cfg = _replace_once(
            r'(windows:\s*Object\.freeze\(\{\s*channel:\s*"public",\s*version:\s*)"[^"]*"(,\s*url:\s*)"https://github\.com/voltessino/glauka/releases/download/v[^/]+/Glauka-Setup-[^"]*-Release\.exe"',
            rf'\g<1>"{win_ver}"\g<2>"https://github.com/voltessino/glauka/releases/download/v{win_ver}/Glauka-Setup-{win_ver}-Release.exe"',
            cfg,
            "release-config windows",
        )
        cfg = _replace_once(
            r'(macos:\s*Object\.freeze\(\{\s*channel:\s*"public",\s*version:\s*)"[^"]*"(,\s*presentation:\s*"beta",\s*url:\s*)"https://glauka\.it/download/Glauka-Mac-[^"]*-Release\.dmg"',
            rf'\g<1>"{mac_ver}"\g<2>"https://glauka.it/download/Glauka-Mac-{mac_ver}-Release.dmg"',
            cfg,
            "release-config macos",
        )
        cfg = _replace_once(
            r'(android:\s*Object\.freeze\(\{\s*channel:\s*"public",\s*version:\s*)"[^"]*"(,\s*url:\s*)"https://github\.com/voltessino/glauka/releases/download/v[^/]+/Glauka-Android-Free-[^"]*-Release\.apk"',
            rf'\g<1>"{android_ver}"\g<2>"https://github.com/voltessino/glauka/releases/download/v{android_ver}/Glauka-Android-Free-{android_ver}-Release.apk"',
            cfg,
            "release-config android",
        )
        _update_text(rel_cfg, cfg, check=check, changed=changed)

    home_js = root / "apps/website/home-review/home.js"
    if home_js.is_file():
        h = home_js.read_text(encoding="utf-8")
        h = _replace_once(
            r'(windows:\s*\{\s*name:\s*"Windows",\s*version:\s*)"[^"]*"(,\s*build:\s*)"[^"]*"',
            rf'\g<1>"{win_ver}"\g<2>"{win_ver}"',
            h,
            "home.js windows",
        )
        h = _replace_once(
            r'(macos:\s*\{\s*name:\s*"macOS",\s*version:\s*)"[^"]*"(,\s*build:\s*)"[^"]*"',
            rf'\g<1>"{mac_ver}"\g<2>"{mac_ver}"',
            h,
            "home.js macos",
        )
        h = _replace_once(
            r'(android:\s*\{\s*name:\s*"Android",\s*version:\s*)"[^"]*"(,\s*build:\s*)"[^"]*"',
            rf'\g<1>"{android_ver}"\g<2>"{android_ver}"',
            h,
            "home.js android",
        )
        _update_text(home_js, h, check=check, changed=changed)

    site_app = root / "apps/website/app.js"
    if site_app.is_file():
        sa = site_app.read_text(encoding="utf-8")
        sa = _replace_once(
            r'"Windows \d+\.\d+\.\d+ si scarica con l’installer Microsoft\. Il Mac è una Beta, fuori dall’App Store\. Android Free \d+\.\d+\.\d+ è un pacchetto firmato pubblico\."',
            f'"Windows {win_ver} si scarica con l’installer Microsoft. Il Mac è una Beta, fuori dall’App Store. Android Free {android_ver} è un pacchetto firmato pubblico."',
            sa,
            "apps/website/app.js",
        )
        _update_text(site_app, sa, check=check, changed=changed)

    return changed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if any tracked file is out of sync with versions.json")
    args = parser.parse_args(argv)
    changed = sync_versions(check=args.check)
    if args.check:
        if changed:
            print("Out of sync with versions.json:")
            for p in changed:
                print(" -", p.relative_to(ROOT))
            return 1
        print("All tracked version references match versions.json.")
        return 0
    if changed:
        print("Synchronized from versions.json:")
        for p in changed:
            print(" -", p.relative_to(ROOT))
    else:
        print("Already synchronized with versions.json.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
