import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FundClassPage } from "./FundClassPage";
import { FundsPage } from "./FundsPage";
import { RankingsPage } from "./RankingsPage";
import { SchemesPage } from "./SchemesPage";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

const fundClassMatch = window.location.pathname.match(
  /^\/fund-classes\/([^/]+)$/,
);
const fundClassId = fundClassMatch?.[1];
const isSchemesPage = window.location.pathname === "/schemes";
const isRankingsPage = window.location.pathname === "/rankings";
const isFundsPage = window.location.pathname === "/funds";
const params = new URLSearchParams(window.location.search);
const requestedPeriod = params.get("period");
const initialPeriod =
  requestedPeriod === "5" || requestedPeriod === "10" ? requestedPeriod : "1";
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
    ) : isFundsPage ? (
      <FundsPage
        apiBaseUrl={apiBaseUrl}
        initialFundType={params.get("fundType") ?? "all"}
        initialTrustee={params.get("trustee") ?? "all"}
        initialRiskClass={params.get("riskClass") ?? "all"}
        initialQuery={params.get("q") ?? ""}
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
    ) : (
      <App apiUrl={`${apiBaseUrl}/health`} />
    )}
  </StrictMode>,
);
