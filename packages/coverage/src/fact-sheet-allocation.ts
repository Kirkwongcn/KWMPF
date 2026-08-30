import {
  documentOrder,
  joinItems,
  toLines,
  type PdfLine,
  type PdfPage,
  type PdfTextItem,
} from "./pdf-xml";

/**
 * 由計劃便覽抽取「配置」及「十大持倉」。
 *
 * 兩條不可繞過的規則：
 *
 * - **原文照錄**。各受託人披露的配置維度根本不同（東亞 3 個資產桶、BCT 13 個行業桶、
 *   滙豐資產 × 地區合併桶），本模組不做任何正規化或映射，標籤及維度標題一律保留原文。
 *   跨計劃比較另議。
 * - **配對不到就報錯**。抽不到的基金走 `unavailableFields`，不推算、不留白，
 *   亦不可靜默略過。
 */

export type FactSheetSource = "trustee" | "mpfa-registry";

export type AllocationEntry = { label: string; percent: number };

/** 一個披露維度。`heading` 是便覽自己用的標題原文，不是我們改寫的維度名。 */
export type AllocationDimension = { heading: string; entries: AllocationEntry[] };

export type TopHolding = { rank: number; security: string; percent?: number };

export type FactSheetDisclosure = {
  schemeName: string;
  constituentFundName: string;
  fundClassName?: string;
  factSheetAsOf: string;
  allocations: AllocationDimension[];
  topHoldings: TopHolding[];
  unavailableFields: string[];
  /** 走 `unavailableFields` 的原因，逐項寫明，供配對報告逐份列出。 */
  unavailableReasons: Record<string, string>;
};

export type TitleSelector = {
  pattern: RegExp;
  fontSize?: number[];
  fontFamily?: RegExp;
  fontColor?: string[];
  minLeft?: number;
  maxLeft?: number;
  maxTop?: number;
  /** 同一版重覆出現標題時只取最上面一個（例如被水印或隱藏文字重覆）。 */
  onePerPage?: boolean;
  /** 便覽的中文版重覆同一批基金時，只保留第一次出現的區段。 */
  dedupeByName?: boolean;
  /** 由標題原文取成分基金名稱（例如去掉項目符號或計劃前綴）。 */
  name?: (text: string, item: PdfTextItem) => string;
  /** 由標題原文取基金類別（例如永明的 `– Class B`）。 */
  className?: (text: string, item: PdfTextItem) => string | undefined;
};

