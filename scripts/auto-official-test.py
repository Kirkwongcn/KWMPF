"""Regression cases for automatic official-data admission, without network or credentials."""
import os
import runpy
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).parent
validate = runpy.run_path(str(HERE / "auto-official-policy.py"))["check_overlay"]


class Admission(unittest.TestCase):
    def setUp(self):
        self.source = "data/sources/2026-10-01/mpf-fund-platform.json"
        self.base = "data/coverage/2026-10-01-official-return-observations-candidate.json"
        self.fund = "mpfa-cf-1"
        self.row = dict(fundClassId=self.fund, periodYears=3, basis="cumulative", cumulative=1.230,
                        printed="1.230", dataAsOf="2026-10-31", sourceUrl="https://www.hsbc.com.hk/report.pdf",
                        retrievedAt="2026-11-01T00:00:00Z", sourceSha256="a"*64)
        self.old = dict(self.row, dataAsOf="2026-09-30", cumulative=1, printed="1")
        self.report = dict(sourceSnapshot=self.source, baseCandidate=self.base, officialConflicts=[],
                           cumulativeExceptions=[], annualizedFactsheets=dict(quarantined=[], reports=[], applied=[]),
                           sources=[dict(schemeName="Scheme", url=self.row["sourceUrl"], sha256="a"*64,
                                         retrievedAt=self.row["retrievedAt"], dataAsOf="2026-10-31", matched=1,
                                         oneYearCrossChecks=1, quarantinedRows=[], officialNotDisclosed=[])])
        self.platform = {"records": [dict(fundClassId=self.fund, current=True, identity=dict(schemeName="Scheme"),
                                           returns={"1": {"dataAsOf": "2026-10-31"}})]}

    def check(self):
        data = {"report": self.report, "candidate": [self.row], self.base: [self.old], self.source: self.platform}
        with patch.dict(validate.__globals__, read=lambda ref,p: data[p],
                        latest=lambda ref,pattern: self.source if "platform" in pattern else self.base):
            validate("base", "head", "candidate", "report")

    def test_eligible_row_with_unrelated_conflict(self):
        self.report["officialConflicts"] = [{"fundClassId": "some-other-fund"}]
        self.check()

    def test_reject_third_party_even_if_workflow_claims_official(self):
        self.row["publisher"] = "hkifa-lipper"
        with self.assertRaises(ValueError):
            self.check()

    def test_changed_conflicted_row(self):
        self.report["officialConflicts"].append(dict(fundClassId=self.fund))
        with self.assertRaises(ValueError):
            self.check()

    def test_source_evidence_mismatch(self):
        self.row["sourceSha256"] = "b"*64
        with self.assertRaises(ValueError):
            self.check()

    def test_same_day_revision_requires_review(self):
        self.old["dataAsOf"] = self.row["dataAsOf"]
        with self.assertRaises(ValueError):
            self.check()

    def test_explicit_missing_value(self):
        self.platform["records"][0]["returns"] = {}
        self.row.update(cumulative=None, printed="-")
        self.report["sources"][0]["officialNotDisclosed"].append(self.fund)
        self.check()


class Publication(unittest.TestCase):
    def setUp(self):
        with patch.dict(os.environ, GITHUB_REPOSITORY="test/project", OFFICIAL_DATA_APP_LOGIN="official-data[bot]"):
            self.publish = runpy.run_path(str(HERE / "auto-official-reconcile.py"))["publish"]
        self.sha = "1"*40
        self.run = dict(id=1, display_title="Publish official data " + self.sha, head_sha=self.sha,
                        status="completed", conclusion="success", run_attempt=1, html_url="example.com")
        self.job = dict(name="publish", conclusion="success", steps=[])
        self.writes = []
        self.patch = patch.dict(self.publish.__globals__, items=self.items, api=self.api,
                                dispatch=lambda *a, **kw: self.writes.append("dispatch"), note=lambda *a: None)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def items(self, path, key=None):
        return {"workflow_runs": [self.run], "jobs": [self.job], None: []}[key]

    def api(self, path, *args, **kwargs):
        if path.startswith("statuses/"):
            self.writes.append("receipt")
            return
        return {"object": {"sha": self.sha}}

    def test_verified_success(self):
        self.job["steps"].append(dict(name="Verify D1, public snapshot and publication receipt", conclusion="success"))
        self.assertTrue(self.publish(self.sha, 1))
        self.assertEqual(self.writes, ["receipt"])

    def test_skipped_job(self):
        self.job["conclusion"] = "skipped"
        self.assertFalse(self.publish(self.sha, 1))
        self.assertEqual(self.writes, ["dispatch"])

    def test_failed_rollback(self):
        self.run["conclusion"] = self.job["conclusion"] = "failure"
        self.job["steps"].append(dict(name="Import publication data", conclusion="failure"))
        with self.assertRaises(RuntimeError):
            self.publish(self.sha, 1)
        self.assertFalse(self.writes)


