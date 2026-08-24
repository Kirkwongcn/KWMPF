import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SchemesPage } from "./SchemesPage";

describe("scheme comparison page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps site navigation and the sitewide disclaimer available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Scheme One",
            trusteeName: "Trustee One",
            fundClassCount: 2,
            fundTypes: ["Equity Fund"],
            riskClassDistribution: { "5": 2 },
            fundClassIds: ["fund-a", "fund-b"],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(
      await screen.findByRole("heading", { name: "Scheme One" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "主要導覽" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "基金排名" })).toHaveAttribute(
      "href",
      "/rankings",
    );
    expect(screen.getByRole("link", { name: "KWMPF 首頁" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByText(/本網站只提供資料比較及投資教育，不構成投資建議/),
    ).toBeVisible();
  });
});
