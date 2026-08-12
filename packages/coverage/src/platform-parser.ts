import { load } from "cheerio";
import type { SourceRecord } from "./build-coverage";

const detailBaseUrl =
  "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=";
const months: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

export function parseFundIds(html: string) {
  const $ = load(html);
  const ids = $("input.btn_more")
    .toArray()
    .map((element) => Number($(element).attr("cfid")?.replace(/\D/g, "")))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}

function sourceDate(text: string, cfId: number) {
  const match = text.match(/as at (\d{1,2}) ([A-Za-z]+) (\d{4})/);
  const month = match?.[2] ? months[match[2]] : undefined;
  if (!match?.[1] || !match[3] || !month) {
    throw new Error(`Data date is missing from cf_id ${cfId}`);
  }
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

export function parseFundDetail(html: string, cfId: number): SourceRecord {
  const $ = load(html);
  const fields = new Map<string, string>();
  $("tr").each((_, row) => {
    const cells = $(row)
      .children("th, td")
      .toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, " ").trim());
    if (cells.length === 2 && cells[0]) fields.set(cells[0], cells[1] ?? "");
  });
  const required = (label: string) => {
    const value = fields.get(label);
    if (!value) throw new Error(`${label} is missing from cf_id ${cfId}`);
    return value;
  };

  const returns: SourceRecord["returns"] = {};
  for (const years of [1, 3, 5, 10] as const) {
    const label = new RegExp(
      `Annualized Return / Cumulative Return \\(${years} Year\\) \\(as at [^)]+\\)`,
      "i",
    );
    const row = $("tr")
      .toArray()
      .map((element) => $(element).text().replace(/\s+/g, " ").trim())
      .find((text) => label.test(text));
    if (!row) continue;
    const date = sourceDate(row, cfId);
    const values = [...row.matchAll(/([+-]?\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]));
    if (values.length < 2) throw new Error(`Return values are missing from cf_id ${cfId} (${years} Year)`);
    returns[years] = { annualized: values[0], cumulative: values[1], dataAsOf: date };
  }

  return {
    fundClassId: `mpfa-cf-${cfId}`,
    identity: {
      trusteeName: required("Name of MPF trustee"),
      schemeName: required("Name of MPF scheme"),
      constituentFundName: required("Name of the constituent fund"),
      fundClassName: required("Fund Class"),
    },
    fundType: required("Fund Type"),
    fundTypeDescriptor: required("Fund Type - Full Descriptor"),
    current: true,
    dataAsOf: sourceDate(required("Fund size (HKD Million)"), cfId),
    sourceUrl: `${detailBaseUrl}${cfId}`,
    returns,
  };
}
