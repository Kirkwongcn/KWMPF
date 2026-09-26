#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import os
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("package-trustee-fact-sheet-archive.sh")
BATCH = "2026-08-31"
RUN_ID = "123456789"
HEAD_SHA = "a" * 40
ARTIFACT_NAME = f"trustee-fact-sheets-{BATCH}-{RUN_ID}"
CREATED_AT = "2026-09-27T00:00:00Z"


def entry(scheme: str, source_file: str, payload: bytes | None, fund: str = "") -> dict[str, object]:
    identity = hashlib.sha256("\0".join((scheme, fund, source_file)).encode()).hexdigest()
    row: dict[str, object] = {
        "id": identity,
        "scheme": scheme,
        "sourceFile": source_file,
        "factSheetUrl": f"https://example.test/{source_file}",
        "file": f"pdf/{identity}.pdf",
        "status": "downloaded" if payload is not None else "failed",
        "retrievedAt": CREATED_AT,
        "bytes": len(payload) if payload is not None else 0,
    }
    if fund:
        row["constituentFund"] = fund
        row["factSheetIndexUrl"] = "https://example.test/index"
    if payload is not None:
        row["sha256"] = hashlib.sha256(payload).hexdigest()
    else:
        row["error"] = "RuntimeError: source unavailable"
    return row


def prepare_artifact(root: Path, tamper_sha: bool = False) -> Path:
    root.mkdir(parents=True)
    pdf_root = root / "pdf"
    pdf_root.mkdir()
    payload = b"%PDF-1.7\nsource document"
    downloaded = entry("Example Scheme", "example.pdf", payload)
    failed = entry("Grouped Scheme", "failed.pdf", None, "Fund A")
    if tamper_sha:
        downloaded["sha256"] = "0" * 64
    (pdf_root / Path(str(downloaded["file"])).name).write_bytes(payload)
    manifest = {
        "schemaVersion": 1,
        "sourceBatch": BATCH,
        "sourceCommitSha": HEAD_SHA,
        "sourceLinkManifestPath": f"data/sources/{BATCH}/trustee-fact-sheet-links.json",
        "sourceLinkManifestSha256": "b" * 64,
        "plannedCount": 2,
        "downloadedCount": 1,
        "failedCount": 1,
        "entries": [downloaded, failed],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return root


class PackageTrusteeFactsheetArchiveTests(unittest.TestCase):
    def run_packager(self, artifact: Path, destination: Path) -> subprocess.CompletedProcess[str]:
        archive = destination / "raw-fact-sheets.tar.gz"
        index = destination / "index.json"
        destination.mkdir(parents=True)
        return subprocess.run(
            [
                os.environ.get("KWMPF_BASH", "bash"),
                str(SCRIPT),
                str(artifact),
                BATCH,
                RUN_ID,
                HEAD_SHA,
                ARTIFACT_NAME,
                CREATED_AT,
                str(archive),
                str(index),
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

    def test_packages_reproducibly_and_records_partial_fetches(self) -> None:
        if os.name == "nt" and "KWMPF_BASH" not in os.environ:
            self.skipTest("set KWMPF_BASH to a POSIX bash executable on Windows")
        if not os.environ.get("KWMPF_BASH") and not shutil.which("bash"):
            self.skipTest("bash is required for the shell packager")

        with tempfile.TemporaryDirectory(prefix="kwmpf-package-") as temporary:
            root = Path(temporary)
            artifact = prepare_artifact(root / "artifact")
            first = self.run_packager(artifact, root / "first")
            second = self.run_packager(artifact, root / "second")
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)

            first_archive = (root / "first/raw-fact-sheets.tar.gz").read_bytes()
            second_archive = (root / "second/raw-fact-sheets.tar.gz").read_bytes()
            self.assertEqual(first_archive, second_archive)
            index = json.loads((root / "first/index.json").read_text(encoding="utf-8"))
            self.assertEqual(index["sourceBatch"], BATCH)
            self.assertEqual(index["counts"], {"planned": 2, "downloaded": 1, "failed": 1})
            self.assertEqual(index["sourceLinkManifest"]["sha256"], "b" * 64)
            self.assertEqual(index["archive"]["sha256"], hashlib.sha256(first_archive).hexdigest())
            self.assertEqual(index["archive"]["bytes"], len(first_archive))

    def test_rejects_a_pdf_that_does_not_match_its_manifest(self) -> None:
        if os.name == "nt" and "KWMPF_BASH" not in os.environ:
            self.skipTest("set KWMPF_BASH to a POSIX bash executable on Windows")
        if not os.environ.get("KWMPF_BASH") and not shutil.which("bash"):
            self.skipTest("bash is required for the shell packager")

        with tempfile.TemporaryDirectory(prefix="kwmpf-package-invalid-") as temporary:
            root = Path(temporary)
            artifact = prepare_artifact(root / "artifact", tamper_sha=True)
            result = self.run_packager(artifact, root / "output")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("failed its byte count or SHA-256 check", result.stderr)


if __name__ == "__main__":
    unittest.main()


\n