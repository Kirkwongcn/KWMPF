import type { FactSheetContract } from "./fact-sheet-allocation";

/**
 * 每個計劃一個抽取契約。標題錨點、欄界及日期式樣逐個計劃訂明，
 * 因為 24 份便覽的版面各不相同；抽取邏輯本身共用 `fact-sheet-allocation.ts`。
 *
 * 契約只描述「去邊度攞」，不描述「點樣改寫」：標籤、維度標題及證券名稱一律原文照錄。
 */

const AS_OF_SLASH = /(?:As of|As at|Data as of|Fund Data as at)[^0-9]{0,16}(\d{1,2}\/\d{1,2}\/\d{4})/i;
const AS_OF_LONG = /As at\s+(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i;
const AS_OF_MONTH_FIRST = /As at\s+([A-Za-z]{3,}\s+\d{1,2},\s*\d{4})/i;

const beaTitle = {
  pattern: /^BEA .*Fund$/,
  fontSize: [21],
  fontFamily: /HandoTrial/,
  fontColor: ["#ffffff"],
  maxLeft: 200,
};

const beaBlocks = {
  allocation: {
    heading: /^Portfolio Allocation$/,
    headingLabel: () => "Portfolio Allocation 投資組合分佈",
    ignore: /Commentary|評論/,
  },
  holdings: { heading: /^Top 10 Portfolio Holdings/ },
} as const;

const bctTitle = (color: string) => ({
  pattern: /Fund$/,
  fontSize: [18],
  fontFamily: /HelveticaNeueLTPro-Bd/,
  fontColor: [color],
});

const bctBlocks = {
  allocation: {
    heading: /^Portfolio Allocation$/,
    headingLabel: () => "Portfolio Allocation 投資組合分佈",
  },
  holdings: {
    heading: /^Top 10 Portfolio Holdings$/,
    ignore: /may consist of less than/i,
  },
} as const;

/** BCT Series 800（前信安 800 系列）：左邊十大投資、右邊投資分布，數字不帶 `%`。 */
const series800Blocks = {
  allocation: {
    heading: /^Asset Allocation Breakdown/,
    headingLabel: () => "Asset Allocation Breakdown 投資分布",
    band: { minLeft: 440, maxLeft: 900 },
    numberFormat: "bare",
    valueMinLeft: 650,
  },
  holdings: {
    heading: /^Top Ten Holdings$/,
    band: { minLeft: 20, maxLeft: 460 },
    numberFormat: "bare",
    valueMinLeft: 350,
    joinWrappedLabels: true,
  },
} as const;

/** BCT Simple／Smart Plan（前信安）：右邊資產類別投資分布，左邊十大主要投資項目。 */
const principalBlocks = {
  allocation: {
    heading: /^Fund Allocation by Asset Class$/,
    headingLabel: () => "Fund Allocation by Asset Class 資產類別投資分布",
    band: { minLeft: 315, maxLeft: 900 },
    numberFormat: "bare",
    valueMinLeft: 650,
  },
  holdings: {
    heading: /^Top 10 Holdings$/,
    band: { minLeft: 20, maxLeft: 460 },
    numberFormat: "bare",
    valueMinLeft: 250,
    joinWrappedLabels: true,
  },
} as const;

/** 滙豐及恒生：中間一欄是配置及十大持倉，右邊是市場評論，欄界要明確劃開。 */
const hsbcBlocks = {
  allocation: {
    // 百分比排在標籤左邊（值 left≈420、標籤 left≈455），與十大持倉的「名稱左、數值右」相反。
    // 右界收窄到 590 是為了避開評論欄的項目符號（left≈595）。
    heading: /^Portfolio allocation \(market\/sector\)/,
    headingLabel: () => "Portfolio allocation (market/sector) 投資組合分佈（市場／行業）",
    band: { minLeft: 300, maxLeft: 590 },
    valueMinLeft: 400,
    valueMaxLeft: 450,
    joinTrailingLabels: true,
  },
  holdings: {
    heading: /^Top 10 portfolio holdings \(%\)/,
    // 十大持倉之下沒有另一個標題，不設下界就會一路讀到曆年回報表，把年份當成持倉。
    band: { minLeft: 300, maxLeft: 590 },
    numberFormat: "bare",
    valueMinLeft: 480,
    ignore: /^Securities|證券|Holdings \(%\)|持有量/,
    stopAt: /Fund performance since launch|Calendar year return/,
  },
} as const;

export const FACT_SHEET_CONTRACTS: FactSheetContract[] = [
  {
    scheme: "AIA MPF - Prime Value Choice",
    title: {
      // 友邦有五個「組合」（保證、增長、均衡、穩定資本、以及帶註腳符號的強積金保守基金），
      // 淨係認 `Fund$` 會漏咗佢哋。註腳符號屬版面標記，唔屬基金名稱。
      pattern: /(Fund|Portfolio)[\^*]?$/,
      fontSize: [21],
      fontFamily: /AIAEverest$/,
      maxLeft: 400,
      name: (text) => text.replace(/[\^*]+$/, "").trim(),
    },
    allocation: {
      // 資產分布在右欄（值 left≈410、標籤 left≈442），十大投資項目在左欄，
      // 兩個標題不同欄，自動推下界推唔到，要靠「基金表現」這條分隔線收尾。
      heading: /ASSET ALLOCATION/,
      headingLabel: () => "ASSET ALLOCATION 資產分佈",
      band: { minLeft: 300, maxLeft: 900 },
      valueMinLeft: 400,
      valueMaxLeft: 440,
      stopAt: /FUND PERFORMANCE/,
    },
    holdings: {
      heading: /TOP TEN HOLDINGS/,
      ignore: /calculated|十大投資項目乃由|將只於/,
      // 右邊（left≥400）是參考組合說明，唔屬於十大投資項目。
      band: { minLeft: 20, maxLeft: 400 },
      valueMinLeft: 330,
    },
    asOf: { pattern: AS_OF_LONG },
  },
  {
    scheme: "AMTD MPF Scheme",
    title: {
      pattern: /Fund$/,
      fontSize: [15],
      fontFamily: /\+Arial$/,
    },
    allocation: {
      heading: /^Portfolio Allocation$/,
      headingLabel: () => "Portfolio Allocation 投資組合分佈",
      band: { minLeft: 20, maxLeft: 460 },
      numberFormat: "bare",
      valueMinLeft: 380,
      ignore: /Summation|總和/,
    },
    holdings: {
      heading: /^Top 10 Portfolio Holdings$/,
      band: { minLeft: 20, maxLeft: 460 },
      numberFormat: "bare",
      valueMinLeft: 380,
    },
    asOf: { pattern: /As at\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i },
  },
  {
    scheme: "BCOM Joyful Retirement MPF Scheme",
    title: {
      // 恒指 ESG 追蹤基金的標題帶註腳符號（`Fund^`），註腳符號屬版面標記，不是基金名稱。
      pattern: /Fund[\^*†]?$/,
      fontSize: [15],
      fontFamily: /MHei-Xbold/,
      name: (text) => text.replace(/[\^*†]+$/, "").trim(),
    },
    allocation: {
      // 圓餅圖旁邊的置中標註：中文名、英文名、百分比同一個中心 x。
      // 右界 570 把 left≈580 的十大資產隔開。
      heading: /^資產分佈 Asset allocation/,
      headingLabel: () => "資產分佈 Asset allocation",
      band: { minLeft: 370, maxLeft: 570 },
      callouts: {},
    },
    holdings: { heading: /^十大資產 Top 10 Holdings/ },
    asOf: { pattern: /截至\s*As of\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i },
  },
  {
    scheme: "BCT (MPF) Industry Choice",
    // 平台寫「BCT (Industry) …」「BCT (Pro) …」，便覽的標題冇呢個前綴。
    platformNamePrefix: /^BCT \((?:Industry|Pro)\)\s+/,
    title: bctTitle("#346fc0"),
    ...bctBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BCT (MPF) Pro Choice",
    // 平台寫「BCT (Industry) …」「BCT (Pro) …」，便覽的標題冇呢個前綴。
    platformNamePrefix: /^BCT \((?:Industry|Pro)\)\s+/,
    title: bctTitle("#639e1d"),
    ...bctBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BCT MPF - Simple Plan",
    title: {
      pattern: /Fund$/,
      fontSize: [20],
      fontFamily: /FranklinGothicURW-Dem/,
      fontColor: ["#ffffff"],
    },
    ...principalBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BCT MPF - Smart Plan",
    title: {
      pattern: /Fund$/,
      fontSize: [20],
      fontFamily: /FranklinGothicURW-Dem/,
      fontColor: ["#ffffff"],
    },
    ...principalBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BCT MPF Scheme Series 800",
    title: {
      pattern: /Fund$/,
      fontSize: [24],
      fontFamily: /FSElliotPro/,
      fontColor: ["#ffffff"],
    },
    ...series800Blocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BCT Strategic MPF Scheme",
    title: {
      pattern: /Fund$/,
      fontSize: [21],
      fontFamily: /InvescoEditor/,
      // 便覽的中文版把同一批基金再印一次，只取第一次（英文版）出現的區段。
      dedupeByName: true,
    },
    allocation: {
      heading: /^Asset Allocation\* \(%\)$/,
      headingLabel: () => "Asset Allocation (%) 資產分佈",
      numberFormat: "bare",
      ignore: /Summation|總和|rounding/i,
    },
    holdings: {
      heading: /^Top Ten Holdings \(%\)$/,
      numberFormat: "bare",
    },
    asOf: { pattern: AS_OF_LONG },
  },
  {
    scheme: "BEA (MPF) Industry Scheme",
    title: beaTitle,
    ...beaBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BEA (MPF) Master Trust Scheme",
    title: beaTitle,
    ...beaBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BEA (MPF) Value Scheme",
    title: beaTitle,
    ...beaBlocks,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BOC-Prudential Easy-Choice Mandatory Provident Fund Scheme",
    title: {
      // 便覽尾段（第 23 頁起）用同一個字款重印全部基金名稱做收費附錄，
      // 標題落在頁內任何高度；基金詳情頁的標題一定在頁頂（top≈19）。
      pattern: /Fund$/,
      fontSize: [20],
      fontFamily: /HelveticaNeue-Condens/,
      fontColor: ["#ffffff"],
      maxTop: 30,
    },
    allocation: {
      // 圓餅圖旁邊的置中標註：中文名、英文名、百分比三段同一個中心 x。
      heading: /^\*? ?Asset Allocation\*?$/,
      headingLabel: () => "Asset Allocation 基金資產分佈",
      ignore: /sector classification|行業分類/,
      band: { minLeft: 400, maxLeft: 900 },
      callouts: {},
    },
    holdings: { heading: /^Top Ten Holdings$/ },
    // 用封面的「匯報日 Reporting Date」。便覽內另有風險級別來源的
    // 「data as at 31 December 2025」註腳，那是第三方數據的日期，不是這份便覽的截至日期。
    asOf: { pattern: /Reporting Date:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, maxPage: 1 },
  },
  {
    scheme: "China Life MPF Master Trust Scheme",
    title: {
      pattern: /Fund$/,
      fontSize: [21],
      fontFamily: /ArialNarrow/,
      fontColor: ["#ffffff"],
    },
    allocation: {
      heading: /^Portfolio Allocation$/,
      headingLabel: () => "Portfolio Allocation 投資組合分佈",
    },
    holdings: { heading: /^Top 10 Portfolio Holdings$/ },
    asOf: { pattern: /As at\s+(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i, pick: "latest" },
  },
  {
    scheme: "Fidelity Retirement Master Trust",
    title: {
      pattern: /Fund$/,
      fontSize: [12],
      fontFamily: /NeuzeitGro-Reg/,
    },
    allocation: {
      heading: /^Asset Allocation$/,
      headingLabel: () => "Asset Allocation 資產分配",
    },
    holdings: { heading: /^Top 10 Holdings$/ },
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "Haitong MPF Retirement Fund",
    title: {
      pattern: /FUND$/,
      fontSize: [14],
      fontFamily: /Arial$/,
      fontColor: ["#ffffff"],
    },
    allocation: {
      heading: /^ASSET ALLOCATION/,
      headingLabel: (text) => text,
    },
    holdings: { heading: /^TOP TEN HOLDINGS$/ },
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "Hang Seng Mandatory Provident Fund - SuperTrust Plus",
    title: {
      pattern: /^•\s.*Fund$/,
      fontSize: [15],
      fontFamily: /Flama$/,
      name: (text) => text.replace(/^•\s*/, ""),
    },
    ...hsbcBlocks,
    asOf: { pattern: /All information as at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
  },
  {
    scheme: "HSBC Mandatory Provident Fund - SuperTrust Plus",
    title: {
      pattern: /^•\s.*Fund$/,
      fontSize: [15],
      fontFamily: /UniversNextforHSBC$/,
      name: (text) => text.replace(/^•\s*/, ""),
    },
    ...hsbcBlocks,
    asOf: { pattern: /All information as at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
  },
  {
    scheme: "Manulife Global Select (MPF) Scheme",
    title: {
      pattern: /^Manulife MPF .*Fund$/,
      fontSize: [14, 15],
      fontFamily: /Arial$/,
      fontColor: ["#ffffff"],
    },
    allocation: {
      // 環球精選的投資組合分布係向量條形圖，標籤及百分比都唔係可抽取文字
      // （`pdftohtml` 在 left 291–556 這一欄抽唔到任何 text）。欄界照劃在圖表位置：
      // 29 隻基金全部走 `unavailableFields`，唔可以由旁邊的十大資產欄借數字充數。
      heading: /^Portfolio Allocation$/,
      headingLabel: () => "Portfolio Allocation 投資組合分佈",
      band: { minLeft: 280, maxLeft: 556 },
      unextractable:
        "the bar chart's labels and percentages are drawn as vector art, not text",
    },
    holdings: {
      heading: /^Top 10 Portfolio Holdings$/,
      // 標題的 left 逐隻基金浮動（589–616），自動推欄界會時而切走 left=565 的證券名稱。
      band: { minLeft: 550, maxLeft: 900 },
      valueMinLeft: 800,
    },
    asOf: { pattern: AS_OF_MONTH_FIRST },
  },
  {
    scheme: "Manulife RetireChoice (MPF) Scheme",
    title: {
      pattern: /Fund$/,
      fontSize: [24],
      fontFamily: /Arial$/,
      fontColor: ["#ffffff"],
    },
    allocation: {
      // 自在人生的圓餅圖冇自己的標題，整欄由「Portfolio Analysis」帶起，
      // 下界就係同一欄的「Top 10 Holdings」，所以欄界要包住標題的 left≈457。
      heading: /^Portfolio Analysis$/,
      headingLabel: () => "Portfolio Analysis 投資組合分析",
      band: { minLeft: 450, maxLeft: 900 },
      valueMinLeft: 800,
      labelIgnore: /^é$/,
    },
    holdings: {
      heading: /^Top 10 Holdings$/,
      ignore: /do not include/i,
      // 名稱欄之後仲有「國家／地區」欄，唔可以當成證券名稱的一部分。
      labelMaxLeft: 740,
      valueMinLeft: 800,
      rowGap: 10,
    },
    asOf: { pattern: AS_OF_MONTH_FIRST },
  },
  {
    scheme: "MASS Mandatory Provident Fund Scheme",
    title: {
      pattern: /Fund$/,
      fontSize: [18],
      fontFamily: /Calibri,Bold/,
      fontColor: ["#00b8f1"],
    },
    allocation: {
      heading: /^Portfolio Asset Allocation/,
      headingLabel: () => "Portfolio Asset Allocation 投資組合分佈",
    },
    holdings: { heading: /^Top 10 Holdings/ },
    asOf: { pattern: /(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/ },
  },
  {
    scheme: "My Choice Mandatory Provident Fund Scheme",
    title: {
      pattern: /FUND$/,
      fontSize: [26],
      fontFamily: /ITCSymbolStd$/,
      fontColor: ["#ffffff"],
    },
    allocation: {
      // 圓餅圖的標註散落在 left 22–484，標題自己在 165，自動推欄界會切走最左的標註；
      // 右界 560 是為了把 left≈607 的市場評論隔開。
      heading: /^ASSET ALLOCATION BY/,
      headingLabel: (text) => text,
      band: { minLeft: 15, maxLeft: 560 },
      unextractable:
        "disclosed as scattered pie-chart callouts: several slices share a baseline and some percentages sit apart from their label, so rows cannot be paired",
    },
    holdings: {
      heading: /^TOP TEN HOLDINGS$/,
      band: { minLeft: 15, maxLeft: 560 },
      valueMinLeft: 460,
    },
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "SHKP MPF Employer Sponsored Scheme",
    title: {
      // 基金名稱後面直接印住腳註編號（例如 `Allianz Choice Stable Growth FundNote 1`）。
      pattern: /Fund(?:Note ?\d+)?$/,
      fontSize: [12],
      fontFamily: /ArialMT/,
      minLeft: 40,
      maxLeft: 60,
      name: (text) => text.replace(/Note ?\d+$/, "").trim(),
    },
    allocation: {
      // 新地披露的是基礎基金而非成分基金本身，標題必須保留這個分別。
      heading: /^Asset Allocation of (?:Underlying Fund|the Fund)/,
      headingLabel: (text) => text.replace(/\^$/, "").trim(),
      band: { minLeft: 508, maxLeft: 900 },
      ignore: /^Total|總數/,
    },
    holdings: {
      heading: /^Top Ten Holdings of Underlying Fund/,
      band: { minLeft: 40, maxLeft: 900 },
    },
    asOf: { pattern: AS_OF_LONG },
  },
  {
    scheme: "Sun Life Rainbow MPF Scheme",
    title: {
      pattern: /^Sun Life .*Fund$/,
      fontSize: [27],
      fontFamily: /SunLifeNewDisplay/,
      // 每頁一隻基金，頁內另有重疊的隱藏標題文字，只取最上面一個。
      onePerPage: true,
      maxTop: 160,
    },
    allocation: {
      heading: /^Portfolio Allocation$/,
      headingLabel: () => "Portfolio Allocation 投資組合分佈",
    },
    holdings: { heading: /^Top 10 Holdings$/ },
    asOf: { pattern: AS_OF_SLASH },
  },
];

export function factSheetContract(scheme: string) {
  const contract = FACT_SHEET_CONTRACTS.find((candidate) => candidate.scheme === scheme);
  if (!contract) throw new Error(`No fact sheet allocation contract for ${scheme}`);
  return contract;
}