export type BlockSelector = {
  heading: RegExp;
  /**
   * 標題的字級。便覽後面的附錄有時把同一批表縮細再印一次（富達用 4 級字），
   * 最後一個區段一直讀到文件結尾就會連附錄一齊讀。
   */
  headingFontSize?: number[];
  /**
   * 版面上有呢一塊，但抽唔到成一張表。兩種情況：披露係圓餅圖旁邊的散落標註
   * （同一條水平線上的幾個百分比分屬唔同扇形，逐行讀必然配錯對），或者標籤畫成
   * 向量而唔係文字。設咗就一律走 `unavailableFields` 並附上原因，唔出局部資料。
   */
  unextractable?: string;
  /** 由標題原文取維度標題；預設照錄整段標題文字。 */
  headingLabel?: (text: string) => string;
  /** 自動推欄界時，向左預留的容差。 */
  leftSlack?: number;
  /**
   * 欄闊。自動推欄界只識向右數到下一個更右的標題；同一行冇另一個標題時
   * （富達的「行業投資分佈」右邊係註腳而不是另一塊披露），就要靠欄闊收窄。
   */
  columnWidth?: number;
  /** 明確欄界，覆蓋自動推斷。 */
  band?: { minLeft: number; maxLeft: number };
  /** 由標題往下最多幾多 pt；預設到區段結尾。 */
  maxDepth?: number;
  /** 讀到符合這個式樣的行就停（例如註腳）。 */
  stopAt?: RegExp;
  /** 略過符合這個式樣的行。 */
  ignore?: RegExp;
  /**
   * 同一行有多過一個數值就當成疊印，整塊走 `unavailableFields`。永明那份便覽的
   * 文字層把另一隻基金的同一張表疊印在同一個位置（只差兩至七 pt，印出嚟只見到一份），
   * 分唔清邊個數值屬邊隻基金；靠左界猜就有機會出錯配對，所以寧可明講抽唔到。
   */
  rejectOverlaidRows?: boolean;
  /**
   * 圓餅圖旁邊的置中標註。呢類版面唔可以逐行讀：幾個扇形的百分比會落在同一條基線上
   * （中銀保誠的 `4.4%` 同 `2.1%` 都在 top 745），併行就會配錯對。但每個標註的中文名、
   * 英文名同百分比係**置中對齊**的，中心 x 完全一致，按中心分組就配得準。
   */
  callouts?: {
    centreTolerance?: number;
    maxGap?: number;
    /**
     * 按水平範圍相交分組，而唔係按中心。MASS 的餅圖標註在餅左邊靠右對齊、
     * 在餅右邊靠左對齊，中心對唔上；但標籤同佢自己個百分比一定橫向相交。
     */
    overlap?: boolean;
  };
  /** 部分計劃的數字不帶 `%`（標題已寫 `(%)`）。 */
  numberFormat?: "percent" | "bare";
  /** 數值欄的左界，用來把腳註編號、圖表刻度等雜訊排除在數值之外。 */
  valueMinLeft?: number;
  valueMaxLeft?: number;
  /** 名稱欄的右界，用來把同一行的其他欄（例如宏利的「國家／地區」欄）排除在名稱之外。 */
  labelMaxLeft?: number;
  /** 由名稱剔除的段落，例如圓餅圖的色塊字符。剔除的是圖例符號，不是原文用字。 */
  labelIgnore?: RegExp;
  /**
   * 由名稱剔除的腳註標記。版面上它是名稱左邊的邊注，但 `pdftohtml` 有時把它同名稱
   * 併成同一段文字（新地一份便覽寫成 `4 Hong Kong/China Equities`），`labelIgnore`
   * 剔不走。剔的是標記本身，不是原文用字。
   */
  labelStrip?: RegExp;
  /**
   * 中英對照標籤的分欄間距。標籤換行時逐行讀會把兩種語文交錯（新地的
   * 「亞太區股票(日 Japan/HK) 本、香港除外)」）。設咗就按水平空隙分欄——空隙大過
   * 這個值就當成另一欄——先逐欄由上至下併，再由左至右接駁，還原成「英文 中文」。
   * 欄界由版面自己決定，唔使逐頁寫死座標。
   */
  labelColumnGap?: number;
  /**
   * 同一列的文字被拆成多行時（名稱換行，而數值垂直置中落在中間那行），
   * 相鄰行的 `top` 距離會明顯細過列距。細過這個值就當成同一列先合併再讀數。
   */
  rowGap?: number;
  /** 名稱換行時，把上一行沒有數值的文字併入下一行的名稱。 */
  joinWrappedLabels?: boolean;
  /**
   * 數值在名稱之前的版面（例如滙豐把百分比排在標籤左邊），名稱換行會落在
   * 數值那行之後。這個選項把後續沒有數值的行併回上一項的名稱。
   */
  joinTrailingLabels?: boolean;
  /** 表格跨頁時是否續讀下一頁的同一欄。 */
  continueOnNextPage?: boolean;
};

export type FactSheetContract = {
  scheme: string;
  /**
   * 平台的成分基金名稱前綴，而便覽的標題冇（BCT 平台寫「BCT (Pro) Asian Equity Fund」，
   * 便覽寫「Asian Equity Fund」）。配對時由平台那邊剝走。這是逐個計劃訂明的固定前綴，
   * 唔係模糊比對。
   */
  platformNamePrefix?: RegExp;
  title: TitleSelector;
  allocation: BlockSelector;
  holdings: BlockSelector;
  /** 便覽自己的截至日期。抽不到就報錯，不可用平台日期補位。 */
  asOf: {
    pattern: RegExp;
    maxPage?: number;
    /** 同一份便覽有多個日期時（例如中國人壽的基準說明），取最新一個。 */
    pick?: "first" | "latest";
  };
};

export type FactSheetSection = {
  name: string;
  className?: string;
  start: { page: number; top: number };
  end: { page: number; top: number };
};

