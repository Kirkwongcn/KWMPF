/**
 * `pdftohtml -xml` 的座標抽取。
 *
 * 便覽的配置及持倉是多欄雙語版面，`pdftotext -layout` 會把相鄰欄位的文字併到同一行
 * （例如滙豐那份的配置數字與市場評論），無法定位表格。座標輸出保留每段文字的
 * `top` / `left` / 字體，才能按欄位還原表格。
 */

export type PdfTextItem = {
  page: number;
  /**
   * 頁內的落筆次序（`pdftohtml` 依內容流輸出的先後）。座標排序會蓋過這個次序，
   * 但文字層疊印時只有它分得開「本頁自己的內容」同「疊上去的另一頁」。
   */
  drawIndex: number;
  top: number;
  left: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  text: string;
  /**
   * poppler 自己切詞時，有冇喺呢一段的左界開一個新詞（見 `markWordStarts`）。
   * `true` 即係原文喺呢度有空格，即使兩段的座標黐到冇空隙。冇跑過 `markWordStarts`
   * 就係 `undefined`，接字時只靠水平空隙判斷。
   */
  startsWord?: boolean;
};

export type PdfPage = {
  number: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};

type FontSpec = { size: number; family: string; color: string };

const PAGE_OPEN =
  /<page number="(\d+)"[^>]*height="(\d+)"\s+width="(\d+)"[^>]*>/;
