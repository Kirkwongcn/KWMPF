CREATE TABLE candidate_batches (
  batch_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('archived', 'published')),
  raw_key TEXT NOT NULL,
  raw_sha256 TEXT NOT NULL
);

CREATE TABLE publication_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  published_at TEXT NOT NULL
);

CREATE TABLE fund_class_versions (
  snapshot_id TEXT NOT NULL REFERENCES publication_snapshots(snapshot_id),
  fund_class_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, fund_class_id)
);

CREATE TABLE current_publication (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  snapshot_id TEXT NOT NULL REFERENCES publication_snapshots(snapshot_id)
);