const PERCENT_ITEM = /^\(?([+-]?\d+(?:\.\d+)?)\s*%\)?$/;
const BARE_NUMBER_ITEM = /^\(?([+-]?\d+(?:\.\d+)?)\)?$/;
const PERCENT_TRAILING = /^(.*?)[\s.·]*([+-]?\d+(?:\.\d+)?)\s*%$/;
const BARE_TRAILING = /^(.*?\S)[\s.·]+([+-]?\d+\.\d+)$/;
// 名次可以係「1.」「1、」或者淨係「1 」。要求數字後面有分隔或空白，
// 否則會把「3M Co」的 3 當成名次。
const RANK_PREFIX = /^(\d{1,2})(?:\s*[.、)．]\s*|\s+)/;
// 中日韓文字、中文標點、全形字符，加上便覽當全形斜線用的 `╱`。
const CJK = /[╱╲　-〿㐀-鿿豈-﫿＀-￯]/;

/**
 * 接駁跨行的名稱。中文標籤換行時原文並沒有空格（「亞太股票（中國內地╱香港╱」＋
 * 「日本除外）」），加空格等於改寫原文。但中英對照的標籤（「北美股票」＋
 * 「North America Equities」）之間本來就有空隙，所以要兩邊都是中文字才省去空格。
 */
function joinLabel(left: string, right: string) {
  if (left === "") return right.trim();
  if (right === "") return left.trim();
  const separator =
    CJK.test(left.at(-1) ?? "") && CJK.test(right[0] ?? "") ? "" : " ";
  return `${left}${separator}${right}`.trim();
}

/**
 * 同一視覺行的容差。中英對照的標籤各用一款字體，基線會差一兩 pt
 * （新地的「香港」在 top 232、中間的「/」在 top 231）。
 */
const SAME_ROW = 4;

/**
 * 把一列的文字段落排成閱讀次序：先分行，再行內由左至右。
 *
 * 淨係按 `top` 排會出事：同一視覺行的段落 `top` 差一兩 pt，於是新地那個夾在
 * 「香港」與「中國股票」之間的「/」會排到成行之前，變成
 * `/Hong Kong/China Equities 香港 中國股票`，等於改寫原文。
 */
function inReadingOrder(items: PdfTextItem[]) {
  const rows: PdfTextItem[][] = [];
  for (const item of items.toSorted((a, b) => a.top - b.top)) {
    const row = rows.at(-1);
    if (row?.[0] && Math.abs(item.top - row[0].top) <= SAME_ROW) row.push(item);
    else rows.push([item]);
  }
  return rows.flatMap((row) => row.toSorted((a, b) => a.left - b.left));
}

/**
 * 由同一列的文字段落砌出名稱。同一行的用水平空隙決定要唔要空格（中銀保誠會把
 * 一個數字拆成幾段）；跨行的用 `joinLabel`（換行的中文標籤唔應該加空格）。
 */
