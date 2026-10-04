/**
 * 圖表式配置的讀取（ADR 0013）：便覽把配置畫成圖表、圖例同百分比係向量圖形而唔係文字
 * 時，把頁面渲染成圖像，用兩套獨立的文字辨識程式讀圖上**印出嚟的數字及圖例**。
 *
 * 呢個係抄錄，唔係估算：數值一定係圖上印住的字，唔會由柱長或扇形角度推算。只有以下
 * 全部成立先接受，否則成塊照舊當官方以圖表披露（`chart-only`），唔出局部配置：
 *
 * - 數值：兩次讀取（RapidOCR，同 Tesseract 另讀數值欄或者便覽文字層）讀出同樣
 *   個數，由上至下逐個字元完全一樣；
 * - 圖例：RapidOCR 讀到的英文部分同契約列明、經人手對過圖的圖例清單（`vocabulary`）
 *   其中一項一字不差（英文一樣、中文唔同的再按中文分），同一張圖唔重覆。用文字層
 *   核對時，文字層的圖例亦要對到同一項。顯示的圖例一律用清單原文，唔用辨識結果
 *   （兩套程式讀繁體中文都唔可靠：「債」讀成「债」或者漏字）；
 * - 每行都有圖例同數值，冇落單；
 * - 合計喺 100 ± `sumTolerance` 之內（官方四捨五入）。
 */

export type ChartLabel = {
  /** 網站顯示的圖例原文（經人手對圖；註腳記號唔計）。 */
  label: string;
  /** 用嚟配對的中文部分及英文部分，同 `label` 一致。 */
  zh: string;
  en: string;
};

/** 圖例清單：`[中文, 英文]`，顯示為「中文 英文」。 */
export function chartLabels(pairs: [zh: string, en: string][]): ChartLabel[] {
  return pairs.map(([zh, en]) => ({ label: `${zh} ${en}`, zh, en }));
}

export type ChartReadSpec = {
  /**
   * 圖表範圍（`pdftohtml` 座標）：左右係絕對位置，上下係相對配置標題 `top` 的距離。
   * 要包住全部圖例同數值，但唔好包到隔籬欄或者下一個標題。
   */
  region: { minLeft: number; maxLeft: number; top: number; bottom: number };
  /**
   * 數值欄左界（`pdftohtml` 座標）。Tesseract 讀小數點唔可靠，數值要喺呢一欄另讀一次
   * （見 `scripts/ocr-chart-region.py`）；RapidOCR 照讀整個範圍。
   */
  valuesLeft?: number | "axis";
  /**
   * 圖表係一幅嵌入圖像、而且位置逐隻基金浮動（宏利環球精選）：喺 `region` 範圍內搵
   * 標題之下唯一一幅圖像，按佢喺頁面的位置（加 `pad`）裁圖。搵唔到或者多過一幅就拒絕。
   */
  cropToImage?: { pad: number };
  /**
   * 第二次讀取用邊個：`"tesseract"`（預設）係另一套辨識程式；`"text-layer"` 係便覽本身
   * 的文字層（我的強積金：標註係文字，只係左右兩邊同一條基線、配對唔到），即係用官方
   * 文字核對 RapidOCR 按圖像分好的行。
   */
  secondRead?: "tesseract" | "text-layer";
  /** 文字層讀取時略過細過呢個字級的字（註腳記號「(7)」）。 */
  textLayerMinFontSize?: number;
  /** 圖表之下第一個符合嘅標題（同一頁、同一區段）係範圍下界，`bottom` 只係上限。 */
  stopAt?: RegExp;
  /** 同一條基線上兩個標註之間的最少空隙（`pdftohtml` 單位）；冇就一行一個標註。 */
  splitGap?: number;
  /**
   * 冇數值的行（圖例過長換行）屬邊一行：`"below"`（預設）即係接上一行數值的圖例
   * （永明「貨幣市場工具（港元） 28.1%」下一行「Money Market Instruments (HKD)」），
   * `"above"` 即係接下一行，`"nearest"` 即係接垂直中線最近嗰行（宏利：數值印喺兩行
   * 圖例中間，可能同上一行亦可能同下一行分成一組）；`"nearest-2d"` 再計水平距離
   * （我的強積金：標註散落圓餅圖兩邊）。
   */
  wrap?: "below" | "above" | "nearest" | "nearest-2d";
  vocabulary: ChartLabel[];
  sumTolerance: number;
};

