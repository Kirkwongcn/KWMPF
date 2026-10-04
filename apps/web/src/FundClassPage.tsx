import { useEffect, useState } from "react";
import { PeerPosition } from "./PeerPosition";
import { RiskScale } from "./Charts";
import { SiteChrome } from "./SiteChrome";
import {
  ValueBars,
  AllocationChart,
  CalendarColumns,
  isUsableAllocation,
} from "./DataCharts";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";
import { NarrativeBlock, type FundNarrativeFields } from "./FundNarrative";
import type {
  FactSheetUnavailableKind,
  PublishedFactSheetPayload,
} from "../../../packages/coverage/src/fact-sheet-published";
import { pointInTimeAsOf } from "../../../packages/coverage/src/fact-sheet-temporal";

export type PublishedFundClass = {
  snapshotId: string;
  comparisonGroup?: string;
  comparisonGroupFamily?: string | null;
  classification?: {
    provider: string;
    capturedAt: string;
    official: true;
  } | null;
  fundClass: {
    trusteeName: string;
    schemeName: string;
    constituentFundName: string;
    fundClassName: string;
    fundType: string;
    fundCategory: string;
    annualizedReturn1y?: number;
    annualizedReturn3y?: number;
    cumulativeReturn3y?: number;
    returnSources?: Record<string, { dataAsOf: string; sourceUrl: string }>;
    annualizedReturn5y?: number;
    annualizedReturn10y?: number;
    cumulativeReturn1y?: number;
    cumulativeReturn5y?: number;
    cumulativeReturn10y?: number;
    riskClass?: number;
    fundRiskIndicator?: number;
    latestFer?: number;
    managementFee?: number;
    oci1yHkd?: number;
    oci3yHkd?: number;
    oci5yHkd?: number;
    trusteeCustodianFee?: number;
    empfPlatformFee?: number;
    memberServicingFee?: number;
    investmentManagementFee?: number;
    guaranteeCharge?: number;
    joiningFee?: number;
    annualFee?: number;
    contributionCharge?: number;
    bidSpread?: number;
    offerSpread?: number;
    withdrawalCharge?: number;
    feeCaps?: string[];
    feeDisclosures?: Record<string, string>;
    fundSizeHkdMillion?: number;
    fundSizeAsOf?: string;
    returnsAsOf?: string;
    launchDate?: string;
    calendarYearReturns?: Record<string, number>;
    sinceLaunchReturnAnnualized?: number;
    sinceLaunchReturnCumulative?: number;
    isDisComponent?: "core_accumulation" | "age65_plus";
  };
  provenance: {
    sourceUrl: string;
    dataAsOf: string;
    retrievedAt: string;
    verificationStatus: "verified";
  };
  freshness?: {
    status: "verified" | "stale";
    dataAsOf: string;
    graceDays: number;
    ageDays: number | null;
  };
  fundSizeFreshness?: {
    status: "verified" | "stale";
    dataAsOf: string;
    graceDays: number;
    ageDays: number | null;
  };
  returnsFreshness?: Record<
    string,
    { status: "verified" | "stale"; dataAsOf: string }
  >;
  factSheetDisclosure?: FactSheetDisclosure;
};

/**
 * 計劃便覽披露的配置及十大持倉。維度標題、標籤及證券名稱一律原文照錄，
 * 百分比的小數位數沿用披露本身，不固定成兩位小數。
 */
type FactSheetDisclosure = PublishedFactSheetPayload;

type InterpretationFactor = {
  status:
    "higher" | "lower" | "similar" | "insufficient-sample" | "unavailable";
  text: string;
};

type MetricSampleDates = {
  from: string | null;
  to: string | null;
  undatedCount: number;
};

type InterpretationProvenance = {
  fundSourceLabel: string;
  fundSourceUrl: string | null;
  fundFieldAsOf: string | null;
  fundDocumentAsOf: string | null;
  groupSourceLabel: string;
  groupSampleCount: number;
  groupMemberCount: number;
  groupSampleDates: MetricSampleDates | null;
};

type InterpretationResponse = {
  snapshotId: string;
  comparisonGroup: string;
  comparisonGroupSource: "mpfa";
  values: Record<
    "top10Concentration" | "volatility3y",
    { fund: number | null; groupAverage: number | null; official?: false }
  >;
  provenance: Record<
    "top10Concentration" | "volatility3y",
    InterpretationProvenance
  >;
  interpretation: {
    thresholdVersion: string;
    thresholdStatus: string;
    top10Concentration: InterpretationFactor;
    volatility3y: InterpretationFactor;
  };
};

const interpretationFactors = [
  ["top10Concentration", "十大持倉集中度", "十大持倉披露比重合計"],
  ["volatility3y", "3年波幅", "官方基金風險指標"],
] as const;

function formatSampleDateRange(dates: MetricSampleDates | null): string {
  if (!dates) return "樣本日期範圍未記錄";
  if (dates.from && dates.to) {
    return dates.from === dates.to
      ? `截至 ${dates.from}`
      : `${dates.from} 至 ${dates.to}`;
  }
  if (dates.from || dates.to)
    return `部分日期已記錄（${dates.from ?? dates.to}）`;
  return dates.undatedCount > 0
    ? "有值樣本的欄位日期未明示"
    : "沒有可用樣本日期";
}

function formatFundSourceDate(
  factor: "top10Concentration" | "volatility3y",
  evidence: InterpretationProvenance,
): string {
  if (evidence.fundFieldAsOf) {
    return factor === "volatility3y"
      ? `平台數據截至 ${evidence.fundFieldAsOf}`
      : `欄位截至 ${evidence.fundFieldAsOf}`;
  }
  if (evidence.fundDocumentAsOf) {
    return `欄位日期未明示；便覽日期 ${evidence.fundDocumentAsOf}`;
  }
  return "欄位截至日期未明示";
}

