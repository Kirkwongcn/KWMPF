import { CJK, joinItems, type PdfTextItem } from "./pdf-xml";

/**
 * 便覽的官方文字欄位（ADR 0012）：投資目標、基金經理評論、市場預測、投資經理。
 *
 * 同配置及十大持倉一樣，契約只描述「去邊度攞」，唔描述「點樣改寫」。文字原文照錄，
 * 唯一處理係版面空白：兩個中文字之間嘅排版空格（左右對齊撐開的空隙）唔係原文用字，
 * 刪走；英文跨行加一個空格；項目符號開新段。唔刪句、唔摘要、唔改數字。
 */
export const NARRATIVE_FIELDS = [
  "investmentObjective",
  "managerCommentary",
  "marketForecast",
  "investmentManager",
] as const;

export type NarrativeField = (typeof NARRATIVE_FIELDS)[number];

export type NarrativeText = {
  /** 便覽自己的標題原文（中英對照時連埋兩個語文）。 */
  heading: string;
  /**
   * 同一份便覽有幾多隻基金的同一欄位一字不差（包括本基金）。多過一隻即係計劃
   * 共用的市場評論，網站要標明，唔可以當成呢隻基金專屬的評論（ADR 0012）。
   */
  sharedAcrossFunds?: number;
  zh?: string;
  en?: string;
};

export type TextBlockSelector = {
  /** 標題；中英分開兩段時，兩段都要配得到，取最上嗰段做錨點。 */
  heading: RegExp;
  headingFontSize?: number[];
  /** 明確欄界。文字欄冇表格咁整齊，唔靠自動推斷。 */
  band: { minLeft: number; maxLeft: number };
  /**
   * 文字分幾欄並排（東亞的評論：左欄英文、右欄中文，兩欄的行喺同一高度）。
   * 設咗就逐欄各自併行、各自計 `stopAt`／`maxGap`，再按欄次序接駁；
   * 唔分欄的話同一高度的中英兩行會被併成一行。每欄都要喺 `band` 之內。
   */
  columns?: { minLeft: number; maxLeft: number }[];
  /** 由標題往下最多幾多 pt；預設讀到區段結尾、`stopAt` 或下一個欄位標題。 */
  maxDepth?: number;
  /**
   * 由標題往下幾多 pt 先開始讀。東亞 DIS 基金的十大持倉表一路延伸到評論標題右邊
   * （標題 top≈1036，持倉 1043），正文由標題下 24 pt 先開始。
   */
  minDepth?: number;
  /** 讀到符合呢個式樣的行就停（例如下一塊披露的標題）。 */
  stopAt?: RegExp;
  /** 略過符合呢個式樣的行（例如註腳說明）。 */
  ignore?: RegExp;
  /**
   * 細過呢個字級的段落係註腳標記（滙豐評論入面的上標 `1`、`5`），唔屬原文句子。
   * 剔的係標記本身，唔係用字。
   */
  minFontSize?: number;
  /**
   * 大過呢個字級的段落唔係正文（滙豐評論欄之下嘅合併通告用 12 級字，正文 8 至 9 級，
   * 通告有幾段跌入評論欄界）。
   */
  maxFontSize?: number;
  /**
   * 兩行之間嘅垂直空隙大過呢個值就當正文完結。正文行距約 10 pt；隔咗一大段空白
   * 之後嘅文字屬另一塊版面（例如通告或註腳）。
   */
  maxGap?: number;
  /**
   * 文字有幾種語文：`bilingual` 中英各一段（按每行有冇中文字分開），
   * `zh`／`en` 只有一種，`value` 係一個短值（例如市場預測的「Neutral」），
   * 照錄成 `en` 或 `zh`。
   */
  languages: "bilingual" | "zh" | "en" | "value";
};

/** 兩段文字重疊而內容唔同，代表文字層疊印咗另一版。 */
export type NarrativeReadResult =
  | { status: "ok"; text: NarrativeText }
  | { status: "not-disclosed"; reason: string }
  | { status: "overlaid"; reason: string };

