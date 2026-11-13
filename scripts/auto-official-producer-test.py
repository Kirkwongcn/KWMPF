"""Exercise the real Git bundle and push path against a local bare repository."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("producer", Path(__file__).with_name("auto-official-producer.py"))
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)


class Producer(unittest.TestCase):
    def test_retry_uses_original_commit_and_app_only_for_creation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            original_dir = os.getcwd()
            repo, remote, plan = root / "repo", root / "remote", root / "plan"
            repo.mkdir()
            plan.mkdir()
            os.chdir(repo)
            try:
                cmd = producer.cmd
                cmd("git", "init", "--bare", str(remote))
                cmd("git", "init", "-b", "main")
                cmd("git", "config", "user.name", "Fixture")
                cmd("git", "config", "user.email", "fixture@example.test")
                cmd("git", "remote", "add", "origin", str(remote))
                cmd("git", "commit", "--allow-empty", "-m", "base")
                base = cmd("git", "rev-parse", "HEAD")
                branch = "data/trustee-returns-2026-10-31-123"
                cmd("git", "switch", "-c", branch)
                (repo / "data.json").write_text("[1]")
                cmd("git", "add", "data.json")
                cmd("git", "commit", "-m", "official candidate")
                head = cmd("git", "rev-parse", "HEAD")
                body = root / "summary.md"
                body.write_text("verified source")
                state = {"fail": True, "prs": [], "tokens": []}

                def tool(*args, token=None):
                    if args[0] == "git":
                        self.assertIsNone(token)
                        return cmd(*args)
                    if args[1] == "api":
                        self.assertIsNone(token)
                        return json.dumps(state["prs"])
                    self.assertEqual(args[1:3], ("pr", "create"))
                    state["tokens"].append(token)
                    if state["fail"]:
                        raise subprocess.CalledProcessError(1, "gh")
                    state["prs"] = [{"user": {"login": "data-app[bot]"}, "head": {"sha": head,
                        "repo": {"full_name": "test/kwmpf"}}, "state": "open"}]
                    return ""

                env = dict(GITHUB_RUN_ID="123", GITHUB_SHA=base, GITHUB_REPOSITORY="test/kwmpf",
                           GITHUB_REPOSITORY_OWNER="test", GH_TOKEN="workflow", APP_TOKEN="app-token",
                           AUTOPUBLISH="1", APP_SLUG="data-app", APP_LOGIN="data-app[bot]")
                with patch.dict(os.environ, env), patch.object(producer, "cmd", side_effect=tool):
                    producer.prepare(plan, branch, "title", body)
                    cmd("git", "switch", "main")
                    with self.assertRaises(subprocess.CalledProcessError):
                        producer.open_pr(plan)
                    self.assertFalse((root / "candidate-head.txt").exists())
                    self.assertEqual(cmd("git", "ls-remote", "origin", "refs/heads/" + branch).split()[0], head)
                    state["fail"] = False
                    producer.open_pr(plan)
                    producer.open_pr(plan)
                    self.assertEqual((root / "candidate-head.txt").read_text().strip(), head)
                    self.assertEqual(state["tokens"], ["app-token", "app-token"])
                    cmd("git", "commit", "--allow-empty", "-m", "divergent")
                    cmd("git", "push", "--force", "origin", "HEAD:refs/heads/" + branch)
                    with self.assertRaisesRegex(ValueError, "Existing branch differs"):
                        producer.open_pr(plan)
            finally:
                os.chdir(original_dir)


if __name__ == "__main__":
    unittest.main()
