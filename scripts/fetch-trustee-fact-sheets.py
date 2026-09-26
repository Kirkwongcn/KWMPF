#!/usr/bin/env python3
"""Fetch and checksum the official trustee factsheet PDFs for one dated source batch."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

MAX_PDF_BYTES = 100 * 1024 * 1024
CHUNK_BYTES = 256 * 1024
MAX_ATTEMPTS = 3
BATCH_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")


class DownloadFailure(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


def validate_batch(value: str) -> str:
    if not BATCH_PATTERN.fullmatch(value):
        raise ValueError("source_batch must use YYYY-MM-DD")
    try:
        if date.fromisoformat(value).isoformat() != value:
            raise ValueError
    except ValueError as error:
        raise ValueError("source_batch must be a real calendar date") from error
    return value


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} is required")
    return value.strip()


def _https_url(value: object, label: str) -> str:
    url = _required_text(value, label)
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f"{label} must be an HTTPS URL without embedded credentials")
    return url


def _pdf_filename(value: object, label: str) -> str:
    name = _required_text(value, label)
    if name in {".", ".."} or "/" in name or "\\" in name or not name.lower().endswith(".pdf"):
        raise ValueError(f"{label} must be a plain PDF filename")
    return name


def _download_id(scheme: str, constituent_fund: str, source_file: str) -> str:
    identity = "\0".join((scheme, constituent_fund, source_file)).encode("utf-8")
    return hashlib.sha256(identity).hexdigest()


def flatten_links(raw_links: object) -> list[dict[str, str]]:
    if not isinstance(raw_links, list) or not raw_links:
        raise ValueError("trustee factsheet link manifest must be a non-empty array")

    flattened: list[dict[str, str]] = []
    identities: set[tuple[str, str]] = set()
    files_by_scheme: set[tuple[str, str]] = set()

    for index, raw in enumerate(raw_links):
        if not isinstance(raw, dict):
            raise ValueError(f"links[{index}] must be an object")
        scheme = _required_text(raw.get("scheme"), f"links[{index}].scheme")
        index_url = _https_url(raw.get("factSheetUrl"), f"links[{index}].factSheetUrl")
        funds = raw.get("funds")

        if funds is not None:
            if raw.get("file"):
                raise ValueError(f"{scheme} must use either file or funds, not both")
            if not isinstance(funds, list) or not funds:
                raise ValueError(f"{scheme}.funds must be a non-empty array")
            source_items = []
            for fund_index, fund in enumerate(funds):
                if not isinstance(fund, dict):
                    raise ValueError(f"{scheme}.funds[{fund_index}] must be an object")
                constituent_fund = _required_text(
                    fund.get("constituentFund"),
                    f"{scheme}.funds[{fund_index}].constituentFund",
                )
                source_items.append(
                    (
                        constituent_fund,
                        _https_url(
                            fund.get("factSheetUrl"),
                            f"{scheme}.funds[{fund_index}].factSheetUrl",
                        ),
                        _pdf_filename(
                            fund.get("file"),
                            f"{scheme}.funds[{fund_index}].file",
                        ),
                    )
                )
        else:
            source_items = [
                (
                    "",
                    index_url,
                    _pdf_filename(raw.get("file"), f"{scheme}.file"),
                )
            ]

        for constituent_fund, pdf_url, source_file in source_items:
            identity = (scheme, constituent_fund)
            file_identity = (scheme, source_file)
            if identity in identities:
                raise ValueError(f"duplicate factsheet identity in source manifest: {scheme}")
            if file_identity in files_by_scheme:
                raise ValueError(f"duplicate PDF filename in source manifest: {scheme} / {source_file}")
            identities.add(identity)
            files_by_scheme.add(file_identity)
            item = {
                "id": _download_id(scheme, constituent_fund, source_file),
                "scheme": scheme,
                "sourceFile": source_file,
                "factSheetUrl": pdf_url,
                "file": f"pdf/{_download_id(scheme, constituent_fund, source_file)}.pdf",
            }
            if constituent_fund:
                item["constituentFund"] = constituent_fund
                item["factSheetIndexUrl"] = index_url
            flattened.append(item)

    ids = [item["id"] for item in flattened]
    if len(ids) != len(set(ids)):
        raise ValueError("factsheet source manifest produced duplicate download identifiers")
    return flattened


def _safe_error(error: Exception) -> str:
    message = re.sub(r"https?://[^\s\"'<>]+", "[url]", str(error))
    message = re.sub(r"([?&][^=\s]+)=([^&\s]+)", r"\1=[redacted]", message)
    message = " ".join(message.split())
    return f"{type(error).__name__}: {message}"[:500]


def download_pdf(url: str, destination: Path) -> tuple[int, str]:
    try:
        from curl_cffi import requests
    except ImportError as error:
        raise RuntimeError(
            "curl_cffi is required; install requirements-source-archive.txt"
        ) from error

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    last_error: Exception | None = None

    for attempt in range(MAX_ATTEMPTS):
        temporary.unlink(missing_ok=True)
        session = requests.Session(impersonate="chrome124")
        response = None
        try:
            response = session.get(
                url,
                headers={"Accept-Encoding": "identity"},
                allow_redirects=True,
                stream=True,
                timeout=(20, 90),
            )
            status = int(response.status_code)
            if status != 200:
                raise DownloadFailure(
                    f"HTTP {status}",
                    retryable=status == 429 or status >= 500,
                )
            final_url = urlsplit(str(response.url))
            if final_url.scheme != "https" or not final_url.hostname:
                raise DownloadFailure("redirected PDF URL is not HTTPS")

            content_length_value = response.headers.get("content-length")
            content_encoding = response.headers.get("content-encoding", "identity").lower()
            expected_length: int | None = None
            if content_length_value is not None:
                try:
                    expected_length = int(content_length_value)
                except ValueError as error:
                    raise DownloadFailure("PDF content length is invalid") from error
                if expected_length <= 0:
                    raise DownloadFailure("PDF content length is not positive")
                if expected_length > MAX_PDF_BYTES:
                    raise DownloadFailure("PDF exceeds the 100 MiB safety limit")

            digest = hashlib.sha256()
            total = 0
            with temporary.open("wb") as output:
                for chunk in response.iter_content(chunk_size=CHUNK_BYTES):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > MAX_PDF_BYTES:
                        raise DownloadFailure("PDF exceeds the 100 MiB safety limit")
                    digest.update(chunk)
                    output.write(chunk)

            if total < 5:
                raise DownloadFailure("downloaded response is too short to be a PDF")
            with temporary.open("rb") as source:
                if source.read(5) != b"%PDF-":
                    raise DownloadFailure("response body does not have a PDF signature")
            if expected_length is not None and content_encoding in {"", "identity"}:
                if total != expected_length:
                    raise DownloadFailure("PDF content length does not match the response body")

            os.replace(temporary, destination)
            return total, digest.hexdigest()
        except DownloadFailure as error:
            last_error = error
            if not error.retryable or attempt + 1 >= MAX_ATTEMPTS:
                temporary.unlink(missing_ok=True)
                raise
        except Exception as error:
            last_error = error
            if attempt + 1 >= MAX_ATTEMPTS:
                temporary.unlink(missing_ok=True)
                raise DownloadFailure(_safe_error(error)) from error
        finally:
            if response is not None:
                response.close()
            session.close()

        time.sleep(2**attempt)

    raise DownloadFailure(_safe_error(last_error or RuntimeError("download failed")))


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _is_valid_cached(entry: dict[str, object], output_dir: Path, item: dict[str, str]) -> bool:
    if entry.get("status") != "downloaded":
        return False
    if any(entry.get(key) != item.get(key) for key in ("id", "scheme", "sourceFile", "factSheetUrl", "file")):
        return False
    file_name = item["file"]
    if not re.fullmatch(r"pdf/[0-9a-f]{64}\.pdf", file_name):
        return False
    path = output_dir / file_name
    try:
        if path.is_symlink() or not path.is_file():
            return False
        if path.stat().st_size != entry.get("bytes") or _sha256_file(path) != entry.get("sha256"):
            return False
        with path.open("rb") as source:
            return source.read(5) == b"%PDF-"
    except OSError:
        return False


def _write_manifest(output_dir: Path, base: dict[str, object], entries: list[dict[str, object]]) -> None:
    downloaded = sum(entry.get("status") == "downloaded" for entry in entries)
    manifest = {
        **base,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "plannedCount": len(entries),
        "downloadedCount": downloaded,
        "failedCount": len(entries) - downloaded,
        "entries": entries,
    }
    temporary = output_dir / "manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, output_dir / "manifest.json")


def fetch_trustee_fact_sheets(
    source_batch: str,
    source_commit_sha: str,
    links_path: Path,
    output_dir: Path,
    repo_root: Path,
    downloader=download_pdf,
) -> dict[str, object]:
    validate_batch(source_batch)
    if not SHA_PATTERN.fullmatch(source_commit_sha):
        raise ValueError("source commit must be a 40-character lowercase SHA")
    expected = repo_root.resolve() / "data" / "sources" / source_batch / "trustee-fact-sheet-links.json"
    if links_path.is_symlink() or links_path.resolve(strict=True) != expected.resolve(strict=True):
        raise ValueError("links path must be the dated trustee factsheet manifest in data/sources")
    links_bytes = links_path.read_bytes()
    links = json.loads(links_bytes)
    items = flatten_links(links)

    if output_dir.exists() and output_dir.is_symlink():
        raise ValueError("output directory must not be a symlink")
    output_dir.mkdir(parents=True, exist_ok=True)
    base: dict[str, object] = {
        "schemaVersion": 1,
        "sourceBatch": source_batch,
        "sourceCommitSha": source_commit_sha,
        "sourceLinkManifestPath": f"data/sources/{source_batch}/trustee-fact-sheet-links.json",
        "sourceLinkManifestSha256": hashlib.sha256(links_bytes).hexdigest(),
    }

    manifest_path = output_dir / "manifest.json"
    previous: dict[str, object] = {}
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        if any(previous.get(key) != value for key, value in base.items()):
            raise ValueError("existing archive manifest belongs to a different source batch or commit")
    previous_entries = previous.get("entries", [])
    if not isinstance(previous_entries, list):
        raise ValueError("existing archive manifest entries are invalid")
    previous_by_id = {
        str(entry.get("id")): entry
        for entry in previous_entries
        if isinstance(entry, dict) and entry.get("id")
    }

    entries: list[dict[str, object]] = []
    for item in items:
        existing = previous_by_id.get(item["id"])
        if isinstance(existing, dict) and _is_valid_cached(existing, output_dir, item):
            entries.append(existing)
            _write_manifest(output_dir, base, entries)
            continue

        row: dict[str, object] = {
            **item,
            "status": "failed",
            "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "bytes": 0,
        }
        destination = output_dir / item["file"]
        try:
            byte_count, sha256 = downloader(item["factSheetUrl"], destination)
            if byte_count <= 0 or not re.fullmatch(r"[0-9a-f]{64}", sha256):
                raise ValueError("downloader returned invalid byte count or SHA-256")
            if destination.is_symlink() or not destination.is_file() or destination.stat().st_size != byte_count:
                raise ValueError("downloaded PDF is missing or its byte count differs")
            with destination.open("rb") as source:
                if source.read(5) != b"%PDF-":
                    raise ValueError("downloaded response body does not have a PDF signature")
            if _sha256_file(destination) != sha256:
                raise ValueError("downloaded PDF SHA-256 differs from its manifest")
            row.update({"status": "downloaded", "bytes": byte_count, "sha256": sha256})
        except Exception as error:
            destination.unlink(missing_ok=True)
            row["error"] = _safe_error(error)
        entries.append(row)
        remaining = items[len(entries) :]
        _write_manifest(output_dir, base, entries + remaining)

    final_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    return final_manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-batch", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--links", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    repo_root = Path.cwd().resolve()
    manifest = fetch_trustee_fact_sheets(
        args.source_batch,
        args.source_commit,
        args.links,
        args.output_dir,
        repo_root,
    )
    print(
        json.dumps(
            {
                "sourceBatch": manifest["sourceBatch"],
                "plannedCount": manifest["plannedCount"],
                "downloadedCount": manifest["downloadedCount"],
                "failedCount": manifest["failedCount"],
                "sourceLinkManifestSha256": manifest["sourceLinkManifestSha256"],
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()


\n