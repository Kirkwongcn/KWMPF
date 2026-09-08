CREATE TABLE comparison_group_stats (
  snapshot_id TEXT NOT NULL REFERENCES publication_snapshots(snapshot_id),
  comparison_group TEXT NOT NULL,
  avg_allocation TEXT,
  avg_top10_concentration REAL,
  avg_volatility_3y REAL,
  fund_count INTEGER NOT NULL,
  allocation_count INTEGER NOT NULL,
  top10_count INTEGER NOT NULL,
  volatility_count INTEGER NOT NULL,
  insufficient_sample INTEGER NOT NULL CHECK (insufficient_sample IN (0, 1)),
  PRIMARY KEY (snapshot_id, comparison_group)
);