function joinLabelItems(items: PdfTextItem[]) {
  let text = "";
  let previous: PdfTextItem | undefined;
  for (const item of items) {
    if (previous === undefined) text = item.text;
    else if (Math.abs(item.top - previous.top) <= SAME_ROW) {
      text += item.left - (previous.left + previous.width) > 1 ? ` ${item.text}` : item.text;
    } else text = joinLabel(text, item.text);
    previous = item;
  }
  return text.trim();
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** 便覽的日期寫法各家不同，統一成 `YYYY-MM-DD`；認不出就報錯。 */
export function parseFactSheetDate(value: string): string {
  const trimmed = value.trim();

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash?.[1] && slash[2] && slash[3]) {
    return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso?.[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const chinese = trimmed.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (chinese?.[1] && chinese[2] && chinese[3]) {
    return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  }

  const dayFirst = trimmed.match(/^(\d{1,2})[\s-]*([A-Za-z]{3,})[\s-]*,?\s*(\d{4})$/);
  if (dayFirst?.[1] && dayFirst[2] && dayFirst[3]) {
    const month = MONTHS[dayFirst[2].slice(0, 3).toLowerCase()];
    if (month) return `${dayFirst[3]}-${month}-${dayFirst[1].padStart(2, "0")}`;
  }

  const monthFirst = trimmed.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s*(\d{4})$/);
  if (monthFirst?.[1] && monthFirst[2] && monthFirst[3]) {
    const month = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    if (month) return `${monthFirst[3]}-${month}-${monthFirst[2].padStart(2, "0")}`;
  }

  throw new Error(`Unreadable fact sheet date: ${value}`);
}

function matchesTitle(item: PdfTextItem, selector: TitleSelector) {
  if (!selector.pattern.test(item.text)) return false;
  if (selector.fontSize && !selector.fontSize.includes(item.fontSize)) return false;
  if (selector.fontFamily && !selector.fontFamily.test(item.fontFamily)) return false;
  if (selector.fontColor && !selector.fontColor.includes(item.fontColor)) return false;
  if (selector.minLeft !== undefined && item.left < selector.minLeft) return false;
  if (selector.maxLeft !== undefined && item.left > selector.maxLeft) return false;
  if (selector.maxTop !== undefined && item.top > selector.maxTop) return false;
  return true;
}

/** 以基金標題切開便覽，每個區段由一個標題開始，去到下一個標題為止。 */
export function findSections(
  pages: PdfPage[],
  selector: TitleSelector,
): FactSheetSection[] {
  const matched = documentOrder(pages).filter((item) => matchesTitle(item, selector));
  const perPage = selector.onePerPage
    ? matched.filter((item, index) => item.page !== matched[index - 1]?.page)
    : matched;
  // 部分便覽把基金名稱在同一版重覆（頁首加頁尾），連續同名的標題屬同一個區段。
  const titles = perPage.filter((item, index) => item.text !== perPage[index - 1]?.text);
  const lastPage = pages.at(-1);
  if (!lastPage) throw new Error("Fact sheet has no pages");

  const sections = titles.map((item, index) => {
    const next = titles[index + 1];
    return {
      name: selector.name ? selector.name(item.text, item) : item.text,
      ...(selector.className?.(item.text, item)
        ? { className: selector.className(item.text, item) as string }
        : {}),
      start: { page: item.page, top: item.top },
      end: next
        ? { page: next.page, top: next.top }
        : { page: lastPage.number, top: Number.POSITIVE_INFINITY },
    };
  });

  // 中英雙版的便覽（例如 BCT Strategic）把同一批基金印兩次，只保留第一次出現的區段。
  return selector.dedupeByName
    ? sections.filter(
        (section, index) =>
          sections.findIndex((candidate) => candidate.name === section.name) === index,
      )
    : sections;
}

function withinSection(item: PdfTextItem, section: FactSheetSection) {
  if (item.page < section.start.page || item.page > section.end.page) return false;
  if (item.page === section.start.page && item.top < section.start.top) return false;
  if (item.page === section.end.page && item.top >= section.end.top) return false;
  return true;
}

function sectionItems(pages: PdfPage[], section: FactSheetSection) {
  return documentOrder(pages).filter((item) => withinSection(item, section));
}

function headingsIn(items: PdfTextItem[], selector: BlockSelector) {
  return items.filter(
    (item) =>
      selector.heading.test(item.text) &&
      (selector.headingFontSize === undefined ||
        selector.headingFontSize.includes(item.fontSize)),
  );
}

/**
 * 欄界：由標題本身向左讓一點容差，向右去到同一區段內下一個更右的標題為止。
 * 東亞那種「左邊配置圓餅圖、右邊十大持倉」的版面靠這條規則就能分開兩欄。
 */
function bandFor(
  heading: PdfTextItem,
  items: PdfTextItem[],
  contract: FactSheetContract,
  selector: BlockSelector,
  pages: PdfPage[],
) {
  if (selector.band) return selector.band;
  const slack = selector.leftSlack ?? 30;
  const others = items.filter(
    (item) =>
      item.left > heading.left + 20 &&
      item.page === heading.page &&
      Math.abs(item.top - heading.top) <= 60 &&
      (contract.allocation.heading.test(item.text) ||
        contract.holdings.heading.test(item.text)),
  );
  const pageWidth =
    pages.find((page) => page.number === heading.page)?.width ?? Number.MAX_SAFE_INTEGER;
  const right = others.length > 0 ? Math.min(...others.map((item) => item.left)) - 1 : pageWidth;
  const width = selector.columnWidth;
  return {
    minLeft: heading.left - slack,
    maxLeft: width === undefined ? right : Math.min(right, heading.left + width),
  };
}

/**
 * 表格下界：同一欄之下一個標題（配置或持倉）就是這個表格的結尾，
 * 否則配置會一路讀落去，把下面的十大持倉當成配置項目。
 */
function bottomOf(
  heading: PdfTextItem,
  items: PdfTextItem[],
  contract: FactSheetContract,
  band: { minLeft: number; maxLeft: number },
  selector: BlockSelector,
) {
  if (selector.maxDepth !== undefined) return heading.top + selector.maxDepth;
  const below = items.filter(
    (item) =>
      item.page === heading.page &&
      item.top > heading.top &&
      item.left >= band.minLeft &&
      item.left <= band.maxLeft &&
      (contract.allocation.heading.test(item.text) ||
        contract.holdings.heading.test(item.text)),
  );
  return below.length > 0
    ? Math.min(...below.map((item) => item.top))
    : Number.POSITIVE_INFINITY;
}

/** 一行之內，數值欄裡符合數值格式的段落。 */
function valueItems(line: PdfLine, selector: BlockSelector) {
  const pattern = selector.numberFormat === "bare" ? BARE_NUMBER_ITEM : PERCENT_ITEM;
  return line.items.filter(
    (item) =>
      pattern.test(item.text) &&
      (selector.valueMinLeft === undefined || item.left >= selector.valueMinLeft) &&
      (selector.valueMaxLeft === undefined || item.left <= selector.valueMaxLeft),
  );
}

function blockLines(
  pages: PdfPage[],
  section: FactSheetSection,
  heading: PdfTextItem,
  band: { minLeft: number; maxLeft: number },
  selector: BlockSelector,
  bottom: number,
): PdfLine[] {
  const collected: PdfLine[] = [];

  // `stopAt` 要跳出兩層迴圈而不是提早 return，否則下面的 `callouts` 及 `rowGap`
  // 後處理會被略過，換行拆散的一列就併唔返（新地的「亞太區股票」數值排在兩段名稱之間）。
  pages: for (const page of pages) {
    if (page.number < heading.page) continue;
    if (page.number > section.end.page) break;
    if (page.number > heading.page && !selector.continueOnNextPage) break;

    const lines = toLines({
      ...page,
      items: page.items.filter(
        (item) => item.left >= band.minLeft && item.left <= band.maxLeft,
      ),
    });

    for (const line of lines) {
      if (page.number === heading.page && line.top <= heading.top) continue;
      if (page.number === heading.page && line.top >= bottom) continue;
      if (page.number === section.end.page && line.top >= section.end.top) continue;
      if (selector.stopAt?.test(line.text)) break pages;
      if (selector.ignore?.test(line.text)) continue;
      collected.push(line);
    }
  }
  if (selector.callouts) {
    const pattern = selector.numberFormat === "bare" ? BARE_NUMBER_ITEM : PERCENT_ITEM;
    return groupCallouts(collected, selector.callouts, (item) => pattern.test(item.text));
  }
  return selector.rowGap === undefined ? collected : mergeRows(collected, selector.rowGap);
}

/**
 * 把散落的標註分組，每組還原成一「行」交返俾 `readValue`。預設按中心 x 分組
 * （中銀保誠、交銀），`overlap` 則按水平範圍相交（MASS）。同一組內按 top 排，
 * 最後一段通常就是百分比。
 */
function groupCallouts(
  lines: PdfLine[],
  options: NonNullable<BlockSelector["callouts"]>,
  isValue: (item: PdfTextItem) => boolean,
): PdfLine[] {
  const tolerance = options.centreTolerance ?? 14;
  const maxGap = options.maxGap ?? 30;
  const centre = (item: PdfTextItem) => item.left + item.width / 2;

  type Cluster = {
    centre: number;
    left: number;
    right: number;
    page: number;
    bottom: number;
    closed: boolean;
    items: PdfTextItem[];
  };
  const clusters: Cluster[] = [];
  for (const item of lines.flatMap((line) => line.items).sort((a, b) => a.top - b.top)) {
    const itemCentre = centre(item);
    // 標註以百分比作結。收咗尾就封組，否則上下相鄰、中心又相近的幾個標註會串埋一齊。
    const cluster = clusters.find(
      (candidate) =>
        !candidate.closed &&
        candidate.page === item.page &&
        (options.overlap
          ? item.left <= candidate.right + 1 && item.left + item.width >= candidate.left - 1
          : Math.abs(candidate.centre - itemCentre) <= tolerance) &&
        item.top - candidate.bottom <= maxGap,
    );
    if (cluster) {
      cluster.items.push(item);
      cluster.left = Math.min(cluster.left, item.left);
      cluster.right = Math.max(cluster.right, item.left + item.width);
      cluster.bottom = item.top;
      cluster.closed = isValue(item);
      continue;
    }
    clusters.push({
      centre: itemCentre,
      left: item.left,
      right: item.left + item.width,
      page: item.page,
      bottom: item.top,
      closed: isValue(item),
      items: [item],
    });
  }

  return clusters
    .sort((a, b) => (a.items[0]?.top ?? 0) - (b.items[0]?.top ?? 0))
    .map((cluster) => {
      const items = [...cluster.items].sort((a, b) => a.top - b.top);
      return {
        page: cluster.page,
        top: items[0]?.top ?? 0,
        items,
        text: joinItems(items),
      };
    });
}

/**
 * 把距離細過列距的相鄰行併成一列。宏利自在人生的證券名稱換行時，數值垂直置中排在
 * 兩段名稱之間，逐行讀會把名稱同數值配錯對。合併之後按「原行序、行內由左至右」重排。
 */
function mergeRows(lines: PdfLine[], rowGap: number): PdfLine[] {
  const merged: PdfLine[] = [];
  // 比較的是「上一行」而非「這一列的第一行」，否則三行一列的第三行會被當成新一列。
  let previousTop = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const previous = merged.at(-1);
    const gap = line.top - previousTop;
    previousTop = line.top;
    if (previous && line.page === previous.page && gap <= rowGap) {
      previous.items = [...previous.items, ...line.items].sort(
        (a, b) => a.left - b.left || a.top - b.top,
      );
      previous.text = joinItems(previous.items);
      continue;
    }
    merged.push({ ...line, items: [...line.items] });
  }
  return merged;
}

