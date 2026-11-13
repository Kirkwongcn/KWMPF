"""Reconcile attested data PRs from trusted main. Never check out a candidate."""
import io
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from runpy import run_path

policy = run_path(str(Path(__file__).with_name("auto-official-policy.py")))
git, require, validate = (policy[k] for k in ("git", "require", "validate"))
REPO = os.environ["GITHUB_REPOSITORY"]
BOT = "github-actions[bot]"
APP = os.environ.get("OFFICIAL_DATA_APP_LOGIN", "")
CI = "ci.yml"
PUBLISH = "publish-official-data.yml"
PREFIX = "Automatic official data PR #"


class GitHubError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def gh(*args):
    result = subprocess.run(["gh", *map(str, args)], capture_output=True)
    if result.returncode:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        status = re.search(r"\bHTTP(?:/\S+)?\s+(\d{3})\b", message)
        raise GitHubError(int(status[1]) if status else None, message)
    return result.stdout


def api(path, method="GET", **fields):
    args = ["api", "-X", method, f"repos/{REPO}/{path}"]
    for key, value in fields.items():
        args += ["-f", f"{key}={value}"]
    output = gh(*args)
    return json.loads(output) if output.strip() else None


def items(path, key=None):
    args = ["api", "--paginate", "--slurp", f"repos/{REPO}/{path}"]
    return [x for page in json.loads(gh(*args)) for x in (page[key] if key else page)]


def dispatch(workflow, ref, **inputs):
    args = ["workflow", "run", workflow, "--ref", ref]
    for k, v in inputs.items():
        args += ["-f", f"{k}={v}"]
    gh(*args)


def note(pr, message):
    print(f"PR #{pr}: {message}", flush=True)
    body = "<!-- official-data-admission -->\n" + message
    comments = items(f"issues/{pr}/comments?per_page=100")
    prior = next((c for c in comments if c["user"]["login"] == BOT and
                  c["body"].startswith("<!-- official-data-admission -->")), None)
    if not prior:
        api(f"issues/{pr}/comments", "POST", body=body)
    elif prior["body"] != body:
        api(f"issues/comments/{prior['id']}", "PATCH", body=body)


def attest(pr, match):
    branch, head = pr["head"]["ref"], pr["head"]["sha"]
    require(pr["user"]["login"] == APP and pr["head"]["repo"]["full_name"] == REPO
            and pr["base"]["ref"] == "main" and not pr["draft"], "PR provenance or target mismatch")
    producer = "refresh-source-snapshot.yml" if match[1] == "source-snapshot" else "refresh-trustee-returns.yml"
    run = api(f"actions/runs/{match[3]}")
    require(run["head_branch"] == "main" and run["head_repository"]["full_name"] == REPO
            and run["path"] == ".github/workflows/" + producer and run["conclusion"] == "success"
            and run["event"] in ("workflow_dispatch", "schedule"), "Missing successful trusted main producer run")
    # A failed-jobs rerun can reuse the producer job's earlier successful upload.
    receipts = items(f"actions/runs/{run['id']}/artifacts?per_page=100", "artifacts")
    valid_names = {f"official-data-pr-{run['id']}-{attempt}" for attempt in range(1, run["run_attempt"] + 1)}
    receipts = [r for r in receipts if not r["expired"] and r["name"] in valid_names]
    require(receipts, "Missing immutable producer receipt")
    receipts.sort(key=lambda r: int(r["name"].rsplit("-", 1)[1]), reverse=True)
    archive = gh("api", f"repos/{REPO}/actions/artifacts/{receipts[0]['id']}/zip")
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        require(z.namelist() == ["candidate-head.txt"] and z.getinfo("candidate-head.txt").file_size <= 42,
                "Unexpected producer receipt")
        original = z.read("candidate-head.txt").decode("ascii").strip()
    require(re.fullmatch("[0-9a-f]{40}", original), "Malformed producer commit")
    git("fetch", "--no-tags", "origin", f"refs/pull/{pr['number']}/head")
    require(git("rev-parse", "FETCH_HEAD") == head, "Candidate moved during admission")
    require(git("show", "-s", "--format=%P", original) == run["head_sha"], "Producer parent mismatch")
    return original


