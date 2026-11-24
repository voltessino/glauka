"""Deterministic, monotonically ordered macOS CFBundleVersion from versions.json.

macOS short versions follow MAJOR.MINOR.PATCH. CFBundleVersion is a numeric
build counter and cannot be a prerelease string. Leave room between alpha,
beta, rc and final for upgrades, including replacing an RC with final.
"""
import re


def macos_bundle_build(version: str) -> str:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?", version)
    if not match:
        raise ValueError(f"Unsupported macOS release version: {version!r}")
    major, minor, patch = (int(match.group(i)) for i in (1, 2, 3))
    channel, sequence = match.group(4), match.group(5)
    if not (0 <= major <= 99 and 0 <= minor <= 99 and 0 <= patch <= 99):
        raise ValueError("macOS release version components out of range")
    index = int(sequence) if sequence is not None else 0
    if index >= 1000 or (channel and index == 0):
        raise ValueError("macOS prerelease index out of range")
    channel_base = {None: 9000, "alpha": 0, "beta": 1000, "rc": 3000}[channel]
    return str(major * 100_000_000 + minor * 1_000_000 + patch * 10_000
               + channel_base + index)
