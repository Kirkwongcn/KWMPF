import { buildCoverage, type SourceRecord, type SourceSnapshot, type SourceType } from "./build-coverage";

export type OfficialBatch = {
  trustee: string;
  trusteeSource: SourceSnapshot;
  schemeSource: SourceSnapshot;
  records: SourceRecord[];
};

function requireHttps(value: string, path: string) {
  if (!value.startsWith("https://")) throw new Error(`${path} must be an HTTPS URL`);
}

function assertSource(source: SourceSnapshot, sourceType: SourceType) {
  if (source.sourceType !== sourceType) {
    throw new Error(`Expected ${sourceType} but received ${source.sourceType}`);
  }
  requireHttps(source.sourceUrl, `${sourceType}.sourceUrl`);
  if (!source.retrievedAt) throw new Error(`${sourceType}.retrievedAt is required`);
  for (const [index, record] of source.records.entries()) {
    if (!record.sourceUrl?.startsWith("https://")) {
      throw new Error(`${sourceType}.records[${index}].sourceUrl must be an HTTPS URL`);
    }
    if (!record.dataAsOf) throw new Error(`${sourceType}.records[${index}].dataAsOf is required`);
    if (!record.identity.fundClassName) {
      throw new Error(`${sourceType}.records[${index}].identity.fundClassName is required`);
    }
  }
}

function scoped(source: SourceSnapshot, trustee: string) {
  const records = source.records.filter((record) => record.identity.trusteeName === trustee);
  if (records.length === 0) throw new Error(`No records found for ${trustee}`);
  return { ...source, scopeTrustees: [trustee], records };
}

export function loadOfficialBatch(
  trustee: string,
  trusteeSource: SourceSnapshot,
  schemeSource: SourceSnapshot,
): OfficialBatch {
  assertSource(trusteeSource, "trustee_fund_list");
  assertSource(schemeSource, "official_scheme_document");
  const scopedTrustee = scoped(trusteeSource, trustee);
  const scopedScheme = scoped(schemeSource, trustee);
  const schemeIds = new Set(scopedScheme.records.map((record) => record.fundClassId));
  const missingScheme = scopedTrustee.records.filter((record) => !schemeIds.has(record.fundClassId));
  if (missingScheme.length > 0) {
    throw new Error(`Official scheme source is missing ${missingScheme.length} fund classes for ${trustee}`);
  }
  return {
    trustee,
    trusteeSource: scopedTrustee,
    schemeSource: scopedScheme,
    records: scopedTrustee.records,
  };
}

export function buildOfficialBatchCoverage(
  platformSource: SourceSnapshot,
  schemeSources: SourceSnapshot | SourceSnapshot[],
  trusteeSources: SourceSnapshot[],
  previous?: Parameters<typeof buildCoverage>[1],
) {
  if (platformSource.sourceType !== "mpf_fund_platform") {
    throw new Error(`Expected mpf_fund_platform but received ${platformSource.sourceType}`);
  }
  const normalizedSchemeSources = Array.isArray(schemeSources) ? schemeSources : [schemeSources];
  const trustees = trusteeSources.flatMap((source) => source.scopeTrustees ?? []);
  if (new Set(trustees).size !== trusteeSources.length) {
    throw new Error("Official batch must contain one distinct trustee per source");
  }
  for (const trustee of trustees) {
    const trusteeSource = trusteeSources.find((source) => source.scopeTrustees?.includes(trustee));
    const schemeSource = normalizedSchemeSources.find((source) => source.records.some((record) => record.identity.trusteeName === trustee));
    if (!trusteeSource || !schemeSource) throw new Error(`Missing official source for ${trustee}`);
    loadOfficialBatch(trustee, trusteeSource, schemeSource);
  }
  return buildCoverage(
    [platformSource, ...trusteeSources, ...normalizedSchemeSources],
    previous,
  );
}

export const buildFirstOfficialBatchCoverage = buildOfficialBatchCoverage;
