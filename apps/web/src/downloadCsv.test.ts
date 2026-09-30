import { describe, it, expect } from "vitest";
import { csvText } from "./downloadCsv";
describe("raw ranking CSV", () => {
  it("retains numeric precision, negative returns and real zero", () => {
    expect(csvText([[1.205, -2.63, 0, null]])).toBe(
      '\uFEFF"1.205","-2.63","0","官方未提供"',
    );
  });
  it("quotes source names and neutralizes formula-like strings", () => {
    expect(
      csvText([['Fund "A", Class I', '=HYPERLINK("x")', " @SUM(1)"]]),
    ).toBe('\uFEFF"Fund ""A"", Class I","\'=HYPERLINK(""x"")","\' @SUM(1)"');
  });
});