def transient_ci(run, jobs):
    interrupted = {"cancelled", "timed_out", "stale", "startup_failure"}
    if run["conclusion"] in interrupted:
        return True
    failed = [j for j in jobs if j["conclusion"] not in {"success", "skipped", "neutral"}]
    return bool(failed) and all(j["conclusion"] in interrupted or
                                (j["conclusion"] == "failure" and not j["steps"]) for j in failed)


def matches_pr(run, number, branch, head, base, merged_receipt=False):
    metadata = (run["event"] == "pull_request" and run["path"] == ".github/workflows/ci.yml"
                and run["head_repository"]["full_name"] == REPO and run["head_branch"] == branch
                and run["head_sha"] == head)
    associations = run["pull_requests"]
    if associations == [] and merged_receipt:
        return metadata
    return metadata and any(pr["number"] == number and pr["head"]["sha"] == head and pr["head"]["ref"] == branch
                            and pr["base"]["sha"] == base and pr["base"]["ref"] == "main" for pr in associations)


def merge_message(number, head, base, run_id, attempt):
    return f"Official data CI: PR={number} head={head} base={base} run={run_id} attempt={attempt}"


def verify_merged_ci(number, branch, head, base):
    # Caller verifies merged_by, exact main release SHA, candidate tree equality and data-only policy.
    require(git("show", "-s", "--format=%P", "HEAD") == base and
            git("show", "-s", "--format=%s", "HEAD") == PREFIX + str(number), "Squash target or parent mismatch")
    body = git("show", "-s", "--format=%b", "HEAD")
    pattern = (rf"Official data CI: PR={number} head={re.escape(head)} base={re.escape(base)} "
               r"run=([1-9][0-9]*) attempt=([1-9][0-9]*)")
    receipt = re.fullmatch(pattern, body)
    require(receipt, "Missing exact premerge CI receipt in the release commit")
    run_id, attempt = map(int, receipt.groups())
    run = api(f"actions/runs/{run_id}/attempts/{attempt}")
    require(run["id"] == run_id and run["run_attempt"] == attempt and run["status"] == "completed"
            and matches_pr(run, number, branch, head, base, merged_receipt=True), "Recorded CI attempt does not match release")
    verify_jobs(run)


def attempt_jobs(run_id, attempt):
    return items(f"actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100", "jobs")


def verify_jobs(run):
    jobs = {}
    for attempt in range(run["run_attempt"], 0, -1):
        for job in attempt_jobs(run["id"], attempt):
            jobs.setdefault(job["name"], job)
    passed = {name for name, job in jobs.items() if job["conclusion"] == "success"}
    seed = any(step["name"] == "Validate the latest publication seed through the local API"
               and step["conclusion"] == "success" for step in jobs.get("e2e", {}).get("steps", []))
    require(run["conclusion"] == "success" and passed >= {"verify", "e2e", "high-risk-review"} and seed,
            f"Exact pull-request CI and publication seed require review: {run['html_url']}")


def ci(number, branch, head, base):
    path = f"actions/workflows/{CI}/runs?event=pull_request&head_sha={head}&per_page=100"
    def matching():
        return [r for r in api(path)["workflow_runs"] if matches_pr(r, number, branch, head, base)]

    requested_attempts = set()
    for _ in range(100):
        runs = matching()
        if runs and runs[0]["status"] == "completed":
            run = runs[0]
            checks = items(f"actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs?per_page=100", "jobs")
            attempt = (run["id"], run["run_attempt"])
            if run["run_attempt"] < 3 and transient_ci(run, checks):
                if attempt not in requested_attempts:
                    api(f"actions/runs/{run['id']}/rerun", "POST")
                    requested_attempts.add(attempt)
                time.sleep(15)
                continue
            verify_jobs(run)
            return attempt
        time.sleep(15)
    raise ValueError("Timed out waiting for exact candidate CI; reconciliation will retry")


