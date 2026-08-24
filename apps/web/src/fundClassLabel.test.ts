import { describe, expect, it } from "vitest";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

describe("fundClassLabel", () => {
  it("keeps a real class name", () => {
    expect(fundClassLabel("Class A")).toBe("Class A");
    expect(fundClassLabel("Unit Class H")).toBe("Unit Class H");
  });

  it("drops the official placeholder for funds without a separate class", () => {
    expect(fundClassLabel("n.a.")).toBeNull();
    expect(fundClassLabel("N.A.")).toBeNull();
    expect(fundClassLabel("n/a")).toBeNull();
    expect(fundClassLabel("")).toBeNull();
    expect(fundClassLabel(undefined)).toBeNull();
  });

  it("does not drop a class name that merely contains the placeholder text", () => {
    expect(fundClassLabel("Class N.A. Plus")).toBe("Class N.A. Plus");
  });
});

describe("joinFundParts", () => {
  it("joins the parts in the order given", () => {
    expect(joinFundParts("港股基金", "Class A")).toBe("港股基金 · Class A");
    expect(joinFundParts("Class A", "Scheme X")).toBe("Class A · Scheme X");
  });

  it("omits the separator when a part is dropped", () => {
    expect(joinFundParts("港股基金", fundClassLabel("n.a."))).toBe("港股基金");
    expect(joinFundParts(fundClassLabel("n.a."), "Scheme X")).toBe("Scheme X");
  });

  it("skips empty and whitespace-only parts", () => {
    expect(joinFundParts("Class A", "", "  ", undefined, "Scheme X")).toBe(
      "Class A · Scheme X",
    );
    expect(joinFundParts(null, undefined)).toBe("");
  });
});
