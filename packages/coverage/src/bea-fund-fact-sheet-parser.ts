import type {
  FundFactSheetReturn,
  FundReturnUnavailable,
} from "./fund-fact-sheet-parser";
import { findFactSheetAsOf, findSections } from "./fact-sheet-allocation";
import { factSheetContract } from "./fact-sheet-allocation-contracts";
import { parsePdfXml, toLines } from "./pdf-xml";

/** BEA prints two funds per page. Bind each title to its own annualized table,
 * preserving all five slots (including N/A) and excluding benchmark rows. */
export function parseBeaFundFactSheetXmlAudit(
  xml: string,
  sourceUrl: string,
  schemeName: string,
) {
  if (!/^BEA \(MPF\) (Industry|Master Trust|Value) Scheme$/.test(schemeName))
    throw new Error("Unsupported BEA scheme: " + schemeName);
  const pages = parsePdfXml(xml);
  const contract = factSheetContract(schemeName, "trustee");
  const dataAsOf = findFactSheetAsOf(pages, contract);
  const sections = findSections(pages, contract.title);
  if (!sections.length)
    throw new Error("BEA fund performance sections not found");
  const returns: FundFactSheetReturn[] = [];
  const unavailable: FundReturnUnavailable[] = [];
  for (const section of sections) {
    const page = pages.find((page) => page.number === section.start.page)!;
    const right = page.items.filter(
      (item) =>
        item.left >= 545 &&
        item.top > section.start.top &&
        (section.end.page !== page.number || item.top < section.end.top),
    );
    const headings = right.filter((item) =>
      /^Annualised Return 年度回報$/.test(item.text),
    );
    if (headings.length !== 1)
      throw new Error(
        "BEA annualized heading is ambiguous for " + section.name,
      );
    const heading = headings[0]!;
    const ends = right.filter(
      (item) =>
        /^Cumulative Return\b/.test(item.text) && item.top > heading.top,
    );
    if (ends.length !== 1)
      throw new Error(
        "BEA annualized boundary is ambiguous for " + section.name,
      );
    const lines = toLines(
      {
        ...page,
        items: right.filter(
          (item) => item.top > heading.top && item.top < ends[0]!.top,
        ),
      },
      3,
    );
    const header = lines.filter((line) =>
      /1 Year.*3 Years.*5 Years.*10 Years.*Since Launch/.test(line.text),
    );
    if (header.length !== 1)
      throw new Error(
        "BEA annualized period columns are ambiguous for " + section.name,
      );
    const data = lines.filter(
      (line) => line.top > header[0]!.top && /%|N\/A/.test(line.text),
    );
    const labelled = data.filter((line) => /This Fund 本基金/.test(line.text));
    const rows = labelled.length ? labelled : data;
    if (
      !labelled.length &&
      data.some((line) => /Reference Portfolio|PSR|Difference/.test(line.text))
    )
      throw new Error("BEA own fund row is missing for " + section.name);
    if (rows.length !== 1)
      throw new Error(
        "BEA annualized fund row is ambiguous for " + section.name,
      );
    const cells = rows[0]!.text.match(/[+-]?\d+(?:\.\d+)?%|N\/A/g) ?? [];
    if (cells.length !== 5)
      throw new Error(
        "BEA annualized fund row is incomplete for " + section.name,
      );
    const identity = {
      schemeName,
      constituentFundName: section.name,
      dataAsOf,
      sourceUrl,
    };
    if (cells[1] === "N/A")
      unavailable.push({
        ...identity,
        periodYears: 3,
        reason: "official-na",
        page: page.number,
      });
    else
      returns.push({
        ...identity,
        annualizedReturn3Year: Number(cells[1]!.replace("%", "")),
      });
  }
  const names = [...returns, ...unavailable].map(
    (row) => row.constituentFundName,
  );
  if (new Set(names).size !== names.length)
    throw new Error("BEA duplicate fund performance sections");
  return { returns, unavailable };
}

export function parseBeaFundFactSheetXml(
  xml: string,
  sourceUrl: string,
  schemeName: string,
): FundFactSheetReturn[] {
  return parseBeaFundFactSheetXmlAudit(xml, sourceUrl, schemeName).returns;
}