const LINE_TOLERANCE = 4;
const BULLET = /^[•●▪■◆]\s*/;
const CJK_CHAR = new RegExp(CJK.source);
const CJK_SPACE = new RegExp(`(${CJK.source})\\s+(?=${CJK.source})`, "g");

type Line = { top: number; items: PdfTextItem[]; text: string };

function horizontalOverlap(a: PdfTextItem, b: PdfTextItem) {
  const overlap = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  return overlap / Math.max(1, Math.min(a.width, b.width));
}

/**
 * 粗體重印：同一段文字喺兩三 pt 之內再印一次（永明的標題、基本資料逐段印兩次），
 * 印出嚟只見一份，保留第一份。內容唔同就唔係重印，係疊印，交返畀 `overlapping` 判斷。
 */
function dropReprints(items: PdfTextItem[]) {
  const kept: PdfTextItem[] = [];
  for (const item of items) {
    const reprint = kept.some(
      (other) =>
        other.text === item.text &&
        Math.abs(other.top - item.top) <= 3 &&
        Math.abs(other.left - item.left) <= 3,
    );
    if (!reprint) kept.push(item);
  }
  return kept;
}

function overlapping(items: PdfTextItem[]) {
  const pairs: string[] = [];
  for (const [index, item] of items.entries()) {
    for (const other of items.slice(index + 1)) {
      // 全形標點（「）」「，」）的字框會同隔籬文字重疊，唔係另一版；兩段都要有實字先算。
      if (
        item.text.trim().length > 2 &&
        other.text.trim().length > 2 &&
        Math.abs(other.top - item.top) <= 2 &&
        horizontalOverlap(item, other) > 0.5 &&
        other.text.trim() !== item.text.trim()
      ) {
        pairs.push(`${JSON.stringify(item.text)} / ${JSON.stringify(other.text)}`);
      }
    }
  }
  return pairs;
}

function toLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  for (const item of [...items].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const line = lines.find((current) => Math.abs(current.top - item.top) <= LINE_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ top: item.top, items: [item], text: "" });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.left - b.left);
    line.text = joinItems(line.items).replace(/\s+/g, " ").trim();
  }
  return lines.sort((a, b) => a.top - b.top).filter((line) => line.text !== "");
}

/** 只得項目符號或數字碎片嘅行，冇自己語文，跟返上一行。 */
function scriptOf(text: string): "zh" | "en" | undefined {
  if (CJK_CHAR.test(text)) return "zh";
  return /[A-Za-z]/.test(text) ? "en" : undefined;
}

/** 接駁成段：中文行之間唔加空格，英文行之間加一個；項目符號開新段。 */
function joinParagraphs(lines: string[], script: "zh" | "en") {
  const paragraphs: string[] = [];
  for (const line of lines) {
    const last = paragraphs.length - 1;
    if (last < 0 || BULLET.test(line) && line.trim().length > 1) {
      paragraphs.push(line);
      continue;
    }
    const previous = paragraphs[last]!;
    const glue =
      script === "zh" && CJK_CHAR.test(previous.at(-1) ?? "") && CJK_CHAR.test(line[0] ?? "")
        ? ""
        : script === "en" && /-$/.test(previous) && /^[a-z]/.test(line)
          ? ""
          : " ";
    paragraphs[last] = previous + glue + line;
  }
  return paragraphs
    .map((paragraph) => paragraph.replace(CJK_SPACE, "$1").replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph !== "")
    .join("\n");
}

/**
 * 喺一隻基金的區段（已按落筆次序剔走疊印層）入面讀一段官方文字。
 * `items` 係 `sectionItems` 嘅輸出；`stopHeadings` 係同一區段其他欄位的標題，
 * 讀到就停，唔會把下一塊披露當成本段文字。
 */