def publish(sha, pr):
    receipts = items(f"commits/{sha}/statuses?per_page=100")
    if any(s["context"] == "official-data/publication" and s["state"] == "success"
           and s["creator"]["login"] == BOT for s in receipts):
        return True
    title = "Publish official data " + sha
    # A later unrelated main commit changes workflow_dispatch head_sha; use the immutable input in run-name.
    runs = items(f"actions/workflows/{PUBLISH}/runs?event=workflow_dispatch&branch=main&per_page=100", "workflow_runs")
    matching = [r for r in runs if r["display_title"] == title]
    for run in matching:
        jobs = items(f"actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs?per_page=100", "jobs")
        for job in jobs:
            if job["name"] != "publish":
                continue
            steps = {s["name"]: s["conclusion"] for s in job["steps"]}
            verified = steps.get("Verify D1, public snapshot and publication receipt") == "success"
            if run["conclusion"] == job["conclusion"] == "success" and verified and run["head_sha"] == sha:
                api(f"statuses/{sha}", "POST", state="success", context="official-data/publication",
                    description="Verified D1 and public publication receipt", target_url=run["html_url"])
                return True
            write = steps.get("Import publication data")
            restored = steps.get("Recover previous D1 and verify public readback")
            if run["status"] == "completed" and write not in (None, "skipped") and restored != "success":
                note(pr, f"Publication {sha} needs production recovery review. {run['html_url']}")
                raise RuntimeError("Publication attempted a write without confirmed recovery")
    if any(r["status"] != "completed" for r in matching):
        return False
    if api("git/ref/heads/main")["object"]["sha"] != sha:
        note(pr, f"Publication {sha} is pending and main advanced. Reconcile the production receipt before further automatic merges.")
        raise RuntimeError("Pending production release needs operator reconciliation")
    dispatch(PUBLISH, "main", expected_sha=sha)
    print("Dispatched exact production data release", sha, flush=True)
    return False


def reconcile(pr, match):
    number, head, branch = pr["number"], pr["head"]["sha"], pr["head"]["ref"]
    original = attest(pr, match)
    git("fetch", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main")
    main = git("rev-parse", "origin/main")
    require(head == original, "PR head differs from immutable producer receipt")
    require(git("show", "-s", "--format=%P", head) == main,
            "Candidate is behind main; waiting for a fresh producer PR")
    validate(main, head, branch)
    run_id, attempt = ci(number, branch, head, main)
    require(api("git/ref/heads/main")["object"]["sha"] == main, "Main advanced during CI; retrying on the next reconciliation")
    result = api(f"pulls/{number}/merge", "PUT", sha=head, merge_method="squash",
                 commit_title=PREFIX + str(number), commit_message=merge_message(number, head, main, run_id, attempt))
    require(result["merged"], "Protected branch refused merge")
    return result["sha"]


def main():
    require(APP != BOT and re.fullmatch(r"[a-z0-9][a-z0-9-]*\[bot\]", APP),
            "Set OFFICIAL_DATA_APP_LOGIN to the dedicated pull-request App login")
    # The squash commit is a durable outbox entry even if the runner dies before dispatch.
    last = git("log", "origin/main", "--first-parent", "-1", "--grep=^" + PREFIX + "[0-9][0-9]*$",
               "--format=%H %s")
    if last:
        sha, subject = last.split(" ", 1)
        number = int(subject.removeprefix(PREFIX))
        pr = api(f"pulls/{number}")
        require(pr["merged"] and pr["merge_commit_sha"] == sha and pr["user"]["login"] == APP,
                "Invalid official release history")
        if not publish(sha, number):
            return
    for pr in items("pulls?state=open&base=main&sort=created&direction=asc&per_page=100"):
        match = policy["BRANCH"].fullmatch(pr["head"]["ref"])
        if not match or pr["user"]["login"] != APP or pr["head"]["repo"]["full_name"] != REPO:
            continue
        try:
            merged_sha = reconcile(pr, match)
        except GitHubError as e:
            if e.status not in {404, 409, 422}:
                raise
            note(pr["number"], f"Automatic admission held at {pr['head']['sha']}. GitHub declined the candidate request ({e}).")
            continue
        except (ValueError, KeyError) as e:
            note(pr["number"], f"Automatic admission held for review at {pr['head']['sha']}. {e}")
            continue
        publish(merged_sha, pr["number"])
        return


if __name__ == "__main__":
    if len(sys.argv) == 6 and sys.argv[1] == "verify-ci":
        verify_merged_ci(int(sys.argv[2]), *sys.argv[3:])
    elif len(sys.argv) == 1:
        main()
    else:
        sys.exit("Usage: auto-official-reconcile.py [verify-ci PR BRANCH HEAD BASE]")
