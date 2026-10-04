import { normalizeFundName } from "./fact-sheet-allocation-pairing";
import { CJK, joinItems, type PdfPage, type PdfTextItem } from "./pdf-xml";

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
  /**
   * 用第幾個符合的標題（由 0 起，按頁次及高度排）；`"all"` 即係每一頁第一個符合
   * 的標題都讀，按頁次接駁。我的強積金計劃有啲基金中英評論同一頁，有啲中文一頁、
   * 英文下一頁，兩頁標題一樣係「市場評論 MARKET COMMENTARY」。
   */
  occurrence?: number | "all";
  /** 明確欄界。文字欄冇表格咁整齊，唔靠自動推斷。 */
  band: { minLeft: number; maxLeft: number };
  /**
   * 文字分幾欄並排（東亞的評論：左欄英文、右欄中文，兩欄的行喺同一高度）。
   * 設咗就逐欄各自併行、各自計 `stopAt`／`maxGap`，再按欄次序接駁；
   * 唔分欄的話同一高度的中英兩行會被併成一行。每欄都要喺 `band` 之內。
   *
   * `after`：呢一欄只讀最後一行符合式樣的行之後的內容；冇一行符合就成欄唔讀。
   * 交通銀行的長評論由左欄溢到右欄十大資產的「Source:」來源行之下。
   *
   * `lineStart`：只收行首落喺呢個範圍的行，其餘（例如圓餅圖標註）略過；收咗的行
   * 保留成行所有段落，唔會因為字款不同而切走半行。
   */
  columns?: {
    minLeft: number;
    maxLeft: number;
    after?: RegExp;
    lineStart?: {
      minLeft: number;
      maxLeft: number;
      /**
       * 行首落喺範圍外點處理：`"skip"`（預設）略過嗰行；`"fail"` 即係版面變咗
       * （例如中銀保誠人民幣貨幣市場基金頁底改為中英並排），成段報讀唔齊。
       */
      otherwise?: "skip" | "fail";
    };
  }[];
  /** 由標題往下最多幾多 pt；預設讀到區段結尾、`stopAt` 或下一個欄位標題。 */
  maxDepth?: number;
  /**
   * 由標題往下幾多 pt 先開始讀。東亞 DIS 基金的十大持倉表一路延伸到評論標題右邊
   * （標題 top≈1036，持倉 1043），正文由標題下 24 pt 先開始。
   *
   * 可以係負數：設咗就取代「標題下一行」的上界。宏利環球精選的投資經理值垂直置中
   * 對住標籤，兩行長的值第一行比標籤高 17 pt。
   */
  minDepth?: number;
  /**
   * 值同標籤喺同一行開始（BCT Simple／Smart 的「Investment Manager of the Underlying APIF」
   * 標籤喺左欄，經理名由同一行起喺右欄）。設咗就由標題嗰行開始讀 `band` 入面的文字，
   * 唔係由標題下一行開始；`band` 要排除標籤欄。
   */
  sameLine?: boolean;
  /**
   * 由第一行符合呢個式樣的行開始讀（包埋嗰行），之前的行唔要；冇一行符合就當冇文字。
   * 配合負數 `minDepth`，略過上一格數值溢落嚟的行。
   */
  startAt?: RegExp;
  /** 讀到符合呢個式樣的行就停（例如下一塊披露的標題）。 */
  stopAt?: RegExp;
  /**
   * 文字一定要以呢個式樣的行收尾（同樣唔包埋嗰行）。讀到頁底都見唔到，即係文字
   * 續落下一頁，本頁讀到的只係一部分：成段當官方未提供，唔出局部文字。新地計劃
   * 的評論以「^Sources:」來源行收尾，宏利保證基金的評論跨頁。
   */
  endAt?: RegExp;
  /** 略過符合呢個式樣的行（例如註腳說明）。 */
  ignore?: RegExp;
  /**
   * 官方寫明冇值（例如永明市場預測印「N/A」）：成段符合就當官方未提供（紅線 2），
   * 唔當成一段文字顯示。
   */
  unavailableValue?: RegExp;
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
  | { status: "overlaid"; reason: string }
  /** 官方有印，但版面（跨頁、改為並排）令本站讀唔齊；唔出局部文字。 */
  | { status: "unreadable-layout"; reason: string };

