import { describe, expect, it } from "vitest";
import {
  classificationOf,
  comparisonGroupFor,
  comparisonGroupSourceOf,
  UNCLASSIFIED_GROUP,
} from "../src/comparison-group";

describe("comparison group", () => {
  it("uses the official MPFA Chinese fund type and its family", () => {
    expect(
      comparisonGroupFor({ fundType: "Equity Fund - Hong Kong Equity Fund" }),
    ).toEqual({
      name: "股票基金 - 香港股票基金",
      source: "mpfa",
      family: "股票基金",
    });
    expect(
      comparisonGroupFor({
        fundType: "Money Market Fund - MPF Conservative Fund",
      }),
    ).toEqual({
      name: "貨幣市場基金 — 強積金保守基金",
      source: "mpfa",
      family: "貨幣市場基金 — 強積金保守基金",
    });
  });

  it("does not guess a type that is missing or not on the MPFA list", () => {
    for (const fundType of [
      undefined,
      "Equity Fund (North America)",
      "Equity Fund - Hong Kong",
    ]) {
      expect(comparisonGroupFor({ fundType })).toEqual({
        name: UNCLASSIFIED_GROUP,
        source: "mpfa",
        family: null,
      });
    }
  });

  it("reports MPFA as the only, official classification source", () => {
    expect(comparisonGroupSourceOf("股票基金 - 香港股票基金")).toBe("mpfa");
    expect(classificationOf()).toMatchObject({
      provider: "積金局強積金基金平台",
      official: true,
    });
  });
});