function stripFootnote(label: string, selector: BlockSelector) {
  return selector.labelStrip ? label.replace(selector.labelStrip, "").trim() : label;
}

/**
 * 砌出一列的名稱。冇聲明 `labelColumns` 就照閱讀次序讀；聲明咗就逐欄由上至下讀，
 * 再由左至右接駁——中英對照的標籤換行時，逐行讀會把兩種語文交錯。
 */
function joinLabelColumns(items: PdfTextItem[], selector: BlockSelector) {
  const gap = selector.labelColumnGap;
  if (gap === undefined) return joinLabelItems(inReadingOrder(items));
  const columns: PdfTextItem[][] = [];
  let right = Number.NEGATIVE_INFINITY;
  for (const item of items.toSorted((a, b) => a.left - b.left)) {
    if (columns.length === 0 || item.left - right > gap) columns.push([]);
    columns.at(-1)?.push(item);
    right = Math.max(right, item.left + item.width);
  }
  return columns
    .map((column) => joinLabelItems(inReadingOrder(column)))
    .reduce(joinLabel, "");
}

function readValue(line: PdfLine, selector: BlockSelector) {
  const format = selector.numberFormat ?? "percent";
  const pattern = format === "bare" ? BARE_NUMBER_ITEM : PERCENT_ITEM;
  const inValueColumn = (item: PdfTextItem) =>
    (selector.valueMinLeft === undefined || item.left >= selector.valueMinLeft) &&
    (selector.valueMaxLeft === undefined || item.left <= selector.valueMaxLeft);
  const valueIndex = line.items.findLastIndex(
    (item) => pattern.test(item.text) && inValueColumn(item),
  );
  if (valueIndex >= 0) {
    const raw = line.items[valueIndex]?.text.match(pattern)?.[1];
    const labelItems = line.items
      .filter(
        (item, index) =>
          index !== valueIndex &&
          (selector.labelMaxLeft === undefined || item.left <= selector.labelMaxLeft) &&
          !selector.labelIgnore?.test(item.text),
      );
    const label = stripFootnote(joinLabelColumns(labelItems, selector), selector);
    // 名稱可以是空的：換行的列由 `rowGap` 或 `joinWrappedLabels` 在外層補回，
    // 由呼叫者決定整列有冇名稱。
    if (raw !== undefined) return { label, percent: Number(raw) };
  }
  // 圓餅圖的標籤與百分比常常在同一段文字（例如「股票 72.7%」），要由行尾抽數字。
  // 數字不帶 `%` 的計劃（標題已寫 `(%)`）同樣要處理換行後的名稱＋數值。
  const trailing = line.text.match(
    format === "bare" ? BARE_TRAILING : PERCENT_TRAILING,
  );
  if (trailing?.[1] && trailing[2]) {
    const label = stripFootnote(trailing[1].trim(), selector);
    if (label !== "") return { label, percent: Number(trailing[2]) };
  }
  return undefined;
}