const LINE_TOLERANCE = 4;
const BULLET = /^[•●▪■◆]\s*/;
const CJK_CHAR = new RegExp(CJK.source);
const CJK_SPACE = new RegExp(`(${CJK.source})\\s+(?=${CJK.source})`, "g");
/** 中文同括號之間的排版空隙（「信安資金管理 ( 亞洲 ) 有限公司」），唔係原文空格。 */
const CJK_BRACKET_SPACE = [
  [new RegExp(`(${CJK.source})\\s+(?=[(（])`, "g"), "$1"],
  [new RegExp(`([(（])\\s+(?=${CJK.source})`, "g"), "$1"],
  [new RegExp(`(${CJK.source})\\s+(?=[)）])`, "g"), "$1"],
  [new RegExp(`([)）])\\s+(?=${CJK.source})`, "g"), "$1"],
  // 全形標點本身已佔一格，前後再有空格都係排版（「升至53.2 、」「3.7% 。」）。
  [/\s+(?=[、。，；：！？）」』〉》])/g, ""],
  [/([（「『〈《])\s+/g, "$1"],
] as const;

type Line = {
  top: number;
  items: PdfTextItem[];
  text: string;
  /** 同一頁同一欄的行屬同一段落區（segment），行距只喺區內比較。 */
  segment?: number;
  /** 上一行同呢行之間的空隙明顯大過正常行距：原文喺度分段。 */
  breakBefore?: boolean;
};

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
        other.page === item.page &&
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
    line.text = joinItems(line.items, 1, { explicitSpaces: true }).replace(/\s+/g, " ").trim();
  }
  return lines.sort((a, b) => a.top - b.top).filter((line) => line.text !== "");
}

/** 只得項目符號或數字碎片嘅行，冇自己語文，跟返上一行。 */
function scriptOf(text: string): "zh" | "en" | undefined {
  if (CJK_CHAR.test(text)) return "zh";
  return /[A-Za-z]/.test(text) ? "en" : undefined;
}

/**
 * 接駁成段：中文段落跨行時，接口任何一邊係中文字（例如「為」接「2023年」）都唔加
 * 空格，因為原文嗰度冇空格；兩邊都係英文或數字先加一個。英文段落行之間加一個；
 * 項目符號開新段。
 */
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
      script === "zh" && (CJK_CHAR.test(previous.at(-1) ?? "") || CJK_CHAR.test(line[0] ?? ""))
        ? ""
        : script === "en" && /\S-$/.test(previous)
          ? ""
          : " ";
    paragraphs[last] = previous + glue + line;
  }
  return paragraphs
    .map((paragraph) =>
      CJK_BRACKET_SPACE.reduce(
        (text, [pattern, replacement]) => text.replace(pattern, replacement),
        paragraph.replace(CJK_SPACE, "$1"),
      )
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((paragraph) => paragraph !== "")
    .join("\n");
}

/**
 * 原文分段：同一區內兩行之間的空隙大過正常行距（區內行距中位數）的 1.6 倍，就當
 * 係段落之間。少過三個行距唔夠判斷正常行距，唔分。
 */
