import type { FactSheetContract, FactSheetSource } from "./fact-sheet-allocation";

/**
 * 每個計劃一個抽取契約。標題錨點、欄界及日期式樣逐個計劃訂明，
 * 因為 24 份便覽的版面各不相同；抽取邏輯本身共用 `fact-sheet-allocation.ts`。
 *
 * 契約只描述「去邊度攞」，不描述「點樣改寫」：標籤、維度標題及證券名稱一律原文照錄。
 */

const AS_OF_SLASH = /(?:As of|As at|Data as of|Fund Data as at)[^0-9]{0,16}(\d{1,2}\/\d{1,2}\/\d{4})/i;
const AS_OF_LONG = /As at\s+(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i;
const AS_OF_MONTH_FIRST = /As at\s+([A-Za-z]{3,}\s+\d{1,2},\s*\d{4})/i;

/** 富達逐隻基金披露不同維度，中文標題是版面上另一段文字，逐個對照。 */
const FIDELITY_DIMENSION =
  /^(?:Fund Allocation by Asset Class|Industry Breakdown|Geographical Breakdown|Currency Breakdown|S&P\/Moody’s Credit Ratings?)$/;
const FIDELITY_DIMENSION_ZH: Record<string, string> = {
  "Fund Allocation by Asset Class": "資產類別投資分配",
  "Industry Breakdown": "行業投資分佈",
  "Geographical Breakdown": "地區分佈",
  "Currency Breakdown": "貨幣分佈",
  "S&P/Moody’s Credit Rating": "標準普爾／穆廸信用評級",
  "S&P/Moody’s Credit Ratings": "標準普爾／穆廸信用評級",
};

/** 新地印在基金名稱之後的腳註（`Note 1`、`Note *, 1 and 6`），不屬名稱。 */
const SHKP_NOTE = /\s*Note\s*[\d*,\s and]*$/;

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
    // 右邊配置欄由 440 起，兩個 band 唔可以重疊：2026-03-31 那一期的配置欄註腳
    // `3` 落在 446，撞入持倉欄就會變成「有數值冇名稱」，令整張十大持倉表報唔可用。
    band: { minLeft: 20, maxLeft: 440 },
    numberFormat: "bare",
    valueMinLeft: 350,
    joinWrappedLabels: true,
  },
} as const;

/**
 * BCT Simple／Smart Plan（前信安）：右邊資產類別投資分布，左邊十大主要投資項目。
 * 逐隻基金按類型披露不同維度，股票基金用地區、債券基金用信貸評級（官方串錯成
 * `Crediting Rating`，原文照錄）。
 */
const PRINCIPAL_DIMENSION =
  /^(?:Fund Allocation by Asset Class|Geographical Breakdown|Crediting Rating Breakdown)$/;
const PRINCIPAL_DIMENSION_ZH: Record<string, string> = {
  "Fund Allocation by Asset Class": "資產類別投資分布",
  "Geographical Breakdown": "地區投資分布",
  "Crediting Rating Breakdown": "信貸評級投資分布",
};