function readAllocation(
  pages: PdfPage[],
  section: FactSheetSection,
  items: PdfTextItem[],
  contract: FactSheetContract,
): { dimensions: AllocationDimension[]; orphanValues: string[]; overlaidRows: string[] } {
  const dimensions: AllocationDimension[] = [];
  const orphanValues: string[] = [];
  const overlaidRows: string[] = [];
  for (const heading of headingsIn(items, contract.allocation)) {
    const band = bandFor(heading, items, contract, contract.allocation, pages);
    const bottom = bottomOf(heading, items, contract, band, contract.allocation);
    const entries: AllocationEntry[] = [];
    let wrapped = "";
    let previousLine: PdfLine | undefined;
    for (const line of blockLines(
      pages,
      section,
      heading,
      band,
      contract.allocation,
      bottom,
    )) {
      if (contract.allocation.rejectOverlaidRows && valueItems(line, contract.allocation).length > 1) {
        overlaidRows.push(line.text);
        continue;
      }
      const value = readValue(line, contract.allocation);
      if (!value) {
        if (contract.allocation.joinWrappedLabels) wrapped = line.text;
        const previous = entries.at(-1);
        if (contract.allocation.joinTrailingLabels && previous && previousLine) {
          // 併返上一行再重讀，而唔係直接接駁文字：換行的中英對照標籤要按欄併返
          // （新地的「(ex USD, ex HKD) (美元及港元除外)」分屬兩欄的續行）。
          previousLine = {
            ...previousLine,
            items: [...previousLine.items, ...line.items],
          };
          const rejoined = readValue(previousLine, contract.allocation);
          if (rejoined) previous.label = rejoined.label;
        }
        continue;
      }
      previousLine = line;
      const label = joinLabel(wrapped, value.label);
      wrapped = "";
      if (label === "") {
        orphanValues.push(line.text);
        continue;
      }
      entries.push({ label, percent: value.percent });
    }
    if (entries.length === 0) continue;
    const label = contract.allocation.headingLabel
      ? contract.allocation.headingLabel(heading.text)
      : heading.text;
    const existing = dimensions.find((dimension) => dimension.heading === label);
    if (existing) existing.entries.push(...entries);
    else dimensions.push({ heading: label, entries });
  }
  return { dimensions, orphanValues, overlaidRows };
}