function markParagraphBreaks(lines: Line[]) {
  const gaps = lines.flatMap((line, index) => {
    const previous = lines[index - 1];
    return previous && previous.segment === line.segment ? [line.top - previous.top] : [];
  });
  if (gaps.length < 3) return;
  const sorted = [...gaps].sort((a, b) => a - b);
  const normal = sorted[Math.floor(sorted.length / 2)]!;
  for (const [index, line] of lines.entries()) {
    const previous = lines[index - 1];
    if (previous && previous.segment === line.segment && line.top - previous.top > normal * 1.6) {
      line.breakBefore = true;
    }
  }
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
  const anchors =
    selector.occurrence === "all"
      ? headings.filter(
          (item, index) => headings.findIndex((other) => other.page === item.page) === index,
        )
      : headings.slice(selector.occurrence ?? 0, (selector.occurrence ?? 0) + 1);
  if (anchors.length === 0) {
    return { status: "not-disclosed", reason: `no heading matching ${selector.heading}` };
  }
  const headingLineOf = (anchor: PdfTextItem) =>
    headings.filter(
      (item) => item.page === anchor.page && Math.abs(item.top - anchor.top) <= LINE_TOLERANCE + 2,
    );
  const headingLine = headingLineOf(anchors[0]!);
  const inBand = (item: PdfTextItem) =>
    item.left >= selector.band.minLeft && item.left < selector.band.maxLeft;
  const kept: Line[] = [];
  let segment = 0;
  let ended = false;
  let layoutProblem: string | undefined;
  for (const anchor of anchors) {
    kept.push(...readBlock(anchor, headingLineOf(anchor)));
  }
  markParagraphBreaks(kept);

  function readBlock(anchor: PdfTextItem, headingLine: PdfTextItem[]): Line[] {
    const headingBottom = Math.max(...headingLine.map((item) => item.top));
    const below = items.filter(
      (item) =>
        item.page === anchor.page &&
        (selector.minDepth !== undefined
          ? item.top >= anchor.top + selector.minDepth
          : selector.sameLine
            ? item.top >= anchor.top - LINE_TOLERANCE
            : item.top > headingBottom + LINE_TOLERANCE) &&
        (selector.maxDepth === undefined || item.top <= anchor.top + selector.maxDepth) &&
        inBand(item) &&
        item.text.trim() !== "" &&
        (selector.minFontSize === undefined || item.fontSize >= selector.minFontSize) &&
        (selector.maxFontSize === undefined || item.fontSize <= selector.maxFontSize),
    );
    const columns: NonNullable<TextBlockSelector["columns"]> = selector.columns ?? [selector.band];
    const block: Line[] = [];
    for (const column of columns) {
      const columnLines = toLines(
        dropReprints(
          below.filter((item) => item.left >= column.minLeft && item.left < column.maxLeft),
        ),
      );
      const start = column.after
        ? columnLines.findLastIndex((line) => column.after!.test(line.text)) + 1
        : 0;
      if (column.after && start === 0) continue;
      const lineStart = column.lineStart;
      const sliced = columnLines.slice(start);
      const first = selector.startAt
        ? sliced.findIndex((line) => selector.startAt!.test(line.text))
        : 0;
      const startsInside = (line: Line) =>
        !lineStart ||
        (line.items[0]!.left >= lineStart.minLeft && line.items[0]!.left < lineStart.maxLeft);
      const strict = lineStart?.otherwise === "fail";
      // 略過模式喺讀之前剔走欄外起行的行（佢哋唔計行距）；嚴格模式要等結束標記
      // 判斷完先睇，頁腳由欄外起行都唔算版面變咗。
      const lines = (first < 0 ? [] : sliced.slice(first)).filter(
        (line) => strict || startsInside(line),
      );
      const columnKept: Line[] = [];
      segment += 1;
      for (const line of lines) {
        const previous = columnKept.at(-1);
        if (previous && selector.maxGap !== undefined && line.top - previous.top > selector.maxGap) break;
        if (selector.endAt?.test(line.text)) {
          ended = true;
          break;
        }
        if (selector.stopAt?.test(line.text)) break;
        if (stopHeadings.some((pattern) => pattern.test(line.text))) break;
        if (selector.ignore?.test(line.text)) continue;
        if (strict && !startsInside(line)) {
          layoutProblem ??= `a line starts at x=${line.items[0]!.left} on page ${anchor.page}, outside ${lineStart!.minLeft}–${lineStart!.maxLeft}: ${JSON.stringify(line.text.slice(0, 40))}`;
          break;
        }
        columnKept.push({ ...line, segment });
      }
      block.push(...columnKept);
    }
    return block;
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
  if (layoutProblem) {
    return { status: "unreadable-layout", reason: `layout changes mid-text: ${layoutProblem}` };
  }
  if (selector.endAt && !ended) {
    return {
      status: "unreadable-layout",
      reason: `no line matching ${selector.endAt} on the page, so the text continues elsewhere and only part of it was read`,
    };
  }

  const heading = headingLine
    .sort((a, b) => a.left - b.left)
    .map((item) => item.text.trim())
    .join(" ");
  const all = kept.map((line) => line.text).join(" ");
  if (selector.unavailableValue?.test(all)) {
    return { status: "not-disclosed", reason: `the official text reads ${JSON.stringify(all)}` };
  }
  return { status: "ok", text: composeText(kept, heading, selector.languages) };
}

/** 讀好的行變成中英文字：按語文及原文分段接駁（見 `joinParagraphs`）。 */
function composeText(
  kept: Line[],
  heading: string,
  languages: TextBlockSelector["languages"],
): NarrativeText {
  const text: NarrativeText = { heading };
  if (languages === "bilingual") {
    // 同一語文連續嘅行係一段；語文轉咗再轉返嚟就係新一段（BCT 投資目標中英逐句交替，
    // 目標同投資政策係兩段，唔分段就會接成「…capital appreciation Invests in…」）。
    const runs = { zh: [] as string[][], en: [] as string[][] };
    let current: "zh" | "en" | undefined;
    for (const line of kept) {
      const script = scriptOf(line.text) ?? current;
      if (!script) continue;
      if (script !== current || runs[script].length === 0 || line.breakBefore) {
        runs[script].push([]);
      }
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
      languages === "value"
        ? (scriptOf(all.join(" ")) ?? "en")
        : languages;
    const paragraphs: string[][] = [];
    for (const line of kept) {
      if (paragraphs.length === 0 || line.breakBefore) paragraphs.push([]);
      paragraphs.at(-1)!.push(line.text);
    }
    text[script] = paragraphs.map((run) => joinParagraphs(run, script)).join("\n");
  }
  return text;
}

/**
 * 一個欄位由幾份契約分開讀（例如宏利自在人生：英文版一頁、中文版下一頁），再合併成
 * 一段。任何一份讀唔到，成個欄位都當讀唔到——唔出得一半語文就算數（紅線 3）。
 * 兩份讀出同一種語文係契約寫錯，直接報錯。
 */
export function readNarrativeField(
  items: PdfTextItem[],
  selectors: TextBlockSelector | TextBlockSelector[],
  stopHeadings: RegExp[] = [],
): NarrativeReadResult {
  const parts = (Array.isArray(selectors) ? selectors : [selectors]).map((selector) =>
    readNarrative(items, selector, stopHeadings),
  );
  const overlaid = parts.find((part) => part.status === "overlaid");
  if (overlaid) return overlaid;
  const unreadable = parts.find((part) => part.status === "unreadable-layout");
  if (unreadable) return unreadable;
  const missing = parts.find((part) => part.status === "not-disclosed");
  if (missing) return missing;
  const texts = parts.flatMap((part) => (part.status === "ok" ? [part.text] : []));
  if (texts.length === 1) return { status: "ok", text: texts[0]! };
  const merged: NarrativeText = { heading: texts.map((text) => text.heading).join(" / ") };
  for (const text of texts) {
    for (const language of ["zh", "en"] as const) {
      if (text[language] === undefined) continue;
      if (merged[language] !== undefined) {
        throw new Error(`narrative contract reads ${language} twice (${merged.heading})`);
      }
      merged[language] = text[language];
    }
  }
  return { status: "ok", text: merged };
}

/**
 * 附錄式評論：所有基金的評論集中印喺便覽尾段（中銀保誠「基金經理評論 MANAGER'S
 * COMMENT」），每隻基金一個中英名稱小標題，下面係中文段及英文段。
 */
export type AppendixNarrativeSpec = {
  /** 附錄頁的頁標題；有呢個標題的頁先搵。 */
  pageHeading: RegExp;
  /** 基金名稱小標題的字級。 */
  subheadingFontSize: number[];
  band: { minLeft: number; maxLeft: number };
  minFontSize?: number;
  maxFontSize?: number;
};

/**
 * 喺附錄搵基金名稱小標題（英文部分同區段基金名稱一致，只正規化大小寫、引號、破折號
 * 及空格；紅線 4），讀到同一頁下一個小標題為止。
 *
 * - 冇小標題：`not-disclosed`。同名多過一個：報錯，唔揀其中一個。
 * - 讀到頁底都冇下一個小標題，而下一頁第一個小標題之前仲有正文：評論跨頁，
 *   報 `unreadable-layout`，唔出半段。
 */
export function readAppendixNarrative(
  pages: PdfPage[],
  fundName: string,
  spec: AppendixNarrativeSpec,
): NarrativeReadResult {
  const appendixPages = pages.filter((page) =>
    page.items.some((item) => spec.pageHeading.test(item.text.trim())),
  );
  const isSubheading = (item: PdfTextItem) =>
    spec.subheadingFontSize.includes(item.fontSize) && item.text.trim() !== "";
  const isBody = (item: PdfTextItem) =>
    item.text.trim() !== "" &&
    !isSubheading(item) &&
    item.left >= spec.band.minLeft &&
    item.left < spec.band.maxLeft &&
    (spec.minFontSize === undefined || item.fontSize >= spec.minFontSize) &&
    (spec.maxFontSize === undefined || item.fontSize <= spec.maxFontSize);
  const subheadings = appendixPages.flatMap((page) =>
    toLines(page.items.filter(isSubheading)).map((line) => ({ page, ...line })),
  );
  const englishPart = (text: string) => text.replace(/^.*\p{Script=Han}/u, "");
  const target = normalizeFundName(fundName);
  const matches = subheadings.filter(
    (subheading) => normalizeFundName(englishPart(subheading.text)) === target,
  );
  if (matches.length === 0) {
    return { status: "not-disclosed", reason: `no appendix subheading for ${fundName}` };
  }
  if (matches.length > 1) {
    throw new Error(
      `appendix has ${matches.length} subheadings for ${fundName}; refusing to pick one`,
    );
  }
  const subheading = matches[0]!;
  const next = subheadings
    .filter((other) => other.page === subheading.page && other.top > subheading.top + LINE_TOLERANCE)
    .sort((a, b) => a.top - b.top)[0];
  if (!next) {
    const following = appendixPages.find((page) => page.number === subheading.page.number + 1);
    if (following) {
      const firstSubheading = Math.min(
        ...subheadings.filter((other) => other.page === following).map((other) => other.top),
      );
      if (following.items.some((item) => isBody(item) && item.top < firstSubheading)) {
        return {
          status: "unreadable-layout",
          reason: `the commentary for ${fundName} continues onto page ${following.number}`,
        };
      }
    }
  }
  const body = subheading.page.items.filter(
    (item) =>
      isBody(item) &&
      item.top > subheading.top + LINE_TOLERANCE &&
      (!next || item.top < next.top - LINE_TOLERANCE),
  );
  const overlaid = overlapping(body);
  if (overlaid.length > 0) {
    return {
      status: "overlaid",
      reason: `${overlaid.length} text runs overlap with different wording: ${overlaid.slice(0, 2).join(", ")}`,
    };
  }
  const lines = toLines(dropReprints(body)).map((line) => ({ ...line, segment: 1 }));
  if (lines.length === 0) {
    return { status: "not-disclosed", reason: "appendix subheading found but no text below it" };
  }
  markParagraphBreaks(lines);
  return { status: "ok", text: composeText(lines, subheading.text, "bilingual") };
}

