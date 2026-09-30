import type {
  FundFactSheetReturn,
  FundReturnUnavailable,
} from "./fund-fact-sheet-parser";
import { parsePdfXml, type PdfTextItem } from "./pdf-xml";

export type { FundReturnUnavailable } from "./fund-fact-sheet-parser";

const CELL = /[+-]?\d+(?:\.\d+)?%|N\/A/g;
const PERIODS = ["1 Year", "3 Years", "5 Years", "10 Years", "Since Launch"];

/** Repeated performance headings begin an overlaid draw layer before its title.
 * Keep the first layer; do not choose a layer by its reporting date (ADR 0004). */
export function parseSunLifeFundFactSheetXmlAudit(
  xml: string,
  sourceUrl: string,
) {
  const returns: FundFactSheetReturn[] = [];
  const unavailable: FundReturnUnavailable[] = [];
  let fundPages = 0;
  for (const page of parsePdfXml(xml)) {
    const titles = page.items
      .filter(
        (item) =>
          /^Sun Life .*Fund$/.test(item.text) &&
          item.top < 160 &&
          item.fontSize === 27 &&
          /SunLifeNewDisplay/.test(item.fontFamily),
      )
      .sort((a, b) => a.drawIndex - b.drawIndex);
    if (titles.length === 0) continue;
    const headings = page.items
      .filter((item) => item.text === "Annualized Return")
      .sort((a, b) => a.drawIndex - b.drawIndex);
    const heading = headings[0];
    const distribution = page.items.find((item) =>
      /^Distribution History of Sun Life MPF Income Fund$/.test(item.text),
    );
    // A distribution-history continuation page contains a hidden performance
    // page drawn later. Its annualized dividend yield is not a fund return.
    if (
      distribution &&
      (!heading || distribution.drawIndex < heading.drawIndex)
    )
      continue;
    if (!heading)
      throw new Error(
        "Sun Life page " + page.number + ": annualized heading is missing",
      );
    const endDraw = Math.min(
      headings[1]?.drawIndex ?? Infinity,
      titles[1]?.drawIndex ?? Infinity,
    );
    const own = page.items.filter((item) => item.drawIndex < endDraw);
    const title = titles[0]!;
    if (title.drawIndex >= endDraw)
      throw new Error(
        "Sun Life page " + page.number + ": fund layer is incomplete",
      );
    const dates = own.flatMap((item) => [
      ...item.text.matchAll(/As at (\d{1,2})\/(\d{1,2})\/(\d{4})/g),
    ]);
    if (dates.length !== 1)
      throw new Error(
        "Sun Life page " + page.number + ": reporting date is ambiguous",
      );
    const date = dates[0]!;
    const dataAsOf =
      date[3] +
      "-" +
      date[2]!.padStart(2, "0") +
      "-" +
      date[1]!.padStart(2, "0");
    const headers = PERIODS.map((period) =>
      own.filter(
        (item) =>
          item.text === period &&
          item.left > page.width * 0.6 &&
          item.top > heading.top &&
          item.top < heading.top + 55,
      ),
    );
    if (headers.some((items) => items.length !== 1))
      throw new Error(
        "Sun Life page " +
          page.number +
          ": annualized period columns are ambiguous",
      );
    const ordered = headers.map((items) => items[0]!);
    if (
      ordered.some(
        (item, index) => index > 0 && item.left <= ordered[index - 1]!.left,
      )
    )
      throw new Error(
        "Sun Life page " + page.number + ": annualized period order is invalid",
      );
    const headerBottom = Math.max(
      ...ordered.map((item) => item.top + item.height),
    );
    const bottom = Math.min(
      ...own
        .filter(
          (item) =>
            item.top > headerBottom &&
            /Dollar Cost Averaging Return|Calendar Year Return/.test(item.text),
        )
        .map((item) => item.top),
    );
    if (!Number.isFinite(bottom))
      throw new Error(
        "Sun Life page " + page.number + ": return table end is missing",
      );
    const previous = own.filter(
      (item) =>
        item.text === "Since Launch" &&
        item.left < ordered[0]!.left &&
        Math.abs(item.top - ordered[0]!.top) < 5,
    );
    if (previous.length !== 1)
      throw new Error(
        "Sun Life page " + page.number + ": cumulative boundary is ambiguous",
      );
    const left =
      (previous[0]!.left + previous[0]!.width + ordered[0]!.left) / 2;
    // The bilingual N/A cell is also drawn as an earlier English-only N/A.
    // Coalesce only identical N/A within the same cell, never differing values.
    const candidates = own
      .filter(
        (item) =>
          item.left >= left &&
          item.top >= headerBottom &&
          item.top < bottom &&
          /%|N\/A/.test(item.text),
      )
      .sort((a, b) => a.drawIndex - b.drawIndex);
    const cells = candidates.filter(
      (item, index) =>
        item.text !== "N/A" ||
        !candidates
          .slice(0, index)
          .some(
            (earlier) =>
              earlier.text === "N/A" &&
              Math.abs(item.left - earlier.left) <= 8 &&
              Math.abs(item.top - earlier.top) <= 10,
          ),
    );
    const rows: PdfTextItem[][] = [];
    for (const item of cells.sort((a, b) => a.top - b.top || a.left - b.left)) {
      const row = rows.at(-1);
      if (row && Math.abs(item.top - row[0]!.top) <= 3) row.push(item);
      else rows.push([item]);
    }
    const identities = own.filter(
      (item) =>
        item.left < page.width * 0.2 &&
        item.top >= headerBottom - 3 &&
        item.top < bottom,
    );
    const classed = identities.some((item) => /^Class [A-Z]$/.test(item.text));
    let ownRows = 0;
    for (const row of rows) {
      const top = row[0]!.top;
      const labels = identities.filter(
        (item) => Math.abs(item.top - top) <= 11,
      );
      if (labels.some((item) => /^Reference Portfolio/.test(item.text)))
        continue;
      const classNames = labels.filter((item) =>
        /^Class [A-Z]$/.test(item.text),
      );
      if (classed && classNames.length !== 1)
        throw new Error(
          "Sun Life page " + page.number + ": class row is ambiguous",
        );
      const tokens = row
        .sort((a, b) => a.left - b.left)
        .flatMap((item) => item.text.match(CELL) ?? []);
      if (tokens.length !== 5)
        throw new Error(
          "Sun Life page " + page.number + ": annualized row is incomplete",
        );
      const identity = {
        schemeName: "Sun Life Rainbow MPF Scheme",
        constituentFundName: title.text,
        dataAsOf,
        sourceUrl,
        ...(classNames[0] ? { fundClassName: classNames[0].text } : {}),
      };
      ownRows += 1;
      if (tokens[1] === "N/A")
        unavailable.push({
          ...identity,
          periodYears: 3,
          reason: "official-na",
          page: page.number,
        });
      else
        returns.push({
          ...identity,
          annualizedReturn3Year: Number(tokens[1]!.replace("%", "")),
        });
    }
    if (ownRows === 0 || (!classed && ownRows !== 1))
      throw new Error(
        "Sun Life page " + page.number + ": fund rows are ambiguous",
      );
    if (
      classed &&
      ownRows !==
        identities.filter((item) => /^Class [A-Z]$/.test(item.text)).length
    )
      throw new Error(
        "Sun Life page " + page.number + ": class table is incomplete",
      );
    fundPages += 1;
  }
  const identities = [...returns, ...unavailable].map(
    (row) => row.constituentFundName + "\u0000" + (row.fundClassName ?? ""),
  );
  if (fundPages === 0)
    throw new Error("Sun Life fund performance pages not found");
  if (new Set(identities).size !== identities.length)
    throw new Error(
      "Sun Life fund performance rows are ambiguous: " +
        identities
          .filter((key, index) => identities.indexOf(key) !== index)
          .join(", "),
    );
  return { returns, unavailable };
}

export function parseSunLifeFundFactSheetXml(
  xml: string,
  sourceUrl: string,
): FundFactSheetReturn[] {
  return parseSunLifeFundFactSheetXmlAudit(xml, sourceUrl).returns;
}
