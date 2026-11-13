"""Reconcile attested data PRs from trusted main. Never check out a candidate."""
import io
import json
import os
import re
import subprocess
import time
import zipfile
from pathlib import Path
from runpy import run_path

policy = run_path(str(Path(__file__).with_name("auto-official-policy.py")))
git, require, validate = (policy[k] for k in ("git", "require", "validate"))
REPO = os.environ["GITHUB_REPOSITORY"]
BOT = "github-actions[bot]"
CI = "ci.yml"
PUBLISH = "publish-official-data.yml"
PREFIX = "Automatic official data PR #"


def gh(*args):
    return subprocess.check_output(["gh", *map(str, args)])


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
    require(pr["user"]["login"] == BOT and pr["head"]["repo"]["full_name"] == REPO
            and pr["base"]["ref"] == "main" and not pr["draft"], "PR provenance or target mismatch")
    producer = "refresh-source-snapshot.yml" if match[1] == "source-snapshot" else "refresh-trustee-returns.yml"
    run = api(f"actions/runs/{match[3]}")
    require(run["head_branch"] == "main" and run["head_repository"]["full_name"] == REPO
            and run["path"] == ".github/workflows/" + producer and run["conclusion"] == "success"
            and run["event"] in ("workflow_dispatch", "schedule"), "Missing successful trusted main producer run")
    name = f"official-data-pr-{run['id']}-{run['run_attempt']}"
    receipts = items(f"actions/runs/{run['id']}/artifacts?name={name}", "artifacts")
    require(len(receipts) == 1 and not receipts[0]["expired"], "Missing immutable producer receipt")
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


def diff_signature(base, head):
    # Full blob IDs, modes and paths prevent content substitutions during branch updates.
    return git("diff", "--raw", "--no-abbrev", "--no-renames", base, head)


def ci(branch, head, base):
    path = f"actions/workflows/{CI}/runs?event=workflow_dispatch&head_sha={head}&per_page=100"
    def matching():
        return [r for r in api(path)["workflow_runs"] if r["head_branch"] == branch]

    runs = matching()
    if not runs:
        dispatch(CI, branch, base_sha=base)
    for _ in range(100):
        runs = matching()
        if runs and runs[0]["status"] == "completed":
            run = runs[0]
            checks = items(f"actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs?per_page=100", "jobs")
            require(run["conclusion"] == "success" and
                    {j["name"] for j in checks if j["conclusion"] == "success"} >= {"verify", "e2e", "high-risk-review"},
                    f"Exact candidate checks require review: {run['html_url']}")
            return
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
    old_base = git("rev-parse", original + "^")
    current_base = git("merge-base", main, head)
    require(subprocess.run(["git", "merge-base", "--is-ancestor", original, head]).returncode == 0
            and diff_signature(old_base, original) == diff_signature(current_base, head),
            "Candidate differs from the producer's attested changes")
    validate(current_base, head, branch)
    # Even a prior update-branch merge cannot carry evidence across changed canonical inputs.
    if old_base != main:
        for pattern in (policy["SOURCE"], policy["OVERLAY"]):
            old, new = (policy["latest"](ref, pattern) for ref in (old_base, main))
            require(old == new and git("rev-parse", old_base + ":" + old) == git("rev-parse", main + ":" + new),
                    "Canonical data advanced; rebuild the producer candidate")
    if current_base != main:
        api(f"pulls/{number}/update-branch", "PUT", expected_head_sha=head)
        print(f"Updated PR #{number} to main; checking the resulting exact tree")
        for _ in range(20):
            time.sleep(3)
            updated = api(f"pulls/{number}")
            if updated["head"]["sha"] != head:
                return reconcile_current(updated, original, main, old_base)
        raise ValueError("Branch update pending; the next reconciliation will retry")
    return reconcile_current(pr, original, main, old_base)


def reconcile_current(pr, original, main, old_base):
    number, head, branch = pr["number"], pr["head"]["sha"], pr["head"]["ref"]
    git("fetch", "--no-tags", "origin", f"refs/pull/{number}/head")
    require(git("rev-parse", "FETCH_HEAD") == head and git("merge-base", main, head) == main
            and diff_signature(main, head) == diff_signature(old_base, original), "Updated candidate changed")
    validate(main, head, branch)
    ci(branch, head, main)
    require(api("git/ref/heads/main")["object"]["sha"] == main, "Main advanced during CI; retrying on the next reconciliation")
    result = api(f"pulls/{number}/merge", "PUT", sha=head, merge_method="squash",
                 commit_title=PREFIX + str(number), commit_message=f"Official source producer: {original}")
    require(result["merged"], "Protected branch refused merge")
    publish(result["sha"], number)


def main():
    # The squash commit is a durable outbox entry even if the runner dies before dispatch.
    last = git("log", "origin/main", "--first-parent", "-1", "--grep=^" + PREFIX + "[0-9][0-9]*$",
               "--format=%H %s")
    if last:
        sha, subject = last.split(" ", 1)
        number = int(subject.removeprefix(PREFIX))
        pr = api(f"pulls/{number}")
        require(pr["merged"] and pr["merge_commit_sha"] == sha and pr["user"]["login"] == BOT,
                "Invalid official release history")
        if not publish(sha, number):
            return
    for pr in items("pulls?state=open&base=main&sort=created&direction=asc&per_page=100"):
        match = policy["BRANCH"].fullmatch(pr["head"]["ref"])
        if not match or pr["user"]["login"] != BOT or pr["head"]["repo"]["full_name"] != REPO:
            continue
        try:
            reconcile(pr, match)
        except (ValueError, KeyError) as e:
            note(pr["number"], f"Automatic admission held for review at {pr['head']['sha']}. {e}")
            continue
        return


if __name__ == "__main__":
    main()
