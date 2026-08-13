export type PublicationBindings = {
  DB: D1Database;
  RAW_ARCHIVE: R2Bucket;
};

export type FundClassFixture = {
  batchId: string;
  source: { url: string; retrievedAt: string };
  anomalyReport?: { requiresReview: boolean; policyVersion: string };
  fundClass: {
    id: string;
    trusteeName: string;
    schemeName: string;
    constituentFundName: string;
    fundClassName: string;
    fundType: string;
    fundCategory: string;
    dataAsOf: string;
    verificationStatus: "verified";
    [key: string]: string | number;
  };
};

export type PublicationApproval = { reviewer: string; policyVersion: string };

export async function archiveCandidate(
  bindings: PublicationBindings,
  fixture: FundClassFixture,
) {
  const raw = JSON.stringify(fixture);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `candidates/${fixture.batchId}/${sha256}.json`;

  await bindings.RAW_ARCHIVE.put(rawKey, raw, {
    httpMetadata: { contentType: "application/json" },
  });
  await bindings.DB.prepare(
    "INSERT INTO candidate_batches (batch_id, status, raw_key, raw_sha256) VALUES (?, 'archived', ?, ?)",
  )
    .bind(fixture.batchId, rawKey, sha256)
    .run();

  return { batchId: fixture.batchId, rawKey, sha256 };
}

type ArchivedCandidate = Awaited<ReturnType<typeof archiveCandidate>>;

export async function publishCandidate(
  bindings: PublicationBindings,
  fixture: FundClassFixture,
  archived: ArchivedCandidate,
  approval?: PublicationApproval,
) {
  if (
    archived.batchId !== fixture.batchId ||
    fixture.fundClass.verificationStatus !== "verified"
  ) {
    throw new Error("Only the matching verified candidate can be published");
  }
  if (
    fixture.anomalyReport?.requiresReview &&
    (!approval ||
      approval.reviewer.trim() === "" ||
      approval.policyVersion !== fixture.anomalyReport.policyVersion)
  ) {
    throw new Error("Candidate anomaly report requires reviewer approval");
  }

  const candidate = await bindings.DB.prepare(
    "SELECT raw_key, raw_sha256 FROM candidate_batches WHERE batch_id = ? AND status = 'archived'",
  )
    .bind(fixture.batchId)
    .first<{ raw_key: string; raw_sha256: string }>();
  if (
    !candidate ||
    candidate.raw_key !== archived.rawKey ||
    candidate.raw_sha256 !== archived.sha256
  ) {
    throw new Error(
      "Archived candidate does not match the publication request",
    );
  }

  const snapshotId = `snapshot-${fixture.batchId}`;
  const payload = JSON.stringify({
    snapshotId,
    fundClass: fixture.fundClass,
    provenance: {
      sourceUrl: fixture.source.url,
      dataAsOf: fixture.fundClass.dataAsOf,
      retrievedAt: fixture.source.retrievedAt,
      rawSha256: archived.sha256,
      verificationStatus: fixture.fundClass.verificationStatus,
    },
  });

  await bindings.DB.batch([
    bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    ).bind(snapshotId, fixture.source.retrievedAt),
    bindings.DB.prepare(
      "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
    ).bind(snapshotId, fixture.fundClass.id, payload),
    bindings.DB.prepare(
      "UPDATE candidate_batches SET status = 'published' WHERE batch_id = ? AND status = 'archived'",
    ).bind(fixture.batchId),
    bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET snapshot_id = excluded.snapshot_id",
    ).bind(snapshotId),
  ]);

  return snapshotId;
}
