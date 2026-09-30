import { useEffect, useState } from "react";
export type ViewMode = "simple" | "analysis";
function readMode(): ViewMode {
  const query = new URLSearchParams(window.location.search).get("view");
  if (query === "analysis" || query === "simple") return query;
  try {
    return localStorage.getItem("kwmpf-view") === "analysis"
      ? "analysis"
      : "simple";
  } catch {
    return "simple";
  }
}
export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(readMode);
  useEffect(() => {
    const sync = () => setMode(readMode());
    window.addEventListener("popstate", sync);
    window.addEventListener("kwmpf-view", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("kwmpf-view", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function change(next: ViewMode) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    try {
      localStorage.setItem("kwmpf-view", next);
    } catch {
      /* The URL still persists the choice. */
    }
    window.dispatchEvent(new Event("kwmpf-view"));
  }
  return [mode, change] as const;
}