function readHoldings(
  pages: PdfPage[],
  section: FactSheetSection,
  items: PdfTextItem[],
  contract: FactSheetContract,
): { holdings: TopHolding[]; orphanValues: string[]; overlaidRows: string[] } {
  const holdings: TopHolding[] = [];
  const orphanValues: string[] = [];
  const overlaidRows: string[] = [];
  for (const heading of headingsIn(items, contract.holdings)) {
    const band = bandFor(heading, items, contract, contract.holdings, pages);
    const bottom = bottomOf(heading, items, contract, band, contract.holdings);
    let wrapped = "";
    for (const line of blockLines(
      pages,
      section,
      heading,
      band,
      contract.holdings,
      bottom,
    )) {
      if (contract.holdings.rejectOverlaidRows && valueItems(line, contract.holdings).length > 1) {
        overlaidRows.push(line.text);
        continue;
      }
      const value = readValue(line, contract.holdings);
      if (!value) {
        if (contract.holdings.joinWrappedLabels) wrapped = line.text;
        const previous = holdings.at(-1);
        if (contract.holdings.joinTrailingLabels && previous) {
          previous.security = joinLabel(previous.security, line.text);
        }
        continue;
      }
      const labelled = joinLabel(wrapped, value.label);
      wrapped = "";
      const rankMatch = labelled.match(RANK_PREFIX);
      const security = labelled.replace(RANK_PREFIX, "").trim();
      if (security === "") {
        orphanValues.push(line.text);
        continue;
      }
      holdings.push({
        rank: rankMatch?.[1] ? Number(rankMatch[1]) : holdings.length + 1,
        security,
        percent: value.percent,
      });
    }
  }
  return { holdings: holdings.slice(0, 10), orphanValues, overlaidRows };
}

