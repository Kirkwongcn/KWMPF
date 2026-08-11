import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787/health";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <App apiUrl={apiUrl} />
  </StrictMode>,
);
