export type SourceType =
  | "mpf_fund_platform"
  | "trustee_fund_list"
  | "official_scheme_document";

export type FundClassIdentity = {
  trusteeName: string;
  schemeName: string;
  constituentFundName: string;
  fundClassName: string;
};

export type SourceRecord = {
  fundClassId: string;
  identity: FundClassIdentity;
  current: boolean;
  dataAsOf: string;
  sourceUrl?: string;
  fundType?: string;
  fundTypeDescriptor?: string;
  returns?: Partial<Record<1 | 3 | 5 | 10, {
    annualized?: number;
    cumulative?: number;
    dataAsOf: string;
  }>>;
};

export type SourceSnapshot = {
  sourceType: SourceType;
  sourceUrl: string;
  retrievedAt: string;
  sourceDataAsOf?: string;
  scopeTrustees?: string[];
  expectedCounts?: {
    fundClasses: number;
    constituentFunds?: number;
    schemes?: number;
    trustees?: number;
  };
  expectedCountsSource?: string;
  records: SourceRecord[];
};

const requiredSources: SourceType[] = [
  "mpf_fund_platform",
  "trustee_fund_list",
  "official_scheme_document",
];

type CoverageConflict = {
  sourceType: SourceType;
  reason: "missing_source" | "not_current" | "identity_mismatch";
  dataAsOf?: string;
  sourceUrl?: string;
  checkedAt?: string;
};

function identitiesMatch(a: FundClassIdentity, b: FundClassIdentity) {
  return (
    a.trusteeName === b.trusteeName &&
    a.schemeName === b.schemeName &&
    a.constituentFundName === b.constituentFundName &&
    a.fundClassName === b.fundClassName
  );
}

export type PreviousCoverage = {
  records: Array<{ fundClassId: string; identity: FundClassIdentity }>;
  trusteeBatches?: Array<{ batchId: string; trustees: string[] }>;
};

function allocateTrusteeBatches(
  trustees: string[],
  previousBatches: PreviousCoverage["trusteeBatches"],
) {
  if (!previousBatches) {
    return Array.from(
      { length: Math.ceil(trustees.length / 4) },
      (_, index) => ({
        batchId: `trustees-${String(index + 1).padStart(2, "0")}`,
        trustees: trustees.slice(index * 4, index * 4 + 4),
      }),
    );
  }

  const trusteeSet = new Set(trustees);
  const batches = previousBatches.map((batch) => ({
    batchId: batch.batchId,
    trustees: batch.trustees.filter((trustee) => trusteeSet.has(trustee)),
  }));
  const assigned = new Set(batches.flatMap((batch) => batch.trustees));
  const unassigned = trustees.filter((trustee) => !assigned.has(trustee));

  for (const trustee of unassigned) {
    let batch = batches.find((candidate) => candidate.trustees.length < 4);
    if (!batch) {
      batch = {
        batchId: `trustees-${String(batches.length + 1).padStart(2, "0")}`,
        trustees: [],
      };
      batches.push(batch);
    }
    batch.trustees.push(trustee);
  }
  return batches;
}

export function buildCoverage(
  sources: SourceSnapshot[],
  previous: PreviousCoverage = { records: [] },
) {
  for (const source of sources) {
    const expected = source.expectedCounts?.fundClasses;
    if (expected !== undefined && source.records.length !== expected) {
      throw new Error(
        `${source.sourceType} expected ${expected} fund classes but received ${source.records.length}`,
      );
    }
    const actualCounts = {
      constituentFunds: new Set(
        source.records.map(
          (record) =>
            `${record.identity.schemeName}\u0000${record.identity.constituentFundName}`,
        ),
      ).size,
      schemes: new Set(
        source.records.map((record) => record.identity.schemeName),
      ).size,
      trustees: new Set(
        source.records.map((record) => record.identity.trusteeName),
      ).size,
    };
    for (const key of ["constituentFunds", "schemes", "trustees"] as const) {
      const expectedCount = source.expectedCounts?.[key];
      if (expectedCount !== undefined && actualCounts[key] !== expectedCount) {
        throw new Error(
          `${source.sourceType} expected ${expectedCount} ${key} but received ${actualCounts[key]}`,
        );
      }
    }
  }
  const ids = [
    ...new Set(sources.flatMap((source) => source.records.map((r) => r.fundClassId))),
  ].sort();

  const records = ids.map((fundClassId) => {
      const attestations = sources
        .flatMap((source) =>
          source.records
            .filter((record) => record.fundClassId === fundClassId)
            .map((record) => ({
              sourceType: source.sourceType,
              sourceUrl: source.sourceUrl,
              retrievedAt: source.retrievedAt,
              ...record,
            })),
        )
        .sort((a, b) => a.sourceType.localeCompare(b.sourceType));
      const baseline =
        attestations.find((item) => item.sourceType === "mpf_fund_platform") ??
        attestations[0];
      if (!baseline) throw new Error(`No source record for ${fundClassId}`);

      const conflicts = requiredSources.flatMap<CoverageConflict>((sourceType) => {
        const attestation = attestations.find(
          (item) => item.sourceType === sourceType,
        );
        if (!attestation) {
          const checkedSource = sources.find(
            (source) =>
              source.sourceType === sourceType &&
              (!source.scopeTrustees ||
                source.scopeTrustees.includes(baseline.identity.trusteeName)),
          );
          return [
            {
              sourceType,
              ...(checkedSource
                ? {
                    sourceUrl: checkedSource.sourceUrl,
                    checkedAt: checkedSource.retrievedAt,
                  }
                : {}),
              reason: "missing_source" as const,
            },
          ];
        }
        if (!attestation.current) {
          return [
            {
              sourceType,
              reason: "not_current" as const,
              dataAsOf: attestation.dataAsOf,
            },
          ];
        }
        if (!identitiesMatch(attestation.identity, baseline.identity)) {
          return [
            {
              sourceType,
              reason: "identity_mismatch" as const,
              dataAsOf: attestation.dataAsOf,
            },
          ];
        }
        return [];
      });
      const current = conflicts.length === 0;

      return {
        fundClassId,
        identity: baseline.identity,
        ...(baseline.returns ? { returns: baseline.returns } : {}),
        status: current ? ("verified" as const) : ("pending_verification" as const),
        current,
        rankingEligible: current,
        conflicts,
        attestations,
      };
    });
  const currentById = new Map(
    records.map((record) => [record.fundClassId, record]),
  );
  const previousById = new Map(
    previous.records.map((record) => [record.fundClassId, record]),
  );
  const trustees = [
    ...new Set(records.map((record) => record.identity.trusteeName)),
  ].sort();

  return {
    records,
    changes: {
      added: ids.filter((id) => !previousById.has(id)),
      removed: [...previousById.keys()].filter((id) => !currentById.has(id)).sort(),
      identityChanged: ids.filter((id) => {
        const oldRecord = previousById.get(id);
        return (
          oldRecord !== undefined &&
          !identitiesMatch(oldRecord.identity, currentById.get(id)!.identity)
        );
      }),
    },
    trusteeBatches: allocateTrusteeBatches(trustees, previous.trusteeBatches),
  };
}

export function serializeCoverage(
  coverage: ReturnType<typeof buildCoverage>,
) {
  return `${JSON.stringify(coverage, null, 2)}\n`;
}
