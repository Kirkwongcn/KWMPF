import { load } from "cheerio";
import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";
import type { OfficialReturnObservation } from "./official-return-overlay";

export const aiaListing =
  "https://www.aia.com.hk/en/products/useful-tools-and-information/knowledge-and-insight/mpf-fund-performance-review";
const months = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function latestAiaPdf(html: string): string {
  const $ = load(html);
  const links = new Map<number, Set<string>>();
  for (const anchor of $("a[href]").toArray()) {
    const url = new URL($(anchor).attr("href")!, aiaListing);
    if (url.origin !== new URL(aiaListing).origin) continue;
    const match = url.pathname.match(
      /\/aia-mpf-prime-value-choice-fund-performance-review-([a-z]+)-(\d{4})\.pdf(?:\.coredownload\.inline\.pdf)?$/i,
    );
    if (!match) continue;
    const month = months.indexOf(match[1]!.slice(0, 3).toLowerCase());
    if (month < 0) throw new Error("Unrecognized AIA report month");
    const key = Number(match[2]) * 12 + month;
    const urls = links.get(key) ?? new Set<string>();
    urls.add(
      url.origin + url.pathname.replace(/\.coredownload\.inline\.pdf$/, ""),
    );
    links.set(key, urls);
  }
  const latest = links.get(Math.max(...links.keys()));
  if (latest?.size !== 1)
    throw new Error("Cannot identify a unique latest AIA performance PDF");
  return [...latest][0]!;
}

export type Target = { id: string; name: string; scheme: string; url: string };

export function compareAnnualized(
  targets: Target[],
  rows: FundFactSheetReturn[],
  baseline: OfficialReturnObservation[],
  today: string,
) {
  // A combined AIA PDF may add other funds. Each watched identity still has to match exactly once.
  if (targets.length === 1 && rows.length !== 1)
    throw new Error("Unexpected number of disclosed fund rows");
  if (new Set(rows.map((row) => row.dataAsOf)).size !== 1)
    throw new Error("Missing or mixed performance dates in one document");
  return targets.map((target) => {
    const matches = rows.filter(
      (row) =>
        row.schemeName === target.scheme &&
        row.constituentFundName === target.name,
    );
    const prior = baseline.filter(
      (row) => row.fundClassId === target.id && row.periodYears === 3,
    );
    if (matches.length !== 1 || prior.length !== 1)
      throw new Error("Missing or ambiguous fund: " + target.id);
    const row = matches[0]!,
      old = prior[0]!;
    if (
      !Number.isFinite(row.annualizedReturn3Year) ||
      !/^\d{4}-\d\d-\d\d$/.test(row.dataAsOf) ||
      row.dataAsOf > today ||
      new Date(row.dataAsOf).toISOString().slice(0, 10) !== row.dataAsOf
    )
      throw new Error("Invalid return or performance date: " + target.id);
    const status =
      row.dataAsOf < old.dataAsOf
        ? "older"
        : row.dataAsOf > old.dataAsOf
          ? "newer"
          : row.annualizedReturn3Year === old.annualized
            ? "unchanged"
            : "same-date-revision";
    return {
      fundClassId: target.id,
      name: target.name,
      status,
      previousDate: old.dataAsOf,
      previousAnnualized: old.annualized,
      dataAsOf: row.dataAsOf,
      annualized: row.annualizedReturn3Year,
    };
  });
}