export type OcrBox = { text: string; left: number; top: number; right: number; bottom: number };
export type OcrOutput = {
  rapidocr: OcrBox[];
  tesseract: { words: OcrBox[] }[];
  /** 文字層（`secondRead: "text-layer"`），座標已換成同一張裁圖的像素。 */
  textLayer?: OcrBox[];
  /** 裁圖大細（像素），用嚟查有冇字貼住裁圖邊（即係範圍切走咗部分圖例）。 */
  crop?: { width: number; height: number };
};

export type ChartRow = { label: string; printed: string };
type CandidateRow = {
  text: string;
  printed: string;
  candidates: ChartLabel[];
  top: number;
  bottom: number;
};

export type ChartReadResult =
  | { status: "ok"; entries: { label: string; percent: number }[]; printed: string[]; total: number }
  | { status: "rejected"; reason: string };

// 現金可以係負數（宏利「現金 Cash -2.9%」）。
const VALUE = /(-?\d+(?:\.\d+)?)\s*%$/;

/**
 * 只留英文字母，大細楷照原文（同一計劃唔同基金印「Hong Kong Equities」同
 * 「Hong Kong equities」，係兩個唔同的圖例）。
 */
function latin(text: string) {
  // 只留字母：Tesseract 會把圖表邊緣讀成零星數字（「Energy 9 2.1%」）。
  return text.normalize("NFKC").replace(/[^A-Za-z]/g, "");
}

/**
 * RapidOCR 的模型會把部分繁體字讀成簡體（「消費」讀成「消费」）。只喺比對時換返繁體，
 * 顯示一律用經人手對圖的圖例清單，唔用辨識結果。
 */
const TRADITIONAL: Record<string, string> = Object.fromEntries(
  [..."费債债货币讯医欧亚圆现马国业产疗药资设备应体经际东场价门发产务护汇银险证"].map(
    (char, index) => [char, "費債債貨幣訊醫歐亞圓現馬國業產療藥資設備應體經際東場價門發產務護匯銀險證"[index]!],
  ),
);

/**
 * RapidOCR 模型讀唔到嘅繁體字（2026-06-30 便覽實測：「債」、「幣」、「鎊」會漏讀）。
 * 核對中文時呢啲字缺席唔當不符，其他字最多漏一個。
 */
const RAPIDOCR_UNREADABLE = "債幣鎊";

/** `part` 每個字按次序都喺 `whole` 入面（可以有字跳過）。 */
function isSubsequence(part: string, whole: string) {
  let at = 0;
  for (const char of whole) if (char === part[at]) at += 1;
  return at === part.length;
}

/** 只留中文字，用嚟分辨英文一樣、中文唔同的圖例（「非必需消費品」對「非必需性消費」）。 */
function han(text: string) {
  return [...text.normalize("NFKC")]
    .filter((char) => /\p{Script=Han}/u.test(char))
    .map((char) => TRADITIONAL[char] ?? char)
    .join("");
}

type Segment = {
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  middle: number;
};

/** 按垂直中線分行；同一行內空隙大過 `splitGap` 就拆開兩個標註。 */
function segmentsOf(
  boxes: OcrBox[],
  joiner: string,
  splitGap: number | undefined,
): Segment[] {
  const sorted = [...boxes].sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
  const heights = sorted.map((box) => box.bottom - box.top).sort((a, b) => a - b);
  const tolerance = (heights[Math.floor(heights.length / 2)] ?? 0) * 0.6;
  const rows: OcrBox[][] = [];
  for (const box of sorted) {
    const middle = (box.top + box.bottom) / 2;
    const row = rows.find((candidate) => {
      const first = candidate[0]!;
      return Math.abs((first.top + first.bottom) / 2 - middle) <= tolerance;
    });
    if (row) row.push(box);
    else rows.push([box]);
  }
  return rows.flatMap((row) => {
    row.sort((a, b) => a.left - b.left);
    const parts: OcrBox[][] = [];
    for (const box of row) {
      const previous = parts.at(-1)?.at(-1);
      if (!previous || (splitGap !== undefined && box.left - previous.right > splitGap)) {
        parts.push([box]);
      } else {
        parts.at(-1)!.push(box);
      }
    }
    return parts.map((part) => {
      const top = Math.min(...part.map((box) => box.top));
      const bottom = Math.max(...part.map((box) => box.bottom));
      return {
        text: part.map((box) => box.text).join(joiner).trim(),
        top,
        bottom,
        left: part[0]!.left,
        right: Math.max(...part.map((box) => box.right)),
        middle: (top + bottom) / 2,
      };
    });
  });
}

