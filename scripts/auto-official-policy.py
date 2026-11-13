"""Validate a producer's JSON-only diff against its actual Git baseline."""
import json
import re
import subprocess
import sys
from urllib.parse import urlsplit

DATE = r"[0-9]{4}-[0-9]{2}-[0-9]{2}"
BRANCH = re.compile(rf"data/(source-snapshot|trustee-returns)-({DATE})-([1-9][0-9]*)")
SOURCE = rf"data/sources/{DATE}/mpf-fund-platform\.json"
OVERLAY = rf"data/coverage/{DATE}-official-return-observations-candidate\.json"
TRUSTEES = {"www.hsbc.com.hk", "cms.hangseng.com", "www.bcthk.com", "www.manulife.com.hk",
            "www.boci-pru.com.hk", "www.sunlife.com.hk", "www.yflife.com"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def git(*args):
    return subprocess.check_output(["git", *args]).decode("utf-8").rstrip("\n")


def read(ref, path):
    return json.loads(git("show", f"{ref}:{path}"))


def latest(ref, pattern):
    return max(p for p in git("ls-tree", "-r", "--name-only", ref, "data").splitlines() if re.fullmatch(pattern, p))


def official(url, hosts):
    parts = urlsplit(url)
    return parts.scheme == "https" and parts.netloc in hosts


def check_platform(base, head, path, report_path, match):
    old = read(base, latest(base, SOURCE))
    new, report = read(head, path), read(head, report_path)
    d, audit, ready = report["decision"], report["audit"], report["readiness"]
    require(d["publishable"] is True and d["outcome"] == "ready" and ready["ready"] is True
            and ready["blockedRecords"] == 0 and not ready["issues"]
            and audit["requiresReview"] is False and not audit["anomalies"] and not audit["sourceFailures"],
            "Platform batch requires review")
    count = len(new["records"])
    require(0 < count == ready["acceptedRecords"] == audit["inputRecords"] == new["expectedCounts"]["fundClasses"],
            "Platform fund counts differ")
    require(match[2] == new["sourceDataAsOf"] == d["candidateDataAsOf"]
            and old["sourceDataAsOf"] == d["previousDataAsOf"] and match[2] > old["sourceDataAsOf"]
            and audit["batchId"] == "candidate-" + match[3], "Platform baseline or batch mismatch")
    require(new["sourceType"] == "mpf_fund_platform" and
            all(official(url, {"mfp.mpfa.org.hk"}) for url in
                [new["sourceUrl"], *(r["sourceUrl"] for r in new["records"])]), "Non-MPFA platform source")


def keyed(rows):
    result = {(r["fundClassId"], r["periodYears"], r.get("basis", "annualized")): r for r in rows}
    require(len(result) == len(rows), "Duplicate observation")
    return result


def check_overlay(base, head, path, report_path):
    baseline, platform = latest(base, OVERLAY), latest(base, SOURCE)
    report = read(head, report_path)
    require(report["sourceSnapshot"] == platform and report["baseCandidate"] == baseline,
            "Producer baseline does not match current main")
    old, new = keyed(read(base, baseline)), keyed(read(head, path))
    require(old.keys() <= new.keys(), "Removed observation")
    records = {r["fundClassId"]: r for r in read(base, platform)["records"]}
    conflicts = {r["fundClassId"] for r in report["officialConflicts"]}
    conflicts.update(r["observation"]["fundClassId"] for r in report["cumulativeExceptions"])
    annual = report["annualizedFactsheets"]
    blocked_annual = {r["fundClassId"] for r in annual["quarantined"]}
    annual_rows = {(r["fundClassId"], s["url"], s["sha256"], s["retrievedAt"]): r
                   for s in annual["reports"] if not s["additionalFundNames"] for r in s["rows"] if r["status"] == "newer"}
    monthly = {(s["schemeName"], s["url"], s["sha256"], s["retrievedAt"], s["dataAsOf"]): s for s in report["sources"]
               if official(s["url"], TRUSTEES) and s["matched"] > 0 and s["matched"] == s["oneYearCrossChecks"]}
    applied = set()
    changes = 0
    for key, row in new.items():
        prior = old.get(key)
        if row == prior:
            continue
        fund, period, basis = key
        changes += 1
        record = records[fund]
        require(period == 3 and record["current"] and fund not in conflicts and "publisher" not in row,
                f"Ineligible observation {key}")
        require(re.fullmatch("[0-9a-f]{64}", row["sourceSha256"]) and
                (not prior or row["dataAsOf"] > prior["dataAsOf"] or
                 (prior.get("publisher") == "hkifa-lipper" and row["dataAsOf"] == prior["dataAsOf"])),
                f"Date or source evidence mismatch {key}")
        url, sha, retrieved = row["sourceUrl"], row["sourceSha256"], row["retrievedAt"]
        if basis == "annualized":
            proof = annual_rows.get((fund, url, sha, retrieved))
            require(official(url, {"www.aia.com.hk", "app2.yflife.com"}) and prior and proof
                    and fund not in blocked_annual and proof["previousDate"] == prior["dataAsOf"]
                    and proof["previousAnnualized"] == prior["annualized"]
                    and proof["dataAsOf"] == row["dataAsOf"] and proof["annualized"] == row["annualized"],
                    f"Annualized row lacks matching official evidence {fund}")
            applied.add(fund)
        else:
            source = monthly.get((record["identity"]["schemeName"], url, sha, retrieved, row["dataAsOf"]))
            require(basis == "cumulative" and source and fund not in source["quarantinedRows"]
                    and (record.get("returns", {}).get("1", {}).get("dataAsOf") == row["dataAsOf"]
                         or (fund in source["officialNotDisclosed"] and row["cumulative"] is None)),
                    f"Monthly row lacks contemporaneous official cross-check {fund}")
    require(changes and set(annual["applied"]) == applied, "No eligible changes or annualized report mismatch")


def validate(base, head, branch):
    match = BRANCH.fullmatch(branch)
    require(match, "Unexpected producer branch")
    platform = match[1] == "source-snapshot"
    path = latest(head, SOURCE if platform else OVERLAY)
    report = path.replace("mpf-fund-platform.json", "refresh-report.json") if platform else path.replace("-candidate.json", "-report.json")
    changed = git("diff", "--no-renames", "--name-only", "-z", base, head).rstrip("\0").split("\0")
    require(set(changed) == {path, report}, "Diff must contain only the current data and its report")
    for p in changed:
        require(git("ls-tree", head, "--", p).startswith("100644 blob "), "Unexpected data file mode")
    if platform:
        check_platform(base, head, path, report, match)
    else:
        check_overlay(base, head, path, report)


if __name__ == "__main__":
    validate(*sys.argv[1:])
