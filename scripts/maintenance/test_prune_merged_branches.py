"""Branch pruning must fail closed. Local unit tests; no GitHub network."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import prune_merged_branches as pruning

def branch(name, protected=False):
    return {"name":name,"commit":{"sha":"a"*40},"protected":protected}

class SafetyTests(unittest.TestCase):
    def check(self,name,prs=(),ahead=0,status="behind",protected=False):
        with patch.object(pruning,"api",return_value={"ahead_by":ahead,"status":status}) as call:
            outcome=pruning.decide("example/glauka","fake",branch(name,protected),list(prs),"main")
            return outcome,call.call_count

    def test_preserved_names_and_prefixes(self):
        for name in ["main","download/installer","downloads/2026","backup/main","release/v7",
                     "archive/old","safety/main","build/windows","macos-private-preview","feat/desktop-spacing-images-links"]:
            with self.subTest(name=name):
                (ok,_),calls=self.check(name)
                self.assertFalse(ok)
                self.assertEqual(calls,0)
        self.assertFalse(self.check("fix/protected",protected=True)[0][0])

    def test_open_pr_is_never_removed(self):
        prs=[{"state":"open","head":{"ref":"fix/open","repo":{"full_name":"example/glauka"}}}]
        (ok,reason),calls=self.check("fix/open",prs)
        self.assertFalse(ok)
        self.assertIn("open pull request",reason)
        self.assertEqual(calls,0)


    def test_open_pr_base_is_not_pruned(self):
        prs=[{"state":"open","head":{"ref":"fix/new"},
              "base":{"ref":"integration/stacked"}}]
        (ok,reason),calls=self.check("integration/stacked",prs)
        self.assertFalse(ok)
        self.assertIn("open pull request",reason)
        self.assertEqual(calls,0)

    def test_apply_requires_explicit_file(self):
        with patch.object(sys,"argv",["prune_merged_branches.py","--apply",
                                     "--confirm",pruning.CONFIRM]):
            with self.assertRaises(SystemExit) as raised:
                pruning.main()
        self.assertEqual(raised.exception.code,2)

    def test_approval_list_rejects_invalid_and_duplicate_sha(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"approved.json"
            for contents in ([],[{"branch":"fix/x","sha":"wrong"}],
                             [{"branch":"fix/x","sha":"a"*40}]*2):
                path.write_text(json.dumps(contents),encoding="utf-8")
                with self.assertRaises(RuntimeError):
                    pruning.approved_refs(path)
            path.write_text(json.dumps([{"branch":"fix/x","sha":"a"*40}]),encoding="utf-8")
            self.assertEqual(pruning.approved_refs(path),{("fix/x","a"*40)})

    def test_apply_only_deletes_selected_eligible_branch(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"approved.json"
            path.write_text(json.dumps([{"branch":"fix/yes","sha":"a"*40}]),encoding="utf-8")
            deletes=[]
            def api(repo,token,endpoint,method="GET"):
                if method=="DELETE":
                    deletes.append(endpoint)
                    return None
                if endpoint.startswith("git/ref/heads/"):
                    return {"object":{"sha":"a"*40}}
                return {"default_branch":"main"} if not endpoint else {"ahead_by":0,"status":"behind"}
            def pages(repo,token,endpoint):
                return [branch("main"),branch("fix/yes"),branch("fix/no")] if endpoint=="branches" else []
            with patch.dict(os.environ,{"GH_TOKEN":"test-token"}), \
                 patch.object(pruning,"api",side_effect=api), \
                 patch.object(pruning,"pages",side_effect=pages), \
                 patch.object(sys,"argv",["prune_merged_branches.py","--apply",
                     "--confirm",pruning.CONFIRM,"--approved-file",str(path)]):
                pruning.main()
            self.assertEqual(deletes,["git/refs/heads/fix/yes"])

    def test_stale_approval_aborts_before_any_deletion(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"approved.json"
            path.write_text(json.dumps([{"branch":"fix/missing","sha":"a"*40}]),encoding="utf-8")
            deletes=[]
            def api(repo,token,endpoint,method="GET"):
                if method=="DELETE":deletes.append(endpoint)
                return {"default_branch":"main"} if not endpoint else {"ahead_by":0,"status":"behind"}
            def pages(repo,token,endpoint):
                return [branch("fix/valid")] if endpoint=="branches" else []
            with patch.dict(os.environ,{"GH_TOKEN":"test-token"}), \
                 patch.object(pruning,"api",side_effect=api), \
                 patch.object(pruning,"pages",side_effect=pages), \
                 patch.object(sys,"argv",["prune_merged_branches.py","--apply",
                     "--confirm",pruning.CONFIRM,"--approved-file",str(path)]):
                with self.assertRaisesRegex(RuntimeError,"stale"):
                    pruning.main()
            self.assertEqual(deletes,[])

    def test_only_ancestral_branch_can_be_candidate(self):
        self.assertTrue(self.check("fix/behind")[0][0])
        self.assertTrue(self.check("fix/identical",status="identical")[0][0])
        for ahead,status in [(2,"diverged"),(1,"ahead"),(0,"diverged")]:
            self.assertFalse(self.check("fix/unique",ahead=ahead,status=status)[0][0])

    def test_merged_pr_does_not_override_unique_commits(self):
        closed=[{"state":"closed","merged_at":"2026-10-30",
                 "head":{"ref":"fix/squash","sha":"a"*40},
                 "base":{"ref":"main"}}]
        self.assertFalse(self.check("fix/squash",prs=closed,ahead=2,status="diverged")[0][0])

    def test_report_defaults_to_dry_run_and_does_not_leak_token(self):
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/"review.json"
            def api(repo,token,endpoint,method="GET"):
                self.assertNotEqual(method,"DELETE")
                return {"default_branch":"main"} if not endpoint else {"ahead_by":0,"status":"behind"}
            def pages(repo,token,endpoint):
                if endpoint=="branches":return [branch("main"),branch("fix/merged"),branch("download/app")]
                if endpoint=="pulls?state=open":return []
                raise AssertionError(endpoint)
            with patch.dict(os.environ,{"GH_TOKEN":"test-secret"}), \
                 patch.object(pruning,"api",side_effect=api), \
                 patch.object(pruning,"pages",side_effect=pages), \
                 patch.object(sys,"argv",["prune_merged_branches.py","--json-report",str(output)]):
                pruning.main()
            result=json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual((result["total"],result["candidates"],result["preserved"]),(3,1,2))
            self.assertTrue(result["dry_run"])
            self.assertNotIn("test-secret",output.read_text(encoding="utf-8"))

if __name__=="__main__":
    unittest.main()
