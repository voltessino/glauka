#!/usr/bin/env python3
"""Tests synthetic Git patch lines only; never uses real credentials."""
import unittest
from scan_git_secrets import inspect_patch

FAKE_GITHUB = "ghp_" + "a" * 32
FAKE_OPENAI = "sk-proj-" + "x" * 30
FAKE_KEY_HEADER = "-----BEGIN EC " + "PRIVATE KEY-----"


class RedactedGitSecretsTests(unittest.TestCase):
    def test_redacts_signals_and_deduplicates(self):
        patch = [
            "GLAUKA_AUDIT_COMMIT " + "a" * 40 + "\n",
            "+++ b/apps/android/config.js\n",
            "+const token='" + FAKE_GITHUB + "';\n",
            "+const also='" + FAKE_GITHUB + "';\n",
            "+const ai='" + FAKE_OPENAI + "';\n",
            "GLAUKA_AUDIT_COMMIT " + "b" * 40 + "\n",
            "+++ b/private/release.jks\n",
            "+binary\n",
        ]
        found = list(inspect_patch(patch))
        self.assertEqual(len(found), 3)
        self.assertEqual({f["category"] for f in found},
                         {"github-token", "openai-api-key", "sensitive-file-in-history"})
        serialized = repr(found)
        self.assertNotIn(FAKE_GITHUB, serialized)
        self.assertNotIn(FAKE_OPENAI, serialized)

    def test_deleted_lines_and_plain_words_are_ignored(self):
        lines = [
            "GLAUKA_AUDIT_COMMIT " + "c" * 40 + "\n",
            "+++ b/docs/example.md\n",
            "-deleted key " + FAKE_GITHUB + "\n",
            "+We never store private keys, and OAuth uses a public client ID.\n",
        ]
        self.assertEqual(list(inspect_patch(lines)), [])

    def test_scrubs_token_like_file_names(self):
        lines = [
            "GLAUKA_AUDIT_COMMIT " + "e" * 40 + "\n",
            "+++ b/test/" + FAKE_GITHUB + ".pem\n",
            "+placeholder\n",
        ]
        findings = list(inspect_patch(lines))
        self.assertEqual(len(findings), 1)
        self.assertNotIn(FAKE_GITHUB, repr(findings))
        self.assertIn("[REDACTED]", findings[0]["path"])

    def test_detects_private_key_headers_without_disclosing_body(self):
        lines = [
            "GLAUKA_AUDIT_COMMIT " + "d" * 40 + "\n",
            "+++ b/docs/suspect.txt\n",
            "+" + FAKE_KEY_HEADER + "\n",
        ]
        found = list(inspect_patch(lines))
        self.assertEqual(found[0]["category"], "private-key-header")


if __name__ == "__main__":
    unittest.main()
