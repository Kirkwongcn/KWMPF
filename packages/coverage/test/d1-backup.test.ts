import { describe, expect, it } from "vitest";
import { buildD1BackupManifest, verifyD1BackupManifest } from "../src/d1-backup";

describe("D1 backup manifest", () => {
  it("records the snapshot, retention deadline, and content digests", async () => {
    const manifest = await buildD1BackupManifest({
      backupId: "d1-2026-08-13",
      databaseName: "kwmpf-staging",
      snapshotId: "snapshot-2026-08-13",
      exportedAt: "2026-08-13T08:00:00.000Z",
      retentionUntil: "2027-08-13T08:00:00.000Z",
      files: [{ key: "d1.sql", content: "CREATE TABLE fund_classes;\n" }],
    });
    expect(manifest).toMatchObject({ backupId: "d1-2026-08-13", databaseName: "kwmpf-staging", snapshotId: "snapshot-2026-08-13", retentionUntil: "2027-08-13T08:00:00.000Z" });
    expect(manifest.files).toEqual([{ key: "d1.sql", bytes: 27, sha256: "1b56eba75bc47b92c852a0d44277632b91791691142701cb6de3155b26522037" }]);
  });

  it("rejects missing or modified backup content", async () => {
    const manifest = await buildD1BackupManifest({
      backupId: "b", databaseName: "db", snapshotId: "s", exportedAt: "2026-08-13T08:00:00.000Z", retentionUntil: "2027-08-13T08:00:00.000Z", files: [{ key: "d1.sql", content: "ok" }],
    });
    await expect(verifyD1BackupManifest(manifest, new Map([["d1.sql", "NO"]]))).resolves.toEqual({ valid: false, errors: ["sha256 mismatch: d1.sql"] });
  });
});