function InterpretationPanel({
  apiBaseUrl,
  fundClassId,
  expectedSnapshotId,
}: {
  apiBaseUrl: string;
  fundClassId: string;
  expectedSnapshotId: string;
}) {
  const [result, setResult] = useState<InterpretationResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(
      `${apiBaseUrl}/fund-classes/${encodeURIComponent(fundClassId)}/interpretation`,
    )
      .then((response) => {
        if (!response.ok) throw new Error("Interpretation unavailable");
        return response.json() as Promise<InterpretationResponse>;
      })
      .then((next) => {
        if (next.snapshotId !== expectedSnapshotId)
          throw new Error("Snapshot changed while loading");
        setResult(next);
      })
      .catch(() => setFailed(true));
  }, [apiBaseUrl, expectedSnapshotId, fundClassId]);

  if (failed)
    return (
      <section
        className="kw-section"
        aria-labelledby="fund-interpretation-title"
      >
        <h2 className="kw-section__heading" id="fund-interpretation-title">
          基金解讀
        </h2>
        <p className="kw-status kw-status--negative">未能取得基金解讀。</p>
      </section>
    );
  if (!result)
    return (
      <section
        className="kw-section"
        aria-labelledby="fund-interpretation-title"
      >
        <h2 className="kw-section__heading" id="fund-interpretation-title">
          基金解讀
        </h2>
        <p className="kw-status">正在載入基金解讀…</p>
      </section>
    );

  return (
    <section className="kw-section" aria-labelledby="fund-interpretation-title">
      <h2 className="kw-section__heading" id="fund-interpretation-title">
        基金解讀
      </h2>
      <div className="kw-card kw-interpretation-intro">
        <p>
          以下把基金同 <strong>{result.comparisonGroup}</strong>{" "}
          組別平均比較。兩項因素都固定於同一發布快照，不會隨回報期間改變；基金便覽期別可能與平台快照不同。
        </p>
        <p className="kw-muted" role="note">
          「相若」試用門檻為相差不超過 2 個百分點；規則版本{" "}
          {result.interpretation.thresholdVersion}
          。組別平均按已核實基金的可用樣本計算，樣本可能包括本基金。高低只描述差距，不代表優劣、適合程度或回報原因。
        </p>
      </div>
      <div className="kw-interpretation-grid">
        {interpretationFactors.map(([key, label, note]) => {
          const factor = result.interpretation[key];
          const values = result.values[key];
          const evidence = result.provenance[key];
          const sampleDates = evidence.groupSampleDates;
          const comparable =
            factor.status !== "insufficient-sample" &&
            factor.status !== "unavailable" &&
            values.fund !== null &&
            values.groupAverage !== null;
          const scale = comparable
            ? Math.max(values.fund!, values.groupAverage!, 1)
            : 1;
          return (
            <article className="kw-card kw-interpretation" key={key}>
              <header>
                <div>
                  <h3>{label}</h3>
                  <p className="kw-muted">{note}</p>
                </div>
                <span
                  className={`kw-interpretation__badge kw-interpretation__badge--${factor.status}`}
                >
                  {factor.status === "higher"
                    ? "較高"
                    : factor.status === "lower"
                      ? "較低"
                      : factor.status === "similar"
                        ? "相若"
                        : factor.status === "insufficient-sample"
                          ? "樣本不足"
                          : "資料不足"}
                </span>
              </header>
              <p className="kw-interpretation__text">{factor.text}</p>
              {comparable && (
                <div
                  className="kw-comparison-bars"
                  role="img"
                  aria-label={`${label}：基金 ${values.fund}%，同組別平均 ${values.groupAverage}%`}
                >
                  {(["fund", "groupAverage"] as const).map((valueKey) => (
                    <div className="kw-comparison-bars__row" key={valueKey}>
                      <span>
                        {valueKey === "fund" ? "這隻基金" : "組別平均"}
                      </span>
                      <div className="kw-comparison-bars__track">
                        <span
                          style={{
                            width: `${(values[valueKey]! / scale) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{values[valueKey]}%</strong>
                    </div>
                  ))}
                </div>
              )}
              <dl className="kw-interpretation__metadata">
                <div>
                  <dt>本基金來源</dt>
                  <dd>
                    {evidence.fundSourceUrl ? (
                      <a
                        href={evidence.fundSourceUrl}
                        aria-label={`${evidence.fundSourceLabel}（在新分頁開啟）`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {evidence.fundSourceLabel}
                      </a>
                    ) : (
                      evidence.fundSourceLabel
                    )}
                  </dd>
                </div>
                <div>
                  <dt>組別平均來源</dt>
                  <dd>{evidence.groupSourceLabel}</dd>
                </div>
                <div>
                  <dt>本基金日期</dt>
                  <dd>{formatFundSourceDate(key, evidence)}</dd>
                </div>
                <div>
                  <dt>組別樣本</dt>
                  <dd>
                    {evidence.groupSampleCount} / {evidence.groupMemberCount}{" "}
                    隻已核實基金有可用數值
                  </dd>
                </div>
                <div>
                  <dt>組別樣本日期</dt>
                  <dd>
                    {formatSampleDateRange(sampleDates)}
                    {sampleDates?.undatedCount
                      ? `；另有 ${sampleDates.undatedCount} 筆有值樣本未明示欄位日期`
                      : ""}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * 「官方未提供」同「官方以圖表披露」是兩回事，票 #210 要求分開講。
 * 抽取層在知道分別那一刻記下代號，這裡只做對照，不靠原因文字反推。
 */
const unavailableWording: Record<FactSheetUnavailableKind, string> = {
  "not-disclosed": "官方未提供。這份便覽沒有披露這一項。",
  "chart-only":
    "官方以圖表披露。便覽把這一項畫成圖表，文件內沒有可讀取的文字數值，本網站不會靠圖片估算。",
  "values-without-names":
    "官方以圖表披露。便覽有百分比，但項目名稱畫成圖形而非文字；只列出讀得到的部分會令名單短一截，等同改寫官方披露，所以整項不顯示。",
  "overlaid-text-layer":
    "官方文件無法可靠讀取。便覽的文字層把另一隻基金的同一張表疊印在同一位置，分不清哪個數值屬哪一隻基金。",
  "unreadable-layout":
    "官方有披露，但本站未能完整讀取。這段文字在便覽中跨頁或改為中英並排，只顯示讀到的部分等同刪改原文，所以不顯示，請開啟官方便覽查閱。",
};

function unavailableNote(field: string, disclosure: FactSheetDisclosure) {
  if (!disclosure.unavailableFields.includes(field)) return undefined;
  // 帶代號之前發布的快照沒有這一欄，當「未提供」處理，好過留白。
  return unavailableWording[
    disclosure.unavailableKinds?.[field] ?? "not-disclosed"
  ];
}

/** 文字欄位的缺口措辭：同表格分開，因為文字冇「圖表」或「名稱畫成圖形」之分。 */
function narrativeMissing(
  field:
    keyof FundNarrativeFields | `schemeNarrative.${keyof FundNarrativeFields}`,
  disclosure: FactSheetDisclosure | undefined,
) {
  if (!disclosure) return "未取得：這隻基金未配對到官方便覽。";
  if (disclosure.unavailableFields.includes(field)) {
    const kind = disclosure.unavailableKinds?.[field];
    if (kind === "overlaid-text-layer") {
      return "官方文件無法可靠讀取。便覽在同一位置疊印了另一版文字，分不清哪段屬這隻基金，所以不顯示。";
    }
    if (kind === "unreadable-layout")
      return unavailableWording["unreadable-layout"];
    return "官方未提供。這份便覽沒有披露這一項。";
  }
  return "未取得：本站暫未抽取這份便覽的文字欄位，可開啟官方便覽查閱。";
}

/**
 * 最新投資方向：基金本身的評論優先。基金本身官方未提供（或者契約冇呢個欄位）先用
 * 計劃層面評論（ADR 0012 第 5 點）；基金本身官方有但讀唔到（疊印、讀唔齊），要講缺口，
 * 唔可以用計劃層面文字蓋過。
 */
function directionText(disclosure: FactSheetDisclosure | undefined) {
  const own = disclosure?.narrative?.managerCommentary;
  if (own) return { text: own, schemeLevel: false };
  const ownKind = disclosure?.unavailableFields.includes("managerCommentary")
    ? (disclosure.unavailableKinds?.managerCommentary ?? "not-disclosed")
    : undefined;
  const scheme =
    ownKind === undefined || ownKind === "not-disclosed"
      ? disclosure?.schemeNarrative?.managerCommentary
      : undefined;
  if (scheme) return { text: scheme, schemeLevel: true };
  // 計劃層面讀過但讀唔到，而基金本身冇失敗紀錄，就講計劃層面嗰個原因。
  const schemeFailed =
    ownKind === undefined &&
    disclosure?.unavailableFields.includes("schemeNarrative.managerCommentary");
  return {
    text: undefined,
    schemeLevel: false,
    missing: narrativeMissing(
      schemeFailed ? "schemeNarrative.managerCommentary" : "managerCommentary",
      disclosure,
    ),
  };
}

/**
 * 受託人便覽的市場預測（永明：Positive／Neutral／Negative），原文照錄、唔翻譯。
 * 契約冇聲明呢個欄位的計劃唔顯示；官方印「N/A」就講官方未提供。
 */
function MarketForecast({
  disclosure,
}: {
  disclosure: FactSheetDisclosure | undefined;
}) {
  const forecast = disclosure?.narrative?.marketForecast;
  const value = forecast ? (forecast.zh ?? forecast.en) : undefined;
  if (!value && !disclosure?.unavailableFields.includes("marketForecast")) {
    return null;
  }
  return (
    <p className="kw-narrative__forecast">
      便覽市場預測：
      {value ? (
        <>
          <strong lang={forecast?.zh ? "zh-HK" : "en"}>{value}</strong>
          <small>（受託人原文）</small>
        </>
      ) : (
        narrativeGapShort("marketForecast", disclosure)
      )}
    </p>
  );
}

/**
 * 短版缺口說明（清單內用）：同 `narrativeMissing` 一樣按代號分，唔可以把讀唔到講成
 * 官方未提供。
 */
function narrativeGapShort(
  field: keyof FundNarrativeFields,
  disclosure: FactSheetDisclosure | undefined,
) {
  if (!disclosure) return "未取得（未配對官方便覽）";
  if (!disclosure.unavailableFields.includes(field))
    return "未取得（本站暫未抽取）";
  const kind = disclosure.unavailableKinds?.[field];
  if (kind === "overlaid-text-layer") return "官方文件無法可靠讀取";
  if (kind === "unreadable-layout") return "官方有披露，本站未能完整讀取";
  return "官方未提供";
}

/** 本站計算：成立至今的整年數。 */
function yearsSince(launchDate: string, today = new Date()) {
  const [year, month, day] = launchDate.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  let years = today.getUTCFullYear() - year;
  if (
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)
  )
    years -= 1;
  return years >= 0 ? years : undefined;
}

type FeeField =
  | "managementFee"
  | "trusteeCustodianFee"
  | "empfPlatformFee"
  | "memberServicingFee"
  | "investmentManagementFee"
  | "guaranteeCharge"
  | "joiningFee"
  | "annualFee"
  | "contributionCharge"
  | "bidSpread"
  | "offerSpread"
  | "withdrawalCharge"
  | "oci1yHkd"
  | "oci3yHkd"
  | "oci5yHkd";

const recurringFeeRows: Array<[string, FeeField]> = [
  ["管理費", "managementFee"],
  ["受託人／保管人費", "trusteeCustodianFee"],
  ["積金易平台費", "empfPlatformFee"],
  ["成員服務費", "memberServicingFee"],
  ["投資管理費", "investmentManagementFee"],
  ["保證費", "guaranteeCharge"],
];

const oneOffChargeRows: Array<[string, FeeField]> = [
  ["加入費", "joiningFee"],
  ["年費", "annualFee"],
  ["供款收費", "contributionCharge"],
  ["買入差價", "bidSpread"],
  ["賣出差價", "offerSpread"],
  ["提取收費", "withdrawalCharge"],
];

const ociRows: Array<[string, FeeField]> = [
  ["一年", "oci1yHkd"],
  ["三年", "oci3yHkd"],
  ["五年", "oci5yHkd"],
];

const feeLabels: Record<string, string> = Object.fromEntries(
  [...recurringFeeRows, ...oneOffChargeRows, ...ociRows].map(
    ([label, field]) => [field, label],
  ),
);

export function FundClassPage({
  apiBaseUrl,
  fundClassId,
}: {
  apiBaseUrl: string;
  fundClassId: string;
}) {
  const unavailable = "未取得";
  const formatNumber = (
    value: number | undefined,
    _digits: number,
    suffix = "",
  ) => (typeof value === "number" ? `${value}${suffix}` : unavailable);
  const [publication, setPublication] = useState<PublishedFundClass | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "interpretation">(
    new URLSearchParams(window.location.search).get("tab") === "interpretation"
      ? "interpretation"
      : "details",
  );
  function changeTab(next: "details" | "interpretation") {
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState({}, "", url.pathname + url.search);
  }
  useEffect(() => {
    const restore = () =>
      setActiveTab(
        new URLSearchParams(window.location.search).get("tab") ===
          "interpretation"
          ? "interpretation"
          : "details",
      );
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/fund-classes/${encodeURIComponent(fundClassId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Fund class unavailable");
        return response.json() as Promise<PublishedFundClass>;
      })
      .then(setPublication)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl, fundClassId]);

  if (failed)
    return (
      <SiteChrome eyebrow="基金詳情" title="未能取得基金資料">
        <section className="kw-section">
          <p className="kw-status kw-status--negative">未能取得基金資料。</p>
        </section>
      </SiteChrome>
    );
  if (!publication)
    return (
      <SiteChrome eyebrow="基金詳情" title="載入中">
        <section className="kw-section">
          <p className="kw-status">正在載入基金資料…</p>
        </section>
      </SiteChrome>
    );

  const { fundClass, provenance, snapshotId, freshness } = publication;
  const comparisonGroup = publication.comparisonGroup ?? fundClass.fundCategory;
  const fundSizeFreshness = publication.fundSizeFreshness;
  const calendarYears = Object.keys(fundClass.calendarYearReturns ?? {}).sort(
    (a, b) => Number(b) - Number(a),
  );
  const feeCaps = fundClass.feeCaps ?? [];
  const feeDisclosureRows = Object.entries(fundClass.feeDisclosures ?? {});
  const capSuffix = (field: FeeField) =>
    feeCaps.includes(field) ? "（上限）" : "";
  // 官方費率的小數位數由披露本身決定（例如 1.205%、0.575%），
  // 固定成兩位小數會把披露值改寫成另一個數字，所以照原值顯示。
  const feeRate = (field: FeeField) => {
    const value = fundClass[field];
    if (typeof value !== "number")
      return fundClass.feeDisclosures?.[field] ? "見下方文字披露" : unavailable;
    return `${value}%${capSuffix(field)}`;
  };
  const feeAmount = (field: FeeField) => {
    const value = fundClass[field];
    if (typeof value !== "number")
      return fundClass.feeDisclosures?.[field] ? "見下方文字披露" : unavailable;
    return `HK$${value.toLocaleString("en-US")}${capSuffix(field)}`;
  };
  const datesDiffer = Boolean(
    fundClass.fundSizeAsOf &&
    fundClass.returnsAsOf &&
    fundClass.fundSizeAsOf !== fundClass.returnsAsOf,
  );
  const factSheetDisclosure = publication.factSheetDisclosure;
  const direction = directionText(factSheetDisclosure);
  const periodOf: Record<string, string> = {
    一年: "1",
    三年: "3",
    五年: "5",
    十年: "10",
  };
  const returnUnavailable = (period: string) => {
    const reported: Record<string, number | undefined> = {
      "1": fundClass.annualizedReturn1y,
      "3": fundClass.annualizedReturn3y,
      "5": fundClass.annualizedReturn5y,
      "10": fundClass.annualizedReturn10y,
    };
    if (typeof reported[period] === "number") return undefined;
    const declaration = factSheetDisclosure?.returnUnavailable?.[period];
    return declaration?.reason === "official-na" &&
      factSheetDisclosure?.unavailableFields.includes(
        `annualizedReturn${period}y`,
      )
      ? declaration
      : undefined;
  };
  const allocationAsOf = pointInTimeAsOf(
    factSheetDisclosure?.temporalScopes?.allocation,
  );
  const topHoldingsAsOf = pointInTimeAsOf(
    factSheetDisclosure?.temporalScopes?.topHoldings,
  );
  // 便覽文件日期同平台快照日期各自保留；欄位日期必須由自身 scope 明確提供。
  const factSheetDatesDiffer = Boolean(
    factSheetDisclosure &&
    factSheetDisclosure.factSheetAsOf !== provenance.dataAsOf,
  );
  return (
    <SiteChrome
      eyebrow={fundClass.schemeName}
      title={fundClass.constituentFundName}
      subtitle={joinFundParts(
        fundClass.schemeName,
        fundClassLabel(fundClass.fundClassName),
        `${fundClass.fundType}／${fundClass.fundCategory}`,
      )}
      titleBlock={[
        { label: "計劃", value: fundClass.schemeName },
        { label: "受託人", value: fundClass.trusteeName },
        {
          label: "積金局基金類型",
          value: publication.comparisonGroupFamily
            ? comparisonGroup
            : publication.comparisonGroupFamily === null
              ? "積金局平台未提供"
              : "未取得",
        },
        { label: "平台資料截至", value: provenance.dataAsOf },
        {
          label: "來源",
          value: (
            <a href={provenance.sourceUrl} target="_blank" rel="noreferrer">
              積金局平台原頁
            </a>
          ),
        },
      ]}
    >
      <div className="kw-tabs" role="group" aria-label="基金頁內容">
        <button
          aria-pressed={activeTab === "details"}
          className="kw-tabs__tab"
          onClick={() => changeTab("details")}
          type="button"
        >
          基金資料
        </button>
        <button
          aria-pressed={activeTab === "interpretation"}
          className="kw-tabs__tab"
          onClick={() => changeTab("interpretation")}
          type="button"
        >
          基金解讀
        </button>
      </div>
      {activeTab === "interpretation" ? (
        <div className="kw-page-panel">
          <InterpretationPanel
            apiBaseUrl={apiBaseUrl}
            expectedSnapshotId={snapshotId}
            fundClassId={fundClassId}
          />
        </div>
      ) : (
        <div className="kw-page-panel">
          <NarrativeBlock
            id="fund-objective-title"
            title="投資目標"
            text={factSheetDisclosure?.narrative?.investmentObjective}
            missing={narrativeMissing(
              "investmentObjective",
              factSheetDisclosure,
            )}
            source={
              factSheetDisclosure?.factSheetUrl
                ? {
                    url: factSheetDisclosure.factSheetUrl,
                    label: "開啟官方便覽",
                  }
                : undefined
            }
            date={
              factSheetDisclosure
                ? { asOf: factSheetDisclosure.factSheetAsOf, label: "便覽截至" }
                : undefined
            }
          />
          <NarrativeBlock
            id="fund-direction-title"
            title="最新投資方向"
            collapsible
            aside={<MarketForecast disclosure={factSheetDisclosure} />}
            text={direction.text}
            schemeLevel={direction.schemeLevel}
            missing={
              direction.missing ??
              narrativeMissing("managerCommentary", factSheetDisclosure)
            }
            source={
              factSheetDisclosure?.factSheetUrl
                ? {
                    url: factSheetDisclosure.factSheetUrl,
                    label: "開啟官方便覽",
                  }
                : undefined
            }
            date={
              factSheetDisclosure
                ? pointInTimeAsOf(
                    factSheetDisclosure.temporalScopes?.commentary,
                  )
                  ? {
                      asOf: pointInTimeAsOf(
                        factSheetDisclosure.temporalScopes?.commentary,
                      ) as string,
                      label: "評論截至",
                    }
                  : {
                      asOf: factSheetDisclosure.factSheetAsOf,
                      label: "便覽截至（評論未另註日期）",
                    }
                : undefined
            }
          />
          <section className="kw-section" aria-labelledby="fund-profile-title">
            <h2 className="kw-section__heading" id="fund-profile-title">
              基金特色
            </h2>
            <div className="kw-card">
              <dl className="status-list">
                <div>
                  <dt>投資經理</dt>
                  <dd>
                    {factSheetDisclosure?.narrative?.investmentManager ? (
                      <>
                        {factSheetDisclosure.narrative.investmentManager.zh ??
                          factSheetDisclosure.narrative.investmentManager.en}
                        <small className="kw-muted">
                          {" "}
                          （便覽截至 {factSheetDisclosure.factSheetAsOf}）
                        </small>
                      </>
                    ) : (
                      narrativeGapShort(
                        "investmentManager",
                        factSheetDisclosure,
                      )
                    )}
                  </dd>
                </div>
                <div>
                  <dt>基金規模</dt>
                  <dd>
                    {typeof fundClass.fundSizeHkdMillion === "number"
                      ? `HK$${String(fundClass.fundSizeHkdMillion)} 百萬`
                      : unavailable}
                    {fundClass.fundSizeAsOf
                      ? `（截至 ${fundClass.fundSizeAsOf}）`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>成立日期</dt>
                  <dd>
                    <span>{fundClass.launchDate ?? unavailable}</span>
                    {fundClass.launchDate &&
                      yearsSince(fundClass.launchDate) !== undefined && (
                        <small className="kw-muted">
                          {" "}
                          （成立 {yearsSince(fundClass.launchDate)}{" "}
                          年，本站計算）
                        </small>
                      )}
                  </dd>
                </div>
                {fundClass.isDisComponent && (
                  <div>
                    <dt>預設投資策略</dt>
                    <dd>
                      {fundClass.isDisComponent === "core_accumulation"
                        ? "核心累積基金"
                        : "65歲後基金"}
                    </dd>
                  </div>
                )}
              </dl>
              {fundSizeFreshness?.status === "stale" && (
                <p className="kw-status kw-status--warning">
                  基金規模已超出網站時效門檻（{fundSizeFreshness.graceDays}{" "}
                  日），截至日期仍為 {fundSizeFreshness.dataAsOf}。
                </p>
              )}
              {datesDiffer && (
                <p className="kw-muted" role="note">
                  基金規模截至 {fundClass.fundSizeAsOf}，回報截至{" "}
                  {fundClass.returnsAsOf}，兩者期別不同，並非完全可比。
                </p>
              )}
              <p className="kw-muted">
                成立日期是靜態事實，不設過期；基金規模沿用網站的月度時效門檻。
              </p>
            </div>
          </section>
          <section className="kw-section" aria-labelledby="fund-figures-title">
            <h2 className="kw-section__heading" id="fund-figures-title">
              主要數據
            </h2>
            <p className="kw-table-hint">
              左右滑動可查看年率化、累積回報及來源
            </p>
            <div
              className="kw-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="基金回報表，可左右捲動查看所有欄位"
            >
              <table className="kw-table" aria-label="回報">
                <thead>
                  <tr>
                    <th scope="col">期間</th>
                    <th scope="col">年率化回報</th>
                    <th scope="col">累積回報</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      [
                        "一年",
                        fundClass.annualizedReturn1y,
                        fundClass.cumulativeReturn1y,
                      ],
                      [
                        "三年",
                        fundClass.annualizedReturn3y,
                        fundClass.cumulativeReturn3y,
                      ],
                      [
                        "五年",
                        fundClass.annualizedReturn5y,
                        fundClass.cumulativeReturn5y,
                      ],
                      [
                        "十年",
                        fundClass.annualizedReturn10y,
                        fundClass.cumulativeReturn10y,
                      ],
                      [
                        "成立至今",
                        fundClass.sinceLaunchReturnAnnualized,
                        fundClass.sinceLaunchReturnCumulative,
                      ],
                    ] as const
                  ).map(([horizon, annualized, cumulative]) => (
                    <tr key={horizon}>
                      <th scope="row">{horizon}</th>
                      <td className="kw-return">
                        {typeof annualized !== "number" &&
                        returnUnavailable(periodOf[horizon] ?? "")
                          ? "官方未提供（N/A）"
                          : formatNumber(annualized, 2, "%")}
                        {horizon !== "成立至今" &&
                          typeof annualized !== "number" && (
                            <small>
                              {returnUnavailable(periodOf[horizon] ?? "") ? (
                                <>
                                  截至{" "}
                                  {
                                    returnUnavailable(periodOf[horizon]!)!
                                      .dataAsOf
                                  }{" "}
                                  ·{" "}
                                  <a
                                    href={
                                      returnUnavailable(periodOf[horizon]!)!
                                        .sourceUrl
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    官方便覽（第{" "}
                                    {
                                      returnUnavailable(periodOf[horizon]!)!
                                        .page
                                    }{" "}
                                    頁）
                                  </a>
                                </>
                              ) : (
                                "日期未記錄"
                              )}
                            </small>
                          )}
                        {horizon !== "成立至今" &&
                          typeof annualized === "number" && (
                            <small>
                              {publication.returnsFreshness?.[
                                (
                                  {
                                    一年: "1",
                                    三年: "3",
                                    五年: "5",
                                    十年: "10",
                                  } as const
                                )[horizon]
                              ]?.status === "stale"
                                ? "過期 · "
                                : ""}
                              截至{" "}
                              {publication.returnsFreshness?.[
                                (
                                  {
                                    一年: "1",
                                    三年: "3",
                                    五年: "5",
                                    十年: "10",
                                  } as const
                                )[horizon]
                              ]?.dataAsOf ??
                                fundClass.returnsAsOf ??
                                provenance.dataAsOf}{" "}
                              ·{" "}
                              <a
                                href={
                                  fundClass.returnSources?.[
                                    (
                                      {
                                        一年: "1",
                                        三年: "3",
                                        五年: "5",
                                        十年: "10",
                                      } as const
                                    )[horizon]
                                  ]?.sourceUrl ?? provenance.sourceUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                官方來源
                              </a>
                            </small>
                          )}
                      </td>
                      <td className="kw-return">
                        {formatNumber(cumulative, 2, "%")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ValueBars
              variant="dot"
              label="各期間年率化回報（獨立披露，非走勢）"
              rows={(
                [
                  ["1", "annualizedReturn1y"],
                  ["3", "annualizedReturn3y"],
                  ["5", "annualizedReturn5y"],
                  ["10", "annualizedReturn10y"],
                ] as const
              ).map(([period, field]) => ({
                label: period + " 年",
                value:
                  publication.returnsFreshness?.[period]?.status === "verified"
                    ? fundClass[field]
                    : null,
                display:
                  publication.returnsFreshness?.[period]?.status === "stale"
                    ? "過期，暫不繪圖"
                    : typeof fundClass[field] === "number" &&
                        publication.returnsFreshness?.[period]?.status !==
                          "verified"
                      ? "未核實，暫不繪圖"
                      : returnUnavailable(period)
                        ? "官方未提供（N/A）"
                        : undefined,
                note: publication.returnsFreshness?.[period]?.dataAsOf
                  ? `${publication.returnsFreshness[period].status === "stale" ? "過期 · " : ""}截至 ${publication.returnsFreshness[period].dataAsOf}`
                  : returnUnavailable(period)
                    ? `截至 ${returnUnavailable(period)!.dataAsOf}`
                    : "日期未記錄",
              }))}
            />
            <dl className="status-list">
              <div>
                <dt>風險級別</dt>
                <dd>
                  {fundClass.riskClass ?? unavailable}
                  <RiskScale riskClass={fundClass.riskClass} />
                </dd>
              </div>
              <div>
                <dt>基金風險指標</dt>
                <dd>
                  {typeof fundClass.fundRiskIndicator === "number"
                    ? formatNumber(fundClass.fundRiskIndicator, 2, "%")
                    : unavailable}
                </dd>
              </div>
            </dl>
            <p className="kw-muted" role="note">
              基金風險指標是過去三年的年度化標準差，數字越高代表過往價格波動越大；風險級別是積金局按該指標劃分的
              1 至 7 級。成立不足三年的基金官方不會提供指標。
            </p>
            <p className="kw-muted" role="note">
              年率化回報是每年平均變幅，適合與其他基金比較；累積回報是整段期間的總變幅，反映同一筆本金實際增減。數值來自官方平台或受託人便覽，網站不會自行換算。
            </p>
          </section>
          <section className="kw-section" aria-labelledby="fund-calendar-title">
            <h2 className="kw-section__heading" id="fund-calendar-title">
              年度回報
            </h2>
            {calendarYears.length > 0 && (
              <div className="kw-advanced">
                <CalendarColumns
                  label="曆年累積回報（各年獨立）"
                  rows={[...calendarYears].reverse().map((year) => ({
                    label: year,
                    value: fundClass.calendarYearReturns?.[year],
                  }))}
                />
              </div>
            )}
            {calendarYears.length === 0 ? (
              <p className="kw-status">官方未提供年度回報。</p>
            ) : (
              <div
                className="kw-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="年度回報表，可左右捲動查看所有欄位"
              >
                <table
                  className="kw-table kw-table--compact"
                  aria-label="年度回報"
                >
                  <thead>
                    <tr>
                      <th scope="col">年度</th>
                      <th scope="col">曆年回報</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarYears.map((year) => (
                      <tr key={year}>
                        <th scope="row">{year}</th>
                        <td className="kw-return">
                          {formatNumber(
                            fundClass.calendarYearReturns?.[year],
                            2,
                            "%",
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="kw-muted" role="note">
              年度回報是該個曆年的累積回報，不是年率化回報，不可與上表的年率化數字直接比較。官方沒有公布的年度不會顯示。
            </p>
          </section>
          <section
            className="kw-section"
            aria-labelledby="fund-fact-sheet-title"
          >
            <h2 className="kw-section__heading" id="fund-fact-sheet-title">
              投資組合披露
            </h2>
            <div className="kw-detail-stack">
              {factSheetDisclosure ? (
                <>
                  <p>
                    資料來自
                    {factSheetDisclosure.factSheetSource === "trustee"
                      ? "受託人官網刊發的計劃便覽"
                      : "積金局便覽庫存放的計劃便覽副本"}
                    ；便覽列示日期為 {factSheetDisclosure.factSheetAsOf}
                    ；本頁其他數據來自積金局基金平台，截至 {provenance.dataAsOf}
                    。
                  </p>
                  {factSheetDisclosure.factSheetSource === "mpfa-registry" && (
                    <p className="kw-muted" role="note">
                      {factSheetDisclosure.trusteeFallback
                        ? "受託人官網那一期未能讀取，這裡用的是積金局便覽庫的副本，期別可能比受託人官網的舊。"
                        : "本網站尚未收錄這個計劃在受託人官網的便覽，這裡用的是積金局便覽庫的副本，期別可能比受託人官網的舊。"}
                    </p>
                  )}
                  {factSheetDisclosure.factSheetUrl && (
                    <p>
                      <a
                        href={factSheetDisclosure.factSheetUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        查閱這份計劃便覽原文
                      </a>
                    </p>
                  )}
                  {factSheetDatesDiffer && (
                    <p className="kw-muted" role="note">
                      便覽列示日期為 {factSheetDisclosure.factSheetAsOf}，
                      平台快照日期為 {provenance.dataAsOf}
                      ；單憑文件日期未能確認每項披露是否反映同一期別。
                    </p>
                  )}
                  {allocationAsOf && (
                    <p className="kw-muted" role="note">
                      資產配置截至 {allocationAsOf}。
                    </p>
                  )}
                  {factSheetDisclosure.allocations.map((dimension) => (
                    <AllocationChart
                      key={"chart-" + dimension.heading}
                      heading={dimension.heading}
                      entries={dimension.entries}
                      sourceUrl={factSheetDisclosure.factSheetUrl}
                    />
                  ))}
                  {factSheetDisclosure.allocations
                    .filter((dimension) =>
                      isUsableAllocation(dimension.entries),
                    )
                    .map((dimension) => (
                      <div
                        className="kw-table-scroll"
                        key={dimension.heading}
                        tabIndex={0}
                        role="region"
                        aria-label={`${dimension.heading}，可左右捲動查看所有欄位`}
                      >
                        <table
                          className="kw-table kw-table--compact"
                          aria-label={dimension.heading}
                        >
                          <caption>{dimension.heading}</caption>
                          <thead>
                            <tr>
                              <th scope="col">項目</th>
                              <th scope="col">比重</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dimension.entries.map((entry) => (
                              <tr key={entry.label}>
                                <th scope="row">{entry.label}</th>
                                <td className="kw-return">{entry.percent}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  {unavailableNote("allocation", factSheetDisclosure) && (
                    <p className="kw-muted" role="note">
                      資產配置：
                      {unavailableNote("allocation", factSheetDisclosure)}
                    </p>
                  )}
                  {factSheetDisclosure.topHoldings.length > 0 && (
                    <ValueBars
                      label={
                        "十大持倉比重" +
                        (topHoldingsAsOf
                          ? " · 截至 " + topHoldingsAsOf
                          : " · 欄位日期未明示")
                      }
                      rows={factSheetDisclosure.topHoldings.map((holding) => ({
                        label: holding.security,
                        value: holding.percent,
                      }))}
                    />
                  )}
                  {factSheetDisclosure.topHoldings.length > 0 && (
                    <p className="kw-table-hint">
                      左右滑動可查看持倉名稱及比重
                    </p>
                  )}
                  {factSheetDisclosure.topHoldings.length > 0 && (
                    <div
                      className="kw-table-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label="十大持倉表，可左右捲動查看所有欄位"
                    >
                      <table className="kw-table" aria-label="十大持倉">
                        <caption>
                          十大持倉
                          {topHoldingsAsOf ? `（截至 ${topHoldingsAsOf}）` : ""}
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">排名</th>
                            <th scope="col">證券</th>
                            <th scope="col">比重</th>
                          </tr>
                        </thead>
                        <tbody>
                          {factSheetDisclosure.topHoldings.map((holding) => (
                            <tr key={`${holding.rank}-${holding.security}`}>
                              <th scope="row">{holding.rank}</th>
                              <td>{holding.security}</td>
                              <td className="kw-return">
                                {typeof holding.percent === "number"
                                  ? `${holding.percent}%`
                                  : unavailable}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {unavailableNote("topHoldings", factSheetDisclosure) && (
                    <p className="kw-muted" role="note">
                      十大持倉：
                      {unavailableNote("topHoldings", factSheetDisclosure)}
                    </p>
                  )}
                  <p className="kw-muted">
                    維度標題、項目名稱及證券名稱一律照便覽原文，比重的小數位數沿用披露本身。
                  </p>
                </>
              ) : (
                <p className="kw-muted" role="note">
                  官方未提供：這隻基金未有可對應的計劃便覽披露。
                </p>
              )}
            </div>
          </section>
          <section className="kw-section" aria-labelledby="fund-source-title">
            <h2 className="kw-section__heading" id="fund-source-title">
              資料來源及驗證
            </h2>
            <div className="kw-card provenance">
              <p>資料截至：{provenance.dataAsOf}</p>
              <p>擷取版本：{provenance.retrievedAt}</p>
              <p>驗證狀態：已驗證</p>
              {freshness && (
                <>
                  <p
                    className={
                      freshness.status === "stale"
                        ? "kw-status kw-status--warning"
                        : "kw-status kw-status--positive"
                    }
                  >
                    {freshness.status === "stale"
                      ? "回報資料過期"
                      : "回報資料現行"}
                  </p>
                  <p>
                    {freshness.status === "stale"
                      ? `回報資料已超出網站時效門檻（${freshness.graceDays} 日），截至日期仍為 ${freshness.dataAsOf}。數值繼續顯示以供參考，但不會參與排名。`
                      : `回報資料在網站時效門檻（${freshness.graceDays} 日）之內。`}
                  </p>
                </>
              )}
              <p>
                公開快照：<code>{snapshotId}</code>
              </p>
              <a href={provenance.sourceUrl} rel="noreferrer" target="_blank">
                積金局原始資料
              </a>
              <p className="disclaimer">
                資料比較不代表投資建議；過往表現不代表未來結果。請查閱受託人最新文件。
              </p>
            </div>
          </section>
          <section className="kw-section" aria-labelledby="fund-peers-title">
            <h2 className="kw-section__heading" id="fund-peers-title">
              同組比較
            </h2>
            <div className="kw-card">
              {publication.comparisonGroupFamily === null ? (
                <p>
                  積金局平台沒有為這隻基金提供基金類型（平台原文：
                  {fundClass.fundType || "未提供"}
                  ），所以不參與任何同組排名或組別平均。
                </p>
              ) : (
                <p>
                  這隻基金的積金局基金類型是 <strong>{comparisonGroup}</strong>
                  。排名只在同一基金類型內進行，不會與其他類型混合。
                </p>
              )}
              <p className="kw-muted">
                {`分類來自${publication.classification?.provider ?? "積金局強積金基金平台"}（官方，擷取 ${publication.classification?.capturedAt ?? "日期未記錄"}）；平台英文原文為 ${fundClass.fundType}。`}
                {fundClass.fundCategory?.trim()
                  ? `受託人自述的基金描述「${fundClass.fundCategory.trim()}」只作參考，不用作分組。`
                  : null}
              </p>
              {publication.comparisonGroupFamily !== null && (
                <p className="kw-home-actions">
                  <a
                    className="kw-button"
                    href={`/rankings?period=1&group=${encodeURIComponent(comparisonGroup)}`}
                  >
                    查看同組基金排名
                  </a>
                </p>
              )}
            </div>
            {publication.comparisonGroupFamily !== null && (
              <PeerPosition
                apiBaseUrl={apiBaseUrl}
                fundClassId={fundClassId}
                comparisonGroup={comparisonGroup}
                snapshotId={snapshotId}
              />
            )}
          </section>
          <section className="kw-section" aria-labelledby="fund-fees-title">
            <h2 className="kw-section__heading" id="fund-fees-title">
              費用及資料限制
            </h2>
            <div className="kw-detail-stack provenance">
              <dl className="status-list">
                <div>
                  <dt>基金開支比率（歷史財政期）</dt>
                  <dd>{formatNumber(fundClass.latestFer, 5, "%")}</dd>
                </div>
              </dl>
              <div
                className="kw-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="基金經常性費用表，可左右捲動查看所有欄位"
              >
                <table
                  className="kw-table kw-table--compact"
                  aria-label="經常性費用"
                >
                  <caption>經常性費用（每年）</caption>
                  <thead>
                    <tr>
                      <th scope="col">項目</th>
                      <th scope="col">披露費率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringFeeRows.map(([label, field]) => (
                      <tr key={field}>
                        <th scope="row">{label}</th>
                        <td className="kw-return">{feeRate(field)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="kw-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="一次性及交易收費表，可左右捲動查看所有欄位"
              >
                <table
                  className="kw-table kw-table--compact"
                  aria-label="一次性及交易收費"
                >
                  <caption>一次性及交易收費</caption>
                  <thead>
                    <tr>
                      <th scope="col">項目</th>
                      <th scope="col">披露收費</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oneOffChargeRows.map(([label, field]) => (
                      <tr key={field}>
                        <th scope="row">{label}</th>
                        <td className="kw-return">{feeRate(field)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="kw-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="持續成本說明表，可左右捲動查看所有欄位"
              >
                <table
                  className="kw-table kw-table--compact"
                  aria-label="持續成本說明"
                >
                  <caption>持續成本說明（OCI）</caption>
                  <thead>
                    <tr>
                      <th scope="col">期間</th>
                      <th scope="col">每 HK$1,000 投資的成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ociRows.map(([label, field]) => (
                      <tr key={field}>
                        <th scope="row">{label}</th>
                        <td className="kw-return">{feeAmount(field)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {feeCaps.length > 0 && (
                <p className="kw-muted" role="note">
                  標示「上限」的項目，官方原文寫的是 <code>Up to</code>
                  ，即披露的是收費上限而非實際費率；實際扣費可能較低。
                </p>
              )}
              {feeDisclosureRows.length > 0 && (
                <div>
                  <p className="kw-muted">
                    以下項目不是單一費率，官方以文字披露，原文照錄：
                  </p>
                  <dl className="status-list fee-disclosures">
                    {feeDisclosureRows.map(([field, text]) => (
                      <div key={field}>
                        <dt>{feeLabels[field] ?? field}</dt>
                        <dd>{text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <p>配置及持倉資料的截至日期可能不同，使用時請留意可比性限制。</p>
              <p role="note">
                「未取得」代表本快照沒有可用數值，不足以判定官方沒有披露。只有來源明示缺項時才列出「官方未提供」及原因；網站不會以估算值補足。
              </p>
            </div>
          </section>
        </div>
      )}
    </SiteChrome>
  );
}
