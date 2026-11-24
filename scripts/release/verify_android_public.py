#!/usr/bin/env python3
"""Fail-closed public Android APK acceptance gate.

This script never compiles, signs, uploads or publishes an APK. It validates a
previously assembled production APK using Android SDK Build Tools (aapt and
apksigner). A private/debug build cannot pass by relabelling its filename.

Set GLAUKA_PUBLIC_ANDROID_CERT_SHA256 to the official *public* production
signing-certificate digest. Never pass signing key passwords to this command.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SHA256 = re.compile(r"^[0-9a-f]{64}$")
CERT = re.compile(r"Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]{64})")
PACKAGE = re.compile(
    r"^package:\s+name='([^']+)'\s+versionCode='([0-9]+)'\s+versionName='([^']+)'",
    re.MULTILINE,
)


def verify_metadata(certificates: str, badging: str, xmltree: str, *,
                    expected_certificate: str, preview_certificate: str,
                    expected_application_id: str, expected_version_code: int,
                    expected_version: str) -> dict:
    expected_certificate = expected_certificate.strip().lower().replace(":", "")
    preview_certificate = preview_certificate.strip().lower().replace(":", "")
    if not SHA256.fullmatch(expected_certificate):
        raise ValueError("Missing or invalid production certificate SHA-256")
    if expected_certificate == preview_certificate:
        raise ValueError("Production certificate must differ from private preview/debug certificate")
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", expected_version):
        raise ValueError("Android public version must be stable (no private, rc or debug marker)")

    match = CERT.search(certificates)
    if not match or match.group(1).lower() != expected_certificate:
        raise ValueError("APK is not signed by the pinned production publisher certificate")
    if "Number of signers: 1" not in certificates:
        raise ValueError("Expected exactly one APK signer")
    if not re.search(r"Verified using v2 scheme.*:\s*true", certificates):
        raise ValueError("APK signature scheme v2 is required for Android 8+ devices")

    if re.search(r"(?m)^application-debuggable\s*$", badging):
        raise ValueError("Debuggable APK cannot be published")
    metadata = PACKAGE.search(badging)
    if (metadata is None or
        metadata.group(1) != expected_application_id or
        int(metadata.group(2)) != expected_version_code or
        metadata.group(3) != expected_version):
        raise ValueError("APK application ID or version does not match the release manifest")

    # An explicitly false boolean appears as (type 0x12)0x0 in aapt xmltree.
    for attribute in ("allowBackup", "fullBackupContent", "usesCleartextTraffic"):
        pattern = rf"android:{attribute}\([^)]*\)=\(type 0x12\)0x0+\b"
        if not re.search(pattern, xmltree):
            raise ValueError(f"Compiled manifest must explicitly disable android:{attribute}")
    if re.search(r"android:debuggable\([^)]*\)=\(type 0x12\)0x[fF]+\b", xmltree):
        raise ValueError("Compiled manifest enables android:debuggable")
    if not re.search(r"android:dataExtractionRules\([^)]*\)=@0x[0-9a-fA-F]+\b", xmltree):
        raise ValueError("Compiled manifest has no Android 12+ data extraction rules")

    return {
        "applicationId": metadata.group(1),
        "versionCode": int(metadata.group(2)),
        "versionName": metadata.group(3),
        "signingCertificateSha256": match.group(1).lower(),
        "debuggable": False,
        "cleartextTraffic": False,
        "automaticBackup": False,
        "android12DataExtractionRules": True,
    }


def command(executable: Path, *args: str) -> str:
    if not executable.is_file():
        raise ValueError(f"Missing Android SDK tool: {executable}")
    return subprocess.check_output([str(executable), *args], text=True,
                                   stderr=subprocess.STDOUT, timeout=30)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path, help="Signed production APK, not AAB")
    parser.add_argument("--apksigner", required=True, type=Path)
    parser.add_argument("--aapt", required=True, type=Path)
    parser.add_argument("--application-id", required=True)
    parser.add_argument("--expected-cert-sha256",
                        default=os.environ.get("GLAUKA_PUBLIC_ANDROID_CERT_SHA256", ""))
    parser.add_argument("--report", type=Path, help="Write local verification report")
    args = parser.parse_args()

    try:
        if not args.apk.is_file() or args.apk.suffix.lower() != ".apk":
            raise ValueError("Provide an existing signed APK")
        if "debug" in args.apk.name.lower() or "unsigned" in args.apk.name.lower():
            raise ValueError("Private, debug or unsigned APK filename not accepted")
        version = json.loads((ROOT / "versions.json").read_text(encoding="utf-8"))["android"]
        preview = json.loads((ROOT / "scripts/release/android-preview-identity.json").read_text(encoding="utf-8"))
        if args.application_id != preview["applicationId"]:
            raise ValueError("Unexpected Android application ID; data migration must be reviewed separately")
        certs = command(args.apksigner, "verify", "--verbose", "--print-certs", str(args.apk.resolve()))
        badges = command(args.aapt, "dump", "badging", str(args.apk.resolve()))
        xml = command(args.aapt, "dump", "xmltree", str(args.apk.resolve()), "AndroidManifest.xml")
        result = verify_metadata(
            certs, badges, xml,
            expected_certificate=args.expected_cert_sha256,
            preview_certificate=preview["certificateSha256"],
            expected_application_id=args.application_id,
            expected_version_code=version["version_code"],
            expected_version=version["version"],
        )
        with args.apk.open("rb") as source:
            result["apkSha256"] = hashlib.file_digest(source, "sha256").hexdigest()
        result["apk"] = args.apk.name
        result["publicApkMetadataVerified"] = True
        result["deviceTestingVerified"] = False  # A static APK check is never an install test.
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print("PUBLIC ANDROID RELEASE BLOCKED: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
