"""Regression cases for automatic official-data admission, without network or credentials."""
import os
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch

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
        with patch.dict(os.environ, GITHUB_REPOSITORY="test/project"):
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


if __name__ == "__main__":
    unittest.main()
