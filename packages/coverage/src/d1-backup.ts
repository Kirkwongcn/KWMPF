import { createHash } from "node:crypto";

type BackupInput = {
  backupId: string;
  databaseName: string;
  snapshotId: string;
  exportedAt: string;
  retentionUntil: string;
  files: Array<{ key: string; content: string }>;
};

export type D1BackupManifest = Omit<BackupInput, "files"> & {
  files: Array<{ key: string; bytes: number; sha256: string }>;
};

function digest(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export async function buildD1BackupManifest(input: BackupInput): Promise<D1BackupManifest> {
  return {
    backupId: input.backupId,
    databaseName: input.databaseName,
    snapshotId: input.snapshotId,
    exportedAt: input.exportedAt,
    retentionUntil: input.retentionUntil,
    files: input.files.toSorted((a, b) => a.key.localeCompare(b.key)).map(({ key, content }) => ({ key, bytes: Buffer.byteLength(content), sha256: digest(content) })),
  };
}

export async function verifyD1BackupManifest(manifest: D1BackupManifest, contents: Map<string, string>) {
  const errors: string[] = [];
  for (const file of manifest.files) {
    const content = contents.get(file.key);
    if (content === undefined) errors.push(`missing file: ${file.key}`);
    else if (Buffer.byteLength(content) !== file.bytes) errors.push(`bytes mismatch: ${file.key}`);
    else if (digest(content) !== file.sha256) errors.push(`sha256 mismatch: ${file.key}`);
  }
  return { valid: errors.length === 0, errors };
}
