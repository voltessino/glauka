#!/usr/bin/env python3
"""Offline unit tests for the production APK acceptance policy (no SDK required)."""
import unittest
from verify_android_public import verify_metadata

PROD = "a" * 64
PREVIEW = "b" * 64
PKG = "it.neuromap.architect.preview"
CODE = 27
VERSION = "0.7.0"
CERTS = ("Number of signers: 1\n"
         "Verified using v2 scheme (APK Signature Scheme v2): true\n"
         "Signer #1 certificate SHA-256 digest: " + PROD + "\n")
BADGING = f"package: name='{PKG}' versionCode='{CODE}' versionName='{VERSION}'\n"
XML = ("A: android:allowBackup(0x01010280)=(type 0x12)0x0\n"
       "A: android:fullBackupContent(0x01010488)=(type 0x12)0x0\n"
       "A: android:usesCleartextTraffic(0x010104ec)=(type 0x12)0x0\n"
       "A: android:dataExtractionRules(0x01010634)=@0x7f130000\n")


def check(certs=CERTS, badges=BADGING, xml=XML, *, cert=PROD,
          preview=PREVIEW, version=VERSION):
    return verify_metadata(
        certs, badges, xml,
        expected_certificate=cert,
        preview_certificate=preview,
        expected_application_id=PKG,
        expected_version_code=CODE,
        expected_version=version,
    )


class PublicApkVerificationTests(unittest.TestCase):
    def test_accepts_pinned_non_debug_production_metadata(self):
        result = check()
        self.assertEqual(result["signingCertificateSha256"], PROD)
        self.assertEqual(result["versionName"], VERSION)
        self.assertFalse(result["debuggable"])

    def test_rejects_missing_or_wrong_production_certificate(self):
        for cert in ("", PREVIEW, "c" * 64):
            with self.subTest(cert=cert), self.assertRaises(ValueError):
                check(cert=cert)

    def test_rejects_preview_signer_even_if_pinned(self):
        with self.assertRaises(ValueError):
            check(preview=PROD)

    def test_rejects_debuggable_and_invalid_signer_metadata(self):
        for certs,badges in [
            (CERTS, BADGING + "application-debuggable\n"),
            (CERTS.replace("Number of signers: 1","Number of signers: 2"), BADGING),
            (CERTS.replace("v2): true","v2): false"), BADGING),
        ]:
            with self.subTest(certs=certs,badges=badges),self.assertRaises(ValueError):
                check(certs=certs,badges=badges)

    def test_rejects_pre_release_version_and_identity_mismatch(self):
        for version in ("0.7.0-private", "0.7.0-rc.1", "debug", "0.7"):
            with self.subTest(version=version),self.assertRaises(ValueError):
                check(version=version)
        with self.assertRaises(ValueError):
            check(badges=BADGING.replace(PKG,"com.example.sideload"))

    def test_rejects_missing_or_unsafe_manifest_policies(self):
        for changed in [
            XML.replace("0x0\n", "0xffffffff\n", 1),
            XML.replace("usesCleartextTraffic", "missingAttribute"),
            XML.replace("dataExtractionRules", "missingAttribute"),
            XML + "A: android:debuggable(0x0101000f)=(type 0x12)0xffffffff\n",
        ]:
            with self.subTest(changed=changed),self.assertRaises(ValueError):
                check(xml=changed)


if __name__ == "__main__":
    unittest.main()
