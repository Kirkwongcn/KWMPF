import type { SourceSnapshot } from "./build-coverage";

const prefixes: Record<SourceSnapshot["sourceType"], string> = {
  mpf_fund_platform: "snapshot-mpfa-platform",
  trustee_fund_list: "snapshot-trustee-list",
  official_scheme_document: "snapshot-scheme-document",
};

export function publicationSnapshotId(
  snapshot: Pick<SourceSnapshot, "sourceType" | "sourceDataAsOf">,
) {
  const dataAsOf = snapshot.sourceDataAsOf;
  if (!dataAsOf || !/^\d{4}-\d{2}-\d{2}$/.test(dataAsOf)) {
    throw new Error(
      "來源快照缺少有效的 sourceDataAsOf，無法產生發布快照識別碼；發布快照必須綁定官方截至日期。",
    );
  }
  return `${prefixes[snapshot.sourceType]}-${dataAsOf}`;
}
