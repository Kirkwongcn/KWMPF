"""Prepare an immutable candidate before pushing; resume it across attempts."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def cmd(*args, token=None):
    env = os.environ.copy()
    if token is not None:
        env["GH_TOKEN"] = token
    return subprocess.check_output(args, env=env, text=True, encoding="utf-8").strip()


def ensure(ok, message):
    if not ok:
        raise ValueError(message)


def recover(plan):
    attempt = int(os.environ["GITHUB_RUN_ATTEMPT"])
    if attempt == 1:
        return
    run = os.environ["GITHUB_RUN_ID"]
    repo = os.environ["GITHUB_REPOSITORY"]
    pages = json.loads(cmd("gh", "api", "--paginate", "--slurp",
                           f"repos/{repo}/actions/runs/{run}/artifacts?per_page=100"))
    prefix = f"official-pr-plan-{run}-"
    previous = sorted(int(a["name"][len(prefix):]) for page in pages for a in page["artifacts"]
                      if not a["expired"] and re.fullmatch(prefix + r"[1-9][0-9]*", a["name"])
                      and int(a["name"][len(prefix):]) < attempt)
    if previous:
        cmd("gh", "run", "download", run, "--name", f"{prefix}{previous[0]}", "--dir", str(plan), "--repo", repo)
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write("recovered=true\n")


def prepare(plan, branch, title, body):
    head = cmd("git", "rev-parse", "HEAD")
    (plan / "pr.json").write_text(json.dumps(dict(branch=branch, title=title, head=head)), encoding="utf-8")
    shutil.copyfile(body, plan / "body.md")
    cmd("git", "bundle", "create", str(plan / "candidate.bundle"), "refs/heads/" + branch, "^" + os.environ["GITHUB_SHA"])


def open_pr(plan):
    repo = os.environ["GITHUB_REPOSITORY"]
    owner = os.environ["GITHUB_REPOSITORY_OWNER"]
    props = json.loads((plan / "pr.json").read_text(encoding="utf-8"))
    branch, head = props["branch"], props["head"]
    match = re.fullmatch(r"data/(?:source-snapshot|trustee-returns)-\d{4}-\d{2}-\d{2}-([1-9][0-9]*)", branch)
    ensure(match and match[1] == os.environ["GITHUB_RUN_ID"] and re.fullmatch("[0-9a-f]{40}", head), "Invalid candidate receipt")
    if os.getenv("AUTOPUBLISH") == "1":
        token, expected, slug = (os.environ[k] for k in ("APP_TOKEN", "APP_LOGIN", "APP_SLUG"))
        ensure(token and slug and slug + "[bot]" == expected, "Unexpected PR App identity")
    else:
        token, expected = os.environ["GH_TOKEN"], "github-actions[bot]"
    ref = "refs/heads/" + branch
    bundle = str(plan / "candidate.bundle")
    cmd("git", "bundle", "verify", bundle)
    cmd("git", "fetch", "--no-tags", bundle, ref)
    ensure(cmd("git", "rev-parse", "FETCH_HEAD") == head and
           cmd("git", "show", "-s", "--format=%P", head) == os.environ["GITHUB_SHA"], "Producer commit mismatch")
    remote = cmd("git", "ls-remote", "--heads", "origin", ref)
    if remote:
        ensure(remote.split() == [head, ref], "Existing branch differs from prepared candidate")
    else:
        cmd("git", "push", "origin", f"{head}:{ref}")

    def lookup():
        return json.loads(cmd("gh", "api", "-X", "GET", f"repos/{repo}/pulls", "-f", "state=all",
                              "-f", "base=main", "-f", f"head={owner}:{branch}"))

    prs = lookup()
    if not prs:
        cmd("gh", "pr", "create", "--repo", repo, "--base", "main", "--head", branch,
            "--title", props["title"], "--body-file", str(plan / "body.md"), token=token)
        prs = lookup()
    ensure(len(prs) == 1 and prs[0]["user"]["login"] == expected and prs[0]["head"]["sha"] == head
           and prs[0]["head"]["repo"]["full_name"] == repo and (prs[0]["state"] == "open" or prs[0]["merged_at"]),
           "PR does not match the original producer commit and expected author")
    (plan.parent / "candidate-head.txt").write_text(head + "\n", encoding="ascii")


if __name__ == "__main__":
    plan = Path(os.environ["RUNNER_TEMP"]) / "official-pr-plan"
    plan.mkdir(exist_ok=True)
    {"recover": recover, "prepare": prepare, "open": open_pr}[sys.argv[1]](plan, *sys.argv[2:])
