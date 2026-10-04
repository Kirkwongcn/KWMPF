import type { FactSheetContract, FactSheetSource } from "./fact-sheet-allocation";
import { chartLabels } from "./fact-sheet-chart-read";

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
const FIDELITY_DIMENSIONS =
  "Fund Allocation by Asset Class|Industry Breakdown|Geographical Breakdown|Currency Breakdown|S&P\\/Moody’s Credit Ratings?";
/** 積金局副本嘅標題係淨英文一行，用 `$` 收尾避免撞正文。 */
const FIDELITY_DIMENSION = new RegExp(`^(?:${FIDELITY_DIMENSIONS})$`);
/** 受託人官網嗰份係中英對照，標題後面緊接中文譯名，唔可以用 `$` 收尾。 */
const FIDELITY_DIMENSION_BILINGUAL = new RegExp(`^(?:${FIDELITY_DIMENSIONS})`);
const FIDELITY_DIMENSION_ZH: Record<string, string> = {
  "Fund Allocation by Asset Class": "資產類別投資分配",
  "Industry Breakdown": "行業投資分佈",
  "Geographical Breakdown": "地區分佈",
  "Currency Breakdown": "貨幣分佈",
  "S&P/Moody’s Credit Rating": "標準普爾／穆廸信用評級",
  "S&P/Moody’s Credit Ratings": "標準普爾／穆廸信用評級",
};

/**
 * 富達積金局副本同受託人官網逐隻基金那份係同一套排版（同一批字體級數、同樣三欄），
 * 標題錨點、欄界及日期式樣共用；只有披露標題的收尾唔同，逐個來源各自覆寫。
 */
const fidelityBlocks: Pick<
  FactSheetContract,
  "title" | "allocation" | "holdings" | "asOf"
> = {
  title: {
    // 每隻基金一頁，頁首寫「計劃名 - 基金名」。積金局副本前面幾頁的基金表現總表用
    // 同一批基金名但係細字，認錯咗就會把 22 個區段全部切在總表上面，一行都抽唔到。
    pattern: /^Fidelity Retirement Master Trust - .*Fund$/,
    fontSize: [29],
    fontFamily: /NeuzeitGro-Bol/,
    name: (text: string) => text.replace(/^Fidelity Retirement Master Trust - /, "").trim(),
  },
  allocation: {
    // 富達冇統一的「資產分佈」標題：逐隻基金按類型披露不同維度，股票基金用行業，
    // 混合基金用資產類別，債券基金另加貨幣及信用評級。維度標題原文照錄。
    heading: FIDELITY_DIMENSION_BILINGUAL,
    // 便覽最後幾頁的附錄用 4 級字把同一批表再縮印一次，最後一個區段會讀埋落去。
    headingFontSize: [13],
    headingLabel: (text: string) => `${text} ${FIDELITY_DIMENSION_ZH[text] ?? ""}`.trim(),
    // 「行業投資分佈」在中欄，右邊係註腳而唔係另一塊披露，自動欄界推唔到右界。
    columnWidth: 250,
    // 左邊評論欄的斷字連字符排到 left 338，預設 30 pt 容差會把它收入欄內。
    leftSlack: 20,
  },
  holdings: {
    heading: /^Top 10 Holdings/,
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
} as const;

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
    band: { minLeft: 40, maxLeft: 545 },
    // The summary bar repeats the detailed pie's assets. Read that entire pie.
    minDepth: 45,
    stopAt: /^Commentary/,
    labelIgnore: /^4$/,
    callouts: {
      overlap: true,
      inlineValues: true,
      horizontalGap: 16,
      requireValues: true,
      allowBarePercent: true,
      numericSpacing: true,
    },
    expectedTotal: { percent: 100, tolerance: 0.5 },
  },
  holdings: {
    heading: /^Top 10 Portfolio Holdings/,
    band: { minLeft: 545, maxLeft: 850 },
    stopAt: /^Commentary/,
  },
} as const;

/**
 * 東亞三個計劃同一版面：左上「Investment Objective 投資目標」先英文後中文，右邊係基金資料欄
 * （left≈315），下面係投資組合分佈；「Commentary 評論」分兩欄並排，左英（left≈60）右中
 * （left≈526），兩欄的行喺同一高度，所以要逐欄讀。右欄評論之上係十大持倉，由評論標題下面先開始讀。
 */
const beaNarrative: FactSheetContract["narrative"] = {
  investmentObjective: {
    heading: /^Investment Objective 投資目標$/,
    band: { minLeft: 50, maxLeft: 305 },
    stopAt: /^Portfolio Allocation/,
    minFontSize: 8,
    maxGap: 24,
    languages: "bilingual",
  },
  managerCommentary: {
    heading: /^Commentary 評論$/,
    band: { minLeft: 50, maxLeft: 860 },
    // DIS 基金的十大持倉延伸到評論標題右邊，正文由標題下約 24 pt 先開始。
    minDepth: 15,
    // DIS 基金評論之後係法定的「重大差異理由」，唔屬評論。
    stopAt: /^(Reason\(s\) for Material Difference|年度回報與參考投資組合的重大差異理由)/,
    columns: [
      { minLeft: 50, maxLeft: 520 },
      { minLeft: 520, maxLeft: 860 },
    ],
    minFontSize: 7,
    maxGap: 24,
    languages: "bilingual",
  },
};

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

/**
 * BCT Industry Choice／Pro Choice 同一版面：左欄投資目標中英逐句交替（每行只有一種語文），
 * 右邊係投資組合分布（left≈361）；投資經理喺成份基金資料之下一格；市場評論左英（left≈30）
 * 右中（left≈366）兩欄並排，去到成份基金表現就停。
 */
