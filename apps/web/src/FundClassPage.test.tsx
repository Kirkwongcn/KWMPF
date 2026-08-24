import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../fixtures/mpfa/cf-429.json";
import { FundClassPage } from "./FundClassPage";

describe("fund class page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the fund identity and publication provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            rawSha256: "a".repeat(64),
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Principal Hong Kong Equity Fund",
      }),
    ).toBeVisible();
    expect(screen.getByText("資料截至：2026-06-30")).toBeVisible();
    expect(screen.getByText("擷取版本：2026-08-11T00:00:00Z")).toBeVisible();
    expect(screen.getByText("驗證狀態：已驗證")).toBeVisible();
    expect(screen.getByText("基金開支比率（歷史財政期）")).toBeVisible();
    expect(screen.getByText("當前管理費")).toBeVisible();
    expect(screen.getByText("其他費用（OCI）")).toBeVisible();
    expect(screen.getByText(/資料比較不代表投資建議/)).toBeVisible();
    expect(screen.getByText(/配置及持倉資料的截至日期可能不同/)).toBeVisible();
    expect(screen.getByText("snapshot-mpfa-cf-429-2026-06-30")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "積金局原始資料" }),
    ).toHaveAttribute("href", fixture.source.url);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/fund-classes/mpfa-cf-429-class-i",
    );
  });

  it("keeps site navigation and the sitewide disclaimer available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Principal Hong Kong Equity Fund",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "主要導覽" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "計劃比較" })).toHaveAttribute(
      "href",
      "/schemes",
    );
    expect(
      screen.getByText(/本網站只提供資料比較及投資教育，不構成投資建議/),
    ).toBeVisible();
  });

  it("shows the official five and ten year returns alongside the one year figure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: {
            ...fixture.fundClass,
            annualizedReturn1y: 4.2,
            annualizedReturn5y: 6.14,
            annualizedReturn10y: 5.37,
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(await screen.findByText("一年年率化回報")).toBeVisible();
    expect(screen.getByText("4.20%")).toBeVisible();
    expect(screen.getByText("五年年率化回報")).toBeVisible();
    expect(screen.getByText("6.14%")).toBeVisible();
    expect(screen.getByText("十年年率化回報")).toBeVisible();
    expect(screen.getByText("5.37%")).toBeVisible();
  });

  it("marks long horizon returns the official source never published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: { ...fixture.fundClass, annualizedReturn1y: 4.2 },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(await screen.findByText("五年年率化回報")).toBeVisible();
    expect(screen.getByText("十年年率化回報")).toBeVisible();
    expect(screen.getAllByText("官方未提供").length).toBeGreaterThanOrEqual(2);
  });

  it("shows official unavailability instead of crashing on absent fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-missing-fields",
          fundClass: {
            ...fixture.fundClass,
            riskClass: undefined,
            latestFer: undefined,
            oci1yHkd: undefined,
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-13T00:00:00Z",
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="missing-fields"
      />,
    );

    expect(await screen.findAllByText("官方未提供")).toHaveLength(6);
    expect(screen.getByText(/適用披露規則/)).toBeVisible();
  });
  it("links to the fund's own comparison group ranking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    const link = await screen.findByRole("link", { name: /同組基金排名/ });
    expect(link).toHaveAttribute(
      "href",
      `/rankings?period=1&group=${encodeURIComponent(fixture.fundClass.fundCategory)}`,
    );
  });
});
