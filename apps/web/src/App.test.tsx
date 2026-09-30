import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
const summary = {
  snapshotId: "published-1",
  fundClassCount: 451,
  schemeCount: 24,
  trusteeCount: 11,
  dataAsOf: { earliest: "2026-08-31", latest: "2026-08-31" },
};
const quality = {
  snapshotId: "published-1",
  fundClassCount: 451,
  evaluatedOn: "2026-09-30",
  returns: [1, 3, 5, 10].map((periodYears) => ({
    periodYears,
    eligible: 37,
    stale: 212,
    missing: 202,
    unverified: 0,
  })),
};
function stub(nextQuality = quality) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        Response.json(
          String(input).endsWith("/summary") ? summary : nextQuality,
        ),
      ),
    ),
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});
describe("home data workbench", () => {
  it("shows the real published coverage and distinguishes stale from missing", async () => {
    stub();
    render(<App apiUrl="https://api.test/health" />);
    expect(await screen.findByText("451")).toBeVisible();
    expect(screen.getByText("2026-08-31")).toBeVisible();
    expect(screen.getAllByText("37 可排名")).toHaveLength(4);
    expect(screen.getAllByText("212 過期 · 202 未取得")).toHaveLength(4);
  });
  it("submits the search to the paginated fund browser", () => {
    stub();
    render(<App apiUrl="https://api.test/health" />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "滙豐" },
    });
    expect(screen.getByRole("searchbox")).toHaveValue("滙豐");
    expect(screen.getByRole("searchbox").closest("form")).toHaveAttribute(
      "action",
      "/funds",
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });
  it("does not combine data from different published snapshots", async () => {
    stub({ ...quality, snapshotId: "published-2" });
    render(<App apiUrl="https://api.test/health" />);
    expect(await screen.findByText(/未能載入資料覆蓋/)).toBeVisible();
    expect(screen.queryByText("451")).not.toBeInTheDocument();
  });
  it("reports service errors without inventing data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    render(<App apiUrl="https://api.test/health" />);
    expect(await screen.findByText("資料範圍暫時無法取得")).toBeVisible();
    expect(screen.queryByText("451")).not.toBeInTheDocument();
  });
  it("keeps useful actions available while the data is loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<App apiUrl="https://api.test/health" />);
    expect(screen.getByText("正在讀取回報資料覆蓋…")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "按同類組別比較" }),
    ).toHaveAttribute("href", "/rankings");
  });
  it("persists a shareable analysis mode without losing query state", () => {
    window.history.replaceState({}, "", "/?q=HSBC");
    stub();
    render(<App apiUrl="https://api.test/health" />);
    fireEvent.click(screen.getByRole("button", { name: "深入分析" }));
    expect(screen.getByRole("button", { name: "深入分析" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(new URLSearchParams(window.location.search).get("view")).toBe(
      "analysis",
    );
    expect(new URLSearchParams(window.location.search).get("q")).toBe("HSBC");
    expect(localStorage.getItem("kwmpf-view")).toBe("analysis");
  });
});
