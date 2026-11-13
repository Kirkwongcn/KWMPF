"""Compare an exported D1 publication with deterministic seeds on its real schema."""

import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys


def read_export(file):
    db = sqlite3.connect(":memory:")
    db.executescript(file.read_text(encoding="utf-8"))
    return db


def describe(db):
    (snapshot,) = db.execute(
        "SELECT snapshot_id FROM current_publication WHERE singleton=1"
    ).fetchone()
    if not re.fullmatch(r"snapshot-mpfa-platform-\d{4}-\d{2}-\d{2}(-[0-9a-f]{12})?", snapshot):
        raise ValueError("Unexpected snapshot ID")
    (published_at,) = db.execute(
        "SELECT published_at FROM publication_snapshots WHERE snapshot_id=?", (snapshot,)
    ).fetchone()
    funds = []
    for key, body in db.execute(
        "SELECT fund_class_id,payload FROM fund_class_versions WHERE snapshot_id=? ORDER BY fund_class_id",
        (snapshot,),
    ):
        payload = json.loads(body)
        if payload.pop("snapshotId") != snapshot or payload["fundClass"]["id"] != key:
            raise ValueError("Publication row identity mismatch")
        funds.append(payload)
    groups = db.execute(
        "SELECT * FROM comparison_group_stats WHERE snapshot_id=? ORDER BY comparison_group",
        (snapshot,),
    )
    group_rows = [
        {col[0]: value for col, value in zip(groups.description, row) if col[0] != "snapshot_id"}
        for row in groups
    ]
    verified = [row for row in funds if row["fundClass"]["verificationStatus"] == "verified"]
    if not verified or not group_rows or db.execute("PRAGMA foreign_key_check").fetchone():
        raise ValueError("Invalid publication integrity, verified count or comparison groups")
    content = json.dumps([published_at, funds, group_rows], sort_keys=True, separators=(",", ":"))
    return {
        "snapshot": snapshot,
        "digest": hashlib.sha256(content.encode()).hexdigest(),
        "fundCount": len(verified),
        "sample": verified[0]["fundClass"],
    }


def apply_seed(db, file):
    tables = {"current_publication", "fund_class_versions", "comparison_group_stats", "publication_snapshots"}

    def allowed(action, table, column, schema, trigger):
        if action in (sqlite3.SQLITE_READ, sqlite3.SQLITE_SELECT, sqlite3.SQLITE_TRANSACTION):
            return sqlite3.SQLITE_OK
        if action in (sqlite3.SQLITE_DELETE, sqlite3.SQLITE_INSERT) and table in tables and not trigger:
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY

    db.execute("PRAGMA foreign_keys=ON")
    db.set_authorizer(allowed)
    try:
        db.executescript(file.read_text(encoding="utf-8"))
    finally:
        db.set_authorizer(None)
    return describe(db)


def main(folder, mode, export=None):
    if mode in {"verify", "recover"}:
        expected_file = "after" if mode == "verify" else "before"
        expected = json.loads((folder / f"{expected_file}.json").read_text())
        if expected != describe(read_export(Path(export))):
            raise ValueError("D1 publication differs from the expected dataset")
        return
    db = read_export(folder / "before.sql")
    before = describe(db)
    applied = [row[0] for row in db.execute("SELECT name FROM d1_migrations ORDER BY name")]
    migrations = sorted(p.name for p in Path("apps/api/migrations").glob("*.sql"))
    if not migrations or applied != migrations:
        raise ValueError("Deployed migration ledger does not match the publication checkout")
    parent = apply_seed(db, folder / "parent.sql")
    after = apply_seed(db, folder / "seed.sql")
    if before["digest"] == after["digest"]:
        after = before
    elif before["digest"] != parent["digest"]:
        raise ValueError("Current D1 differs from the candidate parent and the candidate dataset")
    elif before["snapshot"] == after["snapshot"]:
        raise ValueError("A changed dataset requires a new snapshot ID")
    for name, value in [("before", before), ("after", after)]:
        (folder / f"{name}.json").write_text(json.dumps(value), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), *sys.argv[2:])
