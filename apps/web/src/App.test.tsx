import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function stubSearch(searchResponse: () => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/search")) return searchResponse();
    if (url.endsWith("/summary"))
      return Promise.resolve(
        Response.json({
          snapshotId: "snapshot-2026-06-30",
          fundClassCount: 451,
          schemeCount: 27,
          trusteeCount: 12,
          dataAsOf: { earliest: "2026-03-31", latest: "2026-06-30" },
        }),
      );
    return Promise.resolve(
      Response.json({
        status: "ok",
        version: "test-release",
        bindings: { d1: true, r2: true },
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function submitSearch(term: string) {
  fireEvent.change(await screen.findByLabelText("搜尋基金、計劃或受託人"), {
    target: { value: term },
  });
  fireEvent.click(screen.getByRole("button", { name: "搜尋" }));
}

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

  it("says so when a search matches nothing instead of doing nothing", async () => {
    stubSearch(() => Promise.resolve(Response.json([])));

    render(<App apiUrl="https://api.test/health" />);
    await submitSearch("不存在的基金");

    expect(
      await screen.findByText(/沒有符合「不存在的基金」的已發布基金/),
    ).toBeVisible();
  });

  it("distinguishes a failed search from an empty result", async () => {
    stubSearch(() => Promise.reject(new Error("offline")));

    render(<App apiUrl="https://api.test/health" />);
    await submitSearch("Principal");

    expect(await screen.findByText(/暫時無法搜尋已發布資料/)).toBeVisible();
    expect(screen.queryByText(/沒有符合/)).not.toBeInTheDocument();
  });

  it("tells the reader when a search returns more matches than it shows", async () => {
    stubSearch(() =>
      Promise.resolve(
        Response.json(
          [
            {
              id: "fund-a",
              fundClassName: "Class A",
              constituentFundName: "港股基金",
              schemeName: "計劃甲",
              trusteeName: "受託人甲",
            },
          ],
          { headers: { "X-Total-Matches": "88" } },
        ),
      ),
    );

    render(<App apiUrl="https://api.test/health" />);
    await submitSearch("基金");

    expect(await screen.findByText(/共 88 項符合/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /按條件瀏覽全部結果/ }),
    ).toHaveAttribute("href", "/funds?q=%E5%9F%BA%E9%87%91");
  });

  it("does not claim the API is healthy when the health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App apiUrl="https://api.test/health" />);

    expect(await screen.findByText("API：無法連線")).toBeVisible();
    expect(screen.getByText("未能取得")).toBeVisible();
  });
});
