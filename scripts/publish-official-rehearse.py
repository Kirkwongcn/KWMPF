"""Exercise D1 admission and rollback with the repository schema and a real local seed."""
from pathlib import Path
import runpy
import sqlite3
import sys
from tempfile import TemporaryDirectory

checks = runpy.run_path(str(Path(__file__).with_name("publish-official-check.py")))
seed = Path(sys.argv[1]).read_text(encoding="utf8")
with TemporaryDirectory() as temp:
    folder = Path(temp)
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE d1_migrations (name TEXT PRIMARY KEY)")
    for migration in sorted(Path("apps/api/migrations").glob("*.sql")):
        db.executescript(migration.read_text(encoding="utf8"))
        db.execute("INSERT INTO d1_migrations VALUES (?)", (migration.name,))
    db.executescript(seed)
    original = db.execute("SELECT snapshot_id FROM current_publication").fetchone()[0]
    backup = folder / "before.sql"
    backup.write_text("\n".join(db.iterdump()), encoding="utf8")
    (folder / "parent.sql").write_text(seed, encoding="utf8")
    (folder / "seed.sql").write_text(seed, encoding="utf8")
    compare = checks["main"]
    compare(folder, "compare")
    assert (folder / "after.json").read_bytes() == (folder / "before.json").read_bytes()
    # Change the publication timestamp to model a changed dataset with a new release ID.
    stamp = db.execute("SELECT published_at FROM publication_snapshots").fetchone()[0]
    replacement = original[:len("snapshot-mpfa-platform-YYYY-MM-DD")] + "-abcdef012345"
    candidate = seed.replace(original, replacement).replace(stamp, "2099-01-01T00:00:00.000Z")
    (folder / "seed.sql").write_text(candidate, encoding="utf8")
    compare(folder, "compare")
    db.executescript(candidate)
    current = folder / "current.sql"
    current.write_text("\n".join(db.iterdump()), encoding="utf8")
    compare(folder, "verify", current)
    compare(folder, "recover", backup)
    try:
        compare(folder, "verify", backup)
    except ValueError:
        pass
    else:
        raise AssertionError("Stale readback was accepted")
    (folder / "seed.sql").write_text(candidate + "\nDROP TABLE candidate_batches;", encoding="utf8")
    try:
        compare(folder, "compare")
    except sqlite3.DatabaseError:
        pass
    else:
        raise AssertionError("Schema mutation was accepted")
    print("Verified unchanged seed, changed publication, readback, recovery, stale rejection and DDL rejection.")
