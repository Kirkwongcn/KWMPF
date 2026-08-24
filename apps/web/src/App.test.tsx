import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("health page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the release and service state returned by the public API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "ok",
            version: "test-release",
            bindings: { d1: true, r2: true },
          }),
          { status: 200 },
        ),
      ),
    );

    render(<App apiUrl="https://api.test/health" />);

    expect(
      screen.getByRole("heading", { name: "用可追溯資料，讀懂強積金選擇" }),
    ).toBeVisible();
    expect(await screen.findByText("test-release")).toBeVisible();
    expect(await screen.findByText("API：正常")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith("https://api.test/health");
  });

  it("shows the published coverage and data principles from the live summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("/summary")
            ? Response.json({
                snapshotId: "snapshot-2026-06-30",
                fundClassCount: 451,
                schemeCount: 27,
                trusteeCount: 12,
                dataAsOf: { earliest: "2026-03-31", latest: "2026-06-30" },
              })
            : Response.json({
                status: "ok",
                version: "test-release",
                bindings: { d1: true, r2: true },
              }),
        ),
      ),
    );

    render(<App apiUrl="https://api.test/health" />);

    expect(await screen.findByText("451")).toBeVisible();
    expect(screen.getByText("已核實基金類別")).toBeVisible();
    expect(screen.getByText("27")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("2026-03-31 至 2026-06-30")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith("https://api.test/summary");
  });

  it("does not invent coverage numbers when nothing is published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("/summary")
            ? Response.json({
                snapshotId: null,
                fundClassCount: 0,
                schemeCount: 0,
                trusteeCount: 0,
                dataAsOf: null,
              })
            : Response.json({
                status: "ok",
                version: "test-release",
                bindings: { d1: true, r2: true },
              }),
        ),
      ),
    );

    render(<App apiUrl="https://api.test/health" />);

    expect(await screen.findByText("尚未有已發布快照")).toBeVisible();
  });

  it("does not claim the API is healthy when the health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App apiUrl="https://api.test/health" />);

    expect(await screen.findByText("API：無法連線")).toBeVisible();
    expect(screen.getByText("未能取得")).toBeVisible();
  });
});