/**
 * 一套程式的讀數變成「圖例＋印出的數值」逐行清單（由上至下、由左至右）。
 * `match` 決定一段圖例文字對到詞彙表邊一項；對唔到或者對到多過一項就拒絕。
 */
function rowsOf(
  segments: Segment[],
  vocabulary: ChartLabel[],
  wrap: "below" | "above" | "nearest" | "nearest-2d",
  engine: string,
): CandidateRow[] | string {
  // 先按數值分行：有數值的段落開一行，冇數值的段落按 `wrap` 接上一行或者下一行。
  const ordered = segments
    .sort((a, b) => a.top - b.top || a.left - b.left)
    // 圖表邊緣的雜訊（圖例色塊、圓環邊）讀成一兩個符號或字母，唔係圖例；兩個中文字
    // 可以係圖例（「瑞典」），要留。
    .filter(
      (segment) =>
        VALUE.test(segment.text) ||
        /\p{Script=Han}/u.test(segment.text) ||
        segment.text.replace(/\s/g, "").length > 2,
    );
  if (wrap === "nearest" || wrap === "nearest-2d") {
    const valued = ordered.filter((segment) => VALUE.test(segment.text));
    const parts = new Map(valued.map((segment) => [segment, [segment]]));
    for (const segment of ordered) {
      if (VALUE.test(segment.text)) continue;
      // `nearest-2d` 再加水平空隙：同一行緊貼數值的中文（「瑞典」貼住「Sweden 0.09%」）
      // 一定係佢嘅圖例，唔會被圓餅圖另一邊高度相近的標註搶走。條形圖唔用：數值印喺
      // 條尾，同圖例隔住成條柱。
      const distances = valued.map(
        (row) =>
          Math.abs(row.middle - segment.middle) +
          (wrap === "nearest-2d"
            ? Math.max(0, row.left - segment.right, segment.left - row.right)
            : 0),
      );
      const nearest = Math.min(...distances);
      const owners = valued.filter((_, index) => distances[index] === nearest);
      if (owners.length !== 1) {
        return `${engine}: "${segment.text}" is equally near ${owners.length} percentages`;
      }
      parts.get(owners[0]!)!.push(segment);
    }
    const raw = valued.map((row) => {
      const lines = parts.get(row)!.sort((a, b) => a.top - b.top);
      const text = lines.map((line) => line.text).join(" ");
      const value = row.text.match(VALUE)!;
      return {
        label: text.replace(value[0], "").trim(),
        printed: value[1]!,
        top: Math.min(...lines.map((line) => line.top)),
        bottom: Math.max(...lines.map((line) => line.bottom)),
      };
    });
    return matchRows(raw, vocabulary, engine);
  }
  const raw: RawRow[] = [];
  let pending: Segment[] = [];
  for (const segment of ordered) {
    const value = segment.text.match(VALUE);
    if (!value) {
      if (wrap === "below") {
        const previous = raw.at(-1);
        if (!previous) return `${engine}: "${segment.text}" sits above every percentage`;
        previous.label = `${previous.label} ${segment.text}`;
        previous.bottom = Math.max(previous.bottom, segment.bottom);
      } else {
        pending.push(segment);
      }
      continue;
    }
    const label = [...pending.map((line) => line.text), segment.text.slice(0, value.index)]
      .join(" ")
      .trim();
    raw.push({
      label,
      printed: value[1]!,
      top: Math.min(segment.top, ...pending.map((line) => line.top)),
      bottom: segment.bottom,
    });
    pending = [];
  }
  if (pending.length > 0) {
    return `${engine}: "${pending.map((line) => line.text).join(" ")}" sits below every percentage`;
  }
  return matchRows(raw, vocabulary, engine);
}

type RawRow = { label: string; printed: string; top: number; bottom: number };

