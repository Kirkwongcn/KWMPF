import { describe, expect, it } from "vitest";
import {
  chartLabels,
  readChartAllocation,
  type ChartReadSpec,
  type OcrBox,
  type OcrOutput,
} from "../src/fact-sheet-chart-read";

const box = (text: string, left: number, top: number, width = 200, height = 20): OcrBox => ({
  text,
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const spec: ChartReadSpec = {
  region: { minLeft: 0, maxLeft: 900, top: 0, bottom: 300 },
  valuesLeft: 600,
  sumTolerance: 0.5,
  vocabulary: chartLabels([
    ["金融", "Financials"],
    ["消費", "Consumer"],
    ["非必需消費品", "Consumer Discretionary"],
    ["非必需性消費", "Consumer Discretionary"],
    ["香港股票", "Hong Kong Equities"],
    ["香港股票", "Hong Kong equities"],
    ["原材料", "Materials"],
    ["原材料", "Basic Materials"],
    ["貨幣市場工具 (港元)", "Money Market Instruments (HKD)"],
    ["現金及其他", "Cash and Others"],
  ]),
};

/** RapidOCR 讀到嘅：中英黐埋、冇空格，數值另一個框。 */
const rapid = (rows: [string, string][]) =>
  rows.flatMap(([label, value], index) => [
    box(label, 50, index * 40),
    ...(value ? [box(value, 650, index * 40, 60)] : []),
  ]);

/** Tesseract 讀到嘅：中文可能讀成雜碼，英文有空格；數值由數值欄另讀。 */
const tesseract = (rows: [string, string][]) =>
  rows.flatMap(([label, value], index) => [
    { words: [box(label, 50, index * 40 + 2)] },
    ...(value ? [{ words: [box(value, 650, index * 40 + 2, 60)] }] : []),
  ]);

const read = (r: [string, string][], t: [string, string][]) =>
  readChartAllocation({ rapidocr: rapid(r), tesseract: tesseract(t) } as OcrOutput, spec, 1);

describe("chart-read allocation", () => {
  it("accepts a legend both engines read identically and that totals 100", () => {
    const result = read(
      [
        ["金融Financials", "61.5%"],
        ["消費Consumer", "36.5%"],
        ["現金及其他CashandOthers", "2.0%"],
      ],
      [
        ["© 金 融 Financials", "61.5%"],
        ["置 SA Consumer", "36.5%"],
        ["葉 現金 及 其 他 ~ Cash and Others*", "2.0%"],
      ],
    );
    expect(result).toEqual({
      status: "ok",
      entries: [
        { label: "金融 Financials", percent: 61.5 },
        { label: "消費 Consumer", percent: 36.5 },
        { label: "現金及其他 Cash and Others", percent: 2 },
      ],
      printed: ["61.5%", "36.5%", "2.0%"],
      total: 100,
    });
  });

  it("rejects the whole chart when the engines disagree on any digit", () => {
    const result = read(
      [
        ["金融Financials", "61.5%"],
        ["消費Consumer", "4.7%"],
      ],
      [
        ["金融 Financials", "61.5%"],
        ["消費 Consumer", "47%"],
      ],
    );
    expect(result).toMatchObject({ status: "rejected", reason: expect.stringMatching(/row 2 differs/) });
  });

  it("rejects a total outside the rounding tolerance", () => {
    const rows: [string, string][] = [
      ["金融Financials", "61.5%"],
      ["消費Consumer", "30.5%"],
    ];
    expect(read(rows, rows)).toMatchObject({
      status: "rejected",
      reason: "rows total 92%, outside 100 ± 0.5",
    });
  });

  it("rejects a legend that is not in the verified vocabulary", () => {
    const rows: [string, string][] = [
      ["金融Financials", "61.5%"],
      ["地產RealEstate", "38.5%"],
    ];
    expect(read(rows, rows)).toMatchObject({
      status: "rejected",
      reason: expect.stringMatching(/RealEstate.*no vocabulary entry/),
    });
  });

  it("tells apart labels with the same English by the Chinese RapidOCR read", () => {
    const result = read(
      [
        ["非必需性消費ConsumerDiscretionary", "60.0%"],
        ["金融Financials", "40.0%"],
      ],
      [
        ["非 必 需 性 消費 Consumer Discretionary", "60.0%"],
        ["金融 Financials", "40.0%"],
      ],
    );
    expect(result).toMatchObject({
      status: "ok",
      entries: [{ label: "非必需性消費 Consumer Discretionary" }, { label: "金融 Financials" }],
    });
    // 中文讀錯就分唔到，成張拒絕。
    expect(
      read(
        [
          ["非必需消费ConsumerDiscretionary", "60.0%"],
          ["金融Financials", "40.0%"],
        ],
        [
          ["非 必 需 消費 Consumer Discretionary", "60.0%"],
          ["金融 Financials", "40.0%"],
        ],
      ),
    ).toMatchObject({ status: "rejected", reason: expect.stringMatching(/fits 0 vocabulary entries/) });
  });

  it("keeps the printed case: Equities and equities are different legends", () => {
    const result = read(
      [
        ["香港股票HongKongequities", "70.0%"],
        ["金融Financials", "30.0%"],
      ],
      [
        ["香港 股票 Hong Kong equities", "70.0%"],
        ["金融 Financials", "30.0%"],
      ],
    );
    expect(result).toMatchObject({ status: "ok", entries: [{ label: "香港股票 Hong Kong equities" }, {}] });
  });

  it("does not take a longer legend for its suffix", () => {
    const result = read(
      [
        ["原材料BasicMaterials", "70.0%"],
        ["金融Financials", "30.0%"],
      ],
      [
        ["原 材料 Basic Materials", "70.0%"],
        ["金融 Financials", "30.0%"],
      ],
    );
    expect(result).toMatchObject({ status: "ok", entries: [{ label: "原材料 Basic Materials" }, {}] });
  });

  it("joins a wrapped legend line to the row above", () => {
    const result = read(
      [
        ["貨幣市場工具（港元）", "70.0%"],
        ["MoneyMarketInstruments(HKD)", ""],
        ["金融Financials", "30.0%"],
      ],
      [
        ["貨 幣 市 場 工具 (港元 )", "70.0%"],
        ["Money Market Instruments (HKD)", ""],
        ["金融 Financials", "30.0%"],
      ],
    );
    expect(result).toMatchObject({
      status: "ok",
      entries: [{ label: "貨幣市場工具 (港元) Money Market Instruments (HKD)", percent: 70 }, {}],
    });
  });

  it("rejects a percentage with no legend and a legend repeated in one chart", () => {
    expect(
      read(
        [
          ["", "70.0%"],
          ["金融Financials", "30.0%"],
        ],
        [
          ["", "70.0%"],
          ["金融 Financials", "30.0%"],
        ],
      ),
    ).toMatchObject({ status: "rejected" });
    const twice: [string, string][] = [
      ["金融Financials", "50.0%"],
      ["金融Financials", "50.0%"],
    ];
    expect(read(twice, twice)).toMatchObject({ status: "rejected", reason: expect.stringMatching(/read twice/) });
  });

  it("checks RapidOCR's rows against the fact sheet's own text layer when told to", () => {
    const callouts: ChartReadSpec = { ...spec, secondRead: "text-layer", splitGap: 40 };
    const ocr: OcrOutput = {
      rapidocr: [box("金融Financials61.5%", 0, 0, 180), box("消費Consumer38.5%", 400, 0, 180)],
      tesseract: [],
      textLayer: [
        box("金融", 0, 0, 30),
        box("Financials 61.5%", 35, 1, 140),
        box("消費", 400, 0, 30),
        box("Consumer 38.5%", 435, 1, 140),
      ],
    };
    expect(readChartAllocation(ocr, callouts, 1)).toMatchObject({
      status: "ok",
      entries: [
        { label: "金融 Financials", percent: 61.5 },
        { label: "消費 Consumer", percent: 38.5 },
      ],
    });
    expect(readChartAllocation({ ...ocr, textLayer: undefined }, callouts, 1)).toMatchObject({
      status: "rejected",
      reason: "text layer not supplied",
    });
  });

  it("rejects a chart whose text touches the crop edge, since a row may be cut off", () => {
    const ocr = {
      rapidocr: rapid([
        ["金融Financials", "61.5%"],
        ["消費Consumer", "38.5%"],
      ]),
      tesseract: tesseract([
        ["金融 Financials", "61.5%"],
        ["消費 Consumer", "38.5%"],
      ]),
      crop: { width: 900, height: 61 },
    } as OcrOutput;
    expect(readChartAllocation(ocr, spec, 1)).toMatchObject({
      status: "rejected",
      reason: expect.stringMatching(/touches the crop edge/),
    });
    expect(readChartAllocation({ ...ocr, crop: { width: 900, height: 200 } }, spec, 1)).toMatchObject({ status: "ok" });
  });

  it("rejects a Chinese legend that differs from the list even when the English matches", () => {
    expect(
      read(
        [
          ["健康護理Financials", "61.5%"],
          ["消費Consumer", "38.5%"],
        ],
        [
          ["健康 護理 Financials", "61.5%"],
          ["消費 Consumer", "38.5%"],
        ],
      ),
    ).toMatchObject({ status: "rejected", reason: expect.stringMatching(/does not fit the listed "金融"/) });
    // RapidOCR 讀繁體漏一個字照樣接受（「貨市場工具」對「貨幣市場工具」）。
    expect(
      read(
        [
          ["貨市場工具（港元）", "70.0%"],
          ["MoneyMarketInstruments(HKD)", ""],
          ["金融Financials", "30.0%"],
        ],
        [
          ["貨 幣 市 場 工具 (港元 )", "70.0%"],
          ["Money Market Instruments (HKD)", ""],
          ["金融 Financials", "30.0%"],
        ],
      ),
    ).toMatchObject({ status: "ok" });
  });

  it("needs tesseract to confirm a short legend that a longer one could have dropped into", () => {
    const cash: ChartReadSpec = {
      ...spec,
      vocabulary: chartLabels([
        ["現金", "Cash"],
        ["現金及其他", "Cash"],
        ["金融", "Financials"],
      ]),
    };
    const readCash = (tesseractLabel: string) =>
      readChartAllocation(
        {
          rapidocr: rapid([
            ["現金Cash", "60.0%"],
            ["金融Financials", "40.0%"],
          ]),
          tesseract: tesseract([
            [tesseractLabel, "60.0%"],
            ["金融 Financials", "40.0%"],
          ]),
        } as OcrOutput,
        cash,
        1,
      );
    // RapidOCR 讀到「現金」，但圖上其實係「現金及其他」：Tesseract 讀到較長嗰個就拒絕。
    expect(readCash("現金 及 其 他 Cash")).toMatchObject({
      status: "rejected",
      reason: expect.stringMatching(/not confirmed by tesseract/),
    });
    expect(readCash("現 金 Cash")).toMatchObject({ status: "ok", entries: [{ label: "現金 Cash" }, {}] });
    expect(readCash("Cash")).toMatchObject({ status: "rejected" });
  });

  it("lets RapidOCR miss the traditional characters its model cannot read", () => {
    const bonds: ChartReadSpec = {
      ...spec,
      vocabulary: chartLabels([
        ["人民幣債券", "RMB Bonds"],
        ["金融", "Financials"],
      ]),
    };
    expect(
      readChartAllocation(
        {
          rapidocr: rapid([
            ["人民券RMBBonds", "60.0%"],
            ["金融Financials", "40.0%"],
          ]),
          tesseract: tesseract([
            ["人民 幣 債券 RMB Bonds", "60.0%"],
            ["金融 Financials", "40.0%"],
          ]),
        } as OcrOutput,
        bonds,
        1,
      ),
    ).toMatchObject({ status: "ok" });
  });

  it("does not glue a footnote digit onto the next percentage", () => {
    const glued = readChartAllocation(
      {
        rapidocr: [box("現金及其他Cash and Others 7", 50, 0), box("1.2%", 650, 0, 60), box("金融Financials", 50, 40), box("98.8%", 650, 40, 60)],
        tesseract: tesseract([
          ["現金 及 其 他 Cash and Others", "1.2%"],
          ["金融 Financials", "98.8%"],
        ]),
      } as OcrOutput,
      spec,
      1,
    );
    expect(glued).toMatchObject({ status: "ok", printed: ["1.2%", "98.8%"] });
  });

  it("holds the text layer's Chinese to the list exactly", () => {
    const callouts: ChartReadSpec = { ...spec, secondRead: "text-layer", splitGap: 40 };
    const ocr: OcrOutput = {
      rapidocr: [box("金融Financials61.5%", 0, 0, 180), box("消費Consumer38.5%", 400, 0, 180)],
      tesseract: [],
      textLayer: [
        box("金融業", 0, 0, 30),
        box("Financials 61.5%", 35, 1, 140),
        box("消費", 400, 0, 30),
        box("Consumer 38.5%", 435, 1, 140),
      ],
    };
    expect(readChartAllocation(ocr, callouts, 1)).toMatchObject({
      status: "rejected",
      reason: expect.stringMatching(/text layer/),
    });
  });
});
