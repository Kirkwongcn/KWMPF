import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FundClassPage } from "./FundClassPage";
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

createRoot(root).render(
  <StrictMode>
    {fundClassId ? (
      <FundClassPage apiBaseUrl={apiBaseUrl} fundClassId={fundClassId} />
    ) : (
      <App apiUrl={`${apiBaseUrl}/health`} />
    )}
  </StrictMode>,
);