export function readNarrative(
  items: PdfTextItem[],
  selector: TextBlockSelector,
  stopHeadings: RegExp[] = [],
): NarrativeReadResult {
  const headings = items
    .filter(
      (item) =>
        selector.heading.test(item.text) &&
        (selector.headingFontSize === undefined ||
          selector.headingFontSize.includes(item.fontSize)),
    )
    .sort((a, b) => a.page - b.page || a.top - b.top);
  const anchor = headings[0];
  if (!anchor) {
    return { status: "not-disclosed", reason: `no heading matching ${selector.heading}` };
  }
  const headingLine = headings.filter(
    (item) => item.page === anchor.page && Math.abs(item.top - anchor.top) <= LINE_TOLERANCE + 2,
  );
  const headingBottom = Math.max(...headingLine.map((item) => item.top));
  const inBand = (item: PdfTextItem) =>
    item.left >= selector.band.minLeft && item.left < selector.band.maxLeft;

  const below = items.filter(
    (item) =>
      item.page === anchor.page &&
      item.top > headingBottom + LINE_TOLERANCE &&
      (selector.minDepth === undefined || item.top >= anchor.top + selector.minDepth) &&
      (selector.maxDepth === undefined || item.top <= anchor.top + selector.maxDepth) &&
      inBand(item) &&
      item.text.trim() !== "" &&
      (selector.minFontSize === undefined || item.fontSize >= selector.minFontSize) &&
      (selector.maxFontSize === undefined || item.fontSize <= selector.maxFontSize),
  );
  const columns = selector.columns ?? [selector.band];
  const kept: Line[] = [];
  for (const column of columns) {
    const lines = toLines(
      dropReprints(
        below.filter((item) => item.left >= column.minLeft && item.left < column.maxLeft),
      ),
    );
    const columnKept: Line[] = [];
    for (const line of lines) {
      const previous = columnKept.at(-1);
      if (previous && selector.maxGap !== undefined && line.top - previous.top > selector.maxGap) break;
      if (selector.stopAt?.test(line.text)) break;
      if (stopHeadings.some((pattern) => pattern.test(line.text))) break;
      if (selector.ignore?.test(line.text)) continue;
      columnKept.push(line);
    }
    kept.push(...columnKept);
  }
  const overlaid = overlapping(kept.flatMap((line) => line.items));
  if (overlaid.length > 0) {
    return {
      status: "overlaid",
      reason: `${overlaid.length} text runs overlap with different wording, so the text layer overlays another version: ${overlaid.slice(0, 2).join(", ")}`,
    };
  }
  if (kept.length === 0) {
    return { status: "not-disclosed", reason: "heading found but no text below it" };
  }

  const heading = headingLine
    .sort((a, b) => a.left - b.left)
    .map((item) => item.text.trim())
    .join(" ");
  const text: NarrativeText = { heading };
  if (selector.languages === "bilingual") {
    // 同一語文連續嘅行係一段；語文轉咗再轉返嚟就係新一段（BCT 投資目標中英逐句交替，
    // 目標同投資政策係兩段，唔分段就會接成「…capital appreciation Invests in…」）。
    const runs = { zh: [] as string[][], en: [] as string[][] };
    let current: "zh" | "en" | undefined;
    for (const line of kept) {
      const script = scriptOf(line.text) ?? current;
      if (!script) continue;
      if (script !== current || runs[script].length === 0) runs[script].push([]);
      runs[script].at(-1)!.push(line.text);
      current = script;
    }
    for (const script of ["zh", "en"] as const) {
      if (runs[script].length > 0) {
        text[script] = runs[script].map((run) => joinParagraphs(run, script)).join("\n");
      }
    }
  } else {
    const all = kept.map((line) => line.text);
    const script =
      selector.languages === "value"
        ? (scriptOf(all.join(" ")) ?? "en")
        : selector.languages;
    text[script] = joinParagraphs(all, script);
  }
  return { status: "ok", text };
}
