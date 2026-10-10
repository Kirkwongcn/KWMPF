import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const DAY = 86400000;
export function dateAge(asOf, evaluatedOn) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? "")) return null;
  const date = Date.parse(asOf + "T00:00:00Z");
  if (
    !Number.isFinite(date) ||
    new Date(date).toISOString().slice(0, 10) !== asOf
  )
    return null;
  const age = Math.floor((Date.parse(evaluatedOn + "T00:00:00Z") - date) / DAY);
  return age >= 0 ? age : null;
}
/** Candidate hygiene report only. It does not authorize publication or alter source data. */
export function auditSourceFreshness(source, allObservations, evaluatedOn) {
  // 呢份審計只計年率化；受託人累積回報（basis: "cumulative"，ADR 0014）另外處理。
  const observations = allObservations.filter(
    (row) => row.basis !== "cumulative",
  );
  if (dateAge(evaluatedOn, evaluatedOn) !== 0)
    throw new Error("Invalid evaluation date");
  const byId = new Map(
    source.records.map((record) => [record.fundClassId, record]),
  );
  if (byId.size !== source.records.length)
    throw new Error("Duplicate source fund class id");
  const seen = new Set();
  for (const row of observations) {
    if (![1, 3, 5, 10].includes(row.periodYears))
      throw new Error("Unsupported return period");
    if (!byId.has(row.fundClassId))
      throw new Error("Unmatched observation: " + row.fundClassId);
    const key = row.fundClassId + ":" + row.periodYears;
    if (seen.has(key)) throw new Error("Duplicate observation: " + key);
    seen.add(key);
  }
  const returns = [1, 3, 5, 10].map((periodYears) => {
    // 與 packages/coverage/src/data-freshness.ts 一致（ADR 0007、ADR 0010）。
    const graceDays = periodYears === 3 ? 90 : 60;
    const counts = { eligible: 0, stale: 0, missing: 0, invalidDate: 0 };
    const dates = [];
    for (const record of source.records) {
      const overlay = observations.find(
        (row) =>
          row.fundClassId === record.fundClassId &&
          row.periodYears === periodYears,
      );
      const field = overlay ?? record.returns?.[String(periodYears)];
      if (
        !field ||
        typeof field.annualized !== "number" ||
        !Number.isFinite(field.annualized)
      ) {
        counts.missing++;
        continue;
      }
      const asOf = field.dataAsOf ?? record.dataAsOf;
      const age = dateAge(asOf, evaluatedOn);
      if (age === null) {
        counts.invalidDate++;
        continue;
      }
      dates.push(asOf);
      if (age > graceDays) counts.stale++;
      else counts.eligible++;
    }
    dates.sort();
    return {
      periodYears,
      graceDays,
      ...counts,
      dataAsOf: dates.length
        ? { earliest: dates[0], latest: dates.at(-1) }
        : null,
    };
  });
  const evaluatedDate = new Date(evaluatedOn + "T00:00:00Z");
  const threeYearCutoff = `${evaluatedDate.getUTCFullYear() - 3}${evaluatedOn.slice(4)}`;
  const byScheme = new Map();
  const threeYearGaps = [];
  const shortTenureObservations = [];
  for (const record of source.records) {
    const field =
      observations.find(
        (row) =>
          row.fundClassId === record.fundClassId && row.periodYears === 3,
      ) ?? record.returns?.["3"];
    const present =
      typeof field?.annualized === "number" &&
      Number.isFinite(field.annualized);
    const asOf = present ? (field.dataAsOf ?? record.dataAsOf) : null;
    const ageDays = present ? dateAge(asOf, evaluatedOn) : null;
    const status = !present
      ? "missing"
      : ageDays === null
        ? "invalidDate"
        : ageDays > 90
          ? "stale"
          : "eligible";
    const schemeName = record.identity?.schemeName ?? "Unknown scheme";
    if (!byScheme.has(schemeName))
      byScheme.set(schemeName, {
        schemeName,
        total: 0,
        eligible: 0,
        stale: 0,
        missing: 0,
        invalidDate: 0,
        shortTrackRecord: 0,
        matureMissing: 0,
        unknownTrackRecord: 0,
      });
    const scheme = byScheme.get(schemeName);
    scheme.total++;
    scheme[status]++;
    // This is a tenure clue, not proof that the trustee did not disclose a period.
    const validLaunch = dateAge(record.launchDate, evaluatedOn) !== null;
    const tenure = !validLaunch
      ? "unknown"
      : record.launchDate > threeYearCutoff
        ? "under-three-years"
        : "at-least-three-years";
    if (present && tenure === "under-three-years")
      shortTenureObservations.push({
        fundClassId: record.fundClassId,
        ...record.identity,
        launchDate: record.launchDate,
        dataAsOf: asOf,
        sourceUrl: field.sourceUrl ?? record.sourceUrl,
        diagnosis: "period-and-track-record-review-required",
      });
    if (status === "missing")
      scheme[
        tenure === "unknown"
          ? "unknownTrackRecord"
          : tenure === "under-three-years"
            ? "shortTrackRecord"
            : "matureMissing"
      ]++;
    if (status !== "eligible")
      threeYearGaps.push({
        fundClassId: record.fundClassId,
        ...record.identity,
        status,
        dataAsOf: asOf,
        ageDays,
        sourceUrl: present ? (field.sourceUrl ?? record.sourceUrl) : null,
        launchDate: record.launchDate ?? null,
        tenure,
        diagnosis:
          status === "stale"
            ? "newer-source-required"
            : status === "invalidDate"
              ? "date-review-required"
              : "source-and-class-reconciliation-required",
      });
  }
  return {
    scope: "candidate-only; published API validation is separately required",
    evaluatedOn,
    sourceDataAsOf: source.sourceDataAsOf,
    retrievedAt: source.retrievedAt,
    sourceRecordCount: source.records.length,
    returnObservationCount: observations.length,
    returns,
    threeYearGapScope:
      "Tenure is diagnostic only; missing does not prove official non-disclosure. No return values are estimated or changed.",
    threeYearByScheme: [...byScheme.values()].sort((a, b) =>
      a.schemeName.localeCompare(b.schemeName, "en"),
    ),
    threeYearGaps,
    shortTenureObservations,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const arg = (name) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const sourcePath = arg("--source"),
    observationsPath = arg("--observations"),
    output = arg("--output");
  if (!sourcePath || !observationsPath || !output)
    throw new Error(
      "Usage: node scripts/audit-source-freshness.mjs --source FILE --observations FILE --output FILE [--date YYYY-MM-DD]",
    );
  const report = auditSourceFreshness(
    JSON.parse(await readFile(sourcePath, "utf8")),
    JSON.parse(await readFile(observationsPath, "utf8")),
    arg("--date") ?? new Date().toISOString().slice(0, 10),
  );
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      output,
      evaluatedOn: report.evaluatedOn,
      sourceRecordCount: report.sourceRecordCount,
      returns: report.returns,
      threeYearGapCount: report.threeYearGaps.length,
    }),
  );
}
