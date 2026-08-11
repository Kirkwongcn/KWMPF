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
});