class Reconciler(unittest.TestCase):
    def setUp(self):
        with patch.dict(os.environ, GITHUB_REPOSITORY="test/project", OFFICIAL_DATA_APP_LOGIN="official-data[bot]"):
            self.module = runpy.run_path(str(HERE / "auto-official-reconcile.py"))

    def pr_run(self, conclusion):
        return dict(id=7, run_attempt=1, head_branch="branch", head_sha="head", status="completed",
                    path=".github/workflows/ci.yml", event="pull_request", head_repository=dict(full_name="test/project"),
                    pull_requests=[dict(number=1, head=dict(sha="head", ref="branch"), base=dict(sha="base", ref="main"))],
                    conclusion=conclusion, html_url="run")

    def test_pr_and_base_identity(self):
        matches = self.module["matches_pr"]
        run = self.pr_run("success")
        self.assertTrue(matches(run, 1, "branch", "head", "base"))
        self.assertFalse(matches(run, 2, "branch", "head", "base"))
        self.assertFalse(matches(run, 1, "branch", "head", "newbase"))
        run["event"] = "workflow_dispatch"
        self.assertFalse(matches(run, 1, "branch", "head", "base"))

    def test_rerun_inherits_seed_and_requires_executed_step(self):
        ci = self.module["ci"]
        run = self.pr_run("success")
        run["run_attempt"] = 2
        seed = dict(name="Validate the latest publication seed through the local API", conclusion="success")
        def jobs(path, key):
            names = ["verify"] if "attempts/2/" in path else ["verify", "e2e", "high-risk-review"]
            return [dict(name=n, conclusion="success", steps=[seed] if n == "e2e" else []) for n in names]
        with patch.dict(ci.__globals__, api=lambda path: {"workflow_runs": [run]}, items=jobs):
            ci(1, "branch", "head", "base")
            seed["conclusion"] = "skipped"
            with self.assertRaisesRegex(ValueError, "require review"):
                ci(1, "branch", "head", "base")

    def test_premerge_to_squash_to_publisher_when_github_clears_associations(self):
        run = self.pr_run("success")
        verify, ci = self.module["verify_merged_ci"], self.module["ci"]
        job_names = ["verify", "e2e", "high-risk-review"]
        seed = dict(name="Validate the latest publication seed through the local API", conclusion="success")
        jobs = [dict(name=n, conclusion="success", steps=[seed] if n == "e2e" else []) for n in job_names]
        def api(path):
            if path == "actions/runs/7/attempts/1":
                return run
            self.assertIn("event=pull_request", path)
            return {"workflow_runs": [run]}
        fields = {"--format=%s": "Automatic official data PR #1", "--format=%P": "base"}
        with patch.dict(ci.__globals__, api=api, items=lambda *a: jobs, git=lambda *a: fields[a[2]], time=Mock()):
            receipt = ci(1, "branch", "head", "base")
            fields["--format=%b"] = self.module["merge_message"](1, "head", "base", *receipt)
            run["pull_requests"] = []
            with self.assertRaisesRegex(ValueError, "Timed out"):
                ci(1, "branch", "head", "base")
            verify(1, "branch", "head", "base")
            run["pull_requests"] = self.pr_run("success")["pull_requests"]
            verify(1, "branch", "head", "base")
            run["pull_requests"][0]["base"]["sha"] = "unrelated"
            with self.assertRaisesRegex(ValueError, "does not match"):
                verify(1, "branch", "head", "base")
            run["pull_requests"] = []
            with self.assertRaisesRegex(ValueError, "receipt"):
                verify(1, "branch", "other-head", "base")
            run["run_attempt"] = 2
            with self.assertRaisesRegex(ValueError, "does not match"):
                verify(1, "branch", "head", "base")

    def test_ci_retry_budget_persists_via_run_attempt(self):
        ci = self.module["ci"]
        run = self.pr_run("timed_out")
        retries = []
        def api(path, method="GET"):
            if method == "POST":
                retries.append(path)
                run["run_attempt"] += 1
            return {"workflow_runs": [run]}
        with patch.dict(ci.__globals__, api=api, items=lambda *a: [], time=Mock()):
            with self.assertRaisesRegex(ValueError, "require review"):
                ci(1, "branch", "head", "base")
        self.assertEqual(retries, ["actions/runs/7/rerun"] * 2)

    def test_assertion_failure_not_retried(self):
        job = dict(conclusion="failure", steps=[{"name": "tests", "conclusion": "failure"}])
        self.assertFalse(self.module["transient_ci"]({"conclusion": "failure"}, [job]))

    def exercise(self, status, after_merge):
        main = self.module["main"]
        pr = dict(number=1, head=dict(sha="head", repo={"full_name": "test/project"},
                                      ref="data/trustee-returns-2026-10-31-123"),
                  user={"login": "official-data[bot]"})
        error = self.module["GitHubError"](status, f"HTTP {status}")
        admit = Mock(side_effect=["merged", "next"] if after_merge else [error, "next"])
        release = Mock(side_effect=error if after_merge else None)
        note = Mock()
        with patch.dict(main.__globals__, git=lambda *a: "", items=lambda *a: [pr, dict(pr, number=2)],
                        reconcile=admit, publish=release, note=note):
            if after_merge or status == 403:
                with self.assertRaises(type(error)):
                    main()
                self.assertEqual(admit.call_count, 1)
                note.assert_not_called()
            else:
                main()
                self.assertEqual(admit.call_count, 2)
                note.assert_called_once()
                release.assert_called_once_with("next", 2)

    def test_candidate_conflicts_and_missing_receipt(self):
        for status in (404, 409, 422):
            with self.subTest(status=status):
                self.exercise(status, False)

    def test_permissions_error_stops(self):
        self.exercise(403, False)

    def test_dispatch_error_after_merge_stops(self):
        self.exercise(422, True)


if __name__ == "__main__":
    unittest.main()