const bctNarrative: FactSheetContract["narrative"] = {
  investmentObjective: {
    heading: /^(投資目標|Investment Objective)$/,
    band: { minLeft: 20, maxLeft: 357 },
    stopAt: /^(Constituent Fund Information|成份基金資料)/,
    minFontSize: 8,
    maxGap: 24,
    languages: "bilingual",
  },
  investmentManager: {
    heading: /^(投資經理|Investment Manager)$/,
    band: { minLeft: 20, maxLeft: 357 },
    maxDepth: 20,
    languages: "value",
  },
  managerCommentary: {
    heading: /^(市場評論|Market Commentary)$/,
    band: { minLeft: 20, maxLeft: 610 },
    columns: [
      { minLeft: 20, maxLeft: 360 },
      { minLeft: 360, maxLeft: 610 },
    ],
    stopAt: /^(成份基金表現|Constituent Fund Performance)/,
    minFontSize: 7,
    maxGap: 24,
    languages: "bilingual",
  },
};

/**
 * BCT Series 800：左欄「投資目標 Investment Objective」先中後英，右邊係表現表（left≥444）；
 * 基金資料表的投資經理標籤（left≈40）同經理名（left≈189）同一行開始；左下「基金評論」
 * 先中後英，右邊係投資分布，之下隔一格係頁尾客戶服務熱線。
 */
