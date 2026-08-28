import { describe, expect, it } from "vitest";
import { publicationSnapshotId } from "../src/publication-snapshot-id";

describe("publication snapshot id", () => {
  it("binds the identifier to the official source date", () => {
    expect(
      publicationSnapshotId({
        sourceType: "mpf_fund_platform",
        sourceDataAsOf: "2026-08-31",
      }),
    ).toBe("snapshot-mpfa-platform-2026-08-31");
  });

  it("gives each source type its own identifier prefix", () => {
    expect(
      publicationSnapshotId({
        sourceType: "trustee_fund_list",
        sourceDataAsOf: "2026-08-31",
      }),
    ).toBe("snapshot-trustee-list-2026-08-31");
  });

  it("refuses to publish a snapshot that is not bound to a source date", () => {
    expect(() =>
      publicationSnapshotId({ sourceType: "mpf_fund_platform" }),
    ).toThrow(/sourceDataAsOf/);
    expect(() =>
      publicationSnapshotId({
        sourceType: "mpf_fund_platform",
        sourceDataAsOf: "2026-08",
      }),
    ).toThrow(/sourceDataAsOf/);
  });
});
