#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("fetch-trustee-fact-sheets.py")
SPEC = importlib.util.spec_from_file_location("fetch_trustee_fact_sheets", SCRIPT_PATH)
assert SPEC and SPEC.loader
fetcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetcher)


class TrusteeFactSheetDownloadTests(unittest.TestCase):
    def test_current_official_link_batch_expands_to_all_58_pdfs(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        path = repo_root / "data/sources/2026-08-31/trustee-fact-sheet-links.json"
        rows = fetcher.flatten_links(json.loads(path.read_text(encoding="utf-8")))

        self.assertEqual(len(rows), 58)
        self.assertEqual(len({row["id"] for row in rows}), 58)
        self.assertEqual(sum(row["scheme"] == "MASS Mandatory Provident Fund Scheme" for row in rows), 14)
        self.assertEqual(sum(row["scheme"] == "Fidelity Retirement Master Trust" for row in rows), 23)
        self.assertTrue(all(row["factSheetUrl"].startswith("https://") for row in rows))
        self.assertTrue(all(row["file"].startswith("pdf/") and row["file"].endswith(".pdf") for row in rows))

    def test_rejects_insecure_urls_and_path_like_source_names(self) -> None:
        base = {"scheme": "Example Scheme", "factSheetUrl": "https://example.test/factsheets"}
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            fetcher.flatten_links([{**base, "factSheetUrl": "http://example.test/factsheet.pdf", "file": "a.pdf"}])
        with self.assertRaisesRegex(ValueError, "plain PDF filename"):
            fetcher.flatten_links([{**base, "file": "../factsheet.pdf"}])

    def test_rejects_ambiguous_fund_and_duplicate_source_entries(self) -> None:
        base = {"scheme": "Example Scheme", "factSheetUrl": "https://example.test/index"}
        duplicate_funds = [
            {
                "constituentFund": "Fund A",
                "factSheetUrl": "https://example.test/a.pdf",
                "file": "a.pdf",
            },
            {
                "constituentFund": "Fund A",
                "factSheetUrl": "https://example.test/b.pdf",
                "file": "b.pdf",
            },
        ]
        with self.assertRaisesRegex(ValueError, "duplicate factsheet identity"):
            fetcher.flatten_links([{**base, "funds": duplicate_funds}])
        with self.assertRaisesRegex(ValueError, "duplicate factsheet identity"):
            fetcher.flatten_links(
                [
                    {"scheme": "Example Scheme", "factSheetUrl": "https://example.test/a.pdf", "file": "a.pdf"},
                    {"scheme": "Example Scheme", "factSheetUrl": "https://example.test/b.pdf", "file": "b.pdf"},
                ]
            )

    def test_records_successes_and_failures_and_resumes_valid_downloads(self) -> None:
        with tempfile.TemporaryDirectory(prefix="kwmpf-factsheet-") as temporary:
            root = Path(temporary)
            batch = "2026-08-31"
            links_path = root / "data" / "sources" / batch / "trustee-fact-sheet-links.json"
            links_path.parent.mkdir(parents=True)
            links = [
                {
                    "scheme": "Direct Scheme",
                    "factSheetUrl": "https://example.test/direct.pdf",
                    "file": "direct.pdf",
                },
                {
                    "scheme": "Grouped Scheme",
                    "factSheetUrl": "https://example.test/index",
                    "funds": [
                        {
                            "constituentFund": "Fund A",
                            "factSheetUrl": "https://example.test/fund-a.pdf",
                            "file": "fund-a.pdf",
                        },
                        {
                            "constituentFund": "Fund B",
                            "factSheetUrl": "https://example.test/fund-b.pdf",
                            "file": "fund-b.pdf",
                        },
                    ],
                },
            ]
            links_path.write_text(json.dumps(links), encoding="utf-8")
            output_dir = root / "archive"
            calls: list[str] = []

            def first_download(url: str, destination: Path) -> tuple[int, str]:
                calls.append(url)
                if url.endswith("fund-b.pdf"):
                    raise RuntimeError("source unavailable")
                payload = b"%PDF-1.7\nexample"
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(payload)
                return len(payload), hashlib.sha256(payload).hexdigest()

            first = fetcher.fetch_trustee_fact_sheets(
                batch,
                "0" * 40,
                links_path,
                output_dir,
                root,
                downloader=first_download,
            )
            self.assertEqual((first["plannedCount"], first["downloadedCount"], first["failedCount"]), (3, 2, 1))
            self.assertTrue(all(entry["status"] == "downloaded" for entry in first["entries"][:2]))
            self.assertEqual(first["entries"][2]["status"], "failed")
            self.assertNotIn("example.test", first["entries"][2]["error"])

            retry_calls: list[str] = []

            def retry_download(url: str, destination: Path) -> tuple[int, str]:
                retry_calls.append(url)
                payload = b"%PDF-1.7\nrecovered"
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(payload)
                return len(payload), hashlib.sha256(payload).hexdigest()

            second = fetcher.fetch_trustee_fact_sheets(
                batch,
                "0" * 40,
                links_path,
                output_dir,
                root,
                downloader=retry_download,
            )
            self.assertEqual(len(retry_calls), 1)
            self.assertTrue(retry_calls[0].endswith("fund-b.pdf"))
            self.assertEqual((second["downloadedCount"], second["failedCount"]), (3, 0))


if __name__ == "__main__":
    unittest.main()

\n