/** 每行圖例文字對到詞彙表邊幾項（只比英文，見 `latin`）。 */
function matchRows(
  raw: RawRow[],
  vocabulary: ChartLabel[],
  engine: string,
): CandidateRow[] | string {
  const rows: CandidateRow[] = [];
  for (const row of raw) {
    if (latin(row.label) === "") return `${engine}: percentage ${row.printed}% has no legend label`;
    const candidates = vocabulary.filter((entry) => latin(row.label) === latin(entry.en));
    if (candidates.length === 0) {
      return `${engine}: legend "${row.label}" matches no vocabulary entry`;
    }
    rows.push({ text: row.label, printed: row.printed, candidates, top: row.top, bottom: row.bottom });
  }
  return rows;
}

/**
 * 對照兩套程式的讀數。`scale` 係 `pdftohtml` 單位換成圖像像素的倍數（拆標註用）。
 */
export function readChartAllocation(
  ocr: OcrOutput,
  spec: ChartReadSpec,
  scale: number,
): ChartReadResult {
  const splitGap = spec.splitGap === undefined ? undefined : spec.splitGap * scale;
  const wrap = spec.wrap ?? "below";
  // 有字貼住裁圖的左、右或下邊，即係範圍可能切走咗部分圖例；兩次讀取用同一張裁圖，
  // 行數一樣都證明唔到冇漏行，合計容差又遮得住 0.1% 嗰類細項，所以直接拒絕。
  if (ocr.crop) {
    const { width, height } = ocr.crop;
    // 只查左邊同底邊：漏行只會喺底；右邊係數值欄，數值切走一截兩次讀取會對唔上。
    void width;
    const touching = ocr.rapidocr.find((box) => box.left <= 1 || box.bottom >= height - 2);
    if (touching) {
      return { status: "rejected", reason: `"${touching.text}" touches the crop edge` };
    }
  }
  // 框之間加空格，註腳數字（「(7)」）唔會黐落隔籬嘅百分比變成「71.99%」。
  const rapid = rowsOf(segmentsOf(ocr.rapidocr, " ", splitGap), spec.vocabulary, wrap, "rapidocr");
  if (typeof rapid === "string") return { status: "rejected", reason: rapid };
  const second = spec.secondRead ?? "tesseract";
  const tesseractWords = ocr.tesseract.flatMap((line) => line.words);
  const chosen: ChartRow[] = [];
  for (const [index, row] of rapid.entries()) {
    // 英文一樣的圖例按 RapidOCR 讀到的中文分；仍然分唔到就拒絕。
    const entries =
      row.candidates.length === 1
        ? row.candidates
        : row.candidates.filter((entry) => han(row.text) === han(entry.zh));
    if (entries.length !== 1) {
      return {
        status: "rejected",
        reason: `row ${index + 1} legend "${row.text}" fits ${entries.length} vocabulary entries`,
      };
    }
    const entry = entries[0]!;
    if (second === "tesseract") {
      // 清單的中文要同圖上讀到的對得上：RapidOCR 讀到的中文字要按次序喺清單中文入面，
      // 最多漏一個字（佢讀繁體會漏字），否則即係圖例用字唔同，要對圖更新清單。
      const read = han(row.text);
      const listed = han(entry.zh);
      const unreadable = [...listed].filter((char) => RAPIDOCR_UNREADABLE.includes(char)).length;
      if (!isSubsequence(read, listed) || read.length < listed.length - unreadable - 1) {
        return {
          status: "rejected",
          reason: `row ${index + 1} Chinese "${read}" does not fit the listed "${entry.zh}"`,
        };
      }
      // 英文一樣、靠中文分的圖例，而較短嗰個可以由較長嗰個漏字得出（「現金」對
      // 「現金及其他」、「地產」對「房地產」）：RapidOCR 漏字就會揀錯，要 Tesseract 喺同一行
      // 讀到嘅中文確認，佢讀到較長嗰個或者讀唔到就拒絕。
      const droppable = row.candidates.some(
        (candidate) =>
          candidate !== entry &&
          han(candidate.zh).length > han(entry.zh).length &&
          isSubsequence(han(entry.zh), han(candidate.zh)),
      );
      if (droppable) {
        const band = tesseractWords.filter((word) => {
          const middle = (word.top + word.bottom) / 2;
          return middle >= row.top && middle <= row.bottom && !VALUE.test(word.text.trim());
        });
        const other = han(band.map((word) => word.text).join(""));
        const longer = row.candidates.some(
          (candidate) =>
            candidate !== entry &&
            han(candidate.zh).length > han(entry.zh).length &&
            isSubsequence(han(candidate.zh), other),
        );
        if (!isSubsequence(han(entry.zh), other) || longer) {
          return {
            status: "rejected",
            reason: `row ${index + 1} legend "${entry.label}" is not confirmed by tesseract ("${other}")`,
          };
        }
      }
    }
    chosen.push({ label: entry.label, printed: row.printed });
  }

  if (second === "text-layer") {
    if (!ocr.textLayer) return { status: "rejected", reason: "text layer not supplied" };
    const layer = rowsOf(segmentsOf(ocr.textLayer, " ", splitGap), spec.vocabulary, wrap, second);
    if (typeof layer === "string") return { status: "rejected", reason: layer };
    if (layer.length !== chosen.length) {
      return { status: "rejected", reason: `rapidocr read ${chosen.length} rows, text layer ${layer.length}` };
    }
    for (const [index, row] of chosen.entries()) {
      const other = layer[index]!;
      // 文字層係官方原文：中文要同清單一字不差。
      const listed = spec.vocabulary.find((entry) => entry.label === row.label)!;
      if (
        !other.candidates.includes(listed) ||
        han(other.text) !== han(listed.zh) ||
        other.printed !== row.printed
      ) {
        return {
          status: "rejected",
          reason: `row ${index + 1} differs: rapidocr "${row.label} ${row.printed}%" vs text layer "${other.text} ${other.printed}%"`,
        };
      }
    }
  } else {
    // Tesseract 只核對數值：由上至下逐個比。佢讀圖例會夾雜雜碼，圖例由 RapidOCR 對清單。
    const values = ocr.tesseract
      .flatMap((line) => line.words)
      .filter((word) => VALUE.test(word.text.trim()))
      .sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)
      .map((word) => word.text.trim().match(VALUE)![1]!);
    if (values.length !== chosen.length) {
      return {
        status: "rejected",
        reason: `rapidocr read ${chosen.length} percentages, tesseract ${values.length}`,
      };
    }
    for (const [index, row] of chosen.entries()) {
      if (values[index] !== row.printed) {
        return {
          status: "rejected",
          reason: `row ${index + 1} differs: rapidocr ${row.printed}% vs tesseract ${values[index]}%`,
        };
      }
    }
  }
  const rows = chosen;
  if (rows.length < 2) return { status: "rejected", reason: `only ${rows.length} rows read` };
  const labels = rows.map((row) => row.label);
  const duplicate = labels.find((label, index) => labels.indexOf(label) !== index);
  if (duplicate) return { status: "rejected", reason: `legend "${duplicate}" read twice` };

  // 合計用整數運算，避免浮點誤差影響容差判斷。
  const decimals = Math.max(...rows.map((row) => row.printed.split(".")[1]?.length ?? 0));
  const factor = 10 ** decimals;
  const total =
    rows.reduce((sum, row) => sum + Math.round(Number(row.printed) * factor), 0) / factor;
  if (Math.abs(total - 100) > spec.sumTolerance) {
    return {
      status: "rejected",
      reason: `rows total ${total}%, outside 100 ± ${spec.sumTolerance}`,
    };
  }
  return {
    status: "ok",
    entries: rows.map((row) => ({ label: row.label, percent: Number(row.printed) })),
    printed: rows.map((row) => `${row.printed}%`),
    total,
  };
}

/** `coverage:chart-allocations` 輸出：一份來源批次的讀圖結果，待覆核後先合併。 */
export type ChartAllocationRecord = {
  schemeName: string;
  constituentFundName: string;
  fundClassName?: string;
  factSheetFile: string;
  sourceSha256: string;
  page?: number;
  /** 讀圖範圍（`pdftohtml` 座標）。 */
  region?: { left: number; top: number; right: number; bottom: number };
  heading?: string;
} & (
  | {
      status: "ok";
      entries: { label: string; percent: number }[];
      printed: string[];
      total: number;
      /** 兩次讀取用咗乜（辨識程式版本、或者便覽文字層）。 */
      reads: string[];
    }
  | { status: "rejected"; reason: string }
);

export type ChartAllocationFile = {
  generatedAt: string;
  method: { renderer: string };
  funds: ChartAllocationRecord[];
};