const FONT_SPEC =
  /<fontspec id="(\d+)"\s+size="(-?\d+)"\s+family="([^"]*)"\s+color="([^"]*)"\s*\/>/g;
const TEXT =
  /<text\s+top="(-?\d+)"\s+left="(-?\d+)"\s+width="(-?\d+)"\s+height="(-?\d+)"\s+font="(\d+)"[^>]*>([\s\S]*?)<\/text>/g;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

function decode(value: string) {
  return value
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function parsePdfXml(xml: string): PdfPage[] {
  const pages: PdfPage[] = [];
  // poppler 的 fontspec id 在整份文件內遞增，但只在首次出現的頁面宣告，所以要跨頁累積。
  const fonts = new Map<number, FontSpec>();

  for (const chunk of xml.split(/(?=<page number=")/)) {
    const header = chunk.match(PAGE_OPEN);
    if (!header?.[1] || !header[2] || !header[3]) continue;

    for (const spec of chunk.matchAll(FONT_SPEC)) {
      fonts.set(Number(spec[1]), {
        size: Number(spec[2]),
        family: spec[3] ?? "",
        color: spec[4] ?? "",
      });
    }

    const number = Number(header[1]);
    const items: PdfTextItem[] = [];
    for (const match of chunk.matchAll(TEXT)) {
      const text = decode(match[6] ?? "");
      if (text === "") continue;
      const font = fonts.get(Number(match[5]));
      items.push({
        page: number,
        drawIndex: items.length,
        top: Number(match[1]),
        left: Number(match[2]),
        width: Number(match[3]),
        height: Number(match[4]),
        fontSize: font?.size ?? 0,
        fontFamily: font?.family ?? "",
        fontColor: font?.color ?? "",
        text,
      });
    }

    pages.push({
      number,
      height: Number(header[2]),
      width: Number(header[3]),
      items: items.sort((a, b) => a.top - b.top || a.left - b.left),
    });
  }

  if (pages.length === 0) throw new Error("pdftohtml XML has no pages");
  return pages;
}

/** 文件順序（頁 → top → left）的全部文字段落。 */
export function documentOrder(pages: PdfPage[]): PdfTextItem[] {
  return pages
    .flatMap((page) => page.items)
    .sort(
      (a, b) => a.page - b.page || a.top - b.top || a.left - b.left,
    );
}

/** 中日韓文字、中文標點、全形字符，加上便覽當全形斜線用的 `╱`。 */
export const CJK = /[╱╲　-〿㐀-鿿豈-﫿＀-￯]/;

const BBOX_PAGE = /<page width="([\d.]+)"/;
const BBOX_WORD = /<word xMin="([\d.]+)" yMin="([\d.]+)"[^>]*>/g;

/**
 * 座標對位的容差，用 `pdftohtml` 的整數格計。兩份輸出來自同一個 PDF，只差單位換算
 * 同四捨五入：量過海通那份，1045 段對得上的文字裏面 1036 段偏差喺 1 pt 以內。同一頁
 * 最貼的兩行相隔 5 pt，所以 2 pt 容差夾唔到隔籬行。
 */
const WORD_START_TOLERANCE = 2;

function bboxPageWordStarts(xml: string) {
  return xml
    .split(/(?=<page width=")/)
    .flatMap((chunk) => {
      const header = chunk.match(BBOX_PAGE);
      if (!header?.[1]) return [];
      return [
        {
          width: Number(header[1]),
          starts: [...chunk.matchAll(BBOX_WORD)].map((word) => ({
            x: Number(word[1]),
            y: Number(word[2]),
          })),
        },
      ];
    });
}

/**
 * 用 `pdftotext -bbox` 的切詞結果標記每段文字係咪一個詞的開頭。
 *
 * 中英對照的標籤及證券名喺文字層量到的水平空隙可以係 0——前一段的字寬啱啱食到下一段
 * 的左界——但印出嚟兩者之間確實有空格（海通那份的 `Bonds` ＋ `債券`）。淨靠空隙判斷
 * 會黐埋，等於改寫原文。反過來又唔可以一律喺中英交界加空格：同一份便覽的
 * `Bond` ＋ `債券` 係一個詞 `Bond債券`，`SK` ＋ `海力士` 亦然；而中銀保誠把 `8.4%`
 * 拆成 `8` `.` `4` `%` 四段，加空格會變成 `8 . 4 %`。
 *
 * poppler 自己有一套切詞（`pdftotext -bbox` 逐個 `<word>` 輸出），切喺邊就係原文邊度
 * 有空格。同一個 PDF 的兩份輸出用同一套座標，只差單位（`pdftohtml` 的頁闊 ÷ `pdftotext`
 * 的頁闊），對得返位。`pdftohtml` 用咗 `-hidden` 會多咗隱藏文字層，`pdftotext` 冇——
 * 對唔到位的段落 `startsWord` 係 `false`，退返去只靠空隙判斷，同以前一樣。
 */
export function markWordStarts(pages: PdfPage[], bboxXml: string): PdfPage[] {
  const bboxPages = bboxPageWordStarts(bboxXml);
  return pages.map((page) => {
    // `pdftotext -bbox` 的 `<page>` 冇頁碼，逐版順住輸出，所以第 N 版對 `number` 係 N。
    const bbox = bboxPages[page.number - 1];
    if (!bbox || bbox.width === 0) return page;
    const scale = page.width / bbox.width;
    const starts = new Set(
      bbox.starts.map(
        (start) => `${Math.round(start.x * scale)}:${Math.round(start.y * scale)}`,
      ),
    );
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        startsWord: withinTolerance(starts, item.left, item.top),
      })),
    };
  });
}

function withinTolerance(starts: Set<string>, left: number, top: number) {
  for (let x = left - WORD_START_TOLERANCE; x <= left + WORD_START_TOLERANCE; x += 1) {
    for (let y = top - WORD_START_TOLERANCE; y <= top + WORD_START_TOLERANCE; y += 1) {
      if (starts.has(`${x}:${y}`)) return true;
    }
  }
  return false;
}

/**
 * 數字、小數點、千分位逗號、正負號、百分號——同一個數值可能拆成的碎片。中銀保誠
 * 把 `8.8%` 拆成 `8` `.` `8` `%` 四段緊貼的文字，`pdftotext -bbox` 把呢四段當四個獨立
 * 詞輸出（`startsWord` 全部 `true`），但印出嚟明明係一個數字冇空格。呢個唔係
 * `markWordStarts` 對唔中座標，而係 poppler 切詞本身唔理會「是否同一個數值」；
 * 兩段都屬呢個字符集就唔可以信 `startsWord`，一律退返靠水平空隙判斷。
 */
export const NUMERIC_FRAGMENT = /[\d.,%+-]/;

/**
 * 把同一行的文字段落接成一句。兩段之間真係有水平空隙，或者 poppler 喺後一段開咗一個
 * 新詞（`startsWord`，見 `markWordStarts`）先加空格，其餘緊貼的直接接埋——但兩段都係
 * 數值碎片（見 `NUMERIC_FRAGMENT`）就唔信 `startsWord`，只認水平空隙。
 */
export function joinItems(items: PdfTextItem[], gap = 1) {
  let text = "";
  let right: number | undefined;
  for (const item of items) {
    if (right !== undefined) {
      const hasGap = item.left - right > gap;
      const numericFragment =
        NUMERIC_FRAGMENT.test(text.at(-1) ?? "") && NUMERIC_FRAGMENT.test(item.text[0] ?? "");
      text += hasGap || (item.startsWord === true && !numericFragment) ? " " : "";
    }
    text += item.text;
    right = item.left + item.width;
  }
  return text;
}

export type PdfLine = {
  page: number;
  top: number;
  items: PdfTextItem[];
  text: string;
};

/**
 * 把同一頁內 `top` 相近的段落併成一行。便覽的雙語表格經常把英文名、中文名及百分比
 * 分成三段文字，只有併行之後才看得出「標籤 + 百分比」的結構。
 */
export function toLines(page: PdfPage, tolerance = 4): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const item of [...page.items].sort(
    (a, b) => a.top - b.top || a.left - b.left,
  )) {
    const line = lines.find((current) => Math.abs(current.top - item.top) <= tolerance);
    if (line) line.items.push(item);
    else lines.push({ page: page.number, top: item.top, items: [item], text: "" });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.left - b.left);
    line.text = joinItems(line.items);
  }
  return lines.sort((a, b) => a.top - b.top);
}
