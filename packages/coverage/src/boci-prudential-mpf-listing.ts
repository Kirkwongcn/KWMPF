/**
 * 中銀國際英國保誠信託官網「強積金價格及表現」數據接口（ADR 0014）。
 *
 * `POST https://www.boci-pru.com.hk/en/api/mpf/MpfFund/mpfListing`（body `{"Lang":"en"}`）回傳
 * 中銀保誠簡易強積金計劃全部成分基金，連累積回報（3 個月、年初至今、1、3、5 年、成立至今）
 * 同每隻基金的 `asOfDate`；網頁 `https://www.boci-pru.com.hk/en/mpf/mpf-prices` 嘅「累積回報」
 * 就係呢個接口。接口只提供最新一期。
 *
 * 只認以下情況，否則成份回應報錯，唔出局部資料：
 * - 表頭 `header.cumulative` 有「1Y」「3Y」「5Y」，冇「10Y」（`tenY` 永遠留空，唔當官方數字）；
 * - 每隻基金都有同一個 `asOfDate`（YYYY-MM-DD）；
 * - 一年、三年係 `12.34` 格式（官方冇百分號）；五年未滿留空記官方未提供（唔當 0）；
 * - 英文名除咗 `<sup>…</sup>` 註腳標記，冇其他 HTML（註腳係風險披露同預設投資策略標示，唔關回報計法）；
 * - 每隻基金 `showCumulative` 係 `"Y"`、`nNA` 係 `null`（網頁照顯示累積回報）。
 */

export type BociPrudentialRow = {
  stockCode: string;
  name: string;
  oneYear: number;
  threeYears: number;
  /** `null` 代表官方留空（成立未滿五年）。 */
  fiveYears: number | null;
  /** 官方原文照錄，例如 `9.03`、`-13.80`。 */
  printedThreeYears: string;
};

export type BociPrudentialListing = { asOfDate: string; rows: BociPrudentialRow[] };

const NUMBER = /^-?\d+(?:\.\d+)?$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function readNumber(value: unknown, where: string) {
  if (typeof value !== "string" || !NUMBER.test(value))
    throw new Error(`BOCI-Prudential MPF listing: unexpected value ${JSON.stringify(value)} for ${where}`);
  return Number(value);
}

// 「BOC-Prudential Core Accumulation Fund<sup>+</sup>」：註腳標記唔屬基金名。
function englishName(raw: unknown, where: string) {
  if (typeof raw !== "string") throw new Error(`BOCI-Prudential MPF listing: ${where} has no English name`);
  const name = raw.replace(/<sup>[^<]*<\/sup>/gu, "").trim();
  if (!name || /[<>]/u.test(name)) throw new Error(`BOCI-Prudential MPF listing: unexpected markup in ${JSON.stringify(raw)}`);
  return name;
}

type RawFund = {
  stockCode?: unknown;
  fundName?: { nameEn?: unknown };
  asOfDate?: unknown;
  cumulative?: { oneY?: unknown; threeY?: unknown; fiveY?: unknown };
  showCumulative?: unknown;
  nNA?: unknown;
};

export function parseBociPrudentialListing(body: unknown): BociPrudentialListing {
  const response = body as { header?: { cumulative?: unknown }; data?: unknown };
  const columns = response?.header?.cumulative;
  if (
    !Array.isArray(columns) ||
    !["1Y", "3Y", "5Y"].every((column) => columns.includes(column)) ||
    columns.includes("10Y")
  )
    throw new Error(`BOCI-Prudential MPF listing: unexpected cumulative columns ${JSON.stringify(columns)}`);
  const list = response.data;
  if (!Array.isArray(list) || list.length === 0) throw new Error("BOCI-Prudential MPF listing: response has no fund list");
  const dates = new Set<string>();
  const rows = (list as RawFund[]).map((fund) => {
    const where = typeof fund.stockCode === "string" ? fund.stockCode : "fund";
    if (typeof fund.stockCode !== "string" || !fund.stockCode) throw new Error("BOCI-Prudential MPF listing: fund without a code");
    const name = englishName(fund.fundName?.nameEn, where);
    if (typeof fund.asOfDate !== "string" || !ISO_DATE.test(fund.asOfDate))
      throw new Error(`BOCI-Prudential MPF listing: ${where} has no as-of date`);
    dates.add(fund.asOfDate);
    // 網頁唔顯示累積回報（或者標咗唔適用）嘅基金，接口數字唔當官方披露。
    if (fund.showCumulative !== "Y" || fund.nNA !== null)
      throw new Error(
        `BOCI-Prudential MPF listing: ${where} cumulative returns are not shown (showCumulative ${JSON.stringify(fund.showCumulative)}, nNA ${JSON.stringify(fund.nNA)})`,
      );
    const cumulative = fund.cumulative;
    // 三年留空即係成立未滿三年；呢個計劃暫時冇咁嘅基金，出現就成份停低，等人手確認官方點寫。
    const threeYears = readNumber(cumulative?.threeY, `${where} 3-year`);
    return {
      stockCode: fund.stockCode,
      name,
      oneYear: readNumber(cumulative?.oneY, `${where} 1-year`),
      threeYears,
      fiveYears: cumulative?.fiveY === "" ? null : readNumber(cumulative?.fiveY, `${where} 5-year`),
      printedThreeYears: cumulative!.threeY as string,
    } satisfies BociPrudentialRow;
  });
  if (dates.size !== 1) throw new Error(`BOCI-Prudential MPF listing: mixed as-of dates ${[...dates].join(", ")}`);
  const codes = rows.map((row) => row.stockCode);
  if (new Set(codes).size !== codes.length) throw new Error("BOCI-Prudential MPF listing repeats a fund code");
  return { asOfDate: [...dates][0]!, rows };
}
