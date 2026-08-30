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

function normalizeLabel(label: string) {
  return label
    .toLowerCase()
    .replaceAll(/[‐-―]/g, "-")
    .replaceAll(/\s+/g, "");
}

// 官方以 `<br>` 分行披露多行收費（例如按成員人數分級的年費）。cheerio 的 `.text()`
// 不會在分行位置留下任何分隔字元，`HKD3,000` 接 `15 to 29` 會變成 `HKD3,00015 to 29`，
// 即係把原文改寫成另一個金額，所以要先把分行還原成換行才收斂空白。
function collapseLines(text: string) {
  return text
    .replaceAll(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
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
      .map((cell) => {
        const content = $(cell).clone();
        content.find("br").replaceWith("\n");
        content.find("div, p, li").append("\n");
        return collapseLines(content.text());
      });
    // 標籤一定是單行，換行還原成空格才對得上既有的標籤鍵。
    if (cells.length === 2 && cells[0])
      fields.set(cells[0].replaceAll("\n", " "), cells[1] ?? "");
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

  // 平台在不同基金之間的標籤間距及破折號寫法不一致（例如 `Trustee Fee/ Custodian Fee`
  // 與 `On-going Cost Illustration (OCI) – 3 Year`），所以逐個標籤先試原文，再試正規化字鍵。
  const normalizedLabels = new Map<string, string>();
  for (const [label, value] of fields) {
    normalizedLabels.set(normalizeLabel(label), value);
  }
  const labelValue = (label: string) =>
    fields.get(label) ?? normalizedLabels.get(normalizeLabel(label));

  // 帶 `Up to` 的披露是上限而非實際費率，數值照樣抽出，但要記低邊幾個欄位是上限。
  const feeCaps: string[] = [];
  // 非單一費率的披露（例如按成員人數分級的年費）原文保留，不砌成數字。
  const feeDisclosures: Record<string, string> = {};

  const rateField = (label: string, publicName: string) => {
    const value = labelValue(label);
    if (value === undefined || value === "") return undefined;
    if (/n\.a\./i.test(value)) {
      unavailableFields.push(publicName);
      return undefined;
    }
    const rate = value.match(
      /^(up to\s+)?([+-]?\d+(?:\.\d+)?)\s*%(\s*p\.a\.)?$/i,
    );
    if (!rate?.[2]) {
      feeDisclosures[publicName] = value;
      return undefined;
    }
    if (rate[1]) feeCaps.push(publicName);
    return Number(rate[2]);
  };

  const amountField = (label: string, publicName: string) => {
    const value = labelValue(label);
    if (value === undefined || value === "") return undefined;
    if (/n\.a\./i.test(value)) {
      unavailableFields.push(publicName);
      return undefined;
    }
    const amount = value.match(/^(up to\s+)?HKD\s*([\d,]+(?:\.\d+)?)$/i);
    if (!amount?.[2]) {
      feeDisclosures[publicName] = value;
      return undefined;
    }
    if (amount[1]) feeCaps.push(publicName);
    return Number(amount[2].replaceAll(",", ""));
  };

  // 風險指標是年度化標準差，不是收費，所以不走 `rateField`：它沒有 `Up to` 上限，
  // 也不應該在對不上格式時退回 `feeDisclosures`，對不上就要報錯。
  const percentField = (label: string, publicName: string) => {
    const value = labelValue(label);
    if (value === undefined || value === "") return undefined;
    if (/n\.a\./i.test(value)) {
      unavailableFields.push(publicName);
      return undefined;
    }
    const percent = value.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
    if (!percent?.[1]) {
      throw new Error(`${label} is unreadable on cf_id ${cfId}: ${value}`);
    }
    return Number(percent[1]);
  };

  const riskClass = numberField("Risk Class", "riskClass");
  const fundRiskIndicator = percentField(
    "Fund Risk Indicator",
    "fundRiskIndicator",
  );
  const latestFer = rateField("Latest FER", "latestFer");
  const recurringFees = {
    managementFee: rateField("Management Fee", "managementFee"),
    trusteeCustodianFee: rateField(
      "Trustee Fee/ Custodian Fee",
      "trusteeCustodianFee",
    ),
    empfPlatformFee: rateField("eMPF Platform Fee", "empfPlatformFee"),
    memberServicingFee: rateField(
      "Member Servicing Fee",
      "memberServicingFee",
    ),
    investmentManagementFee: rateField(
      "Investment Management Fee",
      "investmentManagementFee",
    ),
    guaranteeCharge: rateField("Guarantee Charge", "guaranteeCharge"),
  };
  const oneOffCharges = {
    joiningFee: rateField("Joining Fee", "joiningFee"),
    annualFee: rateField("Annual Fee", "annualFee"),
    contributionCharge: rateField(
      "Contribution Charge",
      "contributionCharge",
    ),
    bidSpread: rateField("Bid Spread", "bidSpread"),
    offerSpread: rateField("Offer Spread", "offerSpread"),
    withdrawalCharge: rateField("Withdrawal Charge", "withdrawalCharge"),
  };
  const ongoingCostIllustration = {
    oci1yHkd: amountField(
      "On-going Cost Illustration (OCI) – 1 Year",
      "oci1yHkd",
    ),
    oci3yHkd: amountField(
      "On-going Cost Illustration (OCI) – 3 Year",
      "oci3yHkd",
    ),
    oci5yHkd: amountField(
      "On-going Cost Illustration (OCI) – 5 Year",
      "oci5yHkd",
    ),
  };
  const fees = {
    ...recurringFees,
    ...oneOffCharges,
    ...ongoingCostIllustration,
  };

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
    ...(riskClass !== undefined ||
    fundRiskIndicator !== undefined ||
    latestFer !== undefined ||
    Object.values(fees).some((value) => value !== undefined) ||
    Object.keys(feeDisclosures).length > 0
      ? {
          fundOverview: {
            ...(riskClass === undefined ? {} : { riskClass }),
            ...(fundRiskIndicator === undefined
              ? {}
              : { fundRiskIndicator }),
            ...(latestFer === undefined ? {} : { latestFer }),
            ...Object.fromEntries(
              Object.entries(fees).filter(
                ([, value]) => value !== undefined,
              ),
            ),
            ...(feeCaps.length ? { feeCaps } : {}),
            ...(Object.keys(feeDisclosures).length
              ? { feeDisclosures }
              : {}),
          },
        }
      : {}),
  };
}
