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

function monthNumber(name: string) {
  const full = Object.keys(months).find(
    (month) => month.toLowerCase() === name.toLowerCase(),
  );
  if (full) return months[full];
  return Object.entries(months).find(
    ([month]) => month.slice(0, 3).toLowerCase() === name.toLowerCase(),
  )?.[1];
}

function sourceDate(text: string, cfId: number) {
  const match = text.match(/as at (\d{1,2}) ([A-Za-z]+) (\d{4})/i);
  const month = match?.[2] ? monthNumber(match[2]) : undefined;
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

  const identity = {
    trusteeName: required("Name of MPF trustee"),
    schemeName: required("Name of MPF scheme"),
    constituentFundName: required("Name of the constituent fund"),
    fundClassName: required("Fund Class"),
  };
  const fundType = required("Fund Type");
  const fundTypeDescriptor = required("Fund Type - Full Descriptor");

  const returns: SourceRecord["returns"] = {};
  const unavailableFields: string[] = [];
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
    if (values.length < 2) {
      if (/n\.a\./i.test(row)) {
        unavailableFields.push(`annualizedReturn${years}y`);
        continue;
      }
      throw new Error(`Return values are missing from cf_id ${cfId} (${years} Year)`);
    }
    returns[years] = { annualized: values[0], cumulative: values[1], dataAsOf: date };
  }

  const numberField = (label: string, publicName: string) => {
    const value = fields.get(label);
    if (!value || /n\.a\./i.test(value)) {
      if (value && /n\.a\./i.test(value)) unavailableFields.push(publicName);
      return undefined;
    }
    const match = value.match(/[+-]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  };
  const riskClass = numberField("Risk Class", "riskClass");
  const latestFer = numberField("Latest FER", "latestFer");
  const managementFee = numberField("Management Fee", "managementFee");
  const oci1yHkd = numberField("On-going Cost Illustration (OCI) – 1 Year", "oci1yHkd");

  const fundSizeText = required("Fund size (HKD Million)");
  const fundSizeMatch = fundSizeText.match(/([\d,]+(?:\.\d+)?)\s*\(as at /i);
  const fundSizeHkdMillion = fundSizeMatch?.[1]
    ? Number(fundSizeMatch[1].replaceAll(",", ""))
    : undefined;
  if (fundSizeHkdMillion === undefined && /n\.a\./i.test(fundSizeText)) {
    unavailableFields.push("fundSizeHkdMillion");
  }

  const launchDateText = fields.get("Launch Date");
  let launchDate: string | undefined;
  if (launchDateText && /n\.a\./i.test(launchDateText)) {
    unavailableFields.push("launchDate");
  } else if (launchDateText) {
    const match = launchDateText.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
    const month = match?.[2] ? monthNumber(match[2]) : undefined;
    if (!match?.[1] || !match[3] || !month) {
      throw new Error(`Launch Date is unreadable on cf_id ${cfId}`);
    }
    launchDate = `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
  }

  const calendarYearReturns: Record<string, number> = {};
  for (const [label, value] of fields) {
    const year = label.match(/^Calendar year return: (\d{4})$/)?.[1];
    if (!year) continue;
    if (/n\.a\./i.test(value)) {
      unavailableFields.push(`calendarYearReturn${year}`);
      continue;
    }
    const parsed = value.match(/[+-]?\d+(?:\.\d+)?/);
    if (parsed) calendarYearReturns[year] = Number(parsed[0]);
  }

  const sinceLaunchRow = $("tr")
    .toArray()
    .map((element) => $(element).text().replace(/\s+/g, " ").trim())
    .find((text) =>
      /Annualized Return \/ Cumulative Return \(Since Launch\) \(as at [^)]+\)/i.test(
        text,
      ),
    );
  let sinceLaunchReturn:
    | { annualized: number; cumulative: number; dataAsOf: string }
    | undefined;
  if (sinceLaunchRow && !/n\.a\./i.test(sinceLaunchRow)) {
    const values = [...sinceLaunchRow.matchAll(/([+-]?\d+(?:\.\d+)?)%/g)].map(
      (match) => Number(match[1]),
    );
    if (values.length < 2) {
      throw new Error(`Since-launch return is unreadable on cf_id ${cfId}`);
    }
    sinceLaunchReturn = {
      annualized: values[0]!,
      cumulative: values[1]!,
      dataAsOf: sourceDate(sinceLaunchRow, cfId),
    };
  } else if (sinceLaunchRow) {
    unavailableFields.push("sinceLaunchReturn");
  }

  return {
    fundClassId: `mpfa-cf-${cfId}`,
    identity,
    fundType,
    fundTypeDescriptor,
    current: true,
    dataAsOf: sourceDate(fundSizeText, cfId),
    sourceUrl: `${detailBaseUrl}${cfId}`,
    returns,
    ...(fundSizeHkdMillion === undefined
      ? {}
      : { fundSizeHkdMillion, fundSizeAsOf: sourceDate(fundSizeText, cfId) }),
    ...(launchDate === undefined ? {} : { launchDate }),
    ...(Object.keys(calendarYearReturns).length
      ? { calendarYearReturns }
      : {}),
    ...(sinceLaunchReturn === undefined ? {} : { sinceLaunchReturn }),
    ...(unavailableFields.length ? { unavailableFields } : {}),
    ...([riskClass, latestFer, managementFee, oci1yHkd].some(
      (value) => value !== undefined,
    )
      ? {
          fundOverview: {
            ...(riskClass === undefined ? {} : { riskClass }),
            ...(latestFer === undefined ? {} : { latestFer }),
            ...(managementFee === undefined ? {} : { managementFee }),
            ...(oci1yHkd === undefined ? {} : { oci1yHkd }),
          },
        }
      : {}),
  };
}
