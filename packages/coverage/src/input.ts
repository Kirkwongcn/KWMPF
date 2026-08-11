import { readFile, stat } from "node:fs/promises";
import type {
  FundClassIdentity,
  PreviousCoverage,
  SourceSnapshot,
  SourceType,
} from "./build-coverage";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const sourceTypes = new Set<SourceType>([
  "mpf_fund_platform",
  "trustee_fund_list",
  "official_scheme_document",
]);

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function positiveInteger(value: unknown, path: string) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
  return Number(value);
}

function identity(value: unknown, path: string): FundClassIdentity {
  const item = object(value, path);
  return {
    trusteeName: string(item.trusteeName, `${path}.trusteeName`),
    schemeName: string(item.schemeName, `${path}.schemeName`),
    constituentFundName: string(
      item.constituentFundName,
      `${path}.constituentFundName`,
    ),
    fundClassName: string(item.fundClassName, `${path}.fundClassName`),
  };
}

function optionalStringArray(value: unknown, path: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function parseReturns(value: unknown, path: string) {
  if (value === undefined) return undefined;
  const item = object(value, path);
  return Object.fromEntries(
    ([1, 3, 5, 10] as const).flatMap((period) => {
      const observation = item[period];
      if (observation === undefined) return [];
      const parsed = object(observation, `${path}.${period}`);
      if (parsed.annualized !== undefined && typeof parsed.annualized !== "number") {
        throw new Error(`${path}.${period}.annualized must be a number`);
      }
      if (parsed.cumulative !== undefined && typeof parsed.cumulative !== "number") {
        throw new Error(`${path}.${period}.cumulative must be a number`);
      }
      return [[period, {
        ...(parsed.annualized === undefined ? {} : { annualized: parsed.annualized }),
        ...(parsed.cumulative === undefined ? {} : { cumulative: parsed.cumulative }),
        dataAsOf: string(parsed.dataAsOf, `${path}.${period}.dataAsOf`),
      }]];
    }),
  );
}

export function parseSourceSnapshot(value: unknown): SourceSnapshot {
  const root = object(value, "source snapshot");
  const sourceType = string(root.sourceType, "sourceType") as SourceType;
  if (!sourceTypes.has(sourceType)) {
    throw new Error(`sourceType is not supported: ${sourceType}`);
  }
  if (!Array.isArray(root.records)) throw new Error("records must be an array");

  return {
    sourceType,
    sourceUrl: string(root.sourceUrl, "sourceUrl"),
    retrievedAt: string(root.retrievedAt, "retrievedAt"),
    ...(root.sourceDataAsOf
      ? { sourceDataAsOf: string(root.sourceDataAsOf, "sourceDataAsOf") }
      : {}),
    ...(root.scopeTrustees
      ? { scopeTrustees: optionalStringArray(root.scopeTrustees, "scopeTrustees") }
      : {}),
    ...(root.expectedCounts
      ? {
          expectedCounts: {
            fundClasses: positiveInteger(
              object(root.expectedCounts, "expectedCounts").fundClasses,
              "expectedCounts.fundClasses",
            ),
            ...Object.fromEntries(
              ["constituentFunds", "schemes", "trustees"].flatMap((key) => {
                const count = object(root.expectedCounts, "expectedCounts")[key];
                return count === undefined
                  ? []
                  : [[key, positiveInteger(count, `expectedCounts.${key}`)]];
              }),
            ),
          },
          expectedCountsSource: string(
            root.expectedCountsSource,
            "expectedCountsSource",
          ),
        }
      : {}),
    records: root.records.map((value, index) => {
      const item = object(value, `records[${index}]`);
      if (typeof item.current !== "boolean") {
        throw new Error(`records[${index}].current must be a boolean`);
      }
      return {
        fundClassId: string(item.fundClassId, `records[${index}].fundClassId`),
        identity: identity(item.identity, `records[${index}].identity`),
        current: item.current,
        dataAsOf: string(item.dataAsOf, `records[${index}].dataAsOf`),
        ...(item.sourceUrl
          ? { sourceUrl: string(item.sourceUrl, `records[${index}].sourceUrl`) }
          : {}),
        ...(item.returns
          ? { returns: parseReturns(item.returns, `records[${index}].returns`) }
          : {}),
      };
    }),
  };
}

export function parsePreviousCoverage(value: unknown): PreviousCoverage {
  const root = object(value, "previous coverage");
  if (!Array.isArray(root.records)) throw new Error("records must be an array");
  const batches = root.trusteeBatches;
  if (batches !== undefined && !Array.isArray(batches)) {
    throw new Error("trusteeBatches must be an array");
  }
  return {
    records: root.records.map((value, index) => {
      const item = object(value, `records[${index}]`);
      return {
        fundClassId: string(item.fundClassId, `records[${index}].fundClassId`),
        identity: identity(item.identity, `records[${index}].identity`),
      };
    }),
    ...(batches
      ? {
          trusteeBatches: batches.map((value, index) => {
            const item = object(value, `trusteeBatches[${index}]`);
            if (!Array.isArray(item.trustees)) {
              throw new Error(`trusteeBatches[${index}].trustees must be an array`);
            }
            return {
              batchId: string(item.batchId, `trusteeBatches[${index}].batchId`),
              trustees: item.trustees.map((value, trusteeIndex) =>
                string(
                  value,
                  `trusteeBatches[${index}].trustees[${trusteeIndex}]`,
                ),
              ),
            };
          }),
        }
      : {}),
  };
}

export async function readJsonFile(path: string) {
  const metadata = await stat(path);
  if (metadata.size > MAX_SOURCE_BYTES) {
    throw new Error(`${path} exceeds the 10 MiB input limit`);
  }
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`${path} is not valid JSON`, { cause: error });
  }
}