const series800Narrative: FactSheetContract["narrative"] = {
  investmentObjective: {
    heading: /^(投資目標|Investment Objective)$/,
    band: { minLeft: 35, maxLeft: 440 },
    stopAt: /^(基金資料|Fund Information)/,
    minFontSize: 9,
    maxGap: 24,
    languages: "bilingual",
  },
  investmentManager: {
    heading: /^(投資經理|Investment Manager)$/,
    band: { minLeft: 185, maxLeft: 440 },
    sameLine: true,
    maxDepth: 40,
    maxGap: 18,
    languages: "bilingual",
  },
  managerCommentary: {
    heading: /^(基金評論|Fund Commentary)$/,
    band: { minLeft: 35, maxLeft: 440 },
    // 債券基金評論下面緊接債券統計數字的註腳（「∞ 其他指…」「~ 加權平均信貸評級」
    // 「^ 當期收益率」「# 存續期」），行距同正文一樣，靠行首記號停。
    stopAt: /^[∞~^#]\s/,
    minFontSize: 9,
    maxGap: 16,
    languages: "bilingual",
  },
};

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

/**
 * BCT Simple／Smart（前信安版面）：右欄「Investment Objective 投資目標」先英後中，之下係
 * 「Balance of Investments 投資比重」（投資政策，唔屬目標）；投資經理喺左邊基金資料表，
 * 標籤（left≈43）同經理名（left≈183）同一行開始；左下「Fund Commentary 基金評論」先英後中，
 * 右邊係表現表（left≥347），之下係十大主要投資項目。
 */
const principalNarrative: FactSheetContract["narrative"] = {
  investmentObjective: {
    heading: /^(投資目標|Investment Objective)$/,
    // 右上角「Risk Level 風險程度」格由 left≈775 起，唔屬目標。
    band: { minLeft: 340, maxLeft: 770 },
    stopAt: /^(Balance of Investments|投資比重)/,
    minFontSize: 9,
    maxGap: 24,
    languages: "bilingual",
  },
  investmentManager: {
    // 恒指追蹤基金的標籤換行位置唔同，寫「Investment Manager of」。
    heading: /^Investment Manager( of)?$/,
    // 經理名欄由 left≈175 至 183 起（逐隻基金唔同）；標籤欄由 left≈43 起。
    band: { minLeft: 170, maxLeft: 340 },
    sameLine: true,
    // 恒指追蹤基金的經理名連「由 2022 年 9 月 19 日起」共六行；之後隔一大格先係成立日期。
    maxDepth: 70,
    maxGap: 18,
    minFontSize: 9,
    languages: "bilingual",
  },
  managerCommentary: {
    heading: /^(基金評論|Fund Commentary)$/,
    band: { minLeft: 30, maxLeft: 340 },
    minFontSize: 9,
    maxGap: 24,
    languages: "bilingual",
  },
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
 * 滙豐及恒生（同一受託人、同一版面）逐隻基金一頁：左欄「投資目標及其他詳情」先中文後英文，右欄「評論」先中文要點
 * 後英文要點。評論欄之下係基金表現表，表頭有幾欄落喺同一欄界，所以喺累積回報表頭停。
 * 註腳編號用 6 級字，正文 8 至 11 級（逐隻基金唔同）；環球股票基金評論欄之下仲有一個合併通告，
 * 部分落喺同一欄界，同評論隔咗一大段空白，靠 `maxGap` 排除。
 */
const hsbcNarrative: FactSheetContract["narrative"] = {
  investmentObjective: {
    heading: /^(投資目標及其他詳情|Investment objectives and other particulars)$/,
    band: { minLeft: 30, maxLeft: 400 },
    stopAt: /^(基金資料|Fund details)/,
    minFontSize: 7,
    maxGap: 24,
    languages: "bilingual",
  },
  managerCommentary: {
    heading: /^(評論|Commentary)$/,
    band: { minLeft: 590, maxLeft: 892 },
    stopAt: /Cumulative return|累\s*積\s*回\s*報/,
    minFontSize: 7,
    maxGap: 24,
    languages: "bilingual",
  },
};

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

const retireChoiceObjective = {
  band: { minLeft: 15, maxLeft: 440 },
  stopAt: /^(Fund Descriptor|基金類型)$/,
  minFontSize: 11,
  maxGap: 24,
} as const;
const retireChoiceComment = {
  band: { minLeft: 450, maxLeft: 900 },
  minFontSize: 11,
  maxGap: 24,
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
    narrative: {
      // 投資目標在左欄，右欄同一高度係資產分布；「-」分隔記號得 8 pt。
      investmentObjective: {
        heading: /^投資目標$/,
        band: { minLeft: 30, maxLeft: 295 },
        stopAt: /^(基金資料|\| FUND FACTS)/,
        minFontSize: 9,
        languages: "bilingual",
      },
      // 基金經理報告橫跨全頁，以「資料來源 Source」收尾。
      managerCommentary: {
        heading: /^基金經理報告$/,
        band: { minLeft: 30, maxLeft: 600 },
        stopAt: /^(資料來源|Source\b)/,
        maxGap: 24,
        languages: "bilingual",
      },
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
    fieldScopes: {
      // AIA prints this date on the Top Ten Holdings heading line; the document header date
      // alone is not treated as the holdings date.
      topHoldings: {
        kind: "point-in-time",
        pattern:
          /TOP TEN HOLDINGS#?.*?\bAs at\s+(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i,
        sourceLabel: "TOP TEN HOLDINGS",
      },
    },
  },
  {
    scheme: "AMTD MPF Scheme",
    title: {
      pattern: /Fund$/,
      fontSize: [15],
      fontFamily: /\+Arial$/,
    },
    narrative: {
      // 只有積金局副本。左欄投資目標（英文段、中文段），止於「Fund Performance
      // 基金表現」；右欄基金資料表的「Fund Manager 基金經理」值係管理公司（同一格
      // 中文值低 14 pt）；右欄下面基金評論（英文段、中文段），止於「Remarks 備註」。
      investmentObjective: {
        heading: /^Investment Objective$/,
        // 左邊界逐版漂移（11–21）。
        band: { minLeft: 5, maxLeft: 445 },
        stopAt: /^(Fund Performance|基金表現)/,
        minFontSize: 9.5,
        maxGap: 24,
        languages: "bilingual",
      },
      investmentManager: {
        heading: /^Fund Manager$/,
        band: { minLeft: 600, maxLeft: 900 },
        sameLine: true,
        maxDepth: 20,
        languages: "bilingual",
      },
      managerCommentary: {
        heading: /^Fund Commentary$/,
        band: { minLeft: 455, maxLeft: 900 },
        stopAt: /^(Remarks|備註)/,
        minFontSize: 9.5,
        maxGap: 30,
        languages: "bilingual",
      },
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
    narrative: {
      // 左欄（left≈50）由上而下：投資目標、評論；右欄係基金資料及表現。下一隻基金
      // 的中文名（15 pt）緊接評論之後，靠字級上限隔開。
      // 右欄標籤（「單位資產淨值」left≈381）同左欄標題同一高度，左欄要收窄到 375。
      investmentObjective: {
        heading: /^投資目標 Investment Objective$/,
        band: { minLeft: 40, maxLeft: 375 },
        minFontSize: 9,
        maxFontSize: 11,
        maxGap: 24,
        languages: "bilingual",
      },
      // 長評論用 8 pt，由左欄溢到右欄十大資產來源行之下（left≈389）。保守基金
      // 評論之後係收費扣除機制說明，唔屬評論。
      managerCommentary: {
        heading: /^評論 Commentary\*?$/,
        band: { minLeft: 40, maxLeft: 900 },
        columns: [
          { minLeft: 40, maxLeft: 375 },
          // 來源行可能同圓餅圖百分比併成一行（「19.0% Source: …」），唔可以錨定行首。
          // 溢出的評論行一律由右欄邊（left≈379–393，逐隻基金唔同）開始；圓餅圖
          // 標註唔係。
          {
            minLeft: 375,
            maxLeft: 900,
            after: /\bSource:/,
            lineStart: { minLeft: 375, maxLeft: 395 },
          },
        ],
        stopAt:
          /^(強積金保守基金收費扣除機制|MPF Conservative Fund Fee Deduction|重要 Important|#)/,
        maxFontSize: 11,
        maxGap: 24,
        languages: "bilingual",
      },
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
    narrative: bctNarrative,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BCT (MPF) Pro Choice",
    // 平台寫「BCT (Industry) …」「BCT (Pro) …」，便覽的標題冇呢個前綴。
    platformNamePrefix: /^BCT \((?:Industry|Pro)\)\s+/,
    title: bctTitle("#639e1d"),
    ...bctBlocks,
    narrative: bctNarrative,
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
    narrative: principalNarrative,
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
    narrative: principalNarrative,
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
    narrative: series800Narrative,
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
    // 右欄「投資目標」先中後英，之下係基金表現；左欄「基金評論」先中後英（中英之間隔一大段
    // 空白，約 34 pt），之下隔更大一段係「附註 Remarks」。
    narrative: {
      investmentObjective: {
        heading: /^(投資目標|Investment Objective)$/,
        band: { minLeft: 350, maxLeft: 860 },
        stopAt: /^(基金表現|Fund Performance)/,
        minFontSize: 10,
        maxGap: 24,
        languages: "bilingual",
      },
      managerCommentary: {
        heading: /^(基金評論|Fund Commentary)$/,
        band: { minLeft: 30, maxLeft: 345 },
        // 評論之後可能係「主要風險」、「重要提示」方框，或者預設投資策略基金按法例
        // 解釋同參考組合重大差異的粗體段（「++」記號只得 6 pt，被字級下限濾走，
        // 所以認段首句式）；三者都唔係評論。
        stopAt:
          /^(附註|Remarks|重要提示|Important Information|主要風險|Key Risks|截至\d{4}年\d{1,2}月底，基金的|As at end of \w+ \d{4}, the fund recorded)/,
        minFontSize: 10,
        maxGap: 45,
        languages: "bilingual",
      },
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
    narrative: beaNarrative,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BEA (MPF) Master Trust Scheme",
    title: beaTitle,
    ...beaBlocks,
    narrative: beaNarrative,
    asOf: { pattern: AS_OF_SLASH },
  },
  {
    scheme: "BEA (MPF) Value Scheme",
    title: beaTitle,
    ...beaBlocks,
    narrative: beaNarrative,
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
    narrative: {
      // 中銀保誠只披露「投資政策」（包括投資目標），冇基金經理評論；投資經理
      // 印在封面，屬計劃層面，唔逐隻基金記。註腳上標得 9 pt。
      investmentObjective: {
        heading: /^投資政策$/,
        // 行首的全形括號會凸出欄邊（left≈18），欄界要留位。每行一定由左邊
        // （left 18–40）開始；人民幣及港元貨幣市場基金的投資政策長，頁底改為中文
        // 左欄、英文右欄（left≈383）並排，逐行讀會中英交錯，所以見到右邊起行就
        // 成段報讀唔齊，唔出交錯的文字。
        band: { minLeft: 10, maxLeft: 420 },
        columns: [
          {
            minLeft: 10,
            maxLeft: 420,
            lineStart: { minLeft: 10, maxLeft: 45, otherwise: "fail" },
          },
        ],
        // 欄底可能緊接行業分類更新註腳及計劃說明書、投資風險聲明。
        stopAt:
          /^(\*|此成分基金之|計劃詳情|Please refer to the MPF Scheme Brochure|投資涉及風險|Investment involves risks)/,
        minFontSize: 12,
        maxGap: 30,
        languages: "bilingual",
      },
    },
    // 基金經理評論集中印喺尾段附錄（第 23 頁起「基金經理評論 MANAGER'S COMMENT」），
    // 每隻基金一個 20 pt 中英名稱小標題，下面 11 pt 中文段及英文段。
    narrativeAppendix: {
      field: "managerCommentary",
      pageHeading: /^基金經理評論$/,
      // 附錄最後一隻基金之後係「備註 Remarks」頁，唔係評論續頁。
      followedBy: /^(備註|Remarks)$/,
      subheadingFontSize: [20],
      band: { minLeft: 10, maxLeft: 880 },
      maxFontSize: 11,
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
    narrative: {
      // 只有投資目標，冇評論。左欄（left≈45）；右欄（left≥455，逐隻基金唔同）
      // 係資產分布及風險指標，同一高度。
      investmentObjective: {
        heading: /^Investment Objective$/,
        band: { minLeft: 40, maxLeft: 450 },
        stopAt: /^(Fund Expense Ratio|基金開支比率|Fund Performance|基金表現)/,
        minFontSize: 10,
        maxGap: 24,
        languages: "bilingual",
      },
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
    source: "mpfa-registry",
    ...fidelityBlocks,
    allocation: {
      ...fidelityBlocks.allocation,
      heading: FIDELITY_DIMENSION,
    },
    holdings: { ...fidelityBlocks.holdings, heading: /^Top 10 Holdings$/ },
  },
  {
    /**
     * 受託人官網逐隻成分基金一份便覽
     * （`fidelityinternational.com/legal/documents/HK-zh_en/hffs.HK-zh_en.HK.H-<代號>.pdf`）。
     *
     * 排版同積金局副本同一套（同一批字體級數、同樣三欄），只差係中英對照版：每個披露
     * 標題後面緊接中文譯名，併行之後變成「Top 10 Holdings 十大主要投資項目」，
     * 所以標題式樣唔可以用 `$` 收尾。中文譯名照樣由 `FIDELITY_DIMENSION_ZH` 對照，
     * 兩個來源出返同一套標籤。
     */
    scheme: "Fidelity Retirement Master Trust",
    source: "trustee",
    ...fidelityBlocks,
    narrative: {
      // 逐隻基金一份便覽，左欄（left≈43，11 pt）由上而下：基金概要（英文段、
      // 中文段）、基金資料、基金評論（英文段、中文段）。頁腳 9 pt。「基金經理」
      // 一欄係個人名，唔係投資經理公司，唔當 `investmentManager`。
      investmentObjective: {
        heading: /^About the Fund$/,
        band: { minLeft: 30, maxLeft: 355 },
        stopAt: /^(基金資料|Fund Details)/,
        minFontSize: 10,
        maxGap: 24,
        languages: "bilingual",
      },
      // 評論長的基金（人民幣債券基金）縮到 9 pt，同頁腳一樣，所以靠頁腳的
      // 風險聲明停，唔靠字級。
      managerCommentary: {
        heading: /^Fund Commentary$/,
        band: { minLeft: 30, maxLeft: 355 },
        stopAt: /^(Investment involves risks|投 ?資 ?涉 ?及 ?風 ?險)/,
        minFontSize: 9,
        maxGap: 24,
        languages: "bilingual",
      },
    },
    fieldScopes: {
      fer: {
        kind: "financial-period",
        pattern: /Year\s+(\d{4})\s+Fund Expense Ratio/i,
        sourceLabel: "Fund Expense Ratio",
        labelFromCapture: (year) => `Year ${year}`,
      },
      riskIndicator: {
        kind: "lookback-period",
        fieldLabel: /Fund Risk Indicator/i,
        evidencePattern:
          /Fund Risk Indicator[\s\S]*?over the past 3 years to the reporting date/i,
        months: 36,
        endingAt: "document-date",
        method: "annualised standard deviation of monthly returns",
      },
      commentary: {
        kind: "point-in-time",
        pattern: /\^\s*as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        fieldLabel: /Fund Commentary\s*\^/i,
        sourceLabel: "Fund Commentary^",
      },
    },
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
    // 首兩頁嘅基金經理評論係計劃整體嘅市場評論，唔屬任何一隻基金。標題「基金經理評論
    // MANAGER’S REPORT」喺文字層，但畫面被重要事項框遮住，所以正文唔靠標題定位：
    // 第一頁由重要事項最後一句之下、第二頁由頁首受託人名之下讀起，讀到頁尾
    // 「Fund Manager and Issuer」。註腳（§）同頁碼係 10 號字，正文 12 號。
    schemeNarrative: {
      field: "managerCommentary",
      heading: [/^基金經理評論$/, /^MANAGER[’']S REPORT$/],
      startAfter:
        /閣下的投資或會承受重大損失。$|^Haitong International Investment Managers Limited 海通國際投資經理有限公司$/,
      stopAt: /^Fund Manager and Issuer:/,
      band: { minLeft: 0, maxLeft: 900 },
      minFontSize: 12,
      maxFontSize: 12,
      // 正常行距 14.6 pt，段距 17–20 pt；1.12 倍即 16.4 pt，兩邊各留一 pt 有多。
      paragraphGap: 1.12,
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
    narrative: hsbcNarrative,
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
    narrative: hsbcNarrative,
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
    narrative: {
      // 投資目標在左欄（left 30–260），右邊同一高度係投資組合分布。冇基金經理評論。
      // 目標長的基金（2045 退休基金）下面緊接表現表，靠標題停。
      investmentObjective: {
        heading: /^投資目標$/,
        band: { minLeft: 20, maxLeft: 265 },
        stopAt: /^(累積回報|Cumulative Return)/,
        minFontSize: 10,
        maxGap: 30,
        languages: "bilingual",
      },
      // 基金資料表：標籤「投資經理 Investment Manager」在 left 349–363，數值在
      // left 426–580（逐隻基金唔同），垂直置中對住標籤：一行長的中文值比標籤高
      // 1–3 pt，兩行長的（「宏利投資管理（香港）有限公司投資於由富達基金……管理之
      // 基金」）第一行高 17 pt。上一格基金類型描述的英文值最低落到標籤上 17 pt，
      // 所以由第一行中文開始讀。
      investmentManager: {
        heading: /^投資經理$/,
        band: { minLeft: 420, maxLeft: 900 },
        minDepth: -20,
        maxDepth: 30,
        startAt: /\p{Script=Han}/u,
        maxGap: 18,
        languages: "bilingual",
      },
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
      // 條形圖係嵌入圖像，位置逐隻基金左右浮動（旁邊仲有投資目標、十大資產），所以
      // 按圖像位置裁。圖例右對齊喺軸線左邊，數值跟喺條尾（逐行浮動），數值欄由軸線右邊
      // 開始。兩行長的圖例（「生活消費品 Consumer / Discretionary」）數值印喺兩行之間，
      // 換行接上一行。
      chartRead: {
        region: { minLeft: 250, maxLeft: 600, top: 0, bottom: 330 },
        cropToImage: { pad: 2 },
        valuesLeft: "axis",
        wrap: "nearest",
        stopAt: /^(累積回報|Cumulative Return)/,
        sumTolerance: 0.5,
        // 2026-06-30 便覽 29 幅條形圖逐幅對圖抄錄。同一英文、唔同中文的照各自原文分開列
        // （「生活消費品」對「非必需消費」都係 Consumer Discretionary；「現金及其他 Cash」）。
        vocabulary: chartLabels([
          ["藥物製造", "Pharmaceuticals"],
          ["醫療設備", "Medical Equipment"],
          ["生物科技", "Biotechnology"],
          ["康健護理管理服務", "Healthcare Mgt. Services"],
          ["藥物零售商", "Drug Retailers"],
          ["醫療供應", "Medical Supplies"],
          ["其他", "Others"],
          ["現金", "Cash"],
          ["現金及其他", "Cash"],
          ["現金及其他", "Cash and Others"],
          ["現金及存款", "Cash & Deposits"],
          ["中國", "China"],
          ["韓國", "Korea"],
          ["台灣", "Taiwan"],
          ["印度", "India"],
          ["澳洲", "Australia"],
          ["香港", "Hong Kong"],
          ["新加坡", "Singapore"],
          ["印尼", "Indonesia"],
          ["馬來西亞", "Malaysia"],
          ["德國", "Germany"],
          ["英國", "United Kingdom"],
          ["法國", "France"],
          ["荷蘭", "Netherlands"],
          ["瑞士", "Switzerland"],
          ["瑞典", "Sweden"],
          ["丹麥", "Denmark"],
          ["意大利", "Italy"],
          ["愛爾蘭", "Ireland"],
          ["科技", "Technology"],
          ["資訊科技", "Information Technology"],
          ["金融", "Financials"],
          ["生活消費品", "Consumer Discretionary"],
          ["非必需消費", "Consumer Discretionary"],
          ["生活必需品", "Consumer Staples"],
          ["必需消費", "Consumer Staples"],
          ["工業", "Industrials"],
          ["原材料", "Basic Materials"],
          ["物料", "Materials"],
          ["電訊", "Telecommunications"],
          ["電訊", "Communication Services"],
          ["醫療保健", "Healthcare"],
          ["能源", "Energy"],
          ["地產", "Real Estate"],
          ["房地產", "Real Estate"],
          ["公用事業", "Utilities"],
          ["北美洲股票", "North American Equities"],
          ["美洲股票", "American Equities"],
          ["歐洲股票", "European Equities"],
          ["其他亞太股票", "Other Asia Pacific Equities"],
          ["日本股票", "Japan Equities"],
          ["日本股票", "Japanese Equities"],
          ["香港股票", "Hong Kong Equities"],
          ["中國在岸股票", "China Onshore Equities"],
          ["其他股票", "Other Equities"],
          ["環球股票", "Global Equity"],
          ["環球債券", "Global Bond"],
          ["債券", "Bonds"],
          ["國際債券", "International Bonds"],
          ["港元債券", "HKD Bonds"],
          ["美元債券", "USD Bonds"],
          ["人民幣債券", "RMB Bonds"],
          ["印度債券", "INR Bonds"],
          ["澳元債券", "AUD Bonds"],
          ["馬幣債券", "MYR Bonds"],
          ["菲律賓債券", "PHP Bonds"],
          ["歐元債券", "EUR Bonds"],
          ["日圓債券", "JPY Bonds"],
          ["英鎊債券", "GBP Bonds"],
          ["加元債券", "CAD Bonds"],
        ]),
      },
    },
    holdings: {
      heading: /^Top 10 Portfolio Holdings$/,
      // 標題的 left 逐隻基金浮動（589–616）；官方持倉名稱由 x=538 開始，欄界不可裁掉名稱。
      band: { minLeft: 530, maxLeft: 900 },
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
    narrative: {
      // 每隻基金英文版一頁、中文版下一頁，版面相同：投資目標在左欄（12 pt），
      // 基金經理評論在右欄（left≈459）。兩頁分開讀再合併。
      investmentObjective: [
        { heading: /^Investment Objective$/, languages: "en", ...retireChoiceObjective },
        { heading: /^投資目標$/, languages: "zh", ...retireChoiceObjective },
      ],
      managerCommentary: [
        { heading: /^Manager's Comments?$/, languages: "en", ...retireChoiceComment },
        { heading: /^基金經理評論$/, languages: "zh", ...retireChoiceComment },
      ],
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
    // 受託人版只有英文。投資目標及投資經理印喺第一頁，基金標題同「Fund Review」
    // 喺第二頁，一份檔一隻基金，所以文字欄位喺成份檔搵。
    narrativeScope: "document",
    narrative: {
      investmentObjective: {
        heading: /^Investment Objective$/,
        band: { minLeft: 20, maxLeft: 900 },
        stopAt: /^Fund Data/,
        maxGap: 24,
        languages: "en",
      },
      // 左欄基金資料：「Investment Manager:」下面一至兩行，右邊同一高度係價格表。
      investmentManager: {
        heading: /^Investment Manager:$/,
        band: { minLeft: 20, maxLeft: 220 },
        maxDepth: 40,
        maxGap: 18,
        languages: "en",
      },
      managerCommentary: {
        heading: /^Fund Review$/,
        band: { minLeft: 20, maxLeft: 900 },
        stopAt: /^(Fund Performance|[#^]\s)/,
        maxGap: 30,
        languages: "en",
      },
    },
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
    narrative: {
      // 投資目標在左欄（中文段後接英文段），止於「基金資料 FUND DATA」。
      investmentObjective: {
        heading: /^投資目標$/,
        band: { minLeft: 15, maxLeft: 590 },
        stopAt: /^(基金資料|FUND DATA)/,
        // 追蹤指數基金的投資目標用 9 pt；註腳記號「(9)」得 5 pt。
        minFontSize: 8,
        maxGap: 30,
        languages: "bilingual",
      },
      // 市場評論在右欄（left≈607）。有啲基金中英同一頁，有啲中文一頁、英文
      // 「(cont'd)」下一頁，兩頁標題一樣，所以每頁都讀。段落之間空 33 pt；頁腳的
      // 計劃說明書提示（11 pt）遠在 300 pt 以下。投資經理的標籤逐隻基金唔同
      // （「基礎核准匯集投資基金的投資經理」、「成分基金及核准緊貼指數集體投資計劃
      // 的投資經理」，有時拆兩行），暫不抽。
      managerCommentary: {
        heading: /^市場評論$/,
        occurrence: "all",
        band: { minLeft: 600, maxLeft: 900 },
        // 評論逐隻基金用 11 或 12 pt。
        minFontSize: 10,
        maxGap: 40,
        languages: "bilingual",
      },
    },
    allocation: {
      // 圓餅圖的標註散落在 left 22–484，標題自己在 165，自動推欄界會切走最左的標註；
      // 右界 560 是為了把 left≈607 的市場評論隔開。
      heading: /^ASSET ALLOCATION BY/,
      headingLabel: (text) => text,
      band: { minLeft: 15, maxLeft: 560 },
      unextractable:
        "disclosed as scattered pie-chart callouts: several slices share a baseline and some percentages sit apart from their label, so rows cannot be paired",
      // 標註本身係文字，只係圓餅圖左右兩邊同一條基線、配對唔到。改由 RapidOCR 按
      // 圖像分行（左右兩邊之間隔住圓餅圖，空隙遠大過 40），再用文字層逐行核對。
      // 註腳記號「(7)」係 5 號字，唔讀。右界 595 避開 left≈607 的市場評論。
      chartRead: {
        region: { minLeft: 15, maxLeft: 595, top: 15, bottom: 260 },
        stopAt: /^(十大資產項目|TOP TEN HOLDINGS)$/,
        splitGap: 40,
        // 長標註中文一行、英文同數值下一行，數值行最近嗰行就係佢的圖例。
        wrap: "nearest",
        secondRead: "text-layer",
        textLayerMinFontSize: 7,
        sumTolerance: 0.5,
        // 2026-06-30 便覽 17 幅圓環圖逐幅對圖抄錄；註腳「(7)」唔計。英文大細楷及空格
        // 逐隻基金唔同（「Health Care」對「Healthcare」、「Europe EX UK」），照原文分開列。
        vocabulary: chartLabels([
          ["現金及其他", "Cash & Others"],
          ["基本物料", "Basic Materials"],
          ["原材料", "Materials"],
          ["電訊", "Telecommunications"],
          ["公用", "Utilities"],
          ["健康護理", "Health Care"],
          ["健康護理", "Healthcare"],
          ["能源", "Energy"],
          ["房地產", "Real Estate"],
          ["地產建築", "Properties & Construction"],
          ["生活必需品", "Consumer Staples"],
          ["非必需消費品", "Consumer Discretionary"],
          ["工業", "Industrials"],
          ["科技", "Technology"],
          ["資訊科技", "Information Technology"],
          ["金融", "Financials"],
          ["綜合企業", "Conglomerates"],
          ["其他行業", "Other Industries"],
          ["其他國家", "Other Countries"],
          ["美國", "United States"],
          ["加拿大", "Canada"],
          ["瑞典", "Sweden"],
          ["英國", "United Kingdom"],
          ["德國", "Germany"],
          ["意大利", "Italy"],
          ["波蘭", "Poland"],
          ["墨西哥", "Mexico"],
          ["日本", "Japan"],
          ["中國", "China"],
          ["香港", "Hong Kong"],
          ["香港 / 中國", "Hong Kong / China"],
          ["印度", "India"],
          ["澳洲", "Australia"],
          ["台灣", "Taiwan"],
          ["南韓", "South Korea"],
          ["韓國", "Korea"],
          ["新加坡", "Singapore"],
          ["馬來西亞", "Malaysia"],
          ["北美洲", "North America"],
          ["歐洲不包括英國", "Europe EX UK"],
          ["亞洲不包括日本", "Asia Pacific EX Japan"],
          ["北美股票", "North America Equities"],
          ["歐洲股票", "Europe Equities"],
          ["歐洲不包括英國股票", "Europe ex UK Equities"],
          ["英國股票", "United Kingdom Equities"],
          ["日本股票", "Japan Equities"],
          ["香港股票", "Hong Kong Equities"],
          ["中國股票", "China Equities"],
          ["香港 / 中國股票", "Hong Kong / China Equities"],
          ["亞太股票", "Asia Pacific Equities"],
          ["亞洲不包括日本股票", "Asia Pacific ex Japan Equities"],
          ["其他股票", "Other Equities"],
          ["債券", "Bonds"],
          ["美元債券", "USD Bonds"],
          ["港元債券", "HKD Bonds"],
          ["國際貨幣債券 (除美元及港元)", "Global Currencies Bonds ex USD ex HKD"],
          ["政府定息債券", "Government Fixed Rate Bond"],
          ["政策性銀行定息債券", "Policy Bank Fixed Rate Bond"],
          ["港元定息債券", "Fixed Income - HKD"],
          ["人民幣定息債券", "Fixed Income - CNH"],
          ["港元定息存款", "Fixed Deposits - HKD"],
          ["人民幣定息存款", "Fixed Deposits - CNH"],
          ["貨幣市場工具", "Money Market Instruments"],
          ["存款", "Deposits"],
        ]),
      },
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
    narrative: {
      // 「Fund Objective 基金投資目標」標題置中，下面英文一段、中文一段，全頁闊。
      investmentObjective: {
        heading: /^基金投資目標$/,
        band: { minLeft: 30, maxLeft: 900 },
        minFontSize: 11,
        maxGap: 20,
        languages: "bilingual",
      },
      // 第二頁「評論：市場回顧，市場展望及基金表現」：英文「Market Review and
      // Outlook」一段，緊接中文「市場回顧及展望」一段，再之後係資料來源、免責聲明
      // 及備註。中英同頁連續，一個讀取器讀晒，中間的中文標題略過。
      managerCommentary: {
        heading: /^Market Review and Outlook$/,
        band: { minLeft: 30, maxLeft: 900 },
        // 結束標記係計劃來源行「^Sources: …」（複數；評論內文引用的「Source:
        // Bloomberg」係單數）、免責聲明或「備註 Notes」（安聯精選均衡基金冇來源行）。
        // 同一頁見唔到就係評論續落下一頁（宏利保證基金），成段當讀唔齊。
        endAt: /^(\^?\s*Sources\s*:|Any view or comment|在「評論|Notes\b|備註)/,
        ignore: /^市場回顧及展望$/,
        minFontSize: 10,
        languages: "bilingual",
      },
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
    // 疊上去嗰版會喺自己標題之前已經開始落筆，配置、持倉同文字欄位都改用每版最後落筆的
    // 「Manager’s Commentary」標題分層（見 `layerEnd`）。
    layerEnd: /^Manager[’']s Commentary$/,
    narrative: {
      // 右上角「市場預測 Market Forecast」，值只有英文一個字（Positive／Neutral／
      // Negative），喺標題右邊，比中文標題低 11–19 pt；標題旁的「1」係註腳記號。
      // 混合資產及保守類基金印「^^ N/A ^^」（「^^」係註腳記號），即係官方冇預測。
      marketForecast: {
        heading: /^市場預測$/,
        band: { minLeft: 760, maxLeft: 900 },
        minDepth: -6,
        maxDepth: 22,
        ignore: /^\^+$/,
        unavailableValue: /^N\/A(\s*\^+)?$/,
        languages: "en",
      },
      // 右欄投資目標（中文段、英文段），止於「基金表現 Fund Performance」；標題旁
      // 「▲」係 8 pt 記號。
      investmentObjective: {
        heading: /^投資目標$/,
        band: { minLeft: 465, maxLeft: 900 },
        stopAt: /^(基金表現|Fund Performance)/,
        // 正文 9–11 pt；收益基金最後一行同 14 pt「基金表現」標題只差 3 pt，會併成一行，
        // 所以用字級上限隔開標題。
        minFontSize: 9,
        maxFontSize: 12,
        maxGap: 24,
        languages: "bilingual",
      },
      // 左欄基本資料表：值喺標籤右邊，中文值比標籤低約 5 pt，英文再低 14 pt。
      investmentManager: {
        heading: /^投資經理$/,
        band: { minLeft: 190, maxLeft: 440 },
        minDepth: -6,
        maxDepth: 25,
        maxGap: 18,
        languages: "bilingual",
      },
      // 左欄下半「基金經理評論 Manager's Commentary」，頁腳 9 pt 委任說明遠在下面。
      managerCommentary: {
        heading: /^基金經理評論$/,
        band: { minLeft: 35, maxLeft: 445 },
        minFontSize: 10,
        maxGap: 30,
        languages: "bilingual",
      },
    },
    allocation: {
      heading: /^Portfolio Allocation$/,
      headingLabel: () => "Portfolio Allocation 投資組合分佈",
      // 圓環圖的圖例（「現金及存款 Cash & Deposit 83.2%」）連同百分比全部畫成向量，
      // 文字層一個字都冇。不設這個聲明的話，會由頁面其他地方讀到不相干的百分比。
      unextractable:
        "the donut chart's legend and percentages are drawn as vector art, not text",
      // 圖例（左）同百分比（右，left≈700）喺標題之下，圓環圖喺 left 720 之後，唔讀。
      chartRead: {
        region: { minLeft: 466, maxLeft: 718, top: 14, bottom: 260 },
        valuesLeft: 650,
        stopAt: /^(十大主要證券|Top 10 Holdings)$/,
        sumTolerance: 0.5,
        // 2026-06-30 受託人版 18 頁圖例逐張對圖抄錄（註腳「^」唔計）。同一計劃唔同基金
        // 用字唔同（「Hong Kong Equities」對「Hong Kong equities」、「非必需消費品」對
        // 「非必需性消費」），照各自原文分開列。
        vocabulary: chartLabels([
          ["現金及存款", "Cash & Deposit"],
          ["貨幣市場工具", "Money Market Instruments"],
          ["港元債券", "HKD Bonds"],
          ["美元債券", "USD Bonds"],
          ["美元債券", "USD Bond"],
          ["現金及其他", "Cash and Others"],
          ["貨幣市場工具 (港元)", "Money Market Instruments (HKD)"],
          ["貨幣市場工具 (人民幣)", "Money Market Instruments (RMB)"],
          ["債券 (人民幣)", "Bond (RMB)"],
          ["債券 (港元)", "Bond (HKD)"],
          ["現金及存款 (人民幣)", "Cash & Deposit (RMB)"],
          ["現金及存款 (港元)", "Cash & Deposit (HKD)"],
          ["亞洲債券", "Asian Bonds"],
          ["日本債券", "Japanese Bonds"],
          ["歐洲債券", "European Bonds"],
          ["其他債券", "Other Bonds"],
          ["環球債券", "Global Bonds"],
          ["環球股票", "Global Equities"],
          ["亞洲股票", "Asian Equities"],
          ["香港股票", "Hong Kong Equities"],
          ["香港股票", "Hong Kong equities"],
          ["其他股票", "Other Equities"],
          ["其他股票", "Others equities"],
          ["美國股票", "US equities"],
          ["歐洲股票", "Europe equities"],
          ["日本股票", "Japan equities"],
          ["亞洲(不包括香港及日本)股票", "Asia ex HK ex Japan equities"],
          ["國際貨幣(除美元及港元)債券", "Global Currencies ex USD ex HKD Bond"],
          ["現金或現金等值", "Cash and cash equivalent"],
          ["現金及現金等價物", "Cash & Cash Equivalent"],
          ["資訊科技", "Information Technology"],
          ["金融", "Financials"],
          ["消費", "Consumer"],
          ["健康護理", "Health Care"],
          ["通信服務", "Communication Services"],
          ["工業", "Industrials"],
          ["原材料", "Materials"],
          ["原材料", "Basic Materials"],
          ["公用事業", "Utilities"],
          ["能源", "Energy"],
          ["主要消費品", "Consumer Staples"],
          ["必需性消費", "Consumer Staples"],
          ["非必需消費品", "Consumer Discretionary"],
          ["非必需性消費", "Consumer Discretionary"],
          ["房地產", "Real Estate"],
          ["南韓", "South Korea"],
          ["台灣", "Taiwan"],
          ["香港 / 中國", "Hong Kong / China"],
          ["印度", "India"],
          ["澳洲", "Australia"],
          ["新加坡", "Singapore"],
          ["泰國", "Thailand"],
        ]),
      },
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
