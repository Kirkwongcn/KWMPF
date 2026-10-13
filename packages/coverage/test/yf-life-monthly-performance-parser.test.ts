import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseYfLifeMonthlyPerformance } from "../src/yf-life-monthly-performance-parser";

// 2026-08-31 一期實際 `pdftotext -bbox` 輸出，只留表格高度（y 340–520）嘅詞，包括左邊圖例。
const fixture = readFileSync(new URL("./fixtures/yf-life-mass-monthly-2026-08.bbox.html", import.meta.url), "utf8");

function replaceWord(xml: string, text: string, replacement: string) {
  const pattern = `>${text}</word>`;
  if (!xml.includes(pattern)) throw new Error(`fixture has no word ${text}`);
  return xml.replace(pattern, `>${replacement}</word>`);
}

describe("YF Life MASS monthly fund performance (ADR 0014)", () => {
  it("reads every fund's three-year % growth from the table, not the chart legend", () => {
    const performance = parseYfLifeMonthlyPerformance(fixture);
    expect(performance.dataAsOf).toBe("2026-08-31");
    expect(performance.rows).toHaveLength(14);
    expect(performance.rows[0]).toEqual({
      englishName: "Hong Kong Equities Fund",
      oneYear: 3.85,
      threeYears: 43.1,
      printedThreeYears: "43.10",
    });
    // 「Asian Bond Fund #」：名後註腳唔屬基金名；原文兩位小數照錄。
    expect(performance.rows.find((row) => row.englishName === "Asian Bond Fund")).toMatchObject({ printedThreeYears: "12.74" });
    expect(performance.rows.at(-1)).toMatchObject({ englishName: "Age 65 Plus Fund", oneYear: 4.81, threeYears: 18.56 });
  });

  it("keeps an official N/A apart from zero", () => {
    const row = parseYfLifeMonthlyPerformance(replaceWord(fixture, "48.20", "N/A")).rows.find(
      (item) => item.englishName === "Core Accumulation Fund",
    );
    expect(row).toMatchObject({ threeYears: null, printedThreeYears: "N/A" });
  });

  it("drops other footnote markers after a name", () => {
    const starred = fixture.replace(/>#</u, ">*<");
    expect(starred).not.toBe(fixture);
    expect(parseYfLifeMonthlyPerformance(starred).rows.map((row) => row.englishName)).toContain("Asian Bond Fund");
  });

  it("rejects the whole document when a cell or a header date does not fit", () => {
    expect(() => parseYfLifeMonthlyPerformance(replaceWord(fixture, "69.02", "69.0"))).toThrow(/unexpected cells/u);
    // 表頭第二行（y≈379）其中一個截至日期改咗。
    const mixed = fixture.replace(/(yMin="379\.[^"]*"[^>]*>)08\/31\/2026</u, "$107/31/2026<");
    expect(mixed).not.toBe(fixture);
    expect(() => parseYfLifeMonthlyPerformance(mixed)).toThrow(/mixes dates/u);
    expect(() => parseYfLifeMonthlyPerformance(fixture.replace(/>Constituent</gu, ">Fund<"))).toThrow(/one table header/u);
  });
});