export function findFactSheetAsOf(pages: PdfPage[], contract: FactSheetContract) {
  const limit = contract.asOf.maxPage ?? pages.length;
  const found: string[] = [];
  for (const page of pages) {
    if (page.number > limit) break;
    // 一行可以有多過一個日期：中國人壽的封面把舊版的「As at 30 September 2023」
    // 疊在新日期上面，兩段文字併成同一行，只取第一個 match 就會抽到過時的日期。
    const pattern = new RegExp(
      contract.asOf.pattern.source,
      contract.asOf.pattern.flags.includes("g")
        ? contract.asOf.pattern.flags
        : `${contract.asOf.pattern.flags}g`,
    );
    for (const line of toLines(page)) {
      for (const match of line.text.matchAll(pattern)) {
        if (!match[1]) continue;
        const date = parseFactSheetDate(match[1]);
        if (contract.asOf.pick !== "latest") return date;
        found.push(date);
      }
    }
  }
  const latest = found.sort().at(-1);
  if (latest) return latest;
  throw new Error(`${contract.scheme}: fact sheet as-of date not found`);
}

function describe(lines: string[]) {
  return lines.slice(0, 3).map((line) => JSON.stringify(line)).join(", ");
}

function overlaidReason(lines: string[]) {
  return `${lines.length} rows carry more than one value in the value column: the text layer overlays another fund's table, so rows cannot be attributed: ${describe(lines)}`;
}

export function parseFactSheetDisclosures(
  pages: PdfPage[],
  contract: FactSheetContract,
): FactSheetDisclosure[] {
  const factSheetAsOf = findFactSheetAsOf(pages, contract);
  const sections = findSections(pages, contract.title);
  if (sections.length === 0) {
    throw new Error(`${contract.scheme}: no constituent fund sections found`);
  }

  const disclosures = sections.map((section) => {
    const items = sectionItems(pages, section);
    const allocation = contract.allocation.unextractable
      ? { dimensions: [], orphanValues: [], overlaidRows: [] }
      : readAllocation(pages, section, items, contract);
    const holdings = contract.holdings.unextractable
      ? { holdings: [], orphanValues: [], overlaidRows: [] }
      : readHoldings(pages, section, items, contract);
    const unavailableFields: string[] = [];
    const unavailableReasons: Record<string, string> = {};

    // 有數值但抽唔到名稱，代表該份便覽把名稱畫成向量而非文字（宏利環球精選）。
    // 靜默丟走這些行會令餘下的名單短一截、排名整體移位，等同改寫官方披露，
    // 所以整塊當作官方未提供，唔出局部名單。
    const allocations =
      allocation.orphanValues.length > 0 || allocation.overlaidRows.length > 0
        ? []
        : allocation.dimensions;
    const topHoldings =
      holdings.orphanValues.length > 0 || holdings.overlaidRows.length > 0
        ? []
        : holdings.holdings;

    if (allocations.length === 0) {
      unavailableFields.push("allocation");
      unavailableReasons.allocation =
        contract.allocation.unextractable ??
        (allocation.overlaidRows.length > 0
          ? overlaidReason(allocation.overlaidRows)
          : allocation.orphanValues.length > 0
            ? `${allocation.orphanValues.length} rows disclose a percentage without an extractable label: ${describe(allocation.orphanValues)}`
            : "no allocation rows in the disclosed block");
    }
    if (topHoldings.length === 0) {
      unavailableFields.push("topHoldings");
      unavailableReasons.topHoldings =
        contract.holdings.unextractable ??
        (holdings.overlaidRows.length > 0
          ? overlaidReason(holdings.overlaidRows)
          : holdings.orphanValues.length > 0
            ? `${holdings.orphanValues.length} rows disclose a percentage without an extractable security name: ${describe(holdings.orphanValues)}`
            : "no holdings rows in the disclosed block");
    }

    return {
      schemeName: contract.scheme,
      constituentFundName: section.name,
      ...(section.className ? { fundClassName: section.className } : {}),
      factSheetAsOf,
      allocations,
      topHoldings,
      unavailableFields,
      unavailableReasons,
    } satisfies FactSheetDisclosure;
  });

  const keys = disclosures.map(
    (disclosure) => `${disclosure.constituentFundName} ${disclosure.fundClassName ?? ""}`,
  );
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `${contract.scheme}: duplicate fund sections (${[...new Set(duplicates)].slice(0, 3).join(", ")})`,
    );
  }

  return disclosures;
}
