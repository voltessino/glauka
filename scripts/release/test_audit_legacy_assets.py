"""Safe, offline tests for the archived Glauka sources inventory."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

RELEASE = Path(__file__).resolve().parent
sys.path.insert(0, str(RELEASE))
import audit_legacy_assets as audit


class LegacyArchiveAuditTests(unittest.TestCase):
    def setUp(self):
        self.old = {
            "formatVersion": 1, "sourceCommit": "a" * 40, "totalBytes": 11,
            "archives": [
                {"path": f"apps/windows/legacy/old-{i}.zip",
                 "blobSha": "b" * 40, "bytes": 1 if i < 6 else 5}
                for i in range(7)
            ]
        }

    def test_exact_seven_validated_and_totals_reconciled(self):
        self.assertEqual(len(audit.validate_manifest(self.old)), 7)
        bad = json.loads(json.dumps(self.old))
        bad["archives"][0]["path"] = "../secret.zip"
        with self.assertRaises(ValueError):
            audit.validate_manifest(bad)
        bad = json.loads(json.dumps(self.old))
        bad["archives"][1]["path"] = bad["archives"][0]["path"]
        with self.assertRaises(ValueError):
            audit.validate_manifest(bad)
        bad = json.loads(json.dumps(self.old))
        bad["totalBytes"] = 8
        with self.assertRaises(ValueError):
            audit.validate_manifest(bad)

    def test_exact_sha_size_and_index_checked(self):
        item = self.old["archives"][0]
        calls = []
        def runner(root, *args):
            calls.append(args)
            if args[0] == "ls-tree":
                return SimpleNamespace(returncode=0, stdout="100644 blob " +
                                       item["blobSha"] + "\t" + item["path"] + "\n")
            if args[0] == "cat-file":
                return SimpleNamespace(returncode=0, stdout=str(item["bytes"]) + "\n")
            return SimpleNamespace(returncode=0, stdout="")
        ok, _ = audit.verify_archive(Path("."), self.old["sourceCommit"], item, runner)
        self.assertTrue(ok)
        self.assertEqual([x[0] for x in calls], ["ls-tree", "cat-file", "ls-files"])

    def test_mismatch_and_currently_tracked_archive_fail_closed(self):
        item = self.old["archives"][0]
        def wrong(root, *args):
            return SimpleNamespace(returncode=0, stdout="mismatch\n")
        self.assertFalse(audit.verify_archive(Path("."), self.old["sourceCommit"], item, wrong)[0])
        def tracked(root, *args):
            if args[0] == "ls-tree":
                value = "100644 blob " + item["blobSha"] + "\t" + item["path"] + "\n"
            elif args[0] == "cat-file":
                value = str(item["bytes"]) + "\n"
            else:
                value = item["path"] + "\n"
            return SimpleNamespace(returncode=0, stdout=value)
        self.assertFalse(audit.verify_archive(Path("."), self.old["sourceCommit"], item, tracked)[0])

    def test_missing_manifest_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            messages = []
            result = audit.audit(Path(tmp), Path(tmp)/"none.json", output=messages.append)
            self.assertEqual(result, 2)
            self.assertIn("manifest invalid", messages[0])


if __name__ == "__main__":
    unittest.main()
