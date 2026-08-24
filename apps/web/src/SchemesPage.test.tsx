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
            funds: [
              {
                id: "fund-a",
                constituentFundName: "Growth Fund",
                fundClassName: "Class A",
                fundType: "Equity Fund",
                riskClass: 5,
              },
              {
                id: "fund-b",
                constituentFundName: "Stable Fund",
                fundClassName: "Class B",
                fundType: "Bond Fund",
              },
            ],
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

  it("lists funds by official name and links to each fund class page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Scheme One",
            trusteeName: "Trustee One",
            fundClassCount: 2,
            fundTypes: ["Equity Fund", "Bond Fund"],
            riskClassDistribution: { "5": 1 },
            funds: [
              {
                id: "fund-a",
                constituentFundName: "Growth Fund",
                fundClassName: "Class A",
                fundType: "Equity Fund",
                riskClass: 5,
              },
              {
                id: "fund-b",
                constituentFundName: "Stable Fund",
                fundClassName: "Class B",
                fundType: "Bond Fund",
              },
            ],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    const growth = await screen.findByRole("link", {
      name: /Growth Fund/,
    });
    expect(growth).toHaveAttribute("href", "/fund-classes/fund-a");
    expect(growth).toHaveTextContent("Class A");
    expect(screen.getByText("風險級別 5")).toBeVisible();
    expect(screen.getByText("風險級別官方未提供")).toBeVisible();
    expect(screen.queryByText("fund-a")).not.toBeInTheDocument();
  });
  it("titles the browser tab with the scheme comparison page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(document.title).toBe("強積金計劃比較｜KWMPF");
  });
});
