#!/usr/bin/env python3
"""Read-only, portable KWMPF artifact retrieval. Never deploys or changes Git refs."""
import argparse
import datetime
import hashlib
import hmac
import json
import os
from pathlib import Path, PurePosixPath
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

BUCKET = "kwmpf-handoff"
HEX = re.compile(r"^[0-9a-f]{64}$")
PART = re.compile(r"^local-preservation-[0-9]{2}\.zip$")


def digest_file(path):
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def relative_path(value):
    if not isinstance(value, str) or "\\" in value or ":" in value or "\x00" in value:
        raise ValueError("Unsafe portable path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(p in {"..", ".git"} for p in path.parts):
        raise ValueError("Unsafe portable path")
    if path.parts[:1] not in [("workspace",), ("external",), ("git",), ("skills",)]:
        raise ValueError("Unexpected preservation root")
    return path


def check_file(path, expected):
    if path.stat().st_size != expected["bytes"] or digest_file(path) != expected["sha256"]:
        raise ValueError("Length or SHA-256 mismatch: " + path.name)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("R2 redirect refused")


def download_s3(key, destination, byte_limit):
    """Sign GET only. Keys must be scoped to approved handoff namespaces."""
    if not key.startswith(("handoffs/", "independence/")) or ".." in key.split("/"):
        raise ValueError("Unexpected R2 object namespace")
    endpoint = os.environ.get("R2_ENDPOINT", "").rstrip("/")
    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.scheme != "https" or not re.fullmatch(r"[0-9a-f]{32}\.r2\.cloudflarestorage\.com", parsed.netloc) or parsed.path:
        raise ValueError("Set R2_ENDPOINT to the account's HTTPS R2 S3 endpoint")
    access = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    if not access or not secret:
        raise ValueError("Independent bucket-scoped R2 read credentials are required")
    now = datetime.datetime.now(datetime.timezone.utc)
    date = now.strftime("%Y%m%d")
    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    uri = "/" + BUCKET + "/" + urllib.parse.quote(key, safe="/~-._")
    payload_hash = hashlib.sha256(b"").hexdigest()
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical = "\n".join(["GET", uri, "", "host:" + parsed.netloc + "\nx-amz-content-sha256:" + payload_hash + "\nx-amz-date:" + timestamp + "\n", signed_headers, payload_hash])
    scope = date + "/auto/s3/aws4_request"
    to_sign = "AWS4-HMAC-SHA256\n" + timestamp + "\n" + scope + "\n" + hashlib.sha256(canonical.encode()).hexdigest()
    signing_key = ("AWS4" + secret).encode()
    for value in [date, "auto", "s3", "aws4_request"]:
        signing_key = hmac.new(signing_key, value.encode(), hashlib.sha256).digest()
    signature = hmac.new(signing_key, to_sign.encode(), hashlib.sha256).hexdigest()
    headers = {"x-amz-date": timestamp, "x-amz-content-sha256": payload_hash, "Authorization": "AWS4-HMAC-SHA256 Credential=" + access + "/" + scope + ", SignedHeaders=" + signed_headers + ", Signature=" + signature}
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    request = urllib.request.Request(endpoint + uri, headers=headers, method="GET")
    with opener.open(request, timeout=120) as response, destination.open("xb") as output:
        written = 0
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            written += len(block)
            if written > byte_limit:
                raise ValueError("R2 response exceeds declared size")
            output.write(block)


def validate_archives(index, archive_dir, restore_root=None):
    objects = index["objects"]
    expected_names = set()
    for obj in objects:
        name = obj["filename"]
        if not PART.fullmatch(name) or name in expected_names:
            raise ValueError("Invalid or duplicate archive part")
        expected_names.add(name)
        check_file(archive_dir / name, obj)
    check_file(archive_dir / "base-handoff.zip", index["baseArchive"])
    archives = {name: zipfile.ZipFile(archive_dir / name) for name in expected_names}
    archives["base"] = zipfile.ZipFile(archive_dir / "base-handoff.zip")
    seen_paths = set()
    verified_blobs = set()
    restored = 0
    try:
        for row in index["files"]:
            path = relative_path(row["path"])
            if row["path"] in seen_paths or not HEX.fullmatch(row["sha256"]):
                raise ValueError("Duplicate path or invalid digest")
            seen_paths.add(row["path"])
            source = row["source"]
            part = source.get("part")
            if part:
                if part not in expected_names:
                    raise ValueError("Unknown archive part")
                archive = archives[part]
                entry = "blobs/" + row["sha256"]
            else:
                entries = source.get("baseEntries", [])
                if not entries:
                    raise ValueError("Missing preserved blob")
                archive = archives["base"]
                entry = entries[0]
            info = archive.getinfo(entry)
            if info.file_size != row["bytes"]:
                raise ValueError("Unexpected decompressed length")
            # Extraction follows verified manifest paths only; never extractall().
            body = archive.read(info)
            if hashlib.sha256(body).hexdigest() != row["sha256"]:
                raise ValueError("Preserved blob checksum mismatch")
            verified_blobs.add(row["sha256"])
            if restore_root is not None:
                target = restore_root.joinpath(*path.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as handle:
                    handle.write(body)
            restored += 1
    finally:
        for archive in archives.values():
            archive.close()
    return {"pathsVerified": restored, "uniqueBlobsVerified": len(verified_blobs), "archivesVerified": len(archives), "filesExtracted": restore_root is not None, "websiteTestsRun": False, "productionModified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index-file", type=Path)
    parser.add_argument("--archives-dir", type=Path)
    parser.add_argument("--index-key")
    parser.add_argument("--index-sha256")
    parser.add_argument("--index-bytes", type=int)
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    if args.index_file:
        if not args.archives_dir:
            parser.error("--archives-dir is required with --index-file")
        index = read_json(args.index_file)
        archives_dir = args.archives_dir.resolve()
    else:
        if not args.destination or not args.index_key or not args.index_sha256 or not args.index_bytes:
            parser.error("Remote mode requires a pinned index key, SHA-256, bytes and destination")
        if not HEX.fullmatch(args.index_sha256) or not 0 < args.index_bytes <= 20_000_000:
            raise ValueError("Invalid pinned index metadata")
        archives_dir = args.destination.resolve() / "downloads"
        archives_dir.mkdir(parents=True, exist_ok=False)
        index_file = archives_dir / "preservation-index.json"
        download_s3(args.index_key, index_file, args.index_bytes)
        check_file(index_file, {"bytes": args.index_bytes, "sha256": args.index_sha256})
        index = read_json(index_file)
        objects = [{**index["baseArchive"], "filename": "base-handoff.zip"}] + index["objects"]
        for obj in objects:
            name = obj["filename"]
            if name != "base-handoff.zip" and not PART.fullmatch(name):
                raise ValueError("Invalid downloaded filename")
            if not 0 <= obj["bytes"] <= 315_000_000:
                raise ValueError("Archive size exceeds restoration limit")
            download_s3(obj["key"], archives_dir / name, obj["bytes"])
            check_file(archives_dir / name, obj)
    restore_root = None
    if not args.verify_only:
        if not args.destination:
            parser.error("--destination is required for extraction")
        restore_root = args.destination.resolve() / "preserved"
        restore_root.mkdir(parents=True, exist_ok=False)
    report = validate_archives(index, archives_dir, restore_root)
    report["verifiedAtUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report["cloudExecutionProven"] = False  # The caller must supply execution evidence separately.
    print(json.dumps(report))
    if args.destination:
        (args.destination / "RESTORATION_RECEIPT.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, urllib.error.URLError) as error:
        # Do not print HTTP headers, credentials, response bodies or signed requests.
        print("Restoration stopped: " + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