const principalBlocks = {
  allocation: {
    heading: PRINCIPAL_DIMENSION,
    headingLabel: (text: string) => `${text} ${PRINCIPAL_DIMENSION_ZH[text] ?? ""}`.trim(),
    band: { minLeft: 315, maxLeft: 900 },
    numberFormat: "bare",
    valueMinLeft: 650,
    // 表格之下冇另一個標題，會一路讀到頁腳；頁碼排在 left≈865，會被當成一個數值。
    valueMaxLeft: 800,
    // 表格最長約 150 pt，而頁底的基金評論最少喺標題之下 230 pt，評論入面的年份
    // 會被當成數值（`受益於市場風險=2025`）。
    maxDepth: 180,
  },
  holdings: {
    heading: /^Top 10 Holdings$/,
    // 右界要收窄到 330：右欄的分佈表標題（left≈341）落在寬欄界之內，會被當成
    // 十大投資項目的下界，令表格喺三幾行就收咗尾，甚至一行都讀唔到。
    band: { minLeft: 20, maxLeft: 330 },
    numberFormat: "bare",
    // 唔設數值欄左界：證券名有中文對照時，數值緊貼住中文名排（left 由 55 至 300 不等，
    // 視乎名稱長度），而且同名稱之間冇空隙，靠行尾抽數字抽唔到。
    joinWrappedLabels: true,
    // 頁碼喺左右頁交替排（單數頁 left≈865、雙數頁 left≈30），落喺名稱那一欄，
    // 冇欄界隔到；證券名唔會淨係一兩個位數字。
    ignore: /^\d{1,2}$/,
    // 十大投資項目之下係頁底的基金評論，以「^」起首，橫跨成版。
    stopAt: /^\^/,
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

/**
 * MASS：積金局副本同受託人官網逐隻基金那份係同一套版面（藍色基金名做頁眉、右邊圓餅圖
 * 標註、左下角十大持倉），只有截至日期的寫法唔同，所以標題同兩塊披露共用。
 */
const massBlocks: Pick<FactSheetContract, "title" | "allocation" | "holdings"> = {
  title: {
    // 基金名排在每隻基金第二版的頁眉；第一版的標題係另一個顏色，唔會撞。
    pattern: /Fund$/,
    fontSize: [18],
    fontFamily: /Calibri,Bold/,
    fontColor: ["#00b8f1"],
  },
  allocation: {
    // 餅圖旁邊的標註：標籤一行、百分比一行，餅左邊的靠右對齊、右邊的靠左對齊，
    // 所以中心對唔上，要按水平範圍相交分組。標註以百分比作結。
    heading: /^Portfolio Asset Allocation/,
    headingLabel: () => "Portfolio Asset Allocation 投資組合分佈",
    band: { minLeft: 390, maxLeft: 900 },
    callouts: { overlap: true },
    // 餅圖之下係資料來源及曆年回報表，唔屬於投資組合分佈。
    maxDepth: 260,
  },
  holdings: { heading: /^Top 10 Holdings/ },
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
      // 三欄版面：左邊市場評論、中間資產分佈（標籤 357、值 574）、右邊十大投資
      // （標籤 612、值 841）。自動欄界由標題往左讓 30 pt，會切走中文標籤，
      // 又會把右欄的證券名當成資產分佈的標籤。
      band: { minLeft: 350, maxLeft: 600 },
      valueMinLeft: 560,
      numberFormat: "bare",
      // 資產分佈表之下係風險指標及基金開支比率，同一欄，不設下界就會一路讀落去。
      stopAt: /^風險指標|^Risk Indicator/,
      ignore: /Summation|總和|rounding/i,
    },
    holdings: {
      heading: /^Top Ten Holdings \(%\)$/,
      band: { minLeft: 605, maxLeft: 900 },
      valueMinLeft: 800,
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
      // 每隻基金一頁，頁首寫「計劃名 - 基金名」。前面幾頁的基金表現總表用同一批
      // 基金名但係細字，認錯咗就會把 22 個區段全部切在總表上面，一行都抽唔到。
      pattern: /^Fidelity Retirement Master Trust - .*Fund$/,
      fontSize: [29],
      fontFamily: /NeuzeitGro-Bol/,
      name: (text) => text.replace(/^Fidelity Retirement Master Trust - /, "").trim(),
    },
    allocation: {
      // 富達冇統一的「資產分佈」標題：逐隻基金按類型披露不同維度，股票基金用行業，
      // 混合基金用資產類別，債券基金另加貨幣及信用評級。維度標題原文照錄。
      heading: FIDELITY_DIMENSION,
      // 便覽最後幾頁的附錄用 4 級字把同一批表再縮印一次，最後一個區段會讀埋落去。
      headingFontSize: [13],
      headingLabel: (text) => `${text} ${FIDELITY_DIMENSION_ZH[text] ?? ""}`.trim(),
      // 「行業投資分佈」在中欄，右邊係註腳而唔係另一塊披露，自動欄界推唔到右界。
      columnWidth: 250,
      // 左邊評論欄的斷字連字符排到 left 338，預設 30 pt 容差會把它收入欄內。
      leftSlack: 20,
    },
    holdings: {
      heading: /^Top 10 Holdings$/,
      headingFontSize: [13],
      // 證券名換行時，百分比垂直置中排在兩段名稱之間（相距 5 至 6 pt），
      // 而列與列之間相距 12 pt，所以容差要細過 12。
      rowGap: 8,
      // 部分基金（例如香港盈富基金）右邊冇另一塊披露，只有註腳，自動欄界推唔到右界。
      columnWidth: 250,
      // 十大投資項目以「TOTAL 總和」收尾，總和唔係一項投資。
      stopAt: /^TOTAL|總和/,
      // 左邊評論欄的斷字連字符排到 left 338，收入欄內會多出一行，令相鄰兩列併埋一齊。
      leftSlack: 20,
    },
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    // 積金局便覽庫嗰份，版面全大寫標題、密集報告式配置表，持倉數字帶 `%`。
    // 受託人官網（gthtam.com.hk）嘅「Fund Monitor」係完全唔同嘅長條圖式版面
    // （數值印喺圖表末端、持倉數字唔帶 `%`），要用底下 `source: "trustee"` 嗰份契約。
    scheme: "Haitong MPF Retirement Fund",
    source: "mpfa-registry",
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
    // 受託人官網「Fund Monitor」：長條圖式配置，英文、中文、百分比分成三段獨立文字，
    // 百分比印喺圖表末端（隨數值大小左右浮動），唔跟英文標籤排喺同一行——三段之間
    // 得返幾 pt 嘅垂直落差，`rowGap` 先合併得返一整列。
    scheme: "Haitong MPF Retirement Fund",
    source: "trustee",
    title: {
      pattern: /Fund$/,
      fontSize: [17, 18],
      fontFamily: /Arial$/,
      fontColor: ["#ffffff"],
      maxLeft: 400,
    },
    allocation: {
      heading: /^ASSET ALLOCATION/,
      headingLabel: (text) => text,
      // 右欄（配置圖表及十大持倉）由 left≈420 起，左欄（基金描述、基金表現、
      // 曆年回報表）止於 left≈400 內，留咗足夠容差。
      band: { minLeft: 420, maxLeft: 900 },
      // 圖表下面有一行座標軸刻度（例如 `0% 10% 20% 30% 40%`），跟正常一行「標籤+數值」
      // 長得一樣，但冇標籤——一律以 `0%` 起首，唔理後面幾多個刻度、跳幾多都要剔走，
      // 否則會屈埋做「有數值冇名稱」，累到成個配置表當官方未提供。
      ignore: /^0%(\s+\d+%)+$/,
      // 英文標籤、百分比、中文標籤三段分別排喺 top 相差 4 至 10 pt，行距唔靠版位對齊，
      // 逐行讀會拆散成三段獨立、冇法配對嘅碎片。同一列嘅三段最多相差 7 pt，
      // 下一列嘅英文標籤同呢一列最後一段最少相差 14 pt，8 夾喺中間，兩頭都留返容差。
      rowGap: 8,
    },
    holdings: {
      heading: /^TOP TEN HOLDINGS$/,
      band: { minLeft: 420, maxLeft: 900 },
      // 持倉數字唔帶 `%`（標題已寫「% of Net Asset Value」）。
      numberFormat: "bare",
      valueMinLeft: 700,
    },
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
      // 積金局副本嵌入的字體係 `Arial`，受託人官網那份由 Word 匯出，同一個標題嵌成
      // `Arial,Bold`。兩份的版面一模一樣，只係嵌字名唔同，所以放寬字體名而唔開多一份契約；
      // 內文用 `ArialMT`，加 `,Bold` 唔會誤中。
      fontFamily: /Arial(?:,Bold)?$/,
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
    source: "mpfa-registry",
    ...massBlocks,
    // 積金局副本係中英對照版，封面同逐版都有中文日期，一行讀得到。
    asOf: { pattern: /(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/ },
  },
  {
    // 受託人官網逐隻基金一份便覽（`app2.yflife.com/MPFWeb/pdf/fact_sheet/<代號>_E.pdf`），
    // 版面同積金局副本一模一樣，只差係英文版：冇中文日期，而「Fund Data as at
    // June 30, 2026」排喺左欄並且斷開兩行，右邊同一條基線仲有「Fund Price (HKD)」。
    scheme: "MASS Mandatory Provident Fund Scheme",
    source: "trustee",
    ...massBlocks,
    asOf: {
      pattern: AS_OF_MONTH_FIRST,
      band: { minLeft: 0, maxLeft: 200 },
      joinWrappedLines: true,
    },
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
      // 基金名稱後面直接印住腳註編號，寫法有三種：`Allianz Choice Balanced FundNote 1`、
      // `Invesco MPF Conservative Fund Note *, 1 and 6`、`Manulife Career Average
      // Guaranteed Fund - SHKPNote 1`（「- SHKP」是基金名稱本身的一部分）。
      pattern: /Fund(?:\s*-\s*SHKP)?(?:\s*Note\s*[\d*,\s and]*)?$/,
      fontSize: [12],
      // 標題用 `Arial`，內文用 `ArialMT`。逐頁的左邊界會漂移十幾 pt（32 至 53），
      // 所以靠 `maxTop` 把頁首的基金名同頁內的「基金類型描述」分開，而不是靠左界。
      fontFamily: /Arial/,
      minLeft: 30,
      maxLeft: 60,
      maxTop: 160,
      name: (text) => text.replace(SHKP_NOTE, "").trim(),
    },
    allocation: {
      // 新地披露的是基礎基金而非成分基金本身，標題必須保留這個分別。
      heading: /^Asset Allocation of (?:Underlying Fund|the Fund)/,
      headingLabel: (text) => text.replace(/\^$/, "").trim(),
      // 左邊的基金概覽欄（基金規模、成立日期、開支比率）同配置表在同一水平帶，
      // 要靠左界隔開；但腳註標記排喺標籤再左邊（left≈496），所以留到 490。
      band: { minLeft: 490, maxLeft: 900 },
      valueMinLeft: 800,
      // 剔走概覽欄漏入的純數字（`1,772.48`、`02/07/2002`、`0.66262%`）及自成一段的腳註標記。
      labelIgnore: /^[\d,.]+\s*%?$|^\d{2}\/\d{2}\/\d{4}$/,
      labelStrip: /^\d{1,2}\s+/,
      // 中英對照的兩欄相距 30 至 65 pt，而欄內的字緊貼（「香港」「/」「中國股票」）。
      labelColumnGap: 20,
      // 「亞太區股票」那一列的名稱換行，數值垂直置中排在兩段名稱之間；
      // 列距 16 至 21 pt，所以容差要細過 16，否則會連下一列一齊吞埋。
      rowGap: 12,
      joinTrailingLabels: true,
      // 十大持倉在配置之下，橫跨成版，百分比落在配置那一欄的右界之內。
      // 配置表以「Total 總數」收尾，就用它做下界；用 `ignore` 只會讓表格一路讀到持倉。
      stopAt: /^Total|總數/,
    },
    holdings: {
      heading: /^Top Ten Holdings of Underlying Fund/,
      // 標題置中（left≈274）而證券名靠左（left≈32 至 46），自動欄界會由標題往左讓
      // 30 pt，剛好切走名稱只剩百分比，所以要明確劃開整版。
      band: { minLeft: 20, maxLeft: 900 },
      // 證券名同百分比唔一定對齊同一條基線：受託人官網那份有幾行差 5 至 6 pt，
      // 超出 `toLines` 的 4 pt 容差，逐行讀會變成「有百分比冇名稱」，整張表報唔可用。
      // 列距 14 至 15 pt，所以 7 pt 併得返同一列而唔會吞埋下一列。
      rowGap: 7,
    },
    asOf: { pattern: AS_OF_LONG },
  },
  {
    scheme: "Sun Life Rainbow MPF Scheme",
    title: {
      pattern: /^Sun Life .*Fund$/,
      fontSize: [27],
      fontFamily: /SunLifeNewDisplay/,
      // 每一版都把另外一至兩版成版疊印上去（有幾版疊住上兩季的舊版），
      // 幾個標題同樣落喺 top≈82，只有落筆次序分得開本頁自己嗰層。
      overlaidPages: true,
      maxTop: 160,
    },
    allocation: {
      heading: /^Portfolio Allocation$/,
      headingLabel: () => "Portfolio Allocation 投資組合分佈",
      // 圓環圖的圖例（「現金及存款 Cash & Deposit 83.2%」）連同百分比全部畫成向量，
      // 文字層一個字都冇。不設這個聲明的話，會由頁面其他地方讀到不相干的百分比。
      unextractable:
        "the donut chart's legend and percentages are drawn as vector art, not text",
    },
    holdings: {
      heading: /^Top 10 Holdings$/,
      // 標題置中（left≈566）而證券名靠左（left≈472），自動欄界會切走名稱只剩百分比。
      band: { minLeft: 460, maxLeft: 900 },
      valueMinLeft: 780,
      // `overlaidPages` 已按落筆次序切走疊上去嗰層。呢個係防線：切唔乾淨嘅話
      // 同一行會出現多過一個百分比，寧可整塊當抽唔到，都唔靠左界猜邊個屬邊隻基金。
      rejectOverlaidRows: true,
    },
    asOf: { pattern: AS_OF_SLASH },
  },
];

/** 逐個計劃嘅 scheme 名，去重但保留 `FACT_SHEET_CONTRACTS` 入面首次出現嘅次序。 */
export const FACT_SHEET_SCHEMES: string[] = [
  ...new Set(FACT_SHEET_CONTRACTS.map((contract) => contract.scheme)),
];

/**
 * 揀返嗰個 scheme 適用嘅契約：先搵聲明咗 `source` 同呢次來源相符嗰份，
 * 揾唔到就退而求其次揀冇聲明 `source`（兩個來源共用）嗰份。兩樣都揾唔到就報錯，
 * 唔可以夾硬用另一個來源嘅契約去讀呢份便覽。
 */
export function factSheetContract(scheme: string, source: FactSheetSource) {
  const candidates = FACT_SHEET_CONTRACTS.filter((contract) => contract.scheme === scheme);
  const contract =
    candidates.find((candidate) => candidate.source === source) ??
    candidates.find((candidate) => candidate.source === undefined);
  if (!contract) {
    throw new Error(`No fact sheet allocation contract for ${scheme} (source: ${source})`);
  }
  return contract;
}
