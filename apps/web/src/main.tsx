import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FundClassPage } from "./FundClassPage";
import { FundsPage } from "./FundsPage";
import { RankingsPage } from "./RankingsPage";
import { SchemeComparePage } from "./SchemeComparePage";
import { SchemesPage } from "./SchemesPage";
import { FundComparePage } from "./FundComparePage";
import { DataStatusPage } from "./DataStatusPage";
import { MethodologyPage } from "./MethodologyPage";
import { SiteChrome } from "./SiteChrome";
import "./styles.css";
import "./viz.css";
import "./refresh.css";
import "./atlas.css";
import "./ux.css";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

const fundClassMatch = window.location.pathname.match(
  /^\/fund-classes\/([^/]+)$/,
);
const fundClassId = fundClassMatch?.[1];
const isSchemeComparePage = window.location.pathname === "/schemes/compare";
const isSchemesPage = window.location.pathname === "/schemes";
const isRankingsPage = window.location.pathname === "/rankings";
const isFundsPage = window.location.pathname === "/funds";
const params = new URLSearchParams(window.location.search);
const requestedPeriod = params.get("period");
const initialPeriod =
  requestedPeriod === "3" || requestedPeriod === "5" || requestedPeriod === "10"
    ? requestedPeriod
    : "1";
const initialComparisonGroup = params.get("group") ?? "all";
const requestedMetric = params.get("metric");
const initialMetric =
  requestedMetric === "fee" || requestedMetric === "risk"
    ? requestedMetric
    : "return";

createRoot(root).render(
  <StrictMode>
    {fundClassId ? (
      <FundClassPage apiBaseUrl={apiBaseUrl} fundClassId={fundClassId} />
    ) : window.location.pathname === "/funds/compare" ? (
      <FundComparePage apiBaseUrl={apiBaseUrl} />
    ) : window.location.pathname === "/data-status" ? (
      <DataStatusPage apiBaseUrl={apiBaseUrl} />
    ) : window.location.pathname === "/methodology" ? (
      <MethodologyPage />
    ) : isFundsPage ? (
      <FundsPage
        apiBaseUrl={apiBaseUrl}
        initialCategory={params.get("category") ?? "all"}
        initialFundType={params.get("fundType") ?? "all"}
        initialTrustee={params.get("trustee") ?? "all"}
        initialRiskClass={params.get("riskClass") ?? "all"}
        initialQuery={params.get("q") ?? ""}
      />
    ) : isSchemeComparePage ? (
      <SchemeComparePage
        apiBaseUrl={apiBaseUrl}
        search={window.location.search}
      />
    ) : isSchemesPage ? (
      <SchemesPage apiBaseUrl={apiBaseUrl} />
    ) : isRankingsPage ? (
      <RankingsPage
        apiBaseUrl={apiBaseUrl}
        initialPeriod={initialPeriod}
        initialComparisonGroup={initialComparisonGroup}
        initialMetric={initialMetric}
      />
    ) : window.location.pathname === "/" ? (
      <App apiUrl={`${apiBaseUrl}/health`} />
    ) : (
      <SiteChrome title="找不到這個頁面">
        <p>
          請使用導覽尋找基金，或<a href="/">返回首頁</a>。
        </p>
      </SiteChrome>
    )}
  </StrictMode>,
);